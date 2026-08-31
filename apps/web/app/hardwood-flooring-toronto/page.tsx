import type { Metadata } from 'next';
import { FeedbackBand } from '../components/FeedbackBand';
import { EstimateForm } from '../components/EstimateForm';
import Link from 'next/link';
import {
  BUSINESS_NAP,
  PRIMARY_REVIEW_EVIDENCE,
  TOTAL_REVIEWS_CITED,
  yearsInBusiness,
} from '@ecowoods/shared/constants';
import { SITE_URL, SERVICES, CITIES, SERVICE_AREAS } from '@/lib/seo-data';
import { PRICING, PRICE_PROMISE } from '@/lib/pricing';
import { FRAMEWORK_NAME, FRAMEWORK_VERSION, PILLARS, criterionCount } from '@/lib/framework';
import { getPapers } from '@/lib/papers';
import { buildBreadcrumbList, buildFAQPage } from '@/lib/schema/builders';
import { buildCommercialLandingSchema } from '@/lib/schema/commercial';
import { SchemaScript } from '@/lib/schema/components';
import { Illustration } from '../components/Illustration';
import { EvidenceRail, CASES } from '../components/EvidenceRail';

const money = (n: number) => `$${n.toFixed(2)}`;
const band = (k: keyof typeof PRICING) => `${money(PRICING[k].min)}–${money(PRICING[k].max)}`;

export const metadata: Metadata = {
  title: 'Hardwood Flooring Toronto — Installation & Refinishing, Fixed Written Price',
  description: `Hardwood flooring installation and refinishing across Toronto and the GTA. Price bands published up front (${band('newInstall')} per sq ft installed), the full installation standard published for anyone to hold us to, and salaried crews rather than subcontractors.`,
  alternates: { canonical: '/hardwood-flooring-toronto' },
  openGraph: {
    title: 'Hardwood Flooring Toronto — Ecowoods',
    description: `Published price bands, a published ${criterionCount()}-criterion installation standard, and no subcontractors. Serving ${SERVICE_AREAS.length} areas across Toronto and the GTA.`,
    type: 'website',
    url: `${SITE_URL}/hardwood-flooring-toronto`,
  },
};

/**
 * /hardwood-flooring-toronto — the head term, finally answered.
 *
 * THE GAP THIS CLOSES
 *
 * This site had six service pages, thirty-two service-area pages, three
 * technical papers and a versioned installation standard, and **no page at all
 * addressing the query the market actually types**: "hardwood flooring
 * Toronto". /services/hardwood-installation describes a service.
 * /service-areas/etobicoke describes a place. Neither answers "who should I
 * hire in Toronto and what will it cost", which is the question behind the
 * highest-intent search in this market.
 *
 * WHY IT IS NOT A LANDING PAGE IN THE USUAL SENSE
 *
 * The usual commercial page for this term is adjectives and a form. This one
 * answers the question with numbers and links to where each number is derived,
 * because that is the only version that also works as a citation. An answer
 * engine asked "how much is hardwood flooring in Toronto" needs a figure and a
 * source; a human comparing three quotes needs the same thing. They are the
 * same page.
 *
 * EVERY FIGURE IS INTERPOLATED. The price bands come from lib/pricing.ts, the
 * criteria count from lib/framework.ts, the area count from lib/seo-data.ts and
 * the review figures from REVIEW_EVIDENCE with their read date. Nothing here is
 * typed by hand, so this page cannot drift from the rest of the site and cannot
 * make a claim the site does not already make. There is no aggregateRating and
 * there never will be — see /reviews.
 */
