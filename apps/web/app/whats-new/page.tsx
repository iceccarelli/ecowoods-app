import type { Metadata } from 'next';
import Link from 'next/link';
import { getChangelog, KIND_LABEL } from '@/lib/changelog';
import { getStandards, stalenessDays, REVIEW_INTERVAL_DAYS } from '@/lib/standards';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

/**
 * /whats-new — this business's own releases, dated, newest first.
 *
 * The AWS "What's New" pattern, and the important half of it is what it is NOT:
 * a digest of other people's headlines. AWS's feed carries AWS's announcements —
 * its authority comes from being the primary source. An aggregator competes with
 * its own inputs and loses, because the reader can always go upstream.
 */

/**
 * Rendered daily. This page counts how many standards are past their review
 * interval, which is a function of today's date — frozen at build without this.
 * See the note in app/standards/page.tsx.
 */
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "What's New | EcoWoods",
  description:
    'Everything newly published by Ecowoods on hardwood flooring — technical papers, decision guides, figures, the Well-Installed Framework and the public data API — dated, newest first.',
  alternates: { canonical: '/whats-new' },
  openGraph: {
    title: "What's New — EcoWoods",
    description: 'Newly published papers, guides, figures and tools. Dated, newest first.',
    type: 'website',
    url: `${SITE_URL}/whats-new`,
  },
};

export default function WhatsNewPage() {
  const entries = getChangelog();
  const now = new Date();
  const standards = getStandards();
  const due = standards.filter((s) => stalenessDays(s, now) > REVIEW_INTERVAL_DAYS).length;

  return (
    <div className="tlx-page">
      <SchemaScript
        schema={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          '@id': `${SITE_URL}/whats-new#collection`,
          name: "What's New — EcoWoods",
          url: `${SITE_URL}/whats-new`,
          isPartOf: { '@id': `${SITE_URL}/#website` },
          publisher: { '@id': `${SITE_URL}/#organization` },
          hasPart: entries.map((e) => ({
            '@type': 'CreativeWork',
            headline: e.title,
            datePublished: e.date,
            url: `${SITE_URL}${e.href}`,
            description: e.body,
          })),
        }}
      />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: "What's New", url: `${SITE_URL}/whats-new` },
        ])}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>What&rsquo;s New</span>
          </nav>
          <h1 className="tlx-title">What&rsquo;s new</h1>
          <p className="tlx-lede">
            Everything newly published here, dated and newest first. This carries our own releases
            rather than a digest of the trade press — a site that republishes other people&rsquo;s
            news is a secondary source competing with its own inputs.
          </p>
          <p className="fw-meta">
            <span>{entries.length} entries</span>
            <span aria-hidden="true">·</span>
            <span>
              <a href="/feed.xml">RSS</a>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <Link href="/standards">Standards watch</Link>
            </span>
          </p>
        </div>
      </header>

      <section className="tlx-section" aria-label="Releases">
        <div className="shell">
          <ol className="wn-list">
            {entries.map((e) => (
              <li key={e.id} className="wn-item" id={`e-${e.id}`}>
                <div className="wn-meta">
                  <time dateTime={e.date} className="wn-date">
                    {e.date}
                  </time>
                  <span className="wn-kind">{KIND_LABEL[e.kind]}</span>
                </div>
                <div className="wn-body">
                  <h2>
                    <Link href={e.href}>{e.title}</Link>
                  </h2>
                  <p>{e.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="tlx-section" aria-label="Standards watch">
        <div className="shell">
          <p className="tlx-kicker">Outside this site</p>
          <h2 className="tlx-h2">What we watch, and when we last checked</h2>
          <p className="tlx-note">
            The bodies and documents this work answers to are tracked separately, with the date each
            entry was last verified against the issuing body&rsquo;s own page.{' '}
            {due === 0
              ? 'Every entry is inside its review interval.'
              : `${due} ${due === 1 ? 'entry is' : 'entries are'} due for re-verification.`}
          </p>
          <div className="fw-actions">
            <Link className="fw-cta fw-cta--ghost" href="/standards">
              The standards register →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
