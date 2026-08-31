import type { Metadata } from 'next';
import { FeedbackBand } from '../components/FeedbackBand';
import { EstimateForm } from '../components/EstimateForm';
import Link from 'next/link';
import { BUSINESS_NAP, PRIMARY_REVIEW_EVIDENCE, TOTAL_REVIEWS_CITED } from '@ecowoods/shared/constants';
import { SITE_URL, SERVICE_AREAS } from '@/lib/seo-data';
import { PRICING, PRICE_PROMISE } from '@/lib/pricing';
import { getPaper } from '@/lib/papers';
import { buildBreadcrumbList, buildFAQPage } from '@/lib/schema/builders';
import { buildCommercialLandingSchema } from '@/lib/schema/commercial';
import { SchemaScript } from '@/lib/schema/components';
import { Illustration, IllustrationPair } from '../components/Illustration';
import { EvidenceRail, CASES } from '../components/EvidenceRail';
import { ProcessVideo } from '../components/ProcessVideo';

const money = (n: number) => `$${n.toFixed(2)}`;
const band = (k: keyof typeof PRICING) => `${money(PRICING[k].min)}–${money(PRICING[k].max)}`;
const CRAFT = 'hardwood-refinishing-machines-and-sequence';

export const metadata: Metadata = {
  title: 'Hardwood Floor Refinishing Toronto — Dust-Free Sanding, Fixed Written Price',
  description: `Hardwood floor refinishing and dust-free sanding across Toronto and the GTA. ${band('fullSandAndFinish')} per square foot for a full sand and finish, ${band('screenAndRecoat')} for a screen and recoat. The four-machine sequence is published in full.`,
  alternates: { canonical: '/hardwood-floor-refinishing-toronto' },
  openGraph: {
    title: 'Hardwood Floor Refinishing Toronto — Ecowoods',
    description: `Published prices, published machine sequence, HEPA containment so the house stays livable. Serving ${SERVICE_AREAS.length} areas.`,
    type: 'website',
    url: `${SITE_URL}/hardwood-floor-refinishing-toronto`,
  },
};

/**
 * /hardwood-floor-refinishing-toronto — the second head term.
 *
 * Refinishing and installation are different purchases with different searches,
 * different price bands and different anxieties. Someone searching to refinish
 * already owns the floor: their question is not "what should I buy" but "will
 * my house be full of dust and will it look worse than before". This page
 * answers those two, with the machine sequence that determines both.
 *
 * The technical argument is the four machines. Almost every bad refinish in
 * this city is a skipped planetary pass — the edger's work never blended into
 * the belt sander's field — and it is invisible on bare wood and permanent once
 * the finish goes on. That is worth a page because it is the thing a homeowner
 * cannot see when choosing, and can never unsee afterwards.
 *
 * Every figure interpolated. No aggregateRating.
 */
const FAQS = [
  {
    question: 'How much does it cost to refinish hardwood floors in Toronto?',
    answer:
      `A full sand and finish runs ${band('fullSandAndFinish')} per square foot. A screen and ` +
      `recoat — where the existing finish is worn but sound and the wood beneath is undamaged — ` +
      `runs ${band('screenAndRecoat')}. ${PRICE_PROMISE}`,
  },
  {
    question: 'What does dust-free sanding actually mean?',
    answer:
      `That the dust is captured at the tool and kept behind a barrier, not that no dust exists. ` +
      `Extraction runs from each machine to a sealed collector and the work area is separated from ` +
      `the rest of the house, which is what makes it possible to stay in the house while the floors ` +
      `are done. Cleanup afterwards addresses what settled; containment addresses what was breathed.`,
  },
  {
    question: 'Can I stay in my home during refinishing?',
    answer:
      `In most cases yes, with containment in place. The constraint is not dust but cure time on ` +
      `the finished rooms — a floor that has been walked on before its coat has cured is a floor ` +
      `that will be refinished again sooner than it should be.`,
  },
  {
    question: 'How many times can a hardwood floor be refinished?',
    answer:
      `Solid hardwood carries a generational wear layer and takes many cycles. Engineered flooring ` +
      `has a specified wear-layer thickness above its cross-ply core, and that thickness sets a ` +
      `hard limit. Which one you have is the first thing to establish, and it is visible in the ` +
      `board's edge.`,
  },
  {
    question: 'Why do refinished floors sometimes show a ring around the room?',
    answer:
      `Because the planetary pass was skipped. The belt sander levels the open field and the edger ` +
      `reaches the walls, and the two leave different surfaces. A third machine blends the boundary. ` +
      `Without it the difference is invisible on bare wood and permanent once the finish goes on — ` +
      `the edger halo. It is the single most common defect in this market.`,
  },
  {
    question: 'What reviews does Ecowoods have?',
    answer:
      `${TOTAL_REVIEWS_CITED} reviews at ${PRIMARY_REVIEW_EVIDENCE.rating.toFixed(1)} out of ` +
      `${PRIMARY_REVIEW_EVIDENCE.outOf} on ${PRIMARY_REVIEW_EVIDENCE.platform}, read from the live ` +
      `profile on ${PRIMARY_REVIEW_EVIDENCE.asOf}.`,
  },
];

