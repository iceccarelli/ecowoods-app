import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';
import { SpecSheet } from './SpecSheet';

export const metadata: Metadata = {
  title: 'Your floor specification',
  description:
    'The species, finish, pattern and size you configured, written as a specification you can print, save as a PDF, or send to Ecowoods for a fixed written price.',
  alternates: { canonical: '/design/spec' },
  // Every visitor's spec sheet is a different page at a different querystring.
  // None of them is a document a search engine should hold: they are one
  // person's working file, and indexing them would put strangers' floor
  // configurations into the index for no gain.
  robots: { index: false, follow: true },
};

/**
 * /design/spec — the configurator's output, as a document.
 *
 * WHY A PAGE AND NOT A GENERATED PDF
 *
 * The brief asked for "Download spec PDF". A server-rendered PDF would mean a
 * new binary dependency, a new render path, fonts embedded twice, and a file
 * that is stale the moment somebody changes their mind about the finish.
 *
 * A print-styled page is better on every axis that matters here: the browser's
 * own "Save as PDF" produces a real PDF on every platform, the sheet is a URL
 * that can be sent to a partner or a contractor as easily as a file, it stays
 * live if the configuration changes, and it costs nothing to maintain. The
 * print stylesheet drops the site chrome so what comes out is the sheet.
 *
 * The configuration travels in the querystring, so this page is shareable and
 * needs no session. It reads `ew-design-v1` as a fallback for someone who
 * lands here directly after configuring.
 */
export default function DesignSpecPage() {
  return (
    <div className="tlx-page ds-page">
      {/* A breadcrumb even though this page is noindex. The trail is not only a
          search feature: it tells any consumer — including the person who was
          sent this link — where the sheet came from and how to get back to the
          configurator that made it. verify-link-density requires it of every
          deep page, and the requirement is right here too. */}
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Design your floor', url: `${SITE_URL}/design` },
          { name: 'Specification', url: `${SITE_URL}/design/spec` },
        ])}
      />

      <header className="tlx-hero ds-noprint">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
            <Link href="/design">Design your floor</Link> <span aria-hidden="true">/</span>{' '}
            <span>Specification</span>
          </nav>
          <h1 className="tlx-title">Your floor specification</h1>
          <p className="tlx-lede">
            Everything you chose, written the way an estimator reads it. Print it, save it as a PDF,
            or send it to us and a senior estimator will price exactly this.
          </p>
          <p className="tlx-note">
            The range on this sheet is a range, not a quote. The fixed price is written after we
            measure your subfloor — see <Link href={`${SITE_URL}/framework`}>the framework</Link> for
            what a complete quote has to contain.
          </p>
        </div>
      </header>

      <SpecSheet />
    </div>
  );
}