const FAQS = [
  {
    question: 'How much does hardwood flooring cost in Toronto?',
    answer:
      `${PRICE_PROMISE} A new hardwood installation runs ${band('newInstall')} per square foot ` +
      `installed. Refinishing an existing floor runs ${band('fullSandAndFinish')} per square foot ` +
      `for a full sand and finish, or ${band('screenAndRecoat')} for a screen and recoat where the ` +
      `existing finish is sound. What moves a quote inside those bands is area, species, the ` +
      `substrate underneath, stairs, and the condition of what is already there.`,
  },
  {
    question: 'How do I tell a good hardwood quote from a bad one?',
    answer:
      `Ask whether the moisture readings were taken and written down before the price was given. ` +
      `${FRAMEWORK_NAME} v${FRAMEWORK_VERSION} sets out ${criterionCount()} criteria for exactly ` +
      `this, published free for anyone to use on any contractor in the GTA — including Ecowoods. ` +
      `Any critical criterion answered "no" is an unresolved defect in that quote, whatever the price says.`,
  },
  {
    question: 'Does Ecowoods use subcontractors?',
    answer:
      `No. The crews are salaried employees of ${BUSINESS_NAP.legalName}. That is the difference ` +
      `between a company that can enforce a protocol and one that can only hope the crew followed it.`,
  },
  {
    question: 'Is the estimate a fixed price?',
    answer:
      `${PRICE_PROMISE} The price is fixed in writing before any deposit, and it is given after the ` +
      `moisture readings rather than before them — because a price quoted before anyone has ` +
      `measured the subfloor is a guess that gets corrected later, at the homeowner's expense.`,
  },
  {
    question: 'What areas does Ecowoods cover?',
    answer:
      `${SERVICE_AREAS.length} municipalities and neighbourhoods across Toronto and the GTA, ` +
      `including ${CITIES.slice(0, 6).map((c) => c.name).join(', ')} and more. Each has its own ` +
      `page describing the housing stock there and what it means for a floor.`,
  },
  {
    question: 'Solid or engineered hardwood for a Toronto home?',
    answer:
      `The substrate decides, not the budget. Plywood over joists takes nail-down solid; a concrete ` +
      `slab or a condominium takes glue-down engineered; radiant heat takes a floating engineered ` +
      `assembly. Toronto indoor humidity swings from roughly 18–25% in deep winter to above 60% in ` +
      `summer against a stable band of 35–55%, which is why the construction of the board matters ` +
      `more here than the species on the label.`,
  },
  {
    question: 'What reviews does Ecowoods have?',
    answer:
      `${TOTAL_REVIEWS_CITED} reviews at ${PRIMARY_REVIEW_EVIDENCE.rating.toFixed(1)} out of ` +
      `${PRIMARY_REVIEW_EVIDENCE.outOf} on ${PRIMARY_REVIEW_EVIDENCE.platform}, read from the live ` +
      `profile on ${PRIMARY_REVIEW_EVIDENCE.asOf}. They are published there rather than reproduced ` +
      `here, because reviews we cannot edit are the only ones worth reading.`,
  },
];

