import Link from 'next/link';
import { db } from '@/lib/db';
import { format } from 'date-fns';
import type { OrderStatus } from '@prisma/client';

function formatCAD(amount: number | { toNumber(): number }) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(
    typeof amount === 'number' ? amount : amount.toNumber()
  );
}

const STATUS_ORDER: OrderStatus[] = ['PENDING', 'PAID', 'FULFILLED', 'CANCELLED'];
const statusColor: Record<OrderStatus, string> = {
  PENDING: 'pending',
  PAID: 'paid',
  FULFILLED: 'completed',
  CANCELLED: 'cancelled',
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const statusFilter = status as OrderStatus | undefined;

  const orders = await db.order.findMany({
    where: statusFilter ? { status: statusFilter } : {},
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true, email: true } }, items: true },
  });

  const counts = await db.order.groupBy({ by: ['status'], _count: true });
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count]));
  const totalCount = Object.values(countMap).reduce((a, b) => a + (b as number), 0);

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1 className="portal-title">Shop Orders</h1>
          <p className="portal-subtitle">{orders.length} result{orders.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <Link href="/admin/orders" className={`btn btn-sm ${!statusFilter ? 'btn-copper' : 'btn-ghost'}`}>
          All ({totalCount})
        </Link>
        {STATUS_ORDER.map((s) => (
          <Link
            key={s}
            href={`/admin/orders?status=${s}`}
            className={`btn btn-sm ${statusFilter === s ? 'btn-copper' : 'btn-ghost'}`}
          >
            {s} ({countMap[s] ?? 0})
          </Link>
        ))}
      </div>

      <div className="portal-card">
        <table className="portal-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
              <th>Placed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>
                  No orders found.
                </td>
              </tr>
            )}
            {orders.map((order) => (
              <tr key={order.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{order.user.name ?? 'Unknown'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{order.user.email}</div>
                </td>
                <td style={{ fontSize: '0.88rem' }}>
                  {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                </td>
                <td style={{ fontWeight: 700 }}>{formatCAD(order.total)}</td>
                <td>
                  <span className={`portal-badge portal-badge-${statusColor[order.status]}`}>
                    {order.status}
                  </span>
                </td>
                <td style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>
                  {format(order.createdAt, 'MMM d, yyyy')}
                </td>
                <td>
                  <Link href={`/admin/orders/${order.id}`} className="btn btn-ghost btn-sm">
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
