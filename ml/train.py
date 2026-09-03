"""
Train and evaluate the QGene model suite.

Models
------
  Random Forest        classical baseline, also the SHAP explainer
  SVM (RBF)            classical baseline
  QSVM                 SVC on a precomputed ZZFeatureMap fidelity kernel
  VQC                  variational classifier, batched statevector training
  Hybrid ensemble      classical/quantum blend, weight fitted on validation

On top of the models
--------------------
  Split conformal prediction  class-conditional, gives a coverage guarantee
                              and lets the system abstain instead of guessing
  Quantum-classical disagreement  used as an epistemic uncertainty signal and
                              evaluated as an error detector
  Leakage demonstration       quantifies how much accuracy the original
                              row-level split was borrowing from duplicate
                              assembly rows
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
import quantum as Q  # noqa: E402
from features import MOLECULAR_FEATURES  # noqa: E402

from sklearn.decomposition import PCA
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, average_precision_score, brier_score_loss, confusion_matrix,
    f1_score, matthews_corrcoef, precision_score, recall_score, roc_auc_score,
    roc_curve,
)
from sklearn.preprocessing import MinMaxScaler, StandardScaler
from sklearn.svm import SVC

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "processed"
MODELS = ROOT / "backend" / "models"
OUTDATA = ROOT / "backend" / "data"

SEED = 42
N_QUBITS = 8            # kernel register
VQC_QUBITS = 4          # variational register -- see the note in main()
QSVM_TRAIN_CAP = 4000     # kernel memory guard; the original used 500
ALPHA = 0.10              # conformal target: 90% coverage


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def evaluate(y_true: np.ndarray, prob: np.ndarray, name: str) -> dict:
    pred = (prob > 0.5).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, pred, labels=[0, 1]).ravel()
    return {
        "model": name,
        "accuracy": float(accuracy_score(y_true, pred)),
        "precision": float(precision_score(y_true, pred, zero_division=0)),
        "recall": float(recall_score(y_true, pred, zero_division=0)),
        "f1": float(f1_score(y_true, pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_true, prob)),
        "pr_auc": float(average_precision_score(y_true, prob)),
        "mcc": float(matthews_corrcoef(y_true, pred)),
        "brier": float(brier_score_loss(y_true, prob)),
        "confusion": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    }


def mcnemar(y: np.ndarray, pa: np.ndarray, pb: np.ndarray) -> dict:
    """Exact McNemar test between two classifiers' correctness patterns."""
    from scipy.stats import binomtest
    a_ok = (pa > 0.5).astype(int) == y
    b_ok = (pb > 0.5).astype(int) == y
    n01 = int(np.sum(a_ok & ~b_ok))
    n10 = int(np.sum(~a_ok & b_ok))
    if n01 + n10 == 0:
        return {"n01": 0, "n10": 0, "p_value": 1.0, "significant": False}
    p = binomtest(n01, n01 + n10, 0.5).pvalue
    return {"n01": n01, "n10": n10, "p_value": float(p),
            "significant": bool(p < 0.05)}


def conformal_calibrate(y_val: np.ndarray, prob_val: np.ndarray,
                        alpha: float = ALPHA) -> dict[str, float]:
    """
    Class-conditional (Mondrian) split conformal calibration.

    Nonconformity is 1 - p(true class). For each class we take the
    finite-sample corrected (1-alpha) quantile of the calibration scores.
    """
    p_mat = np.stack([1 - prob_val, prob_val], axis=1)
    q: dict[str, float] = {}
    for c in (0, 1):
        mask = y_val == c
        scores = 1.0 - p_mat[mask, c]
        n = int(mask.sum())
        level = min(1.0, np.ceil((n + 1) * (1 - alpha)) / n)
        q[str(c)] = float(np.quantile(scores, level, method="higher"))
    return q


