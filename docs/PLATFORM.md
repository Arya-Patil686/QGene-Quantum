# QGene — cross-dataset benchmark

_Generated from `backend/data/platform.json` on 2026-09-03 22:14:17._

One hybrid quantum-classical pipeline, applied unchanged to five public biomedical datasets across four clinical domains and four data modalities. Every figure is measured on a held-out test set.

## 1. Catalogue

| Dataset | Disease | Domain | Modality | n | Features | Missing | Prevalence |
|---|---|---|---|---|---|---|---|
| `brca_clinvar` | Hereditary breast and ovarian cancer | cancer | genomics | 20,296 | 22 | 0.00% | 52.6% |
| `breast_wdbc` | Breast cancer | cancer | imaging-derived | 569 | 30 | 0.00% | 37.3% |
| `heart_cleveland` | Coronary artery disease | cardiovascular | clinical records | 303 | 13 | 0.15% | 45.9% |
| `parkinsons` | Parkinson's disease | neurological | voice signal | 195 | 22 | 0.00% | 75.4% |
| `diabetes_pima` | Type 2 diabetes | metabolic | clinical records | 768 | 8 | 10.61% | 34.9% |

## 2. Does the quantum branch help?

Best classical model against best quantum model on each held-out test set, by ROC-AUC.

| Dataset | Best classical | Best quantum | Hybrid | Quantum share of ensemble | Verdict |
|---|---|---|---|---|---|
| BRCA1 / BRCA2 variant pathogenicity | 99.76% | 99.01% | 99.77% | 3% | classical ahead |
| Breast cancer — diagnostic imaging features | 99.64% | 99.77% | 99.60% | 0% | **quantum ahead** |
| Coronary artery disease | 92.75% | 94.91% | 92.86% | 6% | **quantum ahead** |
| Parkinson's disease — voice biomarkers | 91.72% | 87.93% | 88.62% | 26% | classical ahead |
| Type 2 diabetes onset | 79.41% | 76.22% | 79.58% | 0% | classical ahead |

The quantum branch produces the best single model on **2 of 5** datasets. Where it loses, the ensemble weighting reduces its share automatically.

## 3. Why the quantum kernel underperforms — measured

Before any model is trained, the platform sweeps the ZZFeatureMap kernel across register widths and measures two things: how far its similarity structure agrees with the labels (kernel-target alignment) and how much the off-diagonal fidelities vary at all.

### BRCA1 / BRCA2 variant pathogenicity

| Qubits | Alignment | Off-diagonal mean | Off-diagonal std | Variance retained |
|---|---|---|---|---|
| 2 | 0.1388 | 0.35539 | 0.25824 | 29.9% |
| 3 | 0.2298 | 0.18904 | 0.21141 | 40.7% |
| 4 | 0.1794 | 0.09895 | 0.14841 | 48.7% |
| 5 | 0.1663 | 0.05589 | 0.10714 | 56.3% |
| 6 | 0.1363 | 0.02986 | 0.08381 | 63.3% |
| 7 | 0.1401 | 0.02037 | 0.07740 | 69.7% |
| 8 | 0.1196 | 0.01317 | 0.07164 | 75.5% |

The kernel concentrates as qubits are added — off-diagonal spread collapses, so the quantum kernel carries little usable structure on this dataset.

### Breast cancer — diagnostic imaging features

| Qubits | Alignment | Off-diagonal mean | Off-diagonal std | Variance retained |
|---|---|---|---|---|
| 2 | 0.1608 | 0.36069 | 0.26383 | 64.7% |
| 3 | 0.1178 | 0.14983 | 0.14378 | 74.3% |
| 4 | 0.1046 | 0.07321 | 0.07371 | 80.9% |
| 5 | 0.0850 | 0.03743 | 0.03818 | 85.8% |
| 6 | 0.0802 | 0.01907 | 0.01952 | 89.9% |
| 7 | 0.0664 | 0.01008 | 0.01029 | 91.9% |
| 8 | 0.0631 | 0.00562 | 0.00569 | 93.3% |

The kernel concentrates as qubits are added — off-diagonal spread collapses, so the quantum kernel carries little usable structure on this dataset.

### Coronary artery disease

| Qubits | Alignment | Off-diagonal mean | Off-diagonal std | Variance retained |
|---|---|---|---|---|
| 2 | 0.0381 | 0.33387 | 0.24541 | 37.2% |
| 3 | 0.0403 | 0.15182 | 0.13923 | 47.4% |
| 4 | 0.0554 | 0.07544 | 0.07400 | 56.4% |
| 5 | 0.0739 | 0.03757 | 0.03752 | 63.9% |
| 6 | 0.0709 | 0.01917 | 0.01941 | 71.0% |
| 7 | 0.0756 | 0.01016 | 0.01038 | 77.2% |
| 8 | 0.0743 | 0.00575 | 0.00558 | 82.5% |

