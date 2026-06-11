import Link from 'next/link';
import { db } from '@/lib/db';
import { format, subDays } from 'date-fns';

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
    db.quoteRequest.findMany({
      where: { status: { in: ['PENDING'] } },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
  ]);

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
      </div>

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
            <h2>New Leads Requiring Review</h2>
            <Link href="/admin/quotes" className="portal-card-link">All quotes ({totalQuotes})</Link>
          </div>
          {recentQuotes.length === 0 ? (
            <p className="portal-empty">No new quotes — inbox zero! 🎉</p>
          ) : (
            <div className="portal-list">
              {recentQuotes.map((q) => (
                <Link key={q.id} href={`/admin/quotes/${q.id}`} className="portal-list-item portal-list-item-link">
                  <div>
                    <div style={{ fontWeight: 600 }}>{q.name}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                      {q.city}, {q.province} · {q.service ?? 'General'}
                      {q.squareFeet ? ` · ${q.squareFeet.toLocaleString()} sq ft` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span className={`portal-badge portal-badge-${q.status === 'PENDING' ? 'info' : 'warning'}`}>
                      {q.status}
                    </span>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                      {format(q.createdAt, 'MMM d')}
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
                    <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                      {pay.invoice.project.title.slice(0, 50)}{pay.invoice.project.title.length > 50 ? '…' : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCAD(pay.amount)}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
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
