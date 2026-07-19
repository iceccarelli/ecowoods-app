#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# apply-map-swatches.sh
#
#  1. MAP v2 — v1 was 16 unlabelled dots in a ring; you could not tell Markham
#     from Mississauga. Adds a label to every node plus the 401/400/404/QEW and
#     the lake, which is how anyone in the GTA actually locates themselves.
#
#  2. SPECIES SWATCHES — a rendered plank beside every species, using the
#     base/grain hex pairs already in FloorConfigurator's SPECIES array (your
#     own calibration). `photo` field is the upgrade path for real install
#     photography.
#
# Requires apply-specs-coverage.sh to have run first.
# Usage from repo root:  bash apply-map-swatches.sh
# Idempotent.
# ---------------------------------------------------------------------------
set -euo pipefail
[ -f apps/web/app/components/SpecsCoverage.tsx ] || {
  echo "ERROR: run apply-specs-coverage.sh first"; exit 1; }

cat > apps/web/app/components/CoverageMap.tsx << 'COVEOF'
'use client';

/**
 * CoverageMap — the GTA service area, drawn.
 *
 * Every SVG primitive carries its OWN fill/stroke/font-size as a presentation
 * attribute. That is not a style preference — v3 shipped relying on globals.css
 * for these, the CSS failed to land, and the result was an unstyled <path>
 * painting a BLACK BLOB across the map with 40px labels over it. An SVG that
 * depends on a stylesheet to not be broken is a bug waiting for a bad deploy.
 * CSS below still handles theming and hover; geometry lives here.
 *
 * Why drawn rather than a Google/Mapbox embed:
 *  - Ecowoods serves whole municipalities. A street-level map implies
 *    street-level granularity that misrepresents the offer; municipality
 *    labels are more accurate to what is actually sold.
 *  - no API key, no billing account, no quota to blow on a traffic spike
 *  - no third-party cookie -> no consent banner on the trust page
 *  - ~4KB inline vs ~500KB of tiles + JS
 *
 * Geometry is schematic: relative positions are honest (Newmarket north,
 * Oakville south-west on the lake, Ajax east), shapes are stylised. A diagram
 * of coverage, not a survey — the same contract AWS's region map makes.
 */

import { useState } from 'react';

type Place = { x: number; y: number; anchor: 'start' | 'end' | 'middle'; dy: number };

/** x: west -> east, y: north -> south, in the 100 x 72 viewBox */
const PLACES: Record<string, Place> = {
  Newmarket: { x: 47, y: 6, anchor: 'middle', dy: -2.6 },
  Aurora: { x: 48, y: 12, anchor: 'start', dy: 1 },
  'Richmond Hill': { x: 50, y: 19, anchor: 'start', dy: 1 },
  Markham: { x: 64, y: 23, anchor: 'start', dy: 1 },
  Vaughan: { x: 37, y: 25, anchor: 'end', dy: 1 },
  Brampton: { x: 19, y: 31, anchor: 'end', dy: 1 },
  'North York': { x: 51, y: 38, anchor: 'start', dy: 1 },
  /* Placement solved against labels, dots AND route badges — an earlier pass
     only tested label-vs-label, which let Pickering's dot land inside the word
     'Scarborough'. */
  Scarborough: { x: 68, y: 44, anchor: 'start', dy: 1.6 },
  Pickering: { x: 79, y: 41, anchor: 'start', dy: -1.6 },
  Ajax: { x: 87, y: 44, anchor: 'start', dy: 1.8 },
  York: { x: 40, y: 45, anchor: 'end', dy: 1 },
  'East York': { x: 56, y: 47, anchor: 'start', dy: 1.6 },
  Etobicoke: { x: 30, y: 48, anchor: 'end', dy: 1 },
  Mississauga: { x: 21, y: 54, anchor: 'end', dy: 1 },
  /* above its dot — it was landing on the Gardiner badge */
  'Downtown Toronto': { x: 48, y: 57, anchor: 'middle', dy: -2.5 },
  Oakville: { x: 11, y: 61, anchor: 'middle', dy: 3 },
};

/** 32 Norfield Crescent (M3J) — Downsview, North York */
const SHOP = { x: 44, y: 37 };

