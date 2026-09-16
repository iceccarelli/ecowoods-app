/**
 * GET /api/quote-intelligence/report?order=&email=
 *
 * Public — no account required, since EW-0001's buyer is a guest. Returns
 * the PDF URL only if the email matches the paying customer AND a report has
 * been published. Guarding on email rather than the order UUID alone matters
 * because the UUID travels in a plain URL (the checkout success_url) that a
 * customer might forward or that could end up in a browser history/referrer.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractReportUrl, extractTierId, isWellInstalledReviewOrder } from '@/lib/quote-intelligence/notes';
import { slaCopy } from '@/content/constants/quote-intelligence';

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
  if (!order || !isWellInstalledReviewOrder(order.notes)) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }
  if (order.user.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
    return NextResponse.json({ error: 'Email does not match this order.' }, { status: 403 });
  }

  const url = extractReportUrl(order.notes);
  if (!url) {
    return NextResponse.json({
      published: false,
      sla: slaCopy(extractTierId(order.notes)),
    });
  }

  return NextResponse.json({ published: true, url });
}
