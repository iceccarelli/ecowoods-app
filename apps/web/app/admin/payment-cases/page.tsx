import Link from 'next/link';
import { format } from 'date-fns';
import { db } from '@/lib/db';
import type { PaymentCaseStatus } from '@prisma/client';
import ResolveCaseForm from './ResolveCaseForm';

const KIND_LABEL = {
  LATE_PAYMENT_VOID_INVOICE: 'Late payment on a VOID invoice',
  REFUND_NEEDS_REVIEW: 'Refund needs review',
  CREDIT_REVERSAL_RECOMMENDED: 'Credit reversal recommended',
  DISPUTE_OPENED: 'Dispute opened',
} as const;

const money = (n: { toNumber(): number }, currency: string) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: currency.toUpperCase() }).format(n.toNumber());

export default async function AdminPaymentCasesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter: PaymentCaseStatus = status === 'RESOLVED' ? 'RESOLVED' : 'OPEN';

  const [cases, counts] = await Promise.all([
    db.paymentCase.findMany({ where: { status: filter }, orderBy: { createdAt: 'desc' }, take: 200 }),
    db.paymentCase.groupBy({ by: ['status'], _count: true }),
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count]));

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1 className="portal-title">Payment reconciliation</h1>
          <p className="portal-subtitle">
            Real Stripe payments, refunds and disputes that need a person. Nothing here refunds or reverses automatically.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <Link href="/admin/payment-cases" className={`btn btn-sm ${filter === 'OPEN' ? 'btn-copper' : 'btn-ghost'}`}>Open ({countMap.OPEN ?? 0})</Link>
        <Link href={`/admin/payment-cases?status=${'RESOLVED' satisfies PaymentCaseStatus}`} className={`btn btn-sm ${filter === 'RESOLVED' ? 'btn-copper' : 'btn-ghost'}`}>Resolved ({countMap.RESOLVED ?? 0})</Link>
      </div>

      {cases.length === 0 && <div className="portal-card" style={{ color: 'var(--muted)' }}>No {filter.toLowerCase()} cases.</div>}

      <div style={{ display: 'grid', gap: '1rem' }}>
        {cases.map((c) => (
          <div key={c.id} className="portal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <strong>{KIND_LABEL[c.kind]}</strong>
              <span style={{ fontWeight: 700 }}>{money(c.amount, c.currency)}</span>
            </div>
            <p style={{ margin: '0.5rem 0', fontSize: 'var(--fs-sm)' }}>{c.summary}</p>
            <dl style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', display: 'grid', gap: '0.15rem' }}>
              <div>Opened {format(c.createdAt, 'MMM d, yyyy HH:mm')}</div>
              {c.stripePaymentIntentId && <div>Payment intent: <code>{c.stripePaymentIntentId}</code></div>}
              {c.stripeChargeId && <div>Charge: <code>{c.stripeChargeId}</code></div>}
              {c.invoiceId && <div>Invoice: <code>{c.invoiceId}</code></div>}
              {c.orderId && (
                <div>Order: <Link href={`/admin/orders/${c.orderId}`}><code>{c.orderId}</code></Link></div>
              )}
              {c.userId && <div>Customer: <code>{c.userId}</code></div>}
            </dl>
            {c.status === 'OPEN' ? (
              <ResolveCaseForm caseId={c.id} />
            ) : (
              <p style={{ marginTop: '0.75rem', fontSize: 'var(--fs-sm)' }}>
                <strong>{c.resolution?.replaceAll('_', ' ').toLowerCase()}</strong>
                {c.resolvedAt ? ` — ${format(c.resolvedAt, 'MMM d, yyyy HH:mm')}` : ''}
                {c.resolutionNote ? `: ${c.resolutionNote}` : ''}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