const HWY = 'rgba(140,110,85,0.42)';
const INK = 'currentColor';

export default function CoverageMap({ areas }: { areas: string[] }) {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className="cov">
      <div className="cov-map">
        <svg
          viewBox="0 0 100 72"
          role="img"
          aria-label="Schematic map of the Greater Toronto Area showing the sixteen municipalities Ecowoods serves, the shop in North York, the 400-series highways and Lake Ontario."
        >
          {/* Lake Ontario — the one shape every GTA resident reads instantly */}
          <path
            className="cov-lake"
            d="M 0,72 L 0,66 Q 18,64 32,61 Q 44,60 54,60 Q 66,56 78,50 Q 90,47 100,45 L 100,72 Z"
            fill="rgba(110,130,100,0.16)"
            stroke="rgba(110,130,100,0.3)"
            strokeWidth="0.3"
          />
          <text
            className="cov-lake-label"
            x="72"
            y="67.5"
            fontSize="2.4"
            letterSpacing="0.55"
            fill={INK}
            opacity="0.5"
          >
            LAKE ONTARIO
          </text>

          {/* City of Toronto. Its north edge IS Steeles, so the boundary and the
              arterial are one line — 416 vs 905, readable at a glance. */}
          <path
            className="cov-boundary"
            d="M 29,51 L 29,33.5 L 71,32.5 L 72,48 Q 63,54 55,58.5 Q 47,59.5 39,58 Q 32,55 29,51 Z"
            fill="rgba(200,126,79,0.05)"
            stroke="rgba(200,126,79,0.4)"
            strokeWidth="0.4"
            strokeDasharray="2 1.2"
          />
          <text x="30" y="31.6" fontSize="2" fontWeight="700" letterSpacing="0.3" fill="var(--copper-text)" opacity="0.85">
            STEELES AVE
          </text>
          <text x="31.5" y="50.5" fontSize="2" fontWeight="700" letterSpacing="0.3" fill={INK} opacity="0.35">
            CITY OF TORONTO
          </text>

          {/* 400-series — how the region actually navigates */}
          <g fill="none" stroke={HWY} strokeWidth="0.5" strokeLinecap="round">
            <path d="M 4,42 Q 26,41 46,40 Q 66,39 84,37.5 L 100,36" />
            <path d="M 8,32 Q 30,30 52,27.5 Q 74,25 96,23" />
            <path d="M 36,3 Q 37,20 40,40.5" />
            <path d="M 53,3 Q 53,16 53,30" />
            <path d="M 53,30 Q 53,44 50,58" />
            <path d="M 30,27 Q 30,38 31,50" />
            <path d="M 20,24 Q 20,32 21,41" />
            <path d="M 4,58 Q 12,50 18,44 Q 21,42 24,41" />
            <path d="M 31,50 Q 22,55 12,61 Q 6,63 2,65" />
            <path d="M 36,58.6 Q 47,58.6 57,57.6" />
          </g>
          {/* arterial — lighter, because Yonge is not a highway */}
          <g fill="none" stroke={HWY} strokeWidth="0.35" strokeLinecap="round" strokeDasharray="1.6 1.1">
            <path d="M 47,5 L 47,20 Q 48,30 48,58" />
          </g>

          <g fontSize="2.4" fontWeight="700" letterSpacing="0.2" fill={INK} opacity="0.45">
            <text x="97" y="34.6" textAnchor="end">401</text>
            <text x="97" y="21.4" textAnchor="end">407</text>
            <text x="34" y="8" textAnchor="end">400</text>
            <text x="55" y="9">404</text>
            <text x="51" y="44">DVP</text>
            <text x="32.5" y="30">427</text>
            <text x="17.5" y="26" textAnchor="end">410</text>
            <text x="5" y="48">403</text>
            <text x="14.5" y="59.5">QEW</text>
            <text x="59" y="60.2">GARDINER</text>
            <text x="45.5" y="42.5" textAnchor="end">YONGE ST</text>
          </g>

          {active && PLACES[active] && (
            <line
              className="cov-spoke"
              x1={SHOP.x}
              y1={SHOP.y}
              x2={PLACES[active].x}
              y2={PLACES[active].y}
              stroke="var(--copper)"
              strokeWidth="0.4"
              strokeLinecap="round"
              opacity="0.75"
            />
          )}

          {areas
            .filter((a) => PLACES[a])
            .map((a) => {
              const p = PLACES[a];
              const on = active === a;
              const off = p.anchor === 'end' ? -2.2 : p.anchor === 'start' ? 2.2 : 0;
              return (
                <g
                  key={a}
                  className={`cov-node ${on ? 'is-on' : ''}`}
                  onMouseEnter={() => setActive(a)}
                  onMouseLeave={() => setActive(null)}
                >
                  {on && <circle cx={p.x} cy={p.y} r="4.2" fill="var(--copper)" opacity="0.18" />}
                  <circle
                    className="cov-dot"
                    cx={p.x}
                    cy={p.y}
                    r={on ? 2 : 1.3}
                    fill={on ? 'var(--copper-bright)' : 'var(--oak-500)'}
                  />
                  <text
                    className="cov-label"
                    x={p.x + off}
                    y={p.y + p.dy}
                    textAnchor={p.anchor}
                    fontSize="2.6"
                    fontWeight="600"
                    fill={INK}
                    opacity={on ? 1 : 0.78}
                  >
                    {a}
                  </text>
                </g>
              );
            })}

          {/* the shop, last, so it always sits on top */}
          <circle cx={SHOP.x} cy={SHOP.y} r="3.6" fill="var(--copper)" opacity="0.22" />
          <circle
            cx={SHOP.x}
            cy={SHOP.y}
            r="1.9"
            fill="var(--copper-deep)"
            stroke="var(--surface)"
            strokeWidth="0.5"
          />
          <text
            x={SHOP.x - 5}
            y={SHOP.y + 0.8}
            textAnchor="end"
            fontSize="2.5"
            fontWeight="700"
            letterSpacing="0.3"
            fill="var(--copper-text)"
          >
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
        Same salaried crew, same fixed pricing, every municipality above — the drive is our
        problem, not your invoice. Not listed? Call us; we travel for the right project.
      </p>
    </div>
  );
}
COVEOF
echo "  ~ CoverageMap.tsx -> v5 (collision-solved: labels, dots, badges)"

