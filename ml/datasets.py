"""
The biomedical datasets bundled with the platform.

Problem statement 26139 asks for a *platform* applied to biomedical datasets
for the early identification of disease — cancer, cardiovascular disorders,
neurological conditions — across genomics, imaging-derived and record-style
data. Each loader below normalises one public dataset into the same shape, so
the pipeline in `ml/pipeline.py` never needs to know which disease it is
looking at.

Every dataset is deliberately kept in its raw form, missing values and all:
handling missing and noisy data is itself a required deliverable, so the
imputation and cleaning stages need something real to work on.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
BUNDLED = ROOT / "data" / "bundled"


@dataclass
class Dataset:
    id: str
    name: str
    disease: str
    domain: str                    # cancer / cardiovascular / neurological / metabolic
    modality: str                  # genomics / imaging-derived / clinical records / voice signal
    X: np.ndarray
    y: np.ndarray
    feature_names: list[str]
    positive_label: str
    negative_label: str
    source: str
    description: str
    n_qubits: int = 6
    split: dict[str, np.ndarray] | None = None   # optional precomputed indices
    notes: str = ""
    units: dict[str, str] = field(default_factory=dict)

    @property
    def n_samples(self) -> int:
        return int(self.X.shape[0])

    @property
    def n_features(self) -> int:
        return int(self.X.shape[1])

    @property
    def missing_rate(self) -> float:
        return float(np.isnan(self.X).mean())

    @property
    def prevalence(self) -> float:
        return float(self.y.mean())

    def summary(self) -> dict:
        return {
            "id": self.id, "name": self.name, "disease": self.disease,
            "domain": self.domain, "modality": self.modality,
            "n_samples": self.n_samples, "n_features": self.n_features,
            "missing_rate": round(self.missing_rate, 5),
            "prevalence": round(self.prevalence, 4),
            "positive_label": self.positive_label,
            "negative_label": self.negative_label,
            "source": self.source, "description": self.description,
            "n_qubits": self.n_qubits, "notes": self.notes,
        }


# ---------------------------------------------------------------------------
# loaders
# ---------------------------------------------------------------------------

def load_brca_clinvar() -> Dataset:
    """BRCA1/BRCA2 variant pathogenicity — genomics, hereditary cancer risk."""
    import json
    import sys
    sys.path.insert(0, str(ROOT / "ml"))
    from features import MOLECULAR_FEATURES

    d = np.load(ROOT / "data" / "processed" / "dataset.npz")
    meta = json.loads((ROOT / "data" / "processed" / "dataset_meta.json").read_text())
    return Dataset(
        id="brca_clinvar",
        name="BRCA1 / BRCA2 variant pathogenicity",
        disease="Hereditary breast and ovarian cancer",
        domain="cancer",
        modality="genomics",
        X=d["X_mol"], y=d["y"],
        feature_names=list(MOLECULAR_FEATURES),
        positive_label="Pathogenic", negative_label="Benign",
        source="NCBI ClinVar variant_summary",
        description=(
            "Every classified BRCA1 and BRCA2 variant in ClinVar, described by "
            "molecular features derived from the HGVS notation: consequence "
            "class, Grantham chemical distance, hydropathy and charge shifts, "
            "functional-domain membership and splice proximity."
        ),
        n_qubits=8,
        split={"train": d["idx_train"], "val": d["idx_val"], "test": d["idx_test"]},
        notes=(
            f"Collapsed to one row per variant before splitting; "
            f"{meta['n_duplicate_rows_removed']:,} duplicate assembly rows removed. "
            f"{meta['n_vus']:,} unresolved variants held out for the VUS Resolver."
        ),
    )


def load_breast_wdbc() -> Dataset:
    """Wisconsin Diagnostic Breast Cancer — features computed from FNA imaging."""
    from sklearn.datasets import load_breast_cancer
    raw = load_breast_cancer()
    # sklearn encodes malignant as 0; flip so 1 always means "disease present"
    y = 1 - raw.target
    return Dataset(
        id="breast_wdbc",
        name="Breast cancer — diagnostic imaging features",
        disease="Breast cancer",
        domain="cancer",
        modality="imaging-derived",
        X=raw.data.astype(float), y=y.astype(int),
        feature_names=[n.replace(" ", "_") for n in raw.feature_names],
        positive_label="Malignant", negative_label="Benign",
        source="UCI / Wisconsin Diagnostic Breast Cancer (WDBC)",
        description=(
            "Thirty morphological features — radius, texture, concavity and "
            "their worst-case statistics — computed from digitised images of "
            "fine-needle aspirates of a breast mass."
        ),
        n_qubits=6,
        notes="The canonical benchmark for quantum-kernel classification papers.",
    )


def load_heart_cleveland() -> Dataset:
    """Cleveland heart disease — cardiovascular, clinical records with gaps."""
    cols = ["age", "sex", "chest_pain_type", "resting_bp", "cholesterol",
            "fasting_blood_sugar", "resting_ecg", "max_heart_rate",
            "exercise_angina", "st_depression", "st_slope",
            "major_vessels", "thalassemia"]
    path = BUNDLED / "heart" / "processed.cleveland.data"
    df = pd.read_csv(path, header=None, names=cols + ["diagnosis"], na_values="?")
    y = (pd.to_numeric(df["diagnosis"], errors="coerce").fillna(0) > 0).astype(int)
    X = df[cols].apply(pd.to_numeric, errors="coerce").to_numpy(dtype=float)
    return Dataset(
        id="heart_cleveland",
        name="Coronary artery disease",
        disease="Coronary artery disease",
        domain="cardiovascular",
        modality="clinical records",
        X=X, y=y.to_numpy(),
        feature_names=cols,
        positive_label="Disease present", negative_label="No disease",
        source="UCI Heart Disease (Cleveland), Detrano et al.",
        description=(
            "Thirteen routine clinical measurements — resting blood pressure, "
            "cholesterol, exercise-induced angina, ST depression and vessel "
            "counts — used to predict angiographic coronary disease."
        ),
        n_qubits=6,
        notes="Contains genuine missing values, which the imputation stage handles.",
    )


def load_parkinsons() -> Dataset:
    """Parkinson's disease from sustained-phonation voice measures."""
    df = pd.read_csv(BUNDLED / "parkinsons" / "parkinsons.data")
    y = df["status"].astype(int).to_numpy()
    feats = [c for c in df.columns if c not in ("name", "status")]
    X = df[feats].to_numpy(dtype=float)
    return Dataset(
        id="parkinsons",
        name="Parkinson's disease — voice biomarkers",
        disease="Parkinson's disease",
        domain="neurological",
        modality="voice signal",
        X=X, y=y,
        feature_names=[c.replace(":", "_").replace("%", "pct")
                       .replace("(", "").replace(")", "") for c in feats],
        positive_label="Parkinson's", negative_label="Healthy control",
        source="UCI Parkinsons, Little et al. (2007)",
        description=(
            "Twenty-two acoustic measures of sustained phonation — jitter, "
            "shimmer, harmonic-to-noise ratio and nonlinear dynamical "
            "measures — recorded from 31 people, 23 with Parkinson's."
        ),
        n_qubits=6,
        notes="Small and high-dimensional: 195 recordings against 22 features, "
              "the low-data regime where quantum kernels are argued to help.",
    )


