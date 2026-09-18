import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckoutForm } from './CheckoutForm';
import { LISTING_FLOOR_REPORT_PRODUCT, LISTING_REPORT_SKUS } from '@/content/constants/listing-floor-report-product';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';
import { NextStep } from '@/app/components/NextStep';

export const metadata: Metadata = {
  title: 'Pre-List Floor Condition Report — before the listing photos, Ecowoods',
  description:
    'A dated read of your hardwood before the listing photos: what the finish shows, what the wood shows, and whether a recoat is realistic on your timeline. Not an appraisal, not a ranking of contractors.',
  alternates: { canonical: '/listing-floor-report' },
  openGraph: {
    title: 'Pre-List Floor Condition Report',
    description: 'A dated written read of the floor before the listing photos go up.',
    type: 'website',
    url: `${SITE_URL}/listing-floor-report`,
  },
};

/**
 * /listing-floor-report — Pre-List Floor Condition Report (EW-0003).
 *
 * Same honesty line already live at /realtors, restated in NEW copy rather
 * than by editing that page: a recoat renews a finish, it does not fix wood,
 * and a fresh coat can make traffic-lane wear or pet staining MORE visible in
 * photographs, not less. Print CSS is left to the browser default so a
 * brokerage can print this page for a lunch-and-learn without a fake
 * "download PDF" of a document that does not exist yet.
 */
export default function ListingFloorReportPage() {
  return (
    <div className="tlx-page">
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Pre-List Floor Condition Report', url: `${SITE_URL}/listing-floor-report` },
        ])}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
            <span>Pre-List Floor Condition Report</span>
          </nav>
          <p className="tlx-kicker">For listing agents and sellers</p>
          <h1 className="tlx-title">Know what the floor will say in the photos</h1>
          <p className="tlx-lede">{LISTING_FLOOR_REPORT_PRODUCT.deliverable}</p>
          <p className="tlx-note">
            A recoat renews a finish — it does not fix wood. Worn-through traffic lanes, pet staining in
            the board, or cupping from untraced moisture: a fresh coat can make that damage more visible
            in photographs, not less. When a photo can support the call, this report says so plainly.
          </p>
        </div>
      </header>

      <section className="tlx-section">
        <div className="shell">
          <CheckoutForm />
        </div>
      </section>

      <section className="tlx-section">
        <div className="shell">
          <h2 className="tlx-h2">What this will not do</h2>
          <div className="tlx-body">
            <ul>
              {LISTING_FLOOR_REPORT_PRODUCT.refuses.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="tlx-section">
        <div className="shell">
          <h2 className="tlx-h2">Options</h2>
          <table className="tlx-table">
            <thead>
              <tr>
                <th>Report</th>
                <th>Price</th>
                <th>Turnaround</th>
              </tr>
            </thead>
            <tbody>
              {LISTING_REPORT_SKUS.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>${s.priceCad} CAD</td>
                  <td>{s.sla}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <NextStep route="/listing-floor-report" />
    </div>
  );
}
