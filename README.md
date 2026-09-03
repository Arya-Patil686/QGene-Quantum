# QGene — quantum–classical variant intelligence for BRCA1 and BRCA2

Predicts whether a BRCA1 or BRCA2 variant is pathogenic or benign using a hybrid
of classical and quantum machine learning — and, unusually for a predictor,
reports when it should not be trusted.

Built for **FF No. 180**, Department of Computer Engineering, Vishwakarma
Institute of Technology, Pune.

![status](https://img.shields.io/badge/status-research%20prototype-7c5cff)
![python](https://img.shields.io/badge/python-3.12-blue)
![qiskit](https://img.shields.io/badge/qiskit-2.x-6929c4)

---

## What it does

| | |
|---|---|
| **Classifies** | BRCA1/BRCA2 variants as pathogenic or benign from the HGVS description alone |
| **Explains** | SHAP contributions, the molecular consequence, and the functional domain the residue sits in |
| **Shows its quantum working** | the actual ZZFeatureMap circuit for your variant, its Bloch vectors, measurement distribution and nearest neighbours in kernel space |
| **Knows when to stop** | conformal prediction returns a set with a coverage guarantee, and returns *both* labels rather than guessing |
| **Resolves the unresolved** | every ClinVar BRCA variant currently marked uncertain or conflicting, scored and ranked for reclassification priority |

## The four contributions

**1 · An evaluation that holds up.** ClinVar lists every variant once per genome
assembly, so a row-level train/test split places the same variant on both sides.
The original pipeline did exactly that. Reproducing the mistake here and then
fixing it isolates how much of the reported accuracy was memorisation — the
number is in [`docs/RESULTS.md`](docs/RESULTS.md). Every figure in this project
uses a variant-level split.

**2 · Quantum kernels in closed form.** Qiskit's `FidelityQuantumKernel`
evaluates one circuit per *pair* of samples: O(n²) simulations, which is why the
original QSVM was limited to 500 training samples and needed seconds per
request. Under statevector simulation the kernel is exactly

```
K(x, y) = |⟨φ(x)|φ(y)⟩|²
```

so states are prepared once — O(n) — and the Gram matrix is a single product.
The ZZFeatureMap is also written analytically (after the Hadamard layer each
repetition is diagonal), vectorised across the batch. The implementation is
checked against Qiskit's own simulator on every training run and agrees to
machine precision. Consequences: the QSVM trains on thousands of samples rather
than hundreds, the VQC trains on the *full* training set rather than 200
samples, and the whole quantum path — state preparation, the kernel row
against 4,000 training states, QSVM and VQC — costs about **2 ms** per
prediction, so the classical Random Forest is now the slower half of the
ensemble.

**3 · A model that can abstain.** Class-conditional split conformal prediction
turns the ensemble probability into a prediction set with a distribution-free
coverage guarantee, and reports a per-class conformal p-value rather than only a
binary set. Targeting 90% coverage it declines to commit on roughly 9% of test
variants and is 99.7% accurate on the rest.

The gap between the classical and quantum sub-ensembles is also recorded as an
epistemic signal. Reported honestly: it is a *weak* error detector on this
dataset (AUC ≈ 0.61) and the plain confidence margin is far better (≈ 0.96), so
disagreement is surfaced as a secondary flag rather than sold as the main
uncertainty measure. See [`docs/RESULTS.md`](docs/RESULTS.md).

**4 · The VUS Resolver.** A variant of uncertain significance is a finding in a
patient's report with no interpretation attached. These rows carry no label, so
predictors normally discard them. QGene keeps them, scores every one, and ranks
them by how much resolving each would be worth — confident calls where the
classical and quantum branches agree come first.

## A note on the headline accuracy

The hybrid ensemble reaches ~98% accuracy on the held-out test set, which is
higher than the BRCA literature would suggest. That is a property of the
*labelled* subset, not a sign of a strong model, and the repository measures it
rather than glossing over it:

| Consequence class | share of test set | accuracy |
|---|---|---|
| truncating (frameshift / stop-gained) | ~39% | ~99.9% |
| synonymous | ~26% | ~99.9% |
| splice site | ~2% | 100% |
| intronic | ~17% | ~95% |
| **missense** | **~8%** | **~86%** |

Almost every ClinVar BRCA record labelled pathogenic is truncating, and almost
every record labelled benign is synonymous or deep intronic — so most of the
test set is separable on consequence alone. The genuinely hard class is
missense, where accuracy drops to ~86%.

And the hardest missense variants are not in the labelled set at all: they are
the ones ClinVar still calls uncertain. That is precisely the population the VUS
Resolver targets, and it is why per-class numbers are reported alongside the
headline.

## Quick start

The trained model bundle and every result artefact are committed, so the app
runs without retraining:

```bash
make setup     # virtualenv + npm install
make web       # build the front end
make serve     # http://localhost:5001
```

To rebuild everything from the source data instead:

```bash
make all       # download ClinVar, build dataset, train, score VUS, build the UI
```

The full pipeline takes about four minutes, most of it the ClinVar download.

Or step by step:

```bash
./scripts/fetch_clinvar.sh     # parallel, resumable download of variant_summary
.venv/bin/python ml/build_dataset.py
.venv/bin/python ml/train.py
.venv/bin/python ml/score_vus.py
cd web && npm run build
.venv/bin/python backend/app.py
```

Front-end development with hot reload (`npm run dev` on :5173, API on :5001):

```bash
make serve &
make dev
```

## Deployment

The repository ships a two-stage `Dockerfile` — Node builds the front end, and
the runtime image carries only Python and the built assets:

```bash
docker build -t qgene .
docker run -p 8000:8000 qgene
```

`render.yaml` points at that Dockerfile, so a Render deploy needs no extra
configuration. The trained bundle is committed, so no build-time training step
is required.

## Layout

```
ml/
  features.py        molecular feature engineering — HGVS parsing, Grantham,
                     hydropathy, functional domains
  quantum.py         analytic ZZFeatureMap, closed-form fidelity kernel,
                     batched-statevector VQC
  build_dataset.py   assembly de-duplication, labelling, variant-level splits
  train.py           four models, ensemble, conformal calibration, evaluation,
                     the leakage demonstration
  score_vus.py       scores and ranks every unresolved variant
backend/
  core.py            inference: probabilities, conformal sets, SHAP, quantum
                     introspection
  app.py             Flask API + static host
web/                 React + Vite + React Three Fiber front end
scripts/
  fetch_clinvar.sh   parallel ranged download
  make_report.py     regenerates docs/RESULTS.md from metrics.json
docs/RESULTS.md      the comparative analysis report
```

## API

| Endpoint | |
|---|---|
| `POST /api/predict` | `{"name": "NM_007294.4(BRCA1):c.181T>G (p.Cys61Gly)"}` → full result |
| `POST /api/batch` | CSV upload with a `name` column, up to 500 rows |
| `GET /api/vus` | ranked unresolved variants |
| `GET /api/metrics` | every number behind the results dashboard |
| `GET /api/examples` | curated demonstration variants |

## Credit

QGene began as a project by **Ananya Choudhari** — the original hybrid
classifier, ClinVar pipeline, SHAP layer and first web application live at
[ananyac9820/QGene](https://github.com/ananyac9820/QGene). This repository keeps
that structure and extends it with a rebuilt leak-free dataset, molecular
feature engineering, the closed-form quantum kernel, conformal abstention, the
VUS Resolver and a new interface.

Group 16 — Ananya Choudhari, Arya Bharat Patil, Aryan Bhat, Ankush Kumar.
Internal guide: Prof. Shilpa Katikar.

## Disclaimer

QGene is an academic research prototype. Its predictions are generated by
machine learning models, have not been clinically validated, and must never form
the basis of a medical decision. Consult a qualified clinician or genetic
counsellor.
