import type { Metadata } from 'next';
import Link from 'next/link';
import { getFigures } from '@/lib/figures';
import { getPaper } from '@/lib/papers';
import { FigureChart } from '../components/Figure';
import { SITE_URL } from '@/lib/seo-data';
import { illustrationImage } from '../data/illustration-images';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

/**
 * /data — the figures, each independently citable.
 *
 * Scientific publishing solved this a century ago: number the figures, caption
 * them, and let each be referenced without the document around it. A figure with
 * a permalink and a caption is the artifact that ends up in someone else's slide
 * deck with a URL under it. A table inside a paper is not.
 *
 * Each figure emits ImageObject schema pointing at its own anchor, so an answer
 * engine asked for "Toronto indoor humidity chart" has something addressable to
 * return rather than a page it would have to describe.
 */

export const metadata: Metadata = {
  title: 'Data & Figures',
  description:
    'Charted data on hardwood flooring in Toronto: indoor relative humidity against the band hardwood needs, and Janka hardness for the species used across the GTA. Every value is drawn from a published technical paper and free to reuse under CC BY 4.0.',
  alternates: { canonical: '/data' },
  openGraph: {
    title: 'Data & Figures — EcoWoods',
    description:
      'Numbered, captioned, citable figures on Toronto hardwood flooring. Free to reuse with attribution.',
    type: 'website',
    url: `${SITE_URL}/data`,
    images: [{ url: illustrationImage('og-data')?.src ?? '/illustrations/og-data.webp', width: 1200, height: 630 }],
  },
};

export default function DataPage() {
  const figures = getFigures();

  return (
    <div className="tlx-page">
      <SchemaScript
        schema={{
          '@context': 'https://schema.org',
          '@type': 'Dataset',
          '@id': `${SITE_URL}/data#dataset`,
          name: 'EcoWoods hardwood flooring figures',
          description:
            'Charted data on hardwood flooring in Toronto and the GTA, each figure drawn from a published technical paper.',
          url: `${SITE_URL}/data`,
          license: 'https://creativecommons.org/licenses/by/4.0/',
          isAccessibleForFree: true,
          creator: { '@id': `${SITE_URL}/#organization` },
          distribution: {
            '@type': 'DataDownload',
            encodingFormat: 'application/json',
            contentUrl: `${SITE_URL}/api/knowledge?collection=figures`,
          },
          hasPart: figures.map((f) => ({
            '@type': 'ImageObject',
            '@id': `${SITE_URL}/data#fig-${f.id}`,
            name: `Figure ${f.number} — ${f.title}`,
            caption: f.caption,
            url: `${SITE_URL}/data#fig-${f.id}`,
          })),
        }}
      />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Data & Figures', url: `${SITE_URL}/data` },
        ])}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>Data &amp; Figures</span>
          </nav>
          <h1 className="tlx-title">Data &amp; figures</h1>
          <p className="tlx-lede">
            {figures.length} numbered figures, each drawn from a{' '}
            <Link href="/papers">technical paper</Link> on this site and each with its own
            permalink. Every one carries the table it was built from, so the numbers can be checked
            rather than trusted.
          </p>
          <p className="fw-meta">
            <span>CC BY 4.0 — reuse with attribution</span>
            <span aria-hidden="true">·</span>
            <span>
              <a href="/api/knowledge?collection=figures">JSON</a>
            </span>
            <span aria-hidden="true">·</span>
            <span>Print → Save as PDF</span>
          </p>
        </div>
      </header>

      {figures.map((f) => {
        const paper = getPaper(f.source.paper);
        return (
          <section key={f.id} className="tlx-section" aria-label={`Figure ${f.number}`}>
            <div className="shell">
              <FigureChart figure={f} />
              <p className="fig-source">
                Source:{' '}
                <Link href={`/papers/${f.source.paper}#${f.source.section}`}>
                  {paper ? paper.title : f.source.paper} — {f.source.section.replace(/-/g, ' ')}
                </Link>{' '}
                · Permalink: <a href={`/data#fig-${f.id}`}>/data#fig-{f.id}</a>
              </p>
            </div>
          </section>
        );
      })}

      <section className="tlx-section" aria-label="Reuse">
        <div className="shell">
          <p className="tlx-kicker">Reuse</p>
          <h2 className="tlx-h2">These are meant to be taken</h2>
          <p className="tlx-note">
            Screenshot them, embed them, redraw them from the tables. The licence is CC BY 4.0 and
            the only condition is attribution by URL. Every figure is server-rendered SVG with the
            underlying table beside it, so nothing here requires JavaScript, and the machine-readable
            version of the same data is at <a href="/api/knowledge?collection=figures">/api/knowledge</a>.
          </p>
          <div className="fw-actions">
            <Link className="fw-cta fw-cta--ghost" href="/resources">
              All resources
            </Link>
            <Link className="fw-cta fw-cta--ghost" href="/authority">
              Citation guide
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
