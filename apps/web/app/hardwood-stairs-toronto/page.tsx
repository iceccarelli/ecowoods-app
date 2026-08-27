import type { Metadata } from 'next';
import Link from 'next/link';
import { BUSINESS_NAP, yearsInBusiness } from '@ecowoods/shared/constants';
import { SITE_URL, SERVICE_AREAS } from '@/lib/seo-data';
import { PRICING, PRICE_PROMISE } from '@/lib/pricing';
import { FRAMEWORK_NAME, FRAMEWORK_VERSION, criterionCount } from '@/lib/framework';
import { buildBreadcrumbList, buildFAQPage } from '@/lib/schema/builders';
import { buildCommercialLandingSchema } from '@/lib/schema/commercial';
import { SchemaScript } from '@/lib/schema/components';
import { CommercialHeadTermRail } from '../components/CommercialHeadTermRail';
import { EvidenceRail, CASES } from '../components/EvidenceRail';
import { IllustrationPair } from '../components/Illustration';

const money = (n: number) => `$${n.toFixed(2)}`;
const band = (k: keyof typeof PRICING) => `${money(PRICING[k].min)}–${money(PRICING[k].max)}`;

const URL = `${SITE_URL}/hardwood-stairs-toronto`;

export const metadata: Metadata = {
  title: 'Hardwood Stairs Toronto — Refinishing, Installation & How They Are Priced',
  description:
    'Hardwood stairs across Toronto and the GTA: refinishing, carpet removal, new treads and ' +
    'risers, matched to the floor they meet. Why stairs are quoted per tread rather than per ' +
    'square foot, what moves that number, and the standard the finished work is judged against.',
  alternates: { canonical: '/hardwood-stairs-toronto' },
  openGraph: {
    title: 'Hardwood Stairs Toronto — Ecowoods',
    description:
      'Treads, risers, nosings and stringers — the part of the job a floor quote usually ' +
      'prices as an afterthought. Fixed written price, salaried crews.',
    type: 'website',
    url: URL,
  },
};

/**
 * /hardwood-stairs-toronto — the one genuine gap in the commercial surface.
 *
 * WHY THIS PAGE AND NOT THIRTEEN
 *
 * The brief that produced this page asked for /stairs, /stairs-hardwood,
 * /stairs-flooring, /stairs-toronto, /stairs-sanding, /stairs-finishing,
 * /stairs-refinishing, /stairs-hard-wood, /stairs-install, /stairs-gta,
 * /toronto-stairs and /toronto-hardwood-stairs as separate pages. There is one
 * subject there, so there is one page here, and the other twelve slugs 301 to
 * it from `ROUTE_ALIASES` in content/search/topic-map.ts. The reasoning is
 * written out in that file's header; the short version is that twelve
 * near-identical pages are a doorway set under Google's published spam policy,
 * they split the link equity and crawl budget that one page concentrates, and
 * an answer engine deduplicates them into a single weak citation target before
 * it ranks anything. The 301 costs nothing and resolves for anyone who types
 * the variant.
 *
 * WHAT WAS ACTUALLY MISSING
 *
 * /services/stair-refinishing exists and is good, but it describes ONE service
 * on stairs. The query "hardwood stairs Toronto" is not asking for a service —
 * it is asking the whole question: my stairs are carpeted / worn / do not match
 * the new floor, what are the options, what does it cost, and who does it. No
 * page on this site answered that. This one does, and it hands off to the
 * service page for the refinishing detail.
 *
 * WHY THERE IS NO PER-TREAD PRICE ON THIS PAGE
 *
 * Because there is not one in content/constants/pricing.ts, and the entire
 * discipline of this repository is that a number reaches a customer from a
 * constant or it does not reach them at all. Stairs are genuinely priced per
 * tread and per flight rather than per square foot — the geometry, not the
 * area, is the work — and inventing a plausible band for this page would have
 * been the single most damaging thing it could do, because it is exactly the
 * figure an answer engine would quote back. So the page explains the unit, the
 * variables, and where the number comes from, and says the band is not
 * published yet. When the owner publishes one, it goes in the constants file
 * and appears here without this file being touched.
 */
