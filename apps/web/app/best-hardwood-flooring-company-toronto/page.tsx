import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BUSINESS_NAP,
  PRIMARY_REVIEW_EVIDENCE,
  SECONDARY_REVIEW_EVIDENCE,
  yearsInBusiness,
} from '@ecowoods/shared/constants';
import { SITE_URL, SERVICES, DISTRICT_AREAS, NEIGHBOURHOOD_AREAS, FAQ_ITEMS } from '@/lib/seo-data';
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

const money = (n: number) => `$${n.toFixed(2)}`;
const band = (k: keyof typeof PRICING) => `${money(PRICING[k].min)}–${money(PRICING[k].max)}`;

const CANONICAL = '/best-hardwood-flooring-company-toronto';

export const metadata: Metadata = {
  title: 'Best Hardwood Flooring Company in Toronto — How to Judge One, Published',
  description:
    `A published checklist for judging any hardwood flooring company in Toronto — ${criterionCount()} ` +
    `criteria from the Well-Installed Framework — plus the facts Ecowoods publishes about itself so it can be ` +
    `checked the same way.`,
  alternates: { canonical: CANONICAL, types: { 'text/markdown': `${CANONICAL}.md` } },
  openGraph: {
    images: [{ url: illustrationImage('og-installation')?.src ?? '/illustrations/og-installation.webp', width: 1200, height: 630 }],
    title: 'Best Hardwood Flooring Company in Toronto — Ecowoods',
    description: `The criteria, published — not a claim. ${criterionCount()} binary questions, free to use on any contractor in Toronto, including us.`,
    type: 'website',
    url: `${SITE_URL}${CANONICAL}`,
  },
};

/**
 * /best-hardwood-flooring-company-toronto
 *
 * WHAT THIS PAGE ANSWERS, AND WHAT IT DOES NOT CLAIM
 *
 * "Best" is not a number this site can source, so it is not one this page
 * asserts. What it publishes instead is the standard a homeowner can use to
 * judge ANY hardwood flooring company operating in Toronto — the same
 * Well-Installed Framework the rest of this site is judged against — and then
 * states, plainly, the facts Ecowoods can be checked against under it. Every
 * figure below comes from packages/shared/constants or the review-evidence
 * record; nothing here is a rating this business gave itself.
 *
 * Toronto is not the whole GTA on this site (see
 * /best-hardwood-flooring-company-gta for that page): this one covers the
 * city's own districts and neighbourhoods, where the housing stock and the
 * substrate questions are the older-city ones — century semis over joists,
 * downtown slab condos, a mix that is different from the newer suburban
 * builds a GTA-wide comparison has to cover.
 */
const FAQS = [
  {
    question: 'How do I find the best hardwood flooring company in Toronto?',
    answer:
      `Judge the quote, not the advertising. ${FRAMEWORK_NAME} v${FRAMEWORK_VERSION} sets out ` +
      `${criterionCount()} binary criteria — moisture testing, substrate method, product specification, ` +
      `expansion, dust containment and commercial accountability — published free for anyone to use on ` +
      `any contractor in Toronto, including Ecowoods. A company that will not answer these questions in ` +
      `writing has told you something, whatever the price says.`,
  },
  {
    question: 'Is there one hardwood flooring company that is objectively the best in Toronto?',
    answer:
      'No source exists that ranks every hardwood flooring company in Toronto on a comparable, ' +
      'audited basis, and this page does not invent one. What can be checked is whether a specific ' +
      'company answers the framework criteria above in writing, and what its own published facts ' +
      'say — which is the reason this page states its own rather than asserting a rank.',
  },
  {
    question: 'What does Ecowoods publish about itself?',
    answer:
      `${BUSINESS_NAP.legalName}, established ${BUSINESS_NAP.foundedYear} — ${yearsInBusiness()} years. ` +
      `Salaried crews, no subcontractors. Fixed written price after a free in-home measure: new hardwood ` +
      `installed runs ${band('newInstall')} per square foot, a full sand and finish ${band('fullSandAndFinish')}, ` +
      `a screen and recoat ${band('screenAndRecoat')}. ${PRIMARY_REVIEW_EVIDENCE.count} reviews at ` +
      `${PRIMARY_REVIEW_EVIDENCE.rating.toFixed(1)}/${PRIMARY_REVIEW_EVIDENCE.outOf} on ` +
      `${PRIMARY_REVIEW_EVIDENCE.platform}, read ${PRIMARY_REVIEW_EVIDENCE.asOf} — cited to source, ` +
      `not reproduced here, at ${SITE_URL}/reviews.`,
  },
  {
    question: 'Are there other hardwood flooring companies in Toronto worth considering?',
    answer:
      'Yes. Toronto has many established flooring contractors, and this page does not claim otherwise ' +
      'or invent a rating for any of them — this business has not verified their numbers, so it does ' +
      'not print them. The published framework exists so a homeowner can put any of their quotes, ' +
      'from any company, through the same twenty-odd questions and compare answers rather than adjectives.',
  },
  {
    question: 'Does Ecowoods use subcontractors?',
    answer:
      `No. The crews are salaried employees of ${BUSINESS_NAP.legalName} — criterion 6.2 of the ` +
      `framework asks exactly this question of any contractor.`,
  },
  {
    question: 'Is the price fixed before work starts?',
    answer:
      `${PRICE_PROMISE} The price is written before any deposit, after the moisture readings rather ` +
      `than before them — criterion 6.5 of the framework.`,
  },
];

