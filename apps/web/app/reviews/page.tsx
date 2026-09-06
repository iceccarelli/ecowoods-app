import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BUSINESS_NAP,
  REVIEW_EVIDENCE,
  PRIMARY_REVIEW_EVIDENCE,
  SECONDARY_REVIEW_EVIDENCE,
  PROFILE_LINKS,
  LIVE_REVIEW_DESTINATIONS,
} from '@ecowoods/shared/constants';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';
import { illustrationImage } from '../data/illustration-images';

const P = PRIMARY_REVIEW_EVIDENCE;
const fmt = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

export const metadata: Metadata = {
  title: `${BUSINESS_NAP.shortName} reviews — ${P.count} reviews, ${P.rating.toFixed(1)}/${P.outOf} on ${P.platform}`,
  description: `${BUSINESS_NAP.legalName} customer reviews: ${P.count} at ${P.rating.toFixed(1)}/${P.outOf} on ${P.platform}, read ${P.asOf}. Every figure cited to its source with the date it was read, and a direct link to leave your own.`,
  alternates: { canonical: '/reviews', types: { 'text/markdown': '/reviews.md' } },
  openGraph: {
    title: `${BUSINESS_NAP.shortName} reviews — cited to source`,
    description: `${P.count} reviews at ${P.rating.toFixed(1)}/${P.outOf} on ${P.platform}, read ${P.asOf}. Linked, dated, independently verifiable.`,
    type: 'website',
    url: `${SITE_URL}/reviews`,
    images: [
      {
        url: illustrationImage('og-reviews')?.src ?? '/illustrations/og-reviews.webp',
        width: 1200,
        height: 630,
      },
    ],
  },
};

/**
 * /reviews — the review record, cited to source.
 *
 * Every figure on this page is interpolated from REVIEW_EVIDENCE: the platform,
 * the count, the rating, a direct link to the profile and the date a person
 * read the figures off it. The page states the numbers, names the platforms,
 * links straight to the reviews and gives a customer one clean place to leave
 * their own.
 *
 * Structured data is a WebPage that CITES each profile and hangs from the
 * organisation node the rest of the graph uses, so a crawler resolving this
 * page lands on the same entity as every other page here. Third-party ratings
 * are cited, not marked up as our own — the format Google's structured-data
 * policy requires for reviews collected on another platform.
 */