const FAQS = [
  {
    question: 'How much does it cost to refinish hardwood stairs in Toronto?',
    answer:
      `Stairs are quoted per tread and per flight, not per square foot, because the work is ` +
      `geometry rather than area — every tread has a nosing, two return edges and a riser, and ` +
      `none of it can be reached by the machine that does the floor. Ecowoods does not publish a ` +
      `per-tread band, because a stair price that is honest depends on the count, the profile of ` +
      `the nosing, whether the treads are solid or capped, and what is on them now. ${PRICE_PROMISE} ` +
      `The floor those stairs meet is published: ${band('fullSandAndFinish')} per square foot for ` +
      `a full sand and finish, ${band('screenAndRecoat')} for a screen and recoat.`,
  },
  {
    question: 'Can carpeted stairs be converted to hardwood?',
    answer:
      `Usually, and what decides it is what is under the carpet. Builder-grade stairs are often ` +
      `construction-grade pine or plywood stringers never meant to be seen, in which case the ` +
      `answer is new treads and risers rather than refinishing. Where the treads are solid oak — ` +
      `common in Toronto houses built before the 1970s — the carpet has usually protected them, ` +
      `and they refinish to better condition than the floor around them. The staple holes are the ` +
      `work: several hundred per flight, each one filled before sanding.`,
  },
  {
    question: 'Will refinished stairs match my floor exactly?',
    answer:
      `They will match if the stain is mixed against the finished floor rather than against a ` +
      `sample card, and they will not if it is not. Stair treads are usually a different cut of ` +
      `the same species and take stain at a different rate, so the same formula produces a ` +
      `visibly different colour. The join between the top tread and the landing is where this ` +
      `shows, and it is the detail that gives a refinish away.`,
  },
  {
    question: 'How long do stairs take, and can we use them?',
    answer:
      `A single flight is typically a day of sanding and filling plus the finish schedule. The ` +
      `constraint is not the work, it is that a staircase is often the only route between floors ` +
      `— so the sequence is planned around that before the first machine arrives, rather than ` +
      `discovered on the second morning. Where a house has one staircase, the flight is usually ` +
      `run in halves so one side stays walkable.`,
  },
  {
    question: 'Are stairs included in a hardwood flooring quote?',
    answer:
      `They should be itemised in it, and the most common defect in a Toronto flooring quote is ` +
      `that they are not — the floor is priced per square foot, the stairs are mentioned, and the ` +
      `number for them appears later. ${FRAMEWORK_NAME} v${FRAMEWORK_VERSION} is published free ` +
      `for exactly this: ${criterionCount()} criteria to put to any quote you are holding, ` +
      `including one of ours.`,
  },
  {
    question: 'Do you do stairs without doing the floor?',
    answer:
      `Yes. Stairs on their own are a common job — most often when a floor was refinished by ` +
      `someone who priced only the floor. The colour match to an existing finished floor is ` +
      `harder than matching two new surfaces to each other, and it is done on site against the ` +
      `actual floor rather than from a record of what was used.`,
  },
  {
    question: 'Who does the work?',
    answer:
      `Salaried employees of ${BUSINESS_NAP.legalName}. No subcontractors. Stairs are where that ` +
      `matters most: they are the slowest, most detailed and least profitable part of a flooring ` +
      `job per hour spent, which is precisely why they are the part a subcontracted crew rushes.`,
  },
];

