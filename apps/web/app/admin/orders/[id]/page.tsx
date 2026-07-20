import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { format } from 'date-fns';
import OrderStatusForm from './OrderStatusForm';

function formatCAD(n: number | { toNumber(): number } | null | undefined) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(
    typeof n === 'number' ? n : n.toNumber()
  );
}

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: { user: true, items: true },
  });

  if (!order) notFound();

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1 className="portal-title" style={{ fontSize: '1.25rem' }}>
            Order #{order.id.slice(0, 8).toUpperCase()}
          </h1>
          <p className="portal-subtitle">
            {order.user.name} ({order.user.email}) · {format(order.createdAt, 'MMM d, yyyy')}
          </p>
        </div>
        <Link href="/admin/orders" className="btn btn-ghost btn-sm">← Orders</Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="portal-card">
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Line Items</h2>
            <div className="portal-list">
              {order.items.map((item) => (
                <div key={item.id} className="portal-list-item">
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.productName}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>
                      {Number(item.quantity)} {item.unit === 'SQFT' ? 'sq ft' : 'x'} @ {formatCAD(item.unitPrice)}
                      {Array.isArray(item.selectedOptions) && item.selectedOptions.length > 0 && (
                        <>
                          {' · '}
                          {(item.selectedOptions as Array<{ name: string; choice: string }>)
                            .map((o) => `${o.name}: ${o.choice}`)
                            .join(', ')}
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700 }}>{formatCAD(item.lineTotal)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="portal-card">
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Payment</h2>
            <dl className="detail-list">
              <div className="detail-row"><dt>Subtotal</dt><dd>{formatCAD(order.subtotal)}</dd></div>
              <div className="detail-row"><dt>HST ({Number(order.taxRate)}%)</dt><dd>{formatCAD(Number(order.total) - Number(order.subtotal))}</dd></div>
              <div className="detail-row"><dt>Total</dt><dd style={{ fontWeight: 700 }}>{formatCAD(order.total)}</dd></div>
              <div className="detail-row"><dt>Paid at</dt><dd>{order.paidAt ? format(order.paidAt, 'MMM d, yyyy h:mm a') : '—'}</dd></div>
              <div className="detail-row"><dt>Stripe session</dt><dd style={{ fontSize: 'var(--fs-xs)' }}>{order.stripeCheckoutSessionId ?? '—'}</dd></div>
              <div className="detail-row"><dt>Stripe payment</dt><dd style={{ fontSize: 'var(--fs-xs)' }}>{order.stripePaymentIntentId ?? '—'}</dd></div>
            </dl>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <OrderStatusForm order={order} />
        </div>
      </div>
    </div>
  );
}
