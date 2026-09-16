import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckoutForm } from './CheckoutForm';
import { WELL_INSTALLED_REVIEW_PRODUCT, REVIEW_TIERS } from '@/content/constants/paid-review-product';
import { criterionCount, FRAMEWORK_VERSION } from '@/lib/framework';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';
import { NextStep } from '@/app/components/NextStep';

export const metadata: Metadata = {
  title: 'Well-Installed Quote Review — a senior estimator reads your quote, in writing',
  description:
    'Send the hardwood quote you are holding and get a written, priority reply — what is right, what is missing, what to ask before you sign. Not a ranking of any company.',
  alternates: { canonical: '/well-installed-review' },
  openGraph: {
    title: 'Well-Installed Quote Review',
    description: 'A paid, priority version of reading your hardwood quote — written, not a phone call, not a ranking.',
    type: 'website',
    url: `${SITE_URL}/well-installed-review`,
  },
};

/**
 * /well-installed-review — the paid version of /api/quote-review (EW-0001).
 *
 * The free route already proves the demand: someone holding a competitor's
 * quote, asking us to read it, for nothing. This adds a committed turnaround
 * and priority queueing ahead of that free inbox, for a price — see
 * content/constants/paid-review-product.ts for why that price is not yet a
 * confirmed commercial term of this business.
 *
 * Same legal line as /quote-check and the free reviewer: no ranking, no
 * naming, no dollar figure attached to anything a quote leaves out.
 */
export default function WellInstalledReviewPage() {
  return (
    <div className="tlx-page">
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Well-Installed Quote Review', url: `${SITE_URL}/well-installed-review` },
        ])}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
            <span>Well-Installed Quote Review</span>
          </nav>
          <p className="tlx-kicker">Paid, priority review</p>
          <h1 className="tlx-title">Send the quote. Get a written answer.</h1>
          <p className="tlx-lede">{WELL_INSTALLED_REVIEW_PRODUCT.deliverable}</p>
          <p className="tlx-note">
            Scored against the Ecowoods Well-Installed Framework v{FRAMEWORK_VERSION} ({criterionCount()}{' '}
            published criteria) — see it free at <Link href="/framework/assess">/framework/assess</Link>.
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
              {WELL_INSTALLED_REVIEW_PRODUCT.refuses.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p>
              If it is a good quote, we say so. There is no free version of this — for that, send the
              same document to <Link href="/framework/assess">the free reviewer</Link> and expect a
              reply when an estimator has time, not a committed turnaround.
            </p>
          </div>
        </div>
      </section>

      <section className="tlx-section">
        <div className="shell">
          <h2 className="tlx-h2">Tiers</h2>
          <table className="tlx-table">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Price</th>
                <th>Turnaround</th>
              </tr>
            </thead>
            <tbody>
              {REVIEW_TIERS.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>${t.priceCad} CAD</td>
                  <td>{t.turnaround}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <NextStep route="/well-installed-review" />
    </div>
  );
}
