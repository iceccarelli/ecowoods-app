/* ---------------------- Business Facts (SINGLE SOURCE OF TRUTH) ----------------------
 *
 * Every customer-visible phone number, address, and year-in-business claim on
 * this site is sourced here. Pages, schema, llms.txt, ai.txt, and directory
 * copy all render these fields.
 *
 * `pnpm verify:facts` fails the build if a banned literal reappears elsewhere.
 */
export const BUSINESS_NAP = {
  legalName: 'Ecowoods Hardwood Flooring Inc.',
  /**
   * Public name for schema.org `name`, headings, GBP, and Bing Places.
   * One word. Capital E.
   */
  name: 'Ecowoods',
  shortName: 'Ecowoods',
  /**
   * Name variants that already appear on listings this business operates or
   * has verified. Emitted as schema.org `alternateName` so resolvers join
   * those strings to this organization.
   */
  alternateNames: [
    'Ecowoods Inc.',
    'Ecowoods Hardwood Flooring',
    'Ecowoods Hardwood',
    'Ecowood',
  ],

  phoneE164: '+16472445156',
  phoneSchema: '+1-647-244-5156',
  phoneDisplay: '(647) 244-5156',
  phoneHref: 'tel:+16472445156',

  email: 'services@ecowoods.ca',
  region: 'Toronto & the GTA',

  address: {
    streetAddress: '32 Norfield Crescent',
    addressLocality: 'Toronto',
    addressRegion: 'ON',
    postalCode: 'M9W 1X6',
    addressCountry: 'CA',
    /** Maps pin for this showroom, read live 2026-09-04. */
    latitude: 43.7197642,
    longitude: -79.546973,
  },

  /** Founding year. Year-count copy uses yearsInBusiness() only. */
  foundedYear: 2000,
} as const;

/** Whole years in business, derived. */
export function yearsInBusiness(now: Date = new Date()): number {
  return now.getFullYear() - BUSINESS_NAP.foundedYear;
}

/* ---------------------- Business hours (SINGLE SOURCE OF TRUTH) --------
 *
 * JSON-LD openingHoursSpecification, header, footer, GBP, and Bing Places
 * all derive from this list.
 */
export const BUSINESS_HOURS = [
  {
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const,
    opens: '08:00',
    closes: '19:00',
  },
  {
    days: ['Sunday'] as const,
    opens: '10:00',
    closes: '16:00',
  },
] as const;

/** IANA zone for BUSINESS_HOURS. Required so schema and booking share one instant. */
export const BUSINESS_TIMEZONE_NAME = 'America/Toronto';

export const HOURS_LINE = 'Mon–Sat 8 AM – 7 PM · Sun 10 AM – 4 PM';
export const HOURS_LINE_SHORT = 'Mon–Sat 8–7 · Sun 10–4';

export const BUSINESS_ADDRESS_LINE =
  `${BUSINESS_NAP.address.streetAddress}, ${BUSINESS_NAP.address.addressLocality}, ` +
  `${BUSINESS_NAP.address.addressRegion} ${BUSINESS_NAP.address.postalCode}`;

export const JOB_STATUSES = {
  PENDING: 'pending',
  BIDDING: 'bidding',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const ROUTES = {
  HOME: '/',
  JOBS: '/jobs',
  JOB_DETAIL: (id: string) => `/jobs/${id}`,
} as const;

/* ---------------------- Google place (SINGLE SOURCE OF TRUTH) ---------
 *
 * Stable Maps identifiers. PROFILE_LINKS, REVIEW_DESTINATIONS, hasMap, and
 * write-review URLs are built from these so the pin cannot drift from sameAs.
 */
export const GOOGLE_PLACE = {
  placeId: 'ChIJcZSiRZAwK4gRUz7OX0_K7U4',
  cid: '5687424346697383507',
  knowledgeGraphId: '/g/11g02cm1tr',
  mapsUrl: 'https://www.google.com/maps/place/?q=place_id:ChIJcZSiRZAwK4gRUz7OX0_K7U4',
  writeReviewUrl:
    'https://search.google.com/local/writereview?placeid=ChIJcZSiRZAwK4gRUz7OX0_K7U4',
} as const;

export const HOMESTARS_CANONICAL = {
  profileId: '2776939-ecowoods',
  profileUrl: 'https://www.homestars.com/profile/2776939-ecowoods',
  reviewsUrl: 'https://www.homestars.com/profile/2776939-ecowoods/reviews',
  writeReviewUrl: 'https://www.homestars.com/companies/2776939-ecowoods/reviews/new',
} as const;

/* ---------------------- Review & Social Profiles ----------------------
 *
 * An entry appears on the site only when `href` is set.
 *
 * sameAs (entity graph): every row with an href.
 * Review proof (cited counts): REVIEW_EVIDENCE only.
 * Write-a-review flywheel: REVIEW_DESTINATIONS only.
 *
 * Paste an href only after opening the URL and confirming it shows Ecowoods.
 */
export type ProfileLink = {
  label: string;
  href?: string;
  /** Eligible to appear as a review-platform link in chrome. */
  review?: boolean;
  /**
   * Directory / alias identity for sameAs. Not hardwood review proof.
   * Use for name-variant profiles that should resolve to this organization.
   */
  identity?: boolean;
};

export const PROFILE_LINKS: ProfileLink[] = [
  {
    label: 'HomeStars',
    href: HOMESTARS_CANONICAL.profileUrl,
    review: true,
  },
  {
    label: 'Google Reviews',
    href: GOOGLE_PLACE.mapsUrl,
    review: true,
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/ecowoodshardwood',
  },
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/ecowoodshardwood',
  },
  {
    label: 'YellowPages',
    href: 'https://www.yellowpages.ca/bus/Ontario/Etobicoke/Ecowoods-Inc/102363922.html',
  },
  /**
   * Additional HomeStars identity ("Ecowood"), owner-confirmed 2026-09-04.
   * Included in sameAs so "Ecowood" resolves to this organization.
   * Not marked `review` and not listed in REVIEW_EVIDENCE: the live hardwood
   * review record is HOMESTARS_CANONICAL (177) plus Google (19).
   * Merge into 2776939-ecowoods with HomeStars when ready; the graph stays
   * joined either way.
   */
  {
    label: 'HomeStars (Ecowood identity)',
    href: 'https://www.homestars.com/profile/2897115-ecowood',
    identity: true,
  },
  { label: 'Houzz', review: true },
  { label: 'YouTube' },
  { label: 'LinkedIn' },
  { label: 'Pinterest' },
  { label: 'TikTok' },
  { label: 'X' },
];

