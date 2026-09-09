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
 *   3. IT IS NOT A US PROXY. Those exist for advertising reach; a page would
 *      read as a United States location, which is exactly the impression this
 *      business must not create.
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

  if (market.status === 'us-proxy') {
    blockers.push(
      'us-proxy: advertising reach, not a service area. A page here would read as a United States location.',
    );
  }
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
  else if (market.status === 'corridor-target') n += 15;
  else if (market.status === 'travel-by-confirmation') n += 5;

  n += market.corridors.length * 5;
  n += Math.min(market.nearest.length, 4) * 3;
  if (market.kind === 'municipality') n += 10;
  if (market.operationalTruth.verifiedAt) n += 15;
  if (cc) n += 20;
  if (market.localFacts.length) n += market.localFacts.length * 2;
  if (market.status === 'us-proxy') n = 0;
  return n;
}

export const indexableMarkets = (all: Market[]): Market[] =>
  all.filter((x) => assess(x).indexable);

/** The queue: what to write next, best first. */
export const contentQueue = (all: Market[]): Worthiness[] =>
  all
    .map(assess)
    .filter((w) => !w.indexable && !w.blockers.some((b) => b.startsWith('us-proxy')))
    .sort((a, b) => b.score - a.score);
