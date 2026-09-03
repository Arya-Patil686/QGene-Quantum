"""
Prediction core. Everything the API returns for a single variant is assembled
here, so the same code path serves the web API, the batch endpoint and the
offline VUS scoring script.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "ml"))

import quantum as Q  # noqa: E402
from features import (  # noqa: E402
    DOMAINS, MOLECULAR_FEATURES, PROTEIN_LEN, describe, molecular_vector,
    parse_hgvs,
)

BUNDLE_PATH = ROOT / "backend" / "models" / "qgene_bundle.joblib"


class QGene:
    """Loaded model bundle plus the inference logic that uses it."""

    def __init__(self, bundle_path: Path = BUNDLE_PATH):
        import joblib
        b = joblib.load(bundle_path)
        self.rf = b["rf"]
        self.svm = b["svm"]
        self.qsvm = b["qsvm"]
        self.scaler = b["scaler"]
        self.pca = b["pca"]
        self.angle = b["angle"]
        # Rebuild the QSVM training states from the stored angles.
        self.Xq_train = b["Xq_train"]
        self.psi_train = Q.zz_statevectors(self.Xq_train, reps=2)
        self.y_qtrain = b["y_qtrain"]
        self.w_q = b["w_quantum"]
        self.qhat = b["qhat"]
        self.alpha = b["alpha"]
        self.feature_names = b["feature_names"]
        self.background = b["background"]
        self.cal_scores = b["cal_scores"]
        cfg = b["vqc_cfg"]
        self.vqc = Q.StatevectorVQC(**cfg)
        self.vqc.theta_ = b["vqc_theta"]
        self.vqc.scale_ = b["vqc_scale"]
        self.vqc.bias_ = b["vqc_bias"]
        # the kernel register, not the (narrower) variational one
        self.n_qubits = int(b.get("kernel_qubits",
                                  np.log2(self.psi_train.shape[1])))
        self._explainer = None

    # -- encoding -----------------------------------------------------------

    def encode(self, X_mol: np.ndarray) -> np.ndarray:
        """Molecular features -> rotation angles in [0, pi] for the feature map."""
        z = self.scaler.transform(X_mol)
        return np.clip(self.angle.transform(self.pca.transform(z)), 0.0, np.pi)

    # -- model probabilities ------------------------------------------------

    def probabilities(self, X_mol: np.ndarray) -> dict[str, np.ndarray]:
        Xs = self.scaler.transform(X_mol)
        Xq = self.encode(X_mol)
        psi = Q.zz_statevectors(Xq, reps=2)
        k = Q.kernel_matrix(psi, self.psi_train)

        rf = self.rf.predict_proba(X_mol)[:, 1]
        svm = self.svm.predict_proba(Xs)[:, 1]
        qsvm = self.qsvm.predict_proba(k)[:, 1]
        vqc = self.vqc.predict_proba(Xq[:, :self.vqc.n_qubits])[:, 1]

        classical = 0.5 * (rf + svm)
        quantum = 0.5 * (qsvm + vqc)
        hybrid = (1 - self.w_q) * classical + self.w_q * quantum
        return {"rf": rf, "svm": svm, "qsvm": qsvm, "vqc": vqc,
                "classical": classical, "quantum": quantum, "hybrid": hybrid,
                "_psi": psi, "_kernel": k, "_angles": Xq}

    # -- conformal ----------------------------------------------------------

    def conformal_set(self, p: float) -> dict[str, Any]:
        """
        Class-conditional conformal output.

        As well as the prediction set at the calibrated alpha, this reports the
        per-class conformal p-value -- the fraction of calibration variants of
        that class that the model fitted *less* well than this one. From those
        come the two standard summaries: credibility (how well the best label
        fits) and confidence (how firmly the alternative is excluded).
        """
        names = {0: "Benign", 1: "Pathogenic"}
        probs = {0: 1.0 - p, 1: p}
        p_values: dict[int, float] = {}
        for c in (0, 1):
            scores = self.cal_scores[c]
            s = 1.0 - probs[c]
            # p-value = (#{calibration scores >= s} + 1) / (n + 1)
            n = len(scores)
            ge = int(n - np.searchsorted(scores, s, side="left"))
            p_values[c] = (ge + 1) / (n + 1)

        members = [c for c in (0, 1) if p_values[c] > self.alpha]
        best = max(p_values, key=lambda c: p_values[c])
        other = 1 - best

        if len(members) == 1:
            status, verdict = "committed", names[members[0]]
        elif len(members) == 2:
            status = "abstained"
            verdict = "Both labels remain plausible at this confidence level"
        else:
            status = "abstained"
            verdict = ("Neither label clears the calibrated threshold — the "
                       "model declines to commit")

        return {
            "set": [names[c] for c in members],
            "status": status,
            "verdict": verdict,
            "confidence_level": round((1 - self.alpha) * 100),
            "p_values": {names[c]: round(p_values[c], 4) for c in (0, 1)},
            "credibility": round(p_values[best], 4),
            "confidence": round(1.0 - p_values[other], 4),
            "thresholds": {names[c]: round(self.qhat[str(c)], 4) for c in (0, 1)},
        }

    # -- explanation --------------------------------------------------------

    def shap_explanation(self, X_mol: np.ndarray, top_k: int = 8) -> list[dict]:
        import shap
        if self._explainer is None:
            self._explainer = shap.TreeExplainer(self.rf)
        raw = self._explainer.shap_values(X_mol, check_additivity=False)
        arr = np.asarray(raw)
        if arr.ndim == 3:                      # (n, features, classes)
            vals = arr[0, :, 1]
        elif isinstance(raw, list):
            vals = np.asarray(raw[1]).ravel()
        else:
            vals = arr.ravel()
        out = [
            {"feature": name,
             "value": round(float(v), 4),
             "contribution": round(float(c), 5),
             "direction": "towards pathogenic" if c > 0 else "towards benign"}
            for name, v, c in zip(self.feature_names, X_mol[0], vals)
        ]
        return sorted(out, key=lambda r: -abs(r["contribution"]))[:top_k]

    # -- quantum introspection ---------------------------------------------

    def quantum_state(self, angles: np.ndarray, psi: np.ndarray,
                      kernel_row: np.ndarray) -> dict[str, Any]:
        amps = psi[0]
        probs = np.abs(amps) ** 2
        order = np.argsort(-probs)[:8]
        nearest = np.argsort(-kernel_row[0])[:12]
        return {
            "n_qubits": self.n_qubits,
            "angles": [round(float(a), 4) for a in angles[0]],
            "bloch": [
                {k: (round(v, 4) if isinstance(v, float) else v) for k, v in c.items()}
                for c in Q.bloch_coordinates(angles[0], reps=2)
            ],
            "amplitudes": [
                {"state": format(int(i), f"0{self.n_qubits}b"),
                 "probability": round(float(probs[i]), 5),
                 "phase": round(float(np.angle(amps[i])), 4)}
                for i in order
            ],
            "entanglement_entropy": round(float(_entanglement_entropy(amps, self.n_qubits)), 4),
            "neighbours": [
                {"fidelity": round(float(kernel_row[0, i]), 4),
                 "label": "Pathogenic" if self.y_qtrain[i] == 1 else "Benign"}
                for i in nearest
            ],
            "circuit": _circuit_spec(angles[0], self.n_qubits),
        }

    # -- one variant, end to end -------------------------------------------

    def predict(self, payload: dict[str, Any], explain: bool = True) -> dict[str, Any]:
        row = _normalise_input(payload)
        X = molecular_vector(row).reshape(1, -1)
        p = self.probabilities(X)
        hybrid = float(p["hybrid"][0])
        classical = float(p["classical"][0])
        quantum = float(p["quantum"][0])
        disagreement = abs(classical - quantum)

        result: dict[str, Any] = {
            "input": row,
            "annotation": describe(row),
            "prediction": "Pathogenic" if hybrid > 0.5 else "Benign",
            "pathogenic_probability": round(hybrid, 4),
            "confidence": round(max(hybrid, 1 - hybrid), 4),
            "models": {
                "random_forest": round(float(p["rf"][0]), 4),
                "svm": round(float(p["svm"][0]), 4),
                "qsvm": round(float(p["qsvm"][0]), 4),
                "vqc": round(float(p["vqc"][0]), 4),
                "classical_mean": round(classical, 4),
                "quantum_mean": round(quantum, 4),
                "hybrid": round(hybrid, 4),
            },
            "weights": {"classical": round(1 - self.w_q, 3),
                        "quantum": round(self.w_q, 3)},
            "uncertainty": {
                "quantum_classical_disagreement": round(disagreement, 4),
                "margin": round(abs(hybrid - 0.5), 4),
                "flag": _uncertainty_flag(disagreement, abs(hybrid - 0.5)),
            },
            "conformal": self.conformal_set(hybrid),
            "quantum": self.quantum_state(p["_angles"], p["_psi"], p["_kernel"]),
            "protein_track": _protein_track(row),
        }
        if explain:
            result["explanation"] = self.shap_explanation(X)
        return result


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _entanglement_entropy(amps: np.ndarray, n_qubits: int) -> float:
    """Von Neumann entropy across a half-split of the register."""
    half = n_qubits // 2
    m = amps.reshape(1 << half, -1)
    s = np.linalg.svd(m, compute_uv=False)
    p = np.clip(s ** 2, 1e-12, None)
    p = p / p.sum()
    return float(-(p * np.log2(p)).sum())


def _circuit_spec(angles: np.ndarray, n_qubits: int, reps: int = 2) -> list[dict]:
    """Gate-by-gate description of the ZZFeatureMap for this variant."""
    ops: list[dict] = []
    for r in range(reps):
        for q in range(n_qubits):
            ops.append({"rep": r, "gate": "H", "qubits": [q]})
        for q in range(n_qubits):
            ops.append({"rep": r, "gate": "P", "qubits": [q],
                        "angle": round(float(2 * angles[q]), 4)})
        for i in range(n_qubits):
            for j in range(i + 1, n_qubits):
                theta = 2 * (np.pi - angles[i]) * (np.pi - angles[j])
                ops.append({"rep": r, "gate": "ZZ", "qubits": [i, j],
                            "angle": round(float(theta), 4)})
    return ops


def _uncertainty_flag(disagreement: float, margin: float) -> str:
    if disagreement > 0.25 or margin < 0.08:
        return "high"
    if disagreement > 0.12 or margin < 0.18:
        return "moderate"
    return "low"


def _protein_track(row: dict[str, Any]) -> dict[str, Any]:
    """Where the variant sits along the protein, with domain boundaries."""
    gene = str(row.get("gene", "BRCA1")).upper()
    p = parse_hgvs(str(row.get("name", "")))
    length = PROTEIN_LEN.get(gene, 1863)
    return {
        "gene": gene,
        "length": length,
        "position": p["aa_pos"] or None,
        "domains": [{"name": n, "start": s, "end": e} for n, s, e in DOMAINS.get(gene, [])],
    }


def _normalise_input(payload: dict[str, Any]) -> dict[str, Any]:
    """Accept either a full HGVS name or structured fields."""
    name = str(payload.get("name") or payload.get("hgvs") or "").strip()
    gene = str(payload.get("gene") or "").strip().upper()
    if not gene:
        gene = "BRCA2" if "BRCA2" in name.upper() else "BRCA1"
    var_type = str(payload.get("var_type") or payload.get("mutation_type")
                   or _infer_type(name)).lower()
    start = float(payload.get("start") or payload.get("position") or 0)
    stop = float(payload.get("stop") or start)
    length = payload.get("mutation_length")
    if length and not payload.get("stop"):
        stop = start + max(0.0, float(length) - 1)
    return {"gene": gene, "name": name, "var_type": var_type,
            "start": start, "stop": stop}


def _infer_type(name: str) -> str:
    low = name.lower()
    if "delins" in low or "indel" in low:
        return "indel"
    if "del" in low:
        return "deletion"
    if "dup" in low:
        return "duplication"
    if "ins" in low:
        return "insertion"
    if "inv" in low:
        return "inversion"
    return "single nucleotide variant"


__all__ = ["QGene", "MOLECULAR_FEATURES"]
