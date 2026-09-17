import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BUSINESS_NAP,
  PRIMARY_REVIEW_EVIDENCE,
  SECONDARY_REVIEW_EVIDENCE,
  yearsInBusiness,
} from '@ecowoods/shared/constants';
import { SITE_URL, SERVICES, CITIES, SERVICE_AREAS } from '@/lib/seo-data';
import { PRICING, PRICE_PROMISE } from '@/lib/pricing';
import { FRAMEWORK_NAME, FRAMEWORK_VERSION, PILLARS, criterionCount } from '@/lib/framework';
import { buildBreadcrumbList, buildFAQPage } from '@/lib/schema/builders';
import { buildCommercialLandingSchema } from '@/lib/schema/commercial';
import { SchemaScript } from '@/lib/schema/components';
import { EvidenceRail, CASES } from '../components/EvidenceRail';
import { CatalogueRail } from '../components/CatalogueRail';
import { FeedbackBand } from '../components/FeedbackBand';
import { EstimateForm } from '../components/EstimateForm';
import { illustrationImage } from '@/app/data/illustration-images';
import { TERRITORY } from '@/lib/geo/territory';

const money = (n: number) => `$${n.toFixed(2)}`;
const band = (k: keyof typeof PRICING) => `${money(PRICING[k].min)}–${money(PRICING[k].max)}`;

const CANONICAL = '/best-hardwood-flooring-company-gta';

export const metadata: Metadata = {
  title: 'Best Hardwood Flooring Company in the GTA — How to Judge One, Published',
  description:
    `A published checklist for judging any hardwood flooring company across the Greater Toronto Area — ` +
    `${criterionCount()} criteria from the Well-Installed Framework — plus the facts Ecowoods publishes about ` +
    `itself so it can be checked the same way in every municipality it serves.`,
  alternates: { canonical: CANONICAL, types: { 'text/markdown': `${CANONICAL}.md` } },
  openGraph: {
    images: [{ url: illustrationImage('og-installation')?.src ?? '/illustrations/og-installation.webp', width: 1200, height: 630 }],
    title: 'Best Hardwood Flooring Company in the GTA — Ecowoods',
    description: `The criteria, published — not a claim. One standard, applied the same way in every municipality across ${TERRITORY}.`,
    type: 'website',
    url: `${SITE_URL}${CANONICAL}`,
  },
};

/**
 * /best-hardwood-flooring-company-gta
 *
 * HOW THIS DIFFERS FROM THE TORONTO PAGE
 *
 * /best-hardwood-flooring-company-toronto answers the comparison question at
 * city scale, where the housing stock is the older-core mix. This page
 * answers the same question at the scale a GTA-wide search actually implies:
 * does the standard, the crew and the price hold across ${SERVICE_AREAS.length}
 * municipalities and neighbourhoods, or does it change once you leave
 * Toronto's own borders — the question a Mississauga, Vaughan or Oakville
 * homeowner is actually asking when they search "best hardwood flooring
 * company GTA" rather than "... Toronto". Every figure below is the same
 * constant the Toronto page reads; nothing here is a second set of facts.
 */
const FAQS = [
  {
    question: 'Does the same hardwood flooring company serve the whole GTA, or do I need a different one per city?',
    answer:
      `One crew model and one published price list apply across ${TERRITORY} rather than one per ` +
      `municipality — the substrate and housing stock change by area (a 1980s Mississauga two-storey ` +
      `over plywood is a different job from a Vaughan slab-on-grade), but the standard the work is ` +
      `judged against does not. ${SERVICE_AREAS.length} areas are published, each with its own page.`,
  },
  {
    question: 'Do hardwood flooring prices change by municipality across the GTA?',
    answer:
      `${PRICE_PROMISE} The three published Ontario bands — ${band('newInstall')} new install, ` +
      `${band('fullSandAndFinish')} full sand and finish, ${band('screenAndRecoat')} screen and recoat, ` +
      `all per square foot — are the same list whether the job is in Toronto, Mississauga or Markham. ` +
      `What moves a quote inside a band is the job itself: area, species, substrate, stairs.`,
  },
  {
    question: 'How do I compare hardwood flooring companies across the GTA fairly?',
    answer:
      `${FRAMEWORK_NAME} v${FRAMEWORK_VERSION} publishes ${criterionCount()} binary criteria — free to ` +
      `use on any contractor in any GTA municipality, including Ecowoods. Put every quote you collect ` +
      `through the same questions rather than comparing adjectives between companies that may not even ` +
      `serve the same area.`,
  },
  {
    question: 'Is there a single "best" hardwood flooring company for the whole GTA?',
    answer:
      'No audited, comparable ranking of every hardwood flooring company across the GTA exists, and ' +
      'this page does not manufacture one. The GTA has many established contractors, most of them ' +
      'serving only part of the region; this page states what Ecowoods publishes about its own coverage ' +
      'and price so it can be checked against the same standard as anyone else quoting the job.',
  },
  {
    question: 'What areas across the GTA does Ecowoods actually cover?',
    answer:
      `${SERVICE_AREAS.length} municipalities and neighbourhoods across ${TERRITORY}, including ` +
      `${CITIES.slice(0, 8).map((c) => c.name).join(', ')} and more, each with its own page describing ` +
      `the local housing stock. Full list at ${SITE_URL}/service-areas, and the drive routes between them ` +
      `at ${SITE_URL}/corridors.`,
  },
  {
    question: 'Does Ecowoods use subcontractors anywhere in the GTA?',
    answer:
      `No, in every municipality it serves. The crews are salaried employees of ${BUSINESS_NAP.legalName} ` +
      `— criterion 6.2 of the framework, and the same answer city to city.`,
  },
];

