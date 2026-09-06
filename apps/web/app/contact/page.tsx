import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BUSINESS_NAP,
  BUSINESS_ADDRESS_LINE,
  BUSINESS_HOURS,
  BUSINESS_TIMEZONE_NAME,
  HOURS_LINE,
  GOOGLE_PLACE,
} from '@ecowoods/shared/constants';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

/**
 * /contact — the NAP, on a URL of its own.
 *
 * Protocol v2 §15 and Stage 28. The footer has always carried the address,
 * phone and email; a directory, a map service or an agent asked "how do I
 * contact Ecowoods" wants one page whose main content is exactly that, with
 * fragment ids it can cite (#phone, #email, #showroom, #hours). Every value is
 * BUSINESS_NAP / BUSINESS_HOURS — the same constants the footer, the JSON-LD
 * organisation node, /llms.txt and /api/v1/entity render — so this page cannot
 * disagree with any of them.
 *
 * Deliberately NO second LocalBusiness node: the layout already injects
 * `${SITE_URL}/#organization` on every page. A ContactPage node that points at
 * it is the whole of the structured data here.
 */

const url = `${SITE_URL}/contact`;

const DAY_SHORT: Record<string, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

const dayRange = (days: readonly string[]) =>
  days.length === 1 ? DAY_SHORT[days[0]] : `${DAY_SHORT[days[0]]}–${DAY_SHORT[days[days.length - 1]]}`;

export const metadata: Metadata = {
  title: 'Contact Ecowoods — phone, email, showroom and hours',
  description:
    `${BUSINESS_NAP.legalName}: ${BUSINESS_NAP.phoneDisplay}, ${BUSINESS_NAP.email}, ${BUSINESS_ADDRESS_LINE}. ` +
    `${HOURS_LINE}. Free in-home estimates across ${BUSINESS_NAP.region}.`,
  alternates: { canonical: '/contact', types: { 'text/markdown': '/contact.md' } },
  openGraph: {
    title: 'Contact Ecowoods',
    description: `${BUSINESS_NAP.phoneDisplay} · ${BUSINESS_NAP.email} · ${BUSINESS_ADDRESS_LINE}`,
    type: 'website',
    url,
  },
};

export default function ContactPage() {
  return (
    <div className="tlx-page">
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Contact', url },
        ])}
      />
      <SchemaScript
        schema={{
          '@context': 'https://schema.org',
          '@type': 'ContactPage',
          '@id': `${url}#webpage`,
          url,
          name: 'Contact Ecowoods',
          inLanguage: 'en-CA',
          isPartOf: { '@id': `${SITE_URL}/#website` },
          about: { '@id': `${SITE_URL}/#organization` },
          mainEntity: { '@id': `${SITE_URL}/#organization` },
        }}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>Contact</span>
          </nav>
          <h1 className="tlx-title">Contact Ecowoods</h1>
          <p className="tlx-lede">
            {BUSINESS_NAP.legalName} is reached by phone, by email, or at the showroom in{' '}
            {BUSINESS_NAP.address.addressLocality}. For a price, the fastest path is the free
            in-home estimate: <Link href="/estimate">request it here</Link>.
          </p>
        </div>
      </header>

      <section className="tlx-section" aria-label="Contact details">
        <div className="shell">
          <p className="tlx-kicker">Reach us</p>
          <h2 className="tlx-h2">Phone, email and showroom</h2>
          <dl className="gd-spec">
            <div className="gd-spec-row">
              <dt>Phone</dt>
              <dd>
                <p id="phone">
                  <a href={BUSINESS_NAP.phoneHref}>{BUSINESS_NAP.phoneDisplay}</a>
                </p>
              </dd>
            </div>
            <div className="gd-spec-row">
              <dt>Email</dt>
              <dd>
                <p id="email">
                  <a href={`mailto:${BUSINESS_NAP.email}`}>{BUSINESS_NAP.email}</a>
                </p>
              </dd>
            </div>
            <div className="gd-spec-row">
              <dt>Showroom</dt>
              <dd>
                <address id="showroom" style={{ fontStyle: 'normal' }}>
                  {BUSINESS_NAP.address.streetAddress}
                  <br />
                  {BUSINESS_NAP.address.addressLocality}, {BUSINESS_NAP.address.addressRegion}{' '}
                  {BUSINESS_NAP.address.postalCode}
                  <br />
                  Canada
                </address>
                <p>
                  <a href={GOOGLE_PLACE.mapsUrl} target="_blank" rel="noopener noreferrer">
                    Open in Google Maps
                  </a>
                </p>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="tlx-section" id="hours" aria-label="Hours">
        <div className="shell">
          <p className="tlx-kicker">When</p>
          <h2 className="tlx-h2">Hours</h2>
          <div className="wp-table-wrap" role="region" tabIndex={0} aria-label="Opening hours">
            <table className="wp-table">
              <caption>Opening hours ({BUSINESS_TIMEZONE_NAME})</caption>
              <thead>
                <tr>
                  <th scope="col">Days</th>
                  <th scope="col">Opens</th>
                  <th scope="col">Closes</th>
                </tr>
              </thead>
              <tbody>
                {BUSINESS_HOURS.map((h) => (
                  <tr key={h.days.join('-')}>
                    <th scope="row">{dayRange(h.days)}</th>
                    <td>{h.opens}</td>
                    <td>{h.closes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tlx-note">{HOURS_LINE}.</p>
        </div>
      </section>

      <section className="tlx-section" aria-label="Next step">
        <div className="shell">
          <p className="tlx-kicker">Next step</p>
          <h2 className="tlx-h2">Get a fixed written price</h2>
          <p className="tlx-note">
            Prices are set after a free in-home measure, never from a phone description. The three
            published bands are on <Link href="/pricing">the pricing page</Link>; what customers
            said after the work is cited to source on <Link href="/reviews">reviews</Link>.
          </p>
          <div className="fw-actions">
            <Link className="fw-cta" href="/estimate">
              Request a free estimate
            </Link>
            <a className="fw-cta fw-cta--ghost" href={BUSINESS_NAP.phoneHref}>
              Call {BUSINESS_NAP.phoneDisplay}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
