import type { Metadata } from 'next';
import Link from 'next/link';
import { FeedbackBand } from '../components/FeedbackBand';
import { EstimateForm } from '../components/EstimateForm';
import { JobCardRail } from '../components/JobCard';
import { jobCardsBySlug } from '@/content/job-cards';
import { BUSINESS_NAP, BUSINESS_ADDRESS_LINE, HOURS_LINE } from '@ecowoods/shared/constants';
import { SITE_URL, SERVICE_AREAS } from '@/lib/seo-data';
import { PRICING, PRICE_PROMISE } from '@/lib/pricing';
import { buildBreadcrumbList, buildFAQPage } from '@/lib/schema/builders';
import { buildCommercialLandingSchema } from '@/lib/schema/commercial';
import { SchemaScript } from '@/lib/schema/components';

const money = (n: number) => `$${n.toFixed(2)}`;
const band = (k: keyof typeof PRICING) => `${money(PRICING[k].min)}–${money(PRICING[k].max)}`;

export const metadata: Metadata = {
  // No brand in the title: the root layout's template appends ' · Ecowoods'
  // to every page title, and verify-canonical fails the build on the double.
  title: 'Pre-List Floor Recoat for Realtors in Toronto',
  description: `A three-day screen and recoat before a listing goes live, at ${band('screenAndRecoat')} per square foot. Tired floors photograph badly and cost more at the offer table than they cost to fix. Fixed written price for realtors across Toronto and the GTA.`,
  alternates: { canonical: '/realtors' },
  openGraph: {
    title: 'Pre-list floor recoat for realtors — Ecowoods',
    description: `Screen and recoat at ${band('screenAndRecoat')} per square foot, scheduled around a listing date. Serving ${SERVICE_AREAS.length} areas.`,
    type: 'website',
    url: `${SITE_URL}/realtors`,
  },
};

/**
 * /realtors — the referral channel, addressed in its own language.
 *
 * WHY THIS IS A PAGE AND NOT A PARAGRAPH SOMEWHERE
 *
 * A realtor is not buying a floor. They are buying a listing photograph, a
 * showing that does not stall in the hallway, and a schedule that does not
 * move. Those are the three things this page answers, and none of them is what
 * a homeowner page argues about.
 *
 * Commercially it is the highest-leverage relationship available to a flooring
 * contractor: one agent lists ten houses a year, every one of them has floors,
 * and the decision is made once — about the contractor — rather than ten times.
 * It is also the least contested surface in this market, because competitors
 * write for homeowners.
 *
 * THE OFFER IS THE EXISTING SCREEN-AND-RECOAT BAND. Nothing is discounted,
 * invented or bundled: a screen and recoat is already the cheapest intervention
 * this business publishes, and a pre-list floor is exactly the case it fits —
 * worn finish, sound wood, a deadline. No new price appears on this page.
 *
 * NO PDF IS ADVERTISED. The one-pager is this page, printed: the print rules
 * in globals.css drop the site chrome so an agent can hand a seller a clean
 * sheet from the browser. Advertising a download that does not exist fails
 * verify-conversion, and rightly.
 */

const FAQS = [
  {
    question: 'How long does a pre-list recoat take?',
    answer:
      'Three working days is the normal shape: one to abrade and clean, one to coat, one to cure ' +
      'before furniture and photography. It is scheduled backwards from your listing date rather ' +
      'than forwards from ours, and the written price does not change if the date moves.',
  },
  {
    question: 'What does a pre-list recoat cost?',
    answer:
      `A screen and recoat runs ${band('screenAndRecoat')} per square foot. ${PRICE_PROMISE} ` +
      'If the wood underneath is damaged rather than the finish worn, a recoat is the wrong work ' +
      `and we will say so — that is a full sand and finish at ${band('fullSandAndFinish')}, and ` +
      'it is a different conversation about whether it pays before a sale.',
  },
  {
    question: 'When is a recoat the wrong answer before a listing?',
    answer:
      'When the finish is worn through to bare wood in traffic lanes, when there is pet staining ' +
      'that has reached the wood, or when boards are cupped from a moisture problem that has not ' +
      'been fixed. A recoat over any of those looks worse in photographs than the floor did before, ' +
      'because a fresh sheen makes the damage underneath more visible rather than less.',
  },
  {
    question: 'Do you work to a firm closing or listing date?',
    answer:
      'Yes. The crews are salaried Ecowoods employees rather than subcontractors, which is the ' +
      'reason a date can be committed to at all — there is no third party whose other job can ' +
      'take precedence over yours the week before your photographer arrives.',
  },
];

