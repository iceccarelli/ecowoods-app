#!/usr/bin/env bash
#
# scripts/patch-apply.sh
#
# Applies a .patch file that arrived in this repository by GitHub web upload,
# then untracks it.
#
# WHY THIS EXISTS
#
# Every patch in this series has been uploaded through the GitHub web UI, which
# commits the file to main instead of applying it — and which ignores
# .gitignore, so `*.patch` cannot prevent it. The instructions kept saying
# "put it in /tmp and run git apply", that directory never existed, `git apply`
# failed, and the rest of the sequence then ran against unchanged code and
# reported a green build for work that had not been applied. That happened five
# times. The upload path is the real delivery channel; this makes it a
# supported one instead of a recurring failure.
#
# NOT named apply-*.sh on purpose: .gitignore carries an `apply-*.sh` rule from
# the repo-hygiene cleanup, which would silently keep this file untracked.
#
# USAGE
#
#   bash scripts/patch-apply.sh                 # apply every uploaded patch, in name order
#   bash scripts/patch-apply.sh ECOWOODS_UX_02_x.patch
#   bash scripts/patch-apply.sh --check         # dry run, change nothing
#
# It is safe to re-run: an already-applied patch is detected and skipped rather
# than reported as a failure. That distinction matters — an already-applied
# patch fails `git apply` identically to a broken one.
#
set -uo pipefail

cd "$(git rev-parse --show-toplevel)"

CHECK_ONLY=0
FILES=()
for a in "$@"; do
  case "$a" in
    --check) CHECK_ONLY=1 ;;
    -*) echo "unknown option: $a"; exit 2 ;;
    *) FILES+=("$a") ;;
  esac
done

if [ "${#FILES[@]}" -eq 0 ]; then
  while IFS= read -r f; do FILES+=("$f"); done < <(git ls-files '*.patch' | sort)
  while IFS= read -r f; do
    case " ${FILES[*]-} " in *" $f "*) ;; *) FILES+=("$f") ;; esac
  done < <(ls -1 ./*.patch 2>/dev/null | sed 's|^\./||' | sort)
fi

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "No .patch files found at the repo root. Nothing to do."
  exit 0
fi

echo "▸ repo: $(pwd)"
echo "▸ HEAD: $(git rev-parse HEAD)"
echo "▸ patches: ${FILES[*]}"
echo

APPLIED=0
SKIPPED=0
FAILED=0

for f in "${FILES[@]}"; do
  echo "── $f"
  if [ ! -f "$f" ]; then echo "     missing on disk — skipping"; continue; fi

  if git apply --reverse --check "$f" >/dev/null 2>&1; then
    echo "     ALREADY APPLIED (reverse-check passes) — untracking only"
    SKIPPED=$((SKIPPED + 1))
  elif git apply --check "$f" >/dev/null 2>&1; then
    if [ "$CHECK_ONLY" = 1 ]; then
      echo "     would apply cleanly"
      continue
    fi
    git apply "$f" && echo "     applied" && APPLIED=$((APPLIED + 1))
  else
    echo "     ✗ DOES NOT APPLY. Most likely the base drifted."
    echo "       Ask for a regenerated patch against $(git rev-parse --short HEAD)."
    echo "       Diagnostics:"
    git apply --check "$f" 2>&1 | sed 's/^/         /' | head -12
    FAILED=$((FAILED + 1))
    continue
  fi

  if [ "$CHECK_ONLY" = 0 ]; then
    git rm -q --cached "$f" 2>/dev/null || true
    rm -f "$f"
    echo "     untracked and removed"
  fi
done

echo
echo "applied=$APPLIED  already-applied=$SKIPPED  failed=$FAILED"
[ "$CHECK_ONLY" = 1 ] && exit 0

if [ "$FAILED" -gt 0 ]; then
  echo
  echo "Stop here. Do not build or push while a patch failed to apply —"
  echo "the build will be green for code that was never changed."
  exit 1
fi

echo
git status --short
cat <<'NEXT'

Verify before you commit. All five, in this order:

  pnpm install
  pnpm --filter @ecowoods/web exec prisma generate     # MUST precede tsc
  pnpm --filter @ecowoods/web exec tsc --noEmit
  pnpm verify
  pnpm --filter @ecowoods/web build

  node audit/scripts/parse-scan.mjs                    # expect zero diagnostics
NEXT
