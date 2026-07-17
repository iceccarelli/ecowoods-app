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
  Newmarket: { x: 47, y: 6, anchor: 'middle', dy: -2.6 },
  Aurora: { x: 48, y: 12, anchor: 'start', dy: 1 },
  'Richmond Hill': { x: 50, y: 19, anchor: 'start', dy: 1 },
  Markham: { x: 64, y: 23, anchor: 'start', dy: 1 },
  Vaughan: { x: 37, y: 25, anchor: 'end', dy: 1 },
  Brampton: { x: 19, y: 31, anchor: 'end', dy: 1 },
  'North York': { x: 51, y: 38, anchor: 'start', dy: 1 },
  Scarborough: { x: 68, y: 45, anchor: 'start', dy: 1 },
  /* Pickering above-right, Ajax below-right: they sat on top of each other */
  Pickering: { x: 79, y: 41, anchor: 'start', dy: -1.6 },
  Ajax: { x: 87, y: 44, anchor: 'start', dy: 1.8 },
  York: { x: 40, y: 45, anchor: 'end', dy: 1 },
  'East York': { x: 56, y: 46, anchor: 'start', dy: 1 },
  Etobicoke: { x: 30, y: 48, anchor: 'end', dy: 1 },
  Mississauga: { x: 21, y: 54, anchor: 'end', dy: 1 },
  'Downtown Toronto': { x: 48, y: 57, anchor: 'middle', dy: 3.6 },
  Oakville: { x: 11, y: 61, anchor: 'middle', dy: 3 },
};

/** the shop — 32 Norfield Crescent, M3J: Downsview, North York */
const SHOP = { x: 44, y: 37 };

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
          {/* --- 400-series: the spines everyone navigates by --- */}
          <g className="cov-hwy">
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
          {/* --- arterials: not highways, so drawn lighter --- */}
          <g className="cov-road">
            <path d="M 47,5 L 47,20 Q 48,30 48,58" />
          </g>
          <g className="cov-hwy-badge">
            <text x="94" y="34.6">401</text>
            <text x="91" y="21.4">407</text>
            <text x="34" y="8">400</text>
            <text x="55.5" y="9">404</text>
            <text x="55.5" y="52">DVP</text>
            <text x="32.5" y="30">427</text>
            <text x="17.5" y="26">410</text>
            <text x="7" y="53">403</text>
            <text x="14.5" y="59.5">QEW</text>
            <text x="33" y="61">GARDINER</text>
            <text x="46.5" y="50" textAnchor="end">YONGE ST</text>
          </g>

          {/* City of Toronto — its northern edge IS Steeles, so the boundary
              and the arterial are the same line. 416 vs 905, readable at a glance. */}
          <path
            className="cov-boundary"
            d="M 29,51 L 29,33.5 L 71,32.5 L 72,48 Q 63,54 55,58.5 Q 47,59.5 39,58 Q 32,55 29,51 Z"
          />
          <text className="cov-boundary-label" x="30" y="31.6">STEELES AVE</text>
          <text className="cov-city-label" x="31" y="53.5">CITY OF TORONTO</text>

          {/* --- one crew, one drive --- */}

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
