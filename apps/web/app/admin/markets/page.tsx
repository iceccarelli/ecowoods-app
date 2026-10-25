import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { MARKETS } from '@/content/geo/markets';
import { opportunityOrder, MIN_CONFIDENCE } from '@/lib/geo/opportunity';
import { matchLeadsToMarkets } from '@/lib/geo/market-demand';
import { assess } from '@/lib/geo/worthiness';

/**
 * /admin/markets — where the next page or the next dollar goes, for markets
 * Ecowoods already serves. Private: scores, confidence and lead counts never
 * reach a public surface.
 *
 * Three things side by side and never merged: what the census figures say (only
 * when a market has enough sourced weight), what the market needs before it may
 * carry its own page, and the leads that actually came in from that place.
 * Counts only; no customer data is read.
 */
export const dynamic = 'force-dynamic';

const WINDOW_DAYS = 365;

export default async function MarketsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') redirect('/login');

  let demand = null as ReturnType<typeof matchLeadsToMarkets> | null;
  try {
    const rows = await db.quoteRequest.groupBy({
      by: ['city'],
      _count: { _all: true },
      where: { createdAt: { gte: new Date(Date.now() - WINDOW_DAYS * 864e5) } },
    });
    demand = matchLeadsToMarkets(rows.map((r) => ({ city: r.city, count: r._count._all })), MARKETS);
  } catch {
    demand = null;
  }

  const ranked = opportunityOrder(MARKETS);
  const scored = ranked.filter((o) => o.score !== null).length;
  const evidence = ranked.filter((o) => o.partialScore !== null);
  const rows = [...ranked].sort(
    (a, b) =>
      (demand?.byMarket.get(b.slug) ?? 0) - (demand?.byMarket.get(a.slug) ?? 0) ||
      (b.partialScore ?? -1) - (a.partialScore ?? -1) ||
      a.slug.localeCompare(b.slug),
  );

  return (
    <main className="admin-page">
      <h1>Market priorities</h1>
      <p className="admin-sub">
        {scored} of {MARKETS.length} markets carry a score (a score needs {Math.round(MIN_CONFIDENCE * 100)}% of the
        weighting backed by sourced evidence). Ordered by leads received in the last {WINDOW_DAYS} days, then by the
        partial score. Proxy figures and parent-geography figures earn half weight.
      </p>

      <section className="admin-card">
        <h2>Markets</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Market</th><th>Status</th><th>Leads</th><th>Confidence</th><th>Score</th><th>Class</th><th>Page blockers</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const m = MARKETS.find((x) => x.slug === o.slug)!;
              const w = assess(m);
              return (
                <tr key={o.slug}>
                  <td>{o.name} <span className="admin-muted">({o.country}{m.kind === 'district' ? `, part of ${m.partOf}` : ''})</span></td>
                  <td>{m.status}</td>
                  <td>{demand ? demand.byMarket.get(o.slug) ?? 0 : 'unavailable'}</td>
                  <td>{Math.round(o.confidence * 100)}%</td>
                  <td>{o.score ?? (o.partialScore === null ? '—' : <span className="admin-muted">{o.partialScore} (partial)</span>)}</td>
                  <td>{o.classification}</td>
                  <td>
                    <details>
                      <summary>{w.indexable ? 'has a page' : `${w.blockers.length} to clear`}</summary>
                      {w.blockers.length > 0 && <ul>{w.blockers.map((b) => <li key={b}>{b}</li>)}</ul>}
                      <table className="admin-table">
                        <thead><tr><th>Input</th><th>Kind</th><th>Geography</th><th>Weight</th><th>Credited</th><th>Score</th></tr></thead>
                        <tbody>
                          {o.components.map((c) => (
                            <tr key={c.id}>
                              <td>{c.id}</td>
                              <td>{c.basis}</td>
                              <td>{c.geography ?? '—'}</td>
                              <td>{c.weight}</td>
                              <td>{c.effectiveWeight}</td>
                              <td>{c.score ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="admin-card">
        <h2>Demand outside the registry</h2>
        {!demand ? (
          <p>Lead counts could not be read.</p>
        ) : demand.unmatched.length === 0 ? (
          <p>Every lead with a city matched a registered market ({demand.total} leads, {demand.noCity} with no city).</p>
        ) : (
          <>
            <p>
              Cities on leads that match no single registered market ({demand.total} leads, {demand.noCity} with no
              city). These are evidence of demand, not authorisation to serve: coverage changes only when the owner
              confirms it.
            </p>
            <table className="admin-table">
              <thead><tr><th>City as entered</th><th>Leads</th></tr></thead>
              <tbody>{demand.unmatched.map((u) => (<tr key={u.city}><td>{u.city}</td><td>{u.count}</td></tr>))}</tbody>
            </table>
          </>
        )}
      </section>

      <p className="admin-muted">
        {evidence.length === 0
          ? 'No census file has been ingested yet, so no market has any sourced input; the order above is by leads only.'
          : `${evidence.length} market(s) have at least one sourced input.`}
      </p>
    </main>
  );
}
