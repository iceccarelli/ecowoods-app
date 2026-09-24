import Link from 'next/link';
import { format } from 'date-fns';
import { db } from '@/lib/db';
import { accuracySummary } from '@/lib/floor-graph/prediction';

/**
 * /admin/floor-graph — the console the Floor Graph lives or dies by.
 *
 * WHY THIS PAGE IS NOT OPTIONAL
 *
 * FG-01 gave the business a schema, FG-02 gave it consented capture and FG-03
 * gave it a prediction ledger — and every one of those writes an OUTCOME row
 * only when somebody tells it what happened. Until this page existed, the only
 * way to do that was a curl with an admin session cookie pasted into it. That
 * is not a workflow; it is a reason the ledger stays empty, and an empty
 * ledger makes the entire investment worth nothing.
 *
 * So the design goal here is a single number of clicks. A completed project
 * with a contract value is one click from being a closed prediction, because
 * the form arrives pre-filled with the value we already know and every other
 * field is optional. Twenty-five backfilled jobs is a coffee, not an
 * afternoon.
 *
 * WHAT IT SHOWS, AND WHY IN THIS ORDER
 *
 * 1. Estimating accuracy, next to the count of predictions still OPEN. Never
 *    the accuracy alone: four hundred open rows and twelve closed ones is not
 *    a twelve-row accuracy figure, it is a broken closing process, and a
 *    dashboard that hid that would be worse than no dashboard.
 * 2. The queue — completed projects with no outcome recorded. This is the
 *    work.
 * 3. The corpus counters, so the gates in the 90-day plan (150 benchmark
 *    scorings, 300 consented photo pairs) are visible rather than remembered.
 */
export const dynamic = 'force-dynamic';

function cad(n: number | null) {
  if (n === null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);
}

