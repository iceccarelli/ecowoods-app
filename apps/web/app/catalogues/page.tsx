import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CATALOGUES,
  CATALOGUE_SERIES,
  catalogueHref,
  cataloguesInSeries,
  getPublishedCatalogues,
} from '@/lib/catalogues';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

/**
 * /catalogues — the field catalogues, indexed.
 *
 * THE SHAPE IS BORROWED, DELIBERATELY
 *
 * AWS Well-Architected works because the whitepapers are not scattered through
 * the documentation: there is one page that lists every document with its
 * series, its purpose in a sentence, its length, and two controls — read it
 * here, or take the file. A reader who does not yet know which one they want
 * can see all of them in one screen and decide. That is the page this is.
 *
 * WHAT IT IS NOT
 *
 * It is not a second /papers. The technical papers are published as HTML
 * because that is the citable form and a PDF is close to invisible to a
 * language model; nothing about them changes here. The catalogues are the
 * documents a person keeps, and the HTML page each one points at is still the
 * canonical answer to the question it asks. Every card says so by carrying the
 * link.
 *
 * NO FILTER WIDGET, ON PURPOSE. The five series are five sections with real
 * headings and real anchors, so the grouping survives with JavaScript off, is
 * crawlable, and can be linked to — /catalogues#decision is a URL somebody can
 * send. A client-side filter would hide four fifths of this page from the
 * crawler that the whole exercise exists to reach.
 *
 * NOTHING HERE IS TYPED. Titles, purposes, lengths and related links all come
 * from lib/catalogues.ts, and a catalogue whose file is not on disk is not
 * listed at all — the same rule /papers follows for its downloads.
 */

export const metadata: Metadata = {
  title: 'Field Catalogues',
  description:
    /*
     * Derived, not typed. The first version of this line listed the eight
     * subjects by hand; three more documents arrived within the day and the
     * description would have gone on describing eight of them. A meta
     * description that counts its own subject is a fact with two copies.
     */
    `Landscape field catalogues on hardwood flooring in Toronto and the GTA: ${CATALOGUES.map((c) => c.title.replace(/\?$/, '').toLowerCase()).join('; ')}. Free to read, free to keep, nothing gated.`,
  alternates: { canonical: '/catalogues' },
  openGraph: {
    title: 'Field Catalogues — Ecowoods',
    description:
      `The same facts as the site, in a document you can keep: ${CATALOGUES.length} six-page catalogues on hardwood flooring in Toronto and the GTA.`,
    type: 'website',
    url: `${SITE_URL}/catalogues`,
  },
};

export default function CataloguesIndexPage() {
  const catalogues = getPublishedCatalogues();
  const seriesWithItems = CATALOGUE_SERIES.map((s) => ({
    ...s,
    items: cataloguesInSeries(s.id).filter((c) => catalogues.includes(c)),
  })).filter((s) => s.items.length > 0);

  const collection = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${SITE_URL}/catalogues#collection`,
    name: 'Ecowoods Field Catalogues',
    description: metadata.description,
    url: `${SITE_URL}/catalogues`,
    inLanguage: 'en-CA',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    publisher: { '@id': `${SITE_URL}/#organization` },
    license: 'https://creativecommons.org/licenses/by/4.0/',
    hasPart: catalogues.map((c) => ({
      '@type': 'DigitalDocument',
      '@id': `${SITE_URL}${catalogueHref(c)}#document`,
      name: c.title,
      description: c.purpose,
      encodingFormat: 'application/pdf',
      contentUrl: `${SITE_URL}${catalogueHref(c)}`,
      numberOfPages: c.pages,
      datePublished: String(c.year),
      inLanguage: 'en-CA',
      publisher: { '@id': `${SITE_URL}/#organization` },
      ...(c.related[0] ? { isBasedOn: `${SITE_URL}${c.related[0].href}` } : {}),
    })),
  };

  return (
    <div className="tlx-page">
      <SchemaScript schema={collection} />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Field Catalogues', url: `${SITE_URL}/catalogues` },
        ])}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            <span>Field Catalogues</span>
          </nav>
          <h1 className="tlx-title">Field catalogues</h1>
          <p className="tlx-lede">
            The same facts as the site, in a document a homeowner can keep. Not a quote. Not a
            starting-from number. Every one of them is free to read, free to print and free to
            forward to whoever else has to agree to the work.
          </p>
          <p className="fw-meta">
            <span>{catalogues.length} catalogues</span>
            <span aria-hidden="true">·</span>
            <span>{seriesWithItems.length} series</span>
            <span aria-hidden="true">·</span>
            <span>PDF, no email required</span>
          </p>
        </div>
      </header>

      <section className="tlx-section" aria-label="The series">
        <div className="shell">
          <p className="tlx-kicker">How these are organised</p>
          <h2 className="tlx-h2">Five series</h2>
          <ul className="gd-sources">
            {seriesWithItems.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.name}</a> <span className="gl-aka">{s.intent}</span>
              </li>
            ))}
          </ul>
          <p className="tlx-note">
            Each catalogue names the page on this site that answers the same question at length.
            That page is the canonical one — cite it, not the file.
          </p>
        </div>
      </section>

      {seriesWithItems.map((s) => (
        <section className="tlx-section" key={s.id} id={s.id} aria-label={`${s.name} series`}>
          <div className="shell">
            <p className="tlx-kicker">{s.name}</p>
            <h2 className="tlx-h2">{s.intent}</h2>

            <ul className="wp-list">
              {s.items.map((c) => (
                <li key={c.id} className="wp-item" id={c.slug}>
                  <div className="wp-item-main">
                    <p className="tlx-card-tag">
                      {s.name} · No. {c.id} · {c.year}
                    </p>
                    <h3 className="wp-item-title">{c.title}</h3>
                    <p className="wp-item-sub">{c.kicker}</p>
                    <p className="wp-item-abstract">{c.purpose}</p>

                    <ul className="gd-sources" style={{ marginTop: '1.25rem' }}>
                      {c.related.map((r) => (
                        <li key={r.href}>
                          <Link href={r.href}>{r.label}</Link>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="wp-item-side">
                    <dl className="tlx-specs wp-specs">
                      <div className="tlx-spec">
                        <dt>Pages</dt>
                        <dd>{c.pages}</dd>
                      </div>
                      <div className="tlx-spec">
                        <dt>Trim</dt>
                        <dd>{c.trim}</dd>
                      </div>
                    </dl>
                    <a className="wp-btn" href={catalogueHref(c)} target="_blank" rel="noopener">
                      View PDF
                      <span className="wp-ext" aria-hidden="true">
                        ↗
                      </span>
                      <span className="wp-sr"> — {c.file}, opens in a new tab</span>
                    </a>
                    <a className="wp-btn wp-btn--ghost" href={catalogueHref(c)} download={c.file}>
                      Download
                      <span className="wp-sr"> {c.file}, PDF, {c.pages} pages</span>
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      <section className="tlx-section" aria-label="Where the argument is made">
        <div className="shell">
          <div className="tlx-cta">
            <h2>The engineering behind these</h2>
            <p>
              A catalogue is the document you keep. The technical papers are where the method is
              argued in full, with the sources named and the date a human opened each one.
            </p>
            <Link className="btn btn-copper" href="/papers">
              Read the technical papers
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
