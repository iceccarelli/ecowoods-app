/**
 * lib/geo/allocation.ts — the 70/20/10 depth split, measured rather than intended.
 *
 * WHAT THE RATIO IS NOW, AND WHAT IT USED TO BE
 *
 * It used to be 80/20 Canada/United States and it meant omission: eighty percent
 * of the effort in Ontario, twenty percent in New York, and the American twenty
 * bought reach rather than pages because a `us-proxy` market could not hold one.
 * A hard floor under Canada's share of the model was the right guard for that
 * world.
 *
 * Since the owner confirmed the New York position on 2026-09-10 the ratio means
 * something different: it is a DEPTH budget, not a publication rule. Every
 * market in the model is published. What differs is how hard the page is worked
 * — the Toronto luxury mesh carries the full anatomy, the QEW belt carries the
 * standard one, the Niagara hinge and western New York carry a tight complete
 * matrix. Tight is not thin: all six services, the booking path, the schema and
 * the sitemap entry are on every page in every tier.
 *
 * So this measures depth by tier and coverage by country, and the guard has
 * stopped asking "is Canada winning" and started asking "is any published market
 * carrying less than the floor its tier promises".
 *
 * THE MEASURES
 *
 *   published — markets with an indexable page. Should approach every market
 *               with local content; a gap here is a page that was written and
 *               is not being served.
 *   depth     — characters of published local content, by country. The tier
 *               budget lives here, and it is the number that shows whether a
 *               New York page is tight or merely thin.
 *   records   — markets in the model at all.
 *   graph     — corridor memberships and nearest-market edges.
 *
 * There is no longer a Canadian floor on records, because there is no longer a
 * reason to ration American ones. What replaced it is a floor on the DEPTH of
 * any published page, which is the thing a directory-shaped expansion actually
 * breaks.
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
        'Markets with a published indexable page. Both countries publish on the same terms since 2026-09-10: real ' +
        'local content and a dated confirmation. A market with content and no page here is a page that was written ' +
        'and is not being served.',
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
 * The floor on the AVERAGE depth of a published page, in characters of local
 * content, measured per country.
 *
 * This replaced a floor on Canada's share of the model, which stopped meaning
 * anything the day New York became a service area: rationing American records
 * was a proxy for "do not publish thin American pages", and now that they are
 * published the real thing can be measured directly.
 *
 * THE NUMBER IS READ FROM THE CORPUS, NOT CHOSEN AS AN ASPIRATION.
 *
 * The eighty-nine published pages run from about 290 characters of local
 * content at the tightest Toronto neighbourhood to well over a thousand at the
 * larger municipalities, with a median near 570. The floor sits just under the
 * observed minimum, so it fails a genuine regression — somebody pasting a
 * hundred-and-fifty-character stub for a new market — without retroactively
 * condemning pages that shipped and rank.
 *
 * Setting it at the median instead would have failed a quarter of the live site
 * on the day it was introduced, which is how a guard gets disabled rather than
 * satisfied. If the corpus deepens, this number moves up behind it.
 */
export const MIN_MEAN_DEPTH = 280;

/** Mean characters of published local content per page, by country. */
export const meanDepth = (): { ca: number; us: number } => {
  const rows = allocation();
  const pages = rows.find((r) => r.measure === 'pages')!;
  const depth = rows.find((r) => r.measure === 'depth')!;
  return {
    ca: pages.ca === 0 ? 0 : Math.round(depth.ca / pages.ca),
    us: pages.us === 0 ? 0 : Math.round(depth.us / pages.us),
  };
};
