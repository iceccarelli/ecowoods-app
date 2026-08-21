#!/usr/bin/env bash
#
# scripts/prepare-illustrations.sh — turn the delivered art into what ships.
#
# WHY THIS IS A SCRIPT AND NOT A README STEP
#
# The manifest carries an intrinsic width and height for every image, and
# verify-images.mjs reads the files on disk and fails when one disagrees. That
# only works if the files are produced the same way every time — so the
# transformation is code, not instructions someone follows approximately.
#
# WHAT IT DOES, AND WHY EACH STEP EARNS ITS PLACE
#
#   1. TRIM. The delivered art was uniformly 1600x900, but the drawing inside it
#      was not: mean fill 52%, and failure-cupping used 21% of its frame. At a
#      fixed 16:9 box that empty margin renders as page, so a cross-section shown
#      1000px wide drew its content at a fraction of that. Trimming to content
#      and letting each diagram carry its own aspect ratio put pillar-substrate
#      from 32% fill to ~90% — same layout width, ~2.5x the drawn detail.
#
#   2. RE-BORDER. A uniform margin back on all four sides, so 23 differently
#      shaped diagrams still share one visual rhythm. Wider vertically (8%) than
#      horizontally (4%) because most of these are wide strips and an equal
#      margin reads as too tight top and bottom.
#
#   3. RECOMPRESS at q88. The delivered files averaged 435 KB — roughly ten times
#      what flat vector art on a plain ground needs. 12.1 MB becomes ~720 KB with
#      a measured mean difference of 0.4% per channel. next/image re-encodes on
#      delivery anyway; this is about what every clone of this repo carries
#      permanently.
#
# The five og-* cards are recompressed but NEVER trimmed: social platforms
# require 1200x630 and will letterbox or crop anything else.
#
#   bash scripts/prepare-illustrations.sh ecowoods-illustrations-28.zip
#
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

ZIP="${1:-ecowoods-illustrations-28.zip}"
OUT="apps/web/public/illustrations"
BG='#faf6ef'   # --cream-50, the ground every prompt specified

for cmd in unzip convert cwebp identify; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "missing: $cmd"
    echo "  apt-get update -qq && apt-get install -y -qq webp imagemagick unzip"
    exit 2
  }
done
[ -f "$ZIP" ] || { echo "not found: $ZIP"; exit 2; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
unzip -q -o "$ZIP" -d "$TMP"

SRC="$TMP/illustrations"
[ -d "$SRC" ] || SRC="$TMP"
mkdir -p "$OUT"

n=0
for f in "$SRC"/*.webp; do
  [ -e "$f" ] || continue
  base="$(basename "$f")"
  id="${base%.webp}"
  case "$id" in
    og-*)
      cwebp -quiet -q 88 -m 6 "$f" -o "$OUT/$base"
      ;;
    *)
      convert "$f" \
        -bordercolor "$BG" -fuzz 6% -trim +repage \
        -bordercolor "$BG" -border 4%x8% \
        -quality 88 -define webp:method=6 "$OUT/$base"
      ;;
  esac
  n=$((n + 1))
  printf '  %-34s %s\n' "$id" "$(identify -format '%wx%h' "$OUT/$base")"
done

echo
echo "$n file(s) -> $OUT  ($(du -sh "$OUT" | cut -f1))"
echo "Now: node scripts/verify-images.mjs"
