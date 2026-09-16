import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { SubmitForm } from './SubmitForm';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';

export const metadata: Metadata = {
  title: 'Payment received — send your quote — Ecowoods',
  robots: { index: false, follow: false },
};

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const visible = user.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

/**
 * /well-installed-review/success — where the customer attaches the actual
 * quote AFTER paying, per the checkout page's promise: nothing they send is
 * stored before it is paid for.
 *
 * Reads the Order directly rather than adding a status API route — this is a
 * server component, and the existing Stripe webhook is the only writer of
 * `status`. A PENDING order here almost always means the redirect from
 * Stripe outran the webhook by a second or two; the page says so and asks for
 * a refresh instead of presenting a broken upload form.
 */
export default async function WellInstalledReviewSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;

  const order = orderId
    ? await db.order.findUnique({ where: { id: orderId }, include: { user: true } })
    : null;

  return (
    <div className="tlx-page">
      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
            <Link href="/well-installed-review">Well-Installed Quote Review</Link>{' '}
            <span aria-hidden="true">/</span> <span>Confirmation</span>
          </nav>
          <h1 className="tlx-title">
            {order?.status === 'PAID' ? 'Payment received' : 'One moment'}
          </h1>
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
              continue. If it stays like this for more than a minute, call{' '}
              {BUSINESS_NAP.phoneDisplay} and we will pick it up directly.
            </p>
          )}

          {order && order.status === 'FULFILLED' && (
            <p className="tlx-note">
              We already have your quote for this order — a senior estimator is on it. Urgent? Call{' '}
              {BUSINESS_NAP.phoneDisplay}.
            </p>
          )}

          {order && order.status === 'PAID' && (
            <SubmitForm orderId={order.id} maskedEmail={maskEmail(order.user.email)} />
          )}

          {order && order.status === 'CANCELLED' && (
            <p className="ef-err ef-err--block" role="alert">
              This order was cancelled. Start again from{' '}
              <Link href="/well-installed-review">Well-Installed Quote Review</Link>.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
