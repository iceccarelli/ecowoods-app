#!/usr/bin/env bash
# ============================================================================
# scripts/state-of-truth.sh — what is actually in the repo, and actually live.
#
# WHY THIS EXISTS
#
# Commit 50fc9fc passed every guard, built clean, deployed, and reported
# "✓ live and serving" — while carrying the contents of a different patch than
# its message described. The merged vercel.json, the twenty-seventh guard and a
# file deletion were all silently absent. Nothing in the pipeline noticed,
# because every check answered a narrower question than "did what I think
# shipped actually ship" (F-203).
#
# This answers that question and only that question. For every deliverable it
# asks two independent things:
#
#   IN REPO — is the artefact present on origin/main, read over the network
#             rather than from this working tree, which may be dirty or stale
#   LIVE    — does the deployed site actually serve it
#
# A row can be present and not live (deployed before the change, or a build
# that dropped it) or live and not present (someone edited production, or the
# tree is behind). Both are real and both have happened here.
#
#   bash scripts/state-of-truth.sh
#   bash scripts/state-of-truth.sh --quick     skip the live fetches
# ============================================================================
set -uo pipefail
BASE="${BASE:-https://ecowoods.ca}"
QUICK=0; [ "${1:-}" = "--quick" ] && QUICK=1
CB="cb=$(date +%s)"

GRN=$'\033[32m'; RED=$'\033[31m'; YEL=$'\033[33m'; DIM=$'\033[2m'; BOLD=$'\033[1m'; OFF=$'\033[0m'
BAD=0

cd "$(dirname "$0")/.." || exit 2
git fetch -q origin 2>/dev/null

printf '\n%sSTATE OF TRUTH%s   repo: origin/main   site: %s\n' "$BOLD" "$OFF" "$BASE"
printf '%s%s%s\n\n' "$DIM" "$(git log -1 --format='HEAD %h  %ad  %s' --date=short origin/main)" "$OFF"

# in_repo <path> — does this file exist on origin/main, not in the working tree
in_repo() { git cat-file -e "origin/main:$1" 2>/dev/null; }
# in_repo_grep <path> <pattern>
in_repo_grep() { git show "origin/main:$1" 2>/dev/null | grep -q -- "$2"; }
# live <url> <pattern>
live() {
  [ "$QUICK" = 1 ] && return 2
  curl -s -L --max-time 25 "$1?$CB" 2>/dev/null | grep -q -- "$2"
}

row() { # row <label> <repo-ok 0/1> <live-ok 0/1/2>
  local L="$1" R="$2" V="$3" rs vs
  [ "$R" = 0 ] && rs="${GRN}yes${OFF}" || { rs="${RED}NO ${OFF}"; BAD=$((BAD+1)); }
  case "$V" in
    0) vs="${GRN}yes${OFF}" ;;
    2) vs="${DIM}skip${OFF}" ;;
    *) vs="${RED}NO ${OFF}"; BAD=$((BAD+1)) ;;
  esac
  printf '  %-46s repo %b   live %b\n' "$L" "$rs" "$vs"
}

sect() { printf '\n%s── %s%s\n' "$BOLD" "$1" "$OFF"; }

sect "commercial head terms"
in_repo apps/web/app/hardwood-flooring-toronto/page.tsx; a=$?
live "$BASE/hardwood-flooring-toronto" "Hardwood flooring in Toronto"; b=$?
row "/hardwood-flooring-toronto" $a $b
in_repo apps/web/app/hardwood-floor-refinishing-toronto/page.tsx; a=$?
live "$BASE/hardwood-floor-refinishing-toronto" "Hardwood floor refinishing"; b=$?
row "/hardwood-floor-refinishing-toronto" $a $b
in_repo apps/web/lib/schema/commercial.ts; a=$?
live "$BASE/hardwood-flooring-toronto" "UnitPriceSpecification"; b=$?
row "Service + Offer schema" $a $b

sect "entity and reviews"
in_repo apps/web/app/reviews/page.tsx; a=$?; live "$BASE/reviews" "HomeStars"; b=$?
row "/reviews" $a $b
in_repo apps/web/app/press/page.tsx; a=$?; live "$BASE/press" "Boilerplate"; b=$?
row "/press" $a $b
in_repo apps/web/app/md/about/route.ts; a=$?; live "$BASE/about.md" "## Customer reviews"; b=$?
row "/about.md machine edition" $a $b
in_repo_grep apps/web/lib/markdown-export.ts entityToMarkdown; a=$?
live "$BASE/llms-full.txt" "## Customer reviews"; b=$?
row "entity block inside llms-full.txt" $a $b
in_repo_grep apps/web/app/llms.txt/route.ts "Preferred citation targets"; a=$?
live "$BASE/llms.txt" "Preferred citation targets"; b=$?
row "llms.txt citation targets" $a $b

