import Link from 'next/link';
import { format } from 'date-fns';
import { db } from '@/lib/db';
import type { PaymentCaseKind } from '@prisma/client';
import { UNAPPLIED_REASON_ACTION } from '@/lib/payment-reconciliation';
import ResolveCaseForm from './ResolveCaseForm';

const KIND_LABEL: Record<PaymentCaseKind, string> = {
  LATE_PAYMENT_VOID_INVOICE: 'Late payment on a VOID invoice',
  REFUND_NEEDS_REVIEW: 'Refund needs review',
  CREDIT_REVERSAL_RECOMMENDED: 'Credit reversal recommended',
  DISPUTE_OPENED: 'Dispute opened',
  DUPLICATE_PAYMENT: 'Duplicate payment (paid twice)',
  UNAPPLIED_PAYMENT: 'Payment could not be applied',
};
const KINDS = Object.keys(KIND_LABEL) as PaymentCaseKind[];

type View = 'OPEN' | 'RESOLVED' | 'ALL';

const money = (n: { toNumber(): number }, currency: string) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: currency.toUpperCase() }).format(n.toNumber());

const href = (view: View, kind?: PaymentCaseKind) => {
  const q = new URLSearchParams();
  if (view !== 'OPEN') q.set('status', view);
  if (kind) q.set('kind', kind);
  const qs = q.toString();
  return `/admin/payment-cases${qs ? `?${qs}` : ''}`;
};

