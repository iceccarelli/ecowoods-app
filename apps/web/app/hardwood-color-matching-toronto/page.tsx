import type { Metadata } from 'next';
import Link from 'next/link';
import { BUSINESS_NAP, yearsInBusiness } from '@ecowoods/shared/constants';
import { SITE_URL, SERVICES } from '@/lib/seo-data';
import { getGuides } from '@/lib/guides';
import { buildBreadcrumbList, buildFAQPage } from '@/lib/schema/builders';
import { buildCommercialLandingSchema } from '@/lib/schema/commercial';
import { SchemaScript } from '@/lib/schema/components';
import { EvidenceRail, CASES } from '../components/EvidenceRail';
import { CatalogueRail } from '../components/CatalogueRail';
import { FeedbackBand } from '../components/FeedbackBand';
import { EstimateForm } from '../components/EstimateForm';
import { illustrationImage } from '@/app/data/illustration-images';

const CANONICAL = '/hardwood-color-matching-toronto';

export const metadata: Metadata = {
  title: 'Hardwood Colour Matching in Toronto — Process, Not Guesswork',
  description:
    'Professional colour matching and finish identification for hardwood floors, stairs, railings and trim in Toronto — the process, what is measured on site, and what we will not fake.',
  alternates: { canonical: CANONICAL, types: { 'text/markdown': `${CANONICAL}.md` } },
  openGraph: {
    images: [{ url: illustrationImage('og-refinishing')?.src ?? '/illustrations/og-refinishing.webp', width: 1200, height: 630 }],
    title: 'Hardwood colour matching in Toronto — Ecowoods Inc.',
    description: 'Colour identification, stain matching, and stair/railing/trim coordination — the process, published.',
    type: 'website',
    url: `${SITE_URL}${CANONICAL}`,
  },
};

/**
 * /hardwood-color-matching-toronto
 *
 * WHAT THIS PAGE IS, AND WHAT IT REFUSES
 *
 * A real authority hub for a real trade problem: matching a stain, a patch of
 * new hardwood, or a stair and railing to a floor that already exists. It is
 * not a doorway page — the eight guides it links to are unique, separately
 * addressable content at /guides, each carrying its own sourced citations
 * under scripts/verify-framework.mjs, and this page is the index and the CTA,
 * not a duplicate of any of them.
 *
 * It refuses: a genAI stain preview (Floor Studio never generates a floor —
 * see /floor-studio), an invented Janka number, a fabricated tenure or
 * certification for Francisco Oller, and any "colour match guaranteed" claim
 * this business cannot stand behind on every floor, because condo lighting and
 * an already-ambered finish are real variables this page states rather than
 * hides.
 */
const FAQS = [
  {
    question: 'Does Ecowoods do professional hardwood colour matching in Toronto?',
    answer:
      `Yes. Colour identification, stain matching to an existing floor, patching new hardwood into old, and ` +
      `stair, railing and trim coordination are part of ${BUSINESS_NAP.name}'s refinishing and restoration ` +
      `work, led by Francisco Oller. It is a process built on sample boards checked in your own room, not a ` +
      `guarantee that any two floors can be made identical.`,
  },
  {
    question: 'How do you match new hardwood to my existing floor?',
    answer:
      `By identifying the existing finish first, confirming the species and board width still match, then ` +
      `building a stain sample against a cut-off of the actual material and checking it against your floor, ` +
      `in your own lighting, before any coats go on the full area. The full process is at ` +
      `${SITE_URL}/guides/matching-new-hardwood-to-old-toronto.`,
  },
  {
    question: 'Can you guarantee a perfect colour match?',
    answer:
      `No, and we will not tell you otherwise. An existing floor has aged under its finish for years; a new ` +
      `sample has not. The honest target is a match confirmed in your room, under your actual lighting, that ` +
      `reads as one floor — see when a colour match fails, full sand and refinish vs replace, for what happens ` +
      `when a spot match cannot be made to work.`,
  },
  {
    question: 'Who does the colour matching work?',
    answer:
      `Francisco Oller, owner of ${BUSINESS_NAP.name} and the ecowoods.ca domain, and the company's ` +
      `professional contractor and lead craftsman in Toronto and the GTA. His scope and the sourcing ` +
      `behind it are published at ${SITE_URL}/team.`,
  },
  {
    question: 'Why does my hardwood floor colour look different in different rooms?',
    answer:
      `Most often lighting, not the stain. Many renovated Toronto condos mix daylight with LED pot lighting at ` +
      `a different colour temperature than older fixtures, and that shifts how the same stain reads room to ` +
      `room. Sample boards and sign-off happen in the room the work is actually done in — see sample boards, ` +
      `on-site trials, and sign-off before coats.`,
  },
];