cat > apps/web/app/components/SpeciesSwatch.tsx << 'SWEOF'
'use client';

/**
 * SpeciesSwatch — a rendered plank of a given species.
 *
 * Why rendered and not a stock photo:
 *
 * The `base`/`grain` hex pairs below are lifted straight from FloorConfigurator's
 * SPECIES array — Ecowoods' OWN calibration, already used to draw the plank
 * preview in the design tool. Reusing them means the swatch beside "White Oak"
 * here is the same white oak a customer sees in the configurator. Two sources of
 * truth for what your species look like would be a bug.
 *
 * The alternative — pulling Unsplash — has a problem that is not cosmetic: I
 * cannot verify that a photo tagged "oak" is white oak rather than red oak.
 * Those are different species at different prices, and mislabelling one on a
 * page where people choose what to buy is a misrepresentation, not a design
 * choice. A rendered swatch says "this is the tone" and claims nothing it can't
 * back.
 *
 * `photo` is the upgrade path: drop in a URL of YOUR OWN floor and it takes over.
 * That is the right end state — a real Toronto install beats any stock photo,
 * and you have 5,200 of them.
 */

export type SwatchTone = { base: string; grain: string };

/** Straight from FloorConfigurator's SPECIES array — keep in sync. */
export const SPECIES_TONE: Record<string, SwatchTone> = {
  'white-oak': { base: '#c9a882', grain: '#a8865e' },
  'red-oak': { base: '#c69574', grain: '#a06f4d' },
  walnut: { base: '#6b4b34', grain: '#4a3122' },
  maple: { base: '#e0c69f', grain: '#c4a87f' },
  hickory: { base: '#c08e5e', grain: '#8a5c33' },
  /* White Ash has no configurator entry; tone read from its stated character
     ("light, Scandinavian") and kept between maple and white oak. */
  ash: { base: '#dcc7a6', grain: '#b89f7d' },
};