export default async function AdminPaymentCasesPage({ searchParams }: { searchParams: Promise<{ status?: string; kind?: string }> }) {
  const { status, kind } = await searchParams;
  const view: View = status === 'RESOLVED' ? 'RESOLVED' : status === 'ALL' ? 'ALL' : 'OPEN';
  const kindFilter = KINDS.find((k) => k === kind);

  const [cases, counts] = await Promise.all([
    db.paymentCase.findMany({
      where: { ...(view === 'ALL' ? {} : { status: view }), ...(kindFilter ? { kind: kindFilter } : {}) },
      orderBy: { createdAt: view === 'OPEN' ? 'asc' : 'desc' }, // oldest unresolved first
      take: 200,
    }),
    db.paymentCase.groupBy({ by: ['status', 'kind'], _count: true }),
  ]);
  const open = counts.filter((c) => c.status === 'OPEN').reduce((n, c) => n + c._count, 0);
  const resolved = counts.filter((c) => c.status === 'RESOLVED').reduce((n, c) => n + c._count, 0);
  const openByKind = new Map(counts.filter((c) => c.status === 'OPEN').map((c) => [c.kind, c._count]));

  const invoiceIds = [...new Set(cases.flatMap((c) => (c.invoiceId ? [c.invoiceId] : [])))];
  const invoices = invoiceIds.length ? await db.invoice.findMany({ where: { id: { in: invoiceIds } }, select: { id: true, number: true, status: true } }) : [];
  const invoiceById = new Map(invoices.map((i) => [i.id, i]));

  const orderIds = [...new Set(cases.flatMap((c) => (c.orderId ? [c.orderId] : [])))];
  const orders = orderIds.length ? await db.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, status: true } }) : [];
  const orderById = new Map(orders.map((o) => [o.id, o]));

  /** What is needed, in plain words, for an UNAPPLIED_PAYMENT whose reason has a specific instruction. */
  const neededFor = (c: (typeof cases)[number]): string | null => {
    if (c.kind !== 'UNAPPLIED_PAYMENT') return null;
    const reason = (c.details as { reason?: unknown } | null)?.reason;
    return typeof reason === 'string' ? (UNAPPLIED_REASON_ACTION[reason] ?? null) : null;
  };

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

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <Link href={href('OPEN', kindFilter)} className={`btn btn-sm ${view === 'OPEN' ? 'btn-copper' : 'btn-ghost'}`}>Open ({open})</Link>
        <Link href={href('RESOLVED', kindFilter)} className={`btn btn-sm ${view === 'RESOLVED' ? 'btn-copper' : 'btn-ghost'}`}>Resolved ({resolved})</Link>
        <Link href={href('ALL', kindFilter)} className={`btn btn-sm ${view === 'ALL' ? 'btn-copper' : 'btn-ghost'}`}>All ({open + resolved})</Link>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }} aria-label="Filter by kind">
        <Link href={href(view)} className={`btn btn-sm ${!kindFilter ? 'btn-copper' : 'btn-ghost'}`}>Any kind</Link>
        {KINDS.map((k) => (
          <Link key={k} href={href(view, k)} className={`btn btn-sm ${kindFilter === k ? 'btn-copper' : 'btn-ghost'}`}>
            {KIND_LABEL[k]}
            {openByKind.get(k) ? ` (${openByKind.get(k)} open)` : ''}
          </Link>
        ))}
      </div>

      {cases.length === 0 && <div className="portal-card" style={{ color: 'var(--muted)' }}>No {view === 'ALL' ? '' : `${view.toLowerCase()} `}cases{kindFilter ? ` of this kind` : ''}.</div>}

      <div style={{ display: 'grid', gap: '1rem' }}>
        {cases.map((c) => {
          const invoice = c.invoiceId ? invoiceById.get(c.invoiceId) : undefined;
          const refunded = c.refundedAmount ? c.refundedAmount.toNumber() : null;
          const fullyRefunded = refunded !== null && refunded >= c.amount.toNumber();
          return (
            <div key={c.id} className="portal-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <strong>{KIND_LABEL[c.kind]}</strong>
                <span style={{ fontWeight: 700 }}>{money(c.amount, c.currency)}</span>
              </div>
              {neededFor(c) && <p style={{ margin: '0.5rem 0 0', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>{neededFor(c)}</p>}
              <p style={{ margin: '0.5rem 0', fontSize: 'var(--fs-sm)' }}>{c.summary}</p>
              {(refunded !== null || c.refundFailedAt || c.disputeId) && (
                <ul style={{ margin: '0 0 0.5rem', paddingLeft: '1.1rem', fontSize: 'var(--fs-sm)' }}>
                  {refunded !== null && (
                    <li>
                      Stripe reports {fullyRefunded ? 'a full' : 'a partial'} refund of {money(c.refundedAmount!, c.currency)} on this payment
                      {c.refundedAt ? ` (${format(c.refundedAt, 'MMM d, yyyy HH:mm')})` : ''}. The order was not changed.
                    </li>
                  )}
                  {c.refundFailedAt && <li>A refund for this payment failed or was canceled in Stripe ({format(c.refundFailedAt, 'MMM d, yyyy HH:mm')}). The money may not have left.</li>}
                  {c.disputeId && (
                    <li>
                      A dispute was opened on this payment{c.disputedAt ? ` (${format(c.disputedAt, 'MMM d, yyyy HH:mm')})` : ''}: <code>{c.disputeId}</code>. Respond in the Stripe dashboard.
                    </li>
                  )}
                </ul>
              )}
              <dl style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', display: 'grid', gap: '0.15rem' }}>
                <div>Opened {format(c.createdAt, 'MMM d, yyyy HH:mm')}</div>
                {c.stripePaymentIntentId && <div>Payment intent: <code>{c.stripePaymentIntentId}</code></div>}
                {c.stripeChargeId && <div>Charge: <code>{c.stripeChargeId}</code></div>}
                {c.invoiceId && (
                  <div>
                    Invoice: <Link href={invoice ? `/admin/invoices?status=${invoice.status}` : '/admin/invoices'}>{invoice?.number ?? <code>{c.invoiceId}</code>}</Link>
                  </div>
                )}
                {c.orderId && (
                  <div>
                    Order: <Link href={`/admin/orders/${c.orderId}`}><code>{c.orderId}</code></Link>
                    {orderById.get(c.orderId) ? ` (now ${orderById.get(c.orderId)!.status})` : ''}
                  </div>
                )}
                {c.userId && <div>Customer: <Link href="/admin/users"><code>{c.userId}</code></Link></div>}
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
          );
        })}
      </div>
    </div>
  );
}
