import type { Metadata } from 'next';
import Link from 'next/link';
import { BUSINESS_NAP, BUSINESS_ADDRESS_LINE, HOURS_LINE } from '@ecowoods/shared/constants';
import { SITE_URL, SERVICES } from '@/lib/seo-data';
import { PRICE_PROMISE } from '@/lib/pricing';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';
import { EstimateForm } from '../components/EstimateForm';

/**
 * /estimate — the conversion target.
 *
 * Protocol v2 Stage 30 and §15. Until this route existed, "request an
 * estimate" resolved to `/#quote`, an anchor on the homepage. The organisation's
 * JSON-LD `potentialAction` (QuoteAction), the registry's `request_estimate`
 * action and every machine surface now point at THIS URL, and the form itself
 * is the `#form` fragment they cite. The three steps carry stable ids so an
 * agent can describe the path — measure, price, work — and link each one.
 *
 * Nothing here is a new claim: the form is the same EstimateForm that posts to
 * /api/leads from every commercial page; the steps restate what the FAQ and
 * the pricing page already say; the NAP is BUSINESS_NAP.
 */

const url = `${SITE_URL}/estimate`;

export const metadata: Metadata = {
  title: 'Request a free in-home hardwood estimate in Toronto',
  description:
    `A senior estimator measures and moisture-tests, then writes one fixed price with a committed schedule. ` +
    `Free in-home visits across ${BUSINESS_NAP.region}. Call ${BUSINESS_NAP.phoneDisplay}.`,
  alternates: { canonical: '/estimate', types: { 'text/markdown': '/estimate.md' } },
  openGraph: {
    title: 'Request a free in-home estimate — Ecowoods',
    description: `Free in-home measure, fixed written price, committed schedule. ${BUSINESS_NAP.region}.`,
    type: 'website',
    url,
  },
};

const STEPS = [
  {
    id: 'step-measure',
    title: 'The measure',
    body:
      'A senior estimator comes to the house, moisture-tests the floor and the subfloor, measures the rooms and the stairs, and looks at the substrate. Nothing is quoted from a phone description.',
  },
  {
    id: 'step-price',
    title: 'The written price',
    body:
      `${PRICE_PROMISE} The estimate names the service, the species and finish where they apply, the schedule the crew commits to, and the manufacturer warranties itemised in writing.`,
  },
  {
    id: 'step-work',
    title: 'The work',
    body:
      'Salaried crews, not subcontractors. Dust-free sanding where the job is a refinish, containment at the room, and a floor you can walk on in hours rather than days with water-based finishes.',
  },
];

export default function EstimatePage() {
  return (
    <div className="tlx-page">
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Request an estimate', url },
        ])}
      />
      <SchemaScript
        schema={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${url}#webpage`,
          url,
          name: 'Request a free in-home estimate — Ecowoods',
          inLanguage: 'en-CA',
          isPartOf: { '@id': `${SITE_URL}/#website` },
          about: { '@id': `${SITE_URL}/#organization` },
          potentialAction: {
            '@type': 'QuoteAction',
            name: 'Request a free in-home estimate',
            target: { '@type': 'EntryPoint', urlTemplate: `${url}#form` },
          },
        }}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>Request an estimate</span>
          </nav>
          <h1 className="tlx-title">Request a free in-home estimate</h1>
          <p className="tlx-lede">
            {BUSINESS_NAP.legalName} quotes hardwood work in {BUSINESS_NAP.region} after a free
            in-home visit. A senior estimator measures and moisture-tests the floor, then writes one
            fixed price with a committed schedule. The number on the estimate is the number on the
            invoice. Send the form below, or call{' '}
            <a href={BUSINESS_NAP.phoneHref}>{BUSINESS_NAP.phoneDisplay}</a>.
          </p>
        </div>
      </header>

      <section className="tlx-section" id="steps" aria-label="How the estimate works">
        <div className="shell">
          <p className="tlx-kicker">Three steps</p>
          <h2 className="tlx-h2">How the estimate works</h2>
          <ol className="wp-steps">
            {STEPS.map((s, i) => (
              <li key={s.id} id={s.id}>
                <strong>
                  {i + 1}. {s.title}.
                </strong>{' '}
                {s.body}
              </li>
            ))}
          </ol>
          <p className="tlx-note">
            The three published price bands, and what moves a job inside each, are on{' '}
            <Link href="/pricing">the pricing page</Link>. The services the visit can quote:{' '}
            {SERVICES.map((s, i) => (
              <span key={s.slug}>
                {i > 0 && ' · '}
                <Link href={`/services/${s.slug}`}>{s.name}</Link>
              </span>
            ))}
            .
          </p>
        </div>
      </section>

      <section className="tlx-section" aria-label="Request an estimate">
        <div className="shell">
          <div id="form">
            <EstimateForm
              source="estimate"
              heading="Book the free in-home measure"
              intro="A senior estimator replies within one business day. The price we write after measuring is the price you pay."
            />
          </div>
        </div>
      </section>

      <section className="tlx-section" id="call" aria-label="Call or visit">
        <div className="shell">
          <p className="tlx-kicker">Prefer to talk</p>
          <h2 className="tlx-h2">Call, email or visit</h2>
          <dl className="gd-spec">
            <div className="gd-spec-row">
              <dt>Phone</dt>
              <dd>
                <a href={BUSINESS_NAP.phoneHref}>{BUSINESS_NAP.phoneDisplay}</a>
              </dd>
            </div>
            <div className="gd-spec-row">
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${BUSINESS_NAP.email}`}>{BUSINESS_NAP.email}</a>
              </dd>
            </div>
            <div className="gd-spec-row">
              <dt>Hours</dt>
              <dd>{HOURS_LINE}</dd>
            </div>
            <div className="gd-spec-row">
              <dt>Showroom</dt>
              <dd>{BUSINESS_ADDRESS_LINE}</dd>
            </div>
          </dl>
          <p className="tlx-note">
            Full contact details, hours by day and the map are on{' '}
            <Link href="/contact">the contact page</Link>. What customers said after the work is
            cited to source on <Link href="/reviews">reviews</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
