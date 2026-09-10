/**
 * lib/geo/worthiness.ts — whether a market has earned a page.
 *
 * THE DECISION THIS FILE EXISTS TO MAKE
 *
 * A market gets an indexable page when publishing one makes the site better,
 * and not when adding a municipality to a list makes the map look bigger.
 * Those two are easy to confuse, because the second is what a template
 * rewards. So the decision is computed from evidence and the answer is
 * auditable.
 *
 * Four things are required, all of them, and none of them is a matter of
 * degree:
 *
 *   1. LOCAL CONTENT EXISTS. A CityContent entry with a real intro and a real
 *      housing note. Not "Hardwood flooring in <City>" — the fields carry the
 *      rule already: EVERY field must be REAL.
 *   2. THE OPERATIONAL POSITION IS VERIFIED. Somebody confirmed, on a date,
 *      what can honestly be said about serving the place. A page for a market
 *      whose `verifiedAt` is null is a page that implies coverage nobody has
 *      confirmed.
 *   3. (RETIRED 2026-09-10.) A third requirement used to sit here: the market
 *      must not be a `us-proxy`, because a page would have read as a United
 *      States location for a company with no United States position. The owner
 *      confirmed cross-border licensing and crew authorization on that date, so
 *      a New York market now earns a page on exactly the same terms as an
 *      Ontario one — real local content and a dated confirmation. What a New
 *      York page still may not carry is a second address, telephone or set of
 *      hours; that is enforced in scripts/verify-geo.mjs, where it belongs,
 *      rather than by refusing the page.
 *   4. IT DOES NOT CANNIBALISE ITS PARENT. A district inside a municipality
 *      that already has a page competes with it for the same queries unless it
 *      carries content the parent does not.
 *
 * The score below is advisory — it ranks the queue of markets worth writing
 * content for next. It cannot promote a market past the four requirements, and
 * `isIndexable` never consults it. A scoring function that can override a truth
 * requirement is a scoring function that will.
 */
import { type Market, marketBySlug } from '@/content/geo/markets';
import { cityContent, type CityContent } from '@/lib/seo-data';

export interface Worthiness {
  slug: string;
  indexable: boolean;
  /** Every requirement that is not met, in words. Empty when indexable. */
  blockers: string[];
  /** Advisory ranking for the content queue. Never gates publication. */
  score: number;
}

const hasRealContent = (cc: CityContent | undefined): boolean =>
  Boolean(cc && cc.intro.trim().length >= 120 && cc.housingNote.trim().length >= 120);

export function assess(market: Market): Worthiness {
  const cc = cityContent(market.slug);
  const blockers: string[] = [];

  if (!hasRealContent(cc)) {
    blockers.push(
      'no local content: needs a CityContent entry with a real intro and housing note, not a template with the place name substituted in.',
    );
  }
  if (market.operationalTruth.verifiedAt === null) {
    blockers.push(
      'operational position unverified: nobody has confirmed, on a date, what can honestly be said about serving this market.',
    );
  }
  if (market.kind === 'district' && market.partOf) {
    const parent = marketBySlug(market.partOf);
    const parentIndexable = parent ? cityContent(parent.slug) !== undefined : false;
    if (parentIndexable && !hasRealContent(cc)) {
      blockers.push(
        `cannibalises ${market.partOf}: a district page competes with its municipality for the same queries unless it carries content the parent does not.`,
      );
    }
  }

  return { slug: market.slug, indexable: blockers.length === 0, blockers, score: scoreOf(market, cc) };
}

/**
 * The content queue, not the publication gate.
 *
 * Weighted toward markets where writing real content is both possible and
 * useful: a corridor hub with several neighbours pointing at it, in a corridor
 * that is already partly covered, is worth an afternoon before a market at the
 * far end of the map is.
 */
function scoreOf(market: Market, cc: CityContent | undefined): number {
  let n = 0;
  if (market.status === 'core-active') n += 40;
  else if (market.status === 'active-expansion') n += 30;
  else if (market.status === 'us-active') n += 20;
  else if (market.status === 'corridor-target') n += 15;
  else if (market.status === 'travel-by-confirmation') n += 5;
  else if (market.status === 'us-by-confirmation') n += 5;

  n += market.corridors.length * 5;
  n += Math.min(market.nearest.length, 4) * 3;
  if (market.kind === 'municipality') n += 10;
  if (market.operationalTruth.verifiedAt) n += 15;
  if (cc) n += 20;
  if (market.localFacts.length) n += market.localFacts.length * 2;
  return n;
}

