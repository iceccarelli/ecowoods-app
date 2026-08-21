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
#
# BUT NOT THE PATCHES. `git clean -fd` removes every untracked file, and a
# .patch that has just been uploaded and not yet committed is an untracked file.
# Patch 53 was deleted by this line, seconds before step 2 went looking for
# patches to apply and found none of it. -e excludes a pattern from the clean.
LEFTOVER="$(git clean -nd -e '*.patch' | sed 's/^Would remove /       /')"
if [ -n "$LEFTOVER" ]; then
  echo "     removing untracked leftovers from a previous apply:"
  echo "$LEFTOVER"
  git clean -qfd -e '*.patch'
fi

# A patch that survived the clean but is not tracked would be invisible to
# patch-apply.sh's `git ls-files '*.patch'` half. Say what is on disk, so a
# patch that is present is seen to be present before anything is applied.
ON_DISK="$(ls -1 ./*.patch 2>/dev/null | sed 's|^\./||' | tr '\n' ' ')"
echo "     patches on disk: ${ON_DISK:-none}"

# .next is gitignored, so neither reset nor clean touches it. Stale route types
# from a previous build survive into a tree where those routes no longer exist,
# and step 4 then fails typechecking a cache instead of the code. See F-87.
rm -rf apps/web/.next/types

# Uploaded patches are deliberately left in place above, so they are excluded
# from this assertion rather than being allowed to fail it.
DIRTY="$(git status --porcelain | grep -v '\.patch$' || true)"
[ -z "$DIRTY" ] || die "Tree still not clean after reset + clean. Inspect: git status"
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

# ── 2b. did any CODE change? ──────────────────────────────────────────────
#
# This is the check that was missing, and its absence cost a whole patch.
#
# patch-apply.sh untracks a .patch file once it has been applied — including one
# that was applied on a previous run, which it detects and correctly skips. That
# untracking is a change to the working tree. So `git status --porcelain` came
# back non-empty, this guard passed, and the run continued with a tree
# containing three deleted .patch files and not one line of new code.
#
# Everything downstream then did exactly what it was built to do. pnpm install
# succeeded. tsc passed. Fourteen guards passed — they were reading main's own
# code, which had of course already passed them. next build was green.
# parse-scan was clean. Step 7 committed, pushed, and PROVED THE PUSH LANDED,
# because it had: commit 6e3cc7a, "feat(crawlers): serve the IndexNow key, fix
# the PWA icons, emit HowTo", 3 files changed, 1517 deletions, 0 insertions.
#
# Every single step reported success. The site got nothing. See F-140.
#
# A .patch file moving is bookkeeping. Code moving is the point. They are
# counted separately from here on.
CODE_CHANGED="$(git status --porcelain | grep -v '\.patch$' || true)"
BOOKKEEPING="$(git status --porcelain | grep '\.patch$' || true)"

if [ -z "$CODE_CHANGED$BOOKKEEPING" ]; then
  die "Nothing changed at all. Either no patch was uploaded, or it was already
       applied and committed. Check: git log --oneline -3"
fi

if [ -z "$CODE_CHANGED" ]; then
  printf '\n'
  echo "$BOOKKEEPING" | sed 's/^/       /'
  die "ONLY .patch FILES MOVED — no code changed.

       Every patch above was already applied on main, so patch-apply.sh untracked
       them and nothing else happened. Shipping this would produce a commit of
       pure deletions that passes every check and delivers nothing. That is
       exactly what happened to patch 53 (F-140).

       If a patch you expected to apply is listed above as merely untracked, it
       is already on main — check with:  git log --oneline -5
       If a patch you uploaded is NOT listed at all, it never reached this tree."
fi

echo "     code files touched: $(echo "$CODE_CHANGED" | grep -c . )"
echo "$CODE_CHANGED" | sed 's/^/       /'

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

# ── the proof that was missing ────────────────────────────────────────────
#
# Everything above proves a push landed. A push of a commit containing three
# deletions and nothing else lands exactly as convincingly as a push of real
# work, and that is what shipped as patch 53 while every line of this script
# printed green. So read the commit that is now on origin/main and require that
# it changed something other than a .patch file.
SHIPPED="$(git show --stat --name-only --format='' origin/main | grep -v '^$' | grep -v '\.patch$' || true)"
SHIPPED_N="$(echo "$SHIPPED" | grep -c . || true)"
printf '     %-34s %s\n' "code files in this commit" "$SHIPPED_N  (want ≥1)"
if [ "$SHIPPED_N" -eq 0 ]; then
  die "THE COMMIT ON origin/main CONTAINS NO CODE.

       $(git log -1 --format='%h  %s' origin/main)
$(git show --stat --format='' origin/main | sed 's/^/       /')

       This is F-140 repeating. The push succeeded and delivered nothing.
       Do not deploy. Find the patch that was supposed to apply and check
       whether it is on disk:  ls -1 *.patch"
fi
echo "$SHIPPED" | sed 's/^/       /'

printf '\n\033[32m✓ on origin/main.\033[0m\n'
printf '  Deploy NOW, and only because this succeeded:\n\n'
printf '    vercel --prod && bash scripts/verify-live.sh && pnpm notify:indexnow\n\n'
printf '  The third step tells Bing, Yandex, Seznam and Naver that these URLs changed,\n'
printf '  now, instead of waiting to be crawled. It reads the key out of the repository\n'
printf '  rather than an env var, and it fails loudly on every condition that means\n'
printf '  nothing was submitted — the previous version read two sitemap URLs that do\n'
printf '  not exist and exited 0 for a year. See F-144.\n\n'
printf '  The second half is not optional. Fourteen guards read this repository and\n'
printf '  every one of them can pass while the deployed site is broken — that has now\n'
printf '  happened three times (F-107, F-129, F-131). verify-live.sh fetches the real\n'
printf '  site, pulls an image URL out of the rendered HTML, and asks whether the bytes\n'
printf '  come back. It is the only check here that can see a delivery failure.\n\n'
# Why the emphasis: `bash ship.sh ... ` and `vercel --prod` on two lines of a
# pasted block are two independent commands. When this script exits non-zero the
# shell runs vercel anyway, and a half-applied tree goes to production. That is
# exactly how a deploy went out with the illustration code and none of the
# illustration files. Chain them with && or read this line before pasting.
printf '  Then verify live, with a cache-buster:\n'
printf '    curl -s -o /dev/null -w "%%{http_code}\\n" "https://ecowoods.ca/papers?cb=$(date +%%s)"\n\n'
