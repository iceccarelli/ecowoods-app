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
