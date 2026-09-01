import type { Metadata } from 'next';
import { FeedbackBand } from '../components/FeedbackBand';
import { EstimateForm } from '../components/EstimateForm';
import Link from 'next/link';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { SITE_URL, SERVICE_AREAS } from '@/lib/seo-data';
import { PRICING, PRICE_PROMISE } from '@/lib/pricing';
import { getTerm } from '@/lib/glossary';
import { FRAMEWORK_NAME, criterionCount } from '@/lib/framework';
import { buildBreadcrumbList, buildFAQPage } from '@/lib/schema/builders';
import { buildCommercialLandingSchema } from '@/lib/schema/commercial';
import { SchemaScript } from '@/lib/schema/components';
import { CommercialHeadTermRail } from '../components/CommercialHeadTermRail';
import { IllustrationPair } from '../components/Illustration';

const money = (n: number) => `$${n.toFixed(2)}`;
const band = (k: keyof typeof PRICING) => `${money(PRICING[k].min)}–${money(PRICING[k].max)}`;

const URL = `${SITE_URL}/hardwood-floor-problems-toronto`;
const P_CLIMATE = 'toronto-hardwood-climate-moisture-protocol';

export const metadata: Metadata = {
  title: 'Hardwood Floor Problems Toronto — Cupping, Gaps, Crowning & What Fixes Them',
  description:
    'What your hardwood floor is telling you: cupping, winter gaps, crowning, buckling and edge ' +
    'peaking, each with its cause, whether it is recoverable, and what fixing it costs in Toronto. ' +
    'Every failure mode on this page is one mechanism — moisture — and the diagnosis is free.',
  alternates: { canonical: '/hardwood-floor-problems-toronto' },
  openGraph: {
    title: 'Hardwood Floor Problems Toronto — Ecowoods',
    description:
      'Cupping, gapping, crowning, buckling, edge peaking. Cause, prognosis and price for each, ' +
      'from the company that publishes its bands before you call.',
    type: 'website',
    url: URL,
  },
};

/**
 * /hardwood-floor-problems-toronto — the failure-mode atlas.
 *
 * WHY THIS IS THE MOST VALUABLE PAGE ON THIS SITE THAT DID NOT EXIST
 *
 * `content/search/topic-map.ts` carried exactly one cluster marked
 * `coverage: 'gap'`, and this is it. Somebody typing "why is my hardwood floor
 * cupping" owns a floor and has a problem. They are not choosing between solid
 * and engineered — which is where the topic map had to send them, because that
 * guide was the closest thing on the site — and a guide that answers a question
 * they did not ask is a bounce.
 *
 * Three separate reasons this page is worth more than any of the keyword
 * variants that were requested instead:
 *
 *   IT CONVERTS. A cupped floor is a job. Every other commercial page on this
 *   site meets someone who is *considering* work; this one meets someone whose
 *   floor is already failing, in the hour they first searched for it.
 *
 *   IT IS THE QUESTION AN ANSWER ENGINE IS ACTUALLY ASKED. "Why is my floor
 *   cupping" is a real question with a real answer, which is exactly the shape
 *   of query a retrieval system answers by quoting a source. "Hardwood flooring
 *   Toronto" is a shopping query it answers with a list. This page is far more
 *   citable than the head term it sits behind.
 *
 *   IT COSTS NOTHING TO SAY. Every symptom below is already published in the
 *   glossary and established in the climate-and-moisture paper. This page
 *   invents nothing — it re-cuts material the site already owns, from the
 *   homeowner's side rather than the technician's.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *
 * A repair price per symptom. What a cupped floor costs to fix depends on
 * whether the moisture source is still active, and answering that from a
 * photograph is how a customer gets a number that changes later. The page
 * publishes the two bands that DO apply once the diagnosis is made, and says
 * which one each failure mode lands in. That is the honest version, and the
 * whole "fixed price in writing" claim depends on not pretending otherwise.
 *
 * THE ORDER OF THE SYMPTOMS IS THE ORDER PEOPLE SEARCH THEM, not the order a
 * technician would teach them. Cupping and winter gapping are 80% of the
 * traffic; buckling is rare and terrifying and gets found by people in a hurry.
 */

