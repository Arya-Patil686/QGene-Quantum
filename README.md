# QGene — a hybrid quantum machine learning platform for early disease detection

**Smart India Hackathon 2026 · Problem Statement 26139 · MedTech / BioTech / HealthTech**
Team *Bugs Janta Party* (800C4B)

One hybrid quantum–classical pipeline — cleaning, imputation, feature selection,
PCA, quantum encoding, six models and a calibrated ensemble — applied unchanged
across **five diseases in four clinical domains**, plus any dataset you upload.

![status](https://img.shields.io/badge/status-research%20prototype-7c5cff)
![python](https://img.shields.io/badge/python-3.12-blue)
![qiskit](https://img.shields.io/badge/qiskit-2.x-6929c4)

---

## What it is

Not a single-disease classifier. The pipeline in [`ml/pipeline.py`](ml/pipeline.py)
never learns which disease it is looking at, so the same code path serves:

| Disease | Domain | Modality | n | Features |
|---|---|---|---|---|
| Hereditary breast & ovarian cancer | cancer | genomics | 20,296 | 22 |
| Breast cancer | cancer | imaging-derived | 569 | 30 |
| Coronary artery disease | cardiovascular | clinical records | 303 | 13 |
| Parkinson's disease | neurological | voice signal | 195 | 22 |
| Type 2 diabetes | metabolic | clinical records | 768 | 8 |
| **Your CSV** | — | tabular | — | — |

Full numbers: [`docs/PLATFORM.md`](docs/PLATFORM.md).

## Against the problem statement's delivery table

| # | Deliverable | Where |
|---|---|---|
| 1 | Pre-processing & feature engineering — cleaning, normalisation, dimensionality reduction, feature selection, missing/noisy data | [`ml/pipeline.py`](ml/pipeline.py) |
| 2 | Hybrid quantum-classical architecture — classical front-end, quantum register, data encoding | [`ml/pipeline.py`](ml/pipeline.py), [`ml/quantum.py`](ml/quantum.py) |
| 3 | Quantum ML models — QSVM, VQC, QNN, parameterised circuits | [`ml/quantum.py`](ml/quantum.py) |
| 4 | Prediction & decision support — probability, risk stratification, threshold tuning for sensitivity/specificity | [`backend/platform_core.py`](backend/platform_core.py) |
| 5 | Software platform — API, dataset upload, training & evaluation dashboard, result visualisation | [`backend/app.py`](backend/app.py), [`web/`](web) |

## Four things this build contributes

**1 · It tells you when quantum *won't* help — before you train.**
The platform sweeps the ZZFeatureMap kernel across register widths and measures
kernel-target alignment and off-diagonal spread. On every dataset here the
spread roughly **halves with each qubit added** (0.264 → 0.006 on WDBC across
2→8 qubits): exponential concentration, the kernel matrix tending to the
identity. It is the direct explanation for the QSVM's collapsed sensitivity, and
it is reported up front rather than discovered afterwards.

**2 · Quantum kernels in closed form.**
Qiskit's `FidelityQuantumKernel` runs one circuit per *pair* of samples — O(n²).
Under statevector simulation the kernel is exactly

```
K(x, y) = |⟨φ(x)|φ(y)⟩|²        →        K = |Ψ Ψ†|²
```

so states are prepared once, O(n), and the Gram matrix is one product. The
ZZFeatureMap and the QNN's gate applications are written analytically and
verified against Qiskit's simulator on every run (agreement ~1e-15, exact for
the QNN path). This is what makes the diagnostic sweep and browser-speed
training possible: a 4000×4000 quantum Gram matrix builds in about a second.

**3 · Three genuinely different quantum models.**
A quantum-kernel SVM, a variational classifier (RealAmplitudes, COBYLA), and a
**data re-uploading QNN** trained by **SPSA** — two objective evaluations per
step regardless of parameter count, which is the optimiser variational circuits
actually use on hardware. The QNN is the strongest quantum model and beats every
classical baseline on two of the five datasets.

**4 · Decision support, not just a score.**
A five-band risk ladder validated against the observed outcome rate in each
band; a full sensitivity/specificity sweep with screening and confirmation
presets; and class-conditional conformal prediction that abstains rather than
guessing — and says so when the calibration set is too small for the guarantee
to be tight.

## Honest results

The quantum branch wins on **2 of 5** datasets. It loses on the other three, the
ensemble down-weights it automatically, and all of that is on the dashboard.
Quantum–classical disagreement was tested as an uncertainty signal on the
genomics dataset and is *worse* than the plain confidence margin (AUC 0.61
against 0.96), so it is surfaced as a secondary flag rather than sold as the
uncertainty measure.

The genomics dataset also carries a methodological correction: ClinVar lists
every variant once per genome assembly, so a row-level split leaks the same
variant into train and test. Reproducing that mistake inflates accuracy by
**1.03 points** across 6,277 shared variants. Details in
[`docs/RESULTS.md`](docs/RESULTS.md).

## Quick start

Every trained model and result artefact is committed, so the app runs without
retraining:

```bash
make setup     # virtualenv + npm install
make web       # build the front end
make serve     # http://localhost:5001
```

Rebuild everything from source data instead:

```bash
make data          # ClinVar download + genomics dataset build
make platform      # train all five datasets
make report        # regenerate docs/
```

## Layout

```
ml/
  datasets.py        the bundled dataset registry, one loader per disease
  pipeline.py        the dataset-agnostic hybrid pipeline + kernel diagnostics
  quantum.py         analytic ZZFeatureMap, closed-form kernel, VQC, QNN
  features.py        genomics feature engineering (HGVS, Grantham, domains)
  build_dataset.py   ClinVar de-duplication and variant-level splits
  train_platform.py  trains every bundled dataset
  train.py           the genomics deep-dive (leakage demo, stratified eval)
  score_vus.py       ranks ClinVar's unresolved variants
backend/
  pipeline serving, the studio's upload-and-train path, Flask API
web/                 React + React Three Fiber front end
docs/
  PLATFORM.md        cross-dataset benchmark
  RESULTS.md         genomics deep-dive
  ARCHITECTURE.md    how the pieces fit
```

## API

| Endpoint | |
|---|---|
| `GET /api/platform` | dataset catalogue and headline benchmark |
| `GET /api/platform/<id>` | one dataset's full record |
| `GET /api/platform/<id>/schema` | feature list for building an input form |
| `POST /api/platform/<id>/predict` | probability, risk tier, conformal set, SHAP, quantum state |
| `POST /api/studio/profile` | inspect an uploaded CSV |
| `POST /api/studio/train` | train the whole stack on it |
| `POST /api/predict` | genomics: score an HGVS variant |
| `GET /api/vus` | genomics: ranked unresolved variants |

## Deployment

Two-stage `Dockerfile` — Node builds the front end, the runtime image carries
only Python and the built assets.

```bash
docker build -t qgene . && docker run -p 8000:8000 qgene
```

## Credit

The BRCA genomics component began as a project by **Ananya Choudhari** —
original hybrid classifier, ClinVar pipeline, SHAP layer and first web app at
[ananyac9820/QGene](https://github.com/ananyac9820/QGene). This repository
generalises that into a dataset-agnostic platform and adds the pre-processing
pipeline, the QNN, kernel diagnostics, conformal abstention, decision support
and the studio.

## Disclaimer

A research prototype built on public benchmark datasets. Predictions are not
clinically validated and must never form the basis of a medical decision.
