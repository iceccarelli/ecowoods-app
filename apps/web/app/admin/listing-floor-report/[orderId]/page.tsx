import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Workbench } from './Workbench';
import { extractListingReportSku, extractListingReportUrl, extractMeta, isListingFloorReportOrder } from '@/lib/listing-floor-report/notes';
import { listingReportSkuConfig } from '@/content/constants/listing-floor-report-product';

export const metadata: Metadata = {
  title: 'Listing Floor Condition Report — admin',
  robots: { index: false, follow: false },
};

/**
 * /admin/listing-floor-report/[orderId] — the estimator workbench (EW-0003).
 *
 * Same placement rationale as EW-0002's /admin/quote-intelligence: a NEW
 * page under the EXISTING, unedited /admin tree, reusing admin/layout.tsx's
 * ADMIN redirect and middleware.ts's /admin/:path* matcher instead of a new
 * top-level route. No entry was added to admin/layout.tsx's navItems.
 */
export default async function ListingFloorReportDeskPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') notFound();

  const { orderId } = await params;
  const order = await db.order.findUnique({ where: { id: orderId }, include: { user: true } });
  if (!order || !isListingFloorReportOrder(order.notes)) notFound();

  const sku = extractListingReportSku(order.notes);
  const skuConfig = listingReportSkuConfig(sku);
  const meta = extractMeta(order.notes);
  const existingReportUrl = extractListingReportUrl(order.notes);

  return (
    <div className="portal-page">
      <div className="portal-header">
        <h1>Listing Floor Condition Report — {order.user.name ?? order.user.email}</h1>
        <p>
          {skuConfig?.name ?? 'Photo report'} · Order {order.id} · Status {order.status}
          {!meta && ' — no intake submitted yet'}
          {meta && ` — photography ${meta.photographyDate}, ${meta.address}, ${meta.city}`}
        </p>
      </div>
      {!meta ? (
        <div className="portal-card">
          <p>Waiting on the customer&rsquo;s intake (listing details and photos).</p>
        </div>
      ) : (
        <Workbench
          orderId={order.id}
          sku={sku}
          meta={meta}
          alreadyPublished={!!existingReportUrl}
          existingReportUrl={existingReportUrl}
        />
      )}
    </div>
  );
}