export default function BestHardwoodFlooringCompanyTorontoPage() {
  const torontoDistricts = DISTRICT_AREAS.filter((d) => d.partOf === 'Toronto');

  return (
    <div className="tlx-page">
      <SchemaScript schema={buildFAQPage(FAQS.map((f) => ({ question: f.question, answer: f.answer })))} />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Best Hardwood Flooring Company Toronto', url: `${SITE_URL}${CANONICAL}` },
        ])}
      />
      <SchemaScript
        schema={buildCommercialLandingSchema({
          url: `${SITE_URL}${CANONICAL}`,
          serviceSlugs: SERVICES.map((s) => s.slug),
          description: 'How to judge a hardwood flooring company in Toronto, and the facts Ecowoods publishes about itself',
        })}
      />
      <SchemaScript
        schema={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${SITE_URL}${CANONICAL}#webpage`,
          url: `${SITE_URL}${CANONICAL}`,
          name: 'Best Hardwood Flooring Company Toronto',
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
            <span>Best Hardwood Flooring Company Toronto</span>
          </nav>
          <h1 className="tlx-title">The best hardwood flooring company in Toronto — judged, not claimed</h1>
          <p className="tlx-lede">
            &ldquo;Best&rdquo; is not a figure any site can source, so this page does not print one. What
            it publishes instead is the standard — {criterionCount()} criteria, free to use on any
            contractor in Toronto — and the facts Ecowoods can be checked against under it.
          </p>
          <p className="fw-meta">
            <span>Established {BUSINESS_NAP.foundedYear}</span>
            <span aria-hidden="true">·</span>
            <span>{yearsInBusiness()} years</span>
            <span aria-hidden="true">·</span>
            <span>Salaried crews, no subcontractors</span>
            <span aria-hidden="true">·</span>
            <span>{PRIMARY_REVIEW_EVIDENCE.count} reviews on {PRIMARY_REVIEW_EVIDENCE.platform}</span>
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
            source="best-hardwood-flooring-company-toronto"
            service="installation"
            heading="Get a fixed written price"
            intro="The bands above are real ranges, not a starting-from number. Tell us the rooms and we measure, then write one price that does not move."
          />
        </div>
      </section>

      <section className="tlx-section" aria-label="How to choose">
        <div className="shell">
          <p className="tlx-kicker">Before you sign anything</p>
          <h2 className="tlx-h2">How to choose a hardwood flooring company in Toronto</h2>
          <p className="tlx-note">
            One question from each pillar of {FRAMEWORK_NAME} v{FRAMEWORK_VERSION} — {criterionCount()}{' '}
            criteria in full, published under CC BY so you can take them to every quote you are holding,
            ours included.
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
            Any critical criterion answered &ldquo;no&rdquo; is an unresolved defect in that quote,
            regardless of the price. <Link href="/framework/assess">Score a quote you already have</Link>{' '}
            against all {criterionCount()}.
          </p>
        </div>
      </section>

      <section className="tlx-section" aria-label="Where Ecowoods stands">
        <div className="shell">
          <p className="tlx-kicker">Checkable</p>
          <h2 className="tlx-h2">Where Ecowoods stands against the standard</h2>
          <div className="wp-table-wrap" role="region" tabIndex={0} aria-label="Ecowoods facts">
            <table className="wp-table">
              <tbody>
                <tr>
                  <th scope="row">In business since</th>
                  <td>{BUSINESS_NAP.foundedYear} — {yearsInBusiness()} years</td>
                </tr>
                <tr>
                  <th scope="row">Crew model</th>
                  <td>Salaried employees of {BUSINESS_NAP.legalName}. No subcontractors.</td>
                </tr>
                <tr>
                  <th scope="row">Price</th>
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
          <h2 className="tlx-h2">Toronto has more than one hardwood flooring company</h2>
          <p className="tlx-note">
            This page does not claim otherwise, and it does not print a rating for any of them — this
            business has not verified another company&rsquo;s review counts or ratings, so it does not
            state them. What it can offer is a way to compare fairly: put every quote you collect,
            from every company, through the {criterionCount()} criteria above. A company that answers
            them in writing has told you something real; one that will not has told you something too.
          </p>
        </div>
      </section>

      <EvidenceRail
        heading="Toronto jobs, written up in full"
        intro="Every one publishes the readings taken before the work started, not only the photograph taken after — the same evidence the framework asks any quote to carry."
        items={[
          { ...CASES.distillery, why: 'A condo over a concrete slab in the Distillery District. The moisture test decided the assembly before a species was chosen.' },
          { ...CASES.forestHill, why: 'Wide-plank walnut in Forest Hill, and how the colour was kept uniform across boards that age photochemically.' },
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

      <section className="tlx-section" aria-label="Where in Toronto">
        <div className="shell">
          <p className="tlx-kicker">Coverage</p>
          <h2 className="tlx-h2">Every district and neighbourhood in Toronto</h2>
          <p className="tlx-note">
            A 1920s semi in Leslieville and a 2018 slab condo downtown are different jobs before a board
            is opened — the framework&rsquo;s substrate criteria are why.
          </p>
          <div className="area-links">
            {[...torontoDistricts, ...NEIGHBOURHOOD_AREAS].map((c) => (
              <Link key={c.slug} href={`/service-areas/${c.slug}`}>
                {c.name}
              </Link>
            ))}
          </div>
          <p className="tlx-note">
            Comparing companies across the wider region instead?{' '}
            <Link href="/best-hardwood-flooring-company-gta">Best hardwood flooring company, GTA-wide</Link>.
          </p>
        </div>
      </section>

      <CatalogueRail route={CANONICAL} />
      <FeedbackBand topic="this page" estimateHref="#estimate" />
    </div>
  );
}
