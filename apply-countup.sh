#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# apply-countup.sh — installs the scroll-triggered count-up hero stats.
#
# Uses CONTENT matching, not line numbers, so it applies regardless of how much
# globals.css/page.tsx have drifted since the patch was cut. Idempotent: run it
# twice and the second run reports "already applied" instead of duplicating.
#
# Usage, from the repo root:
#   bash apply-countup.sh
# ---------------------------------------------------------------------------
set -euo pipefail

WEB="apps/web/app"
[ -f "$WEB/page.tsx" ] || { echo "ERROR: run this from the repo root"; exit 1; }

# --- 1. the component ------------------------------------------------------
cat > "$WEB/components/CountUp.tsx" << 'TSX'
'use client';

/**
 * CountUp — a number that rolls from 0 to its target when it scrolls into view.
 *
 * Re-arms on exit, so it replays every time the stat re-enters the viewport
 * (and on every page load) rather than firing once and going inert.
 *
 * Details that matter:
 *  - IntersectionObserver, not a scroll listener: no main-thread work while the
 *    bar is off-screen.
 *  - requestAnimationFrame with an ease-out curve, so it decelerates into the
 *    final value. Linear counters read as slot machines.
 *  - The element reserves its FINAL width up front (a hidden sizer holding the
 *    finished string). Without it, "0" -> "5,200" widens mid-flight and shoves
 *    the row around — undoing the subgrid alignment.
 *  - prefers-reduced-motion: renders the final value immediately. Numbers
 *    ticking in peripheral vision is a real vestibular trigger.
 *  - Assistive tech gets the FINAL number once, never the intermediate ticks.
 */

import { useEffect, useRef, useState } from 'react';

const DURATION = 1600; // ms — deliberate, not frantic

/** ease-out expo: fast start, soft landing */
const ease = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

export default function CountUp({
  to,
  decimals = 0,
  unit = '',
}: {
  to: number;
  decimals?: number;
  unit?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const raf = useRef<number | null>(null);
  const [value, setValue] = useState(0);
  const [reduced, setReduced] = useState(false);

  const fmt = (n: number) =>
    n.toLocaleString('en-CA', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      setReduced(true);
      setValue(to);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const run = () => {
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min((now - start) / DURATION, 1);
        setValue(to * ease(t));
        if (t < 1) raf.current = requestAnimationFrame(step);
      };
      raf.current = requestAnimationFrame(step);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          run();
        } else {
          if (raf.current) cancelAnimationFrame(raf.current);
          setValue(0);
        }
      },
      { threshold: 0.4 },
    );

    io.observe(el);
    return () => {
      io.disconnect();
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [to]);

  return (
    <span ref={ref} className="countup">
      <span className="countup-sizer" aria-hidden="true">
        {fmt(to)}
        {unit}
      </span>
      <span className="countup-live" aria-hidden="true">
        {fmt(reduced ? to : value)}
        {unit}
      </span>
      <span className="sr-only">
        {fmt(to)}
        {unit}
      </span>
    </span>
  );
}
TSX
echo "  + components/CountUp.tsx"

# --- 2. page.tsx + globals.css, matched on content -------------------------
python3 - << 'PY'
import sys, re

page = 'apps/web/app/page.tsx'
css  = 'apps/web/app/globals.css'
s = open(page).read()
changed = False

# 2a. import
if 'CountUp' not in s:
    anchor = "import PortfolioGallery from './components/PortfolioGallery';"
    if anchor not in s:
        sys.exit("ERROR: import anchor not found in page.tsx")
    s = s.replace(anchor, "import CountUp from './components/CountUp';\n" + anchor, 1)
    changed = True

# 2b. trustStats -> numeric targets. Matched by regex so it works whatever the
#     4th stat currently is.
m = re.search(r'const trustStats = \[.*?\n\];', s, re.S)
if not m:
    sys.exit("ERROR: trustStats block not found")
if "{ to: 25," not in m.group(0):
    s = s.replace(m.group(0), """const trustStats = [
  { to: 25, em: '+', lbl: 'Years in Toronto' },
  { to: 5200, em: '+', lbl: 'Homes Transformed' },
  { to: 4.9, decimals: 1, em: '\u2605', lbl: '348 Verified Reviews' },
  /**
   * \u26a0\ufe0f VERIFY BEFORE THIS STAYS UP. 2.5M is not measured — it is the lowest
   * figure internally consistent with the site's own claims: 5,200 homes x
   * ~500 sq ft/home = 2.6M sq ft, implying ~$4.81/sq ft against $500k/yr x
   * 25 yrs. Rounded DOWN: under-claiming is safe, over-claiming is not.
   * Replace with the real number from the job book.
   */
  { to: 2.5, decimals: 1, unit: 'M', em: '+', lbl: 'Sq Ft Sanded & Finished' },
];""", 1)
    changed = True

# 2c. render the value through CountUp
old_jsx = """                <div className="val">
                  {s.val}
                  {s.em && <em>{s.em}</em>}
                </div>"""
new_jsx = """                <div className="val">
                  <CountUp to={s.to} decimals={s.decimals} unit={s.unit} />
                  {s.em && <em>{s.em}</em>}
                </div>"""
if old_jsx in s:
    s = s.replace(old_jsx, new_jsx, 1)
    changed = True
elif '<CountUp' not in s:
    sys.exit("ERROR: hero-stat .val block not found and CountUp not wired")

open(page, 'w').write(s)
print("  ~ page.tsx" if changed else "  = page.tsx (already applied)")

# 2d. CSS — pure append, guarded so re-runs don't duplicate
c = open(css).read()
add = ""
if '.countup {' not in c:
    add += """

/* ============================================================
   COUNTUP — rolling hero numbers
   The live number sits over a hidden sizer holding the FINAL string, so the
   element is born at its finished width. Counting from "0" to "5,200" would
   otherwise widen the cell mid-animation and shove the trust bar around.
   ============================================================ */
.countup {
  position: relative;
  display: inline-grid;
  font-variant-numeric: tabular-nums lining-nums;
}
.countup-sizer {
  visibility: hidden;
  grid-area: 1 / 1;
}
.countup-live {
  grid-area: 1 / 1;
  justify-self: start;
  white-space: nowrap;
}
"""
if not re.search(r'^\.sr-only\s*\{', c, re.M):
    add += """
/* visually-hidden utility — this codebase had none; the decks each rolled
   their own (.pfd-sr, .svt-sr). One definition, reusable. */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
"""
if add:
    open(css, 'a').write(add)
    print("  ~ globals.css")
else:
    print("  = globals.css (already applied)")

# sanity: braces must balance
c = open(css).read()
o, cl = c.count('{'), c.count('}')
print(f"  braces {o}/{cl} {'OK' if o == cl else 'MISMATCH — STOP'}")
if o != cl:
    sys.exit(1)
PY

echo ""
echo "Done. Review with:  git diff"
