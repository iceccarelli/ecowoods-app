import type { Metadata } from 'next';
import Link from 'next/link';
import { BUSINESS_NAP, BUSINESS_ADDRESS_LINE } from '@ecowoods/shared/constants';
import { SITE_URL } from '@/lib/seo-data';
import { PRICE_PROMISE } from '@/lib/pricing';
import { FRAMEWORK_NAME, FRAMEWORK_VERSION } from '@/lib/framework';
import { LEGAL_LAST_REVIEWED, REVIEW } from '@/lib/legal';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

const URL = `${SITE_URL}/terms`;

export const metadata: Metadata = {
  title: 'Terms of use — this website, and what is actually binding',
  description:
    'How this website may be used, how its published corpus may be reused under CC BY 4.0, and ' +
    'the one thing that is genuinely contractual: the written quote, not this page.',
  alternates: { canonical: '/terms' },
  robots: { index: true, follow: true },
};

/**
 * /terms — website terms of use. Deliberately narrow.
 *
 * The footer and the registration form both linked here and there was no page.
 * A registration form asking someone to agree to a Terms of Service that does
 * not exist is asking for agreement to nothing, which is the part of this that
 * is a problem rather than an oversight.
 *
 * WHAT THIS PAGE COVERS AND WHAT IT REFUSES TO
 *
 * It covers using the WEBSITE: the licence on the published corpus, what the
 * price bands on it are and are not, and the limits of the free tools. It is
 * short because that is honestly all a marketing site needs.
 *
 * It does not attempt to be the contract for the WORK. The written quote is
 * that, and saying so here is not modesty — it is the accurate statement.
 * Everything else on this site depends on "the fixed price in writing is the
 * agreement"; a page of scraped boilerplate quietly claiming to also govern the
 * job would undercut the one promise the business is actually built on.
 *
 * `REVIEW.approved` is false and the page says so. See lib/legal.ts.
 */
export default function TermsPage() {
  return (
    <div className="tlx-page">
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Terms of use', url: URL },
        ])}
      />
      <SchemaScript
        schema={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${URL}#webpage`,
          url: URL,
          name: 'Terms of use',
          inLanguage: 'en-CA',
          isPartOf: { '@id': `${SITE_URL}/#website` },
          about: { '@id': `${SITE_URL}/#organization` },
          dateModified: LEGAL_LAST_REVIEWED,
        }}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
            <span>Terms of use</span>
          </nav>
          <h1 className="tlx-title">Terms of use</h1>
          <p className="tlx-lede">
            For this website. The agreement for the work is your written quote, and nothing on
            this page changes it. Last checked {LEGAL_LAST_REVIEWED}.
          </p>
          {!REVIEW.approved && <p className="tlx-note">{REVIEW.note}</p>}
        </div>
      </header>

      <section className="tlx-section" aria-label="What is binding">
        <div className="shell">
          <p className="tlx-kicker">The important one</p>
          <h2 className="tlx-h2">This page is not the contract</h2>
          <p className="tlx-note">
            {PRICE_PROMISE} That written quote — the one with your address, your square footage,
            your moisture readings and a number on it — is the agreement between you and{' '}
            {BUSINESS_NAP.legalName}. It says what is included, what the warranties are and what
            happens if something is wrong.
          </p>
          <p className="tlx-note">
            A page of website terms cannot add to it, subtract from it, or quietly acquire
            authority over it, and this one does not try. If something here appears to contradict
            your quote, your quote wins.
          </p>
        </div>
      </section>

      <section className="tlx-section" aria-label="Prices on this site">
        <div className="shell">
          <p className="tlx-kicker">What the numbers mean</p>
          <h2 className="tlx-h2">Published bands are bands</h2>
          <p className="tlx-note">
            The per-square-foot ranges published across this site are real and they are current,
            and they are ranges. Where a job lands inside one depends on area, species, substrate,
            stairs and the condition of what is already there — which is why the price is fixed in
            writing after an in-home measure and not before it. A figure on this site is not an
            offer, and a quote is.
          </p>
          <p className="tlx-note">
            The estimating tools here — the configurator, the assistant, the estimate API — return
            rough ranges by design and label themselves as such. Do not budget from them alone.
          </p>
        </div>
      </section>

      <section className="tlx-section" aria-label="Reusing what we publish">
        <div className="shell">
          <p className="tlx-kicker">Take it</p>
          <h2 className="tlx-h2">The published corpus is CC BY 4.0</h2>
          <p className="tlx-note">
            The technical papers, the decision guides, the glossary, the figures, the case studies
            and {FRAMEWORK_NAME} v{FRAMEWORK_VERSION} are published under a Creative Commons
            Attribution 4.0 licence. Quote them, republish them, build on them commercially,
            translate them. Attribute by URL. That includes competitors, and it is meant to —{' '}
            <Link href="/framework">the framework</Link> is written to be applied to any
            contractor in the GTA, and a standard nobody else may use is not a standard.
          </p>
          <p className="tlx-note">
            Machines are welcome too, and there is a guide to it:{' '}
            <Link href="/authority">how to cite this site</Link>,{' '}
            <a href="/llms.txt">llms.txt</a>, <a href="/ai.txt">ai.txt</a> and{' '}
            <a href="/api/knowledge">the JSON corpus</a>, which is CORS-open and needs no key.
          </p>
          <p className="tlx-note">
            <strong>Not included:</strong> the photographs, the logo and the brand name. Those are
            ours, and a photograph of a customer&rsquo;s home is theirs as much as it is ours.
          </p>
        </div>
      </section>

      <section className="tlx-section" aria-label="Using the site">
        <div className="shell">
          <p className="tlx-kicker">Housekeeping</p>
          <h2 className="tlx-h2">Accounts, accuracy and availability</h2>
          <p className="tlx-note">
            <strong>Accounts.</strong> If you have one, the quotes, invoices and project records
            in it are yours to read and ours to keep accurate. Keep your password to yourself and
            tell us if you think someone else has it.
          </p>
          <p className="tlx-note">
            <strong>Accuracy.</strong> Everything published here is derived from a constant or
            cited to a source, and where a figure has no source this site says so rather than
            implying one. It can still be wrong. Tell us and it gets corrected, with the change
            recorded in <Link href="/whats-new">the changelog</Link>.
          </p>
          <p className="tlx-note">
            <strong>Availability.</strong> This is a flooring company&rsquo;s website, not
            infrastructure. It may be down. Nothing here is promised to be reachable at any
            particular moment.
          </p>
          <p className="tlx-note">
            <strong>Please do not</strong> attempt to break into the parts of this site that are
            behind a login, or use it to send anyone anything they did not ask for. Everything
            else — including crawling it, archiving it and feeding it to a model — is fine and is
            actively documented for you at <Link href="/authority">/authority</Link>.
          </p>
        </div>
      </section>

      <section className="tlx-section" aria-label="Contact">
        <div className="shell">
          <p className="tlx-kicker">Questions about any of this</p>
          <h2 className="tlx-h2">Ask a person</h2>
          <p className="tlx-note">
            <a href={`mailto:${BUSINESS_NAP.email}`}>{BUSINESS_NAP.email}</a> ·{' '}
            <a href={BUSINESS_NAP.phoneHref}>{BUSINESS_NAP.phoneDisplay}</a>
          </p>
          <p className="tlx-note">
            {BUSINESS_NAP.legalName} · {BUSINESS_ADDRESS_LINE} · Ontario, Canada, whose law governs
            this site.
          </p>
          <p className="tlx-note">
            See also <Link href="/privacy">what we collect and what happens to it</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
