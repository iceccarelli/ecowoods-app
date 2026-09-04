#!/usr/bin/env bash
# Ecowoods — consolidate everything into main, verify, push, delete every other branch.
# Upload ecowoods-main-final.bundle (28 KB, optional but exact) and this script to the repo root, then:
#   bash MERGE_TO_MAIN.sh
# Stops on the first failure; safe to re-run from the top.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "▸ 1/6 sync"
git fetch origin --prune
git am --abort 2>/dev/null || true
git checkout -q main
git reset -q --hard origin/main
git clean -fdq -e node_modules -e .env -e .env.local

if [ -f ecowoods-main-final.bundle ]; then
  echo "▸ 2/6 fast-forward main to the verified final tree (bundle: 3 commits, verified 50/50 + typecheck)"
  git bundle verify ecowoods-main-final.bundle
  git fetch ecowoods-main-final.bundle main:refs/bundles/main
  git merge --ff-only refs/bundles/main
  git update-ref -d refs/bundles/main
  rm -f ecowoods-main-final.bundle
  echo "▸ 3/6 (bundle already contains the merge, the Google patch and the root cleanup)"
else
  echo "▸ 2/6 merge the entity branch (verified clean, no conflicts)"
  git merge --no-ff origin/fix/entity-excellence-and-modernization -m "Merge fix/entity-excellence-and-modernization into main

One identity: Ecowoods Hardwood Flooring Inc. -> https://ecowoods.ca. /reviews rewritten,
machine files positive and sourced, HomeStars 2897115 wired, 66 legacy .md records retired,
README = live state 2026-09-04."

  echo "▸ 3/6 apply the Google Business Profile patch (already tracked at the repo root) and retire the transport files"
  git am --keep-cr ecowoods-gbp-live-2026-09-04.patch
  git rm -q --cached ecowoods-gbp-live-2026-09-04.patch ecowoodsgbplive20260904.patch
  rm -f ecowoods-gbp-live-2026-09-04.patch ecowoodsgbplive20260904.patch
  git commit -qm "chore: remove transport patch files from the repository root"
fi
test -z "$(ls *.patch 2>/dev/null)" || { echo "stray .patch at root"; exit 1; }

echo "▸ 4/6 verify + build (must be 50 ✓ and a green build)"
pnpm install --frozen-lockfile
pnpm verify
pnpm build

echo "▸ 5/6 push main"
git push origin main

echo "▸ 6/6 delete every other branch, local and remote"
for b in fix/entity-excellence-and-modernization mount-sliders proof-sliders; do
  git push origin --delete "$b" 2>/dev/null || true
  git branch -D "$b" 2>/dev/null || true
done
git fetch origin --prune
git branch -a
echo
rm -f MERGE_TO_MAIN.sh
echo "✓ main is the only branch. $(git log --oneline -1)"

# After Vercel deploys main:
#   pnpm notify:indexnow
#   pnpm seo:domain   # turns green once old-domain/.htaccess is uploaded to the ecowoodshardwood.com Apache root
