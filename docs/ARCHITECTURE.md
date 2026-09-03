# Architecture

```
                          ┌──────────────────────────────────────────┐
  NCBI ClinVar            │  scripts/fetch_clinvar.sh                │
  variant_summary.txt.gz ─┤  parallel ranged download, BRCA1/BRCA2   │
  (~421 MB)               └───────────────────┬──────────────────────┘
                                              │  raw TSV
                          ┌───────────────────▼──────────────────────┐
                          │  ml/build_dataset.py                     │
                          │  · collapse GRCh37/GRCh38 to one row      │
                          │    per VariationID   ← removes the leak   │
                          │  · label P/LP = 1, B/LB = 0               │
                          │  · hold VUS + conflicting aside, unlabelled│
                          │  · variant-level stratified 70/15/15      │
                          └───────────────────┬──────────────────────┘
                                              │
                    ┌─────────────────────────┴────────────────────────┐
                    │  ml/features.py — 22 molecular features          │
                    │  HGVS parse · consequence · Grantham distance ·  │
                    │  hydropathy/charge/volume delta · domain map ·   │
                    │  splice proximity · relative positions           │
                    └─────────────────────────┬────────────────────────┘
                                              │
          ┌───────────────────────────────────┼───────────────────────────────┐
          │  classical                        │  quantum (ml/quantum.py)      │
          │                                   │                               │
          │  RandomForest ──┐   StandardScaler │  PCA → 4 comps → [0, π]       │
          │  SVM (RBF) ─────┤        │         │            │                  │
          │                 │        └─────────┼────────────┤                  │
          │                 │                  │   ZZFeatureMap (analytic)     │
          │                 │                  │            │                  │
          │                 │                  │   statevectors ψ(x)           │
          │                 │                  │      ├── K = |ψψ†|² → QSVM    │
          │                 │                  │      └── U(θ)ψ     → VQC      │
          └─────────────────┴──────────┬───────┴───────────────────────────────┘
                                       │
                     ┌─────────────────▼──────────────────┐
                     │  hybrid ensemble                    │
                     │  w fitted on validation ROC-AUC     │
                     └─────────────────┬──────────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
   ┌──────────▼─────────┐  ┌───────────▼──────────┐  ┌──────────▼─────────┐
   │ conformal          │  │ disagreement          │  │ SHAP               │
   │ class-conditional  │  │ |classical − quantum| │  │ TreeExplainer      │
   │ prediction sets    │  │ epistemic signal      │  │ per-feature        │
   └──────────┬─────────┘  └───────────┬──────────┘  └──────────┬─────────┘
              └────────────────────────┼────────────────────────┘
                                       │
                     ┌─────────────────▼──────────────────┐
                     │  backend/core.py → backend/app.py   │
                     │  /api/predict · /api/batch          │
                     │  /api/vus · /api/metrics            │
                     └─────────────────┬──────────────────┘
                                       │
                     ┌─────────────────▼──────────────────┐
                     │  web/ — React + R3F                 │
                     │  helix hero · Bloch spheres ·       │
                     │  live circuit · kernel space ·      │
                     │  results dashboard · VUS Resolver   │
                     └────────────────────────────────────┘
```

## Why the quantum path is fast

`FidelityQuantumKernel` builds one circuit per pair of samples. An n×n Gram
matrix is therefore O(n²) simulations — 8 million for n = 4000.

Under statevector simulation the same quantity is available in closed form:

```
K(x, y) = |⟨φ(x)|φ(y)⟩|²        →       K = |Ψ Ψ†|²
```

with `Ψ` the (n × 2^q) matrix of prepared states. That is O(n) state
preparations and one matrix product.

The feature map itself is also analytic. After the Hadamard layer a ZZFeatureMap
repetition is diagonal, so for basis state `|b⟩`:

```
φ(x, b) = 2 Σᵢ xᵢbᵢ + 2 Σᵢ<ⱼ (π − xᵢ)(π − xⱼ)(bᵢ ⊕ bⱼ)
|ψ(x)⟩  = [D(x) H^⊗q]^reps |0⟩
```

which vectorises over the whole batch in NumPy. `quantum.verify_against_qiskit`
rebuilds the same states through Qiskit's simulator and compares the resulting
kernel matrices on every training run.

The VQC exploits the same structure from the other side: the feature map does
not depend on the parameters, so every training state is prepared once and each
optimiser step is a single `(n × 2^q) @ (2^q × 2^q)` product against the ansatz
unitary. That is what makes it practical to fit the full training set instead of
a 200-sample subset.

## Inference path

At request time the model holds `Ψ_train` (the prepared QSVM training states) in
memory. Scoring one variant is:

1. parse HGVS → 22 features
2. scale → PCA → angles
3. one statevector preparation
4. one `(1 × 2^q) @ (2^q × n_train)` product → kernel row → QSVM
5. one ansatz product → VQC
6. Random Forest + SVM classically
7. blend, conformal set, SHAP

No circuit is executed per request, which is why the quantum branch costs
microseconds rather than seconds.
