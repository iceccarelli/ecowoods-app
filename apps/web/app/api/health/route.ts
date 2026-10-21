import { getSeries, fetchSeries, VALET_BASE } from '@/lib/market';
import { getStandards, stalenessDays, REVIEW_INTERVAL_DAYS } from '@/lib/standards';
import { SITE_URL, BUSINESS } from '@/lib/seo-data';

/**
 * /api/health — is this site actually alive, and does it say so honestly?
 *
 * WHY THIS EXISTS
 *
 * Everything on this site that claims to be live depends on one external
 * source. If the Bank of Canada changes an endpoint, revokes anonymous access
 * or renames a series, /market degrades to em dashes — correctly, by design —
 * and **nobody finds out**, because the failure is silent and the page still
 * renders. A site that looks self-updating and has quietly stopped updating is
 * worse than one that never claimed to.
 *
 * This is the endpoint a monitor polls. It probes the real upstream, reports
 * per-source status with the actual observation dates, and adds the things that
 * rot on a calendar rather than on a network: standards entries past their
 * review interval, and how long ago the newest observation was published.
 *
 * `status` is `ok`, `degraded` or `down`, so a check can be a single string
 * comparison rather than a JSON walk.
 *
 * No secrets, no internals, no database. Everything here is already public.
 */

export const revalidate = 300;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

const daysSince = (iso: string, now: number) =>
  Math.floor((now - Date.parse(iso)) / 86_400_000);

export async function GET() {
  const now = Date.now();
  const meta = getSeries();
  const results = await fetchSeries(meta.map((s) => s.id), 2);
  const byId = new Map(results.map((r) => [r.id, r]));

  const series = meta.map((s) => {
    const r = byId.get(s.id);
    const age = r?.latest ? daysSince(r.latest.date, now) : null;
    /* A monthly index is expected to lag — a July figure in late August is
       normal, not a fault. The daily FX series is different: more than four
       days without a new observation spans a long weekend and means something
       is wrong upstream. Judging both by one threshold would either cry wolf on
       the monthly series or never fire on the daily one. */
    const maxAge = s.frequency === 'daily' ? 4 : 70;
    const live = Boolean(r?.latest);
    return {
      id: s.id,
      name: s.name,
      frequency: s.frequency,
      status: !live ? 'down' : age !== null && age > maxAge ? 'stale' : 'ok',
      latestObservation: r?.latest?.date ?? null,
      observationAgeDays: age,
      expectedMaxAgeDays: maxAge,
      ...(r?.error ? { error: r.error } : {}),
    };
  });

  const standards = getStandards().map((s) => {
    const days = stalenessDays(s, new Date(now));
    return {
      id: s.id,
      verifiedAt: s.verifiedAt,
      ageDays: days,
      reviewIntervalDays: REVIEW_INTERVAL_DAYS,
      status: days > REVIEW_INTERVAL_DAYS ? 'due-for-review' : 'ok',
    };
  });

  const down = series.filter((s) => s.status === 'down').length;
  const stale = series.filter((s) => s.status === 'stale').length;
  const dueForReview = standards.filter((s) => s.status === 'due-for-review').length;

  const status = down === series.length ? 'down' : down > 0 || stale > 0 ? 'degraded' : 'ok';

  return new Response(
    JSON.stringify(
      {
        status,
        checkedAt: new Date(now).toISOString(),
        site: SITE_URL,
        name: `${BUSINESS.name} — service health`,
        upstream: [
          {
            name: 'Bank of Canada Valet API',
            url: VALET_BASE,
            seriesRequested: meta.length,
            seriesReturned: series.filter((s) => s.status !== 'down').length,
          },
        ],
        summary: { seriesDown: down, seriesStale: stale, standardsDueForReview: dueForReview },
        series,
        standards,
        endpoints: {
          market: `${SITE_URL}/api/market`,
          knowledge: `${SITE_URL}/api/knowledge`,
          feed: `${SITE_URL}/feed.xml`,
          sitemap: `${SITE_URL}/sitemap.xml`,
        },
      },
      null,
      2,
    ),
    {
      // A monitor must never be served a cached "ok" from before an outage.
      status: status === 'down' ? 503 : 200,
      headers: {
        ...CORS,
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=60, s-maxage=300',
      },
    },
  );
}
