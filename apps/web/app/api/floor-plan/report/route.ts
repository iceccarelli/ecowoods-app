/**
 * GET /api/floor-plan/report?order=&email=
 *
 * Public — no account required (guest checkout). Generates the PDF on first
 * call for a PAID order (ensureFloorPlanReport is idempotent), same as the
 * [id] page itself; either surface converges to the same stored URL.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureFloorPlanReport } from '@/lib/floor-plan/generate';
import { isFloorPlanOrder } from '@/lib/floor-plan/notes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('order');
  const email = searchParams.get('email');

  if (!orderId || !email) {
    return NextResponse.json({ error: 'Missing order or email.' }, { status: 400 });
  }

  const order = await db.order.findUnique({ where: { id: orderId }, include: { user: true } });
  if (!order || !isFloorPlanOrder(order.notes)) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }
  if (order.user.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
    return NextResponse.json({ error: 'Email does not match this order.' }, { status: 403 });
  }

  const result = await ensureFloorPlanReport(orderId);
  if (!result.ok) {
    const status = result.reason === 'not_paid' ? 402 : result.reason === 'bad_design' ? 422 : 404;
    return NextResponse.json({ published: false, reason: result.reason }, { status });
  }

  return NextResponse.json({ published: true, url: result.url });
}
