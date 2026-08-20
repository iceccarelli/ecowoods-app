#!/usr/bin/env bash
#
# scripts/audit-all.sh — run every check this repository has, in one command,
# and print one verdict.
#
# WHY THIS EXISTS
#
# The checks were correct and scattered: four guards behind `pnpm verify`, a
# mandatory parse scan, eight static auditors under audit/scripts/, a runtime
# sweep behind its own shell script, and a set of grep invariants that only
# existed in a document. Nobody runs eight things. So things that were already
# measurable went unmeasured for days — the site served a build four patches
# behind for exactly that reason.
#
# This runs all of it, never stops at the first failure, and ends with a table.
# Ten green lines or a list of what is broken.
#
#   bash scripts/audit-all.sh            everything except the runtime sweep
#   bash scripts/audit-all.sh --full     also boots a server and sweeps 220 cells
#   bash scripts/audit-all.sh --quick    skip install/typecheck/build
#
# Exit code is the number of failed sections, so CI can gate on it.
#
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 2

FULL=0; QUICK=0
for a in "$@"; do
  case "$a" in
    --full)  FULL=1 ;;
    --quick) QUICK=1 ;;
    *) echo "unknown option: $a  (--full | --quick)"; exit 2 ;;
  esac
done

BOLD=$'\033[1m'; DIM=$'\033[2m'; GRN=$'\033[32m'; RED=$'\033[31m'; YEL=$'\033[33m'; OFF=$'\033[0m'
FAILED=0
RESULTS=()

section() { printf '\n%s── %s %s\n' "$BOLD" "$1" "$OFF"; }
record()  { RESULTS+=("$1|$2|$3"); }

# run <label> <command...>  — never aborts the script
run() {
  local label="$1"; shift
  local out rc
  out="$("$@" 2>&1)"; rc=$?
  if [ $rc -eq 0 ]; then
    printf '  %sPASS%s  %-34s %s\n' "$GRN" "$OFF" "$label" "$(printf '%s' "$out" | tail -1 | cut -c1-78)"
    record PASS "$label" ""
  else
    printf '  %sFAIL%s  %-34s\n' "$RED" "$OFF" "$label"
    printf '%s' "$out" | tail -14 | sed 's/^/          /'
    record FAIL "$label" ""
    FAILED=$((FAILED+1))
  fi
}

# note <label> <value> — informational, never fails
note() { printf '  %s····%s  %-34s %s\n' "$DIM" "$OFF" "$1" "$2"; }

# expect <label> <actual> <wanted>
expect() {
  if [ "$2" = "$3" ]; then
    printf '  %sPASS%s  %-34s %s\n' "$GRN" "$OFF" "$1" "$2"
    record PASS "$1" ""
  else
    printf '  %sFAIL%s  %-34s got %s, want %s\n' "$RED" "$OFF" "$1" "$2" "$3"
    record FAIL "$1" "got $2 want $3"
    FAILED=$((FAILED+1))
  fi
}

# count without the grep -c trap: grep exits 1 when the count is zero, which has
# silently swallowed the tail of a && chain in this project more than once.
count() { grep -c "$@" 2>/dev/null || true; }

printf '\n%sECOWOODS — FULL AUDIT%s   %s\n' "$BOLD" "$OFF" "$(date -u '+%Y-%m-%d %H:%MZ')"

# ─────────────────────────────────────────────────────────────────────────────
section "1 · repository state"
note "HEAD"          "$(git log -1 --format='%h  %s' | cut -c1-70)"
note "branch"        "$(git rev-parse --abbrev-ref HEAD)"
git fetch -q origin 2>/dev/null || true
AHEAD="$(git rev-list --count origin/main..HEAD 2>/dev/null || echo '?')"
BEHIND="$(git rev-list --count HEAD..origin/main 2>/dev/null || echo '?')"
note "vs origin/main" "$AHEAD ahead, $BEHIND behind"
expect "working tree clean"        "$(git status --porcelain | wc -l | tr -d ' ')" "0"
expect "no .patch files tracked"   "$(git ls-files | count '\.patch$')" "0"
expect "untracked leftovers"       "$(git clean -nd | wc -l | tr -d ' ')" "0"

