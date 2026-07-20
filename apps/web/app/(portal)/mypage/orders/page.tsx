import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { format } from 'date-fns';

function formatCAD(amount: number | { toNumber(): number }) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(
    typeof amount === 'number' ? amount : amount.toNumber()
  );
}

const statusBadge: Record<string, string> = {
  PENDING: 'portal-badge-pending',
  PAID: 'portal-badge-paid',
  FULFILLED: 'portal-badge-completed',
  CANCELLED: 'portal-badge-cancelled',
};

export default async function MyOrdersPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const orders = await db.order.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1 className="portal-title">My Orders</h1>
          <p className="portal-subtitle">{orders.length} order{orders.length !== 1 ? 's' : ''} placed</p>
        </div>
        <Link href="/mypage" className="btn btn-copper btn-sm">
          + Shop materials &amp; extras
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="portal-empty-state">
          <p>You haven&apos;t placed any orders yet.</p>
          <Link href="/mypage" className="btn btn-copper btn-sm">Browse the shop</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {orders.map((order) => (
            <div key={order.id} className="portal-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>Order #{order.id.slice(0, 8).toUpperCase()}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>
                    {format(order.createdAt, 'MMM d, yyyy')} · {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 'var(--fs-lg)' }}>{formatCAD(order.total)}</div>
                  <span className={`portal-badge ${statusBadge[order.status] ?? 'portal-badge-neutral'}`}>
                    {order.status}
                  </span>
                </div>
              </div>
              <div className="portal-list">
                {order.items.map((item) => (
                  <div key={item.id} className="portal-list-item">
                    <div>
                      <div style={{ fontWeight: 600 }}>{item.productName}</div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>
                        {Number(item.quantity)} {item.unit === 'SQFT' ? 'sq ft' : 'x'} @ {formatCAD(item.unitPrice)}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700 }}>{formatCAD(item.lineTotal)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
