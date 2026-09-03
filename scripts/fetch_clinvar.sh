#!/usr/bin/env bash
# Fetch the ClinVar variant_summary table and keep only BRCA1/BRCA2 rows.
#
# The archive is ~420 MB and a single connection to NCBI runs at a few hundred
# KB/s, so it is pulled as N parallel byte ranges and reassembled. NCBI will
# occasionally answer a ranged request with a short error page instead of the
# bytes, so every part is checked against its expected length and re-fetched
# until it matches. Completed parts are kept, so re-running resumes.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAW="$ROOT/data/raw"
GZ="$RAW/variant_summary.txt.gz"
OUT="$RAW/clinvar_brca_raw.tsv"
URL="https://ftp.ncbi.nlm.nih.gov/pub/clinvar/tab_delimited/variant_summary.txt.gz"
PARTS="${PARTS:-6}"
TRIES="${TRIES:-8}"

mkdir -p "$RAW/parts"

size_of() { stat -f%z "$1" 2>/dev/null || stat -c%s "$1" 2>/dev/null || echo 0; }

SIZE=$(curl -sI --max-time 60 "$URL" \
  | awk -F': ' 'tolower($1) == "content-length" { gsub(/\r/, "", $2); print $2; exit }')
[ -n "${SIZE:-}" ] || { echo "could not read Content-Length" >&2; exit 1; }
echo "archive is $((SIZE / 1048576)) MB; fetching in $PARTS parallel ranges"

CHUNK=$(( (SIZE + PARTS - 1) / PARTS ))

fetch_part() {
  local i=$1 start end want got
  start=$(( i * CHUNK ))
  end=$(( start + CHUNK - 1 ))
  [ "$end" -ge "$SIZE" ] && end=$(( SIZE - 1 ))
  want=$(( end - start + 1 ))
  local f="$RAW/parts/part.$i"

  if [ "$(size_of "$f")" = "$want" ]; then
    echo "  part $i already complete"
    return 0
  fi
  for attempt in $(seq 1 "$TRIES"); do
    rm -f "$f"
    curl -sS --connect-timeout 30 --speed-time 90 --speed-limit 2048 \
         -r "${start}-${end}" -o "$f" "$URL" || true
    got=$(size_of "$f")
    [ "$got" = "$want" ] && { echo "  part $i ok"; return 0; }
    echo "  part $i attempt $attempt returned $got of $want bytes, retrying"
    sleep $(( attempt * 3 ))
  done
  echo "part $i could not be fetched" >&2
  return 1
}

pids=()
for i in $(seq 0 $((PARTS - 1))); do
  fetch_part "$i" &
  pids+=($!)
done
status=0
for p in "${pids[@]}"; do wait "$p" || status=1; done
[ "$status" -eq 0 ] || { echo "one or more parts failed; re-run to resume" >&2; exit 1; }

cat "$RAW"/parts/part.* > "$GZ"
gunzip -t "$GZ" || { echo "archive failed integrity check" >&2; exit 1; }
rm -rf "$RAW/parts"

echo "filtering to BRCA1 / BRCA2 ..."
gunzip -c "$GZ" | awk -F'\t' 'NR==1 || $5=="BRCA1" || $5=="BRCA2"' > "$OUT"
echo "wrote $OUT ($(wc -l < "$OUT") rows)"
