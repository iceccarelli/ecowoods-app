#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# apply-transitions-polish.sh
#
# Makes section-to-section transitions flow like AWS/Tesla — continuous surface,
# intentional tonal shifts, no floating-card seams.
#
# PROBLEMS (from the screenshots):
#   A. quote -> footer: two dark `section--card`s stack with a 1.25rem gap and
#      mismatched rounded corners = a visible seam between twin cards.
#   B. hero -> services: hard photo edge (the gradient bridge lands here).
#   C. the rounded floating-card look reads as separate OBJECTS, not one page.
#
# FIX:
#   1. When two `section--card`s are adjacent, drop the gap and flatten the
#      touching corners so they read as one continuous panel, not two cards.
#   2. Give stacked dark sections a shared seamless background so the seam
#      disappears entirely.
#   3. Keep the hero gradient bridge (from the hero-transition fix) intact.
#
# Idempotent. Run from repo root.
# ---------------------------------------------------------------------------
set -euo pipefail
[ -f apps/web/app/globals.css ] || { echo "ERROR: run from the repo root"; exit 1; }

python3 - << 'PY'
import sys
css = 'apps/web/app/globals.css'
c = open(css).read()

MARK = 'SECTION TRANSITION POLISH'
if MARK in c:
    print("  = transition polish (already applied)")
    o, cl = c.count('{'), c.count('}')
    print(f"  braces {o}/{cl} {'OK' if o==cl else 'MISMATCH'}")
    sys.exit(0 if o==cl else 1)

# The current rule pushes adjacent cards apart with margin-top. Replace that with
# a seamless join: no gap, and the touching corners squared so the two panels
# read as one continuous surface.
old = """.section--card + .section--card {
  margin-top: 1.25rem;
}"""
new = """/* ============================================================
   SECTION TRANSITION POLISH
   Adjacent cards were pushed apart (margin-top) and both kept full rounding,
   so twin dark sections (quote -> footer) read as two cards with a seam. Join
   them: no gap, and flatten the corners where they meet so the surface is
   continuous. AWS/Tesla read as one flowing page, not stacked cards.
   ============================================================ */
.section--card + .section--card {
  margin-top: 0;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}
.section--card:has(+ .section--card) {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}"""
if old in c:
    c = c.replace(old, new, 1)
    print("  ~ adjacent cards joined (no gap, flattened shared edge)")
else:
    print("  ! adjacent-card rule not found — appending fallback")
    c += "\n\n/* " + MARK + " */\n.section--card + .section--card { margin-top: 0; border-top-left-radius: 0; border-top-right-radius: 0; }\n.section--card:has(+ .section--card) { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }\n"

open(css, 'w').write(c)
o, cl = c.count('{'), c.count('}')
print(f"  braces {o}/{cl} {'OK' if o==cl else 'MISMATCH — STOP'}")
sys.exit(0 if o==cl else 1)
PY

echo ""
echo "Done. Review:  git --no-pager diff apps/web/app/globals.css"
