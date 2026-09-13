import Link from 'next/link';
import { db } from '@/lib/db';
import { format, subDays } from 'date-fns';
import { AGE_BAND_LABEL, buildQueue, summarise } from '@/lib/lead-queue';
import { deliveryHealth } from '@/lib/delivery-health';

function formatCAD(amount: number | { toNumber(): number } | null | undefined) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(
    amount == null ? 0 : typeof amount === 'number' ? amount : amount.toNumber()
  );
}

export default async function AdminDashboard() {
  const thirtyDaysAgo = subDays(new Date(), 30);

  const [
    totalQuotes,
    newQuotes,
    activeProjects,
    pendingInvoices,
    pendingInvoiceTotal,
    recentPayments,
    openInquiries,
    recentQuotes,
    pendingQuoteCount,
    newOrders,
  ] = await Promise.all([
    db.quoteRequest.count(),
    db.quoteRequest.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.project.count({ where: { status: { in: ['IN_PROGRESS', 'CONTRACT_SENT', 'SIGNED', 'DEPOSIT_PAID'] } } }),
    db.invoice.count({ where: { status: { in: ['SENT', 'OVERDUE'] } } }),
    db.invoice.aggregate({
      where: { status: { in: ['SENT', 'OVERDUE'] } },
      _sum: { total: true },
    }),
    db.payment.findMany({
      where: { createdAt: { gte: thirtyDaysAgo }, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { invoice: { select: { number: true, project: { select: { title: true } } } } },
    }),
    db.inquiry.count({ where: { status: { in: ['NEW', 'IN_PROGRESS'] } } }),
    /* DESK-01 — OLDEST FIRST, and ten rather than six.
       
       This was `createdAt: 'desc'`, take 6. Newest-first is right for a feed
       and exactly wrong for a queue of unanswered work: measured on production,
       fourteen enquiries are PENDING and the oldest is eighty-five days old, so
       the one that most needs answering was the last row in the list or off the
       bottom of it. */
    db.quoteRequest.findMany({
      where: { status: { in: ['PENDING'] } },
      orderBy: { createdAt: 'asc' },
      take: 10,
    }),
    db.quoteRequest.count({ where: { status: 'PENDING' } }),
    db.order.count({
      where: { status: { in: ['PENDING', 'PAID'] }, createdAt: { gte: thirtyDaysAgo } },
    }),
  ]);

  /* DESK-01 — the ageing queue. Oldest first, with an age and a band, and an
     indicative range from the SAME published bands the visitor was shown. */
  const queue = buildQueue(
    recentQuotes.map((q) => ({
      id: q.id,
      name: q.name,
      city: q.city,
      service: q.service,
      squareFeet: q.squareFeet,
      createdAt: q.createdAt,
    })),
  );
  const waiting = summarise(queue);

  /* ALERT-01 — read the environment on the server, on every render. Not
     cached and not computed at build time: the whole point is to report what
     THIS running deployment will do with the next lead. */
  const delivery = deliveryHealth();

  const pendingBankPayments = await db.payment.count({
    where: { method: 'BANK_TRANSFER', status: 'PENDING' },
  });

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1 className="portal-title">Dashboard</h1>
          <p className="portal-subtitle">Overview as of {format(new Date(), 'MMMM d, yyyy')}</p>
        </div>
        <Link href="/admin/invoices/new" className="btn btn-copper btn-sm">
          + Create Invoice
        </Link>
      </div>

      {/* Key metrics */}
      <div className="portal-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="portal-stat-card">
          <div className="portal-stat-label">New Quotes (30d)</div>
          <div className="portal-stat-value">{newQuotes}</div>
          <Link href="/admin/quotes" className="portal-stat-link">Review →</Link>
        </div>
        <div className="portal-stat-card">
          <div className="portal-stat-label">Active Projects</div>
          <div className="portal-stat-value">{activeProjects}</div>
          <Link href="/admin/projects" className="portal-stat-link">View projects →</Link>
        </div>
        <div className="portal-stat-card">
          <div className="portal-stat-label">Outstanding Invoices</div>
          <div className="portal-stat-value" style={{ color: pendingInvoices > 0 ? 'var(--warning)' : undefined }}>
            {formatCAD(pendingInvoiceTotal._sum.total ?? 0)}
          </div>
          <Link href="/admin/invoices" className="portal-stat-link">{pendingInvoices} invoice{pendingInvoices !== 1 ? 's' : ''} →</Link>
        </div>
        <div className="portal-stat-card">
          <div className="portal-stat-label">Open Inquiries</div>
          <div className="portal-stat-value" style={{ color: openInquiries > 0 ? 'var(--warning)' : undefined }}>
            {openInquiries}
          </div>
          <Link href="/admin/inquiries" className="portal-stat-link">Reply →</Link>
        </div>
        <div className="portal-stat-card">
          <div className="portal-stat-label">New Orders (30d)</div>
          <div className="portal-stat-value">{newOrders}</div>
          <Link href="/admin/orders" className="portal-stat-link">View orders →</Link>
        </div>
      </div>

      {/* ALERT-01 — THE ONE THAT COMES FIRST.
          Above the bank-transfer notice on purpose: a payment waiting to be
          confirmed is money already won, and this is about whether the next
          one is ever heard of. Shown only when NOTHING delivers, because a
          warning that is always on screen is furniture within a week. */}
      {!delivery.anyLive && (
        <div
          role="alert"
          className="admin-alert admin-alert-danger"
          style={{
            marginBottom: '1.5rem',
            padding: '1rem 1.25rem',
            background: 'rgba(176, 72, 72, 0.12)',
            border: '1px solid rgba(176, 72, 72, 0.4)',
            borderRadius: 'var(--radius)',
            color: 'var(--ink)',
          }}
        >
          <strong>Nothing tells anyone when a quote request arrives.</strong>
          <p style={{ margin: '0.5rem 0 0', fontSize: 'var(--fs-sm)' }}>
            Email and SMS are both unconfigured on this deployment. A request is
            saved and the page thanks the visitor exactly as it does when the
            notification works — <strong>no error is raised and nothing is logged</strong>,
            because the email transport falls back to writing the message to the
            server log and returning successfully.
            {pendingQuoteCount > 0 && (
              <>
                {' '}Right now {pendingQuoteCount} {pendingQuoteCount === 1 ? 'request is' : 'requests are'} waiting
                {waiting.oldestDays > 0 && <> and the oldest has been waiting {waiting.oldestDays} days</>}.
              </>
            )}
          </p>
          <ul style={{ margin: '0.6rem 0 0', paddingLeft: '1.1rem', fontSize: 'var(--fs-sm)' }}>
            {delivery.channels.map((c) => (
              <li key={c.id} style={{ marginBottom: '0.25rem' }}>
                <strong>{c.label}:</strong> {c.detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Delivery, when it IS configured: one quiet line, so it can be checked
          rather than assumed. Destinations are masked. */}
      {delivery.anyLive && (
        <p style={{ margin: '0 0 1.25rem', fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>
          New requests reach{' '}
          {delivery.channels
            .filter((c) => c.live)
            .map((c) => `${c.to} by ${c.via}`)
            .join(' and ')}
          {delivery.channels.some((c) => !c.live) && (
            <>
              {' · '}
              {delivery.channels.filter((c) => !c.live).map((c) => c.label).join(' and ')} not configured
            </>
          )}
        </p>
      )}

      {/* Alerts */}
      {pendingBankPayments > 0 && (
        <div className="admin-alert" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', background: 'rgba(212, 164, 68, 0.12)', border: '1px solid rgba(212, 164, 68, 0.35)', borderRadius: 'var(--radius)', color: 'var(--ink)' }}>
          ⚠️ <strong>{pendingBankPayments}</strong> bank transfer payment{pendingBankPayments > 1 ? 's' : ''} awaiting confirmation.{' '}
          <Link href="/admin/invoices" style={{ color: 'var(--copper-deep)', fontWeight: 700 }}>Review now →</Link>
        </div>
      )}

      <div className="portal-grid-2">
        {/* Unreviewed quotes */}
        <div className="portal-card">
          <div className="portal-card-header">
            <h2>Waiting for a reply</h2>
            <Link href="/admin/quotes" className="portal-card-link">All quotes ({totalQuotes})</Link>
          </div>
          {/* DESK-01 — the number and the age, before the list. A panel that
              showed six dates could be read as six recent enquiries; it was
              fourteen, and the oldest had been waiting eighty-five days. */}
          {queue.length > 0 && (
            <p style={{ margin: '0 0 .75rem', fontSize: 'var(--fs-sm)' }}>
              <strong>
                {pendingQuoteCount} waiting
              </strong>
              {' · oldest '}
              {waiting.oldestDays} {waiting.oldestDays === 1 ? 'day' : 'days'}
              {waiting.late > 0 && (
                <>
                  {' · '}
                  <strong>{waiting.late} past the one-business-day reply this site promises</strong>
                </>
              )}
            </p>
          )}
          {queue.length === 0 ? (
            <p className="portal-empty">No new quotes — inbox zero! 🎉</p>
          ) : (
            <div className="portal-list">
              {queue.map((q) => (
                <Link key={q.id} href={`/admin/quotes/${q.id}`} className="portal-list-item portal-list-item-link">
                  <div>
                    <div style={{ fontWeight: 600 }}>{q.name}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>
                      {q.city ?? '—'} · {q.service ?? 'General'}
                      {q.squareFeet ? ` · ${q.squareFeet.toLocaleString()} sq ft` : ''}
                      {/* Published band × stated area. Not a quote, and only
                          where the area was actually given. */}
                      {q.indicative
                        ? ` · ~${q.indicative.low.toLocaleString()}–${q.indicative.high.toLocaleString()} ${q.indicative.currency} at published bands`
                        : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {/* The AGE, not the date. "20 Jun" reads as a fact;
                        "85 days" reads as a problem. */}
                    <span
                      className={`portal-badge portal-badge-${
                        q.band === 'cold' || q.band === 'overdue' ? 'warning' : 'info'
                      }`}
                    >
                      {AGE_BAND_LABEL[q.band]}
                    </span>
                    <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--muted)', marginTop: '0.25rem' }}>
                      {q.ageDays === 0 ? 'today' : `${q.ageDays}d`} · {format(q.createdAt, 'MMM d')}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent payments */}
        <div className="portal-card">
          <div className="portal-card-header">
            <h2>Recent Payments (30d)</h2>
            <Link href="/admin/invoices" className="portal-card-link">All invoices</Link>
          </div>
          {recentPayments.length === 0 ? (
            <p className="portal-empty">No payments in the last 30 days.</p>
          ) : (
            <div className="portal-list">
              {recentPayments.map((pay) => (
                <div key={pay.id} className="portal-list-item">
                  <div>
                    <div style={{ fontWeight: 600 }}>#{pay.invoice.number}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>
                      {pay.invoice.project.title.slice(0, 50)}{pay.invoice.project.title.length > 50 ? '…' : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCAD(pay.amount)}</div>
                    <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--muted)' }}>
                      {pay.method?.replace('_', ' ') ?? ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
