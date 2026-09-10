/**
 * lib/geo/allocation.ts — the 80/20 split, measured rather than intended.
 *
 * THE TARGET
 *
 * 80% of geographic effort in Ontario, 20% in western New York. It is a good
 * ratio and it is the kind of intention that survives exactly as long as nobody
 * checks. Six months of "let's add Buffalo suburbs, they're high-value" is how
 * a Canadian contractor ends up with an American-looking site, and no single
 * commit in that sequence looks wrong.
 *
 * So it is computed, on four measures the brief itself names, and a guard fails
 * the build when Canada's share of the one that matters drops below the floor.
 *
 * THE FOUR MEASURES, AND WHY NOT JUST URLS
 *
 *   pages    — markets with a published, indexable page. The measure that
 *              actually moves rankings, and the one under a hard floor.
 *   depth    — characters of published local content. Twenty American stubs and
 *              twenty Canadian essays are not a 50/50 split, and counting URLs
 *              would say they were.
 *   records  — markets in the model at all. The widest measure, and the one
 *              that moves first when attention drifts.
 *   graph    — prominence inside the geographic graph itself: corridor
 *              memberships plus nearest-market edges. This is where the
 *              American twenty percent actually lives, so it is the measure
 *              that shows the allocation being spent rather than merely
 *              intended.
 *
 * THE ASYMMETRY IS THE POINT
 *
 * US markets can never hold a page here — `worthiness.ts` refuses one to a
 * `us-proxy` market, because a page would read as a United States location for
 * a company that has no United States office. So the page and depth measures
 * are structurally 100/0, and that is correct, not a bug to be balanced away.
 * The 20% American allocation is real and it is spent on *reach* — records in
 * the model, corridor structure, the entity graph's expansion story — not on
 * landing pages claiming service. The report says which measure is which so
 * nobody reads 100/0 as a failure or 80/20 as permission to publish in Buffalo.
 */
import { MARKETS, type Market } from '@/content/geo/markets';
import { cityContent } from '@/lib/seo-data';
import { assess } from './worthiness';

export interface Split {
  measure: string;
  ca: number;
  us: number;
  caShare: number;
  /** What this measure counts, and what a number here does and does not mean. */
  means: string;
}

const share = (ca: number, us: number): number =>
  ca + us === 0 ? 1 : Math.round((ca / (ca + us)) * 1000) / 1000;

const countBy = (f: (m: Market) => number): { ca: number; us: number } => ({
  ca: MARKETS.filter((m) => m.country === 'CA').reduce((n, m) => n + f(m), 0),
  us: MARKETS.filter((m) => m.country === 'US').reduce((n, m) => n + f(m), 0),
});

const contentLength = (m: Market): number => {
  const cc = cityContent(m.slug);
  if (!cc) return 0;
  return cc.intro.length + cc.housingNote.length;
};

/*
 * Graph prominence: every corridor this market belongs to, plus every
 * nearest-market edge it declares. Both are real structure — a market with
 * three corridors and three neighbours is reachable from more places in the
 * model than one sitting at the end of a line.
 *
 * An earlier version of this measure counted internal links inside CityContent
 * and read 0 for every market in both countries, because CityContent carries
 * prose and no hrefs. A measure that always returns zero is worse than no
 * measure: it reports a perfect Canadian share forever and would have gone on
 * doing so through any drift it was supposed to catch.
 */
const graphEdges = (m: Market): number => m.corridors.length + m.nearest.length;

export function allocation(): Split[] {
  const records = countBy(() => 1);
  const pages = countBy((m) => (assess(m).indexable ? 1 : 0));
  const depth = countBy(contentLength);
  const graph = countBy(graphEdges);

  return [
    {
      measure: 'records',
      ...records,
      caShare: share(records.ca, records.us),
      means:
        'Markets in the geographic model. The widest measure and the first to drift: adding American place names ' +
        'is cheap and feels like progress.',
    },
    {
      measure: 'pages',
      ...pages,
      caShare: share(pages.ca, pages.us),
      means:
        'Markets with a published indexable page. Structurally 100/0 and correct: a us-proxy market can never hold ' +
        'a page, because one would read as a United States location for a company that has no United States office.',
    },
    {
      measure: 'depth',
      ...depth,
      caShare: share(depth.ca, depth.us),
      means:
        'Characters of published local content. Counting URLs would call twenty stubs and twenty essays an even ' +
        'split; this does not.',
    },
    {
      measure: 'graph',
      ...graph,
      caShare: share(graph.ca, graph.us),
      means:
        'Corridor memberships and nearest-market edges. Where the American twenty percent is actually spent, since ' +
        'it can never be spent on pages.',
    },
  ];
}

/**
 * The floor on Canada's share of markets in the model. Set below the 80%
 * target with room for the model to breathe, and far enough above half that a
 * drift toward an American-looking site fails the build long before a person
 * would notice it in a diff.
 */
export const CA_RECORD_FLOOR = 0.7;
