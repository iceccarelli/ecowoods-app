import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getGuide, getGuides, GUIDES } from '@/lib/guides';
import { pillarById } from '@/lib/framework';
import { getPaper } from '@/lib/papers';
import { Illustration } from '../../components/Illustration';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList, buildFAQPage } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';
import { CommercialHeadTermRail } from '../../components/CommercialHeadTermRail';
import { EvidenceRail, CASES } from '@/app/components/EvidenceRail';
import { SERVICES } from '@/lib/seo-data';
import { IllustrationPair } from '../../components/Illustration';
import { CatalogueRail } from '@/app/components/CatalogueRail';
import { NextStep } from '@/app/components/NextStep';
import { SeeInMyRoom } from '@/app/components/floor-studio/SeeInMyRoom';
import { ColorMatchFigure } from '@/app/components/ColorMatchFigure';
import { FigureRotator } from '@/app/components/FigureRotator';
import { colorMatchingSlide } from '@/app/data/color-matching-images';
import { COLOR_MATCH_HERO, COLOR_MATCH_HERO_SKIP_ON_DETAIL } from '../color-match-hero';

/**
 * Colour-matching guide slug → in-body frames from the 2026 colour-matching
 * illustration pack (scripts/fixtures/color-matching-manifest.csv). Kept
 * here, same as GUIDE_IMAGE and GUIDE_PAIRS above, so the content manifest
 * (lib/guides.ts) stays free of presentation concerns. The hero map
 * (COLOR_MATCH_HERO) is shared with the /guides index thumbnail — see
 * ../color-match-hero.ts.
 *
 * The species/undertone guide is deliberately absent below — it has no
 * body sequence in the manifest, only six board portraits and a lineup
 * frame, and is rendered by its own section further down this file instead.
 */
/** Every body frame for a guide goes in the rotator — none are dropped. */
const COLOR_MATCH_BODY: Record<string, string[]> = {
  'color-identification-existing-hardwood-finish': [
    'guide-id-film-vs-penetrating',
    'guide-id-ambering-oil',
    'guide-id-three-lights',
  ],
  'stain-matching-existing-hardwood-floor-toronto': [
    'guide-stain-same-formula-two-species',
    'guide-stain-sheen-matte-vs-satin',
    'guide-stain-sample-on-floor',
  ],
  'matching-new-hardwood-to-old-toronto': [
    'guide-newold-bad-butt-joint',
    'guide-newold-feather-zone',
    'guide-newold-threshold-strip',
  ],
  'stair-railing-trim-color-matching-toronto': [
    'guide-stair-sample-at-nosing',
    'guide-stair-painted-vs-stained',
    'guide-stair-wear-shift',
  ],
  'door-woodwork-finish-coordination-toronto': ['guide-door-painted-undertone', 'guide-door-threshold-contact'],
  'when-color-match-fails-full-sand-vs-replace': ['guide-fail-three-paths', 'guide-fail-wear-layer-measure'],
  'sample-boards-on-site-trials-sign-off': ['guide-signoff-day-vs-night', 'guide-signoff-written'],
};

/** The six species-undertone board portraits, in table order. */
const SPECIES_PORTRAITS = [
  'species-white-oak-undertone',
  'species-red-oak-undertone',
  'species-hard-maple-undertone',
  'species-black-walnut-undertone',
  'species-hickory-undertone',
  'species-white-ash-undertone',
];
const SPECIES_LINEUP = 'species-same-stain-six-species';

/**
 * Guide slug → the floor the guide is about.
 *
 * A species dossier is a good page and a dead end: somebody reads two thousand
 * words about white oak, decides they like it, and then has to go and find the
 * thing that shows it to them. These five carry the floor they are about into
 * Floor Studio, preloaded.
 *
 * WHITE ASH IS DELIBERATELY ABSENT. It has a dossier and no catalogue entry —
 * this company does not currently lay it — and <SeeInMyRoom> renders nothing
 * for a species that is not in the catalogue rather than linking into a floor
 * that cannot be bought. That silence is the same rule the renderer obeys.
 */