export default function HardwoodStairsTorontoPage() {
  return (
    <div className="tlx-page">
      <SchemaScript schema={buildFAQPage(FAQS.map((f) => ({ question: f.question, answer: f.answer })))} />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Hardwood Stairs Toronto', url: URL },
        ])}
      />
      {/* Service + Offer + areaServed. Stair refinishing first, because it is
          what this page is the commercial surface for; the two floor services
          follow because a stair job almost always arrives attached to one. */}
      <SchemaScript
        schema={buildCommercialLandingSchema({
          url: URL,
          serviceSlugs: ['stair-refinishing', 'floor-refinishing', 'hardwood-installation'],
          description: 'Hardwood stair refinishing and installation across Toronto and the GTA',
        })}
      />
      <SchemaScript
        schema={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${URL}#webpage`,
          url: URL,
          name: 'Hardwood Stairs Toronto',
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
            <span>Hardwood Stairs Toronto</span>
          </nav>
          <h1 className="tlx-title">Hardwood stairs in Toronto</h1>
          <p className="tlx-lede">
            Refinishing, carpet removal, new treads and risers — matched to the floor they meet,
            by salaried crews, at a price fixed in writing before any deposit. Stairs are quoted
            per tread rather than per square foot, and this page explains why that is and what
            moves the number.
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
            <Link className="fw-cta" href="/#quote">
              Get a fixed written price →
            </Link>
            <Link className="fw-cta fw-cta--ghost" href="/framework/assess">
              Score a quote you already have
            </Link>
          </div>
        </div>
      </header>

      <section className="tlx-section" aria-label="How stairs are priced">
        <div className="shell">
          <p className="tlx-kicker">Before you call anyone</p>
          <h2 className="tlx-h2">Stairs are not priced by the square foot</h2>
          <IllustrationPair a="stairs-labour-vs-area" b="stairs-labour-vs-area-b" />
          <p className="tlx-note">
            A flight of thirteen treads is roughly forty square feet of surface and roughly three
            times the labour of the four hundred square feet of floor it leads to. Every tread has
            a nosing to profile, two return edges, a riser behind it and a stringer beside it, and
            none of that is reachable by the belt sander that does the floor — it is edger, corner
            sander and hand work, tread by tread. That is why a quote that prices stairs by area is
            a quote that has not measured them.
          </p>
          <p className="tlx-note">
            The published bands below are for the <strong>floor</strong>. {PRICE_PROMISE} The stair
            number is given per tread and per flight after the same in-home measure, and it is
            itemised separately in the written price rather than folded into a square-foot rate.
          </p>
          <div className="wp-table-wrap" role="region" tabIndex={0} aria-label="Published floor price bands">
            <table className="wp-table">
              <thead>
                <tr>
                  <th scope="col">Scope</th>
                  <th scope="col">Per square foot</th>
                  <th scope="col">When this is the right scope</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{PRICING.screenAndRecoat.label}</th>
                  <td>{band('screenAndRecoat')}</td>
                  <td>The finish is worn but sound and the wood beneath is undamaged.</td>
                </tr>
                <tr>
                  <th scope="row">{PRICING.fullSandAndFinish.label}</th>
                  <td>{band('fullSandAndFinish')}</td>
                  <td>Back to bare wood. What a stair refinish is matched against.</td>
                </tr>
                <tr>
                  <th scope="row">{PRICING.newInstall.label}</th>
                  <td>{band('newInstall')}</td>
                  <td>New material over a prepared substrate, including transitions.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="tlx-note">
            The stairs usually arrive attached to a floor, and which service that floor needs
            changes the stair scope with it:{' '}
            <Link href="/services/stair-refinishing">stair refinishing</Link> where the treads are
            sound, <Link href="/services/floor-refinishing">floor refinishing</Link> for the run
            they meet, and <Link href="/services/floor-restoration">restoration</Link> where treads
            have to be replaced rather than sanded. Worth reading first:{' '}
            <Link href="/guides/reference-refinishing-existing-hardwood">
              what refinishing an existing floor involves
            </Link>{' '}
            and{' '}
            <Link href="/guides/hardwood-flooring-cost-toronto">
              what moves a quote inside the published bands
            </Link>
            .
          </p>
          <p className="tlx-note">
            What moves a stair number: the tread count, whether the treads are solid or capped,
            the nosing profile, what is on them now (carpet, paint, an existing finish), whether
            the risers are being painted or finished, and whether there is a landing. The{' '}
            <Link href="/guides/hardwood-flooring-cost-toronto">cost guide</Link> sets out the same
            variables for the floor.
          </p>
        </div>
      </section>

      <section className="tlx-section" aria-label="The four stair jobs">
        <div className="shell">
          <p className="tlx-kicker">What people actually mean</p>
          <h2 className="tlx-h2">Four different jobs, all called &ldquo;stairs&rdquo;</h2>
          <IllustrationPair a="stairs-four-jobs" b="stairs-four-jobs-b" />
          <dl className="gd-spec">
            <div>
              <dt>Refinishing existing hardwood stairs</dt>
              <dd>
                Sand to bare wood, fill, stain to match the floor, finish. The work is in the
                nosings and the returns. Detail and sequence are at{' '}
                <Link href="/services/stair-refinishing">stair refinishing</Link>.
              </dd>
            </div>
            <div>
              <dt>Carpet off, hardwood underneath</dt>
              <dd>
                Common in Toronto houses built before the 1970s, where solid oak treads sit under
                carpet that has protected them for fifty years. Several hundred staple holes per
                flight, each filled before sanding. Whether this is possible is decided by lifting
                one tread&rsquo;s worth of carpet at the estimate, not guessed at afterwards.
              </dd>
            </div>
            <div>
              <dt>New treads and risers</dt>
              <dd>
                Where the existing stairs were never meant to be seen — construction-grade pine or
                plywood under carpet. New solid treads, either full-depth or retrofit caps over the
                existing structure, finished to match the floor.
              </dd>
            </div>
            <div>
              <dt>Matching stairs to a floor that is already finished</dt>
              <dd>
                The hardest colour match there is, and the most common standalone stair job,
                because it is what happens after a contractor priced only the floor. Stain is mixed
                on site against the actual floor.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <EvidenceRail
        heading="Two staircases, written up in full"
        intro={
          'Both are the hard version of this job — a staircase that had to match a floor built on a ' +
          'different assembly — and both publish the measurements rather than only the photograph.'
        }
        items={[
          { ...CASES.rosedale, why: 'A grand staircase and a main floor over radiant heat: two assemblies that move differently, finished to one colour.' },
          { ...CASES.midtown, why: 'A custom staircase joining three storeys on three substrates, with white oak treads and walnut stringers.' },
        ]}
      />

      <section className="tlx-section" aria-label="Evidence">
        <div className="shell">
          <p className="tlx-kicker">The method behind them</p>
          <h2 className="tlx-h2">Why stairs are the part that gives a job away</h2>
          <IllustrationPair a="stairs-anatomy" b="stairs-anatomy-b" />
          <IllustrationPair a="stairs-tread-vs-cap" b="stairs-tread-vs-cap-b" />
          <p className="tlx-note">
            The mechanism behind the moisture and movement decisions in that job is set out in{' '}
            <Link href="/papers/toronto-hardwood-climate-moisture-protocol">
              the climate and moisture protocol
            </Link>
            , and the machine sequence in{' '}
            <Link href="/papers/hardwood-refinishing-machines-and-sequence">
              the refinishing machines paper
            </Link>{' '}
            — the edger section is the one that covers stairs.
          </p>
        </div>
      </section>

      <section className="tlx-section" aria-label="The standard">
        <div className="shell">
          <p className="tlx-kicker">Hold us to it</p>
          <h2 className="tlx-h2">
            Put any stair quote against {FRAMEWORK_NAME}
          </h2>
          <p className="tlx-note">
            {criterionCount()} criteria, version {FRAMEWORK_VERSION}, published under CC BY so you
            can apply it to every quote you are holding — ours included. For stairs the criteria
            that bite hardest are the ones about specification and accountability: is the tread
            count in the written price, is the nosing profile specified, and is the colour match
            being made on site or from a card. Any critical criterion answered &ldquo;no&rdquo; is
            an unresolved defect in that quote, whatever the price says.
          </p>
          <div className="fw-actions">
            <Link className="fw-cta" href="/framework">
              Read the framework
            </Link>
            <Link className="fw-cta fw-cta--ghost" href="/framework/assess">
              Score a quote against it
            </Link>
          </div>
        </div>
      </section>

      <section className="tlx-section" aria-label="Frequently asked questions">
        <div className="shell">
          <p className="tlx-kicker">Straight answers</p>
          <h2 className="tlx-h2">Questions people actually ask about stairs</h2>
          <dl className="gd-spec">
            {FAQS.map((f) => (
              <div key={f.question}>
                <dt>{f.question}</dt>
                <dd>{f.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <CommercialHeadTermRail />

      <section className="tlx-section" aria-label="Where we work">
        <div className="shell">
          <p className="tlx-kicker">Coverage</p>
          <h2 className="tlx-h2">{SERVICE_AREAS.length} areas across Toronto and the GTA</h2>
          <p className="tlx-note">
            Stair stock tracks house stock: pre-war semis in Leslieville and Riverdale usually have
            solid oak under the carpet, post-war bungalows in Etobicoke and North York often do
            not, and a downtown slab condo has no stairs at all until someone builds them.
          </p>
          <div className="footer-links">
            {SERVICE_AREAS.map((c) => (
              <Link key={c.slug} href={`/service-areas/${c.slug}`}>
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
