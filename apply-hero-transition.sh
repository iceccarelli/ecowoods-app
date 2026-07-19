#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# apply-hero-transition.sh
#
# Fixes the dead-zone between the hero and the Services section on tablet.
#
# CAUSE: .hero is min-height:100vh + align-items:center. On tall tablet
# viewports (768-1023px, which had NO hero rule) the content is vertically
# centered, so the stats bar floats mid-screen and a big band of empty hero
# background trails below it before the next section — the jarring cut in the
# screenshot.
#
# FIX, two parts:
#   1. Tablet range: seat hero content toward the bottom (justify + padding) so
#      the stats bar ends near the section boundary instead of mid-screen.
#   2. A gradient bridge: the hero background fades to the Services section's
#      dark tone at the bottom, so hero -> Services flows as one continuous
#      surface rather than a hard horizontal seam.
#
# Idempotent. Run from repo root.
# ---------------------------------------------------------------------------
set -euo pipefail
[ -f apps/web/app/globals.css ] || { echo "ERROR: run from the repo root"; exit 1; }

python3 - << 'PY'
import sys, re
css = 'apps/web/app/globals.css'
c = open(css).read()

if '.hero::after' in c and 'HERO -> SERVICES TRANSITION' in c:
    print("  = hero transition (already applied)")
    o, cl = c.count('{'), c.count('}')
    print(f"  braces {o}/{cl} {'OK' if o==cl else 'MISMATCH'}")
    sys.exit(0 if o==cl else 1)

add = r'''

/* ============================================================
   HERO -> SERVICES TRANSITION
   Removes the dead band of empty hero background that stranded below the stats
   on tablet, and blends the hero into the dark Services section so the scroll
   reads as one continuous surface.
   ============================================================ */

/* 1. Column layout so the stats bar can be seated at the bottom of the hero
      rather than floating in a centered block. */
.hero {
  flex-direction: column;
  justify-content: center;
  align-items: stretch;   /* .hero-content IS .shell (margin:0 auto), so let it
                             center itself; stretch avoids column shrink-wrap */
}

/* 2. A fade at the foot of the hero photo down to the Services tone, so the
      boundary is a gradient, not a cut. Sits above the photo, below the text. */
.hero::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 28vh;
  max-height: 260px;
  background: linear-gradient(to bottom, rgba(26, 15, 8, 0) 0%, rgba(26, 15, 8, 0.6) 55%, var(--walnut-950) 100%);
  pointer-events: none;
  z-index: 1;
}

/* 3. TABLET (768-1023px) — the range that had no hero rule and caused the gap.
      Seat the content toward the bottom and let the hero size to content + a
      little breathing room, so the stats end near the boundary. */
@media (min-width: 768px) and (max-width: 1023px) {
  .hero {
    min-height: auto;
    justify-content: flex-end;
    padding-top: clamp(7rem, 16vh, 11rem);
    padding-bottom: clamp(2.5rem, 6vh, 4rem);
  }
}

/* 4. Large phones in the same boat (below the deck breakpoint, above small). */
@media (min-width: 481px) and (max-width: 767px) {
  .hero {
    min-height: auto;
    justify-content: flex-end;
    padding-top: clamp(6rem, 14vh, 9rem);
    padding-bottom: clamp(2rem, 5vh, 3rem);
  }
}
'''
c += add
open(css, 'w').write(c)
print("  ~ hero->services transition (bottom-seated content + gradient bridge)")

o, cl = c.count('{'), c.count('}')
print(f"  braces {o}/{cl} {'OK' if o==cl else 'MISMATCH — STOP'}")
sys.exit(0 if o==cl else 1)
PY

echo ""
echo "Done. Review:  git --no-pager diff apps/web/app/globals.css"
