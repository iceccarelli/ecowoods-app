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

  /* The five species dossiers share one hero, and that is the correct answer
     rather than a shortcut. Each of them exists to place ONE species on a
     comparative hardness scale that runs from black walnut at 1,010 lbf to
     hickory at 1,880; five separate drawings of the same ladder would be five
     chances for the ladder to disagree with itself. Wired ahead of the art —
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
          <Illustration id={GUIDE_IMAGE[guide.slug] ?? ''} priority />
          {(GUIDE_PAIRS[guide.slug] ?? []).map((p) => (
            <IllustrationPair key={p[0]} a={p[0]} b={p[1]} />
          ))}
          <p className="fw-meta">
            <span>{guide.readingMinutes} min read</span>
            <span aria-hidden="true">·</span>
            <span>Published {guide.publishedAt}</span>
          </p>
        </div>
      </header>

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
            <Link className="fw-cta" href="/#quote">
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
    </div>
  );
}
