/**
 * content/work-map.ts — where the work has actually been done.
 *
 * WHY THIS FILE IS NOT A LIST OF ADDRESSES
 *
 * The owner has the addresses. Publishing them is out of the question, and it
 * is worth being precise about why, because the instinct — "show them the
 * houses" — is a good instinct pointed at the wrong object.
 *
 *  1. A map of private homes, each labelled with what was installed and
 *     roughly what it cost, is a shopping list. "3,800 sq ft of maple and a
 *     custom inlay staircase, at this pin" is information a burglar values more
 *     than a customer does.
 *  2. Those addresses are personal information of the homeowners under PIPEDA.
 *     They were given to a contractor to do work, not to be published. Consent
 *     to do a floor is not consent to be mapped.
 *  3. It would be the one mistake on this site that cannot be walked back.
 *     Scrapers, Street View cross-referencing and the Internet Archive make a
 *     published address permanent within hours.
 *
 * And it buys nothing. Nobody chooses a contractor because a pin sits on a
 * specific driveway; they choose one because the work is demonstrably nearby
 * and demonstrably real. Neighbourhood precision delivers all of the persuasion
 * and none of the exposure — and it is what local search actually rewards,
 * because relevance is computed over areas, not over street numbers.
 *
 * THE RULE, ENFORCED BY scripts/verify-work-map.mjs
 *
 *   Neighbourhood centroid, three decimal places, and nothing finer. Ever.
 *
 * Three decimals is about 110 m. A fourth decimal is about 11 m, which is one
 * house, so the guard rejects a fourth decimal outright rather than trusting
 * anyone to remember. It also rejects a Canadian postal code, a street number,
 * and any field named address, street, postal or unit — structurally, so the
 * mistake cannot be made by editing this file.
 *
 * WHAT MAKES A PIN LEGITIMATE
 *
 * Every entry here is derived from a case study already published on this site,
 * whose neighbourhood, year and square footage live in its .mdx frontmatter.
 * The guard re-reads that frontmatter and fails the build if a single figure
 * here stops matching it — the same contract as content/job-cards.ts. A pin
 * cannot be added by typing one; it is added by publishing the job.
 */

/** Coordinate precision. Only `neighbourhood` is permitted — see the note above. */
export type Precision = 'neighbourhood';

export type WorkPlace = {
  /** Must resolve to a real /service-areas/<slug> page, or be listed in the guard's exceptions. */
  areaSlug: string;
  /** As written in the case study frontmatter. */
  label: string;
  lat: number;
  lng: number;
  precision: Precision;
  /** Year the work was done, from the case study's project-date. */
  year: number;
  /** Square feet, from the case study's square-footage. */
  sqft: number;
  /** Must resolve to a real /services/<slug> page. */
  serviceSlug: string;
  /** The published document this pin is evidence for. */
  caseStudySlug: string;
  /** One line, in the language of the job. No adjectives that are not measurements. */
  summary: string;
};

/**
 * WHERE THE COORDINATES CAME FROM, AND WHY THEY DO NOT REACH SCHEMA YET.
 *
 * These are approximate neighbourhood centroids. They are good enough to draw a
 * map at the zoom this site draws one — being 300 m out is invisible when the
 * frame is 60 km wide — and they are NOT good enough to assert as fact in
 * structured data, where a `GeoCoordinates` node is a claim a machine will
 * repeat without checking.
 *
 * So `COORDS_VERIFIED` is false, and the Place/GeoCoordinates JSON-LD stays
 * unemitted until somebody opens a map, reads off each centroid and flips it.
 * Same rule as PROFILE_LINKS: the site renders what it has, and asserts only
 * what somebody has checked. Runbook §11 is the 20-minute task.
 */
export const COORDS_SOURCE =
  'Approximate neighbourhood centroids, 3 dp (~110 m). NOT yet verified against a mapping source — see ops/DOMINATION-RUNBOOK.md §11.';
export const COORDS_VERIFIED = false;

/** The frame the map is drawn in. Every pin must fall inside it. */
export const GTA_BOUNDS = { minLat: 43.40, maxLat: 44.10, minLng: -79.90, maxLng: -78.95 };

export const WORK_PLACES: WorkPlace[] = [
  {
    areaSlug: 'rosedale',
    label: 'Rosedale',
    lat: 43.679,
    lng: -79.383,
    precision: 'neighbourhood',
    year: 2024,
    sqft: 3800,
    serviceSlug: 'hardwood-installation',
    caseStudySlug: 'rosedale-estate-stairs-radiant-heat',
    summary: 'Maple and white oak over radiant heat, with a custom inlay staircase.',
  },
  {
    areaSlug: 'forest-hill',
    label: 'Forest Hill',
    lat: 43.696,
    lng: -79.414,
    precision: 'neighbourhood',
    year: 2025,
    sqft: 2100,
    serviceSlug: 'hardwood-installation',
    caseStudySlug: 'forest-hill-walnut-wide-plank-color-stability',
    summary: 'Wide-plank walnut, specified for colour stability under daylight.',
  },
  {
    areaSlug: 'yorkville',
    label: 'Yorkville',
    lat: 43.671,
    lng: -79.393,
    precision: 'neighbourhood',
    year: 2025,
    sqft: 1800,
    serviceSlug: 'floor-restoration',
    caseStudySlug: 'yorkville-loft-basement-conversion-moisture-mitigation',
    summary: 'Basement conversion with moisture mitigation before a board was opened.',
  },
  {
    areaSlug: 'midtown-toronto',
    label: 'Midtown Toronto',
    lat: 43.704,
    lng: -79.398,
    precision: 'neighbourhood',
    year: 2025,
    sqft: 5200,
    serviceSlug: 'hardwood-installation',
    caseStudySlug: 'midtown-townhouse-three-level-transition',
    summary: 'Three levels, three substrates, one continuous floor line.',
  },
  {
    areaSlug: 'downtown-toronto',
    label: 'Distillery District',
    lat: 43.650,
    lng: -79.359,
    precision: 'neighbourhood',
    year: 2024,
    sqft: 2400,
    serviceSlug: 'floor-refinishing',
    caseStudySlug: 'distillery-district-victorian-condo',
    summary: 'Victorian conversion: original strip hardwood assessed, then refinished.',
  },
];