export default function SpeciesSwatch({
  id,
  name,
  photo,
}: {
  id: string;
  name: string;
  photo?: string;
}) {
  if (photo) {
    return (
      <div className="sp-swatch">
        <img src={photo} alt={`${name} flooring installed by Ecowoods`} loading="lazy" decoding="async" />
      </div>
    );
  }

  const t = SPECIES_TONE[id] ?? SPECIES_TONE['white-oak'];
  return (
    <div
      className="sp-swatch sp-swatch--drawn"
      role="img"
      aria-label={`${name} colour and grain`}
      style={
        {
          '--sw-base': t.base,
          '--sw-grain': t.grain,
        } as React.CSSProperties
      }
    />
  );
}
SWEOF
echo "  + SpeciesSwatch.tsx"

cat > apps/web/app/components/SpecsCoverage.tsx << 'SPXEOF'
'use client';

/**
 * SpecsCoverage — "Species & Technical Specs" + "Serving the entire GTA",
 * merged into one collapsed disclosure.
 *
 * This is reference material: the answers you go looking for once you are
 * already interested. It should cost a visitor ONE row of scroll unless they
 * ask for it. Collapsed by default, two tabs inside, same plus-toggle language
 * as the FAQ and the footer columns — one disclosure idiom across the site.
 *
 * Native <details>/<summary>: no scroll-jacking, keyboard and screen-reader
 * behaviour for free, and the content stays in the DOM (collapsed, not removed)
 * so nothing is lost for SEO.
 *
 * The detail that makes it work: the footer and nav link to #species and
 * #areas. A link that scrolls you to a closed box is a broken link. So a
 * matching hash OPENS the panel — and #areas opens it on the Coverage tab,
 * because that is what the person clicked for.
 */

import { useEffect, useId, useState } from 'react';
import CoverageMap from './CoverageMap';
import SpeciesSwatch from './SpeciesSwatch';

export type Species = {
  id: string;
  name: string;
  hardness: string;
  origin: string;
  vibe: string;
  /** drop in a URL of your own floor and it replaces the rendered swatch */
  photo?: string;
};

type Pane = 'species' | 'coverage';

