"""
Molecular feature engineering for BRCA1/BRCA2 variants.

Everything here is derived from the variant description itself (HGVS `Name`,
variant type, coordinates) plus fixed biochemical constants. No curation
metadata (review status, submitter counts) enters this module -- that is kept
separate in `curation_features` so the two regimes can be compared honestly.
"""
from __future__ import annotations

import math
import re
from typing import Any

import numpy as np

# ---------------------------------------------------------------------------
# Biochemical constants
# ---------------------------------------------------------------------------

# Grantham (1974) composition / polarity / volume, Table 1.
# The distance matrix is recomputed from the formula rather than transcribed,
# and checked against five published cells in `_validate_grantham()`.
_GRANTHAM_CPV = {
    "S": (1.42, 9.2, 32.0),  "R": (0.65, 10.5, 124.0), "L": (0.00, 4.9, 111.0),
    "P": (0.39, 8.0, 32.5),  "T": (0.71, 8.6, 61.0),   "A": (0.00, 8.1, 31.0),
    "V": (0.00, 5.9, 84.0),  "G": (0.74, 9.0, 3.0),    "I": (0.00, 5.2, 111.0),
    "F": (0.00, 5.2, 132.0), "Y": (0.20, 6.2, 136.0),  "C": (2.75, 5.5, 55.0),
    "H": (0.58, 10.4, 96.0), "Q": (0.89, 10.5, 85.0),  "N": (1.33, 11.6, 56.0),
    "K": (0.33, 11.3, 119.0),"D": (1.38, 13.0, 54.0),  "E": (0.92, 12.3, 83.0),
    "M": (0.00, 5.7, 105.0), "W": (0.13, 5.4, 170.0),
}
_G_ALPHA, _G_BETA, _G_GAMMA, _G_RHO = 1.833, 0.1018, 0.000399, 50.723

# Kyte & Doolittle (1982) hydropathy index.
_HYDROPATHY = {
    "A": 1.8, "R": -4.5, "N": -3.5, "D": -3.5, "C": 2.5, "Q": -3.5, "E": -3.5,
    "G": -0.4, "H": -3.2, "I": 4.5, "L": 3.8, "K": -3.9, "M": 1.9, "F": 2.8,
    "P": -1.6, "S": -0.8, "T": -0.7, "W": -0.9, "Y": -1.3, "V": 4.2,
}

# Net charge at physiological pH.
_CHARGE = {"D": -1.0, "E": -1.0, "K": 1.0, "R": 1.0, "H": 0.1}

_AA3_TO_1 = {
    "Ala": "A", "Arg": "R", "Asn": "N", "Asp": "D", "Cys": "C", "Gln": "Q",
    "Glu": "E", "Gly": "G", "His": "H", "Ile": "I", "Leu": "L", "Lys": "K",
    "Met": "M", "Phe": "F", "Pro": "P", "Ser": "S", "Thr": "T", "Trp": "W",
    "Tyr": "Y", "Val": "V", "Ter": "*", "Sec": "U", "Xaa": "X",
}


def grantham(a: str, b: str) -> float:
    """Grantham chemical distance between two one-letter amino acids."""
    if a not in _GRANTHAM_CPV or b not in _GRANTHAM_CPV:
        return 0.0
    c1, p1, v1 = _GRANTHAM_CPV[a]
    c2, p2, v2 = _GRANTHAM_CPV[b]
    return _G_RHO * math.sqrt(
        _G_ALPHA * (c1 - c2) ** 2
        + _G_BETA * (p1 - p2) ** 2
        + _G_GAMMA * (v1 - v2) ** 2
    )


def _validate_grantham() -> None:
    """Guard against a typo in the constants: check published matrix cells."""
    for a, b, expected in [("S", "R", 110), ("L", "I", 5), ("C", "W", 215),
                           ("G", "W", 184), ("D", "E", 45)]:
        got = grantham(a, b)
        if abs(got - expected) > 1.0:
            raise AssertionError(
                f"Grantham({a},{b}) = {got:.1f}, published value is {expected}"
            )


_validate_grantham()

# ---------------------------------------------------------------------------
# Gene / domain constants
# ---------------------------------------------------------------------------

PROTEIN_LEN = {"BRCA1": 1863, "BRCA2": 3418}

# Clinically important functional domains (UniProt P38398 / P51587, as used by
# the ENIGMA BRCA1/2 classification criteria). Half-open [start, end] in aa.
DOMAINS = {
    "BRCA1": [
        ("RING", 1, 109),
        ("SCD", 1280, 1524),
        ("coiled-coil", 1391, 1424),
        ("BRCT1", 1650, 1736),
        ("BRCT2", 1760, 1855),
    ],
    "BRCA2": [
        ("PALB2-binding", 21, 39),
        ("BRC-repeats", 1002, 2085),
        ("DNA-binding", 2481, 3186),
        ("TR2/RAD51", 3270, 3305),
        ("NLS", 3263, 3418),
    ],
}

