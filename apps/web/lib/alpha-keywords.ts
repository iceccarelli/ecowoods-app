import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { FULL_SAND_FINISH, formatBandBare as bandBare } from '@/content/constants/pricing';

/**
 * The transactional phrases this site is written to answer.
 *
 * WHAT THIS IS
 *
 * A written record of the queries each surface is aimed at, so that titles, H1s
 * and internal anchor text can be reviewed against one list instead of drifting
 * page by page. It is a planning document that happens to be typed in
 * TypeScript.
 *
 * There is deliberately no guard asserting that these phrases appear in the
 * copy. A check like that can only compare strings, and the useful version of
 * "does this page answer that query" is not a string comparison — it would pass
 * on a page that stuffed the phrase and fail on a page that answered the
 * question in better words. Guards in this repository exist where a machine can
 * be right; this is not one of those places.
 *
 * WHAT IT IS NOT: A `<meta name="keywords">` PAYLOAD
 *
 * An earlier draft of this file wired the list into `metadata.keywords`. It is
 * deliberately not wired there, and the existing five keywords were removed at
 * the same time, because Google published this in 2009 and has never revised it:
 *
 *   > Google does not use the keywords meta tag in web ranking.
 *   — developers.google.com/search/blog/2009/09/google-does-not-use-keywords-meta-tag
 *
 * Bing gives it approximately nothing and has said it can read as a spam signal
 * when stuffed. So the tag is, at best, bytes shipped to every visitor for no
 * effect, and at worst a small negative. Deleting it costs nothing that exists.
 *
 * The phrases below do their work in the places that are actually read: the
 * `<title>`, the H1, the meta description, the anchor text of internal links,
 * and the body copy of the page that answers the query. That is where they are
 * asserted, and that is where the guard looks for them.
 *
 * THE LINE THAT MATTERS
 *
 * These are SEARCH TARGETS, not claims. "Best hardwood flooring company GTA" is
 * a query a person types; it is not a sentence this business may write about
 * itself. Describing a page's topic is not the same as asserting a rank, and the
 * distinction is the difference between an optimised title and a claim nobody
 * can support. See docs/outreach/CLAIMS_REGISTER.md.
 *
 * No rating, no review count, no award, no certification, no superlative.
 */

export const ALPHA = {
  /** High intent. Someone typing these is choosing a contractor this month. */
  transactional: [
    'custom hardwood floor installation Toronto',
    'dustless hardwood floor refinishing',
    'hardwood floor refinishing Toronto',
    'dust-free floor sanding GTA',
    'engineered wood flooring installation cost',
    'hardwood flooring installation Toronto',
  ],
  /** Narrower, and far less contested, because they require knowing something. */
  niche: [
    'heritage floor restoration Toronto',
    'condo acoustic underlayment hardwood',
    'moisture-resistant hardwood Etobicoke',
    'herringbone flooring installation Toronto',
    'stair refinishing Toronto',
  ],
  /** Question-shaped. These are what an answer engine is asked, verbatim. */
  longTail: [
    'What is the best hardwood flooring for concrete slab condos?',
    'How do you match new hardwood to old floors seamlessly?',
    'Solid or engineered hardwood in Toronto?',
    'How do you evaluate a hardwood flooring quote?',
  ],
} as const;

/**
 * The homepage title.
 *
 * Set as the root layout's `title.default`, and NOT on app/page.tsx. That is not
 * a stylistic choice: `default` is used verbatim, while a title set on the page
 * is run through the `%s · Ecowoods` template. Setting it in both places appends
 * the brand a second time and pushes the string past 70 characters, of which a
 * result shows about sixty — the same arithmetic that produced F-143.
 *
 * So the brand is spelled out here, once, at the end where truncation costs the
 * least, and the transactional phrase leads. The previous title —
 * "Ecowoods — Toronto's Master Hardwood Flooring Artisans" — led with a brand
 * nobody is searching for yet and never said "installation" or "refinishing".
 */
export const HOME_TITLE =
  'Dust-Free Hardwood Refinishing & Installation in Toronto | Ecowoods';

/**
 * ≤160 characters. No rating, no superlative, no award.
 *
 * The refinish band, the founding year and the phone number are INTERPOLATED
 * from their single sources — `content/constants/pricing.ts` and
 * `BUSINESS_NAP` — never typed here. `pnpm seo:pricing` and `pnpm seo:claims`
 * fail the build on a literal, and a meta description is exactly the string
 * that goes stale silently when a band moves.
 */
export const HOME_DESCRIPTION =
  `Fixed written price. HEPA dust containment. Salaried crews since ${BUSINESS_NAP.foundedYear}. ` +
  `Refinish ${bandBare(FULL_SAND_FINISH)}/sq ft. Free in-home measure across the GTA. ` +
  `Call ${BUSINESS_NAP.phoneDisplay}.`;
