'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { updateOrderStatus } from '@/lib/actions/orders';
import type { Order, OrderStatus } from '@prisma/client';

const STATUSES: OrderStatus[] = ['PENDING', 'PAID', 'FULFILLED', 'CANCELLED'];

export default function OrderStatusForm({ order }: { order: Order }) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await updateOrderStatus(order.id, status);
      toast.success('Order status updated.');
      router.refresh();
    } catch {
      toast.error('Failed to update status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="portal-card">
      <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Order Status</h2>
      <div className="field">
        <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <button
        onClick={handleUpdate}
        disabled={loading || status === order.status}
        className="btn btn-copper btn-sm"
        style={{ width: '100%' }}
      >
        {loading ? 'Updating…' : 'Update Status'}
      </button>
    </div>
  );
}
