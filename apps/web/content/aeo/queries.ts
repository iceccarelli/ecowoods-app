/**
 * content/aeo/queries.ts — the questions this business intends to be the answer to.
 *
 * WHY A REGISTRY RATHER THAN A SPREADSHEET
 *
 * "Improve AI visibility" is not measurable. "Ecowoods was cited in 14 of 62
 * tracked questions this month, up from 9, and the five it lost are all
 * Hamilton" is. The difference is a fixed question set that does not change
 * when the results are disappointing.
 *
 * So the set is versioned and lives in the repository beside everything else it
 * describes. Adding a question is a commit. Removing one because the answer got
 * worse is a commit somebody can see.
 *
 * WHAT THIS FILE IS NOT
 *
 * It is not a scraper and it does not call an answer engine. Nothing here
 * queries ChatGPT, Gemini, Perplexity or Google — those are terms-governed
 * surfaces and automating them is neither necessary nor wise. This is the
 * question set and the recording format; the observation is made by a person,
 * once a month, and written down. scripts/aeo-score.mjs turns those
 * observations into the number.
 *
 * THE COVERAGE FIELD IS THE POINT
 *
 * Every question names the page on this site that answers it, and
 * scripts/verify-aeo-queries.mjs fails the build when that page does not exist.
 * A question with no coverage is not a visibility problem — it is a content
 * gap, and it should be found here rather than discovered six months later when
 * a competitor is being cited for it.
 */

export type QueryFamily =
  /** Something is wrong with the floor. Highest intent, lowest commercial noise. */
  | 'diagnostic'
  /** A choice that is still open. */
  | 'decision'
  /** What does it cost. */
  | 'commercial'
  /** How do I judge the contractor or the quote. */
  | 'evaluation'
  /** Technical questions a professional asks. */
  | 'professional';

export interface TrackedQuery {
  id: string;
  /** Asked exactly as a person would type or say it. */
  query: string;
  family: QueryFamily;
  /**
   * The page on this site that answers it. Must exist — the guard checks.
   * A query whose coverage is null is a declared gap, and that is allowed;
   * a query pointing at a page that does not exist is not.
   */
  coverage: string | null;
  /** Where the question is being asked, when that changes the answer. */
  market?: string;
  /**
   * Why this question is worth tracking. Not every question deserves a slot;
   * sixty tracked well beats six hundred tracked badly.
   */
  why: string;
}

export const AEO_QUERY_SET_VERSION = '1.0';