const GUIDE_FLOOR: Record<string, { productId: string; patternId?: string; label?: string }> = {
  'white-oak-flooring-toronto': { productId: 'white-oak' },
  'red-oak-flooring-toronto': { productId: 'red-oak' },
  'hard-maple-flooring-toronto': { productId: 'hard-maple' },
  'black-walnut-flooring-toronto': { productId: 'black-walnut' },
  'hickory-flooring-toronto': { productId: 'hickory' },
  'herringbone-chevron-parquet-toronto': {
    productId: 'white-oak',
    patternId: 'herringbone',
    label: 'Herringbone is the one people photograph. See it in your own room before you commit to it.',
  },
};

/* One fact, two drawings of it. `<id>` and `<id>-b` were briefed once and
   drawn twice; IllustrationPair alternates them by cross-fade. Not kenburns —
   see the note above IllustrationMotion in components/Illustration.tsx: a scale
   inside a fixed frame crops, and on an explanatory figure the crop removes the
   thing the figure exists to show. */
const GUIDE_PAIRS: Record<string, [string, string][]> = {
  'reference-condominium-concrete-slab': [['assembly-condo-slab-stack', 'assembly-condo-slab-stack-b'], ['gap-midfield-obstructions', 'gap-midfield-obstructions-b']],
  'reference-radiant-heat-main-floor': [['radiant-failure-delay', 'radiant-failure-delay-b']],
  'hardwood-flooring-cost-toronto': [['price-bands-to-scale', 'price-bands-to-scale-b'], ['change-order-drift', 'change-order-drift-b']],
  'nail-down-glue-down-or-floating': [['acoustic-three-methods', 'acoustic-three-methods-b']],
  'herringbone-chevron-parquet-toronto': [['pattern-layout-three', 'pattern-layout-three-b']],
};

/** Guide slug → illustration id. Kept here rather than in the guides manifest so
 *  the content manifest stays free of presentation concerns. */
