"""
Serving layer for the multi-dataset platform.

Loads one fitted pipeline per bundled dataset and answers prediction,
decision-support and explainability requests against any of them. Also hosts
the upload-and-train path, which runs the identical pipeline on a table the
user supplies.
"""
from __future__ import annotations

import gc
import sys
import threading
import time
import uuid
from dataclasses import asdict
from pathlib import Path
from typing import Any

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "ml"))

import quantum as Q                                       # noqa: E402
from datasets import Dataset, from_dataframe              # noqa: E402
from pipeline import (                                    # noqa: E402
    RISK_TIERS, HybridPipeline, PipelineConfig, binary_metrics,
    risk_stratification, threshold_sweep,
)

MODELS = ROOT / "backend" / "models" / "platform"


def risk_tier(p: float) -> dict[str, Any]:
    for name, lo, hi in RISK_TIERS:
        if lo <= p < hi:
            return {"tier": name, "lower": lo, "upper": min(hi, 1.0)}
    return {"tier": RISK_TIERS[-1][0], "lower": RISK_TIERS[-1][1], "upper": 1.0}


class LoadedPipeline:
    """A fitted pipeline restored from disk, ready to answer predictions."""

    def __init__(self, path: Path):
        import joblib
        b = joblib.load(path)
        self.cfg: PipelineConfig = b["config"]
        self.dataset = b["dataset"]
        self.feature_names = b["feature_names"]
        self.feature_stats = b["feature_stats"]
        self.qhat = b["qhat"]
        self.alpha = b["alpha"]

        self.pipe = HybridPipeline(self.cfg)
        self.pipe.artifacts_ = b["artifacts"]
        self.pipe.models_ = b["models"]
        self.pipe.w_q_ = b["w_quantum"]
        self.pipe.w_classical_ = b.get("w_classical_members")
        self.pipe.w_quantum_ = b.get("w_quantum_members")
        self.pipe.Xq_train_ = b["Xq_train"]
        self.pipe.y_qtrain_ = b["y_qtrain"]
        # states are a deterministic function of the stored angles
        self.pipe.psi_train_ = Q.zz_statevectors(b["Xq_train"], reps=2)
        self.n_qubits = int(self.pipe.artifacts_["n_qubits"])

    # -- schema for building an input form ---------------------------------

    def schema(self) -> dict:
        return {
            "dataset": self.dataset,
            "features": [
                {"name": n,
                 "median": round(float(m), 4),
                 "min": round(float(lo), 4),
                 "max": round(float(hi), 4)}
                for n, m, lo, hi in zip(self.feature_names,
                                        self.feature_stats["median"],
                                        self.feature_stats["p05"],
                                        self.feature_stats["p95"])
            ],
        }

    def defaults(self) -> np.ndarray:
        return np.array(self.feature_stats["median"], dtype=float)

    # -- prediction --------------------------------------------------------

    def conformal(self, p: float) -> dict:
        names = {0: self.dataset["negative_label"], 1: self.dataset["positive_label"]}
        probs = {0: 1 - p, 1: p}
        members = [c for c in (0, 1) if (1 - probs[c]) <= self.qhat[str(c)]]
        if len(members) == 1:
            status, verdict = "committed", names[members[0]]
        elif len(members) == 2:
            status, verdict = "abstained", "Both outcomes remain plausible"
        else:
            status = "abstained"
            verdict = "Neither outcome clears the calibrated threshold"
        return {"set": [names[c] for c in members], "status": status,
                "verdict": verdict,
                "confidence_level": round((1 - self.alpha) * 100)}

    def predict(self, values: dict[str, float] | list[float],
                threshold: float = 0.5, explain: bool = True) -> dict:
        if isinstance(values, dict):
            row = self.defaults()
            for i, n in enumerate(self.feature_names):
                if n in values and values[n] is not None:
                    try:
                        row[i] = float(values[n])
                    except (TypeError, ValueError):
                        pass
        else:
            row = np.array(values, dtype=float)
        X = row.reshape(1, -1)

        t0 = time.time()
        p = self.pipe.predict_proba(X)
        latency = (time.time() - t0) * 1000

        hybrid = float(p["hybrid"][0])
        classical = float(p["classical_mean"][0])
        quantum = float(p["quantum_mean"][0])
        angles = p["_angles"]

        result = {
            "dataset": self.dataset["id"],
            "disease": self.dataset["disease"],
            "probability": round(hybrid, 4),
            "prediction": (self.dataset["positive_label"] if hybrid >= threshold
                           else self.dataset["negative_label"]),
            "threshold": threshold,
            "risk": risk_tier(hybrid),
            "models": {k: round(float(p[k][0]), 4) for k in
                       ("logistic_regression", "random_forest", "svm",
                        "qsvm", "vqc", "qnn", "classical_mean",
                        "quantum_mean", "hybrid")},
            "weights": {"classical": round(1 - self.pipe.w_q_, 3),
                        "quantum": round(self.pipe.w_q_, 3)},
            "uncertainty": {
                "quantum_classical_disagreement": round(abs(classical - quantum), 4),
                "margin": round(abs(hybrid - 0.5), 4),
            },
            "conformal": self.conformal(hybrid),
            "quantum_state": self.quantum_state(angles),
            "latency_ms": round(latency, 1),
        }
        if explain:
            try:
                result["explanation"] = self.pipe.explain(X)
            except Exception as exc:                      # noqa: BLE001
                result["explanation_error"] = str(exc)[:120]
        return result

    def quantum_state(self, angles: np.ndarray) -> dict:
        psi = Q.zz_statevectors(angles, reps=2)
        amps = psi[0]
        probs = np.abs(amps) ** 2
        order = np.argsort(-probs)[:8]
        k = Q.kernel_matrix(psi, self.pipe.psi_train_)
        near = np.argsort(-k[0])[:10]
        pos = self.dataset["positive_label"]
        neg = self.dataset["negative_label"]
        return {
            "n_qubits": self.n_qubits,
            "angles": [round(float(a), 4) for a in angles[0]],
            "bloch": [{kk: (round(v, 4) if isinstance(v, float) else v)
                       for kk, v in c.items()}
                      for c in Q.bloch_coordinates(angles[0], reps=2)],
            "amplitudes": [{"state": format(int(i), f"0{self.n_qubits}b"),
                            "probability": round(float(probs[i]), 5),
                            "phase": round(float(np.angle(amps[i])), 4)}
                           for i in order],
            "neighbours": [{"fidelity": round(float(k[0, i]), 4),
                            "label": pos if self.pipe.y_qtrain_[i] == 1 else neg}
                           for i in near],
        }


