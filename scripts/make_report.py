"""
Generate docs/RESULTS.md from backend/data/metrics.json.

The comparative analysis report is a build artefact rather than a hand-written
document, so it can never drift from the numbers the models actually produced.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
M = json.loads((ROOT / "backend" / "data" / "metrics.json").read_text())
OUT = ROOT / "docs" / "RESULTS.md"

MODELS = [("random_forest", "Random Forest"), ("svm", "SVM (RBF)"),
          ("qsvm", "QSVM"), ("vqc", "VQC"), ("hybrid", "Hybrid ensemble")]


def pct(v: float, d: int = 2) -> str:
    return f"{v * 100:.{d}f}%"


def main() -> None:
    d, q, c = M["dataset"], M["quantum"], M["conformal"]
    lk, ab = M["leakage"], M["ablation_curation_metadata"]
    dis = M["disagreement"]
    L: list[str] = []
    add = L.append

    add("# QGene — comparative analysis\n")
    add(f"_Generated from `backend/data/metrics.json` on {M['generated']}._\n")
    add("All figures are measured on a held-out test set of "
        f"{d['split']['test']:,} variants under a **variant-level** split: no "
        "variant appears in more than one partition.\n")

    add("## 1. Dataset\n")
    add("| | |")
    add("|---|---|")
    add(f"| Source | {d['source']} |")
    add(f"| Raw rows | {d['n_raw_rows']:,} |")
    add(f"| Duplicate assembly rows removed | {d['n_duplicate_rows_removed']:,} |")
    add(f"| Labelled variants | {d['n_labelled']:,} |")
    add(f"| — pathogenic / likely pathogenic | {d['n_pathogenic']:,} |")
    add(f"| — benign / likely benign | {d['n_benign']:,} |")
    add(f"| Unresolved (uncertain or conflicting) | {d['n_vus']:,} |")
    add(f"| BRCA1 / BRCA2 | {d['n_brca1']:,} / {d['n_brca2']:,} |")
    add(f"| Train / validation / test | {d['split']['train']:,} / "
        f"{d['split']['val']:,} / {d['split']['test']:,} |\n")

    add("## 2. Model comparison\n")
    add("| Model | Accuracy | Precision | Recall | F1 | ROC-AUC | PR-AUC | MCC | Brier |")
    add("|---|---|---|---|---|---|---|---|---|")
    for key, name in MODELS:
        m = M["models"][key]
        add(f"| {name} | {pct(m['accuracy'])} | {pct(m['precision'])} | "
            f"{pct(m['recall'])} | {pct(m['f1'])} | {pct(m['roc_auc'])} | "
            f"{pct(m['pr_auc'])} | {m['mcc']:.4f} | {m['brier']:.4f} |")
    add("")
    add(f"Ensemble weighting fitted on the validation split: "
        f"{M['hybrid_weights']['classical']:.2f} classical / "
        f"{M['hybrid_weights']['quantum']:.2f} quantum.\n")

    add("### Statistical comparison (exact McNemar)\n")
    add("| Comparison | n01 | n10 | p | Result |")
    add("|---|---|---|---|---|")
    for k, v in M["mcnemar"].items():
        p = "<0.001" if v["p_value"] < 0.001 else f"{v['p_value']:.3f}"
        add(f"| {k.replace('_', ' ')} | {v['n01']} | {v['n10']} | {p} | "
            f"{'significantly different' if v['significant'] else 'statistically equivalent'} |")
    add("")

    add("## 3. Where the accuracy comes from\n")
    add("The headline number is a property of the labelled subset rather than "
        "evidence of a strong model, so it is broken down rather than left to "
        "stand alone. Almost every ClinVar BRCA record labelled pathogenic is "
        "truncating, and almost every record labelled benign is synonymous or "
        "deep intronic, so most of the test set separates on consequence alone.\n")
    add("| Consequence | n | Pathogenic share | Accuracy | ROC-AUC |")
    add("|---|---|---|---|---|")
    for r in M.get("by_consequence", []):
        auc = f"{r['roc_auc'] * 100:.2f}%" if "roc_auc" in r else "—"
        add(f"| {r['consequence']} | {r['n']:,} | {r['share_pathogenic'] * 100:.0f}% | "
            f"{r['accuracy'] * 100:.2f}% | {auc} |")
    add("\nThe genuinely hard class is **missense**. The hardest missense variants "
        "are not in the labelled set at all — they are the ones ClinVar still "
        "calls uncertain, which is the population the VUS Resolver targets.\n")

    add("## 4. The evaluation correction\n")
    add("ClinVar publishes every variant once per genome assembly (GRCh37 and "
        "GRCh38). Splitting **rows** rather than **variants** therefore puts the "
        "same variant on both sides of the split. Holding features, model and data "
        "constant and changing only the split:\n")
    add("| Split | Accuracy |")
    add("|---|---|")
    add(f"| Row-level (as in the original pipeline) | {pct(lk['row_level_split_accuracy'])} |")
    add(f"| Variant-level (used throughout this project) | {pct(lk['variant_level_split_accuracy'])} |")
    add(f"\n**{lk['inflation_points']:+.2f} accuracy points** of the row-level score "
        f"was memorisation: {lk['variants_shared_between_train_and_test']:,} of the "
        f"{lk['test_rows']:,} test rows had their variant present in training.\n")

    add("## 5. Quantum implementation\n")
    add("| | |")
    add("|---|---|")
    add(f"| Qubits | {q['n_qubits']} |")
    add(f"| Feature map | {q['feature_map']} |")
    add(f"| Ansatz | {q['ansatz']} |")
    add(f"| PCA variance retained | {pct(q['pca_variance_retained'], 1)} |")
    add(f"| QSVM training samples | {q['qsvm_train_samples']:,} |")
    add(f"| VQC training samples | {q['vqc_train_samples']:,} |")
    add(f"| Gram matrix construction | {q['gram_matrix_seconds']} s |")
    add(f"| VQC training time | {q['vqc_train_seconds']} s |")
    add(f"| Max deviation vs Qiskit's fidelity kernel | "
        f"{q['kernel_max_deviation_vs_qiskit']:.2e} |\n")
    add("The fidelity kernel is evaluated in closed form from prepared "
        "statevectors — O(n) state preparations and one Gram product, rather than "
        "O(n²) pairwise circuit simulations. The result is numerically identical to "
        "Qiskit's `FidelityQuantumKernel`, verified on every training run.\n")

    add("## 6. Calibrated abstention\n")
    add(f"Class-conditional split conformal prediction at α = {c['alpha']}.\n")
    add("| | |")
    add("|---|---|")
    add(f"| Target coverage | {pct(c['target_coverage'], 0)} |")
    add(f"| Empirical coverage | {pct(c['empirical_coverage'])} |")
    add(f"| Coverage, benign | {pct(c['coverage_benign'])} |")
    add(f"| Coverage, pathogenic | {pct(c['coverage_pathogenic'])} |")
    add(f"| Commits to a single label | {pct(c['singleton_rate'])} |")
    add(f"| Abstains | {pct(c['abstention_rate'])} |")
    add(f"| Accuracy when it commits | {pct(c['accuracy_on_confident_calls'])} |\n")

    add("### Quantum–classical disagreement as an error signal\n")
    add("| Signal | AUC for detecting the model's own errors |")
    add("|---|---|")
    add(f"| Disagreement alone | {dis['auc_disagreement_detects_error']:.3f} |")
    add(f"| Confidence margin alone | {dis['auc_margin_detects_error']:.3f} |")
    add(f"| Both combined | {dis['auc_combined']:.3f} |")
    add(f"\nMean disagreement on correct predictions "
        f"{dis['mean_disagreement_correct']:.4f}, on errors "
        f"{dis['mean_disagreement_wrong']:.4f}.\n")

    add("## 7. Ablation — curation metadata\n")
    add("ClinVar review status and submitter counts describe how thoroughly a "
        "variant has been curated, not what it does. The headline models use "
        "molecular features only.\n")
    add("| Feature set | Accuracy |")
    add("|---|---|")
    add(f"| Molecular only (used throughout) | {pct(ab['molecular_only'])} |")
    add(f"| Molecular + curation metadata | {pct(ab['molecular_plus_curation'])} |")
    add(f"\nDifference: {ab['difference_points']:+.2f} points.\n")

    add("## 8. Feature importance\n")
    add("| Feature | Importance |")
    add("|---|---|")
    for f in M["feature_importance"][:12]:
        add(f"| `{f['feature']}` | {f['importance']:.4f} |")
    add("")

    add("---\n")
    add("QGene is an academic research prototype. Its predictions are not "
        "clinically validated and must not inform any medical decision.")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(L) + "\n")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
