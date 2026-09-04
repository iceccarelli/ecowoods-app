/* ---------------------- Business Facts (SINGLE SOURCE OF TRUTH) ----------------------
 *
 * Every customer-visible phone number, address, and year-in-business claim on
 * this site MUST come from here. Nothing gets hardcoded at a call site again.
 *
 * One NAP string, rendered everywhere: press, about, footer, schema, llms.txt,
 * ai.txt, Google Business Profile and Bing Places all carry exactly this.
 *
 * `pnpm verify:facts` fails the build if a banned literal reappears anywhere.
 */
export const BUSINESS_NAP = {
  legalName: 'Ecowoods Hardwood Flooring Inc.',
  /**
   * PUBLIC NAME — P0-8. "Ecowoods", one word, capital E, nothing appended.
   * This is what schema.org `name`, GBP, Bing Places and every heading carry.
   * Directory listings that read "Ecowoods Inc." (YellowPages, Bing Places)
   * are reconciled via `alternateNames` below, emitted as schema.org
   * `alternateName`.
   */
  name: 'Ecowoods',
  shortName: 'Ecowoods',
  /** Forms of the name that appear on third-party listings this business
   *  controls or has verified. Emitted as `alternateName` so an entity
   *  resolver joins "Ecowoods Inc." (YellowPages, Bing Places), "Ecowoods
   *  Hardwood" (411.ca, social handles) and "Ecowood" (second HomeStars
   *  profile, owner-confirmed 2026-09-04) to this organization. */
  alternateNames: ['Ecowoods Inc.', 'Ecowoods Hardwood Flooring', 'Ecowoods Hardwood', 'Ecowood'],

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
    /** Google Maps pin for this address, read live 2026-09-04 (CID 5687424346697383507). */
    latitude: 43.7197642,
    longitude: -79.546973,
  },

  /** OWNER-CONFIRMED VALUE. Ecowoods was founded in 2000; every surface
   *  derives its year count from this one number via yearsInBusiness(). */
  foundedYear: 2000,
} as const;

/** Whole years in business, derived. Never hardcode a year count in copy. */
export function yearsInBusiness(now: Date = new Date()): number {
  return now.getFullYear() - BUSINESS_NAP.foundedYear;
}

/* ---------------------- Business hours (SINGLE SOURCE OF TRUTH) --------
 *
 * Every surface — JSON-LD openingHoursSpecification, header, footer, GBP and
 * Bing Places copy — derives from here.
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

/**
 * The IANA zone the hours above are stated in.
 *
 * Named here rather than in the booking engine because "8 AM" is meaningless
 * without it: a visitor in Vancouver, a crawler in Ireland and a serverless
 * function in Virginia must all resolve the same instant, and the schema's
 * openingHoursSpecification is read by machines that assume a zone if you do
 * not give them one.
 */
export const BUSINESS_TIMEZONE_NAME = 'America/Toronto';

/** One human-readable line, for chrome and copy. Derives nothing — states the
 *  same fact as BUSINESS_HOURS in the format the UI already uses. */