export const indexableMarkets = (all: Market[]): Market[] =>
  all.filter((x) => assess(x).indexable);

/** The queue: what to write next, best first. */
/**
 * THE EXPANSION SCORECARD — and the four fields it refuses to invent.
 *
 * The brief asks for a weighted market score built from population, household
 * income, home values, renovation spend, CPC, competitive intensity and
 * projected contribution margin. Every one of those is a real input and not one
 * of them is in this repository. Typing a number for "renovation spend in
 * Burlington" would produce a score that looks authoritative, ranks markets,
 * directs capital, and is fiction.
 *
 * So this computes what CAN be computed from what is actually known — routing,
 * adjacency, evidence, confirmation — and returns the economic inputs as
 * `null` with a list of what is missing. A market cannot outrank another on
 * data nobody supplied.
 *
 * The result is still decisive. Corridor centrality and neighbour count are
 * real facts about where a crew can reach on one drive, and a confirmed
 * position with real local content beats an unconfirmed market with neither,
 * every time, regardless of what its median home price turns out to be.
 */
export interface ExpansionScore {
  slug: string;
  name: string;
  /** 0–100 from what is known. Never includes an invented economic figure. */
  score: number;
  components: {
    /** Corridors this market sits on. A junction is worth more than a terminus. */
    routing: number;
    /** Confirmed neighbours: a market surrounded by covered ones is cheap to reach. */
    adjacency: number;
    /** Confirmed operational position, on a date. */
    confirmation: number;
    /** Real local content and published evidence. */
    evidence: number;
  };
  /** Economic inputs the brief asks for and this repository does not hold. */
  missing: string[];
  /** What has to happen next for this market, in one line. */
  nextAction: string;
}

const ECONOMIC_INPUTS = [
  'population',
  'household income',
  'home values',
  'housing age profile',
  'hardwood prevalence',
  'renovation spend',
  'search demand and CPC',
  'competitive intensity',
  'travel time from the shop',
  'historical project value in this market',
];

export function expansionScore(market: Market, all: Market[]): ExpansionScore {
  const cc = cityContent(market.slug);
  const corridors = market.corridors.length;

  /* A junction is where two drives meet: more ways to reach it, more jobs that
     can share a day. A terminus is reachable one way only. */
  const routing = Math.min(corridors * 12, 30);

  /* Neighbours whose position is confirmed. Reaching a market next to three
     covered ones is a different proposition from reaching an isolated one. */
  const confirmedNeighbours = market.nearest.filter((slug) => {
    const n = all.find((x) => x.slug === slug);
    return n ? n.operationalTruth.verifiedAt !== null : false;
  }).length;
  const adjacency = Math.min(confirmedNeighbours * 8, 24);

  const confirmation = market.operationalTruth.verifiedAt ? 26 : 0;

  let evidence = 0;
  if (cc) evidence += 12;
  if (cc?.signatureProject) evidence += 8;
  evidence += Math.min(market.localFacts.length * 2, 6);

  const score = routing + adjacency + confirmation + evidence;

  const nextAction = !market.operationalTruth.verifiedAt
      ? 'Confirm the operational position: one sentence and a date. Nothing else can happen first.'
      : !cc
        ? 'Write local content from a real job here. The page appears automatically once it exists.'
        : cc.signatureProject
          ? 'Covered. Keep the evidence current.'
          : 'Publish one photographed job from this market.';

  return {
    slug: market.slug,
    name: market.name,
    score,
    components: { routing, adjacency, confirmation, evidence },
    missing: ECONOMIC_INPUTS,
    nextAction,
  };
}

/**
 * Every market, best-scoring first. The expansion order.
 *
 * This filtered to Canada until 2026-09-10, when it had to: a United States
 * market could not hold a page, so ranking one produced a queue entry nobody
 * could act on. Since the New York confirmation both countries are on the same
 * queue and the same terms — real local content and a dated position — which is
 * the point of the confirmation.
 */
export const expansionOrder = (all: Market[]): ExpansionScore[] =>
  all
    .map((m) => expansionScore(m, all))
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));

export const contentQueue = (all: Market[]): Worthiness[] =>
  all
    .map(assess)
    .filter((w) => !w.indexable)
    .sort((a, b) => b.score - a.score);
