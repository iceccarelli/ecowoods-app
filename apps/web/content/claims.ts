/**
 * apps/web/content/claims.ts — published business facts, served to the registry,
 * the .md mirrors and the changes feed.
 */
import { BUSINESS_NAP, REVIEW_EVIDENCE, PRIMARY_REVIEW_EVIDENCE } from '@ecowoods/shared/constants';
import { SERVICE_AREAS, CITIES, NEIGHBOURHOOD_AREAS, DISTRICT_AREAS } from '@/lib/seo-data';
import {
  SCREEN_RECOAT, FULL_SAND_FINISH, NEW_INSTALL,
  US_SCREEN_RECOAT, US_FULL_SAND_FINISH, US_NEW_INSTALL,
  formatBand,
} from '@/content/constants/pricing';

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
    note: 'Every year count derives from this value; verify-business-facts.mjs bans stale literals.',
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
      'Must never be typed as a literal.',
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
  /* The United States bands (GEO-004, owner decision D6). Registered as claims
     of their own rather than sharing the Ontario ones: a claim carries a value,
     and $4.75–$7.50 and $4.00–$6.25 USD are two different values for two
     different places. The source names the decision record, which is where the
     method lives — it is deliberately not restated on any public surface. */
  {
    id: 'pricing.us.screenAndRecoat',
    statement: `In New York State, screen and recoat is published at ${formatBand(US_SCREEN_RECOAT)}.`,
    value: formatBand(US_SCREEN_RECOAT),
    status: 'verified',
    source: 'Owner-published service band for New York State, set 2026-09-11 (docs/GEO_SOURCE_MAP.md, decision D6). content/constants/pricing.ts → US_SCREEN_RECOAT.',
    verifiedAt: '2026-09-11',
    allowedContexts: ['editorial', 'marketing', 'faq', 'schema', 'machine', 'document'],
  },
  {
    id: 'pricing.us.fullSandAndFinish',
    statement: `In New York State, a full sand and finish is published at ${formatBand(US_FULL_SAND_FINISH)}.`,
    value: formatBand(US_FULL_SAND_FINISH),
    status: 'verified',
    source: 'Owner-published service band for New York State, set 2026-09-11 (docs/GEO_SOURCE_MAP.md, decision D6). content/constants/pricing.ts → US_FULL_SAND_FINISH.',
    verifiedAt: '2026-09-11',
    allowedContexts: ['editorial', 'marketing', 'faq', 'schema', 'machine', 'document'],
  },
  {
    id: 'pricing.us.newInstall',
    statement: `In New York State, new hardwood supplied and installed is published at ${formatBand(US_NEW_INSTALL)}.`,
    value: formatBand(US_NEW_INSTALL),
    status: 'verified',
    source: 'Owner-published service band for New York State, set 2026-09-11 (docs/GEO_SOURCE_MAP.md, decision D6). content/constants/pricing.ts → US_NEW_INSTALL.',
    verifiedAt: '2026-09-11',
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
  {
    id: 'workforce.francisco',
    statement:
      `Francisco Oller owns ${BUSINESS_NAP.name} and the ecowoods.ca domain, and works the floors ` +
      `himself as the company's professional contractor and lead craftsman in Toronto and the GTA — ` +
      `hardwood installation, sanding, refinishing and restoration, stairs and railings, and colour ` +
      `matching and finish identification for stairs, trim, doors and interior woodwork against an ` +
      `existing floor.`,
    value: 'Francisco Oller',
    status: 'verified',
    source:
      'Owner-confirmed (Francisco), authorised for publication 2026-09-18. Same attribution already used ' +
      'at claims.ts business.founded. The ownership fact itself was confirmed directly, in writing, by the ' +
      'account directing this repository on 2026-09-18.',
    verifiedAt: '2026-09-18',
    allowedContexts: ['editorial', 'marketing', 'faq', 'schema', 'machine', 'document'],
    note:
      'Ownership and trade scope only. No tenure figure, headcount or certification is published for ' +
      'Francisco because none is sourced — see /team, which states the same rule for the whole crew. ' +
      'No photograph is published; /team uses an initials mark, never a generated image, because ' +
      'scripts/verify-images.mjs bans anything typed kind: "photograph" that a camera did not produce.',
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
    note: `${CITIES.length} municipalities + ${DISTRICT_AREAS.length} districts and communities within a municipality + ${NEIGHBOURHOOD_AREAS.length} Toronto neighbourhoods. Only the municipalities become schema City nodes (F-157).`,
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
    statement: 'Roughly 99.7% of airborne particulate is captured at the source.', // facts-allow: the registry names a retired claim in order to record that it was retired
    value: '99.7%', // facts-allow
    status: 'unsourced',
    /* RETIRED FROM PUBLICATION 2026-08-28 (F-165). This number was live on the
       homepage, the dust-free service page, all 32 service-area pages, two
       guides, FloorForge and /llms.txt — and inside FAQ answers that become
       FAQPage JSON-LD, which is the `schema` context this claim was explicitly
       fenced out of. The fence was written and never enforced.
       It is almost certainly a HEPA filter's certified rating quoted as a
       room-capture fraction. Those are different measurements, and the first
       general contractor with a particle counter ends the argument — taking the
       credibility of every sourced figure standing next to it.
       verify-business-facts.mjs now bans the string. It comes back the day a
       Toronto job is measured and the method is published. */
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
    statement: 'Measured end-of-job particle counts correspond to 99.5% dust capture.', // facts-allow: retired from publication 2026-08-28; the counts stay, the derived percentage does not
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

  // ── Legal surface ─────────────────────────────────────────────────────
  {
    id: 'legal.privacyPolicy',
    statement:
      'The privacy page describes what this application actually collects, every processor it ' +
      'sends data to, and how to ask for access or deletion.',
    status: 'unsourced',
    source: 'Derived from the application code — apps/web/lib/legal.ts names the file and the import for each processor. NOT reviewed by a lawyer.',
    verifiedAt: '2026-08-24',
    allowedContexts: ['editorial', 'marketing'],
    note:
      'THE PAGE ITSELF IS TRUE; ITS STATUS IS THE OPEN ITEM. /privacy and /terms were linked ' +
      'from four places — the footer of every page, the cookie banner\'s "learn more", and the ' +
      'registration form\'s "I agree to the Privacy Policy and Terms of Service" — and neither ' +
      'route existed. All four were 404s. A consent banner whose policy link does not resolve ' +
      'cannot produce informed consent, which is the whole reason PIPEDA asks for the banner, ' +
      'and a registration form asking for agreement to two documents that do not exist is asking ' +
      'for agreement to nothing. Both pages now exist and describe the real behaviour. What is ' +
      'still missing is a person with the standing to bind the business having read them: ' +
      'REVIEW.approved in lib/legal.ts is false, and both pages say so in their own body. Flip ' +
      'it when that has happened. `pnpm seo:legal` fails the build if a new data processor is ' +
      'imported without being declared — it caught Anthropic on its first run, which the chat ' +
      'assistant had been sending customer messages to, undeclared.',
  },

  // ── Standards ─────────────────────────────────────────────────────────
  {
    id: 'framework.published',
    statement:
      'The Ecowoods Well-Installed Framework is published, versioned, and free to ' +
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

/** Every review-evidence row, so the registry cannot fall behind the constants. */
export const REVIEW_CLAIM_SOURCES = REVIEW_EVIDENCE.map((r) => ({
  platform: r.platform,
  href: r.href,
  asOf: r.asOf,
}));