def conformal_sets(prob: np.ndarray, qhat: dict[str, float]) -> np.ndarray:
    """Boolean (n, 2) membership matrix of the conformal prediction sets."""
    p_mat = np.stack([1 - prob, prob], axis=1)
    keep = np.zeros_like(p_mat, dtype=bool)
    for c in (0, 1):
        keep[:, c] = (1.0 - p_mat[:, c]) <= qhat[str(c)]
    return keep


def selective_risk_curve(y: np.ndarray, prob: np.ndarray,
                         uncertainty: np.ndarray, n_points: int = 21) -> list[dict]:
    """Error rate as a function of how much of the test set we keep."""
    order = np.argsort(uncertainty)
    correct = ((prob > 0.5).astype(int) == y)[order]
    out = []
    for frac in np.linspace(0.05, 1.0, n_points):
        k = max(1, int(round(frac * len(order))))
        out.append({"coverage": round(float(k / len(order)), 4),
                    "error": round(float(1 - correct[:k].mean()), 4)})
    return out



CONSEQUENCE_SLICES = [
    ("truncating", "is_truncating"),
    ("missense", "is_missense"),
    ("synonymous", "is_synonymous"),
    ("splice site", "is_splice_site"),
    ("intronic", "is_intronic"),
]


def by_consequence(X_mol: np.ndarray, y: np.ndarray, prob: np.ndarray,
                   idx: np.ndarray) -> list[dict]:
    """
    Accuracy within each consequence class.

    Headline accuracy on this dataset is flattered by its composition: benign
    records are dominated by synonymous and intronic variants and pathogenic
    ones by truncating variants, so most of the test set is separable on
    consequence alone. The genuinely hard class is missense -- and most hard
    missense variants are not in the labelled set at all, because they are the
    ones ClinVar still calls uncertain.
    """
    cols = {n: i for i, n in enumerate(MOLECULAR_FEATURES)}
    pred = (prob > 0.5).astype(int)
    out = []
    for label, feat in CONSEQUENCE_SLICES:
        mask = X_mol[idx, cols[feat]] > 0.5
        n = int(mask.sum())
        if n < 25:
            continue
        row = {
            "consequence": label,
            "n": n,
            "share_pathogenic": round(float(y[idx][mask].mean()), 4),
            "accuracy": round(float(accuracy_score(y[idx][mask], pred[mask])), 4),
        }
        if 0 < y[idx][mask].mean() < 1:
            row["roc_auc"] = round(float(roc_auc_score(y[idx][mask], prob[mask])), 4)
        out.append(row)
    other = ~np.any([X_mol[idx, cols[f]] > 0.5 for _, f in CONSEQUENCE_SLICES], axis=0)
    if other.sum() >= 25:
        out.append({
            "consequence": "other",
            "n": int(other.sum()),
            "share_pathogenic": round(float(y[idx][other].mean()), 4),
            "accuracy": round(float(accuracy_score(y[idx][other], pred[other])), 4),
        })
    return out


# ---------------------------------------------------------------------------
# leakage demonstration
# ---------------------------------------------------------------------------

