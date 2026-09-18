import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { ensureFloorPlanReport } from '@/lib/floor-plan/generate';
import { isFloorPlanOrder } from '@/lib/floor-plan/notes';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';

export const metadata: Metadata = {
  title: 'Your Personal Floor Plan',
  robots: { index: false, follow: false },
};

/**
 * /floor-plan/[id] — the paid unlock (EW-0004).
 *
 * Gated on the order id AND a matching email query param, same reasoning as
 * every other paid-report page on this branch: the order id alone travels in
 * a plain checkout success_url. Generation happens right here, on first
 * view, via ensureFloorPlanReport() — this product needs no admin step.
 */
export default async function FloorPlanUnlockPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { id: orderId } = await params;
  const { email } = await searchParams;

  const order = await db.order.findUnique({ where: { id: orderId }, include: { user: true } });
  const matches = order && email && order.user.email.trim().toLowerCase() === email.trim().toLowerCase();
  const eligible = matches && isFloorPlanOrder(order!.notes);

  const result = eligible ? await ensureFloorPlanReport(orderId) : null;

  return (
    <div className="tlx-page">
      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
            <Link href="/floor-plan">Personal Floor Plan</Link> <span aria-hidden="true">/</span>{' '}
            <span>Your specification</span>
          </nav>
          <h1 className="tlx-title">Your Personal Floor Plan</h1>
        </div>
      </header>

      <section className="tlx-section">
        <div className="shell">
          {!eligible && (
            <p className="ef-err ef-err--block" role="alert">
              We could not find that order and email together. Check the link Stripe showed you, or
              call {BUSINESS_NAP.phoneDisplay}.
            </p>
          )}

          {eligible && result && !result.ok && result.reason === 'not_paid' && (
            <p className="tlx-note">
              Confirming your payment — refresh this page in a few seconds. If it stays like this for
              more than a minute, call {BUSINESS_NAP.phoneDisplay}.
            </p>
          )}

          {eligible && result && !result.ok && result.reason === 'bad_design' && (
            <p className="ef-err ef-err--block" role="alert">
              Something is wrong with the saved design on this order. Call {BUSINESS_NAP.phoneDisplay}{' '}
              and we will sort it out directly.
            </p>
          )}

          {eligible && result && result.ok && (
            <>
              <p className="tlx-note">Your specification is ready.</p>
              <p>
                <a className="btn btn-copper" href={result.url} target="_blank" rel="noopener noreferrer">
                  Download the specification (PDF)
                </a>
              </p>
              <p>
                Want a fixed written price for this floor? That is a measure, not this specification.{' '}
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