The kernel concentrates as qubits are added — off-diagonal spread collapses, so the quantum kernel carries little usable structure on this dataset.

### Parkinson's disease — voice biomarkers

| Qubits | Alignment | Off-diagonal mean | Off-diagonal std | Variance retained |
|---|---|---|---|---|
| 2 | 0.2688 | 0.40134 | 0.27520 | 71.1% |
| 3 | 0.2146 | 0.15363 | 0.14479 | 78.1% |
| 4 | 0.1954 | 0.07264 | 0.07549 | 84.6% |
| 5 | 0.1784 | 0.03828 | 0.04404 | 89.0% |
| 6 | 0.1431 | 0.01873 | 0.02485 | 92.2% |
| 7 | 0.1218 | 0.01020 | 0.01510 | 94.7% |
| 8 | 0.1093 | 0.00572 | 0.00949 | 96.3% |

The kernel concentrates as qubits are added — off-diagonal spread collapses, so the quantum kernel carries little usable structure on this dataset.

### Type 2 diabetes onset

| Qubits | Alignment | Off-diagonal mean | Off-diagonal std | Variance retained |
|---|---|---|---|---|
| 2 | 0.0846 | 0.36115 | 0.24654 | 48.1% |
| 3 | 0.0890 | 0.16820 | 0.15420 | 61.8% |
| 4 | 0.0781 | 0.07782 | 0.08006 | 73.4% |
| 5 | 0.0839 | 0.04136 | 0.04162 | 82.8% |
| 6 | 0.0763 | 0.02079 | 0.02171 | 89.4% |
| 7 | 0.0666 | 0.01158 | 0.01173 | 95.0% |
| 8 | 0.0591 | 0.00618 | 0.00621 | 100.0% |

The kernel concentrates as qubits are added — off-diagonal spread collapses, so the quantum kernel carries little usable structure on this dataset.

The off-diagonal spread roughly halves with every qubit added. That is exponential concentration (Thanasilp et al., 2024): the kernel matrix tends towards the identity, and an SVM on top of it has nothing to separate. It is the direct explanation for the QSVM's collapsed sensitivity on the smaller datasets.

## 4. Per-dataset model results

### BRCA1 / BRCA2 variant pathogenicity

Every classified BRCA1 and BRCA2 variant in ClinVar, described by molecular features derived from the HGVS notation: consequence class, Grantham chemical distance, hydropathy and charge shifts, functional-domain membership and splice proximity.

> Collapsed to one row per variant before splitting; 37,170 duplicate assembly rows removed. 15,581 unresolved variants held out for the VUS Resolver.

| Model | Family | Accuracy | Sensitivity | Specificity | F1 | ROC-AUC | Brier | Train | Inference |
|---|---|---|---|---|---|---|---|---|---|
| Logistic regression | classical | 97.67% | 96.45% | 99.03% | 97.76% | 99.37% | 0.0200 | 0.01s | 0.000 ms/row |
| Random forest | classical | 98.26% | 97.94% | 98.61% | 98.34% | 99.76% | 0.0127 | 0.48s | 0.010 ms/row |
| SVM (RBF) | classical | 97.77% | 96.88% | 98.75% | 97.86% | 99.40% | 0.0185 | 1.57s | 0.028 ms/row |
| QSVM | quantum | 95.67% | 94.26% | 97.23% | 95.82% | 99.01% | 0.0315 | 0.13s | 0.071 ms/row |
| VQC | quantum | 81.39% | 85.04% | 77.34% | 82.79% | 89.17% | 0.1344 | 2.97s | 0.002 ms/row |
| QNN | quantum | 93.53% | 90.90% | 96.47% | 93.67% | 98.10% | 0.0506 | 39.23s | 0.014 ms/row |
| Hybrid ensemble | hybrid | 97.97% | 96.82% | 99.24% | 98.04% | 99.77% | 0.0149 | 44.40s | 0.125 ms/row |

Conformal at α=0.1: 89.69% coverage against a 90% target, abstains on 10.01%, 99.67% accurate when it commits (3043 calibration rows).

Risk bands, checked against the observed outcome rate in the test set:

| Tier | Range | n | Observed positive rate |
|---|---|---|---|
| Very low | 0.00 – 0.10 | 1319 | 1% |
| Low | 0.10 – 0.30 | 124 | 17% |
| Moderate | 0.30 – 0.60 | 51 | 47% |
| High | 0.60 – 0.85 | 27 | 85% |
| Very high | 0.85 – 1.00 | 1526 | 100% |

### Breast cancer — diagnostic imaging features

Thirty morphological features — radius, texture, concavity and their worst-case statistics — computed from digitised images of fine-needle aspirates of a breast mass.

