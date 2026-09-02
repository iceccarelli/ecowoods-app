import type { Metadata } from 'next';
import { ProofSliderForRoute } from '@/app/components/ProofSliderForRoute';
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
  title: 'Commercial Hardwood Flooring Toronto — Condo Boards, Property Managers, HOAs',
  description: `Hardwood installation and refinishing for condo corporations, property managers and commercial spaces across Toronto and the GTA. After-hours work, certificate of insurance on request, ${band('fullSandAndFinish')} per square foot for a full sand and finish. Fixed written price.`,
  alternates: { canonical: '/commercial' },
  openGraph: {
    title: 'Commercial Hardwood Flooring Toronto — Ecowoods',
    description: `Corridors, lobbies, amenity rooms and unit turnovers. Salaried crews, after-hours scheduling, COI on request. Serving ${SERVICE_AREAS.length} areas.`,
    type: 'website',
    url: `${SITE_URL}/commercial`,
  },
};

/**
 * /commercial — the buyer who is not a homeowner.
 *
 * WHY THIS PAGE EXISTS AS ITS OWN URL
 *
 * A property manager and a homeowner are not the same customer having the same
 * conversation at different volumes. The homeowner is spending their own money
 * once and is afraid of dust and of being lied to. The manager is spending
 * somebody else's money repeatedly, is answerable to a board, and is afraid of
 * three completely different things: a corridor that cannot be closed during
 * the day, an insurance certificate that does not name the corporation, and a
 * price that moves after a budget was approved at a meeting.
 *
 * None of the existing pages answer any of those. Every one of them is a
 * documented, published commitment this business already makes — after-hours
 * scheduling, salaried crews rather than subcontractors, and a fixed written
 * price — so the page is a rearrangement of true things for a reader nobody had
 * arranged them for, not a new claim.
 *
 * The commercial buyer is also the highest-value one in this market: one condo
 * corporation is a decade of unit turnovers, and they are won by being the
 * company whose paperwork is already in order.
 *
 * NOTHING HERE INVENTS A CREDENTIAL. There is no WSIB number, no COI PDF and
 * no client logo on this page, because none of those exist in this repository.
 * The certificate is offered on request — which is how it actually works — and
 * `verify-conversion` fails the build if a page advertises a PDF that is not
 * there.
 */

const FAQS = [
  {
    question: 'Can the work be done outside business hours?',
    answer:
      'Yes. Corridors, lobbies and amenity rooms are routinely sanded and finished on an evening ' +
      'or weekend schedule so the space is usable during the day. Because the crews are salaried ' +
      'Ecowoods employees rather than subcontractors, an after-hours schedule is a rota decision ' +
      'rather than a subcontractor negotiation, and it does not change the written price.',
  },
  {
    question: 'Will you provide a certificate of insurance naming the corporation?',
    answer:
      'Yes — request it with your estimate and it is issued naming the condominium corporation or ' +
      'property owner as required. It is provided on request rather than published here, because ' +
      'a certificate is issued to a named party for a named project and a generic copy on a ' +
      'website is not the document your board needs on file.',
  },
  {
    question: 'How is a commercial hardwood job priced?',
    answer:
      `The same published bands apply: ${band('screenAndRecoat')} per square foot for a screen and ` +
      `recoat, ${band('fullSandAndFinish')} for a full sand and finish, and ${band('newInstall')} ` +
      `for new hardwood supplied and installed. ${PRICE_PROMISE} For a multi-unit or phased ` +
      'programme the estimate itemises each area so a board can approve it line by line.',
  },
  {
    question: 'Do you work on occupied buildings?',
    answer:
      'Yes. Extraction runs at the machine and containment is built at the room, which is what ' +
      'makes it possible to refinish a corridor in a building nobody has moved out of. Residents ' +
      'keep using the space on either side of the work zone, and the containment is rebuilt at the ' +
      'end of each shift rather than left standing across a weekend.',
  },
  {
    question: 'Can you handle unit turnovers on a recurring basis?',
    answer:
      'Yes, and it is the work this business is structured for: salaried crews mean the same people ' +
      'return to a building they already know, and a screen and recoat between tenancies at ' +
      `${band('screenAndRecoat')} per square foot is a fraction of the cost of a full sand and ` +
      'finish deferred until the floor is past saving.',
  },
];

