#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# apply-scale-cards-fab.sh
#
#  1. TYPE SCALE — globals.css had 41 distinct fixed font-sizes and ZERO type
#     tokens. Eight of them (0.78/0.8/0.82/0.85/0.88/0.9/0.92/0.95rem) live
#     inside a 0.17rem band: visually identical, structurally inconsistent.
#     This defines 9 semantic steps and snaps every body-range declaration to
#     the nearest one. 96% move by <1.2px — imperceptible individually, but the
#     page stops improvising. Display sizes (>=1.6rem) are left alone: those are
#     deliberate, not drift.
#
#  2. SECTION CARDS — the footer card proved the AWS pattern. #services and
#     #quote get the same treatment: inset dark cards with rounded corners, so
#     each section reads as a distinct object instead of a full-bleed band.
#
#  3. CHAT LAUNCHER — it is fixed at bottom-right, so it sat on top of the hero
#     trust stats: the first thing a visitor reads. It now fades in only after
#     the hero leaves the viewport. AWS does the same; nothing should interrupt
#     the first impression.
#
# Usage from repo root:  bash apply-scale-cards-fab.sh
# Idempotent.
# ---------------------------------------------------------------------------
set -euo pipefail
[ -f apps/web/app/page.tsx ] || { echo "ERROR: run from the repo root"; exit 1; }

python3 - << 'PY'
import re, sys

css  = 'apps/web/app/globals.css'
page = 'apps/web/app/page.tsx'
chat = 'apps/web/app/components/ChatWidget.tsx'

c = open(css).read()

# =====================================================================
# 1. TYPE SCALE
# =====================================================================
SCALE = [('3xs',0.6875),('2xs',0.75),('xs',0.8125),('sm',0.875),
         ('base',1.0),('md',1.125),('lg',1.25),('xl',1.5)]
CEILING = 1.6   # above this we're in display territory — hands off

if '--fs-base:' not in c:
    tokens = """
  /* Type scale — 8 body steps + display handled by clamp().
     Before this, 41 distinct fixed sizes were in play with no tokens; eight of
     them sat inside a 0.17rem band. A small enforced scale is most of what
     makes AWS/Linear/Apple feel calm to read. Snap to these; do not invent
     new sizes. */
  --fs-3xs: 0.6875rem;
  --fs-2xs: 0.75rem;
  --fs-xs: 0.8125rem;
  --fs-sm: 0.875rem;
  --fs-base: 1rem;
  --fs-md: 1.125rem;
  --fs-lg: 1.25rem;
  --fs-xl: 1.5rem;

  /* Spacing rhythm"""
    if '\n  /* Spacing rhythm' not in c:
        print("  ! type tokens: anchor not found — SKIPPED"); 
    else:
        c = c.replace('\n  /* Spacing rhythm', tokens, 1)
        print("  ~ type scale tokens added")
else:
    print("  = type tokens (already applied)")

def nearest(x):
    return min(SCALE, key=lambda kv: abs(kv[1]-x))

def snap(m):
    val = m.group(1)
    try:
        f = float(val)
    except ValueError:
        return m.group(0)
    if f >= CEILING:
        return m.group(0)          # display size, leave it
    name, _ = nearest(f)
    return f'font-size: var(--fs-{name});'

before = len(re.findall(r'font-size:\s*([\d.]+)rem;', c))
c = re.sub(r'font-size:\s*([\d.]+)rem;', snap, c)
after = len(re.findall(r'font-size:\s*([\d.]+)rem;', c))
if before:
    print(f"  ~ font-size: {before} fixed-rem decls -> {after} left (display sizes kept)")
else:
    print("  = font-sizes (already tokenised)")