const CHILD_GUIDES = [
  'color-identification-existing-hardwood-finish',
  'stain-matching-existing-hardwood-floor-toronto',
  'matching-new-hardwood-to-old-toronto',
  'stair-railing-trim-color-matching-toronto',
  'door-woodwork-finish-coordination-toronto',
  'when-color-match-fails-full-sand-vs-replace',
  'sample-boards-on-site-trials-sign-off',
  'species-undertone-guide-color-matching-toronto',
];

export default function HardwoodColorMatchingTorontoPage() {
  const guides = getGuides();
  const childGuides = CHILD_GUIDES.map((slug) => guides.find((g) => g.slug === slug)).filter(
    (g): g is NonNullable<typeof g> => Boolean(g),
  );

  return (
    <div className="tlx-page">
      <SchemaScript schema={buildFAQPage(FAQS)} />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Colour matching', url: `${SITE_URL}${CANONICAL}` },
        ])}
      />
      <SchemaScript
        schema={buildCommercialLandingSchema({
          url: `${SITE_URL}${CANONICAL}`,
          serviceSlugs: ['floor-restoration', 'floor-refinishing', 'hardwood-installation', 'stair-refinishing'],
          description: 'Professional hardwood colour matching and finish identification in Toronto and the GTA',
        })}
      />
      <SchemaScript
        schema={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${SITE_URL}${CANONICAL}#webpage`,
          url: `${SITE_URL}${CANONICAL}`,
          name: 'Hardwood colour matching in Toronto',
          inLanguage: 'en-CA',
          isPartOf: { '@id': `${SITE_URL}/#website` },
          about: { '@id': `${SITE_URL}/#organization` },
          mainEntity: { '@id': `${SITE_URL}/#organization` },
        }}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>Colour matching</span>
          </nav>
          <p className="tlx-kicker">Colour matching &amp; finish identification · Toronto and the GTA</p>
          <h1 className="tlx-title">Hardwood colour matching, done as a process, not a promise</h1>
          <p className="tlx-lede">
            Matching a stain to an existing floor, patching new hardwood into old, or coordinating stairs,
            railings, doors and trim to the floor they meet — {BUSINESS_NAP.name} identifies the existing
            finish, builds the sample against the real material, and checks it in your own room before a
            single coat goes on the full area. Led by Francisco Oller, owner and lead craftsman.
          </p>
          <p className="fw-meta">
            <span>Established {BUSINESS_NAP.foundedYear}</span>
            <span aria-hidden="true">·</span>
            <span>{yearsInBusiness()} years</span>
            <span aria-hidden="true">·</span>
            <span>Salaried crew, no subcontractors</span>
          </p>
          <div className="fw-actions">
            <Link className="fw-cta" href="#estimate">
              Get a fixed written price →
            </Link>
            <Link className="fw-cta fw-cta--ghost" href="/team#francisco-oller">
              Meet Francisco Oller
            </Link>
          </div>
        </div>
      </header>

      <section className="tlx-section" aria-label="Request an estimate">
        <div className="shell">
          <EstimateForm
            source="hardwood-color-matching-toronto"
            service="refinishing"
            heading="Get a colour match assessed"
            intro="Tell us what you're matching — a patch, a stair, a whole room — and we'll book the in-home look before any sample is mixed."
          />
        </div>
      </section>

      <section className="tlx-section" aria-label="The process">
        <div className="shell">
          <p className="tlx-kicker">What actually happens on site</p>
          <h2 className="tlx-h2">The process, in order</h2>
          <ol className="fw-criteria">
            <li className="fw-criterion">
              <div className="fw-criterion-head">
                <span className="fw-id">1</span>
              </div>
              <p className="fw-question">Identify what is already there</p>
              <p className="fw-risk">
                Species, stain (if any), and finish type — oil-based film, water-based film, or a penetrating
                oil — before anything is proposed.{' '}
                <Link href="/guides/color-identification-existing-hardwood-finish">Read the full process</Link>.
              </p>
            </li>
            <li className="fw-criterion">
              <div className="fw-criterion-head">
                <span className="fw-id">2</span>
              </div>
              <p className="fw-question">Build the sample against the real material</p>
              <p className="fw-risk">
                A cut-off of the actual board, species or trim — never a generic chip —
                stained and checked against the target.
              </p>
            </li>
            <li className="fw-criterion">
              <div className="fw-criterion-head">
                <span className="fw-id">3</span>
              </div>
              <p className="fw-question">Sign off in your room, under your light</p>
              <p className="fw-risk">
                Toronto condo lighting mixes daylight and LED colour temperatures that can shift how a stain
                reads. Approval happens in the room, not in a workshop.{' '}
                <Link href="/guides/sample-boards-on-site-trials-sign-off">How sign-off works</Link>.
              </p>
            </li>
            <li className="fw-criterion">
              <div className="fw-criterion-head">
                <span className="fw-id">4</span>
              </div>
              <p className="fw-question">Say plainly when it will not work</p>
              <p className="fw-risk">
                Sometimes a spot match cannot be made to disappear.{' '}
                <Link href="/guides/when-color-match-fails-full-sand-vs-replace">
                  What happens next, and what it costs
                </Link>
                .
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section className="tlx-section" aria-label="What this page will not do">
        <div className="shell">
          <p className="tlx-kicker">Said plainly</p>
          <h2 className="tlx-h2">What we will not fake</h2>
          <p className="tlx-note">
            No generative image of a stain result — Floor Studio renders real, buyable catalogue configurations
            and generates nothing (see <Link href="/floor-studio">/floor-studio</Link>). No invented hardness
            or grading figures beyond what the species dossiers already publish. No guaranteed &ldquo;exact
            match&rdquo; on an already-aged floor — the sample-board process above is what we commit to
            instead, and it is checked in your room before any coat is final.
          </p>
        </div>
      </section>

      <section className="tlx-section" aria-label="The eight published guides">
        <div className="shell">
          <p className="tlx-kicker">Read the process in full</p>
          <h2 className="tlx-h2">Eight guides, each answering one part of the problem</h2>
          <div className="tlx-grid">
            {childGuides.map((g) => (
              <Link key={g.slug} className="tlx-card" href={`/guides/${g.slug}`}>
                <span className="tlx-card-tag">{g.kind === 'decision' ? 'Decision guide' : 'Reference'}</span>
                <h3>{g.title}</h3>
                <p>{g.summary}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="tlx-section" aria-label="Where this connects on the site">
        <div className="shell">
          <p className="tlx-kicker">Related</p>
          <h2 className="tlx-h2">Where colour matching fits</h2>
          <p className="tlx-note">
            Colour matching is part of{' '}
            <Link href="/services/floor-restoration">{SERVICES.find((s) => s.slug === 'floor-restoration')?.name}</Link>{' '}
            and comes up on most{' '}
            <Link href="/services/floor-refinishing">refinishing</Link> and{' '}
            <Link href="/services/stair-refinishing">stair refinishing</Link> jobs. Designing a whole new floor
            instead? <Link href="/floor-studio">See it in your own room, free</Link>, or read{' '}
            <Link href="/framework">the standard the work is judged against</Link>.
          </p>
        </div>
      </section>

      <EvidenceRail
        heading="Colour matching on real jobs"
        intro="Measured readings, not only a photograph after — the same evidence the framework asks any quote to carry."
        items={[
          { ...CASES.forestHill, why: 'Wide-plank walnut in Forest Hill, and how the colour was kept uniform across boards that age photochemically.' },
          { ...CASES.midtown, why: 'A midtown townhouse across three levels, where the floor had to read as one colour from the basement stair to the top landing.' },
        ]}
      />

      <section className="tlx-section" aria-label="Frequently asked questions">
        <div className="shell">
          <p className="tlx-kicker">Straight answers</p>
          <h2 className="tlx-h2">Questions people ask about colour matching</h2>
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

      <CatalogueRail route={CANONICAL} />
      <FeedbackBand topic="colour matching" estimateHref="#estimate" />
    </div>
  );
}
