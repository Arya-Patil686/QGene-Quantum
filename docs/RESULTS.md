# QGene — comparative analysis

_Generated from `backend/data/metrics.json` on 2026-09-03 21:37:23._

All figures are measured on a held-out test set of 3,047 variants under a **variant-level** split: no variant appears in more than one partition.

## 1. Dataset

| | |
|---|---|
| Source | NCBI ClinVar variant_summary.txt.gz |
| Raw rows | 75,162 |
| Duplicate assembly rows removed | 37,170 |
| Labelled variants | 20,296 |
| — pathogenic / likely pathogenic | 10,683 |
| — benign / likely benign | 9,613 |
| Unresolved (uncertain or conflicting) | 15,581 |
| BRCA1 / BRCA2 | 8,442 / 11,854 |
| Train / validation / test | 14,206 / 3,043 / 3,047 |

## 2. Model comparison

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC | PR-AUC | MCC | Brier |
|---|---|---|---|---|---|---|---|---|
| Random Forest | 98.26% | 98.80% | 97.88% | 98.34% | 99.76% | 99.62% | 0.9652 | 0.0127 |
| SVM (RBF) | 97.83% | 99.04% | 96.82% | 97.92% | 99.36% | 99.58% | 0.9569 | 0.0190 |
| QSVM | 96.16% | 97.03% | 95.64% | 96.33% | 98.91% | 99.23% | 0.9232 | 0.0280 |
| VQC | 81.42% | 83.35% | 80.86% | 82.09% | 89.05% | 91.62% | 0.6284 | 0.1328 |
| Hybrid ensemble | 97.87% | 98.92% | 97.01% | 97.95% | 99.74% | 99.81% | 0.9575 | 0.0141 |

Ensemble weighting fitted on the validation split: 0.98 classical / 0.02 quantum.

### Statistical comparison (exact McNemar)

| Comparison | n01 | n10 | p | Result |
|---|---|---|---|---|
| qsvm vs svm | 15 | 66 | <0.001 | significantly different |
| hybrid vs rf | 11 | 23 | 0.058 | statistically equivalent |
| hybrid vs qsvm | 67 | 15 | <0.001 | significantly different |
| vqc vs svm | 27 | 527 | <0.001 | significantly different |

## 3. Where the accuracy comes from

The headline number is a property of the labelled subset rather than evidence of a strong model, so it is broken down rather than left to stand alone. Almost every ClinVar BRCA record labelled pathogenic is truncating, and almost every record labelled benign is synonymous or deep intronic, so most of the test set separates on consequence alone.

| Consequence | n | Pathogenic share | Accuracy | ROC-AUC |
|---|---|---|---|---|
| truncating | 1,184 | 100% | 99.92% | 98.13% |
| missense | 238 | 21% | 85.71% | 93.88% |
| synonymous | 793 | 0% | 99.87% | 99.49% |
| splice site | 61 | 100% | 100.00% | — |
| intronic | 530 | 18% | 94.72% | 95.93% |
| other | 302 | 91% | 99.67% | — |

The genuinely hard class is **missense**. The hardest missense variants are not in the labelled set at all — they are the ones ClinVar still calls uncertain, which is the population the VUS Resolver targets.

## 4. The evaluation correction

ClinVar publishes every variant once per genome assembly (GRCh37 and GRCh38). Splitting **rows** rather than **variants** therefore puts the same variant on both sides of the split. Holding features, model and data constant and changing only the split:

| Split | Accuracy |
|---|---|
| Row-level (as in the original pipeline) | 99.35% |
| Variant-level (used throughout this project) | 98.32% |

**+1.03 accuracy points** of the row-level score was memorisation: 6,277 of the 7,984 test rows had their variant present in training.

## 5. Quantum implementation

| | |
|---|---|
| Qubits | 8 |
| Feature map | ZZFeatureMap(reps=2, full entanglement) |
| Ansatz | RealAmplitudes(4 qubits, reps=3) |
| PCA variance retained | 70.1% |
| QSVM training samples | 4,000 |
| VQC training samples | 14,206 |
| Gram matrix construction | 0.312 s |
| VQC training time | 4.5 s |
| Max deviation vs Qiskit's fidelity kernel | 1.55e-15 |

The fidelity kernel is evaluated in closed form from prepared statevectors — O(n) state preparations and one Gram product, rather than O(n²) pairwise circuit simulations. The result is numerically identical to Qiskit's `FidelityQuantumKernel`, verified on every training run.

## 6. Calibrated abstention

Class-conditional split conformal prediction at α = 0.1.

| | |
|---|---|
| Target coverage | 90% |
| Empirical coverage | 90.32% |
| Coverage, benign | 90.23% |
| Coverage, pathogenic | 90.40% |
| Commits to a single label | 90.58% |
| Abstains | 9.42% |
| Accuracy when it commits | 99.71% |

### Quantum–classical disagreement as an error signal

| Signal | AUC for detecting the model's own errors |
|---|---|
| Disagreement alone | 0.614 |
| Confidence margin alone | 0.957 |
| Both combined | 0.877 |

Mean disagreement on correct predictions 0.1247, on errors 0.1609.

## 7. Ablation — curation metadata

ClinVar review status and submitter counts describe how thoroughly a variant has been curated, not what it does. The headline models use molecular features only.

| Feature set | Accuracy |
|---|---|
| Molecular only (used throughout) | 98.26% |
| Molecular + curation metadata | 98.75% |

Difference: +0.49 points.

## 8. Feature importance

| Feature | Importance |
|---|---|
| `is_truncating` | 0.2107 |
| `var_type` | 0.1875 |
| `is_synonymous` | 0.1119 |
| `intron_offset_abs` | 0.0782 |
| `is_frameshift` | 0.0709 |
| `is_transition` | 0.0588 |
| `log_var_len` | 0.0500 |
| `is_nonsense` | 0.0453 |
| `is_splice_site` | 0.0335 |
| `is_intronic` | 0.0303 |
| `aa_pos_rel` | 0.0302 |
| `cdna_pos_rel` | 0.0286 |

---

QGene is an academic research prototype. Its predictions are not clinically validated and must not inform any medical decision.
