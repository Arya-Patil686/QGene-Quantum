"""
Train the hybrid stack on every bundled dataset and write the platform payload.

One pipeline, five diseases. The output feeds the platform's dataset catalogue,
its benchmark dashboard and its decision-support views.
"""
from __future__ import annotations

import json
import sys
import time
from dataclasses import asdict
from pathlib import Path

import joblib
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "ml"))

import datasets as D                                    # noqa: E402
from pipeline import HybridPipeline, PipelineConfig     # noqa: E402

OUT_DATA = ROOT / "backend" / "data"
OUT_MODELS = ROOT / "backend" / "models" / "platform"


def to_jsonable(obj):
    if isinstance(obj, (np.floating, np.integer)):
        return obj.item()
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, dict):
        return {k: to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [to_jsonable(v) for v in obj]
    return obj


def main() -> None:
    OUT_DATA.mkdir(parents=True, exist_ok=True)
    OUT_MODELS.mkdir(parents=True, exist_ok=True)

    payload = {"generated": time.strftime("%Y-%m-%d %H:%M:%S"), "datasets": {}}
    order = []

    for did in D.CATALOGUE:
        print(f"\n{'=' * 74}\n{did}")
        ds = D.load(did)
        print(f"  {ds.n_samples:,} samples x {ds.n_features} features · "
              f"{ds.domain} · {ds.missing_rate:.2%} missing")

        cfg = PipelineConfig(n_qubits=ds.n_qubits, seed=42)
        pipe = HybridPipeline(cfg)
        t0 = time.time()
        fitted = pipe.fit(ds, progress=lambda k, m: print(f"    [{k}] {m}"))
        elapsed = time.time() - t0

        rows = fitted.models
        best_classical = max((rows[k]["roc_auc"] for k in
                              ("logistic_regression", "random_forest", "svm")))
        best_quantum = max((rows[k]["roc_auc"] for k in ("qsvm", "vqc", "qnn")))
        print(f"    fitted in {elapsed:.1f}s · best classical AUC "
              f"{best_classical:.4f} · best quantum AUC {best_quantum:.4f} · "
              f"hybrid {rows['hybrid']['roc_auc']:.4f}")

        record = to_jsonable(asdict(fitted))
        record["config"] = cfg.as_dict()
        record["fit_seconds"] = round(elapsed, 2)
        record["best_classical_auc"] = best_classical
        record["best_quantum_auc"] = best_quantum
        record["quantum_gap"] = round(best_quantum - best_classical, 4)
        payload["datasets"][did] = record
        order.append(did)

        joblib.dump({
            "config": cfg,
            "artifacts": pipe.artifacts_,
            "models": pipe.models_,
            "psi_train": None,                 # rebuilt from angles on load
            "Xq_train": pipe.Xq_train_,
            "y_qtrain": pipe.y_qtrain_,
            "w_quantum": pipe.w_q_,
            "w_classical_members": pipe.w_classical_,
            "w_quantum_members": pipe.w_quantum_,
            "qhat": pipe.qhat_,
            "alpha": cfg.alpha,
            "dataset": ds.summary(),
            "feature_names": ds.feature_names,
            "feature_stats": {
                "median": np.nanmedian(ds.X, axis=0).tolist(),
                "p05": np.nanpercentile(ds.X, 5, axis=0).tolist(),
                "p95": np.nanpercentile(ds.X, 95, axis=0).tolist(),
            },
        }, OUT_MODELS / f"{did}.joblib", compress=3)

    payload["order"] = order
    payload["catalogue"] = [payload["datasets"][d]["dataset"] for d in order]

    # Cross-dataset summary: where does the quantum branch actually help?
    payload["comparison"] = [{
        "dataset": d,
        "name": payload["datasets"][d]["dataset"]["name"],
        "domain": payload["datasets"][d]["dataset"]["domain"],
        "n_samples": payload["datasets"][d]["dataset"]["n_samples"],
        "classical": payload["datasets"][d]["best_classical_auc"],
        "quantum": payload["datasets"][d]["best_quantum_auc"],
        "hybrid": payload["datasets"][d]["models"]["hybrid"]["roc_auc"],
        "gap": payload["datasets"][d]["quantum_gap"],
        "quantum_weight": payload["datasets"][d]["hybrid_weight"],
    } for d in order]

    (OUT_DATA / "platform.json").write_text(json.dumps(payload, indent=2))
    size = (OUT_DATA / "platform.json").stat().st_size / 1024
    print(f"\nwrote {OUT_DATA / 'platform.json'} ({size:.0f} KB)")
    print(f"wrote {len(order)} pipelines to {OUT_MODELS}")


if __name__ == "__main__":
    main()
