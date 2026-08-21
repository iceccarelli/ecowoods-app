import type { Metadata } from 'next';
import Link from 'next/link';
import { getPapers, pdfHref, pdfIsPublished } from '@/lib/papers';
import { SchemaScript } from '@/lib/schema/components';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ecowoods.ca';

export const metadata: Metadata = {
  title: 'Technical Papers',
  description:
    'Downloadable engineering papers on hardwood flooring in Toronto and the GTA: moisture protocol, climate behaviour, species selection, installed cost, and how to evaluate an installer.',
  alternates: { canonical: `${SITE_URL}/papers` },
  openGraph: {
    title: 'Technical Papers — EcoWoods',
    description:
      'Engineering papers on hardwood flooring in Toronto: moisture protocol, species selection, installed cost, and installer evaluation.',
    type: 'website',
    url: `${SITE_URL}/papers`,
  },
};

const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

export default function PapersIndexPage() {
  const papers = getPapers();

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${SITE_URL}/papers#collection`,
    name: 'EcoWoods Technical Papers',
    description: metadata.description,
    url: `${SITE_URL}/papers`,
    inLanguage: 'en-CA',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    publisher: { '@id': `${SITE_URL}/#organization` },
    hasPart: papers.map((p) => ({
      '@type': 'TechArticle',
      '@id': `${SITE_URL}/papers/${p.slug}#article`,
      headline: p.title,
      abstract: p.abstract,
      url: `${SITE_URL}/papers/${p.slug}`,
      datePublished: p.publishedAt,
    })),
  };

  return (
    <div className="tlx-page">
      <SchemaScript schema={schema} />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden>/</span>
            <span>Technical Papers</span>
          </nav>
          <h1 className="tlx-title">Technical Papers</h1>
          <p className="tlx-lede">
            The engineering behind the work, written down and published. Each paper is readable in
            full on this site and downloadable as a PDF.
          </p>
        </div>
      </header>

      <section className="tlx-section" aria-label="Papers">
        <div className="shell">
          <p className="tlx-kicker">Library</p>
          <h2 className="tlx-h2">Published papers</h2>
          <p className="tlx-note">
            Written for homeowners, designers and trades working with hardwood in Toronto and the
            Greater Toronto Area.
          </p>

          <ul className="wp-list">
            {papers.map((paper) => (
              <li key={paper.slug} className="wp-item">
                <div className="wp-item-main">
                  <p className="tlx-card-tag">
                    Technical paper · v{paper.version} · {fmt(paper.publishedAt)}
                  </p>
                  <h3 className="wp-item-title">
                    <Link href={`/papers/${paper.slug}`}>{paper.title}</Link>
                  </h3>
                  <p className="wp-item-sub">{paper.subtitle}</p>
                  <p className="wp-item-abstract">{paper.abstract}</p>

                  <ul className="wp-topics">
                    {paper.topics.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>

                <div className="wp-item-side">
                  <dl className="tlx-specs wp-specs">
                    <div className="tlx-spec">
                      <dt>Pages</dt>
                      <dd>{paper.pages}</dd>
                    </div>
                    <div className="tlx-spec">
                      <dt>Read</dt>
                      <dd>{paper.readingMinutes} min</dd>
                    </div>
                  </dl>
                  <Link className="wp-btn" href={`/papers/${paper.slug}`}>
                    Read the paper
                  </Link>
                  {pdfIsPublished(paper) && (
                    <a
                      className="wp-btn wp-btn--ghost"
                      href={pdfHref(paper)}
                      target="_blank"
                      rel="noopener"
                    >
                      Download PDF
                      <span className="wp-ext" aria-hidden="true">
                        ↗
                      </span>
                      <span className="wp-sr"> (PDF, opens in a new tab)</span>
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="tlx-section" aria-label="Keep reading">
        <div className="shell">
          <div className="tlx-cta">
            <h2>Want the deeper reference?</h2>
            <p>
              The Technical Library carries the full set of articles and case studies behind these
              papers.
            </p>
            <Link className="btn btn-copper" href="/technical-library">
              Open the Technical Library
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
