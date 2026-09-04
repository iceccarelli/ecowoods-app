#!/usr/bin/env bash
# Ecowoods — bring main to the verified final tree, verify, push, delete every other branch.
#
# HOW TO RUN (Codespaces terminal, repo root):
#   1. Upload ecowoodsmainfinal.bundle and this script to the repo root (any filename is fine —
#      GitHub's uploader may strip hyphens; the script globs for *.bundle).
#   2. bash MERGE_TO_MAIN.sh
#
# Stops on the first failure; safe to re-run from the top. Every transport file
# (*.bundle, *.patch, this script) is removed from the tree and from git before verify.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# Run from a copy outside the tree: the tree is reset below, and this file may be tracked.
if [ "${ECOWOODS_MERGE_REEXEC:-}" != "1" ]; then
  cp "$0" /tmp/ecowoods-merge-to-main.sh
  ECOWOODS_MERGE_REEXEC=1 exec bash /tmp/ecowoods-merge-to-main.sh
fi

echo "▸ 1/6 sync"
git fetch origin --prune
git am --abort 2>/dev/null || true
git merge --abort 2>/dev/null || true
# Park the uploaded bundle outside the tree first — it may be a tracked file the final tree deletes.
BUNDLE=""
for f in *.bundle; do [ -e "$f" ] && { cp "$f" /tmp/ecowoods-final.bundle; BUNDLE=/tmp/ecowoods-final.bundle; break; }; done
git checkout -q main
git reset -q --hard origin/main
git clean -fdq -e node_modules -e .env -e .env.local

echo "▸ 2/6 bring in the verified final tree"
if [ -n "${BUNDLE}" ]; then
  git bundle verify "${BUNDLE}"
  git fetch -q "${BUNDLE}" main:refs/bundles/main
  if git merge --ff-only refs/bundles/main 2>/dev/null; then
    echo "   fast-forwarded main to $(git rev-parse --short refs/bundles/main)"
  else
    echo "   main moved since the bundle was cut — merging the bundle instead"
    git merge --no-ff refs/bundles/main -m "Merge verified final tree (entity excellence, Google Business Profile, review flywheel, error tracking)"
  fi
  git update-ref -d refs/bundles/main
  rm -f "${BUNDLE}"
else
  echo "   no *.bundle at the root — merging the pushed branch and applying the tracked patch instead"
  git merge --no-ff origin/fix/entity-excellence-and-modernization -m "Merge fix/entity-excellence-and-modernization into main"
  PATCH="$(ls -1 *gbp*.patch 2>/dev/null | head -n1 || true)"
  [ -n "${PATCH}" ] && git am --keep-cr "${PATCH}"
fi

echo "▸ 3/6 retire every transport file from the root (git and disk)"
for f in *.bundle *.patch APPLY_IN_CODESPACES.sh APPLY_GBP_PATCH.txt MERGE_TO_MAIN.sh; do
  [ -e "$f" ] || continue
  git rm -q --cached "$f" 2>/dev/null || true
  [ "$f" = "MERGE_TO_MAIN.sh" ] || rm -f "$f"
done
git commit -qm "chore: remove transport files from the repository root" 2>/dev/null || true
test -z "$(ls *.patch *.bundle 2>/dev/null)" || { echo "stray transport file at root"; exit 1; }

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
rm -f MERGE_TO_MAIN.sh /tmp/ecowoods-merge-to-main.sh
echo
echo "✓ main is the only branch — $(git log --oneline -1)"

# After Vercel deploys main:
#   pnpm notify:indexnow                      # re-announce the canonicals
#   vercel env pull apps/web/.env.local && pnpm env:check   # what is still unset (CRON_SECRET, ERROR_WEBHOOK_URL, GA)
#   pnpm seo:live                             # old-domain redirect + stale alias + crawl (green once the owner actions in README are done)
