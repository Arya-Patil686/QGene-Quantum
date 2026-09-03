"""
End-to-end check of the trained bundle: encoding, every model, the conformal
layer, SHAP, and the quantum introspection the UI depends on.

Run after `ml/train.py`:  .venv/bin/python scripts/smoke_test.py
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from core import QGene  # noqa: E402

CASES = [
    ("NM_007294.4(BRCA1):c.181T>G (p.Cys61Gly)", "Pathogenic", "RING missense founder"),
    ("NM_007294.4(BRCA1):c.68_69del (p.Glu23fs)", "Pathogenic", "185delAG frameshift"),
    ("NM_000059.4(BRCA2):c.5946del (p.Ser1982fs)", "Pathogenic", "6174delT frameshift"),
    ("NM_007294.4(BRCA1):c.5266dup (p.Gln1756fs)", "Pathogenic", "5382insC duplication"),
    ("NM_007294.4(BRCA1):c.4837A>G (p.Ser1613Gly)", "Benign", "common polymorphism"),
    ("NM_000059.4(BRCA2):c.7397T>C (p.Val2466Ala)", "Benign", "benign missense"),
    ("NM_000059.4(BRCA2):c.9976A>T (p.Lys3326Ter)", "Benign", "late truncation, benign"),
]


def main() -> int:
    t0 = time.time()
    model = QGene()
    print(f"bundle loaded in {time.time() - t0:.1f}s\n")

    failures = 0
    latencies = []
    print(f"{'variant':<46}{'call':<13}{'P(path)':>9}{'conformal':>14}  note")
    print("-" * 108)
    for name, expected, note in CASES:
        t = time.time()
        r = model.predict({"name": name})
        latencies.append((time.time() - t) * 1000)
        short = name.split(":", 1)[1][:44]
        ok = r["prediction"] == expected
        mark = " " if ok else "  <-- differs from ClinVar"
        if not ok:
            failures += 1
        print(f"{short:<46}{r['prediction']:<13}"
              f"{r['pathogenic_probability']:>9.3f}{r['conformal']['status']:>14}  "
              f"{note}{mark}")

        # structural checks the front end relies on
        q = r["quantum"]
        assert len(q["bloch"]) == q["n_qubits"], "bloch vectors missing"
        assert q["circuit"], "circuit spec empty"
        assert q["neighbours"], "kernel neighbours empty"
        assert len(r["explanation"]) >= 5, "SHAP explanation too short"
        assert r["protein_track"]["domains"], "protein domains missing"

    print("-" * 108)
    print(f"\nlatency: median {sorted(latencies)[len(latencies) // 2]:.1f} ms, "
          f"max {max(latencies):.1f} ms")
    print(f"agreement with ClinVar on these {len(CASES)} cases: "
          f"{len(CASES) - failures}/{len(CASES)}")

    metrics = json.loads((ROOT / "backend" / "data" / "metrics.json").read_text())
    print(f"\ntest-set hybrid ROC-AUC {metrics['models']['hybrid']['roc_auc']:.4f}, "
          f"accuracy {metrics['models']['hybrid']['accuracy']:.4f}")
    print("all structural checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
