#!/usr/bin/env bash
# Re-download the bundled benchmark datasets from their original sources.
#
# The four small files the loaders read are committed, so this is only needed
# to verify provenance or refresh them. The Wisconsin breast cancer set ships
# with scikit-learn and needs no download.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/data/bundled"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$OUT/heart" "$OUT/parkinsons"

echo "UCI Heart Disease (Cleveland) ..."
curl -sL --max-time 120 -o "$TMP/heart.zip" \
  "https://archive.ics.uci.edu/static/public/45/heart+disease.zip"
unzip -oq "$TMP/heart.zip" -d "$TMP/heart"
cp "$TMP/heart/processed.cleveland.data" "$TMP/heart/heart-disease.names" "$OUT/heart/"

echo "UCI Parkinsons ..."
curl -sL --max-time 120 -o "$TMP/parkinsons.zip" \
  "https://archive.ics.uci.edu/static/public/174/parkinsons.zip"
unzip -oq "$TMP/parkinsons.zip" -d "$TMP/parkinsons"
cp "$TMP/parkinsons/parkinsons.data" "$TMP/parkinsons/parkinsons.names" "$OUT/parkinsons/"

echo "Pima Indians Diabetes ..."
curl -sL --max-time 120 -o "$OUT/pima_diabetes.csv" \
  "https://raw.githubusercontent.com/jbrownlee/Datasets/master/pima-indians-diabetes.data.csv"

echo "done — $(find "$OUT" -type f | wc -l | tr -d ' ') files in $OUT"
