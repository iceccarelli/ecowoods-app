#!/usr/bin/env bash
#
# integrate-batch2.sh — land both illustration batches, safely and idempotently.
#
# Batch A ships as `<id>.webp`; batch B ships as `<id>-b.webp`. Two files may
# never share a name: verify-images.mjs binds one manifest entry to one file and
# fails on any file it does not recognise.
#
#   bash integrate-batch2.sh <batchA.zip> <batchB.zip>
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

A="${1:?usage: integrate-batch2.sh <batchA.zip> <batchB.zip>}"
B="${2:?usage: integrate-batch2.sh <batchA.zip> <batchB.zip>}"
for f in "$A" "$B"; do [ -f "$f" ] || { echo "not found: $f"; exit 2; }; done

for cmd in unzip convert cwebp identify zip; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "missing: $cmd"
    echo "  sudo apt-get update -qq && sudo apt-get install -y -qq webp imagemagick unzip zip"
    exit 2
  }
done

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# ── Batch B is renamed BEFORE it reaches the trim pipeline, so the pipeline
#    stays the single transformation and nothing is renamed after measurement.
unzip -q -o "$B" -d "$TMP/braw"
SRC="$TMP/braw/illustrations"; [ -d "$SRC" ] || SRC="$TMP/braw"
mkdir -p "$TMP/bfix/illustrations"
for f in "$SRC"/*.webp; do
  b="$(basename "$f")"; cp "$f" "$TMP/bfix/illustrations/${b%.webp}-b.webp"
done
( cd "$TMP/bfix" && zip -q -r "$TMP/batchB-suffixed.zip" illustrations )

echo "── batch A ─────────────────────────────────────────────"
bash scripts/prepare-illustrations.sh "$A"
echo
echo "── batch B (suffixed -b) ───────────────────────────────"
bash scripts/prepare-illustrations.sh "$TMP/batchB-suffixed.zip"

echo
echo "── regenerating static imports ─────────────────────────"
node scripts/gen-illustration-imports.mjs

echo
echo "── the numbers the manifest must declare ───────────────"
for f in apps/web/public/illustrations/*.webp; do
  id="$(basename "${f%.webp}")"
  printf "  '%s': [%s],\n" "$id" "$(identify -format '%w, %h' "$f")"
done
