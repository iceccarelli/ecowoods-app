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
# Normalised to 0/1. `git cat-file -e` exits 128 on an absent path, which
# happens to work wherever the test is "non-zero" and misleads everywhere else.
in_repo() { git cat-file -e "origin/main:$1" 2>/dev/null && return 0 || return 1; }
# in_repo_grep <path> <pattern>
#
# NOT `| grep -q`. `set -o pipefail` is on at the top of this file, and grep -q
# exits the instant it matches — which closes the pipe under `git show`/`curl`,
# raises SIGPIPE, and makes the pipeline return 141. pipefail then reports that
# as failure. It only happens when the producer is still writing, so it passes
# on vercel.json (small) and fails on lib/guides.ts (750 lines) and on every
# real HTML page, which is to say on exactly the checks that matter. A "not
# found" that is really "found it too quickly" is the worst shape a check can
# take. Counting consumes the whole stream, so there is no early close.
in_repo_grep() { [ "$(git show "origin/main:$1" 2>/dev/null | grep -c -- "$2")" -gt 0 ]; }
# ── selftest ───────────────────────────────────────────────────────────────
# The SIGPIPE-under-pipefail bug above was invisible for a whole patch cycle
# because it only fires on inputs big enough that the producer is still
# writing. That is precisely the shape of bug a human never reproduces by
# hand. So it gets locked down: --selftest asserts each helper on a small
# input AND a large one, and asserts the miss case, which is the one a
# false-positive fix would break.
#
#   bash scripts/state-of-truth.sh --selftest
if [ "${1:-}" = "--selftest" ]; then
  fail=0
  t() { # t <label> <expected 0|1> <actual>
    if [ "$2" = "$3" ]; then printf '  %s✓%s %s\n' "$GRN" "$OFF" "$1"
    else printf '  %s✗%s %s — expected %s, got %s\n' "$RED" "$OFF" "$1" "$2" "$3"; fail=1; fi
  }
  printf '\n%sselftest — pipe helpers%s\n' "$BOLD" "$OFF"

  # small file, pattern present
  in_repo_grep vercel.json '"has"'; t "in_repo_grep, small file, match" 0 $?
  # LARGE file, pattern present — the regression case. A `| grep -q` here
  # returns 141 under pipefail and this assertion is what catches it.
  in_repo_grep apps/web/lib/guides.ts 'export const GUIDES'; t "in_repo_grep, large file, match" 0 $?
  # large file, pattern absent — guards against "always returns 0"
  in_repo_grep apps/web/lib/guides.ts 'zzz-no-such-token-zzz'; t "in_repo_grep, large file, miss" 1 $?
  # a path that is not on origin/main at all
  in_repo_grep no/such/file.ts 'anything'; t "in_repo_grep, absent path" 1 $?
  # in_repo on a real and an absent path
  in_repo apps/web/lib/guides.ts; t "in_repo, present" 0 $?
  in_repo no/such/file.ts; t "in_repo, absent" 1 $?

  printf '\n'
  [ "$fail" = 0 ] && { printf '  %sselftest passed%s\n\n' "$GRN" "$OFF"; exit 0; }
  printf '  %sselftest FAILED — do not trust this run%s\n\n' "$RED" "$OFF"; exit 1
fi

# ── the control probe ──────────────────────────────────────────────────────
#
# WITHOUT THIS, THE "LIVE" COLUMN LIES IN EXACTLY ONE DIRECTION.
#
# Every live check is a curl. A curl that cannot reach the network fails
# identically to a curl that reached a deploy missing the artefact — and this
# script rendered both as a red NO, then printed "it shipped but the deploy
# does not serve it". Run from a sandbox behind an egress proxy it reported
# twelve discrepancies against a site that was serving all twelve, and told the
# reader the old domain was "NOT consolidated" on the strength of an HTTP 000.
#
# So before a single deliverable is probed, fetch the site root. If that cannot
# be reached, the network is the finding, and every live check is reported as
# UNREACHABLE rather than as a failure. The same reasoning, and the same fix,
# as the control probe in scripts/verify-domain-redirect.mjs. A check that
# reports a verdict it did not establish is worse than no check: it spends the
# reader's trust on noise, and the one time it is right they will not believe
# it. Seventh instance in this repository — F-117, F-149, F-166, F-177, F-192,
# F-203, and this.
NET=0
if [ "$QUICK" = 0 ]; then
  ctl="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$BASE/?$CB" 2>/dev/null)"
  case "$ctl" in
    2*|3*) NET=0 ;;
    *) NET=1
       printf '%s  ! %s is unreachable from this machine (control probe: HTTP %s).%s\n' \
         "$YEL" "$BASE" "${ctl:-000}" "$OFF"
       printf '%s    Every live check below is reported UNREACHABLE, not failed.%s\n' \
         "$YEL" "$OFF"
       printf '%s    Re-run from a machine with egress before drawing any conclusion.%s\n\n' \
         "$YEL" "$OFF"
       ;;
  esac
