/**
 * content/job-cards.ts — THE first-party proof set.
 *
 * WHY THIS FILE EXISTS, AND WHY IT LOOKS LIKE THIS
 *
 * Five real jobs are published as case studies with their measurements in
 * them. Nothing on this site turned one of those into a card a buyer meets
 * before they have decided to go read a case study, and a homepage that says
 * "salaried craftsmen since 2000" with no job attached to it is a claim, not
 * evidence.
 *
 * THREE THINGS THIS DELIBERATELY DOES NOT CARRY
 *
 * 1. NO PHOTOGRAPH, UNTIL MONEY-02. Not one of the five case studies sets
 *    `images` (F-164), and a proof card illustrated with a stock floor is
 *    worse than a proof card with no picture: it is a photograph of
 *    somebody else's work placed next to our measurements. The card was
 *    typographic until MONEY-02 wired `imageSlot` to the AFTER frame already
 *    published for each job's ProofSlider plate in content/proof-sliders.ts
 *    — the same jobsite photography, reused, not a new asset. See that
 *    file's header for the provenance note on those five frames.
 *
 * 2. NO CUSTOMER NAME, NO QUOTE. The case studies carry `testimonial`
 *    attributions with full names. Those may well be real, but this repository
 *    has no record of consent to reproduce them and no record of who collected
 *    them — and the homepage's own `featuredReviews` array was emptied for
 *    exactly that reason. Amplifying an unverified attribution into a new
 *    component on higher-traffic pages is the one direction you cannot walk
 *    back. Ask the owner, record the consent, then add it here.
 *
 * 3. NO NUMBER OF ITS OWN. Every figure below is COPIED from the case study's
 *    frontmatter, and `scripts/verify-job-cards.mjs` fails the build when a
 *    single one of them stops matching its source .mdx. The card cannot drift
 *    from the document it points at, which is the only reason it is allowed to
 *    restate it at all.
 *
 * `serviceSlug` is the one editorial judgement here: the case studies carry
 * `project-type` (renovation / residential), which is not a service this
 * business sells. The slug is chosen by reading the job and must resolve to a
 * real page under /services — the guard checks that too.
 */
import type { StaticImageData } from 'next/image';
import { SLIDER_FRAMES } from '@/app/data/slider-images';

export type JobCardMeasurement = {
  /** Index into the case study's `results` array. The guard reads this row. */
  readonly index: number;
  readonly metric: string;
  readonly value: number;
  readonly unit: string;
};

export type JobCard = {
  /** The case study that proves this card. Every figure is copied from it. */
  readonly slug: string;
  /** Neighbourhood, as the case study records it. */
  readonly area: string;
  readonly city: string;
  readonly squareFeet: number;
  /** Year of the job, from the case study's `project-date`. */
  readonly year: number;
  /** A real slug under /services. */
  readonly serviceSlug: string;
  /** Human label for the service, matching the public service name. */
  readonly service: string;
  readonly species: string;
  readonly substrate: string;
  readonly measurement: JobCardMeasurement;
  /** One sentence. Restates what the case study measured — nothing more. */
  readonly outcome: string;
  /**
   * The job's AFTER frame, reused from its ProofSlider plate in
   * content/proof-sliders.ts. Left undefined where a job has no linked
   * plate: see note 1.
   */
  readonly imageSlot?: StaticImageData;
  /** Describes the frame. Required alongside imageSlot; never "an image of". */
  readonly imageAlt?: string;
};

