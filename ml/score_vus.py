"""
Score every unresolved ClinVar BRCA variant and rank it for reclassification.

Variants of Uncertain Significance are the practical bottleneck in BRCA
testing: a patient is told a variant was found and that nobody knows what it
means. The original pipeline dropped these rows. This script keeps them, scores
them with the trained hybrid model, and ranks them by how much a laboratory
would gain from resolving each one.

Priority combines three things:
  * how far the model's call is from the decision boundary (confident calls on
    currently-unresolved variants are the ones worth checking first),
  * whether the classical and quantum branches agree,
  * whether the conformal predictor is willing to commit at all.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "ml"))

from core import QGene            # noqa: E402
from features import describe     # noqa: E402

OUT = ROOT / "backend" / "data"


def main() -> None:
    model = QGene()
    vus = pd.read_parquet(ROOT / "data" / "processed" / "vus.parquet")
    print(f"scoring {len(vus):,} unresolved variants ...")

    d = np.load(ROOT / "data" / "processed" / "dataset.npz")
    X = d["X_vus_mol"]
    p = model.probabilities(X)

    hybrid = p["hybrid"]
    disagreement = np.abs(p["classical"] - p["quantum"])
    margin = np.abs(hybrid - 0.5)

    # Priority combines three things:
    #   confidence   how far the call sits from the decision boundary
    #   consistency  whether the classical and quantum branches agree
    #   actionability a confident pathogenic call changes patient management --
    #                surveillance, risk-reducing surgery, testing relatives --
    #                so it is worth a laboratory's time before a benign one
    confidence = margin * 2.0
    consistency = 1.0 - np.clip(disagreement / 0.5, 0.0, 1.0)
    actionability = 0.4 + 0.6 * hybrid
    priority = confidence * consistency * actionability

    records = []
    for i, row in enumerate(vus.to_dict("records")):
        ann = describe(row)
        conf = model.conformal_set(float(hybrid[i]))
        records.append({
            "variation_id": str(row["variation_id"]),
            "gene": ann["gene"],
            "name": row["name"],
            "current_classification": row["significance"],
            "consequence": ann["consequence"],
            "protein_position": ann["protein_position"],
            "domain": ann["domain"],
            "grantham": ann["grantham"],
            "predicted": "Pathogenic" if hybrid[i] > 0.5 else "Benign",
            "pathogenic_probability": round(float(hybrid[i]), 4),
            "classical": round(float(p["classical"][i]), 4),
            "quantum": round(float(p["quantum"][i]), 4),
            "disagreement": round(float(disagreement[i]), 4),
            "conformal_status": conf["status"],
            "conformal_set": conf["set"],
            "priority": round(float(priority[i]), 4),
            "review_status": row["review_status"],
            "n_submitters": int(row["n_submitters"]),
        })

    records.sort(key=lambda r: -r["priority"])

    committed = [r for r in records if r["conformal_status"] == "committed"]
    summary = {
        "total_unresolved": len(records),
        "brca1": sum(1 for r in records if r["gene"] == "BRCA1"),
        "brca2": sum(1 for r in records if r["gene"] == "BRCA2"),
        "model_commits": len(committed),
        "model_abstains": len(records) - len(committed),
        "commit_rate": round(len(committed) / max(1, len(records)), 4),
        "predicted_pathogenic": sum(1 for r in committed if r["predicted"] == "Pathogenic"),
        "predicted_benign": sum(1 for r in committed if r["predicted"] == "Benign"),
        "high_disagreement": sum(1 for r in records if r["disagreement"] > 0.25),
        "note": ("Predictions on unresolved variants are research hypotheses for "
                 "prioritising laboratory review. They are not classifications "
                 "and carry no clinical standing."),
    }
    print(json.dumps(summary, indent=2))

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "vus_scored.json").write_text(json.dumps(
        {"summary": summary, "variants": records[:1500]}, indent=2))
    pd.DataFrame(records).to_csv(OUT / "vus_scored_full.csv", index=False)
    print(f"\nwrote {OUT/'vus_scored.json'} (top 1500) and the full CSV")


if __name__ == "__main__":
    main()
