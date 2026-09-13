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
# --am: THE HALF THIS SCRIPT USED TO MISS
#
# This script applies with `git apply`, which takes the DIFF and discards the
# commit messages that came with it. So the sequence that actually gets run by
# hand is `git am`, which keeps them — and `git am` knows nothing about the
# uploaded file still sitting tracked at the root, because the web UI committed
# it before anything was applied. verify:hygiene then fails, on a tree that is
# otherwise completely correct. That has now happened twice in a row, on two
# consecutive patches, for exactly the same reason.
#
# `--am` is the whole sequence: apply the commits with their messages, then
# untrack and delete the artifact in one follow-up commit. Nothing is weakened
# — verify:hygiene still fails on a stray patch at the root, because it should.
# This just stops producing one.
#
# USAGE
#
#   bash scripts/patch-apply.sh --am            # git am every uploaded patch, then untrack it
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
AM_MODE=0
EXPLICIT=0
FILES=()
for a in "$@"; do
  case "$a" in
    --check) CHECK_ONLY=1 ;;
    --am) AM_MODE=1 ;;
    -*) echo "unknown option: $a"; exit 2 ;;
    *) FILES+=("$a"); EXPLICIT=1 ;;
  esac
done

if [ "$AM_MODE" = 1 ] && [ "$CHECK_ONLY" = 1 ]; then
  echo "--am and --check are mutually exclusive: --am commits, --check changes nothing."
  exit 2
fi

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

if [ "$AM_MODE" = 1 ]; then
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    echo '✗ The working tree has uncommitted changes. git am refuses to run on one,'
    echo "  and half-applying a series onto dirty state is how a patch gets blamed for"
    echo "  a conflict it did not cause. Commit or stash first."
    exit 1
  fi

  # Untrack any envelope whose CONTENT is already in the tree, whether or not
  # it is one we were asked to apply.
  #
  # NOT subject matching. The first version of this read `Subject:` out of the
  # mbox and compared it to the log — and git RFC2047-encodes any subject with
  # a non-ASCII character in it, which every subject in this series has, and
  # wraps it across lines. Every comparison silently found nothing, the stale
  # VIS-05 envelope was replayed on top of a tree that already had it, and the
  # error blamed the newest patch for a conflict the oldest one caused.
  # `git apply --reverse --check` reads the DIFF and ignores the headers, which
  # is the same mechanism the non-am path below has always used.
  am_already_applied() { git apply --reverse --check "$1" >/dev/null 2>&1; }

  am_untrack() {
    if git ls-files --error-unmatch "$1" >/dev/null 2>&1; then
      git rm -q --cached "$1"; rm -f "$1"
      git commit -q -m "chore(hygiene): drop $1 from the repo root

A patch is a transport format. It arrived as a GitHub web upload, which
commits the file rather than applying it and does not consult .gitignore,
so it was tracked before the change it carries was ever applied. The
history has the change; this removes the envelope it came in.

Untracked by scripts/patch-apply.sh --am."
      echo "     untracked, removed, committed"
    else
      rm -f "$1"
      echo "     removed (was not tracked)"
    fi
  }

  # Split what we found into "already in the tree" and "still to apply".
  PENDING=()
  for f in "${FILES[@]}"; do
    [ -f "$f" ] || continue
    if am_already_applied "$f"; then
      echo "── $f"
      echo "     ALREADY IN THE TREE (reverse-check passes)"
      am_untrack "$f"
    else
      PENDING+=("$f")
    fi
  done

  # REFUSE TO GUESS. Two unapplied envelopes at once is the situation that
  # produced the conflict above: a series can contain a commit that an older
  # envelope also carries, and applying them in name order replays it. Which
  # one is authoritative is not something this script can know.
  if [ "${#PENDING[@]}" -gt 1 ] && [ "$EXPLICIT" = 0 ]; then
    echo
    echo "✗ More than one unapplied patch is present:"
    printf '     %s\n' "${PENDING[@]}"
    echo
    echo "  Refusing to guess the order. A newer series often re-carries an"
    echo "  older one's commits, and applying both replays them. Name the one"
    echo "  you want:"
    echo
    echo "      bash scripts/patch-apply.sh --am ${PENDING[*]: -1}"
    exit 2
  fi

  AM_OK=0
  for f in "${PENDING[@]}"; do
    echo "── $f"
    if git am "$f"; then
      echo "     applied, with its commit messages"
      AM_OK=$((AM_OK + 1))
    else
      git am --abort 2>/dev/null || true
      echo
      echo "     ✗ git am FAILED and was aborted. The tree is unchanged."
      echo "       Most likely the base drifted — ask for a regenerated patch"
      echo "       against $(git rev-parse --short HEAD)."
      exit 1
    fi
    am_untrack "$f"
  done

  # An envelope can only be cleaned once its own content is in the tree, so any
  # that were stacked behind this one are cleanable now.
  for f in $(git ls-files '*.patch'; ls -1 ./*.patch 2>/dev/null | sed 's|^\./||'); do
    [ -f "$f" ] || continue
    if am_already_applied "$f"; then echo "── $f"; echo "     now in the tree"; am_untrack "$f"; fi
  done

  echo
  echo "applied=$AM_OK"
  git --no-pager log --oneline "@{u}..HEAD" 2>/dev/null || git --no-pager log --oneline -3
  echo
  git status --short
  cat <<'NEXT'

Now verify, then push:

  pnpm install
  pnpm --filter @ecowoods/web exec prisma generate     # MUST precede tsc
  pnpm --filter @ecowoods/web exec tsc --noEmit
  pnpm verify
  node audit/scripts/parse-scan.mjs                    # expect zero diagnostics
  git push origin main
NEXT
  exit 0
fi

APPLIED=0
SKIPPED=0
FAILED=0

IDX=0
for f in "${FILES[@]}"; do
  IDX=$((IDX + 1))
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
  elif [ "$CHECK_ONLY" = 1 ] && [ "$IDX" -gt 1 ]; then
    # A dry run cannot validate a STACK. Patch N+1 is generated against the tree
    # patch N produces, so checking it against the current tree reports a failure
    # that is not one — which is exactly what happened with 36 and 37, and sent
    # a real, correct patch back for regeneration. Say so instead of lying.
    echo "     cannot dry-run: this patch is stacked on one not yet applied"
    echo "       Run without --check to apply the stack in order."
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