sect "review engine"
in_repo apps/web/app/r/page.tsx; a=$?; live "$BASE/r" "Tell people what actually happened"; b=$?
row "/r review routing" $a $b
in_repo public/review-card.svg; a=$?; live "$BASE/review-card.svg" "ecowoods.ca/r"; b=$?
row "printed review card" $a $b

sect "vercel config (F-202)"
in_repo_grep vercel.json '"has"'; a=$?
if [ "$QUICK" = 1 ]; then b=2; else
  curl -sI "$BASE/llms.txt?$CB" 2>/dev/null | grep -qi 'access-control-allow-origin'; b=$?
fi
row "host-scoped redirects + CORS on machine surfaces" $a $b
in_repo scripts/verify-vercel-config.mjs; a=$?
row "guard 27 — verify-vercel-config" $a 2
if in_repo old-domain/vercel.json; then
  printf '  %-46s %sold-domain/vercel.json still present — the loop paste%s\n' "loaded gun" "$RED" "$OFF"; BAD=$((BAD+1))
else
  printf '  %-46s %sremoved%s\n' "loaded gun (old-domain/vercel.json)" "$GRN" "$OFF"
fi

sect "old domain"
in_repo old-domain/.htaccess; a=$?
row "old-domain/.htaccess in repo" $a 2
if [ "$QUICK" = 1 ]; then
  printf '  %-46s %sskipped%s\n' "ecowoodshardwood.com 301s" "$DIM" "$OFF"
else
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://www.ecowoodshardwood.com/services/floor-refinishing" 2>/dev/null)"
  if [ "$code" = "301" ]; then
    printf '  %-46s %s301 — consolidated%s\n' "ecowoodshardwood.com deep path" "$GRN" "$OFF"
  else
    printf '  %-46s %sHTTP %s — NOT consolidated, still splitting authority%s\n' "ecowoodshardwood.com deep path" "$RED" "$code" "$OFF"; BAD=$((BAD+1))
  fi
fi

sect "images"
n_repo="$(git ls-tree -r --name-only origin/main apps/web/public/illustrations | grep -c '\.webp$')"
printf '  %-46s repo %s%s files%s\n' "illustration files" "$GRN" "$n_repo" "$OFF"
if [ "$QUICK" = 0 ]; then
  n_map="$(curl -s -L --max-time 30 "$BASE/sitemap.xml?$CB" 2>/dev/null | grep -c '<image:loc>')"
  printf '  %-46s live %s%s declared in the image sitemap%s\n' "image sitemap" "$GRN" "$n_map" "$OFF"
fi

sect "guards"
# Count the DEFINITIONS, not the mentions. The aggregate "verify" script names
# every sub-guard, so a naive grep counts each one twice and reports a number
# that is always wrong in the flattering direction.
G="$(git show origin/main:package.json 2>/dev/null | grep -cE '^\s*"verify:[a-z-]+":')"
# Three guards are defined but deliberately NOT in the aggregate: they need the
# network (verify:domain, verify:live-images) or read a deployed response, and a
# guard that fails because a machine is offline is a guard people learn to
# ignore. They run from verify-live.sh or by hand.
AGG="$(git show origin/main:package.json 2>/dev/null | grep -o '"verify": "[^"]*"' | grep -o 'verify:[a-z-]*' | sort -u | wc -l)"
printf '  %-46s %s%s defined, %s in `pnpm verify`%s\n' "guard count" "$GRN" "$G" "$AGG" "$OFF"
printf '  %sthe rest need the network: pnpm verify:domain, pnpm verify:live-images%s\n' "$DIM" "$OFF"

printf '\n%s── verdict %s\n' "$BOLD" "$OFF"
if [ "$BAD" -eq 0 ]; then
  printf '  %s✓ everything checked is present in the repo and live%s\n\n' "$GRN" "$OFF"
else
  printf '  %s✗ %d discrepanc(ies)%s — a NO in "repo" means it never shipped;\n' "$RED" "$BAD" "$OFF"
  printf '    a NO in "live" means it shipped but the deploy does not serve it.\n\n'
fi
exit 0
