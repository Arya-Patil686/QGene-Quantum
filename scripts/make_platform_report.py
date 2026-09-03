"""
Generate docs/PLATFORM.md from backend/data/platform.json.

The cross-dataset benchmark is a build artefact, so it can never drift from
what the models actually produced.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
M = json.loads((ROOT / "backend" / "data" / "platform.json").read_text())
OUT = ROOT / "docs" / "PLATFORM.md"

MODELS = [("logistic_regression", "Logistic regression", "classical"),
          ("random_forest", "Random forest", "classical"),
          ("svm", "SVM (RBF)", "classical"),
          ("qsvm", "QSVM", "quantum"),
          ("vqc", "VQC", "quantum"),
          ("qnn", "QNN", "quantum"),
          ("hybrid", "Hybrid ensemble", "hybrid")]


def pct(v: float, d: int = 2) -> str:
    return f"{v * 100:.{d}f}%"


def main() -> None:
    L: list[str] = []
    add = L.append

    add("# QGene — cross-dataset benchmark\n")
    add(f"_Generated from `backend/data/platform.json` on {M['generated']}._\n")
    add("One hybrid quantum-classical pipeline, applied unchanged to five public "
        "biomedical datasets across four clinical domains and four data "
        "modalities. Every figure is measured on a held-out test set.\n")

    add("## 1. Catalogue\n")
    add("| Dataset | Disease | Domain | Modality | n | Features | Missing | Prevalence |")
    add("|---|---|---|---|---|---|---|---|")
    for d in M["catalogue"]:
        add(f"| `{d['id']}` | {d['disease']} | {d['domain']} | {d['modality']} | "
            f"{d['n_samples']:,} | {d['n_features']} | "
            f"{d['missing_rate'] * 100:.2f}% | {d['prevalence'] * 100:.1f}% |")
    add("")

    add("## 2. Does the quantum branch help?\n")
    add("Best classical model against best quantum model on each held-out test "
        "set, by ROC-AUC.\n")
    add("| Dataset | Best classical | Best quantum | Hybrid | Quantum share of ensemble | Verdict |")
    add("|---|---|---|---|---|---|")
    wins = 0
    for c in M["comparison"]:
        won = c["quantum"] > c["classical"]
        wins += won
        add(f"| {c['name']} | {pct(c['classical'])} | {pct(c['quantum'])} | "
            f"{pct(c['hybrid'])} | {c['quantum_weight'] * 100:.0f}% | "
            f"{'**quantum ahead**' if won else 'classical ahead'} |")
    add(f"\nThe quantum branch produces the best single model on "
        f"**{wins} of {len(M['comparison'])}** datasets. Where it loses, the "
        "ensemble weighting reduces its share automatically.\n")

    add("## 3. Why the quantum kernel underperforms — measured\n")
    add("Before any model is trained, the platform sweeps the ZZFeatureMap "
        "kernel across register widths and measures two things: how far its "
        "similarity structure agrees with the labels (kernel-target alignment) "
        "and how much the off-diagonal fidelities vary at all.\n")
    for did in M["order"]:
        kd = M["datasets"][did]["kernel_diagnostics"]
        name = M["datasets"][did]["dataset"]["name"]
        add(f"### {name}\n")
        add("| Qubits | Alignment | Off-diagonal mean | Off-diagonal std | Variance retained |")
        add("|---|---|---|---|---|")
        for r in kd["sweep"]:
            add(f"| {r['qubits']} | {r['alignment']:.4f} | "
                f"{r['off_diagonal_mean']:.5f} | {r['off_diagonal_std']:.5f} | "
                f"{r['variance_retained'] * 100:.1f}% |")
        add(f"\n{kd['verdict']}\n")
    add("The off-diagonal spread roughly halves with every qubit added. That is "
        "exponential concentration (Thanasilp et al., 2024): the kernel matrix "
        "tends towards the identity, and an SVM on top of it has nothing to "
        "separate. It is the direct explanation for the QSVM's collapsed "
        "sensitivity on the smaller datasets.\n")

    add("## 4. Per-dataset model results\n")
    for did in M["order"]:
        rec = M["datasets"][did]
        add(f"### {rec['dataset']['name']}\n")
        add(f"{rec['dataset']['description']}\n")
        if rec["dataset"].get("notes"):
            add(f"> {rec['dataset']['notes']}\n")
        add("| Model | Family | Accuracy | Sensitivity | Specificity | F1 | ROC-AUC | Brier | Train | Inference |")
        add("|---|---|---|---|---|---|---|---|---|---|")
        for key, label, fam in MODELS:
            m = rec["models"][key]
            add(f"| {label} | {fam} | {pct(m['accuracy'])} | {pct(m['sensitivity'])} | "
                f"{pct(m['specificity'])} | {pct(m['f1'])} | {pct(m['roc_auc'])} | "
                f"{m['brier']:.4f} | {m['train_seconds']:.2f}s | "
                f"{m['inference_ms_per_sample']:.3f} ms/row |")
        c = rec["conformal"]
        add(f"\nConformal at α={c['alpha']}: {pct(c['empirical_coverage'])} coverage "
            f"against a {pct(c['target_coverage'], 0)} target, abstains on "
            f"{pct(c['abstention_rate'])}, "
            f"{pct(c['accuracy_on_confident_calls'])} accurate when it commits "
            f"({c['n_calibration']} calibration rows"
            f"{'' if c['guarantee_is_tight'] else ' — too few for a tight guarantee'}).\n")
        add("Risk bands, checked against the observed outcome rate in the test set:\n")
        add("| Tier | Range | n | Observed positive rate |")
        add("|---|---|---|---|")
        for t in rec["risk_tiers"]:
            rate = ("—" if t["observed_positive_rate"] is None
                    else f"{t['observed_positive_rate'] * 100:.0f}%")
            add(f"| {t['tier']} | {t['lower']:.2f} – {t['upper']:.2f} | {t['n']} | {rate} |")
        add("")

    add("## 5. Pre-processing\n")
    add("Identical for every dataset, fitted on the training split only:\n")
    first = M["datasets"][M["order"][0]]
    for s in first["stages"]:
        add(f"* **{s['stage']}** — {s['detail']} (→ {s['n_features']} features)")
    add("")

    add("---\n")
    add("A research prototype. Not clinically validated; no output should inform "
        "a medical decision.")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(L) + "\n")
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