const GUIDE_IMAGE: Record<string, string> = {
  'solid-vs-engineered-hardwood-toronto': 'guide-solid-vs-engineered',
  'nail-down-glue-down-or-floating': 'guide-method',
  'how-to-evaluate-a-hardwood-quote': 'guide-evaluate-quote',
  'reference-condominium-concrete-slab': 'guide-ref-condo',
  'reference-radiant-heat-main-floor': 'guide-ref-radiant',
  'reference-refinishing-existing-hardwood': 'guide-ref-refinish',
  'hardwood-flooring-cost-toronto': 'guide-cost-toronto',
  'how-to-choose-hardwood-contractor-toronto': 'guide-choose-contractor',
  'white-oak-flooring-toronto': 'guide-white-oak',
  'dustless-hardwood-refinishing-toronto': 'guide-dustless',
  'herringbone-chevron-parquet-toronto': 'guide-herringbone-parquet',

  /* The species dossiers share one hero, and that is the correct answer
     rather than a shortcut. Each of them exists to place ONE species on a
     comparative hardness scale that runs from black walnut at 1,010 lbf to
     hickory at 1,880; a separate drawing of the same ladder per dossier would
     be one more chance per species for the ladder to disagree with itself. Wired ahead of the art —
     <Illustration> renders nothing for an id the manifest does not carry, so
     these are inert until the file lands. */
  'red-oak-flooring-toronto': 'species-hardness-ladder',
  'hard-maple-flooring-toronto': 'species-hardness-ladder',
  'white-ash-flooring-toronto': 'species-hardness-ladder',
  'hickory-flooring-toronto': 'species-hardness-ladder',
  'black-walnut-flooring-toronto': 'species-hardness-ladder',
};

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return { title: 'Not found' };
  return {
    /* The searcher's phrasing, where the guide sets one. See the note on
       Guide.seoTitle — the slug already carried the keyword and the title did
       not, which is the one place a rename is worth more than a new page. */
    title: guide.seoTitle ?? guide.title,
    description: guide.summary,
    alternates: { canonical: `/guides/${guide.slug}`, types: { 'text/markdown': `/guides/${guide.slug}.md` } },
    openGraph: {
      title: guide.question,
      description: guide.summary,
      type: 'article',
      url: `${SITE_URL}/guides/${guide.slug}`,
      publishedTime: guide.publishedAt,
    },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const kindLabel = guide.kind === 'decision' ? 'Decision guide' : 'Reference installation';
  const headline = guide.seoTitle ?? guide.title;
  const siblings = getGuides(guide.kind).filter((g) => g.slug !== guide.slug);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    '@id': `${SITE_URL}/guides/${guide.slug}#article`,
    headline,
    alternativeHeadline: guide.question,
    description: guide.summary,
    url: `${SITE_URL}/guides/${guide.slug}`,
    datePublished: guide.publishedAt,
    inLanguage: 'en-CA',
    isAccessibleForFree: true,
    author: { '@id': `${SITE_URL}/#organization` },
    publisher: { '@id': `${SITE_URL}/#organization` },
    isPartOf: { '@id': `${SITE_URL}/#website` },
    citation: guide.sources
      .filter((s) => getPaper(s.paper))
      .map((s) => ({
        '@type': 'CreativeWork',
        url: `${SITE_URL}/papers/${s.paper}#${s.section}`,
      })),
  };

  return (
    <div className="tlx-page">
      <SchemaScript schema={schema} />
      {/* FAQPage, and it qualifies under F-27 for the reason the service pages
          do: every pair below is rendered visibly further down this page, and
          every answer is drawn from the papers, the glossary or the published
          constants rather than written for the schema block. The first pair is
          the guide's own question and its published recommendation — the two
          strings this page has always led with. */}
      <SchemaScript
        schema={buildFAQPage([
          { question: guide.question, answer: guide.recommendation.text },
          ...(guide.faqs ?? []).map((f) => ({ question: f.q, answer: f.a })),
        ])}
      />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Guides', url: `${SITE_URL}/guides` },
          { name: guide.title, url: `${SITE_URL}/guides/${guide.slug}` },
        ])}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
            <Link href="/guides">Guides</Link> <span aria-hidden="true">/</span>{' '}
            <span>{guide.title}</span>
          </nav>
          <p className="gd-kind">{kindLabel}</p>
          <h1 className="tlx-title">{headline}</h1>
          <p className="gd-question">{guide.question}</p>
          <p className="tlx-lede">{guide.summary}</p>
          {/* Never both: COLOR_MATCH_HERO and GUIDE_IMAGE do not share a slug, so
              exactly one of these two figures ever renders for a given guide — but
              verify-preload.mjs counts literal `priority` attributes per file, not
              per render path, so Illustration's is gated on the same condition
              rather than left as a second unconditional preload. */}
          <Illustration id={GUIDE_IMAGE[guide.slug] ?? ''} priority={!COLOR_MATCH_HERO[guide.slug]} />
          {(GUIDE_PAIRS[guide.slug] ?? []).map((p) => (
            <IllustrationPair key={p[0]} a={p[0]} b={p[1]} />
          ))}
          {COLOR_MATCH_HERO[guide.slug] && guide.slug !== COLOR_MATCH_HERO_SKIP_ON_DETAIL && (
            <ColorMatchFigure id={COLOR_MATCH_HERO[guide.slug]!} priority />
          )}
          <p className="fw-meta">
            <span>{guide.readingMinutes} min read</span>
            <span aria-hidden="true">·</span>
            <span>Published {guide.publishedAt}</span>
          </p>
        </div>
      </header>

      {COLOR_MATCH_BODY[guide.slug] && COLOR_MATCH_BODY[guide.slug]!.length > 0 && (
        <section className="tlx-section" aria-label="What this looks like on site">
          <div className="shell">
            <p className="tlx-kicker">On site</p>
            <h2 className="tlx-h2">What this looks like on site</h2>
            <FigureRotator
              label={`${guide.title} — on site`}
              slides={COLOR_MATCH_BODY[guide.slug]!.map((id) => colorMatchingSlide(id)).filter(
                (s): s is NonNullable<typeof s> => Boolean(s),
              )}
            />
          </div>
        </section>
      )}

      {guide.slug === COLOR_MATCH_HERO_SKIP_ON_DETAIL && (
        <section className="tlx-section" aria-label="Species and undertone, in board portraits">
          <div className="shell">
            <p className="tlx-kicker">In board portraits</p>
            <h2 className="tlx-h2">The same stain, six species</h2>
            {/* A grid of six RotatingTiles each holding a single shot never
                advances — RotatingTile's rotation is between the shots IN one
                tile, and there was only ever one per tile. A FigureRotator
                genuinely cycles between all six, each with its own
                MANIFEST alt and caption — the per-species facts a shared
                RotatingTile alt would otherwise lose. */}
            <FigureRotator
              label="Species and undertone — six board portraits"
              slides={SPECIES_PORTRAITS.map((id) => colorMatchingSlide(id)).filter(
                (s): s is NonNullable<typeof s> => Boolean(s),
              )}
            />
            {/* The lineup gets its own full-width figure, never folded into the
                portrait rotator above — it is a different fact (one stain
                across all six species at once), not a seventh portrait. */}
            <ColorMatchFigure id={SPECIES_LINEUP} />
          </div>
        </section>
      )}

      {guide.criteria && guide.criteria.length > 0 && (
        <section className="tlx-section" aria-label="What decides this">
          <div className="shell">
            <p className="tlx-kicker">First</p>
            <h2 className="tlx-h2">What actually decides this</h2>
            <ol className="gd-criteria">
              {guide.criteria.map((c) => (
                <li key={c.name}>
                  <h3>{c.name}</h3>
                  <p>{c.why}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {guide.options && guide.options.length > 0 && (
        <section className="tlx-section" aria-label="The options">
          <div className="shell">
            <p className="tlx-kicker">Options</p>
            <h2 className="tlx-h2">The choices, and when each is correct</h2>
            <div className="gd-options">
              {guide.options.map((o) => (
                <div key={o.name} className="gd-option">
                  <h3>{o.name}</h3>
                  <p className="gd-when">
                    <strong>Correct when:</strong> {o.whenCorrect}
                  </p>
                  {o.notes && (
                    <ul>
                      {o.notes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {guide.spec && guide.spec.length > 0 && (
        <section className="tlx-section" aria-label="Specification">
          <div className="shell">
            <p className="tlx-kicker">Specification</p>
            <h2 className="tlx-h2">The assembled specification</h2>
            <dl className="gd-spec">
              {guide.spec.map((s) => (
                <div key={s.label} className="gd-spec-row">
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {guide.table && (
        <section className="tlx-section" aria-label="Comparison">
          <div className="shell">
            <p className="tlx-kicker">Reference</p>
            <h2 className="tlx-h2">{guide.table.caption ?? 'Comparison'}</h2>
            <div className="gd-table-wrap">
              <table className="gd-table">
                <thead>
                  <tr>
                    {guide.table.head.map((h) => (
                      <th key={h} scope="col">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {guide.table.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {guide.decisionTree && guide.decisionTree.length > 0 && (
        <section className="tlx-section" aria-label="Decision tree">
          <div className="shell">
            <p className="tlx-kicker">Decide</p>
            <h2 className="tlx-h2">The decision tree, in the order we walk it</h2>
            <ol className="gd-tree">
              {guide.decisionTree.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {guide.sequence && guide.sequence.length > 0 && (
        <section className="tlx-section" aria-label="Sequence">
          <div className="shell">
            <p className="tlx-kicker">Sequence</p>
            <h2 className="tlx-h2">The sequence, start to finish</h2>
            <ol className="gd-tree">
              {guide.sequence.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {guide.watchpoints && guide.watchpoints.length > 0 && (
        <section className="tlx-section" aria-label="Where this goes wrong">
          <div className="shell">
            <p className="tlx-kicker">Failure modes</p>
            <h2 className="tlx-h2">Where this goes wrong</h2>
            <ul className="gd-watch">
              {guide.watchpoints.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="tlx-section" aria-label="Recommendation">
        <div className="shell">
          <p className="tlx-kicker">Answer</p>
          <h2 className="tlx-h2">What we recommend</h2>
          <p className="gd-reco">{guide.recommendation.text}</p>
          {guide.recommendation.conditions && (
            <ul className="gd-conditions">
              {guide.recommendation.conditions.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {guide.faqs && guide.faqs.length > 0 && (
        <section className="tlx-section" aria-label="Related questions">
          <div className="shell">
            <p className="tlx-kicker">Also asked</p>
            <h2 className="tlx-h2">Related questions this guide answers</h2>
            <dl className="gd-spec">
              {guide.faqs.map((f) => (
                <div className="gd-spec-row" key={f.q}>
                  <dt>{f.q}</dt>
                  <dd>{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {GUIDE_FLOOR[guide.slug] && (
        <section className="tlx-section tlx-section--flush" aria-label="See this floor in your room">
          <div className="shell">
            <SeeInMyRoom
              productId={GUIDE_FLOOR[guide.slug]!.productId}
              patternId={GUIDE_FLOOR[guide.slug]!.patternId}
              label={GUIDE_FLOOR[guide.slug]!.label}
              source={`guide:${guide.slug}`}
            />
          </div>
        </section>
      )}

      <CatalogueRail route={`/guides/${guide.slug}`} />

      <CommercialHeadTermRail />

      <section className="tlx-section" aria-label="Sources and framework">
        <div className="shell">
          <p className="tlx-kicker">Provenance</p>
          <h2 className="tlx-h2">Where every claim on this page comes from</h2>
          <ul className="gd-sources">
            {guide.sources.map((s) => {
              const paper = getPaper(s.paper);
              if (!paper) return null;
              return (
                <li key={`${s.paper}#${s.section}`}>
                  <Link href={`/papers/${s.paper}#${s.section}`}>
                    {paper.title} — {s.section.replace(/-/g, ' ')}
                  </Link>
                </li>
              );
            })}
          </ul>

          {guide.pillars && guide.pillars.length > 0 && (
            <>
              <h3 className="fw-sub">Framework pillars this bears on</h3>
              <ul className="gd-sources">
                {guide.pillars.map((id) => {
                  const p = pillarById(id);
                  if (!p) return null;
                  return (
                    <li key={id}>
                      <Link href={`/framework#${p.id}`}>
                        Pillar {p.number} — {p.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <div className="fw-actions">
            <Link className="fw-cta" href="/framework/assess">
              Score your quote against the framework →
            </Link>
          </div>
        </div>
      </section>

      {/* A guide answers a question. It also has to say what happens next, and
          this template said nothing: zero links to any service, zero to any
          case study, and its only CTA sent people to score someone else's
          quote. A reader who has just decided between solid and engineered is
          the most qualified visitor on the site, and the page ended. */}
      <section className="tlx-section" aria-label="What happens next">
        <div className="shell">
          <p className="tlx-kicker">Once this is decided</p>
          <h2 className="tlx-h2">What the work actually is</h2>
          <p className="tlx-note">
            {SERVICES.map((sv, i) => (
              <span key={sv.slug}>
                {i > 0 && ' · '}
                <Link href={`/services/${sv.slug}`}>{sv.name}</Link>
              </span>
            ))}
          </p>
          <p className="tlx-note">
            Prices for all three bands are published before you call —{' '}
            <Link href="/hardwood-flooring-toronto">hardwood flooring in Toronto</Link> for a new
            floor, <Link href="/hardwood-floor-refinishing-toronto">refinishing</Link> for an
            existing one, <Link href="/hardwood-stairs-toronto">stairs</Link> for the part usually
            left out of the quote. If the floor is already cupping, gapping or lifting, this is a
            diagnosis rather than a decision:{' '}
            <Link href="/hardwood-floor-problems-toronto">what your floor is telling you</Link>.
          </p>
          <div className="fw-actions">
            {/* AUTH-01 — /estimate, not the homepage anchor. `/#quote` works,
                but it costs a page load and it means the page built to take an
                estimate request has six inbound links in the whole codebase
                while the homepage collects every one the authority tier
                earns. */}
            <Link className="fw-cta" href="/estimate">
              Get a fixed written price →
            </Link>
            <Link className="fw-cta fw-cta--ghost" href="/framework">
              Read the standard first
            </Link>
          </div>
        </div>
      </section>

      <EvidenceRail
        heading="Where these decisions were made on real jobs"
        intro={
          'Each publishes the readings and the reasoning, not only the result — which is what makes ' +
          'them worth reading next to a guide rather than instead of one.'
        }
        items={[
          { ...CASES.distillery, why: 'Over a concrete slab: the moisture test decided the assembly before a species was chosen.' },
          { ...CASES.rosedale, why: 'Radiant heat under a main floor and a staircase, with the thermal range designed for.' },
          { ...CASES.forestHill, why: 'Wide-plank walnut, and keeping the colour uniform across boards that age photochemically.' },
        ]}
      />

      {siblings.length > 0 && (
        <section className="tlx-section" aria-label="More guides">
          <div className="shell">
            <p className="tlx-kicker">Next</p>
            <h2 className="tlx-h2">More {guide.kind === 'decision' ? 'decision guides' : 'reference installations'}</h2>
            <div className="tlx-grid">
              {siblings.map((g) => (
                <Link key={g.slug} className="tlx-card" href={`/guides/${g.slug}`}>
                  <span className="tlx-card-tag">{kindLabel}</span>
                  <h3>{g.title}</h3>
                  <p>{g.question}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
      <NextStep route={`/guides/${guide.slug}`} />
    </div>
  );
}
