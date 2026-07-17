#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# apply-specs-coverage.sh
#
# Merges the two back-to-back reference sections — "Species & Technical Specs"
# and "Serving the entire GTA" — into ONE tabbed panel, and adds a drawn GTA
# coverage map.
#
# Why a drawn SVG and not a Google/Mapbox embed: AWS's Global Infrastructure
# page draws its own region map. No API key, no billing, no third-party cookie
# (so no consent banner on your trust page), ~2KB instead of ~500KB of tiles,
# and it can be YOUR colours. A stock Google map on a page this art-directed
# looks like a rented pin on someone else's product.
#
# Usage from repo root:  bash apply-specs-coverage.sh
# Idempotent.
# ---------------------------------------------------------------------------
set -euo pipefail
[ -f apps/web/app/page.tsx ] || { echo "ERROR: run from the repo root"; exit 1; }

cat > apps/web/app/components/CoverageMap.tsx << 'COVEOF'
'use client';

/**
 * CoverageMap — a drawn map of the GTA service area.
 *
 * Deliberately NOT a Google/Mapbox embed. AWS's Global Infrastructure page
 * draws its own region map rather than embedding someone else's, and the
 * reasons all apply here:
 *   - no API key, no billing account, no quota to blow up on a traffic spike
 *   - no third-party cookie, so no consent banner on a page whose whole job is
 *     to feel trustworthy
 *   - ~2KB of inline SVG instead of ~500KB of map tiles + JS: it is painted
 *     before an embed would have finished its handshake
 *   - it can be OUR colours. A stock Google map on a page this carefully art
 *     directed looks like a rented pin on someone else's product.
 *
 * The geometry is schematic — relative positions are honest (Newmarket north,
 * Oakville south-west on the lake, Ajax east), the coastline is stylised. It is
 * a diagram of coverage, not a survey. That is the same contract AWS's region
 * map makes, and it is why it reads as design rather than as a broken map.
 *
 * The list and the map are one control: hovering or focusing a chip lights its
 * dot and vice versa, so the map answers "do you come to MY neighbourhood?"
 * — the only question this section exists to answer.
 */

import { useState } from 'react';

/** x: west -> east, y: north -> south, in the 100 x 72 viewBox */
const PLACES: Record<string, { x: number; y: number }> = {
  Newmarket: { x: 48, y: 7 },
  Aurora: { x: 49, y: 13 },
  'Richmond Hill': { x: 51, y: 21 },
  Markham: { x: 62, y: 25 },
  Vaughan: { x: 40, y: 27 },
  Brampton: { x: 23, y: 31 },
  'North York': { x: 49, y: 36 },
  Scarborough: { x: 68, y: 42 },
  Pickering: { x: 78, y: 43 },
  Ajax: { x: 84, y: 45 },
  York: { x: 43, y: 44 },
  'East York': { x: 55, y: 44 },
  Etobicoke: { x: 32, y: 47 },
  Mississauga: { x: 23, y: 51 },
  'Downtown Toronto': { x: 49, y: 54 },
  Oakville: { x: 14, y: 60 },
};

/** the shop — 32 Norfield Crescent sits in North York */
const SHOP = { x: 45, y: 34 };

