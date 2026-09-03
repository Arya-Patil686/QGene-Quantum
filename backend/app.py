"""
QGene API + static host for the React front end.
"""
from __future__ import annotations

import io
import json
import time
from pathlib import Path

import pandas as pd
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from core import QGene

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "web" / "dist"
DATA = ROOT / "backend" / "data"

# static_folder is left unset on purpose: with static_url_path="" Flask's own
# static route registers as /<path:filename> and shadows the SPA catch-all
# below, so deep links such as /predict would 404 instead of loading the app.
app = Flask(__name__, static_folder=None)
CORS(app)

print("loading model bundle ...")
_t0 = time.time()
MODEL = QGene()
# Build the SHAP explainer up front; otherwise the first request pays for it.
MODEL.predict({"name": "NM_007294.4(BRCA1):c.181T>G (p.Cys61Gly)"})
print(f"ready in {time.time() - _t0:.1f}s")

_METRICS = json.loads((DATA / "metrics.json").read_text())
_VUS = json.loads((DATA / "vus_scored.json").read_text()) if (DATA / "vus_scored.json").exists() else {"variants": []}
_EXAMPLES = json.loads((DATA / "examples.json").read_text()) if (DATA / "examples.json").exists() else []


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "models": ["rf", "svm", "qsvm", "vqc", "hybrid"]})


@app.get("/api/metrics")
def metrics():
    return jsonify(_METRICS)


@app.get("/api/examples")
def examples():
    return jsonify(_EXAMPLES)


@app.post("/api/predict")
def predict():
    payload = request.get_json(silent=True) or {}
    if not (payload.get("name") or payload.get("hgvs")):
        return jsonify({"error": "Provide an HGVS variant name, e.g. "
                                 "NM_007294.4(BRCA1):c.181T>G (p.Cys61Gly)"}), 400
    t0 = time.time()
    try:
        result = MODEL.predict(payload, explain=payload.get("explain", True))
    except Exception as exc:                       # noqa: BLE001
        return jsonify({"error": f"Could not score that variant: {exc}"}), 400
    result["latency_ms"] = round((time.time() - t0) * 1000, 1)
    return jsonify(result)


@app.get("/api/vus")
def vus():
    limit = min(int(request.args.get("limit", 100)), 500)
    gene = request.args.get("gene")
    items = _VUS.get("variants", [])
    if gene in ("BRCA1", "BRCA2"):
        items = [v for v in items if v["gene"] == gene]
    return jsonify({"summary": _VUS.get("summary", {}),
                    "total": len(items), "variants": items[:limit]})


@app.post("/api/batch")
def batch():
    if "file" not in request.files:
        return jsonify({"error": "Upload a CSV file under the 'file' field"}), 400
    try:
        df = pd.read_csv(io.BytesIO(request.files["file"].read()))
    except Exception as exc:                        # noqa: BLE001
        return jsonify({"error": f"Could not read the CSV: {exc}"}), 400
    if len(df) > 500:
        return jsonify({"error": "Batch limit is 500 rows"}), 400

    col = next((c for c in df.columns if c.lower() in
                ("name", "hgvs", "variant", "variant_name")), None)
    if col is None:
        return jsonify({"error": "CSV needs a 'name' column of HGVS variant "
                                 "descriptions"}), 400

    rows = []
    for i, raw in enumerate(df[col].astype(str)):
        try:
            r = MODEL.predict({"name": raw}, explain=False)
            rows.append({
                "row": i + 1, "name": raw,
                "gene": r["annotation"]["gene"],
                "consequence": r["annotation"]["consequence"],
                "prediction": r["prediction"],
                "pathogenic_probability": r["pathogenic_probability"],
                "conformal": r["conformal"]["status"],
                "uncertainty": r["uncertainty"]["flag"],
            })
        except Exception as exc:                    # noqa: BLE001
            rows.append({"row": i + 1, "name": raw, "error": str(exc)[:120]})
    return jsonify({"total": len(rows), "results": rows})


@app.get("/")
@app.get("/<path:path>")
def spa(path: str = ""):
    """Serve built assets, and fall back to index.html so client routes work."""
    if not (DIST / "index.html").exists():
        return jsonify({"error": "Front end not built. Run `npm run build` in web/."}), 404
    if path:
        candidate = (DIST / path).resolve()
        if candidate.is_file() and candidate.is_relative_to(DIST.resolve()):
            return send_from_directory(DIST, path)
    return send_from_directory(DIST, "index.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False)
