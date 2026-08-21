import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getGuide, getGuides, GUIDES } from '@/lib/guides';
import { pillarById } from '@/lib/framework';
import { getPaper } from '@/lib/papers';
import { Illustration } from '../../components/Illustration';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

/** Guide slug → illustration id. Kept here rather than in the guides manifest so
 *  the content manifest stays free of presentation concerns. */
const GUIDE_IMAGE: Record<string, string> = {
  'solid-vs-engineered-hardwood-toronto': 'guide-solid-vs-engineered',
  'nail-down-glue-down-or-floating': 'guide-method',
  'how-to-evaluate-a-hardwood-quote': 'guide-evaluate-quote',
  'reference-condominium-concrete-slab': 'guide-ref-condo',
  'reference-radiant-heat-main-floor': 'guide-ref-radiant',
  'reference-refinishing-existing-hardwood': 'guide-ref-refinish',
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
  if (!guide) return { title: 'Not found | EcoWoods' };
  return {
    title: `${guide.title} | EcoWoods`,
    description: guide.summary,
    alternates: { canonical: `/guides/${guide.slug}` },
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
  const siblings = getGuides(guide.kind).filter((g) => g.slug !== guide.slug);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    '@id': `${SITE_URL}/guides/${guide.slug}#article`,
    headline: guide.title,
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
          <h1 className="tlx-title">{guide.title}</h1>
          <p className="gd-question">{guide.question}</p>
          <p className="tlx-lede">{guide.summary}</p>
          <Illustration id={GUIDE_IMAGE[guide.slug] ?? ''} priority />
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
