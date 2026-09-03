#!/usr/bin/env bash
# Publish the platform to a Hugging Face Space (Docker SDK).
#
# Authentication comes from the Hugging Face CLI cache, so no token is ever
# passed on a command line. Log in once with:
#
#     .venv/bin/hf auth login --token <your write token>
#
# Then:  ./scripts/deploy_hf.sh <hf-username> [space-name]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USERNAME="${1:?usage: deploy_hf.sh <hf-username> [space-name]}"
SPACE="${2:-qgene}"
REPO="$USERNAME/$SPACE"
HF="$ROOT/.venv/bin/hf"

command -v "$HF" >/dev/null || { echo "hf CLI not found in .venv" >&2; exit 1; }
"$HF" auth whoami >/dev/null 2>&1 || {
  echo "not logged in — run: $HF auth login --token <write token>" >&2; exit 1; }

echo "creating or reusing space $REPO ..."
"$HF" repos create "$REPO" --type space --sdk docker --public >/dev/null 2>&1 || true

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

echo "staging the tracked tree ..."
git -C "$ROOT" archive HEAD | tar -x -C "$STAGE"

# Spaces read their configuration from README front matter.
cat "$ROOT/deploy/hf/README_header.md" "$ROOT/README.md" > "$STAGE/README.md"
cp "$ROOT/deploy/hf/Dockerfile" "$STAGE/Dockerfile"

# The web build happens inside the image, so the sources must be present.
rm -rf "$STAGE/web/node_modules" "$STAGE/web/dist"

echo "uploading to $REPO ..."
"$HF" upload "$REPO" "$STAGE" . --type space \
  --commit-message "Deploy QGene platform"

echo
echo "done — https://huggingface.co/spaces/$REPO"
echo "the Space will build the Docker image; first build takes a few minutes."
