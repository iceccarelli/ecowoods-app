#!/usr/bin/env bash
#
# scripts/state-check.sh — read-only. Changes nothing, applies nothing.
#
# Answers one question: what is actually on this working tree right now?
# Written because "a green build proves nothing if the patch did not apply"
# and because uploaded .patch files land as commits instead of changes.
#
# Usage:  bash scripts/state-check.sh
#
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32mOK\033[0m    %s\n' "$1"; }
bad()  { printf '  \033[31mNO\033[0m    %s\n' "$1"; }
info() { printf '        %s\n' "$1"; }

echo
bold "── repository ─────────────────────────────────────────"
info "path    $(pwd)"
info "branch  $(git rev-parse --abbrev-ref HEAD)"
info "HEAD    $(git log -1 --format='%h  %s')"

echo
bold "── working tree ───────────────────────────────────────"
DIRTY="$(git status --porcelain)"
if [ -z "$DIRTY" ]; then
  ok "clean — safe to apply a patch"
else
  bad "DIRTY — do not apply a patch onto this"
  git status --short | sed 's/^/        /'
fi

echo
bold "── last 8 commits (watch for 'Add files via upload') ──"
git log --oneline -8 | sed 's/^/        /'

echo
bold "── remote ─────────────────────────────────────────────"
git fetch -q origin 2>/dev/null
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/main 2>/dev/null || echo unknown)"
if [ "$LOCAL" = "$REMOTE" ]; then
  ok "HEAD == origin/main"
else
  info "HEAD        ${LOCAL:0:9}"
  info "origin/main ${REMOTE:0:9}"
  info "ahead/behind: $(git rev-list --left-right --count HEAD...origin/main 2>/dev/null | awk '{print $1" ahead, "$2" behind"}')"
fi

echo
bold "── uploaded .patch files sitting in the repo ──────────"
FOUND=0
for p in *.patch; do
  [ -e "$p" ] || continue
  FOUND=1
  TRACKED="untracked"
  git ls-files --error-unmatch "$p" >/dev/null 2>&1 && TRACKED="TRACKED IN GIT (needs git rm --cached)"
  info "$p  $(wc -c < "$p") bytes  md5 $(md5sum "$p" | cut -c1-32)"
  info "   $TRACKED"
done
[ "$FOUND" = 0 ] && info "(none — nothing has been uploaded, or it is already applied and cleaned up)"

echo
bold "── is patch 22 applied? (markers, not assumptions) ────"
check() { # file  marker  before  after
  local n; n=$(grep -c -- "$2" "$1" 2>/dev/null); n=${n:-0}
  if [ "$n" = "$4" ]; then ok  "$2 in $(basename "$1") = $n  (expected $4 after)"
  elif [ "$n" = "$3" ]; then bad "$2 in $(basename "$1") = $n  (this is the BEFORE value)"
  else bad "$2 in $(basename "$1") = $n  (expected $3 before / $4 after — neither)"; fi
}
check apps/web/app/products/floorforge/page.tsx ff-status-grid 0 1
check apps/web/app/globals.css                  ff-measure     0 1
check apps/web/app/products/floorforge/page.tsx paper-texture  2 0
check audit/FINDINGS.md                         F-56           0 1

echo
bold "── form must be untouched ─────────────────────────────"
FORMHASH=$(sed -n '/PILOT INTEREST MODAL/,$p' apps/web/app/products/floorforge/page.tsx | md5sum | cut -c1-32)
if [ "$FORMHASH" = "90d03d30c0a8f609380942e2e9c788db" ]; then
  ok "pilot-lead modal is byte-identical to a657e17"
else
  bad "pilot-lead modal has CHANGED — md5 $FORMHASH"
fi
info "api/pilot-leads last touched: $(git log -1 --format='%h %ad %s' --date=short -- apps/web/app/api/pilot-leads/route.ts)"

echo
bold "── non-negotiables (photography) ──────────────────────"
RB=$(grep -c '<RotatingBackground' apps/web/app/home-client.tsx); RB=${RB:-0}
US=$(grep -c 'images.unsplash.com' apps/web/app/globals.css); US=${US:-0}
[ "$RB" = 2 ] && ok "RotatingBackground = 2" || bad "RotatingBackground = $RB (must be 2)"
[ "$US" = 1 ] && ok "images.unsplash.com = 1" || bad "images.unsplash.com = $US (must be 1)"

echo
bold "── audit report freshness ─────────────────────────────"
if [ -f audit/runtime-report.json ]; then
  info "generatedAt $(node -e 'console.log(JSON.parse(require("fs").readFileSync("audit/runtime-report.json","utf8")).generatedAt)' 2>/dev/null || echo '?')"
  info "(if this predates the last contrast patch, its numbers are stale)"
else
  info "(no runtime-report.json)"
fi
echo
