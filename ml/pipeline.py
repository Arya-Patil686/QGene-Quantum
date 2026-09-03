"""
The hybrid quantum-classical pipeline, written once and applied to any dataset.

This is the module the problem statement's delivery table describes:

  1  pre-processing and feature engineering — cleaning, missing-value handling,
     noise clipping, normalisation, feature selection, dimensionality reduction
  2  hybrid architecture — a classical front-end feeding a quantum register
  3  quantum models — QSVM, VQC and a data re-uploading QNN
  4  prediction and decision support — probabilities, risk tiers, and a
     threshold sweep for tuning sensitivity against specificity
  5  evaluation — every model benchmarked against classical baselines on
     accuracy, discrimination, calibration and computational cost

Nothing here knows which disease it is looking at.
"""
from __future__ import annotations

import time
from dataclasses import asdict, dataclass, field

import numpy as np

from datasets import Dataset
import quantum as Q

from sklearn.decomposition import PCA
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_selection import SelectKBest, mutual_info_classif
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, average_precision_score, brier_score_loss, confusion_matrix,
    f1_score, matthews_corrcoef, precision_score, recall_score, roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MinMaxScaler, StandardScaler
from sklearn.svm import SVC

RISK_TIERS = [
    ("Very low", 0.00, 0.10),
    ("Low", 0.10, 0.30),
    ("Moderate", 0.30, 0.60),
    ("High", 0.60, 0.85),
    ("Very high", 0.85, 1.01),
]

CLASSICAL = ("logistic_regression", "random_forest", "svm")
QUANTUM = ("qsvm", "vqc", "qnn")


@dataclass
class PipelineConfig:
    n_qubits: int = 6
    feature_k: int | None = None      # None keeps every feature
    seed: int = 42
    alpha: float = 0.10               # conformal miscoverage target
    qsvm_max_train: int = 3000
    vqc_qubits: int = 4
    qnn_qubits: int = 6
    qnn_layers: int = 3
    fast: bool = False                # lighter settings for interactive training
    winsorize: float = 0.01           # tail fraction clipped as noise

    def as_dict(self) -> dict:
        return asdict(self)


# ---------------------------------------------------------------------------
# metrics
# ---------------------------------------------------------------------------