def leakage_demo(rng_seed: int = SEED) -> dict:
    """
    Reproduce the original row-level split on the *duplicated* table and
    compare it to a variant-level split on the same data and model.

    ClinVar lists each variant once per genome assembly. Splitting rows rather
    than variants therefore puts the same variant in train and test, and the
    test score measures memorisation as much as generalisation.
    """
    from features import curation_vector, molecular_vector

    raw = pd.read_csv(ROOT / "data" / "raw" / "clinvar_brca_raw.tsv",
                      sep="\t", dtype=str, low_memory=False)
    raw.columns = [c.strip().lstrip("#") for c in raw.columns]
    raw = raw[raw["GeneSymbol"].isin(["BRCA1", "BRCA2"])]

    from build_dataset import BENIGN, PATHOGENIC
    sig = raw["ClinicalSignificance"].str.strip()
    keep = sig.isin(PATHOGENIC | BENIGN)
    raw = raw[keep]
    y_all = sig[keep].isin(PATHOGENIC).astype(int).to_numpy()

    rows = pd.DataFrame({
        "gene": raw["GeneSymbol"], "name": raw["Name"],
        "var_type": raw["Type"].str.lower(),
        "start": pd.to_numeric(raw["Start"], errors="coerce").fillna(0),
        "stop": pd.to_numeric(raw["Stop"], errors="coerce").fillna(0),
        "review_status": raw["ReviewStatus"],
        "n_submitters": pd.to_numeric(raw["NumberSubmitters"], errors="coerce").fillna(1),
        "submitter_categories": pd.to_numeric(raw["SubmitterCategories"], errors="coerce").fillna(1),
        "tested_in_gtr": raw["TestedInGTR"],
    }).reset_index(drop=True)
    vid = raw["VariationID"].to_numpy()

    X = np.vstack([molecular_vector(r) for r in rows.to_dict("records")])

    rng = np.random.default_rng(rng_seed)

    # (a) naive row-level split -- what the original pipeline did
    perm = rng.permutation(len(X))
    cut = int(0.8 * len(X))
    tr_r, te_r = perm[:cut], perm[cut:]
    rf_a = RandomForestClassifier(n_estimators=300, random_state=SEED,
                                  class_weight="balanced", n_jobs=-1)
    rf_a.fit(X[tr_r], y_all[tr_r])
    acc_row = float(accuracy_score(y_all[te_r], rf_a.predict(X[te_r])))
    shared = len(set(vid[tr_r]) & set(vid[te_r]))

    # (b) variant-level split on the same rows
    uniq = np.unique(vid)
    rng.shuffle(uniq)
    tr_ids = set(uniq[:int(0.8 * len(uniq))])
    mask_tr = np.array([v in tr_ids for v in vid])
    rf_b = RandomForestClassifier(n_estimators=300, random_state=SEED,
                                  class_weight="balanced", n_jobs=-1)
    rf_b.fit(X[mask_tr], y_all[mask_tr])
    acc_var = float(accuracy_score(y_all[~mask_tr], rf_b.predict(X[~mask_tr])))

    return {
        "row_level_split_accuracy": acc_row,
        "variant_level_split_accuracy": acc_var,
        "inflation_points": round((acc_row - acc_var) * 100, 2),
        "variants_shared_between_train_and_test": int(shared),
        "test_rows": int(len(te_r)),
        "note": ("Both numbers use the same features, the same model and the "
                 "same data. The only difference is whether the split respects "
                 "variant identity."),
    }