export default function CommercialPage() {
  const url = `${SITE_URL}/commercial`;
  return (
    <div className="tlx-page">
      <ProofSliderForRoute route="/commercial" />
      <SchemaScript schema={buildFAQPage(FAQS.map((f) => ({ question: f.question, answer: f.answer })))} />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Commercial', url },
        ])}
      />
      <SchemaScript
        schema={buildCommercialLandingSchema({
          url,
          serviceSlugs: ['floor-refinishing', 'dust-free-sanding', 'hardwood-installation', 'floor-restoration'],
          description:
            'Hardwood flooring for condominium corporations, property managers and commercial spaces in Toronto and the GTA.',
        })}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>Commercial</span>
          </nav>
          <h1 className="tlx-title">Hardwood for buildings, not just houses</h1>
          <p className="tlx-lede">
            Corridors, lobbies, amenity rooms and unit turnovers, for condominium corporations,
            property managers and commercial tenants across Toronto and the GTA. Work scheduled
            around the people who use the space, a certificate of insurance naming your corporation,
            and one written price that a board can approve and hold us to.
          </p>
          <p className="fw-meta">
            Salaried crews, never subcontractors · HEPA-sealed containment · Fixed price in writing
          </p>
          <div className="fw-actions">
            <a className="fw-cta" href="#estimate">
              Request a commercial estimate
            </a>
            <a className="fw-cta fw-cta--ghost" href={BUSINESS_NAP.phoneHref}>
              Call {BUSINESS_NAP.phoneDisplay}
            </a>
          </div>
        </div>
      </header>

      <section className="tlx-section" aria-label="After-hours protocol">
        <div className="shell">
          <p className="tlx-kicker">Scheduling</p>
          <h2 className="tlx-h2">The after-hours protocol</h2>
          <p className="tlx-note" style={{ maxWidth: '48rem' }}>
            A corridor cannot be closed for a week, and a lobby cannot be closed at all. The
            sequence below is how the work happens around a building that stays in use — it is the
            same four-machine sequence published in{' '}
            <Link href="/papers/hardwood-refinishing-machines-and-sequence">the refinishing paper</Link>,
            scheduled differently.
          </p>
          <ol className="fw-criteria">
            <li>
              <strong>Walk and measure with the manager, not just the floor.</strong> Access routes,
              elevator protection, waste path, power, and where residents will actually walk while a
              section is closed.
            </li>
            <li>
              <strong>One written price, itemised by area.</strong> Each corridor, floor or unit is
              its own line so a board can approve a phase rather than a total.
            </li>
            <li>
              <strong>Certificate of insurance issued to the corporation.</strong> Named party,
              named project, on file before the first machine arrives.
            </li>
            <li>
              <strong>Containment built and struck each shift.</strong> Extraction at the machine,
              a sealed barrier at the work zone, and the space handed back usable at the end of
              every session rather than at the end of the job.
            </li>
            <li>
              <strong>Notice you can post.</strong> Dates, hours and which section is affected, in
              writing, in a form that can go on a noticeboard or into a resident email.
            </li>
          </ol>
        </div>
      </section>

      <section className="tlx-section" aria-label="Certificate of insurance">
        <div className="shell">
          <div className="tlx-cta">
            <h2>Certificate of insurance</h2>
            <p>
              Issued naming your condominium corporation or property owner, for the specific
              project, and provided with the estimate on request. It is not published as a download
              here on purpose: a certificate names a party and a project, and a generic copy is not
              the document your board needs on file.
            </p>
            <a className="btn btn-copper" href="#estimate">
              Request the certificate with your estimate
            </a>
          </div>
        </div>
      </section>

      <section className="tlx-section" aria-label="What it costs">
        <div className="shell">
          <p className="tlx-kicker">Price</p>
          <h2 className="tlx-h2">The same published bands, itemised by area</h2>
          <p className="tlx-note">{PRICE_PROMISE}</p>
          {/* role + tabIndex + a name, like every other wp-table-wrap in the app.
              Measured by pnpm audit:rendered: this one scrolls 278→307px on a phone
              and held nothing focusable, so the only way to read the right-hand
              columns was to drag it with a finger. Eight of the nine wrappers had
              this; this one did not. */}
          <div className="wp-table-wrap" role="region" tabIndex={0} aria-label="Published bands by area">
            <table className="wp-table">
              <caption>Published bands, Canadian dollars per square foot</caption>
              <thead>
                <tr>
                  <th scope="col">Work</th>
                  <th scope="col">Band</th>
                  <th scope="col">Where it fits in a building</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{PRICING.screenAndRecoat.label}</th>
                  <td>{band('screenAndRecoat')}</td>
                  <td>Unit turnovers and corridors where the finish is worn but the wood is sound</td>
                </tr>
                <tr>
                  <th scope="row">{PRICING.fullSandAndFinish.label}</th>
                  <td>{band('fullSandAndFinish')}</td>
                  <td>Lobbies and amenity floors that have gone past a recoat</td>
                </tr>
                <tr>
                  <th scope="row">{PRICING.newInstall.label}</th>
                  <td>{band('newInstall')}</td>
                  <td>New hardwood supplied and installed in a renovation or conversion</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="tlx-note">
            What moves the number in a building rather than a house: elevator and access time,
            after-hours scheduling, subfloor condition across a whole floorplate, and how much of
            the work has to be phased. Subfloor is the one that most often breaks a budget approved
            at a meeting —{' '}
            <Link href="/case-studies/distillery-district-victorian-condo">
              the Distillery District condo
            </Link>{' '}
            is a published example of what a slab reading changes before a single board is ordered.
            Every one of those is walked with you before the price is written — see{' '}
            <Link href="/guides/hardwood-flooring-cost-toronto">what a hardwood floor costs in Toronto</Link>{' '}
            and{' '}
            <Link href="/guides/how-to-evaluate-a-hardwood-quote">how to evaluate a hardwood quote</Link>.
          </p>
        </div>
      </section>

      <JobCardRail
        kicker="Finished work"
        heading="Jobs at building scale"
        intro="Published in full, with the readings taken before anything started."
        jobs={jobCardsBySlug(
          'midtown-townhouse-three-level-transition',
          'rosedale-estate-stairs-radiant-heat',
          'distillery-district-victorian-condo',
        )}
        from="commercial"
      />

      <section className="tlx-section" aria-label="How this work is judged">
        <div className="shell">
          <p className="tlx-kicker">Accountability</p>
          <h2 className="tlx-h2">Score us the way you would score anyone</h2>
          <p className="tlx-note" style={{ maxWidth: '48rem' }}>
            Boards ask for three quotes and then have no method for comparing them. The{' '}
            <Link href="/framework">Well-Installed Framework</Link> is twenty-seven criteria across
            six pillars, every one sourced to a paper published on this site, and it is designed to
            be run against any contractor — including this one. Take it into the meeting.
          </p>
          <div className="fw-actions">
            <Link className="fw-cta" href="/framework/assess">
              Score a quote you already have
            </Link>
            <Link className="fw-cta fw-cta--ghost" href="/case-studies/yorkville-loft-basement-conversion-moisture-mitigation">
              Read a job with its readings
            </Link>
          </div>
        </div>
      </section>

      <section className="tlx-section" aria-label="Services">
        <div className="shell">
          <p className="tlx-kicker">Services</p>
          <h2 className="tlx-h2">What gets specified in a building</h2>
          <div className="tlx-grid">
            <Link className="tlx-card" href="/services/floor-refinishing">
              <span className="tlx-card-tag">Service</span>
              <h3>Hardwood floor refinishing</h3>
              <p>Corridors and lobbies taken back to bare wood and rebuilt, in phases if required.</p>
            </Link>
            <Link className="tlx-card" href="/services/dust-free-sanding">
              <span className="tlx-card-tag">Service</span>
              <h3>Dust-free sanding</h3>
              <p>Extraction at the machine and containment at the room — what makes an occupied building possible.</p>
            </Link>
            <Link className="tlx-card" href="/services/hardwood-installation">
              <span className="tlx-card-tag">Service</span>
              <h3>Hardwood installation</h3>
              <p>New floors in conversions, amenity rooms and renovated units.</p>
            </Link>
            <Link className="tlx-card" href="/services/floor-restoration">
              <span className="tlx-card-tag">Service</span>
              <h3>Floor restoration</h3>
              <p>Water damage, board replacement and heritage repair where replacement is not the answer.</p>
            </Link>
          </div>
        </div>
      </section>

      <section className="tlx-section" id="estimate-block" aria-label="Request a commercial estimate">
        <div className="shell">
          <p className="tlx-kicker">Next step</p>
          <h2 className="tlx-h2">Request a commercial estimate</h2>
          <p className="tlx-note" style={{ maxWidth: '46rem' }}>
            Tell us the building and what needs doing. A senior estimator walks it with you, and the
            written price that follows is itemised by area so it can be taken to a board. Ask for the
            certificate of insurance in the notes and it comes with the estimate.
          </p>
          <EstimateForm
            source="commercial"
            service="commercial"
            heading="Commercial estimate request"
            intro="Corridors, lobbies, amenity rooms, unit turnovers. Itemised by area, fixed in writing."
          />
        </div>
      </section>

      <section className="tlx-section" aria-label="Questions">
        <div className="shell">
          <p className="tlx-kicker">Questions</p>
          <h2 className="tlx-h2">What managers and boards ask first</h2>
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

      <FeedbackBand topic="commercial work" estimateHref="#estimate" />
    </div>
  );
}
