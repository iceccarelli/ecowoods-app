import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { extractReportUrl, extractTierId, isWellInstalledReviewOrder } from '@/lib/quote-intelligence/notes';
import { slaCopy } from '@/content/constants/quote-intelligence';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { recordQuoteReviewEvent } from '@/lib/quote-intelligence/events';

export const metadata: Metadata = {
  title: 'Your Quote Intelligence Report — Ecowoods',
  robots: { index: false, follow: false },
};

/**
 * /well-installed-review/report?order=&email= — where the customer reads the
 * report the estimating desk published (EW-0002). Direct db read, same
 * pattern as /well-installed-review/success — this is a server component and
 * the email check is the same guard the GET API route applies, so a guest
 * with the wrong email sees nothing regardless of which surface they hit.
 */
export default async function QuoteIntelligenceReportPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; email?: string }>;
}) {
  const { order: orderId, email } = await searchParams;

  const order =
    orderId && email
      ? await db.order.findUnique({ where: { id: orderId }, include: { user: true } })
      : null;

  const matches =
    order && order.user.email.trim().toLowerCase() === (email ?? '').trim().toLowerCase();
  const eligible = matches && isWellInstalledReviewOrder(order!.notes);
  const reportUrl = eligible ? extractReportUrl(order!.notes) : null;
  if (reportUrl) {
    recordQuoteReviewEvent('well_installed_review.report_viewed', { orderId: order!.id, tier: extractTierId(order!.notes) });
  }

  return (
    <div className="tlx-page">
      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
            <Link href="/well-installed-review">Well-Installed Quote Review</Link>{' '}
            <span aria-hidden="true">/</span> <span>Your report</span>
          </nav>
          <h1 className="tlx-title">Your report</h1>
        </div>
      </header>

      <section className="tlx-section">
        <div className="shell">
          {!eligible && (
            <p className="ef-err ef-err--block" role="alert">
              We could not find a report for that order and email. Check the link in your
              confirmation email, or call {BUSINESS_NAP.phoneDisplay}.
            </p>
          )}

          {eligible && !reportUrl && (
            <p className="tlx-note">
              Your estimator is still writing it. {slaCopy(extractTierId(order!.notes))} — we will
              email you the link the moment it is ready.
            </p>
          )}

          {eligible && reportUrl && (
            <>
              <p className="tlx-note">Your written report is ready.</p>
              <p>
                <a className="btn btn-copper" href={reportUrl} target="_blank" rel="noopener noreferrer">
                  Download the report (PDF)
                </a>
              </p>
              <p>
                Want the free in-home measure next? <Link href="/estimate">Book one here</Link>, or
                call <a href={BUSINESS_NAP.phoneHref}>{BUSINESS_NAP.phoneDisplay}</a>.
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
