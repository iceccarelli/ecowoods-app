import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Workbench } from './Workbench';
import { extractReportUrl, extractTierId, isWellInstalledReviewOrder } from '@/lib/quote-intelligence/notes';
import { reviewTierConfig } from '@/content/constants/paid-review-product';

export const metadata: Metadata = {
  title: 'Quote Intelligence — desk',
  robots: { index: false, follow: false },
};

/**
 * /admin/quote-intelligence/[orderId] — the estimator's workbench (EW-0002).
 *
 * A NEW page under the EXISTING /admin tree, not a new top-level /desk route.
 * app/admin/layout.tsx (existing, not edited) already redirects a signed-out
 * or non-ADMIN visitor to /login before this page renders, and
 * middleware.ts's existing matcher already covers `/admin/:path*` — placing
 * this here reuses that gate instead of duplicating it. No entry was added
 * to admin/layout.tsx's `navItems`: linking an existing page to a new one is
 * the same "do not edit an existing page just to add a link" line EW-0001
 * already drew for /well-installed-review; it's an integration request, not
 * done here (see docs/quote-intelligence.md).
 *
 * The auth() check below is therefore redundant with the layout — kept as a
 * second, cheap gate rather than assumed, since this page also touches a
 * customer's competitor-quote review, and notFound() (not a redirect) is
 * used so a non-ADMIN request doesn't even disclose that the route exists.
 */
export default async function QuoteIntelligenceDeskPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') notFound();

  const { orderId } = await params;
  const order = await db.order.findUnique({ where: { id: orderId }, include: { user: true } });
  if (!order || !isWellInstalledReviewOrder(order.notes)) notFound();

  const tierId = extractTierId(order.notes);
  const tier = reviewTierConfig(tierId);
  const existingReportUrl = extractReportUrl(order.notes);

  return (
    <div className="portal-page">
      <div className="portal-header">
        <h1>Quote Intelligence — {order.user.name ?? order.user.email}</h1>
        <p>
          {tier?.name ?? 'Standard'} tier · Order {order.id} · Status {order.status}
          {order.status === 'PAID' && ' — customer has not uploaded a quote document yet'}
        </p>
      </div>
      <Workbench orderId={order.id} alreadyPublished={!!existingReportUrl} existingReportUrl={existingReportUrl} />
    </div>
  );
}
