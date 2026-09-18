/**
 * POST /api/listing-floor-report/publish — ADMIN only.
 *
 * Composes, renders the PDF, stores it, appends LFR_REPORT: to Order.notes
 * (never overwriting the sku/meta lines already there), emails the customer,
 * and only THEN moves Order.status to FULFILLED — per this spec,
 * documents-received is not fulfillment; a generated report is. Idempotent:
 * a second publish returns the existing URL rather than a second PDF and a
 * second customer email.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { compose } from '@/lib/listing-floor-report/compose';
import { storeListingFloorReport } from '@/lib/listing-floor-report/store';
import {
  appendListingReportMarker,
  extractListingReportSku,
  extractListingReportUrl,
  extractMeta,
  isListingFloorReportOrder,
} from '@/lib/listing-floor-report/notes';
import { listingReportSkuConfig } from '@/content/constants/listing-floor-report-product';
import type { ComposeInput } from '@/lib/listing-floor-report/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Partial<ComposeInput> | null;
  if (!body?.orderId) {
    return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
  }

  const order = await db.order.findUnique({ where: { id: body.orderId }, include: { user: true } });
  if (!order || !isListingFloorReportOrder(order.notes)) {
    return NextResponse.json({ error: 'Not a listing floor report order' }, { status: 404 });
  }

  const existingUrl = extractListingReportUrl(order.notes);
  if (existingUrl) {
    return NextResponse.json({ url: existingUrl, alreadyPublished: true });
  }

  const meta = extractMeta(order.notes);
  if (!meta) {
    return NextResponse.json({ error: 'No intake submitted for this order yet.' }, { status: 409 });
  }

  const sku = extractListingReportSku(order.notes);
  const result = compose({
    orderId: order.id,
    sku,
    photographyDate: meta.photographyDate,
    recommendation: body.recommendation ?? 'cannot_determine_from_photos',
    findings: body.findings ?? { finishWear: 'not_specified', woodDamage: 'not_specified', moisture: 'inspection_needed' },
    present: body.present ?? '',
    missing: body.missing ?? '',
    askInWriting: body.askInWriting,
  });

  if (!result.ok) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }

  let url: string;
  try {
    url = await storeListingFloorReport(result.report);
  } catch (err) {
    console.error('[listing-floor-report publish] PDF generation failed:', err);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }

  await db.order.update({
    where: { id: order.id },
    data: { notes: appendListingReportMarker(order.notes, url), status: 'FULFILLED' },
  });

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const reportLink = `${origin}/listing-floor-report/report?order=${order.id}&email=${encodeURIComponent(order.user.email)}`;
  const skuConfig = listingReportSkuConfig(sku);

  try {
    await sendEmail({
      to: order.user.email,
      subject: 'Your Pre-List Floor Condition Report is ready',
      html:
        `<h2 style="margin:0 0 8px;">Your floor condition report is ready</h2>` +
        `<p style="margin:0 0 16px;">Read it here: <a href="${reportLink}">${reportLink}</a></p>` +
        `<p style="margin:0 0 16px;">${skuConfig?.sla ?? ''}</p>`,
      text: `Your Pre-List Floor Condition Report is ready: ${reportLink}`,
    });
  } catch (err) {
    console.error('[listing-floor-report publish] customer email failed:', err);
  }

  console.log(JSON.stringify({ event: 'listing_floor_report.report_generated', orderId: order.id }));

  return NextResponse.json({ url, alreadyPublished: false });
}