fi

# live <url> <pattern> — 0 serving, 1 reachable but missing, 2 skipped, 3 unreachable
live() {
  [ "$QUICK" = 1 ] && return 2
  [ "$NET" = 1 ] && return 3
  [ "$(curl -s -L --max-time 25 "$1?$CB" 2>/dev/null | grep -c -- "$2")" -gt 0 ]
}

row() { # row <label> <repo-ok 0/1> <live-ok 0/1/2>
  local L="$1" R="$2" V="$3" rs vs
  [ "$R" = 0 ] && rs="${GRN}yes${OFF}" || { rs="${RED}NO ${OFF}"; BAD=$((BAD+1)); }
  case "$V" in
    0) vs="${GRN}yes${OFF}" ;;
    2) vs="${DIM}skip${OFF}" ;;
    3) vs="${YEL}unrch${OFF}" ;;   # control probe failed; not a finding
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

sect "keyword layer (patch 81)"
# The rail is the internal-link mechanism; if it is absent from the service-area
# template it is absent from 32 pages at once, which is the failure worth
# catching. Probed on a city page rather than the homepage for that reason.
in_repo apps/web/app/components/CommercialHeadTermRail.tsx; a=$?
live "$BASE/service-areas/etobicoke" "Most searched in Etobicoke"; b=$?
row "head-term rail on service-area pages" $a $b
in_repo apps/web/app/team/page.tsx; a=$?
live "$BASE/team" "first board to the final coat"; b=$?
row "/team — salaried crew, no subcontractors" $a $b
in_repo_grep apps/web/lib/guides.ts 'seoTitle'; a=$?
live "$BASE/guides/solid-vs-engineered-hardwood-toronto" "Solid vs engineered hardwood flooring in Toronto"; b=$?
row "guide keyword titles" $a $b
in_repo_grep apps/web/lib/guides.ts 'faqs:'; a=$?
live "$BASE/guides/reference-refinishing-existing-hardwood" "Related questions this guide answers"; b=$?
row "guide long-tail FAQPage" $a $b

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
if [ "$QUICK" = 1 ]; then b=2; elif [ "$NET" = 1 ]; then b=3; else
  [ "$(curl -sI "$BASE/llms.txt?$CB" 2>/dev/null | grep -ci 'access-control-allow-origin')" -gt 0 ]; b=$?
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
elif [ "$NET" = 1 ]; then
  # The control probe failed against the canonical host, so an HTTP 000 here
  # says nothing about the old domain. Reporting "NOT consolidated" off an
  # unreachable network is the exact false alarm this probe exists to stop.
  printf '  %-46s %sunreachable — no conclusion%s\n' "ecowoodshardwood.com deep path" "$YEL" "$OFF"
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
if [ "$QUICK" = 0 ] && [ "$NET" = 0 ]; then
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
if [ "$NET" = 1 ]; then
  # Say what was and was not established. "Everything green" would be a claim
  # about a deploy this run never contacted.
  printf '  %s! the live column was not established — %s is unreachable from here%s\n' "$YEL" "$BASE" "$OFF"
  if [ "$BAD" -eq 0 ]; then
    printf '  %s✓ every deliverable checked is present on origin/main%s\n' "$GRN" "$OFF"
  else
    printf '  %s✗ %d repo discrepanc(ies) — a NO in "repo" means it never shipped%s\n' "$RED" "$BAD" "$OFF"
  fi
  printf '  %sre-run from a machine with egress to check the deploy%s\n\n' "$DIM" "$OFF"
elif [ "$QUICK" = 1 ]; then
  # --quick ran no live check at all, so it cannot say anything about the
  # deploy. It previously claimed "present in the repo and live", which is the
  # same failure as the unreachable case wearing a green tick.
  if [ "$BAD" -eq 0 ]; then
    printf '  %s✓ every deliverable checked is present on origin/main%s\n' "$GRN" "$OFF"
  else
    printf '  %s✗ %d repo discrepanc(ies) — a NO in "repo" means it never shipped%s\n' "$RED" "$BAD" "$OFF"
  fi
  printf '  %s--quick made no live request; the deploy was not checked%s\n\n' "$DIM" "$OFF"
elif [ "$BAD" -eq 0 ]; then
  printf '  %s✓ everything checked is present in the repo and live%s\n\n' "$GRN" "$OFF"
else
  printf '  %s✗ %d discrepanc(ies)%s — a NO in "repo" means it never shipped;\n' "$RED" "$BAD" "$OFF"
  printf '    a NO in "live" means it shipped but the deploy does not serve it.\n\n'
fi
exit 0
