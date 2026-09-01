import Link from 'next/link';
import { WORK_PLACES, GTA_BOUNDS, COORDS_VERIFIED } from '@/content/work-map';

/**
 * WorkMap — the completed work, plotted.
 *
 * WHY IT IS AN INLINE SVG AND NOT A MAP LIBRARY
 *
 * A Mapbox, Google or OpenStreetMap basemap is not a picture; it is a stream of
 * tile requests, and every one of them hands a visitor's IP address and exactly
 * which part of the city they are looking at to a third party. That makes the
 * tile vendor a data processor: it belongs in the register on /privacy, which
 * `pnpm seo:legal` enforces, and its origin belongs in the CSP. This site spent
 * P2.4 REMOVING a third party that was declared and never even fired. Adding
 * one back to draw thirty-odd dots would be the same mistake with a nicer view.
 *
 * The dots are the content. An inline SVG has no requests, no processor, no CSP
 * change, renders with JavaScript off, and costs about two kilobytes.
 *
 * THE PROJECTION
 *
 * Equirectangular, with the longitude axis multiplied by cos(mean latitude).
 * Without that correction a degree of longitude is drawn the same width as a
 * degree of latitude, and at 43.7°N a degree of longitude is 80 km against 111 —
 * the city comes out stretched about 40% too wide and Etobicoke ends up further
 * from downtown than Newmarket is. It is a two-line fix and it is the difference
 * between a map and a diagram.
 *
 * WHAT THE PICTURE IS ALLOWED TO SAY
 *
 * Neighbourhood centroids. Never an address — see the note at the top of
 * content/work-map.ts and the guard that enforces it. The list underneath is
 * the accessible representation and the one that carries the facts; the SVG is
 * aria-hidden, because a scatter of circles read aloud is noise.
 */

const W = 720;

/**
 * THE FRAME IS FITTED TO THE WORK, WITH A FLOOR ON HOW FAR IT MAY ZOOM.
 *
 * Drawing the whole GTA when every published job is within five kilometres of
 * downtown gives a blank 60 km rectangle with a smudge in the middle. Fitting
 * the frame to the pins fixes that — and introduces a worse problem, because
 * five clustered pins would zoom until the frame is a few hundred metres across
 * and the dots start to look like addresses. That would quietly undo the whole
 * privacy design in a rendering detail.
 *
 * So MIN_SPAN_LAT is a floor: roughly 13 km, a district. The map can never zoom
 * closer than that no matter how tightly the work clusters, and it opens out as
 * jobs are published further afield.
 */
const MIN_SPAN_LAT = 0.12;
const PAD = 0.22;             // of the fitted span, so labels are not clipped

const FRAME = (() => {
  const lats = WORK_PLACES.map((p) => p.lat);
  const lngs = WORK_PLACES.map((p) => p.lng);
  const cLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const cLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const scale = Math.cos((cLat * Math.PI) / 180);

  let spanLat = Math.max(Math.max(...lats) - Math.min(...lats), MIN_SPAN_LAT) * (1 + PAD * 2);
  // Keep the drawing close to 3:2 by deriving the longitude span from it.
  let spanLng = (spanLat * 1.5) / scale;

  const minLat = Math.max(GTA_BOUNDS.minLat, cLat - spanLat / 2);
  const maxLat = Math.min(GTA_BOUNDS.maxLat, cLat + spanLat / 2);
  const minLng = Math.max(GTA_BOUNDS.minLng, cLng - spanLng / 2);
  const maxLng = Math.min(GTA_BOUNDS.maxLng, cLng + spanLng / 2);
  return { minLat, maxLat, minLng, maxLng, scale };
})();

const SPAN_LNG = (FRAME.maxLng - FRAME.minLng) * FRAME.scale;
const SPAN_LAT = FRAME.maxLat - FRAME.minLat;
const H = Math.round((W * SPAN_LAT) / SPAN_LNG);

const px = (lng: number) => ((lng - FRAME.minLng) * FRAME.scale * W) / SPAN_LNG;
const py = (lat: number) => ((FRAME.maxLat - lat) * H) / SPAN_LAT;

/** Graticule lines that actually fall inside the fitted frame. */
const ticks = (min: number, max: number, step: number) => {
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v < max; v += step) out.push(Number(v.toFixed(3)));
  return out;
};

export function WorkMap() {
  const places = [...WORK_PLACES].sort((a, b) => b.year - a.year || b.sqft - a.sqft);
  const totalSqft = places.reduce((s, p) => s + p.sqft, 0);
  const years = places.map((p) => p.year);

  return (
    <div className="wm">
      <figure className="wm-figure">
        <svg
          className="wm-svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
          focusable="false"
        >
          {/* A quarter-degree graticule, so the eye has a scale to read distance
              against. Roughly 28 km east–west, 28 km north–south at this latitude. */}
          <g className="wm-grid">
            {ticks(FRAME.minLat, FRAME.maxLat, 0.05).map((lat) => (
              <line key={`h${lat}`} x1={0} x2={W} y1={py(lat)} y2={py(lat)} />
            ))}
            {ticks(FRAME.minLng, FRAME.maxLng, 0.05).map((lng) => (
              <line key={`v${lng}`} y1={0} y2={H} x1={px(lng)} x2={px(lng)} />
            ))}
          </g>

          {places.map((p) => (
            <g key={p.caseStudySlug} className="wm-pin">
              <circle cx={px(p.lng)} cy={py(p.lat)} r={13} className="wm-halo" />
              <circle cx={px(p.lng)} cy={py(p.lat)} r={5} className="wm-dot" />
              <text x={px(p.lng) + 18} y={py(p.lat) + 4} className="wm-label">
                {p.label}
              </text>
            </g>
          ))}
        </svg>

        <figcaption className="wm-caption">
          {places.length} published jobs, {Math.min(...years)}&ndash;{Math.max(...years)},{' '}
          {totalSqft.toLocaleString('en-CA')} sq ft. Each dot is a{' '}
          <strong>neighbourhood centroid, not an address</strong> — these were people&rsquo;s homes,
          and where someone lives is theirs, not ours to publish.
          {!COORDS_VERIFIED && ' Centroids are approximate and are deliberately not published as structured data.'}
        </figcaption>
      </figure>

      {/* The list is the content. The picture is the index. */}
      <ol className="wm-list">
        {places.map((p) => (
          <li key={p.caseStudySlug} className="wm-item">
            <div className="wm-item-head">
              <Link href={`/service-areas/${p.areaSlug}`} className="wm-place">
                {p.label}
              </Link>
              <span className="wm-meta">
                {p.year} · {p.sqft.toLocaleString('en-CA')} sq ft
              </span>
            </div>
            <p className="wm-summary">{p.summary}</p>
            <Link href={`/case-studies/${p.caseStudySlug}`} className="wm-read">
              What was measured <span aria-hidden="true">→</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
