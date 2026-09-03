# QGene — reproducible pipeline
#
#   make setup    create the virtualenv and install everything
#   make data     download ClinVar and build the leak-free dataset
#   make platform train every bundled dataset through the hybrid pipeline
#   make train    the genomics deep-dive (leakage demo, stratified evaluation)
#   make vus      score every unresolved variant
#   make web      build the front end
#   make serve    run the API + built front end on :5001
#   make all      data -> train -> vus -> web

PY := .venv/bin/python
PIP := .venv/bin/pip

.PHONY: setup data platform train vus report web serve all dev clean

setup:
	python3 -m venv .venv
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt
	cd web && npm install

# requirements.txt covers development and the offline pipeline;
# requirements-runtime.txt is the smaller set the container installs.

data:
	mkdir -p data/raw
	curl -sS "https://ftp.ncbi.nlm.nih.gov/pub/clinvar/tab_delimited/variant_summary.txt.gz" \
	  | gunzip -c \
	  | awk -F'\t' 'NR==1 || $$5=="BRCA1" || $$5=="BRCA2"' \
	  > data/raw/clinvar_brca_raw.tsv
	$(PY) ml/build_dataset.py

platform:
	$(PY) ml/train_platform.py

train:
	$(PY) ml/train.py

vus:
	$(PY) ml/score_vus.py

report:
	$(PY) scripts/make_report.py
	$(PY) scripts/make_platform_report.py

web:
	cd web && npm run build

serve:
	$(PY) backend/app.py

dev:
	cd web && npm run dev

all: data train vus platform report web

clean:
	rm -rf data/processed backend/models/*.joblib web/dist
