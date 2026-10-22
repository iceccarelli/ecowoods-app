import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import {
  WINDOW_OPTIONS,
  loadFunnelReport,
  parseWindowDays,
  type CohortRow,
} from '@/lib/funnel-report';
import { FUNNEL_ORDER } from '@/lib/funnel-ledger';

/**
 * /admin/funnel — conversion from first touch to deposit, read from the data
 * the business already holds.
 *
 * Every figure is computed in lib/funnel-report.ts from rows in the database.
 * Nothing here is sample data: an empty window shows zeros as counts, an
 * un-instrumented stage shows "not recorded", and a rate with nothing to
 * divide by shows a dash. Counts and rates only — no customer name, email or
 * phone is ever read for this page.
 */
export const dynamic = 'force-dynamic';

const pct = (v: number | null) => (v === null ? '—' : `${v}%`);

function CohortTable({ rows }: { rows: CohortRow[] }) {
  return (
    <table className="admin-table">
      <thead>
        <tr>
          <th>Channel</th>
          {FUNNEL_ORDER.map((s, i) => (
            <th key={s}>{i === 0 ? 'Leads' : `→ ${s.toLowerCase().replace(/_/g, ' ')}`}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.channel}>
            <td>
              {r.label}
              {r.unlinkedLeads > 0 && <span className="admin-muted"> ({r.unlinkedLeads} not followable)</span>}
            </td>
            {FUNNEL_ORDER.map((s, i) => (
              <td key={s}>
                {r.counts[s]}
                {i > 0 && <span className="admin-muted"> ({pct(r.stepRates[s])})</span>}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function FunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') redirect('/login');

  const days = parseWindowDays((await searchParams).days);
  const { report, from, timezone } = await loadFunnelReport(days);
  const rec = report.quoteRecovery;
  const rc = report.reconciliation;
  const nothing = report.period.stages.every((s) => s.count === 0) && rc.quoteRequests.databaseRows === 0;

  return (
    <main className="admin-page">
      <h1>Conversion funnel</h1>
      <p className="admin-sub">
        Last {days} days, from the start of {new Date(from).toLocaleDateString('en-CA', { timeZone: timezone })} ({timezone} days, today included).{' '}
        {WINDOW_OPTIONS.map((d) => (
          <span key={d}>
            {d === days ? <strong>{d} days</strong> : <Link href={`/admin/funnel?days=${d}`}>{d} days</Link>}{' '}
          </span>
        ))}
      </p>

      {nothing && (
        <section className="admin-card">
          <h2>Nothing recorded in this window</h2>
          <p>
            The ledger fills as real leads, bookings, quotes and deposits happen; it is not backfilled.
            If leads are arriving and nothing appears, look for <code>funnel.record_failed</code> in the logs.
          </p>
        </section>
      )}

      <section className="admin-card">
        <h2>Events in the window</h2>
        <table className="admin-table">
          <thead>
            <tr><th>Stage</th><th>Count</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>First touch (site visit)</td>
              <td>not recorded <span className="admin-muted">(lives in GA4, not in this database)</span></td>
            </tr>
            {report.period.stages.map((s) => (
              <tr key={s.stage}><td>{s.label}</td><td>{s.count}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="admin-card">
        <h2>Leads captured in the window, followed forward</h2>
        <p className="admin-note">
          Each cell is the number of those leads that reached the stage or a later one, with the step
          conversion from the stage before in brackets. A dash means nothing to divide by. Channels come
          from the lead&rsquo;s recorded source; a Floor Studio design id takes precedence.
        </p>
        <CohortTable rows={report.cohort.rows} />
      </section>

      <section className="admin-card">
        <h2>Ledger coverage</h2>
        <p className="admin-note">
          Rows in the database against rows in the funnel ledger for the same window. A difference means
          some records were created without a ledger row (older code paths, or a failed best-effort write).
        </p>
        <table className="admin-table">
          <thead><tr><th>Record</th><th>Database rows</th><th>Ledger rows</th></tr></thead>
          <tbody>
            <tr><td>Quote requests / leads</td><td>{rc.quoteRequests.databaseRows}</td><td>{rc.quoteRequests.ledgerLeads}</td></tr>
            <tr><td>Appointments</td><td>{rc.appointments.databaseRows}</td><td>{rc.appointments.ledgerAppointments}</td></tr>
          </tbody>
        </table>
      </section>

      <section className="admin-card">
        <h2>Quote recovery</h2>
        <table className="admin-table">
          <thead><tr><th>Step</th><th>Count</th><th>From previous</th></tr></thead>
          <tbody>
            <tr><td>Reminder requested</td><td>{rec.requested}</td><td>—</td></tr>
            <tr><td>Confirmed (double opt-in)</td><td>{rec.confirmed}</td><td>{pct(rec.rates.confirmed)}</td></tr>
            <tr><td>Reminder sent</td><td>{rec.sent}</td><td>{pct(rec.rates.sent)}</td></tr>
            <tr><td>Converted</td><td>{rec.converted}</td><td>{pct(rec.rates.converted)}</td></tr>
          </tbody>
        </table>
      </section>

      <section className="admin-card">
        <h2>Assistant usage</h2>
        <table className="admin-table">
          <tbody>
            <tr><td>Conversations created</td><td>{report.assistant.conversationsCreated}</td></tr>
            <tr>
              <td>With a lead handoff (a lead captured on the same design)</td>
              <td>{report.assistant.withLeadHandoff} <span className="admin-muted">({pct(report.assistant.handoffRate)})</span></td>
            </tr>
          </tbody>
        </table>
      </section>

      <p className="admin-sub">
        Margin by origin is not shown: it needs actual job costs (ECON-01). JSON for this page:{' '}
        <Link href={`/api/admin/funnel?days=${days}`}>/api/admin/funnel?days={days}</Link>.
      </p>
    </main>
  );
}