export default function CoverageMap({ areas }: { areas: string[] }) {
  const [active, setActive] = useState<string | null>(null);
  const known = areas.filter((a) => PLACES[a]);

  return (
    <div className="cov">
      <div className="cov-map">
        <svg viewBox="0 0 100 72" role="img" aria-label="Map of Ecowoods service areas across the Greater Toronto Area">
          {/* Lake Ontario — the shoreline everyone in the GTA reads instantly,
              and the single line that makes this legible as "here" */}
          <path
            className="cov-lake"
            d="M 0,72 L 0,66 Q 18,64 32,61 Q 44,60 54,60 Q 66,56 78,50 Q 90,47 100,45 L 100,72 Z"
          />
          <text className="cov-lake-label" x="62" y="68">
            LAKE ONTARIO
          </text>

          {/* reach ring — every dot is inside one crew's drive */}
          <circle className="cov-ring" cx={SHOP.x} cy={SHOP.y} r="30" />

          {/* spokes from the shop to the active area */}
          {active && PLACES[active] && (
            <line
              className="cov-spoke"
              x1={SHOP.x}
              y1={SHOP.y}
              x2={PLACES[active].x}
              y2={PLACES[active].y}
            />
          )}

          {known.map((a) => {
            const p = PLACES[a];
            const on = active === a;
            return (
              <g key={a} className={`cov-node ${on ? 'is-on' : ''}`}>
                <circle className="cov-dot" cx={p.x} cy={p.y} r={on ? 2.4 : 1.4} />
                {on && <circle className="cov-halo" cx={p.x} cy={p.y} r="5" />}
              </g>
            );
          })}

          {/* the shop last so it always sits on top */}
          <g className="cov-shop">
            <circle className="cov-shop-halo" cx={SHOP.x} cy={SHOP.y} r="4.6" />
            <circle className="cov-shop-dot" cx={SHOP.x} cy={SHOP.y} r="2.2" />
          </g>
          <text className="cov-shop-label" x={SHOP.x + 6} y={SHOP.y + 1}>
            OUR SHOP
          </text>
        </svg>
      </div>

      {/* The list is the accessible control; the map is its picture. Keyboard
          users get the same highlight via focus. */}
      <ul className="cov-list">
        {areas.map((a) => (
          <li key={a}>
            <button
              type="button"
              className={`cov-chip ${active === a ? 'is-on' : ''}`}
              onMouseEnter={() => setActive(a)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(a)}
              onBlur={() => setActive(null)}
              onClick={() => setActive(active === a ? null : a)}
            >
              {a}
            </button>
          </li>
        ))}
      </ul>

      <p className="cov-note">
        Same salaried crew, same fixed pricing, every postal code above — the drive is our
        problem, not your invoice. Not listed? Call us; we travel for the right project.
      </p>
    </div>
  );
}
COVEOF
echo "  + components/CoverageMap.tsx"

cat > apps/web/app/components/SpecsCoverage.tsx << 'SPXEOF'
'use client';

/**
 * SpecsCoverage — "Species & Technical Specs" + "Serving the entire GTA",
 * merged into one panel.
 *
 * Why merge: both were reference material — the answers you go looking for once
 * you're already interested. They sat as two separate cards back to back, each
 * costing a full section of scroll, neither strong enough to earn one. AWS puts
 * exactly this class of content behind tabs (pricing, specs, regions): one
 * container, one heading, switch the pane.
 *
 * What each pane must still say — the merge is only worth it if nothing is lost:
 *   Species  -> mastery + sourcing. "Over 40 species... if it exists we can
 *               source it." Janka numbers are the proof it is a trade, not taste.
 *   Coverage -> reach + consistency. "Same crew, same fixed pricing." The map
 *               makes it instant: a homeowner finds their own neighbourhood and
 *               stops wondering.
 *
 * Species leads because it is the wider audience: everyone choosing a floor
 * wants it; only locals-checking-coverage want the map. The map is one tap away
 * — "shown if wanted", never imposed.
 */

import { useId, useState } from 'react';
import CoverageMap from './CoverageMap';

export type Species = {
  id: string;
  name: string;
  hardness: string;
  origin: string;
  vibe: string;
};

type Pane = 'species' | 'coverage';