> The canonical benchmark for quantum-kernel classification papers.

| Model | Family | Accuracy | Sensitivity | Specificity | F1 | ROC-AUC | Brier | Train | Inference |
|---|---|---|---|---|---|---|---|---|---|
| Logistic regression | classical | 96.49% | 92.86% | 98.61% | 95.12% | 99.44% | 0.0211 | 0.00s | 0.001 ms/row |
| Random forest | classical | 97.37% | 95.24% | 98.61% | 96.39% | 99.64% | 0.0287 | 0.20s | 0.225 ms/row |
| SVM (RBF) | classical | 99.12% | 97.62% | 100.00% | 98.80% | 99.64% | 0.0120 | 0.01s | 0.004 ms/row |
| QSVM | quantum | 67.54% | 50.00% | 77.78% | 53.16% | 74.93% | 0.1977 | 0.00s | 0.010 ms/row |
| VQC | quantum | 64.04% | 30.95% | 83.33% | 38.81% | 66.30% | 0.2135 | 1.34s | 0.010 ms/row |
| QNN | quantum | 96.49% | 90.48% | 100.00% | 95.00% | 99.77% | 0.0335 | 4.94s | 0.013 ms/row |
| Hybrid ensemble | hybrid | 99.12% | 97.62% | 100.00% | 98.80% | 99.60% | 0.0162 | 6.49s | 0.263 ms/row |

Conformal at α=0.1: 91.23% coverage against a 90% target, abstains on 7.89%, 99.05% accurate when it commits (114 calibration rows — too few for a tight guarantee).

Risk bands, checked against the observed outcome rate in the test set:

| Tier | Range | n | Observed positive rate |
|---|---|---|---|
| Very low | 0.00 – 0.10 | 60 | 0% |
| Low | 0.10 – 0.30 | 13 | 8% |
| Moderate | 0.30 – 0.60 | 1 | 100% |
| High | 0.60 – 0.85 | 4 | 100% |
| Very high | 0.85 – 1.00 | 36 | 100% |

### Coronary artery disease

Thirteen routine clinical measurements — resting blood pressure, cholesterol, exercise-induced angina, ST depression and vessel counts — used to predict angiographic coronary disease.

> Contains genuine missing values, which the imputation stage handles.

| Model | Family | Accuracy | Sensitivity | Specificity | F1 | ROC-AUC | Brier | Train | Inference |
|---|---|---|---|---|---|---|---|---|---|
| Logistic regression | classical | 91.80% | 89.29% | 93.94% | 90.91% | 92.75% | 0.1007 | 0.00s | 0.001 ms/row |
| Random forest | classical | 83.61% | 82.14% | 84.85% | 82.14% | 92.10% | 0.1185 | 0.19s | 0.425 ms/row |
| SVM (RBF) | classical | 78.69% | 71.43% | 84.85% | 75.47% | 87.88% | 0.1430 | 0.00s | 0.004 ms/row |
| QSVM | quantum | 57.38% | 7.14% | 100.00% | 13.33% | 75.32% | 0.2388 | 0.00s | 0.010 ms/row |
| VQC | quantum | 55.74% | 53.57% | 57.58% | 52.63% | 53.46% | 0.2684 | 1.23s | 0.020 ms/row |
| QNN | quantum | 90.16% | 92.86% | 87.88% | 89.66% | 94.91% | 0.0916 | 2.85s | 0.015 ms/row |
| Hybrid ensemble | hybrid | 85.25% | 82.14% | 87.88% | 83.64% | 92.86% | 0.1134 | 4.27s | 0.475 ms/row |

Conformal at α=0.1: 98.36% coverage against a 90% target, abstains on 42.62%, 97.14% accurate when it commits (61 calibration rows — too few for a tight guarantee).

Risk bands, checked against the observed outcome rate in the test set:

| Tier | Range | n | Observed positive rate |
|---|---|---|---|
| Very low | 0.00 – 0.10 | 10 | 0% |
| Low | 0.10 – 0.30 | 15 | 13% |
| Moderate | 0.30 – 0.60 | 15 | 40% |
| High | 0.60 – 0.85 | 11 | 100% |
| Very high | 0.85 – 1.00 | 10 | 90% |

### Parkinson's disease — voice biomarkers

Twenty-two acoustic measures of sustained phonation — jitter, shimmer, harmonic-to-noise ratio and nonlinear dynamical measures — recorded from 31 people, 23 with Parkinson's.

> Small and high-dimensional: 195 recordings against 22 features, the low-data regime where quantum kernels are argued to help.