def load_diabetes_pima() -> Dataset:
    """Pima Indians diabetes — metabolic, early risk from routine measurements."""
    cols = ["pregnancies", "glucose", "blood_pressure", "skin_thickness",
            "insulin", "bmi", "diabetes_pedigree", "age"]
    df = pd.read_csv(BUNDLED / "pima_diabetes.csv", header=None,
                     names=cols + ["outcome"])
    X = df[cols].to_numpy(dtype=float)
    # Physiological zeros are recording gaps, not measurements.
    for j, c in enumerate(cols):
        if c in ("glucose", "blood_pressure", "skin_thickness", "insulin", "bmi"):
            X[X[:, j] == 0, j] = np.nan
    return Dataset(
        id="diabetes_pima",
        name="Type 2 diabetes onset",
        disease="Type 2 diabetes",
        domain="metabolic",
        modality="clinical records",
        X=X, y=df["outcome"].astype(int).to_numpy(),
        feature_names=cols,
        positive_label="Diabetes", negative_label="No diabetes",
        source="UCI Pima Indians Diabetes (NIDDK)",
        description=(
            "Eight routine measurements — plasma glucose, BMI, blood pressure, "
            "serum insulin and family history — recorded to predict diabetes "
            "onset within five years."
        ),
        n_qubits=6,
        notes="Zeros in glucose, blood pressure, skin fold, insulin and BMI are "
              "recording gaps rather than real values, so they are restored to "
              "missing before imputation.",
    )


