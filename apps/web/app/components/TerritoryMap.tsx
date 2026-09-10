'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CORRIDORS, MARKETS, type Corridor, type Market } from '@/lib/geo';

/**
 * TerritoryMap — the whole corridor, drawn from the registry, one region lit at
 * a time.
 *
 * WHAT IT REPLACED, AND WHY THAT MATTERED
 *
 * A static illustration of the Greater Toronto Area with dots on it. It was
 * accurate the month it was drawn and became a factual error the day the map
 * reached Hamilton: a page whose headline is "the same work everywhere" showing
 * a picture of one sixth of everywhere. An image cannot be checked by a guard,
 * so it went stale silently and would have gone stale again.
 *
 * This reads CORRIDORS and MARKETS. Add a municipality to the registry and it
 * appears here; there is no second list of places to forget to update, and
 * scripts/verify-geo-green.mjs already refuses a market that is not on a
 * corridor — which is exactly the condition this map needs to draw one.
 *
 * WHY SCHEMATIC RATHER THAN A TILE MAP
 *
 * The same contract the old map made and the same one AWS's region map makes:
 * relative positions are honest — Barrie north, Hamilton at the head of the
 * lake, the Niagara belt down the peninsula, Buffalo across the river, Rochester
 * east along the south shore — and the shapes are stylised. No API key, no
 * third-party cookie, no consent banner on a coverage page, and about four
 * kilobytes instead of half a megabyte of tiles.
 *
 * A corridor is a DRIVE, so it is drawn as one: a spine with its municipalities
 * strung along it in travel order, which is the order the registry stores them
 * in. The territory around each spine is the same path drawn wide and soft. The
 * geometry is therefore generated from the data rather than positioned by hand,
 * and a corridor gaining a member lengthens the spine instead of colliding with
 * a label.
 *
 * THE CYCLE
 *
 * One corridor holds the light while the rest fall back; every few seconds it
 * passes to the next. That is not decoration for its own sake — with a hundred
 * and one markets, a map that shows everything at once shows nothing, and the
 * cycle is what lets a reader see the shape of each route and the whole
 * territory in the same thirty seconds.
 *
 * Hover or focus a region to hold it. Move away and the cycle resumes, the same
 * contract the proof slider makes: it moves by itself and yields instantly.
 * `prefers-reduced-motion` stops the cycle and lights every region at once,
 * which is the honest still frame of the same fact.
 *
 * WHAT A MACHINE GETS
 *
 * Not the picture. The <svg> carries a role and a full label, and underneath it
 * every corridor and every municipality is listed as ordinary text in a real
 * list. Nothing about this component's territory is only available to something
 * that can rasterise an SVG.
 */

/**
 * The spine of each corridor: west→east, north→south, in the 200×112 viewBox.
 * Two to four points each, and the municipalities distribute along them in the
 * travel order the registry stores.
 *
 * These twelve pairs of numbers are the only hand-placed geometry in the file.
 * They are a schematic of southern Ontario and western New York and they are
 * checked against nothing, which is why they are here at the top where they can
 * be read rather than buried among the paths that use them.
 */
export const SPINES: Record<string, Array<[number, number]>> = {
  'core-gta': [[62, 55], [78, 50], [92, 52]],
  '400-north': [[76, 47], [74, 33], [72, 19]],
  '401-east': [[80, 50], [102, 45], [124, 36]],
  '407-york-peel': [[58, 44], [76, 41], [96, 43]],
  'qew-west': [[70, 57], [60, 63], [50, 70]],
  '403-6-west': [[48, 70], [36, 66], [24, 62]],
  'niagara-belt': [[54, 74], [62, 82], [72, 90]],
  'buffalo-niagara': [[74, 92], [82, 96], [92, 97]],
  'buffalo-metro': [[90, 99], [100, 103], [110, 100]],
  'rochester-east': [[130, 88], [142, 92], [154, 88]],
  'cottage-north-east': [[74, 22], [96, 26], [116, 32]],
};