| Model | Family | Accuracy | Sensitivity | Specificity | F1 | ROC-AUC | Brier | Train | Inference |
|---|---|---|---|---|---|---|---|---|---|
| Logistic regression | classical | 69.23% | 68.97% | 70.00% | 76.92% | 81.38% | 0.1756 | 0.00s | 0.001 ms/row |
| Random forest | classical | 76.92% | 79.31% | 70.00% | 83.64% | 89.66% | 0.1339 | 0.19s | 0.655 ms/row |
| SVM (RBF) | classical | 87.18% | 93.10% | 70.00% | 91.53% | 91.72% | 0.1085 | 0.00s | 0.004 ms/row |
| QSVM | quantum | 82.05% | 100.00% | 30.00% | 89.23% | 66.55% | 0.1529 | 0.00s | 0.014 ms/row |
| VQC | quantum | 69.23% | 89.66% | 10.00% | 81.25% | 58.62% | 0.2019 | 1.27s | 0.028 ms/row |
| QNN | quantum | 82.05% | 89.66% | 60.00% | 88.14% | 87.93% | 0.1143 | 2.18s | 0.017 ms/row |
| Hybrid ensemble | hybrid | 82.05% | 89.66% | 60.00% | 88.14% | 88.62% | 0.1186 | 3.64s | 0.720 ms/row |

Conformal at α=0.1: 84.62% coverage against a 90% target, abstains on 0.00%, 84.62% accurate when it commits (39 calibration rows — too few for a tight guarantee).

Risk bands, checked against the observed outcome rate in the test set:

| Tier | Range | n | Observed positive rate |
|---|---|---|---|
| Very low | 0.00 – 0.10 | 0 | — |
| Low | 0.10 – 0.30 | 5 | 0% |
| Moderate | 0.30 – 0.60 | 10 | 70% |
| High | 0.60 – 0.85 | 9 | 78% |
| Very high | 0.85 – 1.00 | 15 | 100% |

### Type 2 diabetes onset

Eight routine measurements — plasma glucose, BMI, blood pressure, serum insulin and family history — recorded to predict diabetes onset within five years.

> Zeros in glucose, blood pressure, skin fold, insulin and BMI are recording gaps rather than real values, so they are restored to missing before imputation.

| Model | Family | Accuracy | Sensitivity | Specificity | F1 | ROC-AUC | Brier | Train | Inference |
|---|---|---|---|---|---|---|---|---|---|
| Logistic regression | classical | 72.73% | 67.92% | 75.25% | 63.16% | 78.68% | 0.1892 | 0.00s | 0.000 ms/row |
| Random forest | classical | 75.32% | 75.47% | 75.25% | 67.80% | 79.41% | 0.1809 | 0.20s | 0.167 ms/row |
| SVM (RBF) | classical | 68.18% | 47.17% | 79.21% | 50.51% | 76.67% | 0.1840 | 0.01s | 0.008 ms/row |
| QSVM | quantum | 66.23% | 3.77% | 99.01% | 7.14% | 61.83% | 0.2172 | 0.01s | 0.012 ms/row |
| VQC | quantum | 61.04% | 22.64% | 81.19% | 28.57% | 53.58% | 0.2379 | 1.41s | 0.008 ms/row |
| QNN | quantum | 70.13% | 49.06% | 81.19% | 53.06% | 76.22% | 0.1881 | 6.12s | 0.012 ms/row |
| Hybrid ensemble | hybrid | 71.43% | 64.15% | 75.25% | 60.71% | 79.58% | 0.1761 | 7.75s | 0.207 ms/row |

Conformal at α=0.1: 88.96% coverage against a 90% target, abstains on 38.96%, 81.91% accurate when it commits (154 calibration rows — too few for a tight guarantee).

Risk bands, checked against the observed outcome rate in the test set:

| Tier | Range | n | Observed positive rate |
|---|---|---|---|
| Very low | 0.00 – 0.10 | 21 | 5% |
| Low | 0.10 – 0.30 | 41 | 10% |
| Moderate | 0.30 – 0.60 | 50 | 42% |
| High | 0.60 – 0.85 | 38 | 63% |
| Very high | 0.85 – 1.00 | 4 | 75% |

## 5. Pre-processing

Identical for every dataset, fitted on the training split only:

* **clean** — No constant columns found (→ 22 features)
* **impute** — 0.00% of cells were missing; filled with the training-set median (→ 22 features)
* **denoise** — Clipped the outer 1% of each tail; 0.39% of values adjusted (→ 22 features)
* **normalise** — Zero mean and unit variance, fitted on the training split (→ 22 features)
* **select** — Kept every feature (→ 22 features)
* **reduce** — PCA to 8 components, retaining 70.9% of variance (→ 8 features)
* **encode** — Rescaled to [0, pi] and encoded on 8 qubits via a ZZFeatureMap with full entanglement (→ 8 features)

---

A research prototype. Not clinically validated; no output should inform a medical decision.