export const TRACKED_QUERIES: TrackedQuery[] = [
  /* ── diagnostic ─────────────────────────────────────────────────────────
   * The highest-value family. Somebody with a cupping floor has a problem
   * today, and almost nobody publishes a real mechanism — the results are
   * listicles that say "moisture" and stop.
   */
  { id: 'd1', query: 'why is my hardwood floor cupping', family: 'diagnostic', coverage: '/glossary/cupping', why: 'The single most common failure, and the one where a mechanism beats a listicle.' },
  { id: 'd2', query: 'why is my hardwood floor crowning', family: 'diagnostic', coverage: '/glossary/crowning', why: 'Frequently misdiagnosed as cupping; the remedy is opposite.' },
  { id: 'd3', query: 'why are my floorboards separating', family: 'diagnostic', coverage: '/glossary/seasonal-gapping', why: 'Seasonal gapping is normal and is regularly sold as a defect.' },
  { id: 'd4', query: 'can over sanded hardwood be saved', family: 'diagnostic', coverage: '/glossary/wear-layer', why: 'The answer is a measurement, which is exactly what this site publishes.' },
  { id: 'd5', query: 'how do I know if my floor can be refinished again', family: 'diagnostic', coverage: '/guides/reference-refinishing-existing-hardwood', why: 'Refinish-or-replace is the highest-value decision a homeowner makes here.' },
  { id: 'd6', query: 'what causes edge peaking on hardwood floors', family: 'diagnostic', coverage: '/glossary/edge-peaking', why: 'Specific enough that a real answer wins outright.' },
  { id: 'd7', query: 'hardwood floor water damage can it be repaired', family: 'diagnostic', coverage: '/hardwood-floor-problems-toronto', why: 'High urgency; usually answered by restoration firms selling replacement.' },

  /* ── decision ────────────────────────────────────────────────────────── */
  { id: 'c1', query: 'engineered vs solid hardwood which is better', family: 'decision', coverage: '/guides/solid-vs-engineered-hardwood-toronto', why: 'The most searched decision in the category.' },
  { id: 'c2', query: 'should I refinish or replace my hardwood floor', family: 'decision', coverage: '/guides/reference-refinishing-existing-hardwood', why: 'Directly precedes a purchase.' },
  { id: 'c3', query: 'nail down vs glue down vs floating hardwood', family: 'decision', coverage: '/guides/nail-down-glue-down-or-floating', why: 'The substrate decides it, which almost no result explains.' },
  { id: 'c4', query: 'white oak vs red oak flooring', family: 'decision', coverage: '/guides/white-oak-flooring-toronto', why: 'Species comparison with a published hardness figure behind it.' },
  { id: 'c5', query: 'how much will my hardwood floor move in winter', family: 'decision', coverage: '/tools/floor-movement', why: 'A computation nobody else offers. This is a question this site can simply win.' },
  { id: 'c6', query: 'hardwood over concrete slab in a condo', family: 'decision', coverage: '/guides/reference-condominium-concrete-slab', why: 'Very high volume in this market; substrate-specific.' },
  { id: 'c7', query: 'hardwood flooring over radiant heat', family: 'decision', coverage: '/guides/reference-radiant-heat-main-floor', why: 'Gets answered badly and expensively.' },

  /* ── commercial ──────────────────────────────────────────────────────── */
  { id: 'm1', query: 'hardwood flooring cost Toronto', family: 'commercial', coverage: '/pricing', market: 'toronto', why: 'Published bands beat "call for a quote" with both people and machines.' },
  { id: 'm2', query: 'hardwood floor refinishing cost per square foot', family: 'commercial', coverage: '/guides/hardwood-flooring-cost-toronto', why: 'The question that decides whether a homeowner starts at all.' },
  { id: 'm3', query: 'cost to refinish hardwood stairs', family: 'commercial', coverage: '/hardwood-stairs-toronto', why: 'Priced per unit, not per foot; almost always answered wrongly.' },
  { id: 'm4', query: 'hardwood flooring cost Mississauga', family: 'commercial', coverage: '/service-areas/mississauga', market: 'mississauga', why: 'Confirmed market with a page.' },
  { id: 'm5', query: 'hardwood flooring cost Oakville', family: 'commercial', coverage: '/service-areas/oakville', market: 'oakville', why: 'Confirmed market with a page.' },
  { id: 'm6', query: 'hardwood floor refinishing cost Burlington', family: 'commercial', coverage: null, market: 'burlington', why: 'DECLARED GAP. Highest-scoring unconfirmed market; tracked so the gap is visible before a competitor fills it.' },
  { id: 'm7', query: 'hardwood floor refinishing cost Hamilton', family: 'commercial', coverage: null, market: 'hamilton', why: 'DECLARED GAP. No confirmed position and no local content — tracked, not claimed.' },
  { id: 'm8', query: 'dust free floor sanding Toronto', family: 'commercial', coverage: '/services/dust-free-sanding', market: 'toronto', why: 'A differentiator with a published method behind it.' },

  /* ── evaluation ──────────────────────────────────────────────────────── */
  { id: 'e1', query: 'what should a hardwood flooring quote include', family: 'evaluation', coverage: '/quote-check', why: 'The question the scope comparator was built for.' },
  { id: 'e2', query: 'how to evaluate a hardwood flooring contractor', family: 'evaluation', coverage: '/framework', why: 'A numbered, versioned, citable specification against a field of listicles.' },
  { id: 'e3', query: 'is this flooring quote fair', family: 'evaluation', coverage: '/quote-check', why: 'High intent, immediately before a decision.' },
  { id: 'e4', query: 'what moisture testing should a flooring contractor do', family: 'evaluation', coverage: '/papers/toronto-hardwood-climate-moisture-protocol', why: 'Framework criterion 1.1 answers it with a source.' },
  { id: 'e5', query: 'questions to ask a hardwood flooring contractor', family: 'evaluation', coverage: '/framework/assess', why: 'The self-assessment is literally this list.' },
  { id: 'e6', query: 'why are my two flooring quotes so different', family: 'evaluation', coverage: '/quote-check', why: 'The scope-not-price insight, which is the comparator’s whole thesis.' },

  /* ── professional ────────────────────────────────────────────────────── */
  { id: 'p1', query: 'what sander do professionals use on hardwood floors', family: 'professional', coverage: '/equipment', why: 'Sourced manufacturer data with the electrical requirement nobody else publishes.' },
  { id: 'p2', query: 'what circuit does a floor sander need', family: 'professional', coverage: '/equipment', why: 'A computation this site can answer and no manufacturer site can.' },
  { id: 'p3', query: 'hardwood grading NHLA vs NWFA', family: 'professional', coverage: '/papers/hardwood-grading-standards-nhla-nwfa', why: 'Trade-facing; builds citation weight with professionals.' },
  { id: 'p4', query: 'grit sequence for sanding hardwood floors', family: 'professional', coverage: '/papers/hardwood-refinishing-machines-and-sequence', why: 'The method paper.' },
  { id: 'p5', query: 'equilibrium moisture content Toronto', family: 'professional', coverage: '/tools/floor-movement', why: 'Computed from published coefficients; a defensible technical claim.' },
];

export const queriesInFamily = (f: QueryFamily): TrackedQuery[] =>
  TRACKED_QUERIES.filter((q) => q.family === f);

/** Questions this site does not yet answer. The content backlog, stated. */
export const declaredGaps = (): TrackedQuery[] =>
  TRACKED_QUERIES.filter((q) => q.coverage === null);
