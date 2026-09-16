/**
 * GET /api/listing-floor-report/report?order=&email=
 *
 * Public — no account required (guest checkout). Returns the PDF URL only if
 * the email matches the paying customer AND a report has been published.
 * Same email-gate reasoning as EW-0002's equivalent route: the order UUID
 * already travels in a plain checkout success_url.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractListingReportSku, extractListingReportUrl, isListingFloorReportOrder } from '@/lib/listing-floor-report/notes';
import { listingReportSkuConfig } from '@/content/constants/listing-floor-report-product';

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
  if (!order || !isListingFloorReportOrder(order.notes)) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }
  if (order.user.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
    return NextResponse.json({ error: 'Email does not match this order.' }, { status: 403 });
  }

  const url = extractListingReportUrl(order.notes);
  if (!url) {
    return NextResponse.json(
      { published: false, sla: listingReportSkuConfig(extractListingReportSku(order.notes))?.sla },
      { status: 409 },
    );
  }

  return NextResponse.json({ published: true, url });
}