# =====================================================================
# 2. SECTION CARDS
# =====================================================================
if 'SECTION CARDS' not in c:
    c += """

/* ============================================================
   SECTION CARDS — the AWS pattern, extended
   The footer proved it: a dark block inset from the page edge with rounded
   corners reads as a distinct OBJECT, where a full-bleed band just reads as
   more page. #services and #quote are the two dark sections, so they get the
   same treatment. overflow:hidden is what clips their photo/texture
   backgrounds to the radius.
   ============================================================ */
.section--card {
  margin-left: auto;
  margin-right: auto;
  max-width: calc(var(--shell-max) + (var(--shell-pad) * 2) + 4rem);
  border-radius: 32px;
  overflow: hidden;
  /* the shell already pads; the card edge must not double it */
  isolation: isolate;
}
@media (max-width: 767px) {
  .section--card {
    margin-left: 0.75rem;
    margin-right: 0.75rem;
    border-radius: 22px;
  }
}
/* cards sit on the page background, so consecutive ones need air between them */
.section--card + .section--card {
  margin-top: 1.25rem;
}

/* ============================================================
   CHAT LAUNCHER — out of the hero
   Fixed bottom-right, it landed squarely on the hero trust stats: the first
   thing a visitor reads. It now fades in once the hero is behind them.
   ============================================================ */
.rg-dock {
  transition: opacity 0.35s ease, transform 0.35s ease;
}
.rg-dock[data-hero='true'] {
  opacity: 0;
  transform: translateY(12px) scale(0.9);
  pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  .rg-dock {
    transition: none;
  }
}
"""
    print("  ~ section-card + rg-dock styles")
else:
    print("  = section cards (already applied)")

open(css, 'w').write(c)

# =====================================================================
# 2b. apply .section--card to the two dark sections
# =====================================================================
s = open(page).read()
n = 0
if 'section photo-bg-section section--card' not in s:
    s2 = s.replace('className="section photo-bg-section"',
                   'className="section photo-bg-section section--card"', 1)
    if s2 != s: s, n = s2, n+1
if 'wood-grain-dark noise-overlay section--card' not in s:
    s2 = s.replace('className="section wood-grain-dark noise-overlay" id="quote"',
                   'className="section wood-grain-dark noise-overlay section--card" id="quote"', 1)
    if s2 != s: s, n = s2, n+1
open(page, 'w').write(s)
print(f"  ~ section--card applied to {n} dark section(s)" if n else "  = dark sections (already carded)")

# =====================================================================
# 3. CHAT LAUNCHER — hero-aware
# =====================================================================
w = open(chat).read()
if 'rg-dock' in w:
    print("  = chat launcher (already applied)")
else:
    anchor = "<div style={{ position: 'fixed', bottom: 'var(--fab-inset)', right: 'var(--fab-inset-x)', zIndex: 130, display: 'flex', alignItems: 'flex-end', gap: 10 }}>"
    if anchor not in w:
        print("  ! chat launcher: anchor not found — SKIPPED (tell Claude)")
    else:
        w = w.replace(anchor,
            "<div className=\"rg-dock\" data-hero={overHero} style={{ position: 'fixed', bottom: 'var(--fab-inset)', right: 'var(--fab-inset-x)', zIndex: 130, display: 'flex', alignItems: 'flex-end', gap: 10 }}>", 1)

        # inject the observer right after the first hook line we can find
        hook = re.search(r'\n(\s*)const \[open, setOpen\] = useState[^\n]*\n', w)
        if not hook:
            print("  ! chat launcher: no state anchor — SKIPPED")
        else:
            ind = hook.group(1)
            inject = hook.group(0) + f"""
{ind}/* The launcher is position:fixed, so it parked on top of the hero trust
{ind}   stats — the first thing anyone reads. Hide it until the hero is behind
{ind}   them. IntersectionObserver, not a scroll handler: no main-thread work. */
{ind}const [overHero, setOverHero] = useState(true);
{ind}useEffect(() => {{
{ind}  const hero = document.getElementById('hero');
{ind}  if (!hero) {{ setOverHero(false); return; }}
{ind}  const io = new IntersectionObserver(
{ind}    ([e]) => setOverHero(e.isIntersecting && e.intersectionRatio > 0.25),
{ind}    {{ threshold: [0, 0.25, 0.5] }},
{ind}  );
{ind}  io.observe(hero);
{ind}  return () => io.disconnect();
{ind}}}, []);
"""
            w = w.replace(hook.group(0), inject, 1)
            if 'useEffect' not in w.split('\n')[0:12][0] and not re.search(r'import .*useEffect.*from \'react\'', w):
                w = re.sub(r"(import \{)([^}]*)(\} from 'react';)",
                           lambda m: m.group(1)+m.group(2)+(', useEffect' if 'useEffect' not in m.group(2) else '')+m.group(3),
                           w, count=1)
            open(chat, 'w').write(w)
            print("  ~ chat launcher hides over hero")

# sanity
c = open(css).read()
o, cl = c.count('{'), c.count('}')
print(f"  braces {o}/{cl} {'OK' if o == cl else 'MISMATCH — STOP'}")
sys.exit(0 if o == cl else 1)
PY

echo ""
echo "Done. Review:  git --no-pager diff --stat"
