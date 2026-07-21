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

/** 32 Norfield Crescent, Etobicoke (M9W) */
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
