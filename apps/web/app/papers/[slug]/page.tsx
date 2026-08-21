import type { Metadata } from 'next';
import { Illustration } from '../../components/Illustration';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPaper, getPapers, pdfHref, pdfIsPublished, type Paper } from '@/lib/papers';
import { SchemaScripts } from '@/lib/schema/components';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ecowoods.ca';

export function generateStaticParams() {
  return getPapers().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const paper = getPaper(slug);
  if (!paper) return {};
  const url = `${SITE_URL}/papers/${paper.slug}`;
  return {
    // Title only. This used to be `${title} — ${subtitle} | EcoWoods`, which the
    // root template then extended with ' · Ecowoods' — 130+ characters ending in
    // the brand name twice, of which a search result shows roughly sixty. The
    // subtitle is not lost: it is the first thing in the description below and it
    // is the h2 on the page itself. See F-143.
    title: paper.title,
    description: paper.abstract,
    alternates: { canonical: url },
    openGraph: {
      title: `${paper.title} — EcoWoods Technical Paper`,
      description: paper.abstract,
      type: 'article',
      url,
      publishedTime: paper.publishedAt,
    },
  };
}

const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

function schemasFor(paper: Paper) {
  const url = `${SITE_URL}/papers/${paper.slug}`;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      '@id': `${url}#article`,
      headline: paper.title,
      alternativeHeadline: paper.subtitle,
      abstract: paper.abstract,
      description: paper.abstract,
      url,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      inLanguage: 'en-CA',
      datePublished: paper.publishedAt,
      dateModified: paper.publishedAt,
      version: paper.version,
      proficiencyLevel: 'Expert',
      // Both point at the organization node the entity graph already defines,
      // so a paper attaches to the existing entity instead of creating a
      // second, unlinked identity for the same business.
      author: { '@id': `${SITE_URL}/#organization` },
      publisher: { '@id': `${SITE_URL}/#organization` },
      about: paper.topics.map((t) => ({ '@type': 'Thing', name: t })),
      spatialCoverage: {
        '@type': 'Place',
        name: 'Toronto and the Greater Toronto Area',
      },
      articleSection: paper.sections.map((s) => s.heading),
      ...(pdfIsPublished(paper)
        ? {
            associatedMedia: {
              '@type': 'DigitalDocument',
              name: `${paper.title} (PDF)`,
              encodingFormat: 'application/pdf',
              contentUrl: `${SITE_URL}${pdfHref(paper)}`,
            },
          }
        : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Technical Papers', item: `${SITE_URL}/papers` },
        { '@type': 'ListItem', position: 3, name: paper.title, item: url },
      ],
    },
    /**
     * One HowTo per ordered section.
     *
     * The HowTo type has sat in lib/schema/types.ts since the schema layer was
     * written and has never been emitted anywhere. Meanwhile the papers carry
     * seven ordered procedures across 38 steps — moisture testing, the
     * non-negotiable protocol, the installer checklist, the full refinishing
     * sequence — every one exactly the shape HowTo describes.
     *
     * This is the richest structured type an answer engine can consume. Asked
     * "how do you acclimate hardwood in Toronto", a model with HowTo returns
     * ordered steps attributed to a source; without it, it infers them from
     * prose and attributes nothing.
     *
     * The steps are the published `ordered` arrays and nothing else, so the
     * markup cannot assert anything the page does not already say. Anchored by
     * @id so each procedure is addressable independently of its paper.
     */
    ...paper.sections
      .filter((sec) => sec.ordered && sec.ordered.length > 1)
      .map((sec) => ({
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        '@id': `${url}#howto-${sec.id}`,
        name: sec.heading,
        description: sec.body?.[0] ?? paper.abstract,
        inLanguage: 'en-CA',
        isPartOf: { '@id': `${url}#article` },
        mainEntityOfPage: { '@type': 'WebPage', '@id': `${url}#${sec.id}` },
        publisher: { '@id': `${SITE_URL}/#organization` },
        step: (sec.ordered ?? []).map((text, i) => ({
          '@type': 'HowToStep',
          position: i + 1,
          name: text.replace(/\s*[—–-].*$/, '').slice(0, 90),
          text,
          url: `${url}#${sec.id}`,
        })),
      })),
  ];
}

