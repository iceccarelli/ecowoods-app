/**
 * POST /api/listing-floor-report/publish — ADMIN only.
 *
 * Needs a Pre-List Floor Condition Report order that is paid (PAID, or
 * FULFILLED once published) and has an intake on file. Composes, renders and
 * stores the PDF, persists LFR_REPORT: in Order.notes (never overwriting the
 * sku/meta lines), and moves Order.status to FULFILLED at that point — a
 * generated report is fulfilment; documents received alone is not. The
 * customer email follows and is tracked separately (lib/report-delivery.ts):
 * a second publish returns the stored report and, if the email never went
 * out, retries only the email.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { publishReport } from '@/lib/report-delivery';
import { siteOrigin } from '@/lib/site-origin';
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
import { escapeHtml } from '@/lib/email/html';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Partial<ComposeInput> | null;
  if (!body?.orderId || typeof body.orderId !== 'string') {
    return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
  }

  const order = await db.order.findUnique({ where: { id: body.orderId }, include: { user: true } }).catch(() => null);
  if (!order || !isListingFloorReportOrder(order.notes)) {
    return NextResponse.json({ error: 'Not a listing floor report order' }, { status: 404 });
  }
  if (order.status !== 'PAID' && order.status !== 'FULFILLED') {
    return NextResponse.json({ error: 'This order is not paid.' }, { status: 409 });
  }

  const existingUrl = extractListingReportUrl(order.notes);
  const meta = extractMeta(order.notes);
  if (!existingUrl && !meta) {
    return NextResponse.json({ error: 'No intake submitted for this order yet.' }, { status: 409 });
  }

  const sku = extractListingReportSku(order.notes);
  let composed: Extract<ReturnType<typeof compose>, { ok: true }> | null = null;
  if (!existingUrl) {
    const result = compose({
      orderId: order.id,
      sku,
      photographyDate: meta!.photographyDate,
      recommendation: body.recommendation ?? 'cannot_determine_from_photos',
      findings: body.findings ?? { finishWear: 'not_specified', woodDamage: 'not_specified', moisture: 'inspection_needed' },
      present: body.present ?? '',
      missing: body.missing ?? '',
      askInWriting: body.askInWriting,
    });
    if (!result.ok) return NextResponse.json({ errors: result.errors }, { status: 400 });
    composed = result;
  }

  const origin = siteOrigin();
  const reportLink = `${origin}/listing-floor-report/report?order=${order.id}&email=${encodeURIComponent(order.user.email)}`;
  const skuConfig = listingReportSkuConfig(sku);

  const outcome = await publishReport({
    orderId: order.id,
    allowedStatuses: ['PAID', 'FULFILLED'],
    productTag: 'listing_floor_report',
    extractUrl: extractListingReportUrl,
    appendUrl: appendListingReportMarker,
    renderAndStore: composed ? () => storeListingFloorReport(composed!.report) : null,
    email: {
      to: order.user.email,
      subject: 'Your Pre-List Floor Condition Report is ready',
      html:
        `<h2 style="margin:0 0 8px;">Your floor condition report is ready</h2>` +
        `<p style="margin:0 0 16px;">Read it here: <a href="${escapeHtml(reportLink)}">${escapeHtml(reportLink)}</a></p>` +
        `<p style="margin:0 0 16px;">${skuConfig?.sla ?? ''}</p>`,
      text: `Your Pre-List Floor Condition Report is ready: ${reportLink}`,
    },
  });

  if (outcome.kind === 'busy') {
    return NextResponse.json({ error: 'A publish for this order is already in progress. Try again in a minute.' }, { status: 409, headers: { 'Retry-After': '60' } });
  }
  if (outcome.kind === 'not_eligible') return NextResponse.json({ error: 'This order cannot be published.' }, { status: 409 });
  if (outcome.kind === 'failed') {
    return NextResponse.json({ error: outcome.stage === 'render' ? 'PDF generation failed' : 'The report was generated but could not be saved. Try again.' }, { status: 500 });
  }

  if (!outcome.alreadyPublished) {
    console.log(JSON.stringify({ event: 'listing_floor_report.report_generated', orderId: order.id }));
  }
  return NextResponse.json({
    url: outcome.url,
    alreadyPublished: outcome.alreadyPublished,
    notified: outcome.notified,
    ...(outcome.notified ? {} : { notificationError: 'The report is saved but the customer email did not send. Publish again to retry the email.' }),
  });
}