# ─────────────────────────────────────────────────────────────────────────────
section "2 · non-negotiables"
expect "RotatingBackground mounts"  "$(count '<RotatingBackground' apps/web/app/home-client.tsx)" "2"
expect "unsplash hero in globals"   "$(count 'images.unsplash.com' apps/web/app/globals.css)" "1"
expect "one <main> in the app"      "$(grep -rho '<main' apps/web/app --include=*.tsx | wc -l | tr -d ' ')" "1"

# ─────────────────────────────────────────────────────────────────────────────
section "3 · build stack"
if [ "$QUICK" = 1 ]; then
  printf '  %s····%s  skipped (--quick)\n' "$DIM" "$OFF"
else
  run "pnpm install"        pnpm install --silent
  run "prisma generate"     pnpm --filter @ecowoods/web exec prisma generate
  run "tsc --noEmit"        pnpm --filter @ecowoods/web exec tsc --noEmit
  run "next build"          pnpm --filter @ecowoods/web build
fi

# ─────────────────────────────────────────────────────────────────────────────
section "4 · guards (pnpm verify)"
run "verify:facts"        node scripts/verify-business-facts.mjs
run "verify:migrations"   node scripts/verify-migrations.mjs
run "verify:tokens"       node scripts/verify-tokens.mjs
run "verify:schema"       node scripts/verify-schema.mjs
[ -f scripts/verify-papers.mjs ] && run "verify:papers" node scripts/verify-papers.mjs
[ -f scripts/verify-links.mjs ]  && run "verify:links"  node scripts/verify-links.mjs
[ -f scripts/verify-framework.mjs ] && run "verify:framework" node scripts/verify-framework.mjs
[ -f scripts/verify-client-boundary.mjs ] && run "verify:client" node scripts/verify-client-boundary.mjs
[ -f scripts/verify-glossary.mjs ] && run "verify:glossary" node scripts/verify-glossary.mjs

# ─────────────────────────────────────────────────────────────────────────────
section "5 · source integrity"
run "parse-scan (mandatory gate)" node audit/scripts/parse-scan.mjs

# ─────────────────────────────────────────────────────────────────────────────
section "6 · static auditors"
for a in undefined-tokens contrast theme-parity inline-style semantics ios-zoom reduced-motion; do
  f="audit/scripts/${a}-audit.mjs"
  [ -f "$f" ] || continue
  out="$(node "$f" 2>&1 | tail -1 | cut -c1-76)"
  printf '  %s····%s  %-34s %s\n' "$DIM" "$OFF" "$a" "$out"
done

# ─────────────────────────────────────────────────────────────────────────────
section "7 · technical papers"
if [ -f scripts/verify-papers.mjs ]; then
  node scripts/verify-papers.mjs --list 2>&1 | sed -n '/Technical papers/,$p' | sed 's/^/  /'
fi
if [ -f scripts/verify-framework.mjs ]; then
  node scripts/verify-framework.mjs --list 2>&1 | sed -n '/Framework/,$p' | sed 's/^/  /'
fi
if [ -f scripts/verify-glossary.mjs ]; then
  node scripts/verify-glossary.mjs 2>&1 | tail -1 | sed 's/^/  /'
