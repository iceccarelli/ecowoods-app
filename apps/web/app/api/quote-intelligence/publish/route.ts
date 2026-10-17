/**
 * POST /api/quote-intelligence/publish — ADMIN only.
 *
 * Needs a Well-Installed Quote Review order that is paid AND has had its
 * documents received (status FULFILLED, set by the submit route). Composes,
 * renders and stores the PDF, persists the QI_REPORT marker in Order.notes
 * (never overwriting the tier line), then emails the customer a link to
 * /well-installed-review/report. The state machine, claim and retry rules are
 * in lib/report-delivery.ts: a second publish returns the stored report and,
 * if the customer email never went out, retries only the email.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { publishReport } from '@/lib/report-delivery';
import { compose } from '@/lib/quote-intelligence/compose';
import { storeQuoteIntelligenceReport } from '@/lib/quote-intelligence/store';
import { appendReportMarker, extractReportUrl, extractTierId, isWellInstalledReviewOrder } from '@/lib/quote-intelligence/notes';
import { slaCopy } from '@/content/constants/quote-intelligence';
import { reviewTierConfig } from '@/content/constants/paid-review-product';
import { parseComposeBody } from '@/lib/quote-intelligence/input';
import { recordQuoteReviewEvent } from '@/lib/quote-intelligence/events';
import { escapeHtml } from '@/lib/email/html';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const raw = await req.json().catch(() => null);
  const orderId = typeof raw?.orderId === 'string' ? raw.orderId : '';
  const order = orderId ? await db.order.findUnique({ where: { id: orderId }, include: { user: true } }).catch(() => null) : null;
  if (!order || !isWellInstalledReviewOrder(order.notes)) {
    return NextResponse.json({ error: 'Not a Well-Installed Quote Review order' }, { status: 404 });
  }
  if (order.status !== 'FULFILLED') {
    return NextResponse.json(
      { error: order.status === 'PAID' ? 'The customer has not submitted a quote document yet.' : 'This order is not paid.' },
      { status: 409 },
    );
  }

  const tierId = extractTierId(order.notes);
  const tierName = reviewTierConfig(tierId)?.name ?? 'Standard';
  const existingUrl = extractReportUrl(order.notes);

  // A retry of an already-stored report needs no form body; a first publish does.
  let composed: Extract<ReturnType<typeof compose>, { ok: true }> | null = null;
  if (!existingUrl) {
    const parsed = parseComposeBody(raw);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const result = compose({ ...parsed.body.fields, orderId: order.id, tier: tierName });
    if (!result.ok) return NextResponse.json({ errors: result.errors }, { status: 400 });
    composed = result;
  }

  const origin = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const reportLink = `${origin}/well-installed-review/report?order=${order.id}&email=${encodeURIComponent(order.user.email)}`;

  const outcome = await publishReport({
    orderId: order.id,
    allowedStatuses: ['FULFILLED'],
    productTag: 'quote_intelligence',
    extractUrl: extractReportUrl,
    appendUrl: appendReportMarker,
    renderAndStore: composed ? () => storeQuoteIntelligenceReport(composed!.report) : null,
    email: {
      to: order.user.email,
      subject: 'Your Quote Intelligence Report is ready',
      html:
        `<h2 style="margin:0 0 8px;">Your quote review is ready</h2>` +
        `<p style="margin:0 0 16px;">Read it here: <a href="${escapeHtml(reportLink)}">${escapeHtml(reportLink)}</a></p>` +
        `<p style="margin:0 0 16px;">${slaCopy(tierId)}</p>`,
      text: `Your Quote Intelligence Report is ready: ${reportLink}`,
    },
  });

  if (outcome.kind === 'busy') {
    return NextResponse.json({ error: 'A publish for this order is already in progress. Try again in a minute.' }, { status: 409, headers: { 'Retry-After': '60' } });
  }
  if (outcome.kind === 'not_eligible') return NextResponse.json({ error: 'This order cannot be published.' }, { status: 409 });
  if (outcome.kind === 'failed') {
    return NextResponse.json({ error: outcome.stage === 'render' ? 'PDF generation failed' : 'The report was generated but could not be saved. Try again.' }, { status: 500 });
  }

  if (!outcome.alreadyPublished && composed) {
    const { report } = composed;
    recordQuoteReviewEvent('well_installed_review.report_published', {
      orderId: order.id,
      tier: tierId,
      quoteCount: report.quotes.length,
      highRiskFlags: [...report.generalRiskFlags, ...report.quotes.flatMap((q) => q.riskFlags)].filter((f) => f.level === 'high').length,
      questions: report.generalQuestions.length + report.quotes.reduce((n, q) => n + q.questionsToAsk.length, 0),
      comparisonVerdict: report.comparison?.verdict,
      alreadyPublished: false,
    });
  } else {
    recordQuoteReviewEvent('well_installed_review.report_published', { orderId: order.id, alreadyPublished: true });
  }

  return NextResponse.json({
    url: outcome.url,
    alreadyPublished: outcome.alreadyPublished,
    notified: outcome.notified,
    ...(outcome.notified ? {} : { notificationError: 'The report is saved but the customer email did not send. Publish again to retry the email.' }),
  });
}