export default function SpecsCoverage({
  species,
  areas,
}: {
  species: Species[];
  areas: string[];
}) {
  const [open, setOpen] = useState(false);
  const [pane, setPane] = useState<Pane>('species');
  const uid = useId();

  // A deep link must land on something readable, not a closed box.
  useEffect(() => {
    const sync = () => {
      const h = window.location.hash;
      if (h === '#species' || h === '#areas') {
        setOpen(true);
        if (h === '#areas') setPane('coverage');
      }
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

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
      {/* #areas kept as its own anchor: the footer still links to it */}
      <span id="areas" className="sx-anchor" aria-hidden="true" />

      <div className="shell">
        <details
          className="sx reveal"
          open={open}
          onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="sx-summary">
            <span className="sx-summary-text">
              <span className="eyebrow">The Detail</span>
              <span className="sx-title">
                What we work with. <span className="serif-italic">Where we work.</span>
              </span>
              <span className="sx-hint">
                {species.length} species with Janka ratings, plus every GTA municipality we serve
              </span>
            </span>
            <span className="sx-plus" aria-hidden="true" />
          </summary>

          <div className="sx-body">
            <div className="sx-tabs" role="tablist" aria-label="Specifications and coverage">
              {tab('species', 'Species & Specs', 'Over 40 stocked and sourced')}
              {tab('coverage', 'Where We Work', `All ${areas.length} GTA municipalities`)}
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
                      <SpeciesSwatch id={sp.id} name={sp.name} photo={sp.photo} />
                      <div className="species-body">
                        <div className="species-name">{sp.name}</div>
                        <div className="species-spec">
                          {sp.hardness} · {sp.origin}
                        </div>
                        <div className="species-vibe">{sp.vibe}</div>
                      </div>
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
        </details>
      </div>
    </section>
  );
}
SPXEOF
echo "  ~ SpecsCoverage.tsx -> collapsed disclosure"

python3 - << 'PY'
import re, sys
spx  = 'apps/web/app/components/SpecsCoverage.tsx'
page = 'apps/web/app/page.tsx'
css  = 'apps/web/app/globals.css'

# --- species rows get a swatch ---
s = open(spx).read()
if 'SpeciesSwatch' in s:
    print("  = SpecsCoverage (already applied)")
else:
    s = s.replace("import CoverageMap from './CoverageMap';",
                  "import CoverageMap from './CoverageMap';\nimport SpeciesSwatch from './SpeciesSwatch';", 1)
    s = s.replace("""export type Species = {
  id: string;
  name: string;
  hardness: string;
  origin: string;
  vibe: string;
};""",
"""export type Species = {
  id: string;
  name: string;
  hardness: string;
  origin: string;
  vibe: string;
  /** Optional: a photo of YOUR OWN install of this species. Overrides the
   *  drawn swatch. This is the right end state — a real Toronto floor beats
   *  any stock photo, and you have thousands of them. */
  photo?: string;
};""", 1)
    old_row = """                  <div className="species-row" key={sp.id}>
                    <div className="species-name">{sp.name}</div>
                    <div className="species-spec">
                      {sp.hardness} · {sp.origin}
                    </div>
                    <div className="species-vibe">{sp.vibe}</div>
                  </div>"""
    new_row = """                  <div className="species-row" key={sp.id}>
                    <SpeciesSwatch id={sp.id} name={sp.name} photo={sp.photo} />
                    <div className="species-body">
                      <div className="species-name">{sp.name}</div>
                      <div className="species-spec">
                        {sp.hardness} · {sp.origin}
                      </div>
                      <div className="species-vibe">{sp.vibe}</div>
                    </div>
                  </div>"""
    if old_row not in s: sys.exit("ERROR: species-row markup not found")
    s = s.replace(old_row, new_row, 1)
    open(spx, 'w').write(s)
    print("  = SpecsCoverage written above")

c = open(css).read()
if '.sp-swatch--drawn' in c:
    print("  = globals.css (already applied)")
else:
    open(css, 'a').write(r'''

/* ============================================================
   MAP v2 (labels + 400-series) and SPECIES SWATCHES
   v1 was 16 unlabelled dots: unreadable as a map. Labels + the 401/400/404/QEW
   are what make a schematic read as "the GTA" to someone who lives here.
   ============================================================ */
.cov-map svg { display: block; width: 100%; height: auto; }
.cov-hwy path {
  fill: none;
  stroke: rgba(107, 93, 82, 0.34);
  stroke-width: 0.55;
  stroke-linecap: round;
}
.cov-hwy-badge text {
  font-size: 2.3px;
  font-weight: 700;
  letter-spacing: 0.2px;
  fill: var(--muted-soft);
  paint-order: stroke;
  stroke: var(--surface-1);
  stroke-width: 1.1px;
  stroke-linejoin: round;
}
.cov-label {
  font-size: 2.35px;
  font-weight: 600;
  letter-spacing: 0.1px;
  fill: var(--muted);
  /* halo so labels stay readable where they cross a highway or the lake */
  paint-order: stroke;
  stroke: var(--surface-1);
  stroke-width: 1.1px;
  stroke-linejoin: round;
  transition: fill 0.16s ease;
  pointer-events: none;
}
.cov-node { cursor: pointer; }
.cov-node.is-on .cov-label { fill: var(--ink); }
.cov-shop-label {
  font-size: 2.5px;
  font-weight: 700;
  letter-spacing: 0.35px;
  fill: var(--copper-text);
  paint-order: stroke;
  stroke: var(--surface-1);
  stroke-width: 1.2px;
  stroke-linejoin: round;
}

/* ---- species rows: swatch + text ---- */
.species-row {
  display: grid;
  grid-template-columns: 68px 1fr;
  gap: 1.1rem;
  align-items: center;
  padding: 0.95rem 0;
  border-bottom: 1px solid var(--line);
}
.species-row:last-child { border-bottom: 0; }
.species-body {
  display: grid;
  grid-template-columns: 1.1fr 1.4fr 1.5fr;
  gap: 1rem;
  align-items: baseline;
}
.sp-swatch {
  width: 68px;
  height: 68px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--line);
  box-shadow: var(--shadow-sm);
}
.sp-swatch img { width: 100%; height: 100%; object-fit: cover; display: block; }
/* Drawn plank: three layers — base tone, grain lines, and a soft sheen, which
   is what stops it reading as a flat colour chip. Same technique the
   configurator uses for its plank preview. */
.sp-swatch--drawn {
  background-color: var(--sw-base);
  background-image:
    linear-gradient(105deg, rgba(255, 255, 255, 0.16) 0%, transparent 42%, rgba(0, 0, 0, 0.1) 100%),
    repeating-linear-gradient(
      92deg,
      transparent 0 3px,
      color-mix(in srgb, var(--sw-grain) 55%, transparent) 3px 3.7px,
      transparent 3.7px 7px
    ),
    repeating-linear-gradient(
      88deg,
      transparent 0 9px,
      color-mix(in srgb, var(--sw-grain) 30%, transparent) 9px 10px,
      transparent 10px 21px
    );
}
@media (max-width: 767px) {
  .species-row { grid-template-columns: 54px 1fr; gap: 0.85rem; }
  .sp-swatch { width: 54px; height: 54px; }
  .species-body { grid-template-columns: 1fr; gap: 0.2rem; }
}

/* --- collapsed disclosure for the merged panel --- */
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
.sx > summary:focus-visible {
  outline: 2px solid var(--copper-text);
  outline-offset: -3px;
  border-radius: var(--radius-xl);
}
.sx > summary:hover { background: var(--hover-tint); }
.sx-summary-text { display: flex; flex-direction: column; gap: 0.3rem; }
.sx-hint { font-size: var(--fs-sm); color: var(--muted); }
.sx-plus {
  position: relative;
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
}
.sx-plus::before, .sx-plus::after {
  content: '';
  position: absolute;
  top: 50%; left: 50%;
  width: 15px; height: 1.6px;
  border-radius: 2px;
  background: var(--copper);
  transform: translate(-50%, -50%);
  transition: transform 0.24s var(--ease-out-quart), opacity 0.24s;
}
.sx-plus::after { transform: translate(-50%, -50%) rotate(90deg); }
.sx[open] .sx-plus::after { transform: translate(-50%, -50%) rotate(0deg); opacity: 0; }
.sx[open] > summary { border-bottom: 1px solid var(--line); }
.sx-body { animation: sx-in 0.24s ease-out; }
@media (max-width: 767px) {
  .sx > summary { padding: 1.25rem 1.2rem; }
}

/* --- footer estimate CTA: desktop only ---
   On phones .sticky-cta-mobile already carries "Get Free Quote" (pinned, always
   visible), so the footer's full-width "Get your free estimate" is a third copy
   of the same action — pure vertical cost. Hide it under 768px; desktop keeps it. */
@media (max-width: 767px) {
  .footer-cta { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .sx-body { animation: none; }
  .sx-plus::before, .sx-plus::after { transition: none; }
}

/* --- map v3: arterials, Toronto boundary, Steeles --- */
.cov-road {
  fill: none;
  stroke: var(--line-strong);
  stroke-width: 0.35;
  stroke-linecap: round;
  stroke-dasharray: 1.6 1.1;
}
.cov-boundary {
  fill: rgba(200, 126, 79, 0.05);
  stroke: rgba(200, 126, 79, 0.4);
  stroke-width: 0.4;
  stroke-dasharray: 2 1.2;
}
.cov-boundary-label {
  font-size: 2.1px;
  font-weight: 700;
  letter-spacing: 0.35px;
  fill: var(--copper-text);
  opacity: 0.9;
}
.cov-city-label {
  font-size: 2.1px;
  font-weight: 700;
  letter-spacing: 0.35px;
  fill: var(--muted-soft);
  opacity: 0.7;
}
''')
    print("  ~ globals.css: map v4 + swatch styles")

c = open(css).read()
o, cl = c.count('{'), c.count('}')
print(f"  braces {o}/{cl} {'OK' if o == cl else 'MISMATCH — STOP'}")
sys.exit(0 if o == cl else 1)
PY

echo ""
echo "Done. Review:  git --no-pager diff --stat"