function pct(n: number | null) {
  if (n === null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(1)}%`;
}

export default async function FloorGraphConsole() {
  /* accuracySummary() is awaited on its own rather than inside the Promise.all
     below. It has a declared return type; the Prisma calls do not, and a
     heterogeneous Promise.all collapses the tuple inference so the declared
     type is thrown away and every `row` downstream becomes `any`. */
  const summary = await accuracySummary();

  const [floorRecords, assessments, photos, scorings, outcomes] = await Promise.all([
    db.floorRecord.count(),
    db.floorAssessment.count(),
    db.assessmentPhoto.count({ where: { erasedAt: null } }),
    db.frameworkScoring.count(),
    db.jobOutcome.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, projectId: true, service: true, completedOn: true, sellingPriceCad: true },
    }),
  ]);

  /* The queue. Completed projects are the ones with something to record; the
     soft link means this is a two-step lookup rather than a join, which is the
     cost of the schema decision in FG-01 and is paid here on purpose. */
  const completed = await db.project.findMany({
    where: { status: 'COMPLETED' },
    orderBy: { updatedAt: 'desc' },
    take: 60,
    select: { id: true, title: true, city: true, contractValue: true, endDate: true, updatedAt: true },
  });
  const closedIds = new Set(
    (await db.jobOutcome.findMany({ where: { projectId: { not: null } }, select: { projectId: true } }))
      .map((o) => o.projectId)
      .filter((id: string | null): id is string => id !== null),
  );
  const queue = completed.filter((p) => !closedIds.has(p.id));

  const price = summary.rows.find((r) => r.kind === 'PRICE_CAD');

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1 className="portal-title">Floor Graph</h1>
          <p className="portal-subtitle">
            Estimating accuracy and the jobs still waiting to be closed — {format(new Date(), 'MMMM d, yyyy')}
          </p>
        </div>
      </div>

      <div className="portal-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="portal-stat-card">
          <div className="portal-stat-label">Predictions closed</div>
          <div className="portal-stat-value">{summary.closedCount}</div>
        </div>
        <div className="portal-stat-card">
          <div className="portal-stat-label">Still open</div>
          <div className="portal-stat-value">{summary.openCount}</div>
        </div>
        <div className="portal-stat-card">
          <div className="portal-stat-label">Price error (MAPE)</div>
          <div className="portal-stat-value">{pct(price?.mape ?? null)}</div>
        </div>
        <div className="portal-stat-card">
          <div className="portal-stat-label">Mean signed error</div>
          <div className="portal-stat-value">{cad(price?.meanError ?? null)}</div>
        </div>
      </div>

      {summary.closedCount === 0 && (
        <div className="portal-card">
          <p>
            No predictions have been closed yet, so every accuracy figure above is empty and will stay
            empty until jobs are closed below. This is the one number worth watching: it is what turns
            a schema into a dataset.
          </p>
        </div>
      )}

      {summary.rows.length > 0 && (
        <div className="portal-card">
          <div className="portal-card-header">
            <h2>Accuracy by prediction</h2>
          </div>
          <table className="portal-table">
            <thead>
              <tr>
                <th scope="col">Kind</th>
                <th scope="col">Model</th>
                <th scope="col">Closed</th>
                <th scope="col">Mean signed error</th>
                <th scope="col">MAPE</th>
                <th scope="col">Within 10%</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((r) => (
                <tr key={`${r.kind}-${r.model}`}>
                  <td>{r.kind}</td>
                  <td>{r.model}</td>
                  <td>{r.closed}</td>
                  <td>{r.kind === 'PRICE_CAD' ? cad(r.meanError) : (r.meanError?.toFixed(2) ?? '—')}</td>
                  <td>{pct(r.mape)}</td>
                  <td>{pct(r.within10Pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="portal-subtitle">
            Signed on purpose. Consistently under on every job is a different and far more fixable
            problem than ±8% at random, and an absolute-only figure cannot tell them apart.
          </p>
        </div>
      )}

      <div className="portal-card">
        <div className="portal-card-header">
            <h2>Jobs waiting to be closed — {queue.length}</h2>
          </div>
        {queue.length === 0 ? (
          <p>Every completed project has an outcome recorded. That is the state to keep it in.</p>
        ) : (
          <table className="portal-table">
            <thead>
              <tr>
                <th scope="col">Project</th>
                <th scope="col">City</th>
                <th scope="col">Contract value</th>
                <th scope="col">Finished</th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              {queue.map((p) => (
                <tr key={p.id}>
                  <td>{p.title}</td>
                  <td>{p.city ?? '—'}</td>
                  <td>{cad(p.contractValue === null ? null : Number(p.contractValue))}</td>
                  <td>{p.endDate ? format(p.endDate, 'd MMM yyyy') : '—'}</td>
                  <td>
                    <Link href={`/admin/floor-graph/${p.id}`} className="btn btn-copper btn-sm">
                      Close
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="portal-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <Link href="/admin/floor-graph/records" className="portal-stat-card">
          <div className="portal-stat-label">Floor records</div>
          <div className="portal-stat-value">{floorRecords}</div>
        </Link>
        <div className="portal-stat-card">
          <div className="portal-stat-label">Assessments</div>
          <div className="portal-stat-value">{assessments}</div>
        </div>
        <div className="portal-stat-card">
          <div className="portal-stat-label">Retained photos</div>
          <div className="portal-stat-value">{photos}</div>
        </div>
        <div className="portal-stat-card">
          <div className="portal-stat-label">Benchmark scorings</div>
          <div className="portal-stat-value">{scorings}</div>
        </div>
      </div>

      {outcomes.length > 0 && (
        <div className="portal-card">
          <div className="portal-card-header">
            <h2>Recently closed</h2>
          </div>
          <table className="portal-table">
            <thead>
              <tr>
                <th scope="col">Service</th>
                <th scope="col">Completed</th>
                <th scope="col">Sold for</th>
              </tr>
            </thead>
            <tbody>
              {outcomes.map((o) => (
                <tr key={o.id}>
                  <td>{o.service ?? '—'}</td>
                  <td>{o.completedOn ? format(o.completedOn, 'd MMM yyyy') : '—'}</td>
                  <td>{cad(o.sellingPriceCad === null ? null : Number(o.sellingPriceCad))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
