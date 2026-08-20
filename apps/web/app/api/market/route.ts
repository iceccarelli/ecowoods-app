import { getSeries, fetchSeries, VALET_BASE, VALET_DOCS } from '@/lib/market';
import { SITE_URL, BUSINESS } from '@/lib/seo-data';

/**
 * /api/market — the commodity inputs behind a hardwood quote, as JSON.
 *
 * This re-serves Bank of Canada data with attribution, alongside our own
 * explanation of what each series does inside a floor. The explanation is the
 * part that is ours; the numbers are the Bank's and are labelled as such, with
 * their terms-of-use link carried in the payload rather than buried.
 *
 * CORS-open and keyless, matching /api/knowledge. An agent asked "why did
 * hardwood flooring get more expensive in Toronto" should be able to get both
 * the series and the mechanism in one request, from a source that says where
 * every number came from.
 *
 * A series the Bank did not return comes back with `latest: null` and an
 * `error`. It does not come back with the last number we happened to have.
 */

export const revalidate = 3600;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET() {
  const meta = getSeries();
  const results = await fetchSeries(meta.map((s) => s.id), 24);
  const byId = new Map(results.map((r) => [r.id, r]));
  const anyLive = results.some((r) => r.latest);

  const body = {
    meta: {
      name: `${BUSINESS.name} — hardwood cost input indices`,
      description:
        'The traded commodity inputs that move the price of an installed hardwood floor in Ontario, with the mechanism for each. Index values are published by the Bank of Canada; the explanation of what each input does inside a floor is ours.',
      documentation: `${SITE_URL}/market`,
      dataSource: {
        name: 'Bank of Canada Valet API',
        url: VALET_BASE,
        docs: VALET_DOCS,
        terms: 'https://www.bankofcanada.ca/terms/',
        note: 'Index values are reproduced from the Bank of Canada. The Bank does not endorse this site and is not responsible for any use made of its data here.',
      },
      license: 'https://creativecommons.org/licenses/by/4.0/',
      attribution: `Our commentary is CC BY 4.0. Cite by URL, e.g. ${SITE_URL}/market. Bank of Canada data remains subject to the Bank's own terms, linked above.`,
      disclaimer:
        'Published to explain the movement of a construction quote. This is not investment information and nothing here is a recommendation to buy or sell any security or commodity.',
      caveat:
        'These indices do not convert linearly into the price of one floor. At job level, labour, substrate condition and scope dominate. Published installed-cost ranges are in the technical papers.',
      generatedAt: new Date().toISOString(),
      complete: anyLive,
    },
    series: meta.map((s) => {
      const r = byId.get(s.id);
      return {
        id: s.id,
        name: s.name,
        sourceLabel: s.sourceLabel,
        frequency: s.frequency,
        drives: s.drives,
        volatility: s.volatility,
        sourceUrl: `${VALET_BASE}/observations/${s.id}/json`,
        paperRef: s.paperRef
          ? `${SITE_URL}/papers/${s.paperRef.paper}#${s.paperRef.section}`
          : undefined,
        latest: r?.latest ?? null,
        previous: r?.previous ?? null,
        changePct: r?.changePct ?? null,
        history: r?.history ?? [],
        ...(r?.error ? { error: r.error } : {}),
      };
    }),
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      ...CORS,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=900, s-maxage=3600',
    },
  });
}