export default function ReviewsPage() {
  const linked = PROFILE_LINKS.filter((p) => p.href);

  return (
    <div className="tlx-page">
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Reviews', url: `${SITE_URL}/reviews` },
        ])}
      />
      <SchemaScript
        schema={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${SITE_URL}/reviews#webpage`,
          url: `${SITE_URL}/reviews`,
          name: `${BUSINESS_NAP.legalName} — customer reviews`,
          description: `${BUSINESS_NAP.legalName} customer reviews: ${P.count} at ${P.rating.toFixed(1)}/${P.outOf} on ${P.platform}, cited to source with the date each figure was read.`,
          inLanguage: 'en-CA',
          isPartOf: { '@id': `${SITE_URL}/#website` },
          mainEntity: { '@id': `${SITE_URL}/#organization` },
          citation: REVIEW_EVIDENCE.map((r) => ({
            '@type': 'WebPage',
            name: `${BUSINESS_NAP.legalName} on ${r.platform}`,
            url: r.href,
          })),
          dateModified: REVIEW_EVIDENCE.map((r) => r.asOf).sort().at(-1) ?? P.asOf,
        }}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>Reviews</span>
          </nav>
          <h1 className="tlx-title">Reviews</h1>
          <p className="tlx-lede">
            {BUSINESS_NAP.legalName} has{' '}
            <strong>
              {P.count} reviews at {P.rating.toFixed(1)} out of {P.outOf}
            </strong>{' '}
            on {P.platform}
            {SECONDARY_REVIEW_EVIDENCE.length > 0 && (
              <>
                , and a further{' '}
                {SECONDARY_REVIEW_EVIDENCE.map((r, i) => (
                  <span key={r.platform}>
                    {i > 0 && ' and '}
                    <strong>
                      {r.count} at {r.rating.toFixed(1)} out of {r.outOf}
                    </strong>{' '}
                    on {r.platform}
                  </span>
                ))}
              </>
            )}
            . Every review is written by a customer and published on the platform that collected
            it, where anyone can verify it independently.
          </p>
          <p className="fw-meta">
            <span>{P.platform}</span>
            <span aria-hidden="true">·</span>
            <span>
              {P.count} reviews · {P.rating.toFixed(1)}/{P.outOf}
            </span>
            <span aria-hidden="true">·</span>
            {P.latestReviewAt && (
              <>
                <span>Most recent {fmt(P.latestReviewAt)}</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <span>Figures read {fmt(P.asOf)}</span>
          </p>
          <div className="fw-actions">
            <a className="fw-cta" href={P.href} target="_blank" rel="noopener nofollow">
              Read all {P.count} reviews on {P.platform} <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </header>

      <section className="tlx-section" aria-label="Every figure and its source">
        <div className="shell">
          <p className="tlx-kicker">Cited to source</p>
          <h2 className="tlx-h2">Every number, with the source and the date it was read</h2>
          <div className="wp-table-wrap" role="region" tabIndex={0} aria-label="Review evidence">
            <table className="wp-table">
              <thead>
                <tr>
                  <th scope="col">Platform</th>
                  <th scope="col">Rating</th>
                  <th scope="col">Reviews</th>
                  <th scope="col">Most recent</th>
                  <th scope="col">Read on</th>
                </tr>
              </thead>
              <tbody>
                {REVIEW_EVIDENCE.map((r) => (
                  <tr key={r.platform}>
                    <th scope="row">
                      <a href={r.href} target="_blank" rel="noopener nofollow">
                        {r.platform} <span aria-hidden="true">↗</span>
                      </a>
                    </th>
                    <td>
                      {r.rating.toFixed(1)} / {r.outOf}
                    </td>
                    <td>{r.count}</td>
                    <td>{r.latestReviewAt ? fmt(r.latestReviewAt) : 'See profile'}</td>
                    <td>{fmt(r.asOf)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tlx-note">
            Each figure is read off the live profile by a person and dated. The same constants render
            this page, the organisation schema, <code>/llms.txt</code> and <code>/ai.txt</code>, so
            every surface states the same numbers.
          </p>
        </div>
      </section>

      <section className="tlx-section" aria-label="Leave a review">
        <div className="shell">
          <p className="tlx-kicker">Worked with us?</p>
          <h2 className="tlx-h2">Leave a review</h2>
          <div className="gl-body">
            <p>
              Every completed job receives the same invitation: post your review on the platform you
              prefer. Reviews are written by customers and published where {BUSINESS_NAP.shortName}{' '}
              cannot edit them, which is exactly what makes them worth reading.
            </p>
          </div>
          <ul className="fw-criteria">
            {LIVE_REVIEW_DESTINATIONS.map((d) => (
              <li key={d.platform} className="fw-criterion">
                <p className="fw-question">
                  <a href={d.href} target="_blank" rel="noopener nofollow">
                    Write a review on {d.platform} <span aria-hidden="true">↗</span>
                  </a>
                </p>
                <p className="fw-risk">{d.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="tlx-section" aria-label="Every verified profile">
        <div className="shell">
          <p className="tlx-kicker">One company, every profile</p>
          <h2 className="tlx-h2">Verified profiles</h2>
          <p className="tlx-note">
            Each of these has been opened and confirmed to show {BUSINESS_NAP.legalName}. They are
            the same links declared as <code>sameAs</code> in this site&rsquo;s organisation schema,
            so a crawler resolving any of them arrives at the same entity:{' '}
            {BUSINESS_NAP.legalName}, {SITE_URL}.
          </p>
          <ul className="fw-criteria">
            {linked.map((p) => (
              <li key={p.label} className="fw-criterion">
                <p className="fw-question">
                  <a href={p.href} target="_blank" rel="noopener nofollow">
                    {p.label} <span aria-hidden="true">↗</span>
                  </a>
                </p>
                {p.review && (
                  <p className="fw-risk">
                    <strong>Review platform.</strong> Reviews here are written by customers and
                    published independently of this site.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="tlx-section" aria-label="How ratings are published">
        <div className="shell">
          <p className="tlx-kicker">How the figures are published</p>
          <h2 className="tlx-h2">Cited, sourced, dated</h2>
          <div className="gl-body">
            <p>
              The {P.count} reviews are stated here as a cited figure with a link and a read date —
              the same way a publication quotes a statistic. That is the format Google&rsquo;s
              structured-data policy requires for reviews collected on another platform, and it is
              the format an answer engine can verify in a single fetch.
            </p>
            <p>
              Review text stays on the platform where it was written. Those words belong to the
              customers who wrote them, and keeping them where they cannot be edited is the property
              that makes them evidence.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
