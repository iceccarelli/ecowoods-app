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
 * v2. The first pass was 16 unlabelled dots in a ring: you could not tell
 * Markham from Mississauga, so it read as a diagram of dots, not a map. Three
 * things make a schematic read as "here" to someone who lives here:
 *
 *   1. LABELS on every node. Non-negotiable — a map you must hover to read is
 *      not a map.
 *   2. The 400-series. In the GTA the highways ARE the mental map: the 401
 *      east-west, the 400 and 404 north, the QEW peeling south-west to
 *      Oakville. People here locate themselves off those before anything else.
 *   3. Lake Ontario's shoreline, which says "south" without a compass.
 *
 * Still deliberately NOT a tile embed. AWS draws its own region map, and the
 * reasons hold here: no API key or billing to blow up on a traffic spike, no
 * third-party cookie on the page whose whole job is trust, ~3KB inline instead
 * of ~500KB of tiles, and it can be our colours. The question this section
 * answers is "do you come to MY area?" — a labelled diagram answers that faster
 * than a pannable street map, because the answer is already on screen.
 *
 * Geometry is schematic: relative positions are honest, distances are not to
 * scale. Same contract AWS's region map makes.
 */

import { useState } from 'react';

type Place = { x: number; y: number; anchor?: 'start' | 'end' | 'middle'; dy?: number };

/** x: west -> east, y: north -> south, in the 100 x 74 viewBox */
const PLACES: Record<string, Place> = {
  Newmarket: { x: 47, y: 6, anchor: 'start', dy: -2.4 },
  Aurora: { x: 48, y: 12, anchor: 'start', dy: -2.4 },
  'Richmond Hill': { x: 50, y: 20, anchor: 'start', dy: -2.4 },
  Markham: { x: 64, y: 24, anchor: 'start', dy: -2.4 },
  Vaughan: { x: 38, y: 26, anchor: 'end', dy: -2.4 },
  Brampton: { x: 21, y: 31, anchor: 'end', dy: -2.4 },
  'North York': { x: 49, y: 36, anchor: 'start', dy: 3.6 },
  Scarborough: { x: 69, y: 41, anchor: 'start', dy: -2.4 },
  Pickering: { x: 80, y: 44, anchor: 'start', dy: 3.4 },
  Ajax: { x: 87, y: 47, anchor: 'start', dy: 3.4 },
  York: { x: 41, y: 45, anchor: 'end', dy: 0.8 },
  'East York': { x: 56, y: 44, anchor: 'start', dy: -2.4 },
  Etobicoke: { x: 30, y: 48, anchor: 'end', dy: 0.8 },
  Mississauga: { x: 21, y: 53, anchor: 'end', dy: 0.8 },
  'Downtown Toronto': { x: 49, y: 55, anchor: 'middle', dy: 4 },
  Oakville: { x: 11, y: 61, anchor: 'start', dy: 3.4 },
};

/** the shop — 32 Norfield Crescent, M3J: Downsview, North York */
const SHOP = { x: 44, y: 33 };

export default function CoverageMap({ areas }: { areas: string[] }) {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className="cov">
      <div className="cov-map">
        <svg
          viewBox="0 0 100 74"
          role="img"
          aria-label="Schematic map of Ecowoods service areas across the Greater Toronto Area, from Newmarket in the north to Oakville in the south-west and Ajax in the east"
        >
          {/* --- Lake Ontario --- */}
          <path
            className="cov-lake"
            d="M 0,74 L 0,67 Q 16,65 30,62 Q 44,61 54,61 Q 66,57 78,51 Q 90,48 100,46 L 100,74 Z"
          />
          <text className="cov-lake-label" x="60" y="70">LAKE ONTARIO</text>

          {/* --- the 400-series: how anyone here actually navigates --- */}
          <g className="cov-hwy">
            <path d="M 8,42 Q 30,40.5 50,40 Q 70,39.5 96,38" />
            <path d="M 36,0 Q 37,20 42,40" />
            <path d="M 55,10 Q 55,26 54,40 Q 53,50 50,58" />
            <path d="M 29,26 Q 30,36 31,50" />
            <path d="M 31,50 Q 22,55 12,61 Q 6,63 2,65" />
          </g>
          <g className="cov-hwy-badge">
            <text x="51" y="38.2">401</text>
            <text x="36.4" y="9">400</text>
            <text x="56.2" y="16">404</text>
            <text x="14" y="59.5">QEW</text>
          </g>

          {/* --- one crew, one drive --- */}
          <circle className="cov-ring" cx={SHOP.x} cy={SHOP.y} r="31" />

          {active && PLACES[active] && (
            <line className="cov-spoke" x1={SHOP.x} y1={SHOP.y} x2={PLACES[active].x} y2={PLACES[active].y} />
          )}

          {/* --- the areas --- */}
          {areas.filter((a) => PLACES[a]).map((a) => {
            const p = PLACES[a];
            const on = active === a;
            return (
              <g
                key={a}
                className={`cov-node ${on ? 'is-on' : ''}`}
                onMouseEnter={() => setActive(a)}
                onMouseLeave={() => setActive(null)}
              >
                {on && <circle className="cov-halo" cx={p.x} cy={p.y} r="4.6" />}
                <circle className="cov-dot" cx={p.x} cy={p.y} r={on ? 2 : 1.3} />
                <text
                  className="cov-label"
                  x={p.anchor === 'end' ? p.x - 2.2 : p.anchor === 'start' ? p.x + 2.2 : p.x}
                  y={p.y + (p.dy ?? -2.4)}
                  textAnchor={p.anchor ?? 'start'}
                >
                  {a}
                </text>
              </g>
            );
          })}

          {/* --- the shop, last so it sits on top --- */}
          <g className="cov-shop">
            <circle className="cov-shop-halo" cx={SHOP.x} cy={SHOP.y} r="4.4" />
            <circle className="cov-shop-dot" cx={SHOP.x} cy={SHOP.y} r="2.1" />
          </g>
          <text className="cov-shop-label" x={SHOP.x - 5.6} y={SHOP.y - 4}>OUR SHOP</text>
        </svg>
      </div>

      {/* The list is the accessible control; the map is its picture. */}
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
        Same salaried crew, same fixed pricing, every name above — the drive is our problem, not
        your invoice. Not listed? Call us; we travel for the right project.
      </p>
    </div>
  );
}
COVEOF
echo "  ~ CoverageMap.tsx -> v2 (labels + 400-series)"

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
    print("  ~ SpecsCoverage: swatch added to each species row")

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
''')
    print("  ~ globals.css: map v2 + swatch styles")

c = open(css).read()
o, cl = c.count('{'), c.count('}')
print(f"  braces {o}/{cl} {'OK' if o == cl else 'MISMATCH — STOP'}")
sys.exit(0 if o == cl else 1)
PY

echo ""
echo "Done. Review:  git --no-pager diff --stat"