def binary_metrics(y: np.ndarray, prob: np.ndarray, threshold: float = 0.5) -> dict:
    pred = (prob >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
    sens = tp / (tp + fn) if (tp + fn) else 0.0
    spec = tn / (tn + fp) if (tn + fp) else 0.0
    out = {
        "accuracy": float(accuracy_score(y, pred)),
        "sensitivity": float(sens),
        "specificity": float(spec),
        "precision": float(precision_score(y, pred, zero_division=0)),
        "f1": float(f1_score(y, pred, zero_division=0)),
        "balanced_accuracy": float((sens + spec) / 2),
        "mcc": float(matthews_corrcoef(y, pred)) if len(set(pred)) > 1 else 0.0,
        "brier": float(brier_score_loss(y, prob)),
        "confusion": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
        "threshold": float(threshold),
    }
    if 0 < y.mean() < 1:
        out["roc_auc"] = float(roc_auc_score(y, prob))
        out["pr_auc"] = float(average_precision_score(y, prob))
    else:
        out["roc_auc"] = out["pr_auc"] = float("nan")
    return out


def threshold_sweep(y: np.ndarray, prob: np.ndarray, n: int = 101) -> list[dict]:
    """Sensitivity and specificity across the whole operating range."""
    rows = []
    for t in np.linspace(0.0, 1.0, n):
        pred = (prob >= t).astype(int)
        tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
        sens = tp / (tp + fn) if (tp + fn) else 0.0
        spec = tn / (tn + fp) if (tn + fp) else 0.0
        prec = tp / (tp + fp) if (tp + fp) else 0.0
        rows.append({
            "threshold": round(float(t), 3),
            "sensitivity": round(float(sens), 4),
            "specificity": round(float(spec), 4),
            "precision": round(float(prec), 4),
            "f1": round(float(2 * prec * sens / (prec + sens)) if (prec + sens) else 0.0, 4),
            "youden": round(float(sens + spec - 1), 4),
            "flagged": round(float(pred.mean()), 4),
        })
    return rows


def risk_stratification(y: np.ndarray, prob: np.ndarray) -> list[dict]:
    """
    Observed outcome rate inside each risk band.

    Early risk stratification is only useful if the bands mean something, so
    each tier reports how many test cases landed in it and what fraction of
    them actually had the condition.
    """
    out = []
    for name, lo, hi in RISK_TIERS:
        mask = (prob >= lo) & (prob < hi)
        n = int(mask.sum())
        out.append({
            "tier": name, "lower": lo, "upper": min(hi, 1.0), "n": n,
            "share": round(float(n / max(1, len(prob))), 4),
            "observed_positive_rate": round(float(y[mask].mean()), 4) if n else None,
        })
    return out


def conformal_calibrate(y_val: np.ndarray, prob_val: np.ndarray,
                        alpha: float) -> tuple[dict, dict]:
    """Class-conditional split conformal: thresholds plus calibration scores."""
    p = np.stack([1 - prob_val, prob_val], axis=1)
    qhat, scores = {}, {}
    for c in (0, 1):
        mask = y_val == c
        if not mask.any():
            qhat[str(c)] = 1.0
            scores[c] = np.array([1.0])
            continue
        s = np.sort(1.0 - p[mask, c])
        n = len(s)
        level = min(1.0, np.ceil((n + 1) * (1 - alpha)) / n)
        qhat[str(c)] = float(np.quantile(s, level, method="higher"))
        scores[c] = s
    return qhat, scores


def conformal_report(y: np.ndarray, prob: np.ndarray, qhat: dict,
                     alpha: float, n_cal: int = 0) -> dict:
    p = np.stack([1 - prob, prob], axis=1)
    keep = np.zeros_like(p, dtype=bool)
    for c in (0, 1):
        keep[:, c] = (1.0 - p[:, c]) <= qhat[str(c)]
    covered = keep[np.arange(len(y)), y]
    single = keep.sum(axis=1) == 1
    acc = (keep[single].argmax(axis=1) == y[single]).mean() if single.any() else float("nan")
    return {
        "alpha": alpha,
        "target_coverage": 1 - alpha,
        "empirical_coverage": float(covered.mean()),
        "singleton_rate": float(single.mean()),
        "abstention_rate": float(1 - single.mean()),
        "accuracy_on_confident_calls": float(acc),
        "n_calibration": int(n_cal),
        # The conformal guarantee is asymptotic in the calibration set. Below a
        # few hundred points the empirical coverage wanders around the target,
        # so the count is reported rather than hidden.
        "guarantee_is_tight": bool(n_cal >= 200),
        "qhat": qhat,
    }


# ---------------------------------------------------------------------------
# the pipeline
# ---------------------------------------------------------------------------


def kernel_diagnostics(Xs: np.ndarray, y: np.ndarray, max_qubits: int = 8,
                       n_sample: int = 400, seed: int = 42) -> dict:
    """
    Will a quantum kernel actually help on this dataset?

    Two numbers answer that before any model is trained:

    * **Kernel-target alignment** — how much the kernel's similarity structure
      already agrees with the labels. Near zero means the geometry carries no
      class information, so an SVM on top of it cannot recover any.
    * **Off-diagonal spread** — the standard deviation of the off-diagonal
      entries. As qubits are added, ZZFeatureMap fidelities concentrate towards
      a constant and the spread collapses; a kernel matrix that is effectively
      the identity separates nothing. This is the exponential-concentration
      failure described by Thanasilp et al. (2024), and it is exactly what the
      QSVM results on the smaller datasets look like.

    The sweep is only affordable because the kernel is evaluated in closed form:
    each width costs one batch of state preparations rather than n^2 circuits.
    """
    rng = np.random.default_rng(seed)
    idx = rng.choice(len(Xs), min(n_sample, len(Xs)), replace=False)
    Xs, y = Xs[idx], y[idx]
    signed = np.where(y == 1, 1.0, -1.0)
    target = np.outer(signed, signed)
    off = ~np.eye(len(y), dtype=bool)

    rows = []
    for q in range(2, int(min(max_qubits, Xs.shape[1])) + 1):
        pca = PCA(n_components=q, random_state=seed).fit(Xs)
        ang = MinMaxScaler(feature_range=(0.0, np.pi)).fit_transform(pca.transform(Xs))
        K = Q.kernel_matrix(Q.zz_statevectors(np.clip(ang, 0, np.pi), reps=2))
        kta = float((K * target).sum() /
                    (np.linalg.norm(K) * np.linalg.norm(target) + 1e-12))
        rows.append({
            "qubits": q,
            "alignment": round(kta, 4),
            "off_diagonal_mean": round(float(K[off].mean()), 5),
            "off_diagonal_std": round(float(K[off].std()), 5),
            "variance_retained": round(float(pca.explained_variance_ratio_.sum()), 4),
        })

    best = max(rows, key=lambda r: r["alignment"]) if rows else None
    spread = [r["off_diagonal_std"] for r in rows]
    concentrating = bool(len(spread) >= 3 and spread[-1] < 0.5 * max(spread))
    return {
        "sweep": rows,
        "best_qubits": best["qubits"] if best else None,
        "best_alignment": best["alignment"] if best else None,
        "concentrating": concentrating,
        "verdict": (
            "The kernel concentrates as qubits are added — off-diagonal spread "
            "collapses, so the quantum kernel carries little usable structure "
            "on this dataset."
            if concentrating else
            "Off-diagonal spread holds up across the sweep, so the quantum "
            "kernel retains discriminating structure at this width."),
    }


@dataclass
class FittedPipeline:
    config: PipelineConfig
    dataset: dict
    stages: list[dict]
    models: dict
    hybrid_weight: float
    conformal: dict
    thresholds: list[dict]
    risk_tiers: list[dict]
    roc: dict
    feature_importance: list[dict]
    timings: dict
    quantum: dict
    encoding_points: list[dict] = field(default_factory=list)
    loss_curves: dict = field(default_factory=dict)
    kernel_diagnostics: dict = field(default_factory=dict)
    model_weights: dict = field(default_factory=dict)


class HybridPipeline:
    """Fit the whole hybrid stack on one dataset."""

    def __init__(self, config: PipelineConfig | None = None):
        self.cfg = config or PipelineConfig()
        self.stages_: list[dict] = []

    # -- pre-processing ----------------------------------------------------

    def _split(self, ds: Dataset):
        if ds.split is not None:
            return ds.split["train"], ds.split["val"], ds.split["test"]
        idx = np.arange(ds.n_samples)
        strat = ds.y
        tr, rest = train_test_split(idx, test_size=0.4, random_state=self.cfg.seed,
                                    stratify=strat)
        va, te = train_test_split(rest, test_size=0.5, random_state=self.cfg.seed,
                                  stratify=strat[rest])
        return np.sort(tr), np.sort(va), np.sort(te)

    def _preprocess(self, X: np.ndarray, y: np.ndarray, tr: np.ndarray,
                    feature_names: list[str]):
        cfg = self.cfg
        X = np.array(X, dtype=float, copy=True)
        X[~np.isfinite(X)] = np.nan
        missing_before = float(np.isnan(X).mean())

        # constant columns carry no signal and break the scaler
        keep = np.array([np.nanstd(X[tr, j]) > 1e-12 for j in range(X.shape[1])])
        if not keep.any():
            raise ValueError("every feature is constant on the training split")
        dropped = [f for f, k in zip(feature_names, keep) if not k]
        X = X[:, keep]
        names = [f for f, k in zip(feature_names, keep) if k]
        self.stages_.append({
            "stage": "clean",
            "detail": f"Dropped {len(dropped)} constant column(s)" if dropped
                      else "No constant columns found",
            "n_features": int(X.shape[1]),
        })

        imputer = SimpleImputer(strategy="median").fit(X[tr])
        X = imputer.transform(X)
        self.stages_.append({
            "stage": "impute",
            "detail": f"{missing_before:.2%} of cells were missing; filled with "
                      "the training-set median",
            "n_features": int(X.shape[1]),
        })

        lo = np.quantile(X[tr], cfg.winsorize, axis=0)
        hi = np.quantile(X[tr], 1 - cfg.winsorize, axis=0)
        clipped = float(np.mean((X < lo) | (X > hi)))
        X = np.clip(X, lo, hi)
        self.stages_.append({
            "stage": "denoise",
            "detail": f"Clipped the outer {cfg.winsorize:.0%} of each tail; "
                      f"{clipped:.2%} of values adjusted",
            "n_features": int(X.shape[1]),
        })

        scaler = StandardScaler().fit(X[tr])
        Xs = scaler.transform(X)
        self.stages_.append({
            "stage": "normalise",
            "detail": "Zero mean and unit variance, fitted on the training split",
            "n_features": int(Xs.shape[1]),
        })

        k = cfg.feature_k or Xs.shape[1]
        k = int(min(k, Xs.shape[1]))
        if k < Xs.shape[1]:
            selector = SelectKBest(mutual_info_classif, k=k).fit(Xs[tr], y[tr])
            Xs = selector.transform(Xs)
            names = [n for n, s in zip(names, selector.get_support()) if s]
        else:
            selector = None
        self.stages_.append({
            "stage": "select",
            "detail": (f"Kept the {k} features with the highest mutual information"
                       if selector else "Kept every feature"),
            "n_features": int(Xs.shape[1]),
        })

        n_comp = int(min(cfg.n_qubits, Xs.shape[1], len(tr) - 1))
        pca = PCA(n_components=n_comp, random_state=cfg.seed).fit(Xs[tr])
        Xp = pca.transform(Xs)
        var = float(pca.explained_variance_ratio_.sum())
        self.stages_.append({
            "stage": "reduce",
            "detail": f"PCA to {n_comp} components, retaining {var:.1%} of variance",
            "n_features": n_comp,
        })

        angle = MinMaxScaler(feature_range=(0.0, np.pi)).fit(Xp[tr])
        Xq = np.clip(angle.transform(Xp), 0.0, np.pi)
        self.stages_.append({
            "stage": "encode",
            "detail": f"Rescaled to [0, pi] and encoded on {n_comp} qubits via a "
                      "ZZFeatureMap with full entanglement",
            "n_features": n_comp,
        })

        self.artifacts_ = {
            "raw_feature_names": list(feature_names),
            "keep_mask": keep, "imputer": imputer, "clip_lo": lo, "clip_hi": hi,
            "scaler": scaler, "selector": selector, "pca": pca, "angle": angle,
            "feature_names": names, "n_qubits": n_comp,
            "pca_variance": var, "missing_rate": missing_before,
        }
        return X, Xs, Xq, names, n_comp

    def transform(self, X_raw: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Apply the fitted front-end to new rows: returns (scaled, angles)."""
        a = self.artifacts_
        X = np.array(X_raw, dtype=float, copy=True)
        X[~np.isfinite(X)] = np.nan
        X = X[:, a["keep_mask"]]
        X = a["imputer"].transform(X)
        X = np.clip(X, a["clip_lo"], a["clip_hi"])
        Xs = a["scaler"].transform(X)
        if a["selector"] is not None:
            Xs = a["selector"].transform(Xs)
        Xq = np.clip(a["angle"].transform(a["pca"].transform(Xs)), 0.0, np.pi)
        return Xs, Xq

    # -- fit ---------------------------------------------------------------

    def fit(self, ds: Dataset, progress=None) -> FittedPipeline:
        cfg = self.cfg
        cfg.n_qubits = ds.n_qubits if ds.n_qubits else cfg.n_qubits
        rng = np.random.default_rng(cfg.seed)
        say = progress or (lambda *_: None)
        self.stages_ = []

        tr, va, te = self._split(ds)
        y = ds.y
        say("preprocess", "cleaning, imputing and encoding")
        Xraw, Xs, Xq, names, n_qubits = self._preprocess(
            ds.X, y, tr, ds.feature_names)

        probs: dict[str, dict[str, np.ndarray]] = {}
        timings: dict[str, dict] = {}
        models: dict[str, object] = {}
        loss_curves: dict[str, list[float]] = {}

        def record(key, fit_fn, pred_fn):
            t0 = time.time()
            fit_fn()
            t_fit = time.time() - t0
            out = {}
            t0 = time.time()
            for split, idx in (("val", va), ("test", te)):
                out[split] = pred_fn(idx)
            t_pred = (time.time() - t0) / max(1, len(va) + len(te))
            probs[key] = out
            timings[key] = {"train_seconds": round(t_fit, 3),
                            "inference_ms_per_sample": round(t_pred * 1000, 4)}

        # -- classical baselines
        say("logistic_regression", "fitting a logistic-regression baseline")
        lr = LogisticRegression(max_iter=2000, class_weight="balanced")
        record("logistic_regression",
               lambda: lr.fit(Xs[tr], y[tr]),
               lambda i: lr.predict_proba(Xs[i])[:, 1])
        models["logistic_regression"] = lr

        say("random_forest", "fitting a random forest")
        n_trees = 200 if cfg.fast else 400
        rf = RandomForestClassifier(n_estimators=n_trees, min_samples_leaf=2,
                                    class_weight="balanced",
                                    random_state=cfg.seed, n_jobs=-1)
        record("random_forest",
               lambda: rf.fit(Xraw[tr], y[tr]),
               lambda i: rf.predict_proba(Xraw[i])[:, 1])
        models["random_forest"] = rf

        say("svm", "fitting an RBF support vector machine")
        svm = SVC(kernel="rbf", C=4.0, gamma="scale", probability=True,
                  class_weight="balanced", random_state=cfg.seed)
        record("svm",
               lambda: svm.fit(Xs[tr], y[tr]),
               lambda i: svm.predict_proba(Xs[i])[:, 1])
        models["svm"] = svm

        # -- quantum
        say("qsvm", "building the quantum kernel")
        q_idx = tr if len(tr) <= cfg.qsvm_max_train else np.sort(
            rng.choice(tr, cfg.qsvm_max_train, replace=False))
        t0 = time.time()
        psi_train = Q.zz_statevectors(Xq[q_idx], reps=2)
        K = Q.kernel_matrix(psi_train)
        gram_seconds = time.time() - t0
        qsvm = SVC(kernel="precomputed", C=4.0, probability=True,
                   class_weight="balanced", random_state=cfg.seed)
        record("qsvm",
               lambda: qsvm.fit(K, y[q_idx]),
               lambda i: qsvm.predict_proba(
                   Q.kernel_matrix(Q.zz_statevectors(Xq[i], reps=2), psi_train))[:, 1])
        models["qsvm"] = qsvm

        say("vqc", "training the variational quantum classifier")
        vqc_q = int(min(cfg.vqc_qubits, n_qubits))
        vqc = Q.StatevectorVQC(n_qubits=vqc_q, feature_reps=2, ansatz_reps=3,
                               seed=cfg.seed)
        record("vqc",
               lambda: vqc.fit(Xq[tr][:, :vqc_q], y[tr],
                               maxiter=400 if cfg.fast else 900),
               lambda i: vqc.predict_proba(Xq[i][:, :vqc_q])[:, 1])
        models["vqc"] = vqc
        loss_curves["vqc"] = [round(float(v), 5) for v in vqc.loss_history_[::4]]

        say("qnn", "training the data re-uploading quantum neural network")
        # The QNN keeps its own register width: cost grows with 2^q on every
        # one of its many optimiser evaluations, and beyond six qubits the
        # extra components buy less than they cost.
        qnn_q = int(min(cfg.qnn_qubits, n_qubits))
        qnn = Q.DataReuploadingQNN(n_qubits=qnn_q, layers=cfg.qnn_layers,
                                   seed=cfg.seed)
        record("qnn",
               lambda: qnn.fit(Xq[tr][:, :qnn_q], y[tr],
                               maxiter=250 if cfg.fast else 600,
                               max_samples=1200 if cfg.fast else 2500),
               lambda i: qnn.predict_proba(Xq[i][:, :qnn_q])[:, 1])
        models["qnn"] = qnn
        loss_curves["qnn"] = [round(float(v), 5) for v in qnn.loss_history_[::8]]

        # -- hybrid ensemble
        say("hybrid", "weighting the ensemble on the validation split")

        # Within each family, weight members by how far their validation AUC
        # beats chance. A plain mean lets a failed member (a concentrated
        # kernel, say) drag down an otherwise good family, which is what a
        # clinician would least expect from an ensemble.
        def family_weights(keys):
            if not (0 < y[va].mean() < 1):
                return {k: 1.0 / len(keys) for k in keys}
            adv = {k: max(0.0, roc_auc_score(y[va], probs[k]["val"]) - 0.5)
                   for k in keys}
            total = sum(adv.values())
            if total <= 1e-9:
                return {k: 1.0 / len(keys) for k in keys}
            return {k: v / total for k, v in adv.items()}

        w_classical = family_weights(CLASSICAL)
        w_quantum = family_weights(QUANTUM)

        def blend(split, w):
            c = sum(w_classical[k] * probs[k][split] for k in CLASSICAL)
            q = sum(w_quantum[k] * probs[k][split] for k in QUANTUM)
            return (1 - w) * c + w * q

        grid = np.linspace(0, 1, 101)
        if 0 < y[va].mean() < 1:
            scores = [roc_auc_score(y[va], blend("val", w)) for w in grid]
            w_q = float(grid[int(np.argmax(scores))])
        else:
            w_q = 0.5
        probs["hybrid"] = {s: blend(s, w_q) for s in ("val", "test")}
        model_weights = {
            "classical": {k: round(v, 4) for k, v in w_classical.items()},
            "quantum": {k: round(v, 4) for k, v in w_quantum.items()},
            "quantum_share": round(w_q, 3),
        }
        timings["hybrid"] = {
            "train_seconds": round(sum(timings[k]["train_seconds"]
                                       for k in list(CLASSICAL) + list(QUANTUM)), 3),
            "inference_ms_per_sample": round(sum(
                timings[k]["inference_ms_per_sample"]
                for k in list(CLASSICAL) + list(QUANTUM)), 4),
        }

        # -- evaluate
        results = {k: binary_metrics(y[te], v["test"]) for k, v in probs.items()}
        for k in results:
            results[k]["family"] = ("quantum" if k in QUANTUM else
                                    "hybrid" if k == "hybrid" else "classical")
            results[k].update(timings[k])

        qhat, _ = conformal_calibrate(y[va], probs["hybrid"]["val"], cfg.alpha)
        conformal = conformal_report(y[te], probs["hybrid"]["test"], qhat,
                                     cfg.alpha, n_cal=len(va))
        sweep = threshold_sweep(y[te], probs["hybrid"]["test"])
        tiers = risk_stratification(y[te], probs["hybrid"]["test"])

        roc = {}
        for k, v in probs.items():
            if 0 < y[te].mean() < 1:
                fpr, tpr, _ = roc_curve(y[te], v["test"])
                step = max(1, len(fpr) // 110)
                roc[k] = {"fpr": [round(float(x), 4) for x in fpr[::step]],
                          "tpr": [round(float(x), 4) for x in tpr[::step]]}

        importance = sorted(
            [{"feature": n, "importance": round(float(v), 5)}
             for n, v in zip(self.artifacts_["feature_names"], rf.feature_importances_)],
            key=lambda r: -r["importance"])[:16]

        pick = rng.choice(te, min(500, len(te)), replace=False)
        pos = np.searchsorted(te, pick)
        encoding_points = [
            {"x": round(float(a), 3), "y": round(float(b), 3),
             "z": round(float(c), 3), "label": int(l), "p": round(float(pp), 3)}
            for a, b, c, l, pp in zip(
                Xq[pick, 0], Xq[pick, 1], Xq[pick, min(2, n_qubits - 1)],
                y[pick], probs["hybrid"]["test"][pos])]

        kernel_dev = Q.verify_against_qiskit(n_qubits=min(n_qubits, 5), reps=2, n=6)

        self.probs_ = probs
        self.models_ = models
        self.qhat_ = qhat
        self.splits_ = (tr, va, te)
        self.psi_train_ = psi_train
        self.Xq_train_ = Xq[q_idx]
        self.y_qtrain_ = y[q_idx]
        self.w_q_ = w_q
        self.w_classical_ = w_classical
        self.w_quantum_ = w_quantum

        say("diagnostics", "sweeping the quantum kernel for concentration")
        diagnostics = kernel_diagnostics(Xs[tr], y[tr],
                                         max_qubits=max(8, n_qubits),
                                         seed=cfg.seed)

        return FittedPipeline(
            config=cfg,
            dataset=ds.summary(),
            stages=self.stages_,
            models=results,
            hybrid_weight=w_q,
            conformal=conformal,
            thresholds=sweep,
            risk_tiers=tiers,
            roc=roc,
            feature_importance=importance,
            timings=timings,
            quantum={
                "n_qubits": n_qubits,
                "vqc_qubits": vqc_q,
                "qnn_layers": cfg.qnn_layers,
                "qnn_qubits": qnn_q,
                "qnn_parameters": qnn.n_params,
                "feature_map": "ZZFeatureMap(reps=2, full entanglement)",
                "vqc_ansatz": "RealAmplitudes(reps=3)",
                "qnn_ansatz": f"data re-uploading, {cfg.qnn_layers} layers, CZ ring",
                "pca_variance_retained": self.artifacts_["pca_variance"],
                "qsvm_train_samples": int(len(q_idx)),
                "gram_matrix_seconds": round(gram_seconds, 3),
                "gram_shape": [int(len(q_idx))] * 2,
                "kernel_max_deviation_vs_qiskit": kernel_dev,
            },
            encoding_points=encoding_points,
            loss_curves=loss_curves,
            kernel_diagnostics=diagnostics,
            model_weights=model_weights,
        )

    # -- inference ---------------------------------------------------------

    def predict_proba(self, X_raw: np.ndarray) -> dict[str, np.ndarray]:
        Xs, Xq = self.transform(X_raw)
        X = np.array(X_raw, dtype=float, copy=True)
        X[~np.isfinite(X)] = np.nan
        a = self.artifacts_
        Xi = np.clip(a["imputer"].transform(X[:, a["keep_mask"]]),
                     a["clip_lo"], a["clip_hi"])
        m = self.models_
        vqc_q = m["vqc"].n_qubits
        qnn_q = m["qnn"].n_qubits
        out = {
            "logistic_regression": m["logistic_regression"].predict_proba(Xs)[:, 1],
            "random_forest": m["random_forest"].predict_proba(Xi)[:, 1],
            "svm": m["svm"].predict_proba(Xs)[:, 1],
            "qsvm": m["qsvm"].predict_proba(
                Q.kernel_matrix(Q.zz_statevectors(Xq, reps=2), self.psi_train_))[:, 1],
            "vqc": m["vqc"].predict_proba(Xq[:, :vqc_q])[:, 1],
            "qnn": m["qnn"].predict_proba(Xq[:, :qnn_q])[:, 1],
        }
        wc = getattr(self, "w_classical_", None) or {k: 1 / len(CLASSICAL) for k in CLASSICAL}
        wq = getattr(self, "w_quantum_", None) or {k: 1 / len(QUANTUM) for k in QUANTUM}
        out["classical_mean"] = sum(wc[k] * out[k] for k in CLASSICAL)
        out["quantum_mean"] = sum(wq[k] * out[k] for k in QUANTUM)
        out["hybrid"] = ((1 - self.w_q_) * out["classical_mean"]
                         + self.w_q_ * out["quantum_mean"])
        out["_angles"] = Xq
        return out

    def explain(self, X_raw: np.ndarray, top_k: int = 8) -> list[dict]:
        """
        Per-feature SHAP contributions for one row, from the random forest.

        The forest is the only model in the stack with an exact tree explainer,
        and it sits on the same imputed features a clinician would recognise,
        so it is the one used for attribution.
        """
        import shap
        a = self.artifacts_
        X = np.array(X_raw, dtype=float, copy=True)
        X[~np.isfinite(X)] = np.nan
        Xi = np.clip(a["imputer"].transform(X[:, a["keep_mask"]]),
                     a["clip_lo"], a["clip_hi"])
        if not hasattr(self, "_explainer"):
            self._explainer = shap.TreeExplainer(self.models_["random_forest"])
        raw = self._explainer.shap_values(Xi, check_additivity=False)
        arr = np.asarray(raw)
        if arr.ndim == 3:
            vals = arr[0, :, 1]
        elif isinstance(raw, list):
            vals = np.asarray(raw[1]).ravel()
        else:
            vals = arr.ravel()
        names = [f for f, k in zip(a.get("raw_feature_names", []), a["keep_mask"]) if k] \
            if a.get("raw_feature_names") else [f"f{i}" for i in range(len(vals))]
        rows = [{"feature": n, "value": round(float(v), 4),
                 "contribution": round(float(c), 5),
                 "direction": "towards disease" if c > 0 else "towards healthy"}
                for n, v, c in zip(names, Xi[0], vals)]
        return sorted(rows, key=lambda r: -abs(r["contribution"]))[:top_k]