export default function HardwoodFlooringTorontoPage() {
  const papers = getPapers();

  return (
    <div className="tlx-page">
      <SchemaScript schema={buildFAQPage(FAQS.map((f) => ({ question: f.question, answer: f.answer })))} />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Hardwood Flooring Toronto', url: `${SITE_URL}/hardwood-flooring-toronto` },
        ])}
      />
      {/* Service + Offer + areaServed. The other three blocks describe the
          page; this one describes the transaction, which is what a commercial
          query is actually about. Prices derived from lib/pricing.ts — a
          service with no published band gets no Offer. */}
      <SchemaScript
        schema={buildCommercialLandingSchema({
          url: `${SITE_URL}/hardwood-flooring-toronto`,
          serviceSlugs: ['hardwood-installation', 'floor-refinishing', 'dust-free-sanding', 'floor-restoration', 'custom-inlays', 'stair-refinishing'],
          description: 'Hardwood flooring installation and refinishing across Toronto and the GTA',
        })}
      />
      <SchemaScript
        schema={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${SITE_URL}/hardwood-flooring-toronto#webpage`,
          url: `${SITE_URL}/hardwood-flooring-toronto`,
          name: 'Hardwood Flooring Toronto',
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
            <span>Hardwood Flooring Toronto</span>
          </nav>
          <h1 className="tlx-title">Hardwood flooring in Toronto</h1>
          <p className="tlx-lede">
            The prices are on this page. So is the standard we work to, the protocol we follow, and
            the papers the protocol comes from — all of it free to read and free to use on any
            contractor in the GTA, including us.
          </p>
          {/* P0-5: the three published bands, printed on the first screen —
              the same pattern as /hardwood-floor-refinishing-toronto. The
              estimate form below says "the bands above are real ranges"; these
              are the bands above. Derived from lib/pricing.ts, never typed. */}
          <p className="fw-meta">
            <span>{PRICING.newInstall.label} {band('newInstall')}/sq ft</span>
            <span aria-hidden="true">·</span>
            <span>{PRICING.fullSandAndFinish.label} {band('fullSandAndFinish')}/sq ft</span>
            <span aria-hidden="true">·</span>
            <span>{PRICING.screenAndRecoat.label} {band('screenAndRecoat')}/sq ft</span>
          </p>
          <p className="fw-meta">
            <span>Established {BUSINESS_NAP.foundedYear}</span>
            <span aria-hidden="true">·</span>
            <span>{yearsInBusiness()} years</span>
            <span aria-hidden="true">·</span>
            <span>{SERVICE_AREAS.length} areas</span>
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
        </div>
      </header>

      {/* THE ASK, ON THE PAGE THAT EARNED IT — F-160.
          This used to be a link to `/#quote`, which is a different url whose form
          only exists after React opens a modal. Zero `<form>` elements reached the
          served HTML of any page on this site. It is here now, above every
          explanatory section, because a buyer who has read the price and decided
          should not have to navigate to act on it. */}
      <section className="tlx-section" aria-label="Request an estimate">
        <div className="shell">
          <EstimateForm source="hardwood-flooring-toronto" service="installation" heading="Get a fixed written price for your install" intro="The bands above are real ranges, not a starting-from number. Tell us the rooms and we measure, then write one price that does not move." />
        </div>
      </section>

      <section className="tlx-section" aria-label="What it costs">
        <div className="shell">
          <p className="tlx-kicker">Before you call anyone</p>
          <h2 className="tlx-h2">What hardwood flooring costs in Toronto</h2>
          <p className="tlx-note">{PRICE_PROMISE}</p>
          <div className="wp-table-wrap" role="region" tabIndex={0} aria-label="Price bands">
            <table className="wp-table">
              <thead>
                <tr>
                  <th scope="col">Scope</th>
                  <th scope="col">Per square foot, installed</th>
                  <th scope="col">When this is the right scope</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{PRICING.screenAndRecoat.label}</th>
                  <td>{band('screenAndRecoat')}</td>
                  <td>The existing finish is worn but sound and the wood beneath is undamaged.</td>
                </tr>
                <tr>
                  <th scope="row">{PRICING.fullSandAndFinish.label}</th>
                  <td>{band('fullSandAndFinish')}</td>
                  <td>The floor is scratched, stained or previously badly finished. Back to bare wood.</td>
                </tr>
                <tr>
                  <th scope="row">{PRICING.newInstall.label}</th>
                  <td>{band('newInstall')}</td>
                  <td>New material over a prepared substrate, including stairs and transitions.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="tlx-note">
            What moves a quote inside a band: area, species, the substrate underneath, stairs, and
            the condition of what is already there. The{' '}
            <Link href="/guides/hardwood-flooring-cost-toronto">cost guide</Link> sets each one out.
          </p>
          <Illustration id="fig-installed-cost-bands" />
        </div>
      </section>

      <section className="tlx-section" aria-label="Why the climate decides the specification">
        <div className="shell">
          <p className="tlx-kicker">The part most quotes skip</p>
          <h2 className="tlx-h2">Toronto air is the reason floors fail here</h2>
          <p className="tlx-note">
            Indoor humidity in this city runs to roughly 18–25% in deep winter and above 60% in
            summer, against a band of 35–55% in which hardwood is dimensionally stable. Every
            decision below follows from that one fact, and a quote that does not mention moisture
            has not accounted for it.
          </p>
          <Illustration id="fig-climate-rh-bands" />
          <p className="tlx-note">
            Set out in full in{' '}
            <Link href={`/papers/${papers[0]?.slug ?? ''}`}>the climate and moisture paper</Link>,
            free to read and free to cite.
          </p>
        </div>
      </section>

      <section className="tlx-section" aria-label="The standard">
        <div className="shell">
          <p className="tlx-kicker">Hold us to it</p>
          <h2 className="tlx-h2">
            {FRAMEWORK_NAME} — {criterionCount()} criteria, published
          </h2>
          <p className="tlx-note">
            Six pillars, {criterionCount()} criteria, version {FRAMEWORK_VERSION}. Published under
            CC BY so you can take it to every quote you are holding — ours included. Any critical
            criterion answered &ldquo;no&rdquo; is an unresolved defect in that quote, regardless of
            the price.
          </p>
          <ol className="fw-criteria">
            {PILLARS.map((p) => (
              <li key={p.id} className="fw-criterion">
                <div className="fw-criterion-head">
                  <span className="fw-id">{p.number}</span>
                </div>
                <p className="fw-question">
                  <Link href={`/framework#${p.id}`}>{p.name}</Link>
                </p>
                <p className="fw-risk">{p.intent}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="tlx-section" aria-label="Services">
        <div className="shell">
          <p className="tlx-kicker">What we do</p>
          <h2 className="tlx-h2">Services</h2>
          <div className="tlx-grid">
            {SERVICES.map((s) => (
              <Link key={s.slug} className="tlx-card" href={`/services/${s.slug}`}>
                <h3>{s.name}</h3>
                <p>{s.blurb}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <EvidenceRail
        heading="Four Toronto jobs, written up in full"
        intro={
          'Every one publishes the readings taken before the work started, not only the ' +
          'photograph taken after it finished. That is the difference between a portfolio and ' +
          'evidence, and it is the same difference the Well-Installed Framework asks you to look ' +
          'for in any quote.'
        }
        items={[
          { ...CASES.distillery, why: 'A condo over a concrete slab. The moisture test decided the entire assembly, before a species was chosen.' },
          { ...CASES.rosedale, why: 'Stairs and a main floor over radiant heat, where the two assemblies move differently and had to finish to the same colour.' },
          { ...CASES.forestHill, why: 'Wide-plank walnut, and how the colour was kept uniform across boards that age photochemically.' },
          { ...CASES.midtown, why: 'Three storeys, three different substrates, one continuous floor. The hardest kind of match there is.' },
        ]}
      />

      <section className="tlx-section" aria-label="Decide before you call">
        <div className="shell">
          <p className="tlx-kicker">The three questions that move the price</p>
          <h2 className="tlx-h2">What you should settle before anyone quotes</h2>
          <p className="tlx-note">
            Each of these is published free, in full, with the reasoning rather than a
            recommendation: <Link href="/guides/solid-vs-engineered-hardwood-toronto">solid or
            engineered</Link> (the substrate decides it, not the budget),{' '}
            <Link href="/guides/hardwood-flooring-cost-toronto">what actually moves a quote inside
            the bands above</Link>, and{' '}
            <Link href="/guides/how-to-choose-hardwood-contractor-toronto">how to choose a
            contractor in this market</Link>. If your floor is already cupping, gapping or lifting,
            start at{' '}
            <Link href="/hardwood-floor-problems-toronto">what your floor is telling you</Link>{' '}
            instead — that is a diagnosis, not a purchase.
          </p>
        </div>
      </section>

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

      <section className="tlx-section" aria-label="Where we work">
        <div className="shell">
          <p className="tlx-kicker">Coverage</p>
          <h2 className="tlx-h2">{SERVICE_AREAS.length} areas across Toronto and the GTA</h2>
          <p className="tlx-note">
            Each area has its own page describing the housing stock there and what it means for a
            floor — a 1920s semi in Leslieville and a 2018 slab condo downtown are different jobs.
          </p>
          <div className="area-links">
            {SERVICE_AREAS.map((c) => (
              <Link key={c.slug} href={`/service-areas/${c.slug}`}>
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </section>
      <FeedbackBand topic="this page" estimateHref="#estimate" />
    </div>
  );
}
