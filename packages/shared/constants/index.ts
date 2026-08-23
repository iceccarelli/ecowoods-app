/* ---------------------- Business Facts (SINGLE SOURCE OF TRUTH) ----------------------
 *
 * Every customer-visible phone number, address, and year-in-business claim on
 * this site MUST come from here. Nothing gets hardcoded at a call site again.
 *
 * Why: the site, the JSON-LD schema and the outbound email templates had drifted
 * onto three different phone numbers. A lead who converted was emailed a number
 * that did not match the one they called.
 *
 * `pnpm verify:facts` fails the build if a banned literal reappears anywhere.
 */
export const BUSINESS_NAP = {
  legalName: 'Ecowoods Hardwood Flooring Inc.',
  name: 'Ecowoods Inc.',
  shortName: 'Ecowoods',

  /** E.164 — for schema.org, tel: hrefs and click-to-call. */
  phoneE164: '+16472445156',
  /** schema.org / microdata format. */
  phoneSchema: '+1-647-244-5156',
  /** Human-readable, for all customer-facing copy. */
  phoneDisplay: '(647) 244-5156',
  /** Ready-made href. */
  phoneHref: 'tel:+16472445156',

  email: 'services@ecowoods.ca',
  region: 'Toronto & the GTA',

  address: {
    streetAddress: '32 Norfield Crescent',
    addressLocality: 'Toronto',
    addressRegion: 'ON',
    postalCode: 'M9W 1X6',
    addressCountry: 'CA',
    latitude: 43.72085,
    longitude: -79.57542,
  },

  /**
   * ⚠️ OWNER-CONFIRMED VALUE. Francisco states Ecowoods started in 2000.
   * The site previously published 1998 in some places and "27 years" /  (facts-allow)
   * "over 25 years" in others — three different claims, one of them  (facts-allow)
   * arithmetically stale. Change this one number if 1998 is correct;
   * every surface derives from it.
   */
  foundedYear: 2000,
} as const;

/** Whole years in business, derived. Never hardcode a year count in copy. */
export function yearsInBusiness(now: Date = new Date()): number {
  return now.getFullYear() - BUSINESS_NAP.foundedYear;
}

/** One-line address, used in document footers. */
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
 
/* ---------------------- Review & Social Profiles ----------------------
 *
 * SINGLE SOURCE OF TRUTH. An entry appears on the site only if `href` is set.
 * No href, no link — that is the whole mechanism.
 *
 * This replaces an exported SOCIAL_LINKS array that nothing imported and that
 * contained constructed handles (@ecowoods.ca, /pro/ecowoods, and a
 * "google.com/maps?cid=ecowoods" that is not a valid CID format at all).
 * Meanwhile the footer rendered its own separate list in which six of nine
 * icons pointed at platform HOME PAGES — clicking "Google Reviews" in the
 * footer landed you on Google Maps' front door. On a site whose reviews
 * section tells visitors to go read the reviews elsewhere, that is a dead end
 * at the exact moment a prospect is looking for proof.
 *
 * Rule going forward: paste a URL here only after opening it and seeing an
 * Ecowoods page. Leave href out until then.
 */
export type ProfileLink = {
  label: string;
  /** Omit until the URL has been opened and confirmed to show Ecowoods. */
  href?: string;
  /** true = a review platform, eligible to be surfaced as proof on the site. */
  review?: boolean;
};

export const PROFILE_LINKS: ProfileLink[] = [
  // ── Verified ──────────────────────────────────────────────────────────
  {
    label: 'HomeStars',
    href: 'https://www.homestars.com/profile/2776939-ecowoods',
    review: true,
  },

  // ── Company-operated, handle matches the ecowoodshardwood.com domain ──
  { label: 'Instagram', href: 'https://www.instagram.com/ecowoodshardwood' },
  { label: 'Facebook', href: 'https://www.facebook.com/ecowoodshardwood' },

  // ── NOT LINKED until someone opens the real profile and pastes the URL ─
  // Every one of these previously pointed at a platform home page.
  { label: 'Google Reviews', review: true },  // needs the Business Profile / Maps place URL
  { label: 'Houzz', review: true },           // needs the real /pro/ URL
  { label: 'YouTube' },
  { label: 'LinkedIn' },
  { label: 'Pinterest' },
  { label: 'TikTok' },
  { label: 'X' },
];

/* ---------------------- Third-party review evidence -------------------
 *
 * THE PROBLEM THIS SOLVES
 *
 * An AI agent asked to rank Toronto hardwood contractors in August 2026 left
 * Ecowoods off its list entirely. Asked why, it answered precisely: its process
 * leaned on the local-business results the search index surfaced, and the
 * business listing it could see carried 19 reviews — while the HomeStars profile
 * carried 177 at 5.0. It never reconciled the two, because nothing anywhere told
 * it they were the same company or what the real number was.
 *
 * That is an entity-resolution failure, and half of it is ours. PROFILE_LINKS
 * already puts HomeStars in `sameAs`, which asserts "same entity" — but sameAs
 * carries no numbers, and until now this site never stated the review count in
 * any crawlable place at all. An agent that read every page here still could not
 * learn that 177 five-star reviews exist.
 *
 * WHY THIS IS NOT AN aggregateRating
 *
 * Google is explicit: do not aggregate reviews or ratings from other websites,
 * and self-serving LocalBusiness/Organization reviews are ineligible for the
 * star feature. So this is NOT marked up as `aggregateRating` and must never be.
 * It is a cited third-party figure — a number, its source, a link to that
 * source, and the date a human read it off the platform. That is what a
 * publication does when it quotes a statistic, and it is allowed precisely
 * because it does not claim the rating as our own structured data.
 *
 * THE RULE
 *
 * Every field here is read off the live profile by a person and dated. Nothing
 * is estimated, rounded up, or carried forward. scripts/verify-reviews.mjs fails
 * the build on a future `asOf`, on any of these numbers typed as a literal
 * anywhere else in the codebase, and on any `aggregateRating` appearing in the
 * schema builders.
 */
export type ReviewEvidence = {
  /** The platform, named as it names itself. */
  platform: string;
  /** Direct link to the reviews, not the profile root. */
  href: string;
  rating: number;
  outOf: number;
  count: number;
  /** ISO date a person opened `href` and read these figures. */
  asOf: string;
  /** ISO date of the most recent review visible at `asOf`. */
  latestReviewAt: string;
};

export const REVIEW_EVIDENCE: ReviewEvidence[] = [
  {
    platform: 'HomeStars',
    href: 'https://www.homestars.com/profile/2776939-ecowoods/reviews',
    rating: 5.0,
    outOf: 5,
    count: 177,
    asOf: '2026-08-22',
    latestReviewAt: '2026-08-10',
  },
];

/** The platform carrying the most reviews — what a reader should be sent to first. */
export const PRIMARY_REVIEW_EVIDENCE = REVIEW_EVIDENCE.reduce((a, b) =>
  b.count > a.count ? b : a,
);

/** Total reviews across every platform whose figures have been read and dated. */
export const TOTAL_REVIEWS_CITED = REVIEW_EVIDENCE.reduce((n, r) => n + r.count, 0);

/** Review platforms with a confirmed URL — safe to cite as proof on the site. */
export const REVIEW_PROFILES = PROFILE_LINKS.filter((p) => p.review && p.href);
 