export const HOURS_LINE = 'Mon–Sat 8 AM – 7 PM · Sun 10 AM – 4 PM';
/** Compact form for tight chrome (utility bar). */
export const HOURS_LINE_SHORT = 'Mon–Sat 8–7 · Sun 10–4';

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

  /* ── Directory citation, opened and NAP-matched (re-read 2026-09-04) ────
   *
   * YellowPages.ca carries a real listing for this company: "Ecowoods Inc." /
   * "32 Norfield Cres, Etobicoke, ON M9W 1X6" / "647-244-5156" under
   * "Floor Refinishing, Laying & Resurfacing" — a character match against
   * BUSINESS_NAP on all three fields. It contributes to the entity graph as a
   * `sameAs` citation. Its website field is an owner-side directory update to
   * https://ecowoods.ca (see README → Owner actions), alongside deploying
   * old-domain/.htaccess on the retired host so every legacy URL 301s here.
   */
  { label: 'YellowPages', href: 'https://www.yellowpages.ca/bus/Ontario/Etobicoke/Ecowoods-Inc/102363922.html' },

  /* ── Second HomeStars profile, OWNER-CONFIRMED 2026-09-04 ────────────────
   *
   * HomeStars profile 2897115-ecowood ("Ecowood", Toronto) is this company —
   * confirmed by the owner in the 2026-09-04 session and opened live the same
   * day: 4.9/5 from 59 reviews. It is wired as a `sameAs` citation and as a
   * second dated row in REVIEW_EVIDENCE. Consolidation of the two HomeStars
   * profiles into 2776939-ecowoods is an owner action on HomeStars itself.
   */
  {
    label: 'HomeStars (Ecowood profile)',
    href: 'https://www.homestars.com/profile/2897115-ecowood',
    review: true,
  },

  /* ── Linked the moment the real profile URL is opened and pasted here ─────
   *
   * Policy, unchanged: paste a URL only after opening it and seeing an
   * Ecowoods page. Google Reviews and Houzz stay `review: true` so /reviews
   * and /r pick them up automatically the moment an `href` lands. The Google
   * write-review link takes the form
   * https://search.google.com/local/writereview?placeid=<PLACE_ID> (wired
   * below, in REVIEW_DESTINATIONS).
   */
  /* ── Google Business Profile, opened live 2026-09-04 ────────────────────
   *
   * Maps place "Ecowoods Hardwood Flooring", 32 Norfield Crescent, Etobicoke,
   * ON M9W 1X6 · Flooring contractor · ecowoods.ca · Mon–Sat 8 am–7 pm,
   * Sun 10 am–4 pm · 4.8 from 19 reviews. Place ID
   * ChIJcZSiRZAwK4gRUz7OX0_K7U4; CID 5687424346697383507
   * (0x4eedca4f5fce3e53); knowledge-graph id /g/11g02cm1tr. The place_id URL
   * is the stable Maps deep link and is what `sameAs` and `hasMap` carry.
   */
  {
    label: 'Google Reviews',
    href: 'https://www.google.com/maps/place/?q=place_id:ChIJcZSiRZAwK4gRUz7OX0_K7U4',
    review: true,
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
 * REVIEW_EVIDENCE below records what reviews already exist. This records where
 * to send the next one, and it is the only lever that changes the numbers there.
 *
 * THE RULE THAT MATTERS MORE THAN THE CODE
 *
 * Every completed job gets the same card with the same links, and every visitor
 * to /r sees every destination. No "how did we do?" screen that routes happy
 * customers to Google and unhappy ones to a private form. That is review
 * gating, Google's Maps user-contributed-content policy prohibits it outright —
 *
 *   "Discourage or prohibit negative reviews, or selectively solicit positive
 *    reviews from customers"
 *
 * — and it is also the thing that makes a 5.0 look bought. A profile with a few
 * four-star reviews answered well reads as a real business. An unbroken wall of
 * fives reads as a wall. scripts/verify-outreach.mjs fails the build if /r ever
 * grows a branch that shows different destinations to different people.
 *
 * WHY GOOGLE IS FIRST WHEN IT HAS A URL
 *
 * Not because HomeStars is worth less — because they do different jobs and one
 * is already done. HomeStars is a destination someone already shopping goes to.
 * Google Business Profile ratings are the surface: they produce the stars in
 * local results and the map pack, they cannot be marked up on any website by
 * anyone, and they are what answer engines read back when asked for a
 * recommendation. A strong Google rating is the single highest-leverage
 * reputation signal this business can add.
 *
 * `href` follows the same rule as PROFILE_LINKS: no URL until someone has opened
 * it and seen an Ecowoods page. Google's write-review link needs the Business
 * Profile's Place ID and takes the form
 * https://search.google.com/local/writereview?placeid=<PLACE_ID> — see
 * docs/outreach/GOOGLE_BUSINESS_PROFILE.md for how to get it.
 */
export type ReviewDestination = {
  platform: string;
  /** Deep link straight to the write-a-review form. Omit until verified. */
  href?: string;
  /** One line telling the customer what this platform is, in their terms. */
  note: string;
  /** Lower sorts first. Google is 1 because it is the surface everything reads. */
  rank: number;
};

export const REVIEW_DESTINATIONS: ReviewDestination[] = [
  {
    platform: 'Google',
    /* Place ID ChIJcZSiRZAwK4gRUz7OX0_K7U4 — opened live 2026-09-04 and
       confirmed to resolve to Ecowoods Hardwood Flooring, 32 Norfield Crescent. */
    href: 'https://search.google.com/local/writereview?placeid=ChIJcZSiRZAwK4gRUz7OX0_K7U4',
    note: 'The one most people see first, in Maps and in search results.',
    rank: 1,
  },
  {
    platform: 'HomeStars',
    href: 'https://www.homestars.com/companies/2776939-ecowoods/reviews/new',
    note: 'Where most of our reviews already live. Verified contractors only.',
    rank: 2,
  },
];

/** Destinations with a confirmed URL — the only ones /r renders. */
export const LIVE_REVIEW_DESTINATIONS = REVIEW_DESTINATIONS.filter((d) => d.href).sort(
  (a, b) => a.rank - b.rank,
);

/** Named but not yet linked, so the page can say so instead of pretending. */
export const PENDING_REVIEW_DESTINATIONS = REVIEW_DESTINATIONS.filter((d) => !d.href);

/* ---------------------- Third-party review evidence -------------------
 *
 * WHAT THIS IS
 *
 * The review figures this site cites, each one read off the live profile by a
 * person and dated. PROFILE_LINKS puts the profiles in `sameAs`, which asserts
 * "same entity"; this block carries the numbers, so that an answer engine
 * reading any page here can retrieve the count, the rating, the source and the
 * date it was read — the shape a retrieval system lifts out and quotes.
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
  /** ISO date of the most recent review visible at `asOf`. Omitted where the
   *  platform shows only relative ages ("2 years ago") rather than a date. */
  latestReviewAt?: string;
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
  {
    /* Owner-confirmed second HomeStars profile ("Ecowood"), read live 2026-09-04. */
    platform: 'HomeStars (Ecowood profile)',
    href: 'https://www.homestars.com/profile/2897115-ecowood/reviews',
    rating: 4.9,
    outOf: 5,
    count: 59,
    asOf: '2026-09-04',
    latestReviewAt: '2024-01-16',
  },
  {
    /* Google Business Profile, read live 2026-09-04 on Maps (Place ID ChIJcZSiRZAwK4gRUz7OX0_K7U4). */
    platform: 'Google',
    href: 'https://www.google.com/maps/place/?q=place_id:ChIJcZSiRZAwK4gRUz7OX0_K7U4',
    rating: 4.8,
    outOf: 5,
    count: 19,
    asOf: '2026-09-04',
  },
];

/** The platform carrying the most reviews — what a reader should be sent to first. */
export const PRIMARY_REVIEW_EVIDENCE = REVIEW_EVIDENCE.reduce((a, b) =>
  b.count > a.count ? b : a,
);

/** Every other dated profile — cited alongside the primary, never blended into it. */
export const SECONDARY_REVIEW_EVIDENCE = REVIEW_EVIDENCE.filter((r) => r !== PRIMARY_REVIEW_EVIDENCE);

/** Total reviews across every platform whose figures have been read and dated. */
export const TOTAL_REVIEWS_CITED = REVIEW_EVIDENCE.reduce((n, r) => n + r.count, 0);

/** The Google Maps place URL for this business (schema.org `hasMap`), once verified. */
export const GOOGLE_MAPS_URL = PROFILE_LINKS.find((p) => p.label === 'Google Reviews')?.href;

/** Review platforms with a confirmed URL — safe to cite as proof on the site. */
export const REVIEW_PROFILES = PROFILE_LINKS.filter((p) => p.review && p.href);
 