fi
note "public/papers pdfs"  "$(ls apps/web/public/papers/*.pdf 2>/dev/null | wc -l | tr -d ' ')"
note "staged in docs/"     "$(ls docs/papers-pending/*.pdf 2>/dev/null | wc -l | tr -d ' ')"
if command -v pdftotext >/dev/null 2>&1; then
  BAD=0
  for f in docs/papers-pending/*.pdf apps/web/public/papers/*.pdf; do
    [ -e "$f" ] || continue
    # Read the text into a variable and match with a HERE-STRING, not a pipe.
    # `pdftotext | grep -q` under `set -o pipefail` reports FAILURE when the
    # match SUCCEEDS: grep -q exits the moment it finds something, pdftotext
    # takes SIGPIPE, and pipefail surfaces that as the pipeline's status. This
    # scan silently passed two PDFs that both contain the retired claims.
    # Same family as the `grep -c` trap — a tool reporting on stdout and in the
    # exit code, and the two disagreeing.
    TXT="$(pdftotext -q -nopgbrk "$f" - 2>/dev/null || true)"
    if grep -qE '5,?200\+? *Homes|Est\. *1998' <<<"$TXT"; then
      printf '  %sWARN%s  %-34s retired claim in %s\n' "$YEL" "$OFF" "title-slide claims" "$(basename "$f")"
      BAD=$((BAD+1))
    fi
  done
  [ "$BAD" = 0 ] && printf '  %sPASS%s  %-34s no retired claims in any pdf\n' "$GRN" "$OFF" "pdf text scan"
else
  printf '  %sWARN%s  %-34s pdftotext missing — pdf text unchecked\n' "$YEL" "$OFF" "pdf text scan"
fi

# ─────────────────────────────────────────────────────────────────────────────
section "8 · runtime sweep"
if [ "$FULL" = 1 ]; then
  run "220-cell sweep" bash audit/scripts/run-runtime-audit.sh
elif [ -f audit/runtime-report.json ]; then
  GEN="$(node -e 'try{console.log(JSON.parse(require("fs").readFileSync("audit/runtime-report.json","utf8")).generatedAt)}catch{console.log("?")}' 2>/dev/null)"
  note "last report"  "$GEN"
  # A report generated before the last change to globals.css describes a build
  # that no longer exists. F-41 cost this project three runs and a full
  # investigation cycle against a stale build; the numbers below are quoted in
  # documents, so say plainly when they cannot be trusted.
  CSS_AT="$(git log -1 --format=%cI -- apps/web/app/globals.css 2>/dev/null)"
  if [ -n "$CSS_AT" ] && [ -n "$GEN" ] && [ "$GEN" != "?" ] && [[ "$GEN" < "$CSS_AT" ]]; then
    printf '  %sWARN%s  %-34s STALE — globals.css changed %s\n' "$YEL" "$OFF" "report freshness" "${CSS_AT:0:10}"
    printf '        %s\n' "The numbers below describe a build that no longer exists. Re-run with --full."
  else
    printf '  %sPASS%s  %-34s newer than the last stylesheet change\n' "$GRN" "$OFF" "report freshness"
  fi
  node -e '
    try {
      const r = JSON.parse(require("fs").readFileSync("audit/runtime-report.json","utf8"));
      let ov=0, ax=0, tap=0;
      for (const c of r.results) {
        for (const p of ["top","bottom"]) if (c[p]?.overflow?.excess > 0) { ov++; break; }
        if (Array.isArray(c.axe) && c.axe.length) ax++;
        for (const p of ["top","bottom"]) if ((c[p]?.tapBelowWcag||[]).length) { tap++; break; }
      }
      const pad=(s)=>String(s).padEnd(34);
      console.log("  ····  "+pad("cells")+r.results.length);
      console.log("  ····  "+pad("horizontal overflow")+ov);
      console.log("  ····  "+pad("axe violations")+ax);
      console.log("  ····  "+pad("target under 24px")+tap+"   (see FINDINGS F-60 before acting)");
    } catch (e) { console.log("  ····  runtime report unreadable"); }
  '
  printf '  %s····%s  %-34s re-run with --full after any CSS change\n' "$DIM" "$OFF" ""
else
  printf '  %s····%s  no runtime report — run with --full\n' "$DIM" "$OFF"
fi

# ─────────────────────────────────────────────────────────────────────────────
printf '\n%s── verdict %s\n' "$BOLD" "$OFF"
PASSES=0
for r in "${RESULTS[@]}"; do [ "${r%%|*}" = PASS ] && PASSES=$((PASSES+1)); done
if [ "$FAILED" -eq 0 ]; then
  printf '  %s✓ %d checks passed, 0 failed%s\n\n' "$GRN" "$PASSES" "$OFF"
else
  printf '  %s✗ %d failed%s, %d passed:\n' "$RED" "$FAILED" "$OFF" "$PASSES"
  for r in "${RESULTS[@]}"; do
    [ "${r%%|*}" = FAIL ] && printf '      %s\n' "$(printf '%s' "$r" | cut -d'|' -f2-3 | tr '|' ' ')"
  done
  printf '\n'
fi
exit "$FAILED"
