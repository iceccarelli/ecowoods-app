import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { MARKETS } from '@/content/geo/markets';
import { matchLeadsToMarkets } from '@/lib/geo/market-demand';
import {
  gscConfig, queryPerformance, classifyPage, rollup, nearMisses, windowFor, type GscRow,
} from '@/lib/search-console';

/**
 * /admin/search — what Google actually showed and what people clicked, joined
 * to the markets and services this business decides about. Private. Without
 * Search Console credentials it says so and lists what is missing; it never
 * shows an estimate in place of a measurement.
 */
export const dynamic = 'force-dynamic';

const DAYS = 28;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const path = (row: GscRow) => classifyPage(row.keys[0]).path;

export default async function SearchPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') redirect('/login');

  const state = gscConfig();
  if (!state.configured) {
    return (
      <main className="admin-page">
        <h1>Search performance</h1>
        <section className="admin-card">
          <h2>Not connected</h2>
          <p>
            No Search Console figures are shown because none are connected. Missing: <code>{state.missing.join(', ')}</code>.
          </p>
          <ol>
            <li>In Google Cloud, create a service account and a JSON key (no roles needed).</li>
            <li>In Search Console → Settings → Users and permissions, add the service account&apos;s email as a Restricted user.</li>
            <li>Set <code>GSC_CLIENT_EMAIL</code>, <code>GSC_PRIVATE_KEY</code> and <code>GSC_SITE</code> (<code>sc-domain:ecowoods.ca</code>) in the Vercel project.</li>
          </ol>
        </section>
      </main>
    );
  }

  let pages: GscRow[] = [];
  let queries: GscRow[] = [];
  let error: string | null = null;
  try {
    [pages, queries] = await Promise.all([
      queryPerformance(state.config, { days: DAYS, dimensions: ['page'], rowLimit: 1000 }),
      queryPerformance(state.config, { days: DAYS, dimensions: ['query'], rowLimit: 200 }),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Search Console could not be read';
  }

  if (error) {
    return (
      <main className="admin-page">
        <h1>Search performance</h1>
        <section className="admin-card"><h2>Could not read Search Console</h2><p>{error}</p></section>
      </main>
    );
  }

  let leads: ReturnType<typeof matchLeadsToMarkets> | null = null;
  try {
    const rows = await db.quoteRequest.groupBy({
      by: ['city'],
      _count: { _all: true },
      where: { createdAt: { gte: new Date(Date.now() - 365 * 864e5) } },
    });
    leads = matchLeadsToMarkets(rows.map((r) => ({ city: r.city, count: r._count._all })), MARKETS);
  } catch {
    leads = null;
  }

  const byKind = rollup(pages, (r) => classifyPage(r.keys[0]).kind);
  const areas = rollup(
    pages.filter((r) => classifyPage(r.keys[0]).kind === 'service-area'),
    (r) => classifyPage(r.keys[0]).slug ?? 'unknown',
  );
  const win = windowFor(DAYS);
  const near = nearMisses(pages).slice(0, 15);

  return (
    <main className="admin-page">
      <h1>Search performance</h1>
      <p className="admin-sub">
        Google Search Console, {win.startDate} to {win.endDate} (about two days behind). Measured, not estimated.
      </p>

      <section className="admin-card">
        <h2>By kind of page</h2>
        <table className="admin-table">
          <thead><tr><th>Kind</th><th>Pages shown</th><th>Impressions</th><th>Clicks</th><th>CTR</th><th>Avg position</th></tr></thead>
          <tbody>
            {byKind.map((k) => (
              <tr key={k.key}><td>{k.key}</td><td>{k.pages}</td><td>{k.impressions}</td><td>{k.clicks}</td><td>{pct(k.ctr)}</td><td>{k.position.toFixed(1)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="admin-card">
        <h2>Shown but not chosen</h2>
        <p>Pages with real impressions, ranked 3–15, clicked under 3% of the time: fix the title, the first answer and the proof before writing anything new.</p>
        {near.length === 0 ? <p>None in this window.</p> : (
          <table className="admin-table">
            <thead><tr><th>Page</th><th>Impressions</th><th>Clicks</th><th>CTR</th><th>Position</th></tr></thead>
            <tbody>{near.map((r) => (<tr key={r.keys[0]}><td>{path(r)}</td><td>{r.impressions}</td><td>{r.clicks}</td><td>{pct(r.ctr)}</td><td>{r.position.toFixed(1)}</td></tr>))}</tbody>
          </table>
        )}
      </section>

      <section className="admin-card">
        <h2>Markets: demand shown against leads received</h2>
        <table className="admin-table">
          <thead><tr><th>Market page</th><th>Impressions</th><th>Clicks</th><th>Position</th><th>Leads (12 months)</th></tr></thead>
          <tbody>
            {areas.slice(0, 40).map((a) => {
              const m = MARKETS.find((x) => x.slug === a.key);
              return (
                <tr key={a.key}>
                  <td>{m?.name ?? a.key}</td><td>{a.impressions}</td><td>{a.clicks}</td><td>{a.position.toFixed(1)}</td>
                  <td>{leads ? leads.byMarket.get(a.key) ?? 0 : 'unavailable'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="admin-card">
        <h2>Top pages</h2>
        <table className="admin-table">
          <thead><tr><th>Page</th><th>Impressions</th><th>Clicks</th><th>CTR</th><th>Position</th></tr></thead>
          <tbody>
            {[...pages].sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, 25).map((r) => (
              <tr key={r.keys[0]}><td>{path(r)}</td><td>{r.impressions}</td><td>{r.clicks}</td><td>{pct(r.ctr)}</td><td>{r.position.toFixed(1)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="admin-card">
        <h2>Top queries</h2>
        <table className="admin-table">
          <thead><tr><th>Query</th><th>Impressions</th><th>Clicks</th><th>CTR</th><th>Position</th></tr></thead>
          <tbody>
            {[...queries].sort((a, b) => b.impressions - a.impressions).slice(0, 30).map((r) => (
              <tr key={r.keys[0]}><td>{r.keys[0]}</td><td>{r.impressions}</td><td>{r.clicks}</td><td>{pct(r.ctr)}</td><td>{r.position.toFixed(1)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