/* ---------------------- Where a finished job sends a customer ---------
 *
 * REVIEW_EVIDENCE records what has already been read on live profiles.
 * REVIEW_DESTINATIONS records where the next review is invited.
 *
 * Every completed job and every visitor to /r sees the same destinations, in
 * the same order. scripts/verify-outreach.mjs keeps that path unbranched.
 *
 * Google is rank 1 because Maps and local pack are the surfaces a new
 * customer opens first. HomeStars remains the established contractor record.
 */
export type ReviewDestination = {
  platform: string;
  href?: string;
  note: string;
  rank: number;
};

export const REVIEW_DESTINATIONS: ReviewDestination[] = [
  {
    platform: 'Google',
    href: GOOGLE_PLACE.writeReviewUrl,
    note: 'Maps and local search — the profile most new customers open first.',
    rank: 1,
  },
  {
    platform: 'HomeStars',
    href: HOMESTARS_CANONICAL.writeReviewUrl,
    note: 'Verified-contractor record for homeowners already comparing specialists.',
    rank: 2,
  },
];

export const LIVE_REVIEW_DESTINATIONS = REVIEW_DESTINATIONS.filter((d) => d.href).sort(
  (a, b) => a.rank - b.rank,
);

export const PENDING_REVIEW_DESTINATIONS = REVIEW_DESTINATIONS.filter((d) => !d.href);

/* ---------------------- Third-party review evidence -------------------
 *
 * Cited statistics: platform, count, rating, profile URL, date read.
 * Not schema.org aggregateRating. scripts/verify-reviews.mjs enforces that
 * these figures live here, that asOf is not in the future, and that schema
 * builders do not emit aggregateRating.
 *
 * Re-read the live profile and update the row when the numbers change.
 * Do not type these counts as literals in pages.
 */
export type ReviewEvidence = {
  platform: string;
  href: string;
  rating: number;
  outOf: number;
  count: number;
  asOf: string;
  latestReviewAt?: string;
};

export const REVIEW_EVIDENCE: ReviewEvidence[] = [
  {
    platform: 'HomeStars',
    href: HOMESTARS_CANONICAL.reviewsUrl,
    rating: 5.0,
    outOf: 5,
    count: 177,
    asOf: '2026-08-22',
    latestReviewAt: '2026-08-10',
  },
  {
    platform: 'Google',
    href: GOOGLE_PLACE.mapsUrl,
    rating: 4.8,
    outOf: 5,
    count: 19,
    asOf: '2026-09-04',
  },
];

/** Platform with the largest verified hardwood review count. */
export const PRIMARY_REVIEW_EVIDENCE = REVIEW_EVIDENCE.reduce((a, b) =>
  b.count > a.count ? b : a,
);

/** Other dated hardwood profiles, cited separately, never blended. */
export const SECONDARY_REVIEW_EVIDENCE = REVIEW_EVIDENCE.filter((r) => r !== PRIMARY_REVIEW_EVIDENCE);

/** Sum of dated hardwood review rows only. */
export const TOTAL_REVIEWS_CITED = REVIEW_EVIDENCE.reduce((n, r) => n + r.count, 0);

export const GOOGLE_MAPS_URL =
  PROFILE_LINKS.find((p) => p.label === 'Google Reviews')?.href ?? GOOGLE_PLACE.mapsUrl;

export const REVIEW_PROFILES = PROFILE_LINKS.filter((p) => p.review && p.href);
