import Link from 'next/link';
import { format } from 'date-fns';
import { attributionSummary, conversionRate, type FunnelStage } from '@/lib/funnel-ledger';

/**
 * /admin/funnel — the answer to the question PG0 said cost more than money.
 *
 * WHY THIS PAGE SHIPS IN THE SAME PATCH AS THE LEDGER
 *
 * The forensic audit classified FloorAssessment, AssessmentPhoto and
 * FrameworkScoring as WRITE-ONLY: captured correctly, consented correctly, and
 * never read back by any code. That is not a small flaw. A table nobody reads
 * is indistinguishable from a table nobody writes, except that it costs more
 * and looks like progress.
 *
 * So MEAS-02 does not get to ship a ledger and call the funnel measured. The
 * write path and the read path are one patch, and this page is the read path.
 *
 * WHAT IT REFUSES TO DO
 *
 * It does not show a margin. Margin needs actual labour and material cost from
 * JobOutcome, which ECON-01 has not built the predicted side of yet, and a
 * margin computed from quoted figures would be a number that looks like
 * evidence and is not. The page says so on its face rather than leaving a gap
 * somebody fills in with an assumption.
 *
 * It does not show a conversion rate for an empty stage. Zero leads is not a
 * 0% conversion rate; it is the absence of one, and "0%" is the kind of figure
 * that gets acted on.
 */
export const dynamic = 'force-dynamic';

const LABEL: Record<FunnelStage, string> = {
  LEAD_CAPTURED: 'Lead captured',
  APPOINTMENT_BOOKED: 'Measure booked',
  QUOTE_ISSUED: 'Price issued in writing',
  QUOTE_ACCEPTED: 'Accepted',
  DEPOSIT_PAID: 'Deposit paid',
  JOB_COMPLETED: 'Job complete',
};

const money = (n: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);

export default async function FunnelPage() {
  const summary = await attributionSummary(90);
  const empty = summary.stages.every((s) => s.total === 0);

  return (
    <main className="admin-page">
      <h1>Funnel</h1>
      <p className="admin-sub">
        Commercial stages recorded server-side since {format(summary.since, 'd MMM yyyy')}.
        The top of the funnel — studio opens, designs, shares — is in GA4, joined
        to this by the same design id.
      </p>

      {empty ? (
        <section className="admin-card">
          <h2>No stages recorded yet</h2>
          <p>
            This ledger starts empty and fills as real commercial events happen. It is
            not backfilled, because a funnel assembled after the fact from rows that
            were never timestamped for it would be a guess wearing a chart&rsquo;s
            clothes. The first lead captured after this deployment is the first row.
          </p>
          <p>
            If leads are arriving and nothing appears here, check that migration{' '}
            <code>20260912010000_add_funnel_ledger</code> ran, then look for{' '}
            <code>funnel.record_failed</code> in the logs.
          </p>
        </section>
      ) : (
        <>
          <section className="admin-card">
            <h2>Of the last 90 days&rsquo; deposits, how many began in Floor Studio?</h2>
            <p className="admin-figure">
              {summary.depositsFromDesign} of {summary.depositsTotal}
            </p>
            <p>
              This question had no answer at any price before MEAS-01 and MEAS-02.
              A deposit with no design id is not a failure — it is a lead that arrived
              by phone, from a service page or through the assistant, and counting
              those honestly is what makes the attributed share mean anything.
            </p>
            <p className="admin-note">
              Gross margin by origin is <strong>not</strong> shown. It needs actual
              labour and material cost against a prediction, which is ECON-01. A margin
              built from quoted figures would look like evidence and would not be.
            </p>
          </section>

          <section className="admin-card">
            <h2>Stages</h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Count</th>
                  <th>From a design</th>
                  <th>Value</th>
                  <th>From previous</th>
                </tr>
              </thead>
              <tbody>
                {summary.stages.map((s, i) => {
                  const prev = i > 0 ? summary.stages[i - 1]! : null;
                  const rate = prev ? conversionRate(prev, s) : null;
                  return (
                    <tr key={s.stage}>
                      <td>{LABEL[s.stage]}</td>
                      <td>{s.total}</td>
                      <td>
                        {s.attributed}
                        {s.total > 0 && (
                          <span className="admin-muted">
                            {' '}
                            ({Math.round((s.attributed / s.total) * 100)}%)
                          </span>
                        )}
                      </td>
                      <td>{s.valueCad > 0 ? money(s.valueCad) : '—'}</td>
                      {/* An empty previous stage has no conversion rate. Printing
                          0% would read as failure rather than as "not started". */}
                      <td>{rate === null ? '—' : `${rate}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      )}

      <p className="admin-sub">
        Ordering and stage names come from <code>lib/funnel-ledger.ts</code>, which is
        the single definition — a funnel drawn in the wrong order reports negative
        conversion. See <Link href="/admin/floor-graph">Floor Graph</Link> for
        estimating accuracy, which is a different question from this one.
      </p>
    </main>
  );
}