export const JOB_CARDS: readonly JobCard[] = [
  {
    slug: 'midtown-townhouse-three-level-transition',
    area: 'Midtown Toronto',
    city: 'Toronto',
    squareFeet: 5200,
    year: 2025,
    serviceSlug: 'hardwood-installation',
    service: 'Hardwood Flooring Installation',
    species: 'Hard Maple, Red Oak, White Oak, Walnut',
    substrate: 'mixed',
    measurement: {
      index: 0,
      metric: 'G-Floor MVTR (Post-Epoxy Sealer)',
      value: 4.8,
      unit: 'lbs/1000 sqft/24h',
    },
    outcome:
      'Three levels, three different substrates, one continuous floor — the ground-floor slab sealed and re-measured before a single board was laid.',
    imageSlot: SLIDER_FRAMES['05-midtown-townhouse-continuous-after'],
    imageAlt:
      'The same landing after work: continuous hardwood into white oak treads with a walnut stringer and no cheap transition strip.',
  },
  {
    slug: 'forest-hill-walnut-wide-plank-color-stability',
    area: 'Forest Hill',
    city: 'Toronto',
    squareFeet: 2100,
    year: 2025,
    serviceSlug: 'hardwood-installation',
    service: 'Hardwood Flooring Installation',
    species: 'Black Walnut',
    substrate: 'plywood',
    measurement: {
      index: 0,
      metric: 'Walnut Stock Yield',
      value: 97,
      unit: '%',
    },
    outcome:
      'Wide-plank walnut sorted board by board for colour, with the rejected stock counted and published rather than absorbed quietly.',
    imageSlot: SLIDER_FRAMES['02-forest-hill-walnut-wideplank-after'],
    imageAlt:
      'The same Forest Hill room after a wide-plank black walnut install, oil-rubbed satin sheen, original mantel retained.',
  },
  {
    slug: 'yorkville-loft-basement-conversion-moisture-mitigation',
    area: 'Yorkville',
    city: 'Toronto',
    squareFeet: 1800,
    year: 2025,
    serviceSlug: 'hardwood-installation',
    service: 'Hardwood Flooring Installation',
    species: 'Red Oak, Hard Maple',
    substrate: 'concrete',
    measurement: {
      index: 0,
      metric: 'Initial Subfloor MVTR',
      value: 9.8,
      unit: 'lbs/1000 sqft/24h',
    },
    outcome:
      'Hardwood below grade on a slab reading double the safe threshold — mitigated, re-measured, and only then installed.',
    imageSlot: SLIDER_FRAMES['03-yorkville-loft-moisture-after'],
    imageAlt:
      'The same below-grade room after engineered hardwood: red oak field with hard-maple accent stripes, satin finish.',
  },
  {
    slug: 'rosedale-estate-stairs-radiant-heat',
    area: 'Rosedale',
    city: 'Toronto',
    squareFeet: 3800,
    year: 2024,
    serviceSlug: 'stair-refinishing',
    service: 'Stair Refinishing',
    species: 'Hard Maple, White Oak',
    substrate: 'radiant-heat',
    measurement: {
      index: 0,
      metric: 'Subfloor MVTR',
      value: 2.1,
      unit: 'lbs/1000 sqft/24h',
    },
    outcome:
      'A grand staircase and a main floor over radiant heat, with moisture content re-checked six months later through a Toronto winter.',
    imageSlot: SLIDER_FRAMES['04-rosedale-stairs-radiant-after'],
    imageAlt:
      'The same flight after refinishing: white oak treads, painted risers, new oak handrail and newel, landing window unchanged.',
  },
  {
    slug: 'distillery-district-victorian-condo',
    area: 'Distillery District',
    city: 'Toronto',
    squareFeet: 2400,
    year: 2024,
    serviceSlug: 'hardwood-installation',
    service: 'Hardwood Flooring Installation',
    species: 'White Oak',
    substrate: 'concrete',
    measurement: {
      index: 0,
      metric: 'Subfloor MVTR (before barrier)',
      value: 7.2,
      unit: 'lbs/1000 sqft/24h',
    },
    outcome:
      'White oak over a historic concrete slab, with the tannin risk handled in the finish schedule rather than discovered afterwards.',
    imageSlot: SLIDER_FRAMES['09-distillery-whiteoak-slab-after'],
    imageAlt:
      'The same loft after a white oak glue-down over concrete, matte oil finish, one lounge chair.',
  },
];

/** The jobs done in a given area, matched on the neighbourhood name. */
export const jobCardsForArea = (areaName: string): readonly JobCard[] =>
  JOB_CARDS.filter((j) => j.area.toLowerCase() === areaName.toLowerCase());

/** The jobs that are evidence for a given service slug. */
export const jobCardsForService = (serviceSlug: string): readonly JobCard[] =>
  JOB_CARDS.filter((j) => j.serviceSlug === serviceSlug);

/** By slug, for a page that names the jobs it wants. */
export const jobCardsBySlug = (...slugs: string[]): readonly JobCard[] =>
  slugs.map((s) => JOB_CARDS.find((j) => j.slug === s)).filter((j): j is JobCard => Boolean(j));
