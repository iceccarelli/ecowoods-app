import Link from 'next/link';
import { db } from '@/lib/db';
import { format } from 'date-fns';
import type { InvoiceStatus } from '@prisma/client';

function formatCAD(n: number | { toNumber(): number }) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(
    typeof n === 'number' ? n : n.toNumber()
  );
}

const statusColor: Record<InvoiceStatus, string> = {
  DRAFT: 'neutral',
  SENT: 'warning',
  OVERDUE: 'danger',
  PAID: 'success',
  VOID: 'neutral',
};

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: InvoiceStatus }>;
}) {
  const { status } = await searchParams;
  const statusFilter = status;

  const [invoices, pendingBankPayments] = await Promise.all([
    db.invoice.findMany({
      where: statusFilter ? { status: statusFilter } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        project: { include: { user: { select: { name: true, email: true } } } },
        payments: { where: { status: 'PENDING' } },
      },
    }),
    db.payment.findMany({
      where: { method: 'BANK_TRANSFER', status: 'PENDING' },
      include: {
        invoice: {
          select: { number: true, total: true, project: { select: { title: true, user: { select: { name: true } } } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const counts = await db.invoice.groupBy({ by: ['status'], _count: true });
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count]));
  const statuses: InvoiceStatus[] = ['DRAFT', 'SENT', 'OVERDUE', 'PAID', 'VOID'];

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1 className="portal-title">Invoices</h1>
          <p className="portal-subtitle">{invoices.length} invoices</p>
        </div>
        <Link href="/admin/invoices/new" className="btn btn-copper btn-sm">+ New Invoice</Link>
      </div>

      {/* Pending bank payments alert */}
      {pendingBankPayments.length > 0 && (
        <div style={{ padding: '1rem 1.25rem', background: 'rgba(212,164,68,0.12)', border: '1px solid rgba(212,164,68,0.4)', borderRadius: 'var(--radius)', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            ⚠️ {pendingBankPayments.length} Bank Transfer{pendingBankPayments.length > 1 ? 's' : ''} Awaiting Confirmation
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {pendingBankPayments.map((pay) => (
              <div key={pay.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.88rem' }}>
                <div>
                  <strong>#{pay.invoice.number}</strong> — {pay.invoice.project.user.name}
                  <br />
                  <span style={{ color: 'var(--muted)' }}>{pay.invoice.project.title.slice(0, 60)}</span>
                  {pay.bankReference && <span style={{ marginLeft: '0.5rem' }}>Ref: <code>{pay.bankReference}</code></span>}
                </div>
                <span style={{ fontWeight: 700 }}>{formatCAD(pay.amount)}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '0.75rem' }}>
            Open each invoice to mark as paid once you verify receipt in your banking app.
          </p>
        </div>
      )}

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <Link href="/admin/invoices" className={`btn btn-sm ${!statusFilter ? 'btn-copper' : 'btn-ghost'}`}>All</Link>
        {statuses.map((s) => (
          <Link key={s} href={`/admin/invoices?status=${s}`} className={`btn btn-sm ${statusFilter === s ? 'btn-copper' : 'btn-ghost'}`}>
            {s} ({countMap[s] ?? 0})
          </Link>
        ))}
      </div>

      <div className="portal-card">
        <table className="portal-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Project / Customer</th>
              <th>Stage</th>
              <th>Total</th>
              <th>Status</th>
              <th>Due</th>
              <th>Bank Pending</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>No invoices found.</td></tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td style={{ fontWeight: 700 }}>#{inv.number}</td>
                <td>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{inv.project.title.slice(0, 50)}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{inv.project.user.name}</div>
                </td>
                <td style={{ fontSize: '0.88rem' }}>{inv.stage}</td>
                <td style={{ fontWeight: 700 }}>{formatCAD(inv.total)}</td>
                <td>
                  <span className={`portal-badge portal-badge-${statusColor[inv.status]}`}>{inv.status}</span>
                </td>
                <td style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                  {inv.dueDate ? format(inv.dueDate, 'MMM d') : '—'}
                </td>
                <td>
                  {inv.payments.length > 0 && (
                    <span className="portal-badge portal-badge-warning">⏳ Pending</span>
                  )}
                </td>
                <td>
                  <Link href={`/admin/projects/${inv.projectId}`} className="btn btn-ghost btn-sm">Manage</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
