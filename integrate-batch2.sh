#!/usr/bin/env bash
#
# integrate-batch2.sh — land both illustration batches, and emit the manifest
# entries with dimensions MEASURED after the trim, never guessed.
#
#   bash integrate-batch2.sh                  # auto-discovers the two zips
#   bash integrate-batch2.sh A.zip B.zip      # or name them explicitly
#
# Batch A keeps `<id>.webp`. Batch B becomes `<id>-b.webp` BEFORE it reaches the
# trim pipeline, because verify-images.mjs binds one manifest entry to one file
# and fails on any file it does not recognise. Two files may never share a name.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
ROOT="$PWD"

for cmd in unzip zip convert cwebp identify node; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "missing: $cmd"
    echo "  apt-get update -qq && apt-get install -y -qq webp imagemagick unzip zip"
    exit 2
  }
done

# ── find the zips ────────────────────────────────────────────────────────────
if [ $# -eq 2 ]; then
  A="$1"; B="$2"
else
  mapfile -t FOUND < <(find "$ROOT" "$HOME" /tmp /workspaces -maxdepth 4 \
      \( -iname '*illustration*batch2*.zip' -o -iname '*illustrations*batch2*.zip' \) 2>/dev/null | sort -u)

  # DEDUPE BY CONTENT, NOT BY PATH.
  # The first version of this took the running maximum over whatever find
  # returned, and find returned four paths because the same two zips existed in
  # two places. The last large file then overwrote B, so batch A was processed
  # twice and every "-b" file was a byte-identical copy of its sibling — a
  # failure that produces a full, plausible, completely wrong result and would
  # only have been caught by someone comparing dimensions afterwards.
  # So: hash first, demand exactly two distinct payloads, and refuse to guess.
  declare -A BYHASH=()
  for f in "${FOUND[@]}"; do
    h="$(md5sum "$f" | cut -d' ' -f1)"
    [ -n "${BYHASH[$h]:-}" ] || BYHASH[$h]="$f"
  done
  UNIQ=("${BYHASH[@]}")

  if [ "${#UNIQ[@]}" -ne 2 ]; then
    echo "Need exactly 2 distinct zips; found ${#UNIQ[@]}."
    for f in "${UNIQ[@]:-}"; do
      [ -n "$f" ] && echo "  $(unzip -l "$f" | tail -1 | awk '{print $1}') bytes  $f"
    done
    echo
    echo "Name them explicitly:"
    echo "  bash integrate-batch2.sh <batchA.zip> <batchB.zip>"
    exit 2
  fi

  # The batch with the LARGER uncompressed payload is A — measured, not assumed:
  # A is the richer render set, B the flatter vector set. Filenames are not
  # trusted; these arrive renamed every time.
  s0=$(unzip -l "${UNIQ[0]}" | tail -1 | awk '{print $1}')
  s1=$(unzip -l "${UNIQ[1]}" | tail -1 | awk '{print $1}')
  if [ "$s0" -ge "$s1" ]; then A="${UNIQ[0]}"; B="${UNIQ[1]}"; else A="${UNIQ[1]}"; B="${UNIQ[0]}"; fi
fi

echo
echo "  A (keeps <id>.webp)     : $A"
echo "  B (becomes <id>-b.webp) : $B"
echo

[ "$(md5sum "$A" | cut -d' ' -f1)" != "$(md5sum "$B" | cut -d' ' -f1)" ] || {
  echo "REFUSING: A and B are the same archive. Every -b file would be a copy."
  exit 2
}

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

unzip -q -o "$B" -d "$TMP/braw"
SRC="$TMP/braw/illustrations"; [ -d "$SRC" ] || SRC="$TMP/braw"
mkdir -p "$TMP/bfix/illustrations"
for f in "$SRC"/*.webp; do
  b="$(basename "$f")"
  case "$b" in *-b.webp) cp "$f" "$TMP/bfix/illustrations/$b" ;;
                      *) cp "$f" "$TMP/bfix/illustrations/${b%.webp}-b.webp" ;; esac
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

# ── emit the manifest block, dimensions measured off disk ────────────────────
OUT="$ROOT/batch2-manifest-entries.txt"
{
  echo "/* DIMS — measured after the trim. Paste into the DIMS map in lib/images.ts. */"
  for f in apps/web/public/illustrations/*.webp; do
    id="$(basename "${f%.webp}")"
    printf "  '%s': [%s],\n" "$id" "$(identify -format '%w, %h' "$f")"
  done
} > "$OUT"

# ── prove the pairs are actually different pictures ─────────────────────────
same=0; pairs=0
for f in apps/web/public/illustrations/*-b.webp; do
  base="$(basename "${f%-b.webp}")"
  sib="apps/web/public/illustrations/${base}.webp"
  [ -f "$sib" ] || continue
  pairs=$((pairs+1))
  [ "$(md5sum "$f" | cut -d' ' -f1)" = "$(md5sum "$sib" | cut -d' ' -f1)" ] && {
    echo "  IDENTICAL: ${base} and ${base}-b are the same image"; same=$((same+1)); }
done
if [ "$same" -gt 0 ]; then
  echo "✗ $same of $pairs pair(s) identical — the wrong zip was processed twice."
  exit 1
fi
echo "  ✓ $pairs pair(s), every one a genuinely different image"

echo
echo "── done ────────────────────────────────────────────────"
echo "  files:      $(ls apps/web/public/illustrations/*.webp | wc -l) in apps/web/public/illustrations"
echo "  dimensions: $OUT"
echo
echo "  Next:  1. paste the DIMS lines into apps/web/lib/images.ts"
echo "         2. add the 44 slot definitions (d()/p() calls) + HREFS"
echo "         3. node scripts/verify-images.mjs"