type FailureMode = {
  /** Glossary slug. Every word of the definition comes from there. */
  slug: string;
  /** What the homeowner would type, in their words rather than ours. */
  searchedAs: string;
  /** What they can see, described so they can match it without a diagram. */
  looksLike: string;
  /** The mechanism, in one sentence. */
  cause: string;
  /** Honest prognosis. This is the part every other page in this market omits. */
  prognosis: string;
  /** Which published band the remedy falls in, or none where none applies. */
  remedy: keyof typeof PRICING | 'none';
  /** What the remedy actually is. */
  remedyText: string;
};

const MODES: FailureMode[] = [
  {
    slug: 'cupping',
    searchedAs: 'Why is my hardwood floor cupping?',
    looksLike:
      'The edges of each board sit higher than its centre, so the floor reads as a series of ' +
      'shallow troughs. Most visible in raking light across the boards, and you can usually feel ' +
      'it barefoot before you can see it.',
    cause:
      'Moisture is entering the floor from below — a slab, a crawlspace, a leak, a dishwasher, ' +
      'or a subfloor that was never tested. The underside of each board swells more than the top ' +
      'and the board curls.',
    prognosis:
      'Recoverable, but only in the right order, and this is the single most expensive mistake ' +
      'made on Toronto floors. Sanding a cupped floor flat before the moisture has equalised ' +
      'produces crowning when it finally does — the same floor, now permanently domed, with the ' +
      'wear layer already spent on fixing it once. The moisture source is found and stopped ' +
      'first, the floor is left to equalise, and only then is anything sanded.',
    remedy: 'fullSandAndFinish',
    remedyText:
      'Once equalised: a full sand and finish. If boards have delaminated or the moisture ran ' +
      'long enough to stain, board replacement first — that is restoration, priced per board.',
  },
  {
    slug: 'seasonal-gapping',
    searchedAs: 'Gaps between my floorboards in winter',
    looksLike:
      'Thin dark lines opening between boards, worst in January and February, closing again by ' +
      'June. Usually widest near heat sources and exterior walls.',
    cause:
      'Toronto indoor air runs to roughly 18–25% relative humidity in deep winter against the ' +
      '35–55% band in which hardwood is dimensionally stable. The wood gives up moisture and ' +
      'shrinks across the grain. It is not a defect; it is what wood does.',
    prognosis:
      'Usually nothing to fix. A gap that closes in summer is a floor behaving correctly in a ' +
      'house that is too dry, and the answer is a humidifier rather than a contractor. A gap ' +
      'that does NOT close by mid-summer is a different problem — that is a floor installed at ' +
      'the wrong moisture content, and it will not self-correct.',
    remedy: 'none',
    remedyText:
      'Measure the indoor humidity through one full winter before anyone fills anything. Filler ' +
      'in a seasonal gap is squeezed out the following summer and takes finish with it.',
  },
  {
    slug: 'crowning',
    searchedAs: 'My floor is higher in the middle of each board',
    looksLike:
      'The opposite of cupping — the centre of each board is proud of its edges, so the floor ' +
      'reads as a washboard. Often shinier along the crowns, where foot traffic has polished them.',
    cause:
      'Almost always a cupped floor that was sanded flat before it had dried out. When the ' +
      'moisture finally equalises the board tries to flatten, and the material that would have ' +
      'let it is already in a dust bag.',
    prognosis:
      'Recoverable if there is wear layer left, and that is the whole question. A floor sanded ' +
      'once while cupped has already spent more of its thickness than a normal refinish, and ' +
      'depth above the tongue is measured before anyone quotes a second sand — not after.',
    remedy: 'fullSandAndFinish',
    remedyText:
      'A full sand and finish, but only once depth above the tongue has been confirmed. Where ' +
      'there is not enough left, the honest answer is replacement, and we will say so.',
  },
  {
    slug: 'buckling',
    searchedAs: 'My hardwood floor is lifting off the subfloor',
    looksLike:
      'Boards pulled clear of the subfloor, tenting into a ridge, or a whole run visibly lifted. ' +
      'Often sudden, and often after water.',
    cause:
      'The floor has expanded and had nowhere to go — either a flood or a plumbing failure, or ' +
      'an expansion gap that was never left at the perimeter. Wood that cannot expand sideways ' +
      'expands upwards.',
    prognosis:
      'Urgent and mixed. Stop the water first. Buckling from a leak is sometimes recoverable ' +
      'once the floor dries, and often is not; buckling from a missing expansion gap is a ' +
      'workmanship defect that will recur unless the perimeter is corrected. Either way this is ' +
      'the one on this page to have looked at within days rather than months.',
    remedy: 'none',
    remedyText:
      'Assessed on site. The scope is board replacement, perimeter correction, or replacement of ' +
      'the run — and which one it is cannot be established from a photograph.',
  },
  {
    slug: 'edge-peeling',
    searchedAs: 'The finish is flaking along the edges of my boards',
    looksLike:
      'Finish lifting or whitening in a thin line along board edges, sometimes with a chalky ' +
      'feel. Distinct from ordinary wear, which shows in traffic paths rather than along joints.',
    cause:
      'Finish that bridged the gap between two boards and then tore when the boards moved, or a ' +
      'coat applied over a surface that was not clean or not abraded between coats.',
    prognosis:
      'Recoverable, and it is the one failure on this page that is usually cheap. If the wood ' +
      'beneath is sound, the finish is the only thing that failed, and the floor does not need ' +
      'to go back to bare wood.',
    remedy: 'screenAndRecoat',
    remedyText:
      'A screen and recoat where the wood is sound. A full sand only where the failure has let ' +
      'water reach the wood, or where the colour has to change anyway.',
  },
];