# Transcript coding lengths, used to normalise cDNA position.
CDS_LEN = {"BRCA1": 5592, "BRCA2": 10257}

TYPE_ENC = {
    "single nucleotide variant": 0, "deletion": 1, "duplication": 2,
    "insertion": 3, "indel": 4, "microsatellite": 5, "inversion": 6,
    "copy number loss": 7, "copy number gain": 8, "protein only": 9,
    "complex": 10, "variation": 11, "translocation": 12, "fusion": 13,
}

# ---------------------------------------------------------------------------
# HGVS parsing
# ---------------------------------------------------------------------------

_RE_CDNA = re.compile(r"c\.(?P<utr>[-*]?)(?P<pos>\d+)(?P<off>[+-]\d+)?")
_RE_PROT = re.compile(
    r"p\.\(?(?P<ref>[A-Z][a-z]{2})(?P<pos>\d+)(?P<alt>[A-Z][a-z]{2}|=|\*|Ter)?"
)
_RE_SUB = re.compile(r"c\.[^ ]*?(?P<ref>[ACGT])>(?P<alt>[ACGT])")

_PURINES = {"A", "G"}


def parse_hgvs(name: str) -> dict[str, Any]:
    """Pull structured fields out of a ClinVar `Name` string."""
    out: dict[str, Any] = {
        "cdna_pos": 0, "intron_offset": 0, "is_utr5": 0, "is_utr3": 0,
        "aa_pos": 0, "aa_ref": "", "aa_alt": "", "nt_ref": "", "nt_alt": "",
        "has_protein": 0,
    }
    if not isinstance(name, str):
        return out

    m = _RE_CDNA.search(name)
    if m:
        out["cdna_pos"] = int(m.group("pos"))
        out["intron_offset"] = int(m.group("off")) if m.group("off") else 0
        out["is_utr5"] = 1 if m.group("utr") == "-" else 0
        out["is_utr3"] = 1 if m.group("utr") == "*" else 0

    m = _RE_PROT.search(name)
    if m:
        out["aa_pos"] = int(m.group("pos"))
        out["aa_ref"] = _AA3_TO_1.get(m.group("ref"), "")
        alt = m.group("alt") or ""
        if alt == "=":
            out["aa_alt"] = out["aa_ref"]
        elif alt in ("*", "Ter"):
            out["aa_alt"] = "*"
        else:
            out["aa_alt"] = _AA3_TO_1.get(alt, "")
        out["has_protein"] = 1

    m = _RE_SUB.search(name)
    if m:
        out["nt_ref"] = m.group("ref")
        out["nt_alt"] = m.group("alt")

    return out


def domain_of(gene: str, aa_pos: int) -> str | None:
    for dname, lo, hi in DOMAINS.get(gene, []):
        if lo <= aa_pos <= hi:
            return dname
    return None


# ---------------------------------------------------------------------------
# Feature vectors
# ---------------------------------------------------------------------------

MOLECULAR_FEATURES = [
    "gene",                # 0 = BRCA1, 1 = BRCA2
    "var_type",            # ClinVar variant class, ordinal
    "cdna_pos_rel",        # cDNA position / CDS length
    "intron_offset_abs",   # |offset| into the intron, capped
    "is_intronic",
    "is_splice_site",      # within +/-2 of an exon boundary
    "is_utr",
    "aa_pos_rel",          # protein position / protein length
    "log_var_len",
    "is_truncating",       # frameshift or nonsense
    "is_frameshift",
    "is_nonsense",
    "is_missense",
    "is_synonymous",
    "is_inframe_indel",
    "in_critical_domain",
    "domain_idx",
    "grantham",            # chemical distance of the substitution
    "d_hydropathy",
    "d_charge",
    "d_volume",
    "is_transition",       # purine<->purine or pyrimidine<->pyrimidine
]

CURATION_FEATURES = [
    "review_stars",
    "log_n_submitters",
    "submitter_categories",
    "tested_in_gtr",
]

REVIEW_STARS = {
    "practice guideline": 4,
    "reviewed by expert panel": 3,
    "criteria provided, multiple submitters, no conflicts": 2,
    "criteria provided, conflicting classifications": 1,
    "criteria provided, conflicting interpretations": 1,
    "criteria provided, single submitter": 1,
    "no assertion criteria provided": 0,
    "no classification provided": 0,
    "no assertion provided": 0,
}


