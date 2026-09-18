import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { SubmitForm } from './SubmitForm';
import { extractListingReportSku, hasIntakeMarker } from '@/lib/listing-floor-report/notes';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';

export const metadata: Metadata = {
  title: 'Payment received — Pre-List Floor Condition Report — Ecowoods',
  robots: { index: false, follow: false },
};

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  return `${user.slice(0, 2)}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

/**
 * /listing-floor-report/success — same "pay first, details after" shape as
 * EW-0001/EW-0002's success pages: a direct server-side db read of the
 * Order, no self-fetch to the GET report API.
 */
export default async function ListingFloorReportSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;

  const order = orderId
    ? await db.order.findUnique({ where: { id: orderId }, include: { user: true } })
    : null;

  const alreadySubmitted = order ? hasIntakeMarker(order.notes) : false;

  return (
    <div className="tlx-page">
      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
            <Link href="/listing-floor-report">Pre-List Floor Condition Report</Link>{' '}
            <span aria-hidden="true">/</span> <span>Confirmation</span>
          </nav>
          <h1 className="tlx-title">{order?.status === 'PAID' ? 'Payment received' : 'One moment'}</h1>
        </div>
      </header>

      <section className="tlx-section">
        <div className="shell">
          {!order && (
            <p className="ef-err ef-err--block" role="alert">
              We could not find that order. If you just paid, check the confirmation link Stripe
              showed you, or call {BUSINESS_NAP.phoneDisplay}.
            </p>
          )}

          {order && order.status === 'PENDING' && (
            <p className="tlx-note">
              Confirming your payment — this usually takes a few seconds. Refresh this page to
              continue. If it stays like this for more than a minute, call {BUSINESS_NAP.phoneDisplay}.
            </p>
          )}

          {order && order.status === 'FULFILLED' && (
            <p className="tlx-note">
              Your report is ready. Check your email for the link, or{' '}
              <Link href={`/listing-floor-report/report?order=${order.id}&email=${encodeURIComponent(order.user.email)}`}>
                view it here
              </Link>
              .
            </p>
          )}

          {order && order.status === 'PAID' && alreadySubmitted && (
            <p className="tlx-note">
              We already have your details for this order — your estimator is on it. Urgent? Call{' '}
              {BUSINESS_NAP.phoneDisplay}.
            </p>
          )}

          {order && order.status === 'PAID' && !alreadySubmitted && (
            <SubmitForm
              orderId={order.id}
              sku={extractListingReportSku(order.notes)}
              maskedEmail={maskEmail(order.user.email)}
            />
          )}

          {order && order.status === 'CANCELLED' && (
            <p className="ef-err ef-err--block" role="alert">
              This order was cancelled. Start again from{' '}
              <Link href="/listing-floor-report">Pre-List Floor Condition Report</Link>.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
