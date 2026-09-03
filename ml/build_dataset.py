"""
Build the QGene dataset from a raw ClinVar `variant_summary` extract.

Two things here differ from the original QGene pipeline and both matter:

1.  **Variant-level de-duplication.** ClinVar lists every variant once per
    genome assembly (GRCh37 and GRCh38). A row-level train/test split
    therefore places the *same variant* on both sides of the split, which
    inflates test accuracy. We collapse to one row per VariationID first and
    split on VariationID.

2.  **A VUS pool is kept, not discarded.** Variants classified "Uncertain
    significance" or with conflicting submissions are the clinically
    interesting cases. They carry no label, so they are held out as a separate
    unlabelled pool for the VUS Resolver rather than being dropped.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from features import (  # noqa: E402
    CURATION_FEATURES,
    MOLECULAR_FEATURES,
    curation_vector,
    molecular_vector,
)

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "clinvar_brca_raw.tsv"
OUT = ROOT / "data" / "processed"

PATHOGENIC = {"Pathogenic", "Likely pathogenic", "Pathogenic/Likely pathogenic"}
BENIGN = {"Benign", "Likely benign", "Benign/Likely benign"}
UNCERTAIN = {
    "Uncertain significance",
    "Conflicting classifications of pathogenicity",
    "Uncertain risk allele",
}

SEED = 42


def load_raw() -> pd.DataFrame:
    df = pd.read_csv(RAW, sep="\t", dtype=str, low_memory=False)
    df.columns = [c.strip().lstrip("#") for c in df.columns]
    return df


def collapse_assemblies(df: pd.DataFrame) -> pd.DataFrame:
    """One row per VariationID, preferring the GRCh38 record."""
    df = df.copy()
    df["_asm_rank"] = df["Assembly"].map({"GRCh38": 0, "GRCh37": 1}).fillna(2)
    df = df.sort_values("_asm_rank").drop_duplicates(subset=["VariationID"], keep="first")
    return df.drop(columns="_asm_rank").reset_index(drop=True)


def label_of(sig: str) -> int | None:
    sig = (sig or "").strip()
    if sig in PATHOGENIC:
        return 1
    if sig in BENIGN:
        return 0
    return None


def is_uncertain(sig: str) -> bool:
    return (sig or "").strip() in UNCERTAIN


def to_rows(df: pd.DataFrame) -> pd.DataFrame:
    out = pd.DataFrame({
        "variation_id": df["VariationID"],
        "gene": df["GeneSymbol"],
        "name": df["Name"],
        "var_type": df["Type"].str.lower(),
        "significance": df["ClinicalSignificance"],
        "review_status": df["ReviewStatus"],
        "n_submitters": pd.to_numeric(df["NumberSubmitters"], errors="coerce").fillna(1),
        "submitter_categories": pd.to_numeric(df["SubmitterCategories"], errors="coerce").fillna(1),
        "tested_in_gtr": df["TestedInGTR"],
        "chromosome": df["Chromosome"],
        "start": pd.to_numeric(df["Start"], errors="coerce").fillna(0),
        "stop": pd.to_numeric(df["Stop"], errors="coerce").fillna(0),
        "phenotypes": df["PhenotypeList"],
        "last_evaluated": df["LastEvaluated"],
    })
    return out[out["gene"].isin(["BRCA1", "BRCA2"])].reset_index(drop=True)


def featurise(rows: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    recs = rows.to_dict("records")
    X_mol = np.vstack([molecular_vector(r) for r in recs])
    X_cur = np.vstack([curation_vector(r) for r in recs])
    return X_mol, X_cur


def stratified_split(rows: pd.DataFrame, y: np.ndarray, seed: int = SEED):
    """70/15/15 split, stratified on (label, gene), at variant level."""
    rng = np.random.default_rng(seed)
    idx_tr, idx_va, idx_te = [], [], []
    strata = pd.Series([f"{a}_{b}" for a, b in zip(y, rows["gene"])])
    for _, group in strata.groupby(strata):
        idx = group.index.to_numpy().copy()
        rng.shuffle(idx)
        n = len(idx)
        n_tr, n_va = int(0.70 * n), int(0.15 * n)
        idx_tr.extend(idx[:n_tr])
        idx_va.extend(idx[n_tr:n_tr + n_va])
        idx_te.extend(idx[n_tr + n_va:])
    return (np.sort(np.array(idx_tr)), np.sort(np.array(idx_va)), np.sort(np.array(idx_te)))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    raw = load_raw()
    print(f"raw rows                     {len(raw):>8,}")

    collapsed = collapse_assemblies(raw)
    print(f"after assembly de-duplication{len(collapsed):>8,}")
    print(f"  duplicate rows removed     {len(raw) - len(collapsed):>8,}")

    rows = to_rows(collapsed)
    print(f"BRCA1/BRCA2 variants         {len(rows):>8,}")

    rows["label"] = rows["significance"].map(label_of)
    labelled = rows[rows["label"].notna()].reset_index(drop=True)
    vus = rows[rows["significance"].map(is_uncertain)].reset_index(drop=True)
    labelled["label"] = labelled["label"].astype(int)

    print(f"labelled (P/LP vs B/LB)      {len(labelled):>8,}"
          f"   pathogenic={int(labelled.label.sum()):,}"
          f" benign={int((1 - labelled.label).sum()):,}")
    print(f"VUS / conflicting pool       {len(vus):>8,}")

    X_mol, X_cur = featurise(labelled)
    y = labelled["label"].to_numpy()
    tr, va, te = stratified_split(labelled, y)
    print(f"split  train={len(tr):,}  val={len(va):,}  test={len(te):,}")

    # Leakage check: no VariationID may appear in more than one split.
    ids = labelled["variation_id"].to_numpy()
    assert len(set(ids[tr]) & set(ids[te])) == 0, "train/test variant overlap"
    assert len(set(ids[va]) & set(ids[te])) == 0, "val/test variant overlap"
    assert len(set(ids)) == len(ids), "duplicate variant ids survived"
    print("leakage check                 PASS (no shared variant across splits)")

    Xv_mol, Xv_cur = featurise(vus)

    np.savez_compressed(
        OUT / "dataset.npz",
        X_mol=X_mol, X_cur=X_cur, y=y,
        idx_train=tr, idx_val=va, idx_test=te,
        X_vus_mol=Xv_mol, X_vus_cur=Xv_cur,
    )
    labelled.to_parquet(OUT / "labelled.parquet", index=False)
    vus.to_parquet(OUT / "vus.parquet", index=False)

    meta = {
        "molecular_features": MOLECULAR_FEATURES,
        "curation_features": CURATION_FEATURES,
        "n_raw_rows": int(len(raw)),
        "n_after_dedup": int(len(collapsed)),
        "n_duplicate_rows_removed": int(len(raw) - len(collapsed)),
        "n_labelled": int(len(labelled)),
        "n_pathogenic": int(labelled.label.sum()),
        "n_benign": int((1 - labelled.label).sum()),
        "n_vus": int(len(vus)),
        "n_brca1": int((labelled.gene == "BRCA1").sum()),
        "n_brca2": int((labelled.gene == "BRCA2").sum()),
        "split": {"train": int(len(tr)), "val": int(len(va)), "test": int(len(te))},
        "seed": SEED,
        "source": "NCBI ClinVar variant_summary.txt.gz",
    }
    (OUT / "dataset_meta.json").write_text(json.dumps(meta, indent=2))
    print(f"\nwrote {OUT}/dataset.npz  ({X_mol.shape[1]} molecular features)")


if __name__ == "__main__":
    main()
