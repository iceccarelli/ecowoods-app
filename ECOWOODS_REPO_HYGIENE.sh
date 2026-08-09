#!/usr/bin/env bash
#
# ECOWOODS_REPO_HYGIENE.sh
#
# Removes build-process litter from the ecowoods-app repository.
# Base: 8978979370cc8c175964eb9be26114a3898eb639
#
# WHAT THIS DOES NOT TOUCH — on purpose:
#   * /products/floorforge, /api/pilot-leads, the PilotLead model and its
#     migration. Those are a live product decision, not litter. See the memo.
#   * backend/                     (74 files, FastAPI, not deployed by Vercel)
#   * the 38 root markdown documents
#   * anything under apps/web/app, packages/, or prisma/
#
# Every removal below was checked for inbound references first. Nothing here
# is imported, built, or served.
#
# Run from the repo root. It stages changes but does NOT commit or push.
#
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

echo "▸ repo: $(pwd)"
echo "▸ HEAD: $(git rev-parse HEAD)"
echo

before_files=$(git ls-files | wc -l)

# ─────────────────────────────────────────────────────────────────────────────
# 1. Patch and installer files committed instead of applied
#
#    .gitignore has contained `*.patch` since 52be8c0, but ignore rules do not
#    untrack files already committed — and the GitHub web upload path ignores
#    .gitignore entirely, which is how every one of these arrived.
# ─────────────────────────────────────────────────────────────────────────────
echo "▸ 1/6  stray patch + installer files"
for f in \
  dev-image-fix.patch \
  ecowoods-logo-inline-fix.patch \
  ecowoods-perf-seo.patch \
  fix-configurator-collision.patch \
  perf-quickwins.patch \
  seo-boost.patch \
  apply-hide-species.sh \
  apply-image-fix.sh \
  apply-machine-6shots.sh \
  apply-mobile-polish.sh
do
  if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
    git rm -q --cached "$f" && rm -f "$f" && echo "     removed  $f"
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
# 2. Asset archives (4.4 MB). Their contents were extracted into public/ long
#    ago; the .zip files themselves are dead weight in every clone forever.
# ─────────────────────────────────────────────────────────────────────────────
echo "▸ 2/6  committed asset archives"
git ls-files -z '*.zip' | while IFS= read -r -d '' f; do
  git rm -q --cached "$f" && rm -f "$f" && echo "     removed  $f"
done

# ─────────────────────────────────────────────────────────────────────────────
# 3. Root Next.js config orphans.
#
#    vercel.json builds apps/web (outputDirectory: apps/web/.next) using
#    apps/web/next.config.js (72 lines). The root next.config.js (26 lines) is
#    a stale earlier copy — root package.json declares no dependencies at all,
#    so nothing can even resolve `next` there. apps/web/tsconfig.json's
#    `include: ["next-env.d.ts", ...]` resolves relative to apps/web, not root.
#
#    Two configs that disagree is worse than one: the root file still says
#    `remotePatterns: [{ hostname: '**' }]`, which is not what apps/web says.
# ─────────────────────────────────────────────────────────────────────────────
echo "▸ 3/6  dead root Next.js config"
for f in next.config.js next-env.d.ts; do
  if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
    git rm -q --cached "$f" && rm -f "$f" && echo "     removed  /$f  (apps/web/$f is the live one)"
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
# 4. package-lock.json in a pnpm workspace.
#
#    Root package.json pins `packageManager: pnpm@9.15.0`; vercel.json installs
#    with pnpm; pnpm-lock.yaml is the real lockfile. The npm lockfile is from
#    2026-06-11 and is not used by any build — but anyone who runs `npm install`
#    in Codespaces gets a divergent dependency tree that looks legitimate.
# ─────────────────────────────────────────────────────────────────────────────
echo "▸ 4/6  npm lockfile in a pnpm workspace"
if git ls-files --error-unmatch package-lock.json >/dev/null 2>&1; then
  git rm -q --cached package-lock.json && rm -f package-lock.json
  echo "     removed  package-lock.json  (pnpm-lock.yaml is authoritative)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 5. Committed node_modules and stale .backups.
#
#    apps/mobile/node_modules is 359 tracked files / 30 MB, including an 8.7 MB
#    typescript.js. This is the single largest reason a fresh clone is 225 MB
#    and why every clone-and-verify cycle is slow.
#
#    .backups/20260527_* are four .bak copies of config files from May.
# ─────────────────────────────────────────────────────────────────────────────
echo "▸ 5/6  committed node_modules + stale backups"
if [ -n "$(git ls-files apps/mobile/node_modules)" ]; then
  n=$(git ls-files apps/mobile/node_modules | wc -l)
  git rm -rq --cached apps/mobile/node_modules
  echo "     untracked  apps/mobile/node_modules  ($n files, ~30 MB)"
  echo "                (left on disk — .gitignore now covers it)"
fi
if [ -n "$(git ls-files .backups)" ]; then
  n=$(git ls-files .backups | wc -l)
  git rm -rq --cached .backups && rm -rf .backups
  echo "     removed    .backups/  ($n files)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 6. Make .gitignore actually prevent the recurrence.
# ─────────────────────────────────────────────────────────────────────────────
echo "▸ 6/6  .gitignore"
python3 - <<'PY'
import io, re
p = '.gitignore'
s = open(p, encoding='utf-8').read()

# collapse the duplicated `*.patch` pair at the end
s = re.sub(r'\n\*\.patch\n\*\.patch\n?$', '\n', s)
s = re.sub(r'\n\*\.patch\n?$', '\n', s)

block = """
# ── Build-process litter ─────────────────────────────────────────────────────
# Every one of these has been committed to this repo at least once, usually by
# uploading a file through the GitHub web UI — which does NOT honour .gitignore.
# Keeping the rules anyway so local `git add -A` stays safe.
*.patch
*.diff
apply-*.sh
*.zip
.backups/

# The npm lockfile is not used here — pnpm-lock.yaml is authoritative.
package-lock.json
"""
if '# ── Build-process litter' not in s:
    s = s.rstrip('\n') + '\n' + block

open(p, 'w', encoding='utf-8').write(s)
print("     updated    .gitignore (deduped *.patch, added *.diff / apply-*.sh / *.zip / .backups/ / package-lock.json)")
PY
git add .gitignore

# ─────────────────────────────────────────────────────────────────────────────
# 7. vercel.json — X-Frame-Options: DENY is declared twice.
# ─────────────────────────────────────────────────────────────────────────────
echo "▸ bonus  vercel.json duplicate header"
python3 - <<'PY'
p = 'vercel.json'
s = open(p, encoding='utf-8').read()
dup = """        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Frame-Options", "value": "DENY" },
"""
one = """        { "key": "X-Frame-Options", "value": "DENY" },
"""
if dup in s:
    open(p, 'w', encoding='utf-8').write(s.replace(dup, one, 1))
    print("     removed    duplicate X-Frame-Options entry")
else:
    print("     already clean")
PY
git add vercel.json

echo
after_files=$(git ls-files | wc -l)
echo "─────────────────────────────────────────────────────────────"
echo "tracked files: $before_files -> $after_files"
echo
git status --short | head -40
echo
echo "Nothing has been committed. Verify, then:"
echo
echo "  pnpm install"
echo "  pnpm --filter @ecowoods/web exec prisma generate"
echo "  pnpm --filter @ecowoods/web exec tsc --noEmit"
echo "  pnpm verify"
echo "  pnpm --filter @ecowoods/web build"
echo
echo "  git add -A"
echo "  git commit -m 'chore: remove build-process litter from the repo root'"
echo "  git push origin main"