LOADERS = {
    "brca_clinvar": load_brca_clinvar,
    "breast_wdbc": load_breast_wdbc,
    "heart_cleveland": load_heart_cleveland,
    "parkinsons": load_parkinsons,
    "diabetes_pima": load_diabetes_pima,
}

# Order shown in the interface: one per clinical domain, genomics first.
CATALOGUE = ["brca_clinvar", "breast_wdbc", "heart_cleveland",
             "parkinsons", "diabetes_pima"]


def load(dataset_id: str) -> Dataset:
    if dataset_id not in LOADERS:
        raise KeyError(f"unknown dataset {dataset_id!r}; "
                       f"available: {', '.join(CATALOGUE)}")
    return LOADERS[dataset_id]()


def load_all() -> list[Dataset]:
    return [load(i) for i in CATALOGUE]


def from_dataframe(df: pd.DataFrame, target: str, dataset_id: str = "uploaded",
                   name: str = "Uploaded dataset", n_qubits: int = 6) -> Dataset:
    """
    Wrap a user-supplied table as a Dataset.

    Only the target column is required to be interpretable as a binary label;
    everything else is coerced to numeric, and non-numeric columns are dropped
    with their names reported back to the caller.
    """
    if target not in df.columns:
        raise ValueError(f"target column {target!r} is not in the file")

    y_raw = df[target]
    uniques = pd.Series(y_raw.dropna().unique())
    if len(uniques) != 2:
        raise ValueError(
            f"target {target!r} has {len(uniques)} distinct values; "
            "this platform trains binary detectors, so it needs exactly two")

    # The positive class is the rarer one unless the labels are plainly 0/1.
    numeric_binary = set(pd.to_numeric(uniques, errors="coerce").dropna()) == {0, 1}
    if numeric_binary:
        pos = 1
    else:
        counts = y_raw.value_counts()
        pos = counts.index[-1]
    y = (y_raw == pos).astype(int).to_numpy()

    feats = df.drop(columns=[target])
    numeric = feats.apply(pd.to_numeric, errors="coerce")
    keep = [c for c in numeric.columns if numeric[c].notna().any()]
    dropped = [c for c in numeric.columns if c not in keep]
    X = numeric[keep].to_numpy(dtype=float)

    return Dataset(
        id=dataset_id, name=name, disease="User-supplied",
        domain="uploaded", modality="tabular",
        X=X, y=y, feature_names=list(keep),
        positive_label=str(pos), negative_label=f"not {pos}",
        source="Uploaded by the user",
        description=f"{X.shape[0]:,} rows and {X.shape[1]} numeric features.",
        n_qubits=n_qubits,
        notes=(f"Dropped {len(dropped)} non-numeric column(s): "
               f"{', '.join(dropped[:6])}" if dropped else ""),
    )