/** Lake Ontario, Lake Erie and the river between the two countries. */
export const VIEWBOX = { w: 200, h: 114 } as const;

const LAKE_ONTARIO =
  'M 58,66 Q 84,58 118,60 Q 152,62 176,72 Q 152,86 118,88 Q 84,88 66,78 Z';
const LAKE_ERIE = 'M 36,96 Q 58,90 76,94 Q 70,110 44,112 Q 30,106 36,96 Z';
const BORDER = 'M 72,88 L 78,94 L 86,99 L 104,104 L 128,102 L 150,96 L 170,88';

const pointsToPath = (pts: Array<[number, number]>): string => {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M ${pts[0][0]},${pts[0][1]} L ${pts[1][0]},${pts[1][1]}`;
  const [a, b, c] = pts;
  return `M ${a[0]},${a[1]} Q ${b[0]},${b[1]} ${c[0]},${c[1]}`;
};

/** A point at t∈[0,1] along a quadratic spine. Where a municipality sits. */
export function along(pts: Array<[number, number]>, t: number): [number, number] {
  if (pts.length < 3) {
    const [a, b] = pts;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
  const [a, b, c] = pts;
  const u = 1 - t;
  return [
    u * u * a[0] + 2 * u * t * b[0] + t * t * c[0],
    u * u * a[1] + 2 * u * t * b[1] + t * t * c[1],
  ];
}

/**
 * A small deterministic offset so a run of municipalities reads as a territory
 * rather than as beads on a wire. Deterministic on the slug, so the map is
 * identical on the server and the client and identical between deploys — a
 * random jitter here would produce a hydration mismatch on every render.
 */
export function jitter(slug: string): [number, number] {
  let h = 0;
  for (let i = 0; i < slug.length; i += 1) h = (h * 31 + slug.charCodeAt(i)) | 0;
  return [(((h >> 3) & 15) - 7.5) * 0.42, (((h >> 9) & 15) - 7.5) * 0.42];
}

const CYCLE_MS = 3600;

export default function TerritoryMap() {
  const [lit, setLit] = useState(0);
  const [held, setHeld] = useState<string | null>(null);
  const [still, setStill] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  /** Corridors that have a spine, with their markets placed along it. */
  const regions = useMemo(
    () =>
      CORRIDORS.filter((c: Corridor) => SPINES[c.id]).map((c: Corridor) => {
        const pts = SPINES[c.id]!;
        const members = c.members
          .map((slug) => MARKETS.find((m: Market) => m.slug === slug))
          .filter((m): m is Market => Boolean(m));
        return {
          id: c.id,
          name: c.name,
          route: c.route,
          country: members.some((m) => m.country === 'US') ? 'US' : 'CA',
          path: pointsToPath(pts),
          dots: members.map((m, i) => {
            const t = members.length === 1 ? 0.5 : i / (members.length - 1);
            const [x, y] = along(pts, 0.06 + t * 0.88);
            const [jx, jy] = jitter(m.slug);
            return { slug: m.slug, name: m.name, x: x + jx, y: y + jy };
          }),
          markets: members,
        };
      }),
    [],
  );

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (reduced?.matches) { setStill(true); return undefined; }

    let visible = true;
    const el = wrapRef.current;
    const io = el
      ? new IntersectionObserver(([e]) => { visible = Boolean(e?.isIntersecting); }, { threshold: 0.2 })
      : null;
    if (io && el) io.observe(el);

    const timer = window.setInterval(() => {
      if (!visible || held) return;
      setLit((n) => (n + 1) % regions.length);
    }, CYCLE_MS);

    return () => { window.clearInterval(timer); io?.disconnect(); };
  }, [regions.length, held]);

  const activeId = held ?? (still ? null : regions[lit]?.id ?? null);
  const active = regions.find((r) => r.id === activeId) ?? null;
  const totalMarkets = MARKETS.length;
  const ontario = MARKETS.filter((m: Market) => m.country === 'CA').length;

  return (
    <div className="tm" ref={wrapRef} data-still={still ? '1' : '0'}>
      <svg
        className="tm-svg"
        viewBox="0 0 200 114"
        role="img"
        aria-label={
          `Schematic map of the Ecowoods service territory: ${totalMarkets} municipalities on ` +
          `${regions.length} corridors, ${ontario} in Ontario from Barrie south to the Niagara peninsula and ` +
          'west to Waterloo Region, and the remainder in western New York across the Niagara River — Buffalo, ' +
          'the Erie County towns, and Monroe County east to Rochester. The shop and showroom are in Toronto.'
        }
      >
        <defs>
          <radialGradient id="tm-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(168,102,58,0.34)" />
            <stop offset="100%" stopColor="rgba(168,102,58,0)" />
          </radialGradient>
        </defs>

        <path d={LAKE_ONTARIO} className="tm-water" />
        <path d={LAKE_ERIE} className="tm-water" />
        <text x="120" y="76" className="tm-water-label" textAnchor="middle">Lake Ontario</text>
        <text x="52" y="104" className="tm-water-label" textAnchor="middle">Lake Erie</text>

        {/* The border. Drawn because the territory crosses it and a map that
            hides that is telling a story about one country. */}
        <path d={BORDER} className="tm-border" />
        <text x="150" y="82" className="tm-border-label" textAnchor="middle">Canada · United States</text>

        {regions.map((r) => {
          const isLit = r.id === activeId;
          return (
            <g
              key={r.id}
              className={`tm-region${isLit ? ' is-lit' : ''}`}
              data-country={r.country}
              onPointerEnter={() => setHeld(r.id)}
              onPointerLeave={() => setHeld(null)}
              onFocus={() => setHeld(r.id)}
              onBlur={() => setHeld(null)}
              tabIndex={0}
              role="button"
              aria-label={`${r.name} — ${r.markets.length} municipalities: ${r.markets.map((m) => m.name).join(', ')}`}
            >
              <path d={r.path} className="tm-territory" />
              <path d={r.path} className="tm-spine" />
              {r.dots.map((d) => (
                <g key={d.slug} className="tm-dot-g">
                  <circle cx={d.x} cy={d.y} r="3.4" className="tm-halo" fill="url(#tm-glow)" />
                  <circle cx={d.x} cy={d.y} r="1.05" className="tm-dot" />
                </g>
              ))}
            </g>
          );
        })}

        {/* The shop. One address, and it never moves. */}
        <g className="tm-shop">
          <circle cx="70" cy="52" r="2.1" className="tm-shop-ring" />
          <circle cx="70" cy="52" r="0.9" className="tm-shop-core" />
          <text x="70" y="47.5" className="tm-shop-label" textAnchor="middle">Shop · Toronto</text>
        </g>
      </svg>

      <p className="tm-readout" aria-live="off">
        {active ? (
          <>
            <span className="tm-readout-name">{active.name}</span>
            <span className="tm-readout-sep" aria-hidden="true">·</span>
            <span className="tm-readout-route">{active.route}</span>
            <span className="tm-readout-count">{active.markets.length} municipalities</span>
          </>
        ) : (
          <span className="tm-readout-name">{totalMarkets} municipalities across {regions.length} corridors</span>
        )}
      </p>

      {/* The territory as text. Everything above is a picture of this. */}
      <div className="tm-index">
        <h3 className="sr-only">Every corridor and the municipalities on it</h3>
        {regions.map((r) => (
          <details key={r.id} className="tm-index-group">
            <summary>
              {r.name} <span className="tm-index-count">{r.markets.length}</span>
            </summary>
            <ul>
              {r.markets.map((m) => (
                <li key={m.slug}>
                  {m.name}
                  {m.country === 'US' ? ', NY' : ''}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
}