def molecular_vector(row: dict[str, Any]) -> np.ndarray:
    """Build the 22-dim molecular feature vector for one variant."""
    gene = str(row.get("gene", "BRCA1")).upper()
    gene_i = 0 if gene == "BRCA1" else 1
    name = str(row.get("name", "") or "")
    p = parse_hgvs(name)

    vtype = str(row.get("var_type", "single nucleotide variant")).lower()
    vtype_i = TYPE_ENC.get(vtype, 0)

    start = float(row.get("start", 0) or 0)
    stop = float(row.get("stop", 0) or 0)
    var_len = max(1.0, abs(stop - start) + 1.0)

    aa_pos = p["aa_pos"]
    aa_ref, aa_alt = p["aa_ref"], p["aa_alt"]

    is_frameshift = 1 if ("fs" in name) else 0
    is_nonsense = 1 if (aa_alt == "*" and aa_ref not in ("", "*")) else 0
    is_synonymous = 1 if (aa_ref and aa_ref == aa_alt) else 0
    is_missense = 1 if (
        aa_ref and aa_alt and aa_ref != aa_alt
        and aa_alt != "*" and not is_frameshift
    ) else 0
    is_inframe = 1 if (
        vtype in ("deletion", "insertion", "duplication", "indel")
        and not is_frameshift and var_len % 3 == 0
    ) else 0

    offset = p["intron_offset"]
    is_intronic = 1 if offset != 0 else 0
    is_splice = 1 if (0 < abs(offset) <= 2) else 0
    is_utr = 1 if (p["is_utr5"] or p["is_utr3"]) else 0

    dom = domain_of(gene, aa_pos) if aa_pos else None
    domain_names = [d[0] for d in DOMAINS[gene]] if gene in DOMAINS else []
    domain_idx = (domain_names.index(dom) + 1) if dom else 0

    if aa_ref in _HYDROPATHY and aa_alt in _HYDROPATHY:
        g = grantham(aa_ref, aa_alt)
        d_hyd = _HYDROPATHY[aa_alt] - _HYDROPATHY[aa_ref]
        d_chg = _CHARGE.get(aa_alt, 0.0) - _CHARGE.get(aa_ref, 0.0)
        d_vol = _GRANTHAM_CPV[aa_alt][2] - _GRANTHAM_CPV[aa_ref][2]
    else:
        g = d_hyd = d_chg = d_vol = 0.0

    nt_ref, nt_alt = p["nt_ref"], p["nt_alt"]
    is_transition = 1 if (
        nt_ref and nt_alt
        and (nt_ref in _PURINES) == (nt_alt in _PURINES)
    ) else 0

    return np.array([
        gene_i,
        vtype_i,
        p["cdna_pos"] / CDS_LEN.get(gene, 5592),
        min(abs(offset), 100),
        is_intronic,
        is_splice,
        is_utr,
        aa_pos / PROTEIN_LEN.get(gene, 1863),
        math.log1p(var_len),
        1 if (is_frameshift or is_nonsense) else 0,
        is_frameshift,
        is_nonsense,
        is_missense,
        is_synonymous,
        is_inframe,
        1 if dom else 0,
        domain_idx,
        g,
        d_hyd,
        d_chg,
        d_vol,
        is_transition,
    ], dtype=float)


def curation_vector(row: dict[str, Any]) -> np.ndarray:
    review = str(row.get("review_status", "") or "").strip().lower()
    stars = REVIEW_STARS.get(review, 0)
    n_sub = float(row.get("n_submitters", 1) or 1)
    cats = float(row.get("submitter_categories", 1) or 1)
    gtr = 1.0 if str(row.get("tested_in_gtr", "N")).upper().startswith("Y") else 0.0
    return np.array([stars, math.log1p(n_sub), cats, gtr], dtype=float)


def describe(row: dict[str, Any]) -> dict[str, Any]:
    """Human-readable consequence summary, used by the API for explanations."""
    gene = str(row.get("gene", "BRCA1")).upper()
    name = str(row.get("name", "") or "")
    p = parse_hgvs(name)
    v = molecular_vector(row)
    idx = {n: i for i, n in enumerate(MOLECULAR_FEATURES)}

    if v[idx["is_frameshift"]]:
        consequence = "frameshift"
    elif v[idx["is_nonsense"]]:
        consequence = "nonsense (stop gained)"
    elif v[idx["is_missense"]]:
        consequence = "missense"
    elif v[idx["is_synonymous"]]:
        consequence = "synonymous"
    elif v[idx["is_splice_site"]]:
        consequence = "splice site"
    elif v[idx["is_intronic"]]:
        consequence = "intronic"
    elif v[idx["is_utr"]]:
        consequence = "untranslated region"
    elif v[idx["is_inframe_indel"]]:
        consequence = "in-frame indel"
    else:
        consequence = "other"

    return {
        "gene": gene,
        "consequence": consequence,
        "cdna_position": p["cdna_pos"],
        "protein_position": p["aa_pos"] or None,
        "aa_change": (f"{p['aa_ref']}{p['aa_pos']}{p['aa_alt']}"
                      if p["aa_ref"] and p["aa_pos"] else None),
        "domain": domain_of(gene, p["aa_pos"]) if p["aa_pos"] else None,
        "grantham": round(float(v[idx["grantham"]]), 1) or None,
        "intron_offset": p["intron_offset"] or None,
    }
