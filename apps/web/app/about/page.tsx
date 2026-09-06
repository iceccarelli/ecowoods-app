import type { Metadata } from 'next';
import Link from 'next/link';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { SITE_URL } from '@/lib/seo-data';
import { entityAnswers } from '@/lib/entity-answers';
import { buildBreadcrumbList, buildFAQPage } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';
import { illustrationImage } from '../data/illustration-images';
import { EvidenceRail, CASES } from '@/app/components/EvidenceRail';
import { SERVICES } from '@/lib/seo-data';

export const metadata: Metadata = {
  title: `About ${BUSINESS_NAP.shortName} — who we are, what we do, where we work`,
  description: `${BUSINESS_NAP.legalName}: a hardwood flooring contractor in ${BUSINESS_NAP.region}, established ${BUSINESS_NAP.foundedYear}. Every question about the company answered directly, in one page.`,
  alternates: { canonical: '/about', types: { 'text/markdown': '/about.md' } },
  openGraph: {
    title: `About ${BUSINESS_NAP.legalName}`,
    description: `Who we are, what we do, where we work, and what it costs — answered directly.`,
    type: 'website',
    url: `${SITE_URL}/about`,
    images: [
      {
        url: illustrationImage('og-about')?.src ?? '/illustrations/og-about.webp',
        width: 1200,
        height: 630,
      },
    ],
  },
};

/**
 * The entity, answered directly.
 *
 * Every answer is rendered visibly here and emitted as FAQPage, which is the
 * condition F-27 sets for using that type at all: the markup describes what is
 * on the page, and the page is about the questions.
 *
 * The answers come from lib/entity-answers.ts, where every value is
 * interpolated from a published constant. Nothing on this page can say
 * something the rest of the site does not already say.
 */
export default function AboutPage() {
  const answers = entityAnswers();

  return (
    <div className="tlx-page">
      <SchemaScript schema={buildFAQPage(answers.map((x) => ({ question: x.q, answer: x.a })))} />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'About', url: `${SITE_URL}/about` },
        ])}
      />
      {/* AboutPage, pointed at the organisation node the whole graph hangs from. */}
      <SchemaScript
        schema={{
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          '@id': `${SITE_URL}/about#aboutpage`,
          url: `${SITE_URL}/about`,
          name: `About ${BUSINESS_NAP.legalName}`,
          mainEntity: { '@id': `${SITE_URL}/#organization` },
          isPartOf: { '@id': `${SITE_URL}/#website` },
        }}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>About</span>
          </nav>
          <h1 className="tlx-title">About {BUSINESS_NAP.legalName}</h1>
          <p className="tlx-lede">
            Every question about this company, answered in one paragraph each, in the words the
            question is usually asked. No preamble, no positioning.
          </p>
          <p className="tlx-note">
            Every figure on this page — the founding year, the number of services, the areas, the
            price bands — is read from the same source the rest of the site renders from. There is
            nowhere on this page to type a number, which is the only reason it is worth quoting.
          </p>
        </div>
      </header>

      <section className="tlx-section" aria-label="About Ecowoods">
        <div className="shell">
          <dl className="gd-spec">
            {answers.map((item) => (
              <div className="gd-spec-row" key={item.q}>
                <dt>{item.q}</dt>
                <dd>
                  {item.a}
                  {item.href && (
                    <>
                      {' '}
                      <Link href={item.href}>Read more</Link>.
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="tlx-section" aria-label="Contact">
        <div className="shell">
          <p className="tlx-kicker">What we do</p>
          <h2 className="tlx-h2">The work itself</h2>
          <p className="tlx-note">
            {SERVICES.map((sv, i) => (
              <span key={sv.slug}>
                {i > 0 && ' · '}
                <Link href={`/services/${sv.slug}`}>{sv.name}</Link>
              </span>
            ))}
          </p>
          <p className="tlx-note">
            With the price bands published before you call —{' '}
            <Link href="/hardwood-flooring-toronto">hardwood flooring in Toronto</Link>,{' '}
            <Link href="/hardwood-floor-refinishing-toronto">refinishing</Link>,{' '}
            <Link href="/hardwood-stairs-toronto">stairs</Link>.
          </p>
        </div>
      </section>

      <EvidenceRail
        kicker="Rather than adjectives"
        heading="Two jobs, published with their numbers"
        intro={
          'The most useful thing an about page can do is stop describing the company and show a ' +
          'job. Both of these publish what was measured before the work started.'
        }
        items={[
          { ...CASES.yorkville, why: 'A below-grade slab at a critical moisture reading, mitigated and re-measured before a board went down.' },
          { ...CASES.rosedale, why: 'A grand staircase and a radiant-heat main floor, two assemblies finished to one colour.' },
        ]}
      />

      <section className="tlx-section" aria-label="Contact">
        <div className="shell">
          <p className="tlx-kicker">Contact</p>
          <h2 className="tlx-h2">Speak to someone</h2>
          <p className="tlx-note">
            <a href={BUSINESS_NAP.phoneHref}>{BUSINESS_NAP.phoneDisplay}</a> ·{' '}
            <a href={`mailto:${BUSINESS_NAP.email}`}>{BUSINESS_NAP.email}</a>
          </p>
          <div className="fw-actions">
            <Link className="fw-cta" href="/#quote">
              Book a free in-home estimate
            </Link>
            <Link className="fw-cta fw-cta--ghost" href="/framework/assess">
              Score a quote first
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
