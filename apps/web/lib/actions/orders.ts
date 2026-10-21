'use server';

/**
 * Shop order server actions (admin).
 */

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { OrderStatus } from '@prisma/client';

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');
  if (!(['PENDING', 'PAID', 'FULFILLED', 'CANCELLED', 'REFUNDED'] as const).includes(status)) throw new Error('Unknown order status.');

  await db.order.update({ where: { id: orderId }, data: { status } });

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/mypage/orders');

  return { success: true };
}