/** Paper slug → hero illustration id. */
const PAPER_IMAGE: Record<string, string> = {
  'toronto-hardwood-climate-moisture-protocol': 'paper-climate',
  'hardwood-selection-and-cost-framework-gta': 'paper-selection',
  'hardwood-refinishing-machines-and-sequence': 'paper-craft',
};

export default async function PaperPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const paper = getPaper(slug);
  if (!paper) notFound();

  const others = getPapers().filter((p) => p.slug !== paper.slug);

  return (
    <div className="tlx-page">
      <SchemaScripts schemas={schemasFor(paper)} />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden>/</span>
            <Link href="/papers">Technical Papers</Link>
            <span aria-hidden>/</span>
            <span>{paper.title}</span>
          </nav>
          <p className="tlx-kicker">Technical paper · v{paper.version}</p>
          <h1 className="tlx-title">{paper.title}</h1>
          <p className="wp-hero-sub">{paper.subtitle}</p>
          <p className="tlx-lede">{paper.summary}</p>
          <Illustration id={PAPER_IMAGE[paper.slug] ?? ''} priority />

          <div className="tlx-meta">
            <span>
              Published <strong>{fmt(paper.publishedAt)}</strong>
            </span>
            <span>
              <strong>{paper.pages}</strong> pages
            </span>
            <span>
              <strong>{paper.readingMinutes} min</strong> read
            </span>
            <span>
              For <strong>{paper.audience}</strong>
            </span>
          </div>

          {pdfIsPublished(paper) && (
            <p className="wp-hero-actions">
              <a className="wp-btn" href={pdfHref(paper)} target="_blank" rel="noopener">
                Download PDF
                <span className="wp-ext" aria-hidden="true">
                  ↗
                </span>
                <span className="wp-sr"> (PDF, opens in a new tab)</span>
              </a>
            </p>
          )}
        </div>
      </header>

      <div className="wp-layout shell">
        <nav className="wp-toc" aria-label="Contents">
          <p className="wp-toc-label">Contents</p>
          <ol>
            {paper.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.heading}</a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="wp-article">
          {paper.sections.map((section) => (
            <section key={section.id} id={section.id} className="wp-section">
              <h2>{section.heading}</h2>

              {section.body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}

              {section.bullets && (
                <ul className="wp-bullets">
                  {section.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}

              {section.ordered && (
                <ol className="wp-steps">
                  {section.ordered.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ol>
              )}

              {section.table && (
                <div className="wp-table-wrap" role="region" tabIndex={0} aria-label={section.table.caption ?? `${section.heading} table`}>
                  <table className="wp-table">
                    {section.table.caption && <caption>{section.table.caption}</caption>}
                    <thead>
                      <tr>
                        {section.table.head.map((h) => (
                          <th key={h} scope="col">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.table.rows.map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, j) =>
                            j === 0 ? (
                              <th key={j} scope="row">
                                {cell}
                              </th>
                            ) : (
                              <td key={j}>{cell}</td>
                            )
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {section.callout && (
                <aside className="wp-callout">
                  <p className="wp-callout-label">{section.callout.label}</p>
                  <p>{section.callout.text}</p>
                </aside>
              )}
            </section>
          ))}

          {pdfIsPublished(paper) && (
            <section className="wp-section" aria-label="Download">
              <div className="tlx-cta">
                <h2>Take it with you</h2>
                <p>The full paper, formatted for print and for sending on.</p>
                <a className="btn btn-copper" href={pdfHref(paper)} target="_blank" rel="noopener">
                  Download the PDF
                  <span className="wp-sr"> (opens in a new tab)</span>
                </a>
              </div>
            </section>
          )}
        </article>
      </div>

      {others.length > 0 && (
        <section className="tlx-section" aria-label="More papers">
          <div className="shell">
            <p className="tlx-kicker">Also published</p>
            <h2 className="tlx-h2">More technical papers</h2>
            <div className="tlx-grid">
              {others.map((p) => (
                <Link key={p.slug} className="tlx-card" href={`/papers/${p.slug}`}>
                  <span className="tlx-card-tag">Technical paper</span>
                  <h3>{p.title}</h3>
                  <p>{p.abstract}</p>
                  <div className="tlx-card-data">
                    <span>{p.pages} pages</span>
                    <span>{p.readingMinutes} min read</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
