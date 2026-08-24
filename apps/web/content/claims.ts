/**
 * apps/web/content/claims.ts — the claim registry.
 *
 * WHAT A "CLAIM" IS HERE
 *
 * Any number or checkable statement of fact this business publishes about
 * itself: a price, a percentage, a warranty length, a founding year, a review
 * count, a service-area count, a certification. Not an opinion, not a
 * description of a method, not a technical constant about wood.
 *
 * WHY A REGISTRY AND NOT JUST CONSTANTS
 *
 * `packages/shared/constants` already stops NAP drift, and `lib/pricing.ts`
 * already stops price drift. Neither of them records the two things that decide
 * whether a claim may be published at all:
 *
 *   · WHERE IT CAME FROM. `foundedYear: 2000` is a fact because an owner
 *     confirmed it. `99.7% dust capture` is a number that appears in nine
 *     files, in marketing copy, in a service blurb, in an article title and in
 *     the FAQ that Google reads as an FAQPage answer — with no source recorded
 *     anywhere, while this site's own case studies measure 99.5%. One of those
 *     is a published performance claim under the Competition Act. The registry
 *     is where that difference stops being invisible.
 *
 *   · WHERE IT MAY BE SAID. A figure that is fine in an article's body ("we
 *     aim for") is not fine inside a JSON-LD `FAQPage` answer, where it is
 *     restated by an answer engine as a fact about the business with no
 *     hedging and no context. `allowedContexts` is that boundary, written down.
 *
 * HOW IT IS ENFORCED
 *
 *   pnpm seo:claims   → scripts/verify-claims.mjs
 *
 * The guard scans every published surface for numeric-claim shapes (percentages,
 * year counts, warranty spans, "N+ projects", ratings, review counts) and fails
 * the build when it finds one that is not in this registry, or one used in a
 * context the registry does not allow it in. Adding a claim means adding a
 * source. That is the whole mechanism.
 *
 * STATUS VALUES, AND WHY `unsourced` IS ALLOWED TO EXIST
 *
 * Deleting an unsourced claim on sight is the wrong first move: it is already
 * live, deleting it silently loses the record of what was published and when,
 * and some of these will turn out to be sourceable in an afternoon. So an
 * unsourced claim is registered with `status: 'unsourced'`, a note saying what
 * evidence would settle it, and the narrowest `allowedContexts` that keeps it
 * out of structured data. The guard does not fail on it. `pnpm seo:claims
 * --strict` does — that is the flag to turn on once the queue is empty, and
 * `UNSOURCED_DEADLINE` below is the date it should happen by.
 */
import { BUSINESS_NAP, REVIEW_EVIDENCE, PRIMARY_REVIEW_EVIDENCE } from '@ecowoods/shared/constants';
import { SERVICE_AREAS, CITIES, NEIGHBOURHOOD_AREAS } from '@/lib/seo-data';
import { SCREEN_RECOAT, FULL_SAND_FINISH, NEW_INSTALL, formatBand } from '@/content/constants/pricing';

/** Where a claim is allowed to appear. Ordered loosest to strictest. */
export type ClaimContext =
  /** Body copy of an article, case study or guide, where hedging survives. */
  | 'editorial'
  /** Marketing copy on a commercial or landing page. */
  | 'marketing'
  /** A rendered FAQ block a human reads on the page. */
  | 'faq'
  /** JSON-LD. Restated verbatim by machines with no hedging. Strictest. */
  | 'schema'
  /** llms.txt, llms-full.txt, ai.txt, /api/knowledge, .md mirrors. */
  | 'machine'
  /** Emails, quotes, invoices and contracts. Contractually binding. */
  | 'document';

export type ClaimStatus =
  /** A source exists, is named below, and was checked on `verifiedAt`. */
  | 'verified'
  /** Derived by code from a verified claim. Cannot drift; nothing to check. */
  | 'derived'
  /** Published, no source recorded. Fenced out of `schema`. See `note`. */
  | 'unsourced';