# ---------------------------------------------------------------------------
# registry
# ---------------------------------------------------------------------------

class Platform:
    def __init__(self):
        self.pipelines: dict[str, LoadedPipeline] = {}
        for path in sorted(MODELS.glob("*.joblib")):
            try:
                self.pipelines[path.stem] = LoadedPipeline(path)
            except Exception as exc:                       # noqa: BLE001
                print(f"  ! could not load {path.name}: {exc}")
        self.sessions: dict[str, dict] = {}
        self._lock = threading.Lock()

    def get(self, dataset_id: str) -> LoadedPipeline:
        if dataset_id not in self.pipelines:
            raise KeyError(dataset_id)
        return self.pipelines[dataset_id]

    # -- upload and train --------------------------------------------------

    def profile(self, df) -> dict:
        """Describe an uploaded table so the user can choose a target column."""
        import pandas as pd

        cols = []
        for c in df.columns:
            s = df[c]
            nunique = int(s.nunique(dropna=True))
            numeric = pd.to_numeric(s, errors="coerce")
            cols.append({
                "name": str(c),
                "dtype": str(s.dtype),
                "missing": round(float(s.isna().mean()), 4),
                "unique": nunique,
                "numeric": bool(numeric.notna().any()),
                "binary": bool(nunique == 2),
                "sample": [str(v)[:22] for v in s.dropna().unique()[:4]],
            })
        candidates = [c["name"] for c in cols if c["binary"]]
        return {
            "rows": int(len(df)),
            "columns": cols,
            "target_candidates": candidates,
            "suggested_target": candidates[-1] if candidates else None,
            "preview": df.head(8).astype(str).to_dict("records"),
        }

    def train_uploaded(self, df, target: str, name: str, n_qubits: int = 6,
                       progress=None) -> dict:
        ds = from_dataframe(df, target=target, name=name, n_qubits=n_qubits)
        if ds.n_samples < 40:
            raise ValueError("need at least 40 rows to train and evaluate")
        if ds.n_features < 2:
            raise ValueError("need at least two numeric feature columns")

        cfg = PipelineConfig(n_qubits=n_qubits, fast=True, seed=42)
        pipe = HybridPipeline(cfg)
        fitted = pipe.fit(ds, progress=progress)

        session_id = uuid.uuid4().hex[:12]
        with self._lock:
            # Each session holds a fitted pipeline, so the cap is a memory
            # budget rather than a convenience: three is enough for a demo and
            # keeps the process comfortably inside a 512 MB instance.
            while len(self.sessions) >= 3:
                self.sessions.pop(next(iter(self.sessions)))
            self.sessions[session_id] = {"pipeline": pipe, "dataset": ds,
                                         "fitted": fitted, "created": time.time()}
        gc.collect()

        record = _jsonable(asdict(fitted))
        record["session"] = session_id
        record["config"] = cfg.as_dict()
        return record


def _jsonable(obj):
    if isinstance(obj, (np.floating, np.integer)):
        return obj.item()
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, PipelineConfig):
        return obj.as_dict()
    if isinstance(obj, dict):
        return {k: _jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_jsonable(v) for v in obj]
    return obj


__all__ = ["Platform", "LoadedPipeline", "risk_tier", "binary_metrics",
           "threshold_sweep", "risk_stratification", "Dataset"]