export default function RealtorsPage() {
  const url = `${SITE_URL}/realtors`;
  return (
    <div className="tlx-page rl-page">
      <SchemaScript schema={buildFAQPage(FAQS.map((f) => ({ question: f.question, answer: f.answer })))} />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'For realtors', url },
        ])}
      />
      <SchemaScript
        schema={buildCommercialLandingSchema({
          url,
          serviceSlugs: ['floor-refinishing', 'dust-free-sanding'],
          description:
            'Pre-listing hardwood floor screen and recoat for realtors and sellers in Toronto and the GTA.',
        })}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>For realtors</span>
          </nav>
          <h1 className="tlx-title">The floor is in every photograph</h1>
          <p className="tlx-lede">
            A tired floor is the cheapest thing to fix before a listing and one of the most
            expensive to leave — it appears in every photograph, it is underfoot at every showing,
            and it is the first thing a buyer&rsquo;s agent points at. A three-day screen and recoat
            at {band('screenAndRecoat')} per square foot, scheduled backwards from your listing date.
          </p>
          <p className="fw-meta">
            Three working days · Fixed price in writing · Salaried crews, so the date holds
          </p>
          <div className="fw-actions">
            <a className="fw-cta" href="#estimate">
              Book a pre-list walkthrough
            </a>
            <a className="fw-cta fw-cta--ghost" href={BUSINESS_NAP.phoneHref}>
              Call {BUSINESS_NAP.phoneDisplay}
            </a>
          </div>
        </div>
      </header>

      <section className="tlx-section" aria-label="The three-day pre-list recoat">
        <div className="shell">
          <p className="tlx-kicker">The offer</p>
          <h2 className="tlx-h2">Three days, one price, before the photographer</h2>
          <ol className="fw-criteria">
            <li>
              <strong>Day one — abrade and clean.</strong> The existing finish is screened back so a
              new coat can key to it. No sanding to bare wood, so no dust event and no colour change.
            </li>
            <li>
              <strong>Day two — coat.</strong> Water-based finish, low odour, applied to the whole
              field so there is no visible boundary between traffic lanes and the rest of the room.
            </li>
            <li>
              <strong>Day three — cure before furniture.</strong> Walk-on in hours, furniture back on
              day three. Photography on day three or later, when the sheen has settled and stops
              flaring under a flash.
            </li>
          </ol>
          <p className="tlx-note">
            This is the published {PRICING.screenAndRecoat.label.toLowerCase()} band —{' '}
            {band('screenAndRecoat')} per square foot — not a promotional rate. {PRICE_PROMISE}
          </p>
        </div>
      </section>

      <section className="tlx-section" aria-label="When a recoat is the wrong work">
        <div className="shell">
          <p className="tlx-kicker">The honest limit</p>
          <h2 className="tlx-h2">When we will tell you not to do it</h2>
          <p className="tlx-note" style={{ maxWidth: '48rem' }}>
            A recoat renews a finish. It does not fix wood. If the finish is worn through in the
            traffic lanes, if pet staining has reached the boards, or if the floor is cupped from a
            moisture problem nobody has traced, a fresh coat makes the damage more visible in
            photographs rather than less — a new sheen reflects light across exactly the defects you
            were hoping to hide. In those cases the choice is a full sand and finish at{' '}
            {band('fullSandAndFinish')} per square foot, or leaving it and pricing the house
            accordingly. We will say which, before you spend anything.
          </p>
          <p className="tlx-note">
            What that judgement looks like on a real floor:{' '}
            <Link href="/case-studies/forest-hill-walnut-wide-plank-color-stability">
              the Forest Hill walnut job
            </Link>{' '}
            is a case where colour stability decided the finish schedule, and{' '}
            <Link href="/case-studies/midtown-townhouse-three-level-transition">
              the Midtown townhouse
            </Link>{' '}
            is one where three substrates in one house meant three different answers on three
            floors. Both publish what was measured before anyone quoted.
          </p>
          <p className="tlx-note">
            The mechanism behind cupping and finish wear is published in full:{' '}
            <Link href="/papers/toronto-hardwood-climate-moisture-protocol">
              the Toronto climate and moisture protocol
            </Link>
            , and{' '}
            <Link href="/guides/reference-refinishing-existing-hardwood">
              whether a floor can be refinished at all
            </Link>
            .
          </p>
        </div>
      </section>

      <JobCardRail
        kicker="Finished work"
        heading="What a finished floor looks like on paper"
        intro="Published case studies, with the readings taken before the work started."
        jobs={jobCardsBySlug(
          'forest-hill-walnut-wide-plank-color-stability',
          'midtown-townhouse-three-level-transition',
        )}
        from="realtors"
      />

      <section className="tlx-section" aria-label="Services">
        <div className="shell">
          <p className="tlx-kicker">Services</p>
          <h2 className="tlx-h2">What a seller might actually need</h2>
          <div className="tlx-grid">
            <Link className="tlx-card" href="/services/floor-refinishing">
              <span className="tlx-card-tag">Service</span>
              <h3>Refinishing</h3>
              <p>When a recoat is not enough and the floor has to go back to bare wood.</p>
            </Link>
            <Link className="tlx-card" href="/services/dust-free-sanding">
              <span className="tlx-card-tag">Service</span>
              <h3>Dust-free sanding</h3>
              <p>For an occupied house that is still being shown while the work happens.</p>
            </Link>
            <Link className="tlx-card" href="/services/stair-refinishing">
              <span className="tlx-card-tag">Service</span>
              <h3>Stairs</h3>
              <p>The one surface every visitor touches, and the one most listings leave alone.</p>
            </Link>
          </div>
          <p className="tlx-note">
            Deciding between them:{' '}
            <Link href="/guides/hardwood-flooring-cost-toronto">what it costs in Toronto</Link> and{' '}
            <Link href="/guides/how-to-choose-hardwood-contractor-toronto">
              how to choose a contractor
            </Link>{' '}
            — or run any quote, from anyone, through{' '}
            <Link href="/framework/assess">the twenty-seven criteria</Link>.
          </p>
        </div>
      </section>

      <section className="tlx-section" aria-label="Give this to your seller">
        <div className="shell">
          <div className="tlx-cta rl-print-cta">
            <h2>Give this to your seller</h2>
            <p>
              Print this page and it comes out as a clean one-pager — the three-day sequence, the
              published band, and when we would tell you not to bother. No download to chase, and
              nothing on it that is not also on this site.
            </p>
            <Link className="btn btn-copper" href="/case-studies">
              See the published jobs
            </Link>
          </div>
        </div>
      </section>

      <section className="tlx-section" id="estimate-block" aria-label="Book a pre-list walkthrough">
        <div className="shell">
          <p className="tlx-kicker">Next step</p>
          <h2 className="tlx-h2">Book a pre-list walkthrough</h2>
          <p className="tlx-note" style={{ maxWidth: '46rem' }}>
            Tell us the address and the listing date. A senior estimator walks the floor, tells you
            whether a recoat is the right work, and writes one price that does not move. Put the
            listing date in the notes and the schedule is built backwards from it.
          </p>
          <EstimateForm
            source="realtors"
            service="refinishing"
            heading="Pre-list walkthrough request"
            intro="Screen and recoat before a listing, scheduled to your date and fixed in writing."
          />
        </div>
      </section>

      <section className="tlx-section" aria-label="Questions">
        <div className="shell">
          <p className="tlx-kicker">Questions</p>
          <h2 className="tlx-h2">What agents ask first</h2>
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

      <section className="tlx-section" aria-label="Contact">
        <div className="shell">
          <div className="area-nap">
            <p className="area-nap-name">{BUSINESS_NAP.legalName}</p>
            <p>{BUSINESS_ADDRESS_LINE}</p>
            <p>
              <a href={BUSINESS_NAP.phoneHref}>{BUSINESS_NAP.phoneDisplay}</a>
              {' · '}
              <a href={`mailto:${BUSINESS_NAP.email}`}>{BUSINESS_NAP.email}</a>
            </p>
            <p className="area-nap-hours">{HOURS_LINE}</p>
          </div>
        </div>
      </section>

      <FeedbackBand topic="pre-list recoats" estimateHref="#estimate" />
    </div>
  );
}
