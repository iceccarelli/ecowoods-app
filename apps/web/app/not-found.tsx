import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL, CITIES } from '@/lib/seo-data';
import { getServicePages, serviceFor } from '@/lib/service-pages';

/**
 * The 404 page.
 *
 * WHY THIS EXISTS
 *
 * F-155. There was no `not-found.tsx`, so every mistyped URL, every stale link
 * from an old post, every crawler following something that used to exist got
 * Next's built-in page: the words "404" and "This page could not be found", on
 * a blank screen, with no header, no footer, and not one link off it.
 *
 * Two costs, and the second is the one that matters here.
 *
 * A person who lands there leaves. That is the obvious one.
 *
 * A crawler that lands there has spent a request and received a page with zero
 * outbound edges. Crawl budget on a 94-URL site is not scarce in absolute
 * terms, but a dead end teaches nothing about the site, and the pages most
 * likely to produce a 404 — an old URL from a link someone else published — are
 * exactly the requests arriving with the most external authority behind them.
 * A 404 that routes into the hubs converts that arrival into a path.
 *
 * `robots: { index: false }` is deliberate and is NOT what makes this a 404 —
 * Next serves the correct 404 status for this file automatically. The directive
 * only stops the page itself being indexed on the strength of its own content,
 * which it otherwise could be, since it now has plenty.
 */
export const metadata: Metadata = {
  title: 'Page not found',
  description:
    'That page does not exist. Everything published on this site is one link away below.',
  alternates: { canonical: '/404' },
  robots: { index: false, follow: true },
};

export default function NotFound() {
  const services = getServicePages();

  return (
    <div className="tlx-page">
      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>Not found</span>
          </nav>
          <h1 className="tlx-title">That page does not exist</h1>
          <p className="tlx-lede">
            The link may be old, or it may be a typo. Nothing published here has been
            removed — every document this site has ever put out is still at its original
            URL, because those URLs get cited.
          </p>
          <p className="tlx-note">
            If you arrived from a link on another site and think it should work, the whole
            corpus is at <Link href="/resources">resources</Link>, and machine-readable
            editions of everything are listed in{' '}
            <a href={`${SITE_URL}/llms.txt`}>llms.txt</a>.
          </p>
        </div>
      </header>

      <section className="tlx-section" aria-label="Services">
        <div className="shell">
          <p className="tlx-kicker">Services</p>
          <h2 className="tlx-h2">What you might have been looking for</h2>
          <div className="tlx-grid">
            {services.map((sp) => (
              <Link key={sp.slug} className="tlx-card" href={`/services/${sp.slug}`}>
                <span className="tlx-card-tag">Service</span>
                <h3>{serviceFor(sp)?.name ?? sp.h1}</h3>
                <p>{serviceFor(sp)?.blurb}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="tlx-section" aria-label="Reference">
        <div className="shell">
          <p className="tlx-kicker">Reference</p>
          <h2 className="tlx-h2">The published material</h2>
          <div className="tlx-grid">
            <Link className="tlx-card" href="/framework">
              <span className="tlx-card-tag">Standard</span>
              <h3>The Well-Installed Framework</h3>
              <p>Six pillars, twenty-seven criteria, every one sourced to a paper. Free to cite.</p>
            </Link>
            <Link className="tlx-card" href="/papers">
              <span className="tlx-card-tag">Papers</span>
              <h3>Technical papers</h3>
              <p>Climate and moisture, selection and cost, the machines and the sequence.</p>
            </Link>
            <Link className="tlx-card" href="/guides">
              <span className="tlx-card-tag">Guides</span>
              <h3>Decision guides</h3>
              <p>The question, the criteria that settle it, and the answer.</p>
            </Link>
            <Link className="tlx-card" href="/glossary">
              <span className="tlx-card-tag">Glossary</span>
              <h3>Glossary</h3>
              <p>One page per term, each defined once and cited from everywhere else.</p>
            </Link>
            <Link className="tlx-card" href="/market">
              <span className="tlx-card-tag">Data</span>
              <h3>What moves a hardwood quote</h3>
              <p>Three commodity inputs, live from the Bank of Canada, with the mechanism behind each.</p>
            </Link>
            <Link className="tlx-card" href="/standards">
              <span className="tlx-card-tag">Standards</span>
              <h3>Standards register</h3>
              <p>The external standards this work is held to, each with the date it was last verified.</p>
            </Link>
          </div>
        </div>
      </section>

      <section className="tlx-section" aria-label="Service areas">
        <div className="shell">
          <p className="tlx-kicker">Coverage</p>
          <h2 className="tlx-h2">Where we work</h2>
          <p className="tlx-note">
            {CITIES.map((c, i) => (
              <span key={c.slug}>
                {i > 0 && ' · '}
                <Link href={`/service-areas/${c.slug}`}>{c.name}</Link>
              </span>
            ))}
          </p>
          <div className="fw-actions">
            <Link className="fw-cta" href="/">
              Back to the homepage
            </Link>
            <Link className="fw-cta fw-cta--ghost" href="/resources">
              Everything published here
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
