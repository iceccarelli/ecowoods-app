/**
 * POST /api/quote-intelligence/publish — ADMIN only.
 *
 * Composes, renders the PDF, stores it, appends the QI_REPORT marker to
 * Order.notes (never overwrites the tier line checkout wrote), and emails
 * the customer a link to /well-installed-review/report. Idempotent: a
 * second publish against an already-published order returns the existing
 * URL instead of generating and emailing a duplicate.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { compose } from '@/lib/quote-intelligence/compose';
import { storeQuoteIntelligenceReport } from '@/lib/quote-intelligence/store';
import { appendReportMarker, extractReportUrl, extractTierId, isWellInstalledReviewOrder } from '@/lib/quote-intelligence/notes';
import { slaCopy } from '@/content/constants/quote-intelligence';
import { reviewTierConfig } from '@/content/constants/paid-review-product';
import { parseComposeBody } from '@/lib/quote-intelligence/input';
import { recordQuoteReviewEvent } from '@/lib/quote-intelligence/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = parseComposeBody(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { orderId, fields } = parsed.body;

  const order = await db.order.findUnique({ where: { id: orderId }, include: { user: true } });
  if (!order || !isWellInstalledReviewOrder(order.notes)) {
    return NextResponse.json({ error: 'Not a Well-Installed Quote Review order' }, { status: 404 });
  }

  const existingUrl = extractReportUrl(order.notes);
  if (existingUrl) {
    recordQuoteReviewEvent('well_installed_review.report_published', { orderId: order.id, alreadyPublished: true });
    return NextResponse.json({ url: existingUrl, alreadyPublished: true });
  }

  const tierId = extractTierId(order.notes);
  const tierName = reviewTierConfig(tierId)?.name ?? 'Standard';
  const result = compose({ ...fields, orderId: order.id, tier: tierName });

  if (!result.ok) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }

  let url: string;
  try {
    url = await storeQuoteIntelligenceReport(result.report);
  } catch (err) {
    console.error('[quote-intelligence publish] PDF generation failed:', err);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }

  await db.order.update({
    where: { id: order.id },
    data: { notes: appendReportMarker(order.notes, url), status: 'FULFILLED' },
  });

  const { report } = result;
  recordQuoteReviewEvent('well_installed_review.report_published', {
    orderId: order.id,
    tier: tierId,
    quoteCount: report.quotes.length,
    highRiskFlags: [...report.generalRiskFlags, ...report.quotes.flatMap((q) => q.riskFlags)].filter((f) => f.level === 'high').length,
    questions: report.generalQuestions.length + report.quotes.reduce((n, q) => n + q.questionsToAsk.length, 0),
    comparisonVerdict: report.comparison?.verdict,
    alreadyPublished: false,
  });

  const origin = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const reportLink = `${origin}/well-installed-review/report?order=${order.id}&email=${encodeURIComponent(order.user.email)}`;

  try {
    await sendEmail({
      to: order.user.email,
      subject: 'Your Quote Intelligence Report is ready',
      html:
        `<h2 style="margin:0 0 8px;">Your quote review is ready</h2>` +
        `<p style="margin:0 0 16px;">Read it here: <a href="${reportLink}">${reportLink}</a></p>` +
        `<p style="margin:0 0 16px;">${slaCopy(tierId)}</p>`,
      text: `Your Quote Intelligence Report is ready: ${reportLink}`,
    });
  } catch (err) {
    console.error('[quote-intelligence publish] customer email failed:', err);
    // The report is already stored and linkable; a failed notification email
    // is not a reason to fail the publish or generate a second PDF.
  }

  return NextResponse.json({ url, alreadyPublished: false });
}