export default function SpecsCoverage({
  species,
  areas,
}: {
  species: Species[];
  areas: string[];
}) {
  const [pane, setPane] = useState<Pane>('species');
  const uid = useId();

  const tab = (id: Pane, label: string, sub: string) => (
    <button
      type="button"
      role="tab"
      id={`${uid}-${id}-tab`}
      aria-selected={pane === id}
      aria-controls={`${uid}-${id}-panel`}
      className={`sx-tab ${pane === id ? 'is-on' : ''}`}
      onClick={() => setPane(id)}
    >
      <span className="sx-tab-label">{label}</span>
      <span className="sx-tab-sub">{sub}</span>
    </button>
  );

  return (
    <section className="section-tight" id="species">
      {/* #areas kept as an anchor: the footer and nav still link to it */}
      <span id="areas" className="sx-anchor" aria-hidden="true" />

      <div className="shell">
        <div className="sx reveal">
          <div className="sx-head">
            <span className="eyebrow">The Detail</span>
            <h2 className="sx-title">
              What we work with. <span className="serif-italic">Where we work.</span>
            </h2>
          </div>

          <div className="sx-tabs" role="tablist" aria-label="Specifications and coverage">
            {tab('species', 'Species & Specs', 'Over 40 stocked and sourced')}
            {tab('coverage', 'Where We Work', 'All 16 GTA municipalities')}
          </div>

          {pane === 'species' && (
            <div
              className="sx-panel"
              role="tabpanel"
              id={`${uid}-species-panel`}
              aria-labelledby={`${uid}-species-tab`}
            >
              <div className="species-table">
                {species.map((sp) => (
                  <div className="species-row" key={sp.id}>
                    <div className="species-name">{sp.name}</div>
                    <div className="species-spec">
                      {sp.hardness} · {sp.origin}
                    </div>
                    <div className="species-vibe">{sp.vibe}</div>
                  </div>
                ))}
              </div>
              <p className="sx-note">
                Reclaimed barn board, exotic species, smoked or fumed oak — if it exists, we can
                source it. Samples are brushed on your subfloor at the free consultation, so you
                choose in your own light, not ours.
              </p>
            </div>
          )}

          {pane === 'coverage' && (
            <div
              className="sx-panel"
              role="tabpanel"
              id={`${uid}-coverage-panel`}
              aria-labelledby={`${uid}-coverage-tab`}
            >
              <CoverageMap areas={areas} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
SPXEOF
echo "  + components/SpecsCoverage.tsx"

python3 - << 'PY'
import re, sys
page = 'apps/web/app/page.tsx'
css  = 'apps/web/app/globals.css'
s = open(page).read()

if 'SpecsCoverage' in s:
    print("  = page.tsx (already applied)")
else:
    # 1. import
    anchor = "import PortfolioGallery from './components/PortfolioGallery';"
    if anchor not in s: sys.exit("ERROR: import anchor missing")
    s = s.replace(anchor, "import SpecsCoverage from './components/SpecsCoverage';\n" + anchor, 1)

    # 2. replace the species <section> ... </section> block
    m = re.search(r'\n\s*\{/\* Species[^\n]*\n\s*<section className="section-tight" id="species">.*?\n\s*</section>\n', s, re.S)
    if not m: sys.exit("ERROR: species section not found")
    s = s.replace(m.group(0), "\n      <SpecsCoverage species={speciesList} areas={serviceAreas} />\n", 1)

    # 3. remove the now-merged areas <section>
    m2 = re.search(r'\n\s*\{/\* Coverage[^\n]*\n\s*<section className="section-tight" id="areas">.*?\n\s*</section>\n', s, re.S)
    if not m2: sys.exit("ERROR: areas section not found")
    s = s.replace(m2.group(0), "\n", 1)

    open(page, 'w').write(s)
    print("  ~ page.tsx: #species + #areas -> one <SpecsCoverage />")

c = open(css).read()
if '.sx-tabs {' in c:
    print("  = globals.css (already applied)")
else:
    open(css, 'a').write(r'''

/* ============================================================
   SPECS & COVERAGE — merged panel (.sx) + drawn GTA map (.cov)
   Replaces two back-to-back reference cards (#species accordion, #areas strip)
   with one tabbed panel. Same AWS move as their pricing/region tabs: one
   container, one heading, switch the pane.
   ============================================================ */
.sx {
  border: 1px solid var(--line);
  border-radius: var(--radius-xl);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.sx-anchor {
  display: block;
  position: relative;
  top: calc(var(--header-h) * -1);
}
.sx-head {
  padding: 1.9rem 1.9rem 1.4rem;
}
.sx-title {
  margin: 0;
  font-size: clamp(1.5rem, 3.4vw, 2.1rem);
  line-height: 1.12;
  letter-spacing: -0.015em;
  color: var(--ink);
}

/* ---- tabs ---- */
.sx-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  background: var(--surface-1);
}
.sx-tab {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.95rem 1.3rem;
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  text-align: left;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease;
}
.sx-tab + .sx-tab {
  border-left: 1px solid var(--line);
}
.sx-tab:hover {
  background: var(--hover-tint);
}
.sx-tab.is-on {
  background: var(--surface);
  border-bottom-color: var(--copper);
}
.sx-tab-label {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--muted);
}
.sx-tab.is-on .sx-tab-label {
  color: var(--ink);
}
.sx-tab-sub {
  font-size: var(--fs-2xs);
  color: var(--muted-soft);
}
.sx-tab:focus-visible {
  outline: 2px solid var(--copper-text);
  outline-offset: -2px;
}
.sx-panel {
  padding: 1.5rem 1.9rem 1.9rem;
  animation: sx-in 0.22s ease-out;
}
@keyframes sx-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
}
.sx-note {
  margin: 1.35rem 0 0;
  font-size: var(--fs-sm);
  line-height: 1.65;
  color: var(--muted);
}

/* ---- coverage: map + linked list ---- */
.cov {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 1.9rem;
  align-items: start;
}
.cov-map {
  border: 1px solid var(--line);
  border-radius: 16px;
  background: linear-gradient(170deg, var(--surface-1), var(--surface-2));
  padding: 0.5rem;
  overflow: hidden;
}
.cov-map svg {
  display: block;
  width: 100%;
  height: auto;
}
.cov-lake {
  fill: rgba(74, 93, 60, 0.14);
  stroke: rgba(74, 93, 60, 0.3);
  stroke-width: 0.3;
}
.cov-lake-label {
  font-size: 2.4px;
  letter-spacing: 0.5px;
  fill: var(--muted-soft);
  font-weight: 600;
}
.cov-ring {
  fill: rgba(200, 126, 79, 0.05);
  stroke: rgba(200, 126, 79, 0.28);
  stroke-width: 0.25;
  stroke-dasharray: 1.2 1.2;
}
.cov-spoke {
  stroke: var(--copper);
  stroke-width: 0.4;
  stroke-linecap: round;
  opacity: 0.75;
}
.cov-dot {
  fill: var(--oak-500);
  transition: r 0.18s ease, fill 0.18s ease;
}
.cov-node.is-on .cov-dot {
  fill: var(--copper-deep);
}
.cov-halo {
  fill: rgba(200, 126, 79, 0.2);
}
.cov-shop-halo {
  fill: rgba(200, 126, 79, 0.25);
}
.cov-shop-dot {
  fill: var(--copper-deep);
  stroke: var(--surface);
  stroke-width: 0.5;
}
.cov-shop-label {
  font-size: 2.6px;
  font-weight: 700;
  letter-spacing: 0.4px;
  fill: var(--copper-text);
}

.cov-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.cov-chip {
  padding: 0.42rem 0.85rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-full);
  background: var(--surface-1);
  color: var(--muted);
  font-size: var(--fs-xs);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.16s ease;
}
.cov-chip:hover,
.cov-chip.is-on {
  border-color: var(--copper);
  background: var(--hover-tint);
  color: var(--ink);
}
.cov-chip:focus-visible {
  outline: 2px solid var(--copper-text);
  outline-offset: 2px;
}
.cov-note {
  grid-column: 1 / -1;
  margin: 0;
  font-size: var(--fs-sm);
  line-height: 1.65;
  color: var(--muted);
}

@media (max-width: 860px) {
  .cov {
    grid-template-columns: 1fr;
    gap: 1.35rem;
  }
}
@media (max-width: 767px) {
  .sx-head {
    padding: 1.5rem 1.2rem 1.1rem;
  }
  .sx-panel {
    padding: 1.2rem;
  }
  .sx-tab {
    padding: 0.8rem 0.9rem;
  }
  .sx-tab-sub {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .sx-panel {
    animation: none;
  }
  .cov-dot {
    transition: none;
  }
}
''')
    print("  ~ globals.css: .sx + .cov styles")

c = open(css).read()
o, cl = c.count('{'), c.count('}')
print(f"  braces {o}/{cl} {'OK' if o == cl else 'MISMATCH — STOP'}")
sys.exit(0 if o == cl else 1)
PY

echo ""
echo "Done. Review:  git --no-pager diff --stat"