def decision_surfaces(rf, svm, qsvm, vqc, pca, angle, scaler, psi_train,
                      Xq_train, y_train, res: int = 56) -> dict:
    """
    Decision surfaces on a 2-D slice through the encoding space.

    The grid varies the first two encoding angles and holds the rest at their
    training medians. Classical models are evaluated on the same slice by
    inverting the PCA, so all four surfaces describe the same plane and can be
    compared directly.
    """
    lo, hi = 0.0, float(np.pi)
    g = np.linspace(lo, hi, res)
    gx, gy = np.meshgrid(g, g)
    med = np.median(Xq_train, axis=0)
    grid = np.tile(med, (res * res, 1))
    grid[:, 0] = gx.ravel()
    grid[:, 1] = gy.ravel()

    # invert angles -> PCA -> standardised features -> raw features
    pcs = angle.inverse_transform(grid)
    z = pca.inverse_transform(pcs)
    raw = scaler.inverse_transform(z)

    psi = Q.zz_statevectors(grid, reps=2)
    surfaces = {
        "random_forest": rf.predict_proba(raw)[:, 1],
        "svm": svm.predict_proba(z)[:, 1],
        "qsvm": qsvm.predict_proba(Q.kernel_matrix(psi, psi_train))[:, 1],
        "vqc": vqc.predict_proba(grid[:, :vqc.n_qubits])[:, 1],
    }
    out = {
        "resolution": res,
        "extent": [lo, hi, lo, hi],
        "surfaces": {k: [round(float(v), 3) for v in arr]
                     for k, arr in surfaces.items()},
    }
    rng = np.random.default_rng(SEED)
    pick = rng.choice(len(Xq_train), min(400, len(Xq_train)), replace=False)
    out["points"] = [
        {"x": round(float(a), 3), "y": round(float(b), 3), "label": int(l)}
        for a, b, l in zip(Xq_train[pick, 0], Xq_train[pick, 1], y_train[pick])
    ]
    return out


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main() -> None:
    MODELS.mkdir(parents=True, exist_ok=True)
    OUTDATA.mkdir(parents=True, exist_ok=True)
    import joblib

    d = np.load(DATA / "dataset.npz")
    X_mol, X_cur, y = d["X_mol"], d["X_cur"], d["y"]
    tr, va, te = d["idx_train"], d["idx_val"], d["idx_test"]
    print(f"train {len(tr):,}   val {len(va):,}   test {len(te):,}   "
          f"features {X_mol.shape[1]}")

    scaler = StandardScaler().fit(X_mol[tr])
    Xs = scaler.transform(X_mol)

    results: dict = {}
    probs: dict[str, dict[str, np.ndarray]] = {}

    # -- classical ----------------------------------------------------------
    print("\n[1/5] Random Forest")
    rf = RandomForestClassifier(n_estimators=500, min_samples_leaf=2,
                                class_weight="balanced", random_state=SEED,
                                n_jobs=-1).fit(X_mol[tr], y[tr])
    probs["rf"] = {s: rf.predict_proba(X_mol[i])[:, 1]
                   for s, i in (("val", va), ("test", te))}
    results["random_forest"] = evaluate(y[te], probs["rf"]["test"], "Random Forest")
    print(f"      test accuracy {results['random_forest']['accuracy']:.4f}  "
          f"ROC-AUC {results['random_forest']['roc_auc']:.4f}")

    print("[2/5] SVM (RBF)")
    svm = SVC(kernel="rbf", C=4.0, gamma="scale", probability=True,
              class_weight="balanced", random_state=SEED).fit(Xs[tr], y[tr])
    probs["svm"] = {s: svm.predict_proba(Xs[i])[:, 1]
                    for s, i in (("val", va), ("test", te))}
    results["svm"] = evaluate(y[te], probs["svm"]["test"], "SVM (RBF)")
    print(f"      test accuracy {results['svm']['accuracy']:.4f}  "
          f"ROC-AUC {results['svm']['roc_auc']:.4f}")

    # -- quantum encoding ---------------------------------------------------
    print(f"[3/5] Quantum encoding: PCA {X_mol.shape[1]}D -> {N_QUBITS}D -> [0, pi]")
    pca = PCA(n_components=N_QUBITS, random_state=SEED).fit(Xs[tr])
    angle = MinMaxScaler(feature_range=(0.0, np.pi)).fit(pca.transform(Xs[tr]))
    Xq = angle.transform(pca.transform(Xs))
    Xq = np.clip(Xq, 0.0, np.pi)
    print(f"      explained variance {pca.explained_variance_ratio_.sum():.1%}")

    kernel_err = Q.verify_against_qiskit(n_qubits=N_QUBITS, reps=2, n=8)
    print(f"      kernel vs Qiskit reference: max deviation {kernel_err:.2e}")

    rng = np.random.default_rng(SEED)
    q_idx = tr if len(tr) <= QSVM_TRAIN_CAP else rng.choice(tr, QSVM_TRAIN_CAP, replace=False)
    q_idx = np.sort(q_idx)

    t0 = time.time()
    psi_train = Q.zz_statevectors(Xq[q_idx], reps=2)
    K_train = Q.kernel_matrix(psi_train)
    t_gram = time.time() - t0
    print(f"      {len(q_idx)}x{len(q_idx)} quantum Gram matrix in {t_gram:.2f}s")

    print("[4/5] QSVM (precomputed fidelity kernel)")
    qsvm = SVC(kernel="precomputed", C=4.0, probability=True,
               class_weight="balanced", random_state=SEED).fit(K_train, y[q_idx])
    probs["qsvm"] = {}
    for split, idx in (("val", va), ("test", te)):
        psi = Q.zz_statevectors(Xq[idx], reps=2)
        probs["qsvm"][split] = qsvm.predict_proba(Q.kernel_matrix(psi, psi_train))[:, 1]
    results["qsvm"] = evaluate(y[te], probs["qsvm"]["test"], "QSVM (ZZFeatureMap)")
    print(f"      test accuracy {results['qsvm']['accuracy']:.4f}  "
          f"ROC-AUC {results['qsvm']['roc_auc']:.4f}")

    # The kernel method gains from a wider register; the variational model does
    # not. Optimising an 8-qubit RealAmplitudes ansatz stalls -- the loss barely
    # moves and test ROC-AUC falls below the 4-qubit result, which is the
    # barren-plateau behaviour these circuits are known for. The VQC therefore
    # runs on the leading VQC_QUBITS components of the same encoding.
    print(f"[5/5] VQC (RealAmplitudes, {VQC_QUBITS} qubits, statevector-batched)")
    t0 = time.time()
    vqc = Q.StatevectorVQC(n_qubits=VQC_QUBITS, feature_reps=2, ansatz_reps=3,
                           seed=SEED).fit(Xq[tr][:, :VQC_QUBITS], y[tr],
                                          maxiter=1500, verbose=True)
    t_vqc = time.time() - t0
    probs["vqc"] = {s: vqc.predict_proba(Xq[i][:, :VQC_QUBITS])[:, 1]
                    for s, i in (("val", va), ("test", te))}
    results["vqc"] = evaluate(y[te], probs["vqc"]["test"], "VQC")
    print(f"      trained on {len(tr):,} samples in {t_vqc:.1f}s")
    print(f"      test accuracy {results['vqc']['accuracy']:.4f}  "
          f"ROC-AUC {results['vqc']['roc_auc']:.4f}")

    # -- hybrid ensemble ----------------------------------------------------
    def blend(split: str, w: float) -> np.ndarray:
        classical = 0.5 * (probs["rf"][split] + probs["svm"][split])
        quantum = 0.5 * (probs["qsvm"][split] + probs["vqc"][split])
        return (1 - w) * classical + w * quantum

    grid = np.linspace(0.0, 1.0, 101)
    aucs = [roc_auc_score(y[va], blend("val", w)) for w in grid]
    w_q = float(grid[int(np.argmax(aucs))])
    probs["hybrid"] = {s: blend(s, w_q) for s in ("val", "test")}
    results["hybrid"] = evaluate(y[te], probs["hybrid"]["test"], "Hybrid ensemble")
    results["hybrid"]["weights"] = {"classical": round(1 - w_q, 3), "quantum": round(w_q, 3)}
    print(f"\nHybrid  weights classical {1 - w_q:.2f} / quantum {w_q:.2f}")
    print(f"      test accuracy {results['hybrid']['accuracy']:.4f}  "
          f"ROC-AUC {results['hybrid']['roc_auc']:.4f}")

    # -- conformal prediction ----------------------------------------------
    qhat = conformal_calibrate(y[va], probs["hybrid"]["val"], ALPHA)
    sets = conformal_sets(probs["hybrid"]["test"], qhat)
    covered = sets[np.arange(len(te)), y[te]]
    singleton = sets.sum(axis=1) == 1
    sing_correct = (sets[singleton].argmax(axis=1) == y[te][singleton])
    conformal = {
        "alpha": ALPHA,
        "target_coverage": 1 - ALPHA,
        "empirical_coverage": float(covered.mean()),
        "coverage_benign": float(covered[y[te] == 0].mean()),
        "coverage_pathogenic": float(covered[y[te] == 1].mean()),
        "singleton_rate": float(singleton.mean()),
        "abstention_rate": float(1 - singleton.mean()),
        "accuracy_on_confident_calls": float(sing_correct.mean()),
        "qhat": qhat,
    }
    print(f"\nConformal (alpha={ALPHA}): coverage {conformal['empirical_coverage']:.3f} "
          f"(target {1 - ALPHA:.2f}), abstains on {conformal['abstention_rate']:.1%}, "
          f"accuracy when it does commit {conformal['accuracy_on_confident_calls']:.4f}")

    # -- quantum/classical disagreement as uncertainty ----------------------
    cls_te = 0.5 * (probs["rf"]["test"] + probs["svm"]["test"])
    qnt_te = 0.5 * (probs["qsvm"]["test"] + probs["vqc"]["test"])
    disagreement = np.abs(cls_te - qnt_te)
    errors = ((probs["hybrid"]["test"] > 0.5).astype(int) != y[te]).astype(int)
    margin = np.abs(probs["hybrid"]["test"] - 0.5)
    disagree_analysis = {
        "auc_disagreement_detects_error": float(roc_auc_score(errors, disagreement)),
        "auc_margin_detects_error": float(roc_auc_score(errors, -margin)),
        "auc_combined": float(roc_auc_score(errors, disagreement - margin)),
        "mean_disagreement_correct": float(disagreement[errors == 0].mean()),
        "mean_disagreement_wrong": float(disagreement[errors == 1].mean()),
        "risk_coverage": selective_risk_curve(y[te], probs["hybrid"]["test"],
                                              disagreement - margin),
    }
    print(f"Disagreement detects errors with AUC "
          f"{disagree_analysis['auc_disagreement_detects_error']:.3f} "
          f"(confidence margin alone: {disagree_analysis['auc_margin_detects_error']:.3f}, "
          f"combined: {disagree_analysis['auc_combined']:.3f})")

    # -- statistical comparison --------------------------------------------
    pairs = [("qsvm", "svm"), ("hybrid", "rf"), ("hybrid", "qsvm"), ("vqc", "svm")]
    stats = {f"{a}_vs_{b}": mcnemar(y[te], probs[a]["test"], probs[b]["test"])
             for a, b in pairs}

    # -- curation-metadata ablation ----------------------------------------
    X_all = np.hstack([X_mol, X_cur])
    rf_all = RandomForestClassifier(n_estimators=500, min_samples_leaf=2,
                                    class_weight="balanced", random_state=SEED,
                                    n_jobs=-1).fit(X_all[tr], y[tr])
    ablation = {
        "molecular_only": results["random_forest"]["accuracy"],
        "molecular_plus_curation": float(accuracy_score(
            y[te], rf_all.predict(X_all[te]))),
    }
    ablation["difference_points"] = round(
        (ablation["molecular_plus_curation"] - ablation["molecular_only"]) * 100, 2)
    print(f"\nAblation: molecular-only {ablation['molecular_only']:.4f} vs "
          f"+curation metadata {ablation['molecular_plus_curation']:.4f}")

    strata = by_consequence(X_mol, y, probs["hybrid"]["test"], te)
    print("\nAccuracy by consequence class (test set)")
    for row in strata:
        print(f"      {row['consequence']:<14}n={row['n']:>5}  "
              f"pathogenic={row['share_pathogenic']:.0%}  "
              f"accuracy={row['accuracy']:.4f}")

    print("\nLeakage demonstration (this is the headline correction)")
    leak = leakage_demo()
    print(f"      row-level split     {leak['row_level_split_accuracy']:.4f}")
    print(f"      variant-level split {leak['variant_level_split_accuracy']:.4f}")
    print(f"      inflation           {leak['inflation_points']:+.2f} points "
          f"({leak['variants_shared_between_train_and_test']:,} variants "
          f"appeared on both sides)")

    # -- curves for the dashboard ------------------------------------------
    curves = {}
    for key, label in (("random_forest", "rf"), ("svm", "svm"),
                       ("qsvm", "qsvm"), ("vqc", "vqc"), ("hybrid", "hybrid")):
        fpr, tpr, _ = roc_curve(y[te], probs[label]["test"])
        step = max(1, len(fpr) // 120)
        curves[key] = {"fpr": [round(float(v), 4) for v in fpr[::step]],
                       "tpr": [round(float(v), 4) for v in tpr[::step]]}

    importances = sorted(
        [{"feature": f, "importance": round(float(v), 5)}
         for f, v in zip(MOLECULAR_FEATURES, rf.feature_importances_)],
        key=lambda r: -r["importance"])

    # kernel-space projection for the 3D viewer
    proj_idx = rng.choice(te, min(600, len(te)), replace=False)
    kernel_points = [
        {"x": round(float(a), 4), "y": round(float(b), 4), "z": round(float(c), 4),
         "label": int(l), "p": round(float(p), 4)}
        for a, b, c, l, p in zip(
            Xq[proj_idx, 0], Xq[proj_idx, 1], Xq[proj_idx, 2], y[proj_idx],
            probs["hybrid"]["test"][np.searchsorted(te, proj_idx)])
    ]

    print("\nComputing decision surfaces on the encoding plane ...")
    surfaces = decision_surfaces(rf, svm, qsvm, vqc, pca, angle, scaler,
                                 psi_train, Xq[tr], y[tr])

    meta = json.loads((DATA / "dataset_meta.json").read_text())
    payload = {
        "generated": time.strftime("%Y-%m-%d %H:%M:%S"),
        "dataset": meta,
        "models": results,
        "hybrid_weights": {"classical": round(1 - w_q, 3), "quantum": round(w_q, 3)},
        "conformal": conformal,
        "disagreement": disagree_analysis,
        "mcnemar": stats,
        "ablation_curation_metadata": ablation,
        "by_consequence": strata,
        "leakage": leak,
        "quantum": {
            "n_qubits": N_QUBITS,
            "vqc_qubits": VQC_QUBITS,
            "feature_map": "ZZFeatureMap(reps=2, full entanglement)",
            "ansatz": f"RealAmplitudes({VQC_QUBITS} qubits, reps=3)",
            "pca_variance_retained": float(pca.explained_variance_ratio_.sum()),
            "qsvm_train_samples": int(len(q_idx)),
            "vqc_train_samples": int(len(tr)),
            "gram_matrix_seconds": round(t_gram, 3),
            "vqc_train_seconds": round(t_vqc, 1),
            "kernel_max_deviation_vs_qiskit": kernel_err,
        },
        "roc_curves": curves,
        "feature_importance": importances,
        "kernel_points": kernel_points,
        "decision_surfaces": surfaces,
        "vqc_loss_history": [round(float(v), 5) for v in vqc.loss_history_[::4]],
    }
    (OUTDATA / "metrics.json").write_text(json.dumps(payload, indent=2))

    p_val_mat = np.stack([1 - probs["hybrid"]["val"], probs["hybrid"]["val"]], axis=1)
    cal_scores = {int(c): np.sort(1.0 - p_val_mat[y[va] == c, c]) for c in (0, 1)}

    joblib.dump({
        "cal_scores": cal_scores, "kernel_qubits": N_QUBITS,
        "rf": rf, "svm": svm, "qsvm": qsvm, "scaler": scaler, "pca": pca,
        # Store the QSVM training *angles*, not the prepared statevectors: the
        # states are a deterministic function of the angles and take a few
        # milliseconds to rebuild, which keeps the artefact small enough to
        # ship in the repository.
        "angle": angle, "Xq_train": Xq[q_idx], "y_qtrain": y[q_idx],
        "vqc_theta": vqc.theta_, "vqc_scale": vqc.scale_, "vqc_bias": vqc.bias_,
        "vqc_cfg": {"n_qubits": VQC_QUBITS, "feature_reps": 2, "ansatz_reps": 3},
        "w_quantum": w_q, "qhat": qhat, "alpha": ALPHA,
        "feature_names": MOLECULAR_FEATURES,
        "background": X_mol[rng.choice(tr, min(200, len(tr)), replace=False)],
    }, MODELS / "qgene_bundle.joblib", compress=3)

    print(f"\nwrote {MODELS/'qgene_bundle.joblib'}")
    print(f"wrote {OUTDATA/'metrics.json'}")


if __name__ == "__main__":
    main()
