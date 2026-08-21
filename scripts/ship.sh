#!/usr/bin/env bash
#
# scripts/ship.sh — apply, verify, COMMIT, PUSH, and prove it landed.
#
# WHY THIS EXISTS
#
# Patches 23, 24, 25 and 26 were each applied in Codespaces, each verified, each
# built green — and none of them was ever committed. All four sat as tracked
# .patch files in the repo root while origin/main stayed on be6262b, the last
# commit that actually contains code. ecowoods.ca served that build for days.
#
# The failure was never the patch. It was that "the build is green" felt like
# the end of the sequence, and `git commit && git push` was a separate block
# further down the page that did not get run.
#
# So this is one command that either finishes or stops with a loud error, and
# whose last step reads origin/main over the network rather than trusting a
# local working tree. A green local tree is exactly what has been misleading.
#
# Usage:
#   bash scripts/ship.sh "commit subject"     apply + verify + commit + push
#   bash scripts/ship.sh --check              stop after verification
#
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

CHECK_ONLY=0
SUBJECT="${1:-}"
[ "${1:-}" = "--check" ] && { CHECK_ONLY=1; SUBJECT=""; }

step() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }
die()  { printf '\n\033[31m✗ %s\033[0m\n\n' "$1" >&2; exit 1; }

# ── 1. clean base ─────────────────────────────────────────────────────────
step "1/7  syncing with origin/main"
git fetch -q origin
git checkout -q main
git reset --hard -q origin/main

# `git reset --hard` moves tracked files ONLY. Untracked files survive it, and
# a patch that ADDS a file fails with "already exists in working directory"
# against leftovers from an earlier apply that was never committed. That is
# exactly how 24, 25 and 26 failed after a reset that looked clean.
#
# `git clean -fd` never touches ignored paths, so node_modules, .next and .env*
# are all safe — every one of them is in .gitignore.
LEFTOVER="$(git clean -nd | sed 's/^Would remove /       /')"
if [ -n "$LEFTOVER" ]; then
  echo "     removing untracked leftovers from a previous apply:"
  echo "$LEFTOVER"
  git clean -qfd
fi

# .next is gitignored, so neither reset nor clean touches it. Stale route types
# from a previous build survive into a tree where those routes no longer exist,
# and step 4 then fails typechecking a cache instead of the code. See F-87.
rm -rf apps/web/.next/types

[ -z "$(git status --porcelain)" ] || die "Tree still not clean after reset + clean. Inspect: git status"
echo "     HEAD $(git log -1 --format='%h  %s')"

# ── 1b. binary assets that a patch cannot carry ───────────────────────────
# Step 1 removes every untracked file, which is correct and once cost this
# project its entire illustration set. The images were generated locally from a
# zip, never committed, wiped by the reset here, and then deployed WITHOUT them —
# every diagram on the live site became a broken-image icon while every guard
# passed, because the code and the files were never in one tree at one commit.
#
# The real fix is that the images are tracked now, so nothing can remove them.
# This is the belt: if a slot is published and its file is missing but the source
# zip is sitting here, rebuild it rather than shipping a page full of 404s.
if [ -f scripts/prepare-illustrations.sh ] && ls ./ecowoods-illustrations-*.zip >/dev/null 2>&1; then
  if ! node scripts/verify-images.mjs >/dev/null 2>&1; then
    step "1b/7  rebuilding illustrations from the uploaded zip"
    bash scripts/prepare-illustrations.sh "$(ls ./ecowoods-illustrations-*.zip | head -1)" | tail -2
  fi
fi

# ── 2. apply whatever arrived by upload ───────────────────────────────────
step "2/7  applying uploaded patches"
if ls ./*.patch >/dev/null 2>&1; then
  bash scripts/patch-apply.sh
else
  echo "     (none — nothing uploaded)"
fi

if [ -z "$(git status --porcelain)" ]; then
  die "Nothing changed. Either no patch was uploaded, or it was already applied
       and committed. Check: git log --oneline -3"
fi

# ── 3-6. verification, in the order that matters ──────────────────────────
step "3/7  install + prisma generate"
pnpm install --silent
pnpm --filter @ecowoods/web exec prisma generate >/dev/null

step "4/7  typecheck"
pnpm --filter @ecowoods/web exec tsc --noEmit

step "5/7  guards"
pnpm verify

step "6/7  production build + parse scan"
pnpm --filter @ecowoods/web build >/dev/null
node audit/scripts/parse-scan.mjs

if [ "$CHECK_ONLY" = 1 ]; then
  printf '\n\033[32m✓ verified — nothing committed (--check)\033[0m\n\n'
  exit 0
fi
[ -n "$SUBJECT" ] || die "Give a commit subject:  bash scripts/ship.sh \"feat: …\""

# ── 7. commit, push, and PROVE IT ─────────────────────────────────────────
step "7/7  commit and push"
git add -A
git commit -q -m "$SUBJECT"
git push -q origin main
echo "     pushed $(git log -1 --format='%h  %s')"

step "proof — reading origin/main over the network, not this tree"
git fetch -q origin
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/main)"
[ "$LOCAL" = "$REMOTE" ] || die "HEAD ${LOCAL:0:9} != origin/main ${REMOTE:0:9} — the push did not land."

REMOTE_PATCHES="$(git ls-tree -r --name-only origin/main | grep -c '\.patch$' || true)"
printf '     %-34s %s\n' "origin/main" "$(git log -1 --format='%h  %s' origin/main)"
printf '     %-34s %s\n' "tracked .patch files on main" "$REMOTE_PATCHES  (want 0)"
[ "$REMOTE_PATCHES" = 0 ] || die "Patch files are still tracked on main. They will be replayed on the next run.
       git rm --cached *.patch && git commit && git push"

printf '\n\033[32m✓ on origin/main.\033[0m\n'
printf '  Deploy NOW, and only because this succeeded:\n\n'
printf '    vercel --prod\n\n'
# Why the emphasis: `bash ship.sh ... ` and `vercel --prod` on two lines of a
# pasted block are two independent commands. When this script exits non-zero the
# shell runs vercel anyway, and a half-applied tree goes to production. That is
# exactly how a deploy went out with the illustration code and none of the
# illustration files. Chain them with && or read this line before pasting.
printf '  Then verify live, with a cache-buster:\n'
printf '    curl -s -o /dev/null -w "%%{http_code}\\n" "https://ecowoods.ca/papers?cb=$(date +%%s)"\n\n'