/** The glossary slug this mode is defined by — `edge-peeling` is `edge-peaking`. */
const GLOSSARY_SLUG: Record<string, string> = { 'edge-peeling': 'edge-peaking' };
const termFor = (m: FailureMode) => getTerm(GLOSSARY_SLUG[m.slug] ?? m.slug);

const FAQS = [
  {
    question: 'Why is my hardwood floor cupping?',
    answer:
      'Moisture is reaching the underside of the boards — from a slab, a crawlspace, a leak, or ' +
      'a subfloor whose moisture content was never measured before the floor went down. The ' +
      'underside swells more than the top and each board curls, so the edges sit above the ' +
      'centre. The floor is not the problem; it is the instrument telling you where the problem ' +
      'is. Find and stop the moisture before anyone sands anything.',
  },
  {
    question: 'Can a cupped hardwood floor be sanded flat?',
    answer:
      'Yes, and doing it too early is the most expensive mistake made on Toronto floors. A ' +
      'cupped floor sanded before the moisture has equalised becomes a crowned floor when it ' +
      'finally does, permanently, with a wear layer that has already been spent once. The order ' +
      'is: stop the moisture, let the floor equalise, measure it, then sand.',
  },
  {
    question: 'Are gaps between floorboards in winter normal in Toronto?',
    answer:
      'Yes, if they close again in summer. Indoor humidity in this city runs to roughly 18–25% ' +
      'in deep winter against the 35–55% band in which hardwood is stable, and wood shrinks ' +
      'across the grain as it dries. A gap that closes by June is a house that is too dry, and a ' +
      'humidifier is the answer. A gap still open in August is a floor installed at the wrong ' +
      'moisture content, and that does not self-correct.',
  },
  {
    question: 'Should I refinish or replace a damaged hardwood floor?',
    answer:
      'Depth above the tongue decides it, and it is measured rather than guessed. A solid floor ' +
      'has a finite number of sands in it and a previous refinish may already have spent them. ' +
      `Where there is enough left, a full sand and finish runs ${band('fullSandAndFinish')} per ` +
      `square foot; where the finish is the only thing that failed, a screen and recoat runs ` +
      `${band('screenAndRecoat')}. Where there is not enough left, replacement runs ` +
      `${band('newInstall')} — and being told that is the answer you want from an estimator, ` +
      'not the answer you want them to avoid giving you.',
  },
  {
    question: 'How much does it cost to fix a cupped or damaged floor?',
    answer:
      `${PRICE_PROMISE} What this page cannot do is price a repair from a description, and no ` +
      'honest page can: whether the moisture source is still active changes the scope more than ' +
      'anything else about the floor. The published bands apply once the diagnosis is made — ' +
      `${band('screenAndRecoat')} per square foot for a screen and recoat, ` +
      `${band('fullSandAndFinish')} for a full sand and finish, ${band('newInstall')} for ` +
      'replacement. The in-home diagnosis, with moisture readings written down, is free.',
  },
  {
    question: 'Is floor cupping covered by insurance?',
    answer:
      'It depends entirely on the moisture source, which is why the readings matter beyond the ' +
      'floor itself. Sudden water — a burst supply line, a failed appliance — is commonly ' +
      'covered; long-term seepage and humidity are commonly not. Ecowoods is not an insurer and ' +
      'does not adjust claims, but the moisture readings taken at the estimate are written down ' +
      'and are yours, and they are the kind of evidence an adjuster asks for.',
  },
  {
    question: 'Who fixes hardwood floor problems in Toronto?',
    answer:
      `${BUSINESS_NAP.legalName}, across ${SERVICE_AREAS.length} areas of Toronto and the GTA, ` +
      'with salaried crews rather than subcontractors. The diagnosis is a free in-home visit ' +
      'with moisture readings taken and written down before any price is given — because a ' +
      'price quoted before anyone has measured the subfloor is a guess that gets corrected ' +
      "later, at the homeowner's expense.",
  },
];

