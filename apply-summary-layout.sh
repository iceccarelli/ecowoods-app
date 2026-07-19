#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# apply-summary-layout.sh
#
# The merged-on-main version of the specs/coverage section shipped the
# <summary> MARKUP but none of its LAYOUT css — so the eyebrow, title and hint
# render inline, collide, and overflow the left edge (the screenshot). This adds
# the disclosure layout that main is missing, and normalises .sx-title.
#
# Guarded + idempotent. Only appends rules that are absent. Run from repo root.
# ---------------------------------------------------------------------------
set -euo pipefail
[ -f apps/web/app/globals.css ] || { echo "ERROR: run from the repo root"; exit 1; }

python3 - << 'PY'
import re, sys
css = 'apps/web/app/globals.css'
c = open(css).read()
add = []

# --- 1. normalise .sx-title (display font, label size) ---
m = re.search(r'\.sx-title \{[^}]*\}', c)
title_css = """.sx-title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 500;
  font-size: clamp(1.15rem, 2.4vw, 1.6rem);
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--ink);
}"""
if m and 'font-display' not in m.group(0):
    c = c.replace(m.group(0), title_css, 1); add.append("sx-title -> display font/label size")
elif not m:
    c += "\n" + title_css + "\n"; add.append("sx-title (created)")
else:
    print("  = sx-title (ok)")

# --- 2. the summary LAYOUT that main is missing ---
if '.sx-summary-text' not in c:
    c += r"""

/* ============================================================
   SPECS/COVERAGE SUMMARY LAYOUT
   main merged the <summary> markup without this, so eyebrow/title/hint ran
   inline and overflowed. This is the disclosure row: text stacked on the left,
   plus-toggle pinned right.
   ============================================================ */
.sx > summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  padding: 1.6rem 1.9rem;
  -webkit-tap-highlight-color: transparent;
}
.sx > summary::-webkit-details-marker { display: none; }
.sx > summary::marker { content: ''; }
.sx > summary:hover { background: var(--hover-tint); }
.sx > summary:focus-visible {
  outline: 2px solid var(--copper-text);
  outline-offset: -3px;
  border-radius: var(--radius-xl);
}
.sx-summary-text {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
}
.sx-summary-text .eyebrow { align-self: flex-start; }
.sx-title .serif-italic {
  font-style: italic;
  color: var(--copper-text);
}
.sx-hint {
  font-size: var(--fs-sm);
  line-height: 1.5;
  color: var(--muted);
}

/* plus toggle */
.sx-plus {
  position: relative;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
}
.sx-plus::before, .sx-plus::after {
  content: '';
  position: absolute;
  top: 50%; left: 50%;
  width: 16px; height: 1.8px;
  border-radius: 2px;
  background: var(--copper);
  transform: translate(-50%, -50%);
  transition: transform 0.24s var(--ease-out-quart), opacity 0.24s;
}
.sx-plus::after { transform: translate(-50%, -50%) rotate(90deg); }
.sx[open] .sx-plus::after { transform: translate(-50%, -50%) rotate(0deg); opacity: 0; }
.sx[open] > summary { border-bottom: 1px solid var(--line); }

@media (max-width: 767px) {
  .sx > summary { padding: 1.25rem 1.15rem; gap: 0.9rem; }
  .sx-title { font-size: 1.15rem; }
  .sx-hint { font-size: var(--fs-xs); }
}
@media (prefers-reduced-motion: reduce) {
  .sx-plus::before, .sx-plus::after { transition: none; }
}
"""
    add.append("summary layout (column + plus toggle)")
else:
    print("  = summary layout (present)")

# --- 3. footer CTA hidden on mobile ---
if 'footer-cta { display: none' not in c:
    c += """

@media (max-width: 767px) {
  /* .sticky-cta-mobile already carries "Get Free Quote" on phones */
  .footer-cta { display: none; }
}
"""
    add.append("footer-cta hidden < 768px")
else:
    print("  = footer CTA hide (present)")

open(css, 'w').write(c)
for a in add: print(f"  ~ {a}")

o, cl = c.count('{'), c.count('}')
print(f"  braces {o}/{cl} {'OK' if o == cl else 'MISMATCH — STOP'}")
sys.exit(0 if o == cl else 1)
PY

echo ""
echo "Done. Review:  git --no-pager diff apps/web/app/globals.css"
