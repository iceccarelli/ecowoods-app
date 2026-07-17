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