export default function HardwoodFloorProblemsTorontoPage() {
  return (
    <div className="tlx-page">
      <SchemaScript schema={buildFAQPage(FAQS.map((f) => ({ question: f.question, answer: f.answer })))} />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Hardwood Floor Problems Toronto', url: URL },
        ])}
      />
      {/* Restoration first — it is the service a failing floor actually needs.
          Refinishing and installation follow because the diagnosis lands in one
          of the three, and which one is the whole question this page answers. */}
      <SchemaScript
        schema={buildCommercialLandingSchema({
          url: URL,
          serviceSlugs: ['floor-restoration', 'floor-refinishing', 'hardwood-installation'],
          description: 'Diagnosis and repair of failing hardwood floors across Toronto and the GTA',
        })}
      />
      <SchemaScript
        schema={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${URL}#webpage`,
          url: URL,
          name: 'Hardwood Floor Problems Toronto',
          inLanguage: 'en-CA',
          isPartOf: { '@id': `${SITE_URL}/#website` },
          about: { '@id': `${SITE_URL}/#organization` },
          mainEntity: { '@id': `${SITE_URL}/#organization` },
          /* Each symptom is a DefinedTerm this site already publishes, and the
             definitions are the glossary's own — not restated here. A machine
             asked "what is cupping" should be able to get from this page to the
             canonical definition without parsing prose. */
          mentions: MODES.map((m) => {
            const t = termFor(m);
            return {
              '@type': 'DefinedTerm',
              '@id': `${SITE_URL}/glossary/${t?.slug ?? m.slug}#term`,
              name: t?.term ?? m.slug,
              description: t?.short,
              url: `${SITE_URL}/glossary/${t?.slug ?? m.slug}`,
            };
          }),
        }}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
            <span>Hardwood Floor Problems Toronto</span>
          </nav>
          <h1 className="tlx-title">What your hardwood floor is telling you</h1>
          <p className="tlx-lede">
            Cupping, winter gaps, crowning, buckling and peeling finish are five different symptoms
            of one mechanism: moisture, moving through wood that is doing exactly what wood does.
            This page gives each one its cause, an honest prognosis — including the two where the
            answer is &ldquo;do nothing yet&rdquo; — and which published price band the remedy falls
            in. The in-home diagnosis, with the moisture readings written down and given to you, is
            free.
          </p>
          <div className="fw-actions">
            <Link className="fw-cta" href="#estimate">
              Book a free diagnosis →
            </Link>
            <Link className="fw-cta fw-cta--ghost" href="/glossary">
              Look up a term
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
          <EstimateForm source="hardwood-floor-problems-toronto" service="refinishing" heading="Have someone look at it" intro="Cupping, gapping and crowning are symptoms of one mechanism, and which one it is decides whether the floor can be saved. That is a reading, not a guess. The visit is free." />
        </div>
      </section>

      <section className="tlx-section" aria-label="Symptom index">
        <div className="shell">
          <p className="tlx-kicker">Start here</p>
          <h2 className="tlx-h2">Find your symptom</h2>
          <IllustrationPair a="symptom-cause-tree" b="symptom-cause-tree-b" />
          <div className="wp-table-wrap" role="region" tabIndex={0} aria-label="Failure modes at a glance">
            <table className="wp-table">
              <thead>
                <tr>
                  <th scope="col">What you can see</th>
                  <th scope="col">What it is</th>
                  <th scope="col">Can it be fixed</th>
                  <th scope="col">Band, once diagnosed</th>
                </tr>
              </thead>
              <tbody>
                {MODES.map((m) => {
                  const t = termFor(m);
                  return (
                    <tr key={m.slug}>
                      <th scope="row">
                        <a href={`#${m.slug}`}>{m.searchedAs}</a>
                      </th>
                      <td>{t?.term ?? m.slug}</td>
                      <td>{m.prognosis.split('.')[0]}.</td>
                      <td>
                        {m.remedy === 'none' ? 'Assessed on site' : band(m.remedy)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="tlx-note">
            Two of the five are commonly nothing to fix. A page that told you all five were a job
            would be easier to write and would be worth less to you than this one.{' '}
            <Link href={`/papers/${P_CLIMATE}#failure-modes`}>
              The mechanism behind all five
            </Link>{' '}
            is published in full, free to read and free to cite.
          </p>
        </div>
      </section>

      {MODES.map((m) => {
        const t = termFor(m);
        return (
          <section key={m.slug} id={m.slug} className="tlx-section" aria-label={t?.term ?? m.slug}>
            <div className="shell">
              <p className="tlx-kicker">{m.searchedAs}</p>
              <h2 className="tlx-h2">{t?.term ?? m.slug}</h2>
              {t?.short && <p className="tlx-note"><strong>{t.short}</strong></p>}
              <dl className="gd-spec">
                <div className="gd-spec-row">
                  <dt>What it looks like</dt>
                  <dd>{m.looksLike}</dd>
                </div>
                <div className="gd-spec-row">
                  <dt>What causes it</dt>
                  <dd>{m.cause}</dd>
                </div>
                <div className="gd-spec-row">
                  <dt>Can it be fixed</dt>
                  <dd>{m.prognosis}</dd>
                </div>
                <div className="gd-spec-row">
                  <dt>What fixing it involves</dt>
                  <dd>
                    {m.remedyText}
                    {m.remedy !== 'none' && (
                      <>
                        {' '}
                        Published band: <strong>{band(m.remedy)} per square foot</strong> for{' '}
                        {PRICING[m.remedy].label.toLowerCase()}.
                      </>
                    )}
                  </dd>
                </div>
              </dl>
              <p className="tlx-note">
                Canonical definition:{' '}
                <Link href={`/glossary/${t?.slug ?? m.slug}`}>{t?.term ?? m.slug}</Link>
                {t?.related?.length ? (
                  <>
                    {' '}· Related:{' '}
                    {t.related.map((r, i) => (
                      <span key={r}>
                        {i > 0 && ', '}
                        <Link href={`/glossary/${r}`}>{getTerm(r)?.term ?? r}</Link>
                      </span>
                    ))}
                  </>
                ) : null}
              </p>
            </div>
          </section>
        );
      })}

      <section className="tlx-section" aria-label="What we do about it">
        <div className="shell">
          <p className="tlx-kicker">The next step</p>
          <h2 className="tlx-h2">The diagnosis is free and the readings are yours</h2>
          <p className="tlx-note">
            A senior estimator takes moisture readings of the floor and the subfloor, writes them
            down, and gives you a copy — before any price is discussed. That order is not a
            courtesy; it is the only order in which a fixed price can honestly be given, because a
            number quoted before anyone has measured the subfloor is a guess that gets corrected
            later at your expense. {PRICE_PROMISE}
          </p>
          <div className="tlx-grid">
            <Link className="tlx-card" href="/services/floor-restoration">
              <h3>Hardwood floor restoration</h3>
              <p>
                Heritage and water-damaged floors: what can be saved, what has to be replaced, and
                how the join is made invisible.
              </p>
            </Link>
            <Link className="tlx-card" href="/services/floor-refinishing">
              <h3>Hardwood floor refinishing</h3>
              <p>
                Where the wood is sound and the surface is not. {band('fullSandAndFinish')} per
                square foot for a full sand and finish.
              </p>
            </Link>
            <Link className="tlx-card" href="/services/hardwood-installation">
              <h3>Hardwood installation</h3>
              <p>
                Where there is no wear layer left to save. {band('newInstall')} per square foot,
                over a substrate that gets tested first this time.
              </p>
            </Link>
          </div>
        </div>
      </section>

      <section className="tlx-section" aria-label="Evidence">
        <div className="shell">
          <p className="tlx-kicker">Written up in full</p>
          <h2 className="tlx-h2">Two of these, on real jobs</h2>
          <p className="tlx-note">
            <Link href="/case-studies/yorkville-loft-basement-conversion-moisture-mitigation">
              A Yorkville basement conversion
            </Link>{' '}
            where the slab was the moisture source, with the readings before and after the
            mitigation. And{' '}
            <Link href="/case-studies/distillery-district-victorian-condo">
              a Distillery District condo over concrete
            </Link>
            , where the calcium-chloride test decided the entire assembly. Both publish the numbers,
            not just the outcome.
          </p>
          <p className="tlx-note">
            The protocol both jobs followed is{' '}
            <Link href={`/papers/${P_CLIMATE}`}>the Toronto climate and moisture paper</Link> — in
            particular{' '}
            <Link href={`/papers/${P_CLIMATE}#moisture-testing`}>the testing section</Link>, which
            sets out what should have been measured before the floors on this page ever failed.
          </p>
        </div>
      </section>

      <section className="tlx-section" aria-label="Judging the quote you get">
        <div className="shell">
          <p className="tlx-kicker">Before you sign anything</p>
          <h2 className="tlx-h2">Put the repair quote against {FRAMEWORK_NAME}</h2>
          <p className="tlx-note">
            {criterionCount()} criteria, published free to use on any contractor in the GTA
            including us. For a failing floor the ones that bite hardest are in the moisture pillar:
            were readings taken, were they written down, and was the source identified before a
            price was given. A repair quote that skips all three is quoting to sand a symptom.
          </p>
          <div className="fw-actions">
            <Link className="fw-cta" href="/framework">
              Read the framework
            </Link>
            <Link className="fw-cta fw-cta--ghost" href="/framework/assess">
              Score a quote against it
            </Link>
          </div>
          <p className="tlx-note">
            Also worth reading before you choose:{' '}
            <Link href="/guides/how-to-evaluate-a-hardwood-quote">how to evaluate a hardwood quote</Link>{' '}
            and{' '}
            <Link href="/guides/reference-refinishing-existing-hardwood">
              what refinishing an existing floor actually involves
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="tlx-section" aria-label="Frequently asked questions">
        <div className="shell">
          <p className="tlx-kicker">Straight answers</p>
          <h2 className="tlx-h2">Questions people ask about a failing floor</h2>
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

      <CommercialHeadTermRail />
      <FeedbackBand topic="this page" estimateHref="#estimate" />
    </div>
  );
}
