import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { extractListingReportSku, extractListingReportUrl, isListingFloorReportOrder } from '@/lib/listing-floor-report/notes';
import { listingReportSkuConfig } from '@/content/constants/listing-floor-report-product';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';

export const metadata: Metadata = {
  title: 'Your Pre-List Floor Condition Report',
  robots: { index: false, follow: false },
};

/**
 * /listing-floor-report/report?order=&email= — gated on order id AND
 * matching email, not the UUID alone, same reasoning as EW-0002's report page.
 */
export default async function ListingFloorReportViewPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; email?: string }>;
}) {
  const { order: orderId, email } = await searchParams;

  const order =
    orderId && email
      ? await db.order.findUnique({ where: { id: orderId }, include: { user: true } })
      : null;

  const matches = order && order.user.email.trim().toLowerCase() === (email ?? '').trim().toLowerCase();
  const eligible = matches && isListingFloorReportOrder(order!.notes);
  const reportUrl = eligible ? extractListingReportUrl(order!.notes) : null;
  const sla = eligible ? listingReportSkuConfig(extractListingReportSku(order!.notes))?.sla : undefined;

  return (
    <div className="tlx-page">
      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
            <Link href="/listing-floor-report">Pre-List Floor Condition Report</Link>{' '}
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
              Your estimator is still writing it. {sla} — we will email you the link the moment it is
              ready.
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
                Want a fixed written price for this house? That is a measure, not this report.{' '}
                <Link href="/estimate">Book one here</Link>, or call{' '}
                <a href={BUSINESS_NAP.phoneHref}>{BUSINESS_NAP.phoneDisplay}</a>.
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
