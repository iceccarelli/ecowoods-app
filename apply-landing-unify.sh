#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# apply-landing-unify.sh
#
# Two structural fixes, done the AWS way:
#
# A. HERO FILLS THE SCREEN on every device.
#    Conflicting height rules (100vh / 88vh / auto / flex-end) left the hero
#    neither full-height nor content-sized on phones — stats spilled past the
#    fold. Fix: 100svh (small-viewport-height accounts for mobile browser
#    chrome), content centered, on ALL widths. One rule, no per-breakpoint
#    contradictions.
#
# B. SECTIONS BLEED FULL-WIDTH; ONLY COMPONENTS ROUND.
#    Whole sections were turned into rounded floating cards (section--card), so
#    the page alternated square / rounded / square with gaps and shape clashes
#    at every boundary — the "garbage" transitions. AWS never rounds sections;
#    it separates them by TONE, edge to edge. Fix: neutralise section--card so
#    those three sections bleed full-width like the rest. Rounding stays on the
#    real components inside them (booking card, price cards, panels).
#
# Idempotent. Run from repo root.
# ---------------------------------------------------------------------------
set -euo pipefail
[ -f apps/web/app/globals.css ] || { echo "ERROR: run from the repo root"; exit 1; }

python3 - << 'PY'
import sys, re
css = 'apps/web/app/globals.css'
c = open(css).read()

MARK = 'LANDING UNIFY'
if MARK in c:
    print("  = landing unify (already applied)")
    o, cl = c.count('{'), c.count('}')
    print(f"  braces {o}/{cl} {'OK' if o==cl else 'MISMATCH'}")
    sys.exit(0 if o==cl else 1)

add = r'''

/* ============================================================
   LANDING UNIFY — hero fills the screen; sections bleed full-width
   Appended last so it wins over earlier hero/section rules by cascade order.
   ============================================================ */

/* A. HERO — fill the viewport on every device, content centered.
   svh = the small viewport height (with mobile browser chrome showing), so it
   never gets cut off by the address bar. Overrides the earlier auto/flex-end
   rules that let content spill past the fold. */
.hero {
  min-height: 100svh;
  justify-content: center !important;
  padding-top: clamp(5rem, 12vh, 8rem) !important;
  padding-bottom: clamp(2rem, 6vh, 4rem) !important;
}
@supports not (height: 100svh) {
  .hero { min-height: 100vh; }
}

/* B. SECTIONS BLEED FULL-WIDTH. Neutralise the floating-card treatment so no
   section is an inset rounded rectangle. Tone change alone separates sections —
   the AWS pattern. Real components inside (booking card, price cards) keep
   their own rounding. */
.section--card {
  max-width: none;
  margin-left: 0;
  margin-right: 0;
  border-radius: 0;
}
@media (max-width: 767px) {
  .section--card {
    margin-left: 0;
    margin-right: 0;
    border-radius: 0;
  }
}
/* the adjacent-card join rules are now moot (no rounding to join), but keep
   them harmless */
.section--card + .section--card { margin-top: 0; }
'''
c += add
open(css, 'w').write(c)
print("  ~ hero -> 100svh, centered, fills screen on all devices")
print("  ~ sections -> full-bleed (section--card rounding neutralised)")

o, cl = c.count('{'), c.count('}')
print(f"  braces {o}/{cl} {'OK' if o==cl else 'MISMATCH — STOP'}")
sys.exit(0 if o==cl else 1)
PY

echo ""
echo "Done. Review:  git --no-pager diff apps/web/app/globals.css"