export default function BestHardwoodFlooringCompanyGtaPage() {
  return (
    <div className="tlx-page">
      <SchemaScript schema={buildFAQPage(FAQS.map((f) => ({ question: f.question, answer: f.answer })))} />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Best Hardwood Flooring Company GTA', url: `${SITE_URL}${CANONICAL}` },
        ])}
      />
      <SchemaScript
        schema={buildCommercialLandingSchema({
          url: `${SITE_URL}${CANONICAL}`,
          serviceSlugs: SERVICES.map((s) => s.slug),
          description: 'How to judge a hardwood flooring company across the GTA, and the facts Ecowoods publishes about itself',
        })}
      />
      <SchemaScript
        schema={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${SITE_URL}${CANONICAL}#webpage`,
          url: `${SITE_URL}${CANONICAL}`,
          name: 'Best Hardwood Flooring Company GTA',
          inLanguage: 'en-CA',
          isPartOf: { '@id': `${SITE_URL}/#website` },
          about: { '@id': `${SITE_URL}/#organization` },
          mainEntity: { '@id': `${SITE_URL}/#organization` },
        }}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
            <span>Best Hardwood Flooring Company GTA</span>
          </nav>
          <h1 className="tlx-title">The best hardwood flooring company in the GTA — one standard, every municipality</h1>
          <p className="tlx-lede">
            &ldquo;Best&rdquo; is not a figure any site can source across a region this size, so this page
            does not print one. What it publishes is the standard — {criterionCount()} criteria, free to
            use on any contractor anywhere in {TERRITORY} — and the facts Ecowoods can be checked against
            under it, city by city.
          </p>
          <p className="fw-meta">
            <span>Established {BUSINESS_NAP.foundedYear}</span>
            <span aria-hidden="true">·</span>
            <span>{yearsInBusiness()} years</span>
            <span aria-hidden="true">·</span>
            <span>{SERVICE_AREAS.length} areas served</span>
            <span aria-hidden="true">·</span>
            <span>Salaried crews, no subcontractors</span>
          </p>
          <div className="fw-actions">
            <Link className="fw-cta" href="#estimate">
              Get a fixed written price →
            </Link>
            <Link className="fw-cta fw-cta--ghost" href="/framework/assess">
              Score a quote you already have
            </Link>
          </div>
          <p className="tlx-note">
            <a href={BUSINESS_NAP.phoneHref}>Call {BUSINESS_NAP.phoneDisplay}</a> ·{' '}
            <Link href="/floor-studio">See a floor in your own room, free</Link> ·{' '}
            <Link href="/reviews">Read the sourced reviews</Link>
          </p>
        </div>
      </header>

      <section className="tlx-section" aria-label="Request an estimate">
        <div className="shell">
          <EstimateForm
            source="best-hardwood-flooring-company-gta"
            service="installation"
            heading="Get a fixed written price"
            intro="Same bands, same crew model, same fixed-price rule in every municipality Ecowoods serves. Tell us the rooms and we measure."
          />
        </div>
      </section>

      <section className="tlx-section" aria-label="How to choose">
        <div className="shell">
          <p className="tlx-kicker">Before you sign anything</p>
          <h2 className="tlx-h2">How to choose a hardwood flooring company anywhere in the GTA</h2>
          <p className="tlx-note">
            One question from each pillar of {FRAMEWORK_NAME} v{FRAMEWORK_VERSION} — {criterionCount()}{' '}
            criteria in full, published under CC BY, applicable to a quote in Etobicoke, Markham or Oakville
            equally.
          </p>
          <ol className="fw-criteria">
            {PILLARS.map((p) => {
              const first = p.criteria[0];
              return (
                <li key={p.id} className="fw-criterion">
                  <div className="fw-criterion-head">
                    <span className="fw-id">{p.number}</span>
                  </div>
                  <p className="fw-question">
                    <Link href={`/framework#${p.id}`}>{p.name}</Link>
                  </p>
                  <p className="fw-risk">
                    Ask: &ldquo;{first.question}&rdquo; — {first.risk}
                  </p>
                </li>
              );
            })}
          </ol>
          <p className="tlx-note">
            Any critical criterion answered &ldquo;no&rdquo; is an unresolved defect, wherever the job is.{' '}
            <Link href="/framework/assess">Score a quote you already have</Link> against all {criterionCount()}.
          </p>
        </div>
      </section>

      <section className="tlx-section" aria-label="Where Ecowoods stands">
        <div className="shell">
          <p className="tlx-kicker">Checkable</p>
          <h2 className="tlx-h2">Where Ecowoods stands against the standard, across the GTA</h2>
          <div className="wp-table-wrap" role="region" tabIndex={0} aria-label="Ecowoods facts">
            <table className="wp-table">
              <tbody>
                <tr>
                  <th scope="row">In business since</th>
                  <td>{BUSINESS_NAP.foundedYear} — {yearsInBusiness()} years</td>
                </tr>
                <tr>
                  <th scope="row">Crew model</th>
                  <td>Salaried employees of {BUSINESS_NAP.legalName}, in every municipality served. No subcontractors.</td>
                </tr>
                <tr>
                  <th scope="row">Price — one list, every municipality</th>
                  <td>
                    <Link href="/services/hardwood-installation">{PRICING.newInstall.label}</Link>{' '}
                    {band('newInstall')}/sq ft · <Link href="/services/floor-refinishing">
                      {PRICING.fullSandAndFinish.label}
                    </Link>{' '}
                    {band('fullSandAndFinish')}/sq ft · {PRICING.screenAndRecoat.label} {band('screenAndRecoat')}/sq ft.{' '}
                    {PRICE_PROMISE}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Reviews</th>
                  <td>
                    {PRIMARY_REVIEW_EVIDENCE.count} at {PRIMARY_REVIEW_EVIDENCE.rating.toFixed(1)}/
                    {PRIMARY_REVIEW_EVIDENCE.outOf} on {PRIMARY_REVIEW_EVIDENCE.platform}, read{' '}
                    {PRIMARY_REVIEW_EVIDENCE.asOf}
                    {SECONDARY_REVIEW_EVIDENCE.length
                      ? SECONDARY_REVIEW_EVIDENCE.map(
                          (r) => `; ${r.count} at ${r.rating.toFixed(1)}/${r.outOf} on ${r.platform}, read ${r.asOf}`,
                        ).join('')
                      : ''}
                    . Cited to source, never reproduced, at <Link href="/reviews">/reviews</Link>.
                  </td>
                </tr>
                <tr>
                  <th scope="row">Coverage</th>
                  <td>
                    {SERVICE_AREAS.length} published areas — list at <Link href="/service-areas">/service-areas</Link>,
                    drive routes between them at <Link href="/corridors">/corridors</Link>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Published standard</th>
                  <td>
                    <Link href="/framework">{FRAMEWORK_NAME} v{FRAMEWORK_VERSION}</Link> —{' '}
                    {criterionCount()} criteria, free to cite
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="tlx-section" aria-label="Other companies exist">
        <div className="shell">
          <p className="tlx-kicker">Said plainly</p>
          <h2 className="tlx-h2">The GTA has more than one hardwood flooring company</h2>
          <p className="tlx-note">
            Most serve part of the region rather than all of it, and this page does not print a rating
            for any of them — this business has not verified another company&rsquo;s review counts, so
            it does not state them. What it can offer is a way to compare fairly across municipalities:
            put every quote you collect, wherever it comes from, through the {criterionCount()} criteria
            above. A company that answers them in writing, in your city, has told you something real.
          </p>
        </div>
      </section>

      <EvidenceRail
        heading="Jobs across the region, written up in full"
        intro="Every one publishes the readings taken before the work started, not only the photograph taken after — the same evidence the framework asks any quote to carry, in any municipality."
        items={[
          { ...CASES.rosedale, why: 'Stairs and a main floor over radiant heat, where the two assemblies move differently and had to finish to the same colour.' },
          { ...CASES.midtown, why: 'Three storeys, three different substrates, one continuous floor — the hardest kind of match, and the same protocol wherever the substrate changes.' },
        ]}
      />

      <section className="tlx-section" aria-label="Frequently asked questions">
        <div className="shell">
          <p className="tlx-kicker">Straight answers</p>
          <h2 className="tlx-h2">Questions people actually ask</h2>
          <dl className="gd-spec">
            {FAQS.map((f) => (
              <div className="gd-spec-row" key={f.question}>
                <dt>{f.question}</dt>
                <dd>{f.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="tlx-section" aria-label="Where across the GTA">
        <div className="shell">
          <p className="tlx-kicker">Coverage</p>
          <h2 className="tlx-h2">{SERVICE_AREAS.length} areas across {TERRITORY}</h2>
          <p className="tlx-note">
            Each municipality has its own page describing the local housing stock and what it means for a
            floor. Comparing companies inside Toronto&rsquo;s own core instead?{' '}
            <Link href="/best-hardwood-flooring-company-toronto">Best hardwood flooring company, Toronto</Link>.
          </p>
          <div className="area-links">
            {CITIES.map((c) => (
              <Link key={c.slug} href={`/service-areas/${c.slug}`}>
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CatalogueRail route={CANONICAL} />
      <FeedbackBand topic="this page" estimateHref="#estimate" />
    </div>
  );
}