export default function RefinishingTorontoPage() {
  const paper = getPaper(CRAFT);

  return (
    <div className="tlx-page">
      <SchemaScript schema={buildFAQPage(FAQS.map((f) => ({ question: f.question, answer: f.answer })))} />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          {
            name: 'Hardwood Floor Refinishing Toronto',
            url: `${SITE_URL}/hardwood-floor-refinishing-toronto`,
          },
        ])}
      />
      {/* Service + Offer + areaServed. The other three blocks describe the
          page; this one describes the transaction, which is what a commercial
          query is actually about. Prices derived from lib/pricing.ts — a
          service with no published band gets no Offer. */}
      <SchemaScript
        schema={buildCommercialLandingSchema({
          url: `${SITE_URL}/hardwood-floor-refinishing-toronto`,
          serviceSlugs: ['floor-refinishing', 'dust-free-sanding', 'floor-restoration', 'stair-refinishing'],
          description: 'Hardwood floor refinishing and dust-free sanding across Toronto and the GTA',
        })}
      />
      <SchemaScript
        schema={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${SITE_URL}/hardwood-floor-refinishing-toronto#webpage`,
          url: `${SITE_URL}/hardwood-floor-refinishing-toronto`,
          name: 'Hardwood Floor Refinishing Toronto',
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
            <span>Hardwood Floor Refinishing Toronto</span>
          </nav>
          <h1 className="tlx-title">Hardwood floor refinishing in Toronto</h1>
          <p className="tlx-lede">
            Your floor is already there. The two questions are whether the house will be livable
            while the work happens, and whether it will look right afterwards. Both are decided by
            the machine sequence, and ours is published.
          </p>
          <p className="fw-meta">
            <span>{PRICING.fullSandAndFinish.label} {band('fullSandAndFinish')}/sq ft</span>
            <span aria-hidden="true">·</span>
            <span>{PRICING.screenAndRecoat.label} {band('screenAndRecoat')}/sq ft</span>
            <span aria-hidden="true">·</span>
            <span>HEPA containment</span>
          </p>
          <div className="fw-actions">
            <Link className="fw-cta" href="#estimate">
              Get a fixed written price →
            </Link>
            <Link className="fw-cta fw-cta--ghost" href={`/papers/${CRAFT}`}>
              Read the machine sequence
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
          <EstimateForm source="hardwood-floor-refinishing-toronto" service="refinishing" heading="Get a fixed written price for your refinish" intro="Whether a screen and recoat will do, or the floor needs a full sand, is decided by looking at it. The measurement is free and the written price does not move afterwards." />
        </div>
      </section>

      <section className="tlx-section" aria-label="The four machines">
        <div className="shell">
          <p className="tlx-kicker">The whole job, in order</p>
          <h2 className="tlx-h2">Four machines, and why the order is not a preference</h2>
          <p className="tlx-note">
            The belt sander levels the open field. The edger reaches walls, baseboards, closets and
            stairs. The planetary sander blends the two together. The buffer prepares the surface and
            abrades between coats. Each removes what the one before it could not reach.
          </p>
          <Illustration id="fig-four-machines-roles" />
          <p className="tlx-note">
            Set out in full, with the grit progression, in{' '}
            <Link href={`/papers/${CRAFT}`}>{paper?.title ?? 'the refinishing paper'}</Link>.
          </p>
        </div>
      </section>

      <section className="tlx-section" aria-label="The most common defect">
        <div className="shell">
          <p className="tlx-kicker">What to look for in someone else&rsquo;s work</p>
          <h2 className="tlx-h2">The edger halo</h2>
          <p className="tlx-note">
            Skip the planetary pass and a band the width of a small machine runs around the whole
            room, reading as a different tone once the finish goes on. It is invisible on bare wood,
            which is exactly why it survives inspection, and permanent once coated. Ask any
            contractor which machines they use and in what order — the answer is short, and it tells
            you most of what you need to know.
          </p>
          <Illustration id="concept-edger-halo" />
        </div>
      </section>

      <section className="tlx-section" aria-label="Dust containment">
        <div className="shell">
          <p className="tlx-kicker">Living in the house</p>
          <h2 className="tlx-h2">What dust-free actually means</h2>
          <p className="tlx-note">
            Extraction at the tool, a sealed collector, and a barrier at the opening. Dust generated
            during sanding is respirable and travels through the whole building; cleanup afterwards
            addresses what settled, not what was breathed. Containment is a system, not a vacuum.
          </p>
          <Illustration id="term-hepa-containment" />
          {/* The film slot. Renders the poster and the two-sentence
              explanation until NEXT_PUBLIC_YOUTUBE_PROCESS_ID is set — see
              ProcessVideo. This is the page where "will my house be full of
              dust" is the whole objection, so it is the page the film belongs
              on. */}
          <ProcessVideo />
        </div>
      </section>

      <section className="tlx-section" aria-label="What this job actually is">
        <div className="shell">
          <p className="tlx-kicker">Three services, one decision</p>
          <h2 className="tlx-h2">Which of these your floor needs</h2>
          <IllustrationPair a="depth-three-refinishing-services" b="depth-three-refinishing-services-b" />
          <p className="tlx-note">
            <Link href="/services/floor-refinishing">Refinishing</Link> is the whole job: sand to
            bare wood, re-stain if the colour is changing, re-finish.{' '}
            <Link href="/services/dust-free-sanding">Dust-free sanding</Link> is the containment
            that decides whether you can stay in the house while it happens. And{' '}
            <Link href="/services/floor-restoration">restoration</Link> is what the job becomes when
            boards have to be replaced or a water event has to be undone first — a different scope,
            priced differently, and the reason the moisture readings are taken before the price is
            given rather than after. Stairs come with the floor more often than they are quoted with
            it: <Link href="/hardwood-stairs-toronto">how stairs are priced</Link>.
          </p>
          <p className="tlx-note">
            The two questions worth settling before anyone quotes:{' '}
            <Link href="/guides/reference-refinishing-existing-hardwood">
              what refinishing an existing floor actually involves
            </Link>{' '}
            — including how many sands a floor has left in it — and{' '}
            <Link href="/guides/dustless-hardwood-refinishing-toronto">
              what &ldquo;dustless&rdquo; is and is not
            </Link>
            . If the floor is cupping, gapping or lifting, it is not a refinishing job yet:{' '}
            <Link href="/hardwood-floor-problems-toronto">start with the diagnosis</Link>.
          </p>
        </div>
      </section>

      <EvidenceRail
        heading="Where this protocol has been run"
        intro={
          'Refinishing and installation share the same first step, which is why these jobs are the ' +
          'evidence for both: each one publishes what was measured before anything was sanded.'
        }
        items={[
          { ...CASES.yorkville, why: 'A below-grade slab at a critical moisture reading, and the mitigation that made the floor possible at all.' },
          { ...CASES.distillery, why: 'Historic loft over concrete. The dust containment and the finish chemistry were chosen together, not separately.' },
          { ...CASES.midtown, why: 'Three substrates in one house, matched across levels — the case where sanding sequence decides whether the join is visible.' },
        ]}
      />

      <section className="tlx-section" aria-label="Judging the quote">
        <div className="shell">
          <p className="tlx-kicker">Before you sign anything</p>
          <h2 className="tlx-h2">Put any refinishing quote against the published standard</h2>
          <p className="tlx-note">
            <Link href="/framework">The Well-Installed Framework</Link> is published free to use on
            any contractor in the GTA, including us. For a refinish the criteria that decide the
            outcome are which machines run in which order, whether the floor was measured before it
            was quoted, and whether depth above the tongue was checked at all —{' '}
            <Link href="/framework/assess">score a quote you already have</Link>.
          </p>
        </div>
      </section>

      <section className="tlx-section" aria-label="Frequently asked questions">
        <div className="shell">
          <p className="tlx-kicker">Straight answers</p>
          <h2 className="tlx-h2">Questions people actually ask</h2>
          <IllustrationPair a="wear-layer-refinish-budget" b="wear-layer-refinish-budget-b" />
          <dl className="gd-spec">
            {FAQS.map((f) => (
              <div className="gd-spec-row" key={f.question}>
                <dt>{f.question}</dt>
                <dd>{f.answer}</dd>
              </div>
            ))}
          </dl>
          <p className="tlx-note">
            {BUSINESS_NAP.legalName} works across {SERVICE_AREAS.length} areas in Toronto and the
            GTA. See <Link href="/hardwood-flooring-toronto">hardwood flooring in Toronto</Link> for
            new installation, or <Link href="/service-areas">the coverage list</Link>.
          </p>
        </div>
      </section>

      {/* COVERAGE, IN CONTENT — the same section the installation hub carries,
          and the asymmetry it removes was a real one. Both pages are money
          pages and both are entered from local queries, but only one of them
          named the places. This page reached the area pages through a single
          prose link; the other reached all {SERVICE_AREAS.length} of them by
          name. Refinishing is the more local of the two services — a screen and
          recoat is decided by the state of one existing floor in one house, not
          by a catalogue — so the page a homeowner in Leslieville lands on for
          "floor sanding Leslieville" should be one click from the page about
          Leslieville, in content, not through a footer.

          Derived from SERVICE_AREAS, so an added area adds its link here. Same
          .footer-links block the installation hub uses; no new CSS. */}
      <section className="tlx-section" aria-label="Where we refinish">
        <div className="shell">
          <p className="tlx-kicker">Coverage</p>
          <h2 className="tlx-h2">
            Hardwood floor refinishing across {SERVICE_AREAS.length} Toronto and GTA areas
          </h2>
          <p className="tlx-note">
            Each area has its own page describing the housing stock there and what it means for a
            refinish — original 1920s strip oak in Riverdale and a 2018 engineered floor over a
            downtown slab need different machines and different expectations.
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
      <FeedbackBand topic="this page" />
    </div>
  );
}