export type Claim = {
  /** Stable id. Referenced by guards, reports and the citation-facts block. */
  id: string;
  /** What is being claimed, in one line, as a reader would hear it. */
  statement: string;
  /** The value itself, where it is a value. */
  value?: string | number;
  status: ClaimStatus;
  /** Who or what establishes it. A person, a document, a live URL, or code. */
  source: string;
  /** ISO date a human last confirmed `source` still says `value`. */
  verifiedAt: string;
  allowedContexts: ClaimContext[];
  /** Anything the next person needs to know before touching it. */
  note?: string;
};

/** Turn on `pnpm seo:claims --strict` in CI once nothing is `unsourced`. */
export const UNSOURCED_DEADLINE = '2026-10-31';

export const CLAIMS: Claim[] = [
  // ── Identity ──────────────────────────────────────────────────────────
  {
    id: 'business.founded',
    statement: `Ecowoods has operated in Toronto since ${BUSINESS_NAP.foundedYear}.`,
    value: BUSINESS_NAP.foundedYear,
    status: 'verified',
    source: 'Owner-confirmed (Francisco). BUSINESS_NAP.foundedYear.',
    verifiedAt: '2026-08-22',
    allowedContexts: ['editorial', 'marketing', 'faq', 'schema', 'machine', 'document'],
    note:
      'The site previously published 1998 in some places and "27 years" / "over 25 years" ' + // facts-allow
      'in others. verify-business-facts.mjs now bans all three literals.',
  },
  {
    id: 'business.yearsInBusiness',
    statement: 'Years in business, computed from the founding year at render time.',
    status: 'derived',
    source: 'yearsInBusiness() in @ecowoods/shared/constants.',
    verifiedAt: '2026-08-22',
    allowedContexts: ['editorial', 'marketing', 'faq', 'schema', 'machine', 'document'],
    note: 'Never write a year count as a literal — it is wrong every January.',
  },
  {
    id: 'business.legalName',
    statement: BUSINESS_NAP.legalName,
    value: BUSINESS_NAP.legalName,
    status: 'verified',
    source: 'Ontario corporate registration. BUSINESS_NAP.legalName.',
    verifiedAt: '2026-08-22',
    allowedContexts: ['editorial', 'marketing', 'faq', 'schema', 'machine', 'document'],
  },
  {
    id: 'business.phone',
    statement: `The published telephone number is ${BUSINESS_NAP.phoneDisplay}.`,
    value: BUSINESS_NAP.phoneDisplay,
    status: 'verified',
    source: 'BUSINESS_NAP.phoneDisplay — the single source for every surface.',
    verifiedAt: '2026-08-22',
    allowedContexts: ['editorial', 'marketing', 'faq', 'schema', 'machine', 'document'],
    note:
      'Must never be typed as a literal. app/api/chat/route.ts did exactly that ' +
      'and verify-claims.mjs now fails on it.',
  },
  {
    id: 'business.address',
    statement: `${BUSINESS_NAP.address.streetAddress}, ${BUSINESS_NAP.address.addressLocality}, ${BUSINESS_NAP.address.addressRegion} ${BUSINESS_NAP.address.postalCode}`,
    status: 'verified',
    source: 'BUSINESS_NAP.address.',
    verifiedAt: '2026-08-22',
    allowedContexts: ['editorial', 'marketing', 'faq', 'schema', 'machine', 'document'],
  },

  // ── Pricing ───────────────────────────────────────────────────────────
  {
    id: 'pricing.screenAndRecoat',
    statement: `Screen and recoat is published at ${formatBand(SCREEN_RECOAT)}.`,
    value: formatBand(SCREEN_RECOAT),
    status: 'verified',
    source: 'Owner-published service band. content/constants/pricing.ts → SCREEN_RECOAT.',
    verifiedAt: '2026-08-24',
    allowedContexts: ['editorial', 'marketing', 'faq', 'schema', 'machine', 'document'],
  },
  {
    id: 'pricing.fullSandAndFinish',
    statement: `A full sand and finish is published at ${formatBand(FULL_SAND_FINISH)}.`,
    value: formatBand(FULL_SAND_FINISH),
    status: 'verified',
    source: 'Owner-published service band. content/constants/pricing.ts → FULL_SAND_FINISH.',
    verifiedAt: '2026-08-24',
    allowedContexts: ['editorial', 'marketing', 'faq', 'schema', 'machine', 'document'],
  },
  {
    id: 'pricing.newInstall',
    statement: `New hardwood supplied and installed is published at ${formatBand(NEW_INSTALL)}.`,
    value: formatBand(NEW_INSTALL),
    status: 'verified',
    source: 'Owner-published service band. content/constants/pricing.ts → NEW_INSTALL.',
    verifiedAt: '2026-08-24',
    allowedContexts: ['editorial', 'marketing', 'faq', 'schema', 'machine', 'document'],
  },
  {
    id: 'pricing.fixedInWriting',
    statement:
      'The price is fixed in writing after the free in-home estimate and does not move afterwards.',
    status: 'verified',
    source: 'Contract terms. Enforced in the quote and contract PDF templates.',
    verifiedAt: '2026-08-24',
    allowedContexts: ['editorial', 'marketing', 'faq', 'schema', 'machine', 'document'],
  },

  // ── Workforce ─────────────────────────────────────────────────────────
  {
    id: 'workforce.salaried',
    statement:
      `The crews are salaried employees of ${BUSINESS_NAP.legalName}. No subcontractors.`,
    status: 'verified',
    source: 'Owner-confirmed employment structure. Published at /team.',
    verifiedAt: '2026-08-22',
    allowedContexts: ['editorial', 'marketing', 'faq', 'schema', 'machine', 'document'],
  },

  // ── Reviews ───────────────────────────────────────────────────────────
  {
    id: 'reviews.homestars',
    statement:
      `${PRIMARY_REVIEW_EVIDENCE.count} reviews at ${PRIMARY_REVIEW_EVIDENCE.rating.toFixed(1)}/` +
      `${PRIMARY_REVIEW_EVIDENCE.outOf} on ${PRIMARY_REVIEW_EVIDENCE.platform}.`,
    value: PRIMARY_REVIEW_EVIDENCE.count,
    status: 'verified',
    source: `${PRIMARY_REVIEW_EVIDENCE.href} — read by a person on ${PRIMARY_REVIEW_EVIDENCE.asOf}.`,
    verifiedAt: PRIMARY_REVIEW_EVIDENCE.asOf,
    allowedContexts: ['editorial', 'marketing', 'faq', 'machine'],
    note:
      'NOT allowed in `schema`. Emitting a third-party rating as this site\'s own ' +
      'aggregateRating is a structured-data violation and the reason /reviews exists. ' +
      'verify-reviews.mjs fails the build on any aggregateRating in the builders.',
  },

  // ── Coverage ──────────────────────────────────────────────────────────
  {
    id: 'coverage.serviceAreas',
    statement: `${SERVICE_AREAS.length} service areas with a published page.`,
    value: SERVICE_AREAS.length,
    status: 'derived',
    source: 'SERVICE_AREAS.length in lib/seo-data.ts.',
    verifiedAt: '2026-08-24',
    allowedContexts: ['editorial', 'marketing', 'faq', 'schema', 'machine'],
    note: `${CITIES.length} municipalities + ${NEIGHBOURHOOD_AREAS.length} Toronto neighbourhoods. Only the municipalities become schema City nodes (F-157).`,
  },

  // ── Method ────────────────────────────────────────────────────────────
  {
    id: 'method.dustContainment',
    statement:
      'HEPA-sealed extraction at the machine plus containment at the room, so most ' +
      'refinishing clients stay in the house during the work.',
    status: 'verified',
    source:
      'Equipment specification (HEPA-sealed Festool / Bona extraction) and the ' +
      'stay-at-home outcome recorded in every published case study.',
    verifiedAt: '2026-08-24',
    allowedContexts: ['editorial', 'marketing', 'faq', 'schema', 'machine', 'document'],
    note:
      'This is the claim that should be made. It is about equipment and outcome, ' +
      'both of which are checkable. See method.dustCapturePct for the one that is not.',
  },
  {
    id: 'method.dustCapturePct',
    statement: 'Roughly 99.7% of airborne particulate is captured at the source.',
    value: '99.7%',
    status: 'unsourced',
    source: 'NONE RECORDED.',
    verifiedAt: '2026-08-24',
    allowedContexts: ['editorial'],
    note:
      'THE OPEN ITEM. This figure appears in at least nine files — home-client.tsx ' +
      'twice in FAQ answers that are emitted as FAQPage JSON-LD, the SERVICES blurb ' +
      'that feeds llms.txt and /api/knowledge, the service-area template, an article ' +
      'title, and two decision guides. No measurement, no instrument, no protocol and ' +
      'no date is recorded anywhere for it. Meanwhile four of this site\'s own case ' +
      'studies report a MEASURED figure of 99.5%, from particle counts taken on the ' +
      'job. A published performance claim that the publisher\'s own evidence ' +
      'contradicts is a Competition Act exposure, not a rounding preference. ' +
      'RESOLUTION, in order of preference: (1) publish 99.5% and cite the case-study ' +
      'particle counts, which is a claim this site can actually stand behind and is a ' +
      'stronger one for being sourced; or (2) commission a measurement against a named ' +
      'protocol and register it. Until one of those happens the figure is fenced to ' +
      'editorial body copy and is barred from schema, FAQ, machine surfaces and ' +
      'documents by this registry.',
  },
  {
    id: 'method.dustCaptureMeasured',
    statement: 'Measured end-of-job particle counts correspond to 99.5% dust capture.',
    value: '99.5%',
    status: 'verified',
    source:
      'Particle counts recorded in the published case studies: Forest Hill (600/cm³), ' +
      'Distillery District (680/cm³), Yorkville (650/cm³), Midtown (620/cm³).',
    verifiedAt: '2026-08-24',
    allowedContexts: ['editorial', 'marketing', 'faq', 'schema', 'machine', 'document'],
    note: 'This is the figure the evidence supports. Prefer it over method.dustCapturePct everywhere.',
  },
  {
    id: 'method.walkOnHours',
    statement: 'Water-based finishes are low-odour and walk-on ready in 2–4 hours.',
    value: '2–4 hours',
    status: 'unsourced',
    source: 'NONE RECORDED. Finish manufacturer technical data sheet would settle it.',
    verifiedAt: '2026-08-24',
    allowedContexts: ['editorial', 'marketing', 'faq'],
    note:
      'Almost certainly correct — it is the published cure schedule for the water-based ' +
      'systems in use — but the TDS is not cited anywhere in the repository. Name the ' +
      'product and the TDS revision and this becomes verified in ten minutes.',
  },

  // ── Warranties ────────────────────────────────────────────────────────
  {
    id: 'warranty.finish',
    statement:
      'Finish and material manufacturer warranties are passed through in writing, ' +
      'itemised in the contract — typically 25–35 years on finish, up to 50 years structural.',
    value: '25–35 years finish; up to 50 years structural',
    status: 'unsourced',
    source: 'NONE RECORDED. Manufacturer warranty documents would settle it.',
    verifiedAt: '2026-08-24',
    allowedContexts: ['editorial', 'marketing', 'faq'],
    note:
      'TWO PHRASINGS ARE LIVE. seo-data FAQ_ITEMS and home-client.tsx say ' +
      '"25–35 years on finish, up to 50 years structural". home-client.tsx also says ' +
      '"25 to 50 years" in a differentiator line, which reads as a single span and ' +
      'implies a 50-year finish warranty that no manufacturer offers. Reconcile onto ' +
      'the first phrasing and attach the actual warranty PDFs. Barred from schema and ' +
      'machine surfaces until then: a warranty length is the one claim on this site ' +
      'that is directly contractual.',
  },
  {
    id: 'warranty.workmanship',
    statement: 'If the workmanship is not right, Ecowoods returns and corrects it.',
    status: 'verified',
    source: 'Contract terms.',
    verifiedAt: '2026-08-24',
    allowedContexts: ['editorial', 'marketing', 'faq', 'schema', 'machine', 'document'],
  },

  // ── Market figures (about the GTA, not about Ecowoods) ────────────────
  {
    id: 'market.installedAverage',
    statement: 'Fully installed hardwood in the GTA averages roughly $13 per square foot.',
    value: '≈ $13 / sq ft',
    status: 'unsourced',
    source: 'NONE RECORDED.',
    verifiedAt: '2026-08-24',
    allowedContexts: ['editorial'],
    note:
      'Published in the installed-cost table of the selection-and-cost paper, which is ' +
      'also served as a downloadable PDF — the most quotable format this site produces. ' +
      'It is a claim about the MARKET, not about Ecowoods, which is why it cannot simply ' +
      'be replaced with our own band: it needs a citation (a trade association survey, a ' +
      'contractor index, a published renovation cost report) or it needs to be withdrawn. ' +
      'The table row is now labelled "(GTA market)" so a reader cannot mistake it for ours.',
  },
  {
    id: 'market.installedRange',
    statement: 'Fully installed hardwood in the GTA typically runs $8–$18 per square foot.',
    value: '$8 – $18 / sq ft',
    status: 'unsourced',
    source: 'NONE RECORDED.',
    verifiedAt: '2026-08-24',
    allowedContexts: ['editorial'],
    note:
      'Same table, same problem, and this one has a second edge: its low end ($8) sits ' +
      'below the low end of our own published new-install band ($11.00), in a table that ' +
      'lists both. A reader comparing the two rows sees this company priced above the ' +
      'market it is describing, with no sourcing for the market figure. Source it or ' +
      'withdraw it.',
  },
  {
    id: 'warranty.lifetimeWorkmanship',
    statement: 'Lifetime workmanship warranty.',
    status: 'unsourced',
    source: 'NONE RECORDED. Appears only in the RenoGuide system prompt.',
    verifiedAt: '2026-08-24',
    allowedContexts: ['editorial'],
    note:
      'This phrasing exists in exactly one place — RENOGUIDE_SYSTEM_PROMPT in ' +
      'packages/shared/ai — and it is stronger than warranty.workmanship, which is what ' +
      'the rest of the site says. A conversational assistant repeating "lifetime ' +
      'workmanship warranty" to a prospect is making a commitment the contract may not ' +
      'make. Reconcile the prompt onto the contract language, or put the word "lifetime" ' +
      'in the contract.',
  },

  // ── Standards ─────────────────────────────────────────────────────────
  {
    id: 'framework.published',
    statement:
      'The EcoWoods Well-Installed Framework is published, versioned, and free to ' +
      'apply to any contractor in the GTA including Ecowoods.',
    status: 'derived',
    source: 'lib/framework.ts — FRAMEWORK_VERSION, PILLARS, criterionCount().',
    verifiedAt: '2026-08-24',
    allowedContexts: ['editorial', 'marketing', 'faq', 'schema', 'machine', 'document'],
    note: 'Pillar and criterion counts are computed. Never write either as a literal.',
  },
  {
    id: 'certifications.none',
    statement: 'Ecowoods claims no trade-body certification.',
    status: 'verified',
    source:
      'Deliberate absence. An NWFA/IHSCA claim was published in a static llms.txt ' +
      'and removed as unsupported (F-23). /about.md publishes what is NOT claimed.',
    verifiedAt: '2026-08-24',
    allowedContexts: ['editorial', 'marketing', 'faq', 'schema', 'machine', 'document'],
    note: 'Do not add a certification here without the certificate number and issuer.',
  },
];

export const claimById = (id: string): Claim | undefined => CLAIMS.find((c) => c.id === id);

export const claimsInContext = (ctx: ClaimContext): Claim[] =>
  CLAIMS.filter((c) => c.allowedContexts.includes(ctx));

/** True when `id` may be stated in `ctx`. The one function guards call. */
export const claimAllowedIn = (id: string, ctx: ClaimContext): boolean =>
  Boolean(claimById(id)?.allowedContexts.includes(ctx));

export const unsourcedClaims = (): Claim[] => CLAIMS.filter((c) => c.status === 'unsourced');

/** Every review-evidence row, so the registry cannot fall behind the constants. */
export const REVIEW_CLAIM_SOURCES = REVIEW_EVIDENCE.map((r) => ({
  platform: r.platform,
  href: r.href,
  asOf: r.asOf,
}));
