import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckoutForm } from './CheckoutForm';
import { FLOOR_PLAN_PRODUCT } from '@/content/constants/floor-plan-product';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';
import { NextStep } from '@/app/components/NextStep';

export const metadata: Metadata = {
  title: 'Personal Floor Plan — written specification PDF, Ecowoods',
  description:
    'Turn the floor you configured in Floor Studio into a written specification you can email a spouse, a designer, or a condo board. $99 CAD, one time.',
  alternates: { canonical: '/floor-plan' },
  openGraph: {
    title: 'Personal Floor Plan',
    description: 'Your Floor Studio design, written out as a specification.',
    type: 'website',
    url: `${SITE_URL}/floor-plan`,
  },
};

/**
 * /floor-plan — Personal Floor Plan spec PDF (EW-0004).
 *
 * A NEW, sibling URL to the rung studio-products.ts already declares
 * (id 'floor-plan', priceCad: null, published: false) — see
 * content/constants/floor-plan-product.ts for why that file is not edited
 * to publish it. No CTA was added inside /floor-studio; that stays an
 * integration request.
 */
export default function FloorPlanPage() {
  return (
    <div className="tlx-page">
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Personal Floor Plan', url: `${SITE_URL}/floor-plan` },
        ])}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
            <span>Personal Floor Plan</span>
          </nav>
          <p className="tlx-kicker">${FLOOR_PLAN_PRODUCT.priceCad} CAD, one time</p>
          <h1 className="tlx-title">Turn your design into a specification</h1>
          <p className="tlx-lede">{FLOOR_PLAN_PRODUCT.deliverable}</p>
          <p className="tlx-note">
            Design a floor first at <Link href="/floor-studio">Floor Studio</Link>, then come back here
            with the share link.
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
              {FLOOR_PLAN_PRODUCT.refuses.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <NextStep route="/floor-plan" />
    </div>
  );
}
