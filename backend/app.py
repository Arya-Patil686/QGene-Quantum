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

import pandas as pd

from core import QGene
from platform_core import Platform

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "web" / "dist"
DATA = ROOT / "backend" / "data"

# static_folder is left unset on purpose: with static_url_path="" Flask's own
# static route registers as /<path:filename> and shadows the SPA catch-all
# below, so deep links such as /predict would 404 instead of loading the app.
app = Flask(__name__, static_folder=None)
CORS(app)

print("loading model bundles ...")
_t0 = time.time()
PLATFORM = Platform()
print(f"  {len(PLATFORM.pipelines)} dataset pipelines: "
      f"{', '.join(PLATFORM.pipelines)}")
MODEL = QGene()
# Build the SHAP explainer up front; otherwise the first request pays for it.
MODEL.predict({"name": "NM_007294.4(BRCA1):c.181T>G (p.Cys61Gly)"})
print(f"ready in {time.time() - _t0:.1f}s")

_METRICS = json.loads((DATA / "metrics.json").read_text())
_PLATFORM = json.loads((DATA / "platform.json").read_text())
_VUS = json.loads((DATA / "vus_scored.json").read_text()) if (DATA / "vus_scored.json").exists() else {"variants": []}
_EXAMPLES = json.loads((DATA / "examples.json").read_text()) if (DATA / "examples.json").exists() else []

# Uploaded tables live in memory only, for the duration of the process.
_UPLOADS: dict[str, "pd.DataFrame"] = {}


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


# ---------------------------------------------------------------------------
# platform: many diseases, one pipeline
# ---------------------------------------------------------------------------

@app.get("/api/platform")
def platform_overview():
    """Catalogue and headline benchmark for every bundled dataset."""
    slim = {
        "generated": _PLATFORM["generated"],
        "order": _PLATFORM["order"],
        "catalogue": _PLATFORM["catalogue"],
        "comparison": _PLATFORM["comparison"],
    }
    return jsonify(slim)


@app.get("/api/platform/<dataset_id>")
def platform_dataset(dataset_id: str):
    rec = _PLATFORM["datasets"].get(dataset_id)
    if rec is None:
        return jsonify({"error": f"unknown dataset {dataset_id}"}), 404
    return jsonify(rec)


@app.get("/api/platform/<dataset_id>/schema")
def platform_schema(dataset_id: str):
    try:
        return jsonify(PLATFORM.get(dataset_id).schema())
    except KeyError:
        return jsonify({"error": f"unknown dataset {dataset_id}"}), 404


@app.post("/api/platform/<dataset_id>/predict")
def platform_predict(dataset_id: str):
    try:
        pipe = PLATFORM.get(dataset_id)
    except KeyError:
        return jsonify({"error": f"unknown dataset {dataset_id}"}), 404
    body = request.get_json(silent=True) or {}
    threshold = float(body.get("threshold", 0.5))
    try:
        return jsonify(pipe.predict(body.get("values", {}), threshold=threshold,
                                    explain=body.get("explain", True)))
    except Exception as exc:                               # noqa: BLE001
        return jsonify({"error": f"could not score that row: {exc}"}), 400


# ---------------------------------------------------------------------------
# studio: upload a dataset and train the same stack on it
# ---------------------------------------------------------------------------

def _read_upload(file_storage) -> pd.DataFrame:
    raw = file_storage.read()
    if len(raw) > 8 * 1024 * 1024:
        raise ValueError("file is larger than 8 MB")
    return pd.read_csv(io.BytesIO(raw))


@app.post("/api/studio/profile")
def studio_profile():
    """Inspect an uploaded table: columns, missingness, candidate targets."""
    if "file" not in request.files:
        return jsonify({"error": "attach a CSV under the 'file' field"}), 400
    try:
        df = _read_upload(request.files["file"])
    except Exception as exc:                               # noqa: BLE001
        return jsonify({"error": f"could not read the CSV: {exc}"}), 400
    if len(df) > 20000:
        df = df.sample(20000, random_state=0)
    _UPLOADS[request.form.get("id", "last")] = df
    profile = PLATFORM.profile(df)
    profile["id"] = request.form.get("id", "last")
    return jsonify(profile)


@app.post("/api/studio/train")
def studio_train():
    """Run the full hybrid pipeline on the uploaded table."""
    body = request.get_json(silent=True) or {}
    key = body.get("id", "last")
    df = _UPLOADS.get(key)
    if df is None:
        return jsonify({"error": "upload a file first"}), 400
    target = body.get("target")
    if not target:
        return jsonify({"error": "choose a target column"}), 400
    try:
        result = PLATFORM.train_uploaded(
            df, target=target,
            name=body.get("name", "Uploaded dataset"),
            n_qubits=int(body.get("n_qubits", 6)))
    except Exception as exc:                               # noqa: BLE001
        return jsonify({"error": str(exc)}), 400
    return jsonify(result)


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
