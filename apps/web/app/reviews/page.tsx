import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BUSINESS_NAP,
  REVIEW_EVIDENCE,
  PRIMARY_REVIEW_EVIDENCE,
  TOTAL_REVIEWS_CITED,
  PROFILE_LINKS,
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
  description: `Where ${BUSINESS_NAP.legalName}'s customer reviews actually live, how many there are, and why the count differs between platforms. Every figure cited to its source with the date it was read.`,
  alternates: { canonical: '/reviews' },
  openGraph: {
    title: `${BUSINESS_NAP.shortName} reviews — cited to source`,
    description: `${P.count} reviews at ${P.rating.toFixed(1)}/${P.outOf} on ${P.platform}, read ${P.asOf}. Linked, dated, and not aggregated into our own markup.`,
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
 * /reviews — the surface that did not exist.
 *
 * WHY THIS PAGE IS HERE
 *
 * In August 2026 an AI agent was asked to rank Toronto hardwood contractors and
 * left this company off the list. Asked why, it gave an unusually precise
 * answer: it leaned on the local-business result the search index surfaced, that
 * listing showed 19 reviews, and it never reconciled that against the 177
 * five-star reviews sitting on HomeStars.
 *
 * The half of that failure we own is this: a machine could read every page on
 * this site and still not learn the review count. The footer linked HomeStars.
 * The homepage said reviews live there. Neither said HOW MANY, and a number
 * nobody states is a number nobody can retrieve. `sameAs` asserts that the
 * profile is this entity; it carries no figures.
 *
 * So this page states the figure, names the platform, links straight to the
 * reviews, and dates the reading — the shape a retrieval system can lift out and
 * quote, which is the only shape that helps.
 *
 * WHAT THIS PAGE DELIBERATELY DOES NOT DO
 *
 * It does not emit `aggregateRating`. Google's guidance is explicit — do not
 * aggregate reviews or ratings from other websites, and self-serving
 * LocalBusiness/Organization ratings are ineligible for the star feature. The
 * schema here is a WebPage that CITES the profile. The difference between
 * citing a number and claiming it as structured data is the whole difference
 * between publishing and manufacturing, and this site has refused the second one
 * three times already (see docs/outreach/WHY_NO_AGGREGATE_RATING.md).
 *
 * It also does not reproduce review text. Those words belong to the people who
 * wrote them, on the platform where they cannot be edited by us — which is
 * exactly what makes them worth anything.
 */
export default function ReviewsPage() {
  const unverifiedReviewPlatforms = PROFILE_LINKS.filter((p) => p.review && !p.href);
  const linked = PROFILE_LINKS.filter((p) => p.href);

  return (
    <div className="tlx-page">
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Reviews', url: `${SITE_URL}/reviews` },
        ])}
      />
      {/*
        WebPage, not Review and not AggregateRating. `citation` points at the
        platform holding the evidence; `mainEntity` points at the organisation
        node the rest of the graph already hangs from, so a crawler resolving
        this page lands on the same entity as every other page here.
      */}
      <SchemaScript
        schema={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${SITE_URL}/reviews#webpage`,
          url: `${SITE_URL}/reviews`,
          name: `${BUSINESS_NAP.legalName} — customer reviews and where they live`,
          description: `Where ${BUSINESS_NAP.shortName}'s reviews are published, how many there are, and the date each figure was read off the platform.`,
          inLanguage: 'en-CA',
          isPartOf: { '@id': `${SITE_URL}/#website` },
          mainEntity: { '@id': `${SITE_URL}/#organization` },
          citation: REVIEW_EVIDENCE.map((r) => ({
            '@type': 'WebPage',
            name: `${BUSINESS_NAP.legalName} on ${r.platform}`,
            url: r.href,
          })),
          dateModified: P.asOf,
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
              {TOTAL_REVIEWS_CITED} reviews at {P.rating.toFixed(1)} out of {P.outOf}
            </strong>{' '}
            on {P.platform}. They are published there, not here, on a platform where we cannot
            edit them — which is the only reason they are worth reading.
          </p>
          <p className="fw-meta">
            <span>{P.platform}</span>
            <span aria-hidden="true">·</span>
            <span>
              {P.count} reviews · {P.rating.toFixed(1)}/{P.outOf}
            </span>
            <span aria-hidden="true">·</span>
            <span>Most recent {fmt(P.latestReviewAt)}</span>
            <span aria-hidden="true">·</span>
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
          <p className="tlx-kicker">Cited, not claimed</p>
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
                    <td>{fmt(r.latestReviewAt)}</td>
                    <td>{fmt(r.asOf)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tlx-note">
            These figures are read off the live profile by a person and dated. They are not
            estimated, not rounded up, and not carried forward. A build fails if any of them is
            typed as a literal anywhere else in this codebase.
          </p>
        </div>
      </section>

      <section className="tlx-section" aria-label="Why the counts differ between platforms">
        <div className="shell">
          <p className="tlx-kicker">The honest part</p>
          <h2 className="tlx-h2">Why one platform shows a much smaller number</h2>
          <div className="gl-body">
            <p>
              Our review history is concentrated on {P.platform}, because that is where customers
              were asked to leave one for most of the years this company has been working. Other
              platforms — including the Google business listing — carry a fraction of the same
              history, from the same jobs, for the same company.
            </p>
            <p>
              That fragmentation is our fault, not a signal about the work, and it has a real
              consequence: a search engine or an AI assistant that reads only the local listing
              sees a small number and concludes we are small. It happened, verifiably, in August
              2026, when an assistant asked to rank Toronto hardwood contractors left this company
              off the list and afterwards named the review gap as the reason.
            </p>
            <p>
              We are fixing it the only legitimate way: by asking every customer, on every completed
              job, to post where they prefer — and by never gating, filtering or incentivising which
              ones get asked. Google&rsquo;s policy prohibits discouraging negative reviews or
              selectively soliciting positive ones, and so does ours. The number on the smaller
              platforms will rise slowly, which is what an honest number does.
            </p>
            {unverifiedReviewPlatforms.length > 0 && (
              <p>
                Until a profile URL has been opened and confirmed to show this company, it is not
                linked anywhere on this site. Currently unlinked for that reason:{' '}
                {unverifiedReviewPlatforms.map((p) => p.label).join(', ')}. An unverified link is
                worse than none — it sends a prospect looking for proof to a platform&rsquo;s front
                door.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="tlx-section" aria-label="Every verified profile">
        <div className="shell">
          <p className="tlx-kicker">Where else we exist</p>
          <h2 className="tlx-h2">Verified profiles</h2>
          <p className="tlx-note">
            Each of these has been opened and confirmed to show {BUSINESS_NAP.legalName}. They are
            the same links declared as <code>sameAs</code> in this site&rsquo;s organisation schema,
            so a crawler resolving any of them arrives at the same entity.
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
                    cannot be edited by us.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="tlx-section" aria-label="Why there are no star ratings in our markup">
        <div className="shell">
          <p className="tlx-kicker">What this page does not do</p>
          <h2 className="tlx-h2">No star ratings in our structured data</h2>
          <div className="gl-body">
            <p>
              This page does not publish an <code>aggregateRating</code>, and it never will. Google
              is explicit that reviews and ratings must not be aggregated from other websites, and
              that a business rating itself is ineligible for the star feature. Both rules exist
              because both are trivially gamed.
            </p>
            <p>
              So the {P.count} reviews are stated here as a cited figure with a link and a date —
              the same way a publication quotes a statistic — rather than injected into our own
              markup as though we had collected them. If you see stars beside a contractor in a
              search result, it is worth knowing which of those two things produced them.
            </p>
            <p>
              We also do not reproduce review text on this site. Those words belong to the people
              who wrote them, on a platform where we have no edit rights. Copying them here would
              strip away the single property that makes them evidence.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
