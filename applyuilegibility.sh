#!/usr/bin/env bash
#
# apply-ui-legibility.sh — land the UI legibility patch, once, safely.
#
# WHY THIS IS A SCRIPT AND NOT A LIST OF COMMANDS TO PASTE
#
# Four times now a pasted block has failed at line two and kept going: a
# `checkout -b` on a branch that already existed (F-152), a wrong argument to
# prepare-illustrations.sh, a `tsc` line the terminal merged with its neighbour,
# and now a `git pull` that could not update a ref, leaving $PATCH empty so
# `git apply ''` failed and `git am` never ran behind the `&&`.
#
# Every one of those was invisible inside a few hundred lines of scrollback.
# `set -euo pipefail` makes the shell stop where a human did not.
#
# The script deletes itself when it has run — it is a one-off, and step 5
# explains why leaving it in the repository would fail the hygiene guard. If you
# need it again, re-upload it: every step checks its own precondition, so a
# second run repairs whatever is missing and skips whatever is already done.
#
#   bash apply-ui-legibility.sh
#
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
BRANCH=fix/ui-legibility
say() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }

# ── 1. the broken remote-tracking ref ────────────────────────────────────────
# "cannot lock ref 'refs/remotes/origin/main': is at X but expected Y" means the
# loose ref and packed-refs disagree about where origin/main is. The tracking ref
# is only a local cache of the remote's position — deleting it cannot lose a
# commit, and the next fetch rebuilds it. Verified before this was written.
say "Repairing the remote-tracking ref"
git update-ref -d refs/remotes/origin/main 2>/dev/null || true
git fetch origin --prune --quiet
echo "  origin/main = $(git rev-parse --short origin/main)"

# ── 2. a clean tree, then main ───────────────────────────────────────────────
if [ -n "$(git status --porcelain)" ]; then
  echo "✗ working tree is not clean. Commit or stash first:"; git status --short; exit 1
fi
say "Updating main"
git switch --quiet main
git merge --ff-only origin/main --quiet
echo "  main = $(git log --oneline -1)"

# ── 3. rescue the patch BEFORE removing it from the repo ─────────────────────
say "Locating the patch"
PATCH=$(ls -t -- *ui*legibility*.patch *uilegibility*.patch 2>/dev/null | head -1 || true)
if [ -z "${PATCH:-}" ]; then
  echo "✗ no patch file at the repository root."
  echo "  Upload it to main through the GitHub UI, then run this again. Present now:"
  ls -1 -- *.patch 2>/dev/null || echo "  (no .patch files at all)"
  exit 1
fi
echo "  found: $PATCH"
cp -- "$PATCH" /tmp/ui-legibility.patch
echo "  copied to /tmp/ui-legibility.patch — the repo copy is about to be deleted"

# ── 4. the branch. Idempotent, unlike `checkout -b`. ─────────────────────────
say "Switching to $BRANCH"
git switch --quiet -c "$BRANCH" 2>/dev/null || git switch --quiet "$BRANCH"
CUR=$(git branch --show-current)
[ "$CUR" = "$BRANCH" ] || { echo "✗ on '$CUR', expected '$BRANCH'"; exit 1; }
echo "  on $CUR"

# ── 5. the uploaded one-off files do not belong in the repository ────────────
# scripts/verify-repo-hygiene.mjs fails on both the patch and this script,
# correctly. A committed patch is a frozen duplicate of changes the history
# already has, carried by every clone forever; a one-off apply script has done
# its job the moment it runs. GitHub's web upload does not honour .gitignore,
# and .gitignore never applies to a file already tracked, which is why the rule
# alone was never enough and the guard had to exist.
#
# This script deletes ITSELF here, before the verify step that would otherwise
# flag it. Unlinking a running script is safe on Linux: bash holds an open file
# descriptor and the inode survives until it exits.
say "Removing the uploaded one-off files from the repository"
SELF=$(basename -- "$0")
REMOVED=()
for f in "$PATCH" "$SELF"; do
  [ -e "$f" ] || continue
  if git ls-files --error-unmatch -- "$f" >/dev/null 2>&1; then
    git rm --quiet -- "$f"; REMOVED+=("$f"); echo "  untracked and deleted: $f"
  else
    rm -f -- "$f"; echo "  deleted (was untracked): $f"
  fi
done
if [ ${#REMOVED[@]} -gt 0 ]; then
  git commit --quiet -m "chore: remove uploaded one-off files from the repository root

A patch is a transport format and an apply script is a one-off; neither is
source. GitHub's web upload does not honour .gitignore, and .gitignore never
applies to a file already tracked, so scripts/verify-repo-hygiene.mjs is the
only place this can actually be enforced."
  echo "  committed"
fi

# ── 6. apply ─────────────────────────────────────────────────────────────────
say "Applying"
if git log --oneline origin/main..HEAD | grep -qi 'legibility defects'; then
  echo "  already applied on this branch — skipping"
else
  git apply --check --verbose /tmp/ui-legibility.patch
  git am --3way < /tmp/ui-legibility.patch
  echo "  applied: $(git log --oneline -1)"
fi

# ── 7. verify ────────────────────────────────────────────────────────────────
say "Verifying — expect 39 green, verify:ui second"
pnpm verify

say "Done. Nothing has been pushed."
cat <<NEXT

  Review:   git log --oneline origin/main..HEAD
            git show --stat HEAD

  Build:    pkill -f tsserver; pkill -f cloudcode; pkill -f copilot
            NODE_OPTIONS=--max-old-space-size=3072 pnpm --filter web build

  Ship:     git push -u origin $BRANCH
            gh pr create --title "Three legibility defects on commercial pages, and the guard that finds them" \\
              --body "F-153 caption overlap on every IllustrationPair. F-154 .gd-spec grey slab at 2.29:1 on all sixteen guides and four commercial pages. F-155 ninety-six service-area links at 1.04:1 on the money pages. Plus verify-ui-contract. 39 guards green."
            gh pr merge --squash --delete-branch

NEXT
