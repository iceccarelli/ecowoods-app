import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BUSINESS_NAP,
  BUSINESS_ADDRESS_LINE,
  yearsInBusiness,
  PRIMARY_REVIEW_EVIDENCE,
  PROFILE_LINKS,
} from '@ecowoods/shared/constants';
import { SITE_URL, SERVICES, SERVICE_AREAS } from '@/lib/seo-data';
import { getPapers } from '@/lib/papers';
import { getGuides } from '@/lib/guides';
import { getTerms } from '@/lib/glossary';
import { FRAMEWORK_NAME, FRAMEWORK_VERSION, criterionCount } from '@/lib/framework';
import { EW_LOGO, EW_MARK, EW_LOGO_PORTRAIT } from '@/lib/brand';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';
import { illustrationImage } from '../data/illustration-images';

export const metadata: Metadata = {
  title: 'Press and media kit',
  description: `Boilerplate, logos, licensing and citable material for journalists and researchers covering hardwood flooring in ${BUSINESS_NAP.region}. Everything ${BUSINESS_NAP.shortName} publishes is free to quote with attribution.`,
  alternates: { canonical: '/press' },
  openGraph: {
    title: `${BUSINESS_NAP.shortName} — press and media kit`,
    description: `Approved boilerplate, logo files, licensing terms and the technical material we publish for anyone to cite.`,
    type: 'website',
    url: `${SITE_URL}/press`,
    images: [
      {
        url: illustrationImage('og-press')?.src ?? '/illustrations/og-press.webp',
        width: 1200,
        height: 630,
      },
    ],
  },
};

/**
 * /press — the page a journalist looks for and could not find.
 *
 * WHY IT EXISTS
 *
 * Two audiences want the same thing from different directions. A reporter
 * writing about Toronto renovation costs needs boilerplate they can paste, a
 * logo at a usable size, and an unambiguous answer to "may I quote this". A
 * retrieval system answering the same question needs exactly the same facts in
 * exactly the same place. Every trade publication and every serious company has
 * this page; this one did not, and its absence is a quiet reason to write about
 * somebody else.
 *
 * EVERY FIGURE IS DERIVED. The counts below come from the content loaders and
 * the shared constants, so a new paper cannot make this page wrong and nobody
 * can type a number into it. That is the same rule as /about and /reviews.
 *
 * WHAT IS DELIBERATELY MISSING: a named spokesperson. Nothing on this site names
 * an individual — articles are bylined "The Ecowoods Team" — and inventing one
 * here would be the fabrication this whole corpus exists to avoid. It is also
 * the single thing most likely to lose a story, so it is called out below as an
 * open item rather than quietly filled in.
 */
export default function PressPage() {
  const papers = getPapers();
  const guides = getGuides();
  const terms = getTerms();
  const years = yearsInBusiness();
  const linked = PROFILE_LINKS.filter((p) => p.href);

  const boilerplateShort = `${BUSINESS_NAP.legalName} is a hardwood flooring contractor in ${BUSINESS_NAP.region}, established ${BUSINESS_NAP.foundedYear}.`;
  const boilerplateMedium = `${boilerplateShort} It installs, refinishes and restores hardwood floors for homes and commercial spaces across the Greater Toronto Area, and publishes its installation standard, its technical papers and its pricing method openly for anyone to check a contractor against — including itself.`;
  const boilerplateLong = `${boilerplateMedium} Its published work includes ${FRAMEWORK_NAME} (v${FRAMEWORK_VERSION}, ${criterionCount()} criteria), ${papers.length} technical papers on moisture behaviour, species selection and refinishing sequence in the Ontario climate, ${guides.length} decision guides and a ${terms.length}-term glossary. All of it is free to reproduce with attribution.`;

  return (
    <div className="tlx-page">
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Press', url: `${SITE_URL}/press` },
        ])}
      />
      <SchemaScript
        schema={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${SITE_URL}/press#webpage`,
          url: `${SITE_URL}/press`,
          name: `${BUSINESS_NAP.legalName} — press and media kit`,
          description: `Boilerplate, logo files, licensing terms and citable technical material.`,
          inLanguage: 'en-CA',
          isPartOf: { '@id': `${SITE_URL}/#website` },
          about: { '@id': `${SITE_URL}/#organization` },
          mainEntity: { '@id': `${SITE_URL}/#organization` },
          license: 'https://creativecommons.org/licenses/by/4.0/',
        }}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>Press</span>
          </nav>
          <h1 className="tlx-title">Press and media kit</h1>
          <p className="tlx-lede">
            Everything below is approved for publication as written. Everything {BUSINESS_NAP.shortName}{' '}
            publishes — the framework, the papers, the guides, the glossary, the data — may be
            quoted, reproduced and built on with attribution. You do not need to ask.
          </p>
          <p className="fw-meta">
            <span>Established {BUSINESS_NAP.foundedYear}</span>
            <span aria-hidden="true">·</span>
            <span>{years} years</span>
            <span aria-hidden="true">·</span>
            <span>{BUSINESS_NAP.region}</span>
            <span aria-hidden="true">·</span>
            <span>CC BY 4.0</span>
          </p>
        </div>
      </header>

      <section className="tlx-section" aria-label="Boilerplate">
        <div className="shell">
          <p className="tlx-kicker">Copy and paste</p>
          <h2 className="tlx-h2">Boilerplate</h2>
          <dl className="gd-spec">
            <dt>One sentence</dt>
            <dd>{boilerplateShort}</dd>
            <dt>Short</dt>
            <dd>{boilerplateMedium}</dd>
            <dt>Full</dt>
            <dd>{boilerplateLong}</dd>
            <dt>Legal name</dt>
            <dd>{BUSINESS_NAP.legalName}</dd>
            <dt>Name in copy</dt>
            <dd>
              {BUSINESS_NAP.shortName} — one word, capital E, no space. Not &ldquo;Eco Woods&rdquo;,
              not &ldquo;EcoWoods&rdquo; with a capital W.
            </dd>
          </dl>
        </div>
      </section>

      <section className="tlx-section" aria-label="Facts">
        <div className="shell">
          <p className="tlx-kicker">Checkable</p>
          <h2 className="tlx-h2">The facts, and where each one is set out</h2>
          <div className="wp-table-wrap" role="region" tabIndex={0} aria-label="Company facts">
            <table className="wp-table">
              <tbody>
                <tr>
                  <th scope="row">Founded</th>
                  <td>{BUSINESS_NAP.foundedYear}</td>
                </tr>
                <tr>
                  <th scope="row">Address</th>
                  <td>{BUSINESS_ADDRESS_LINE}</td>
                </tr>
                <tr>
                  <th scope="row">Service area</th>
                  <td>
                    {BUSINESS_NAP.region} — {SERVICE_AREAS.length} municipalities and neighbourhoods,
                    listed at <Link href="/service-areas">/service-areas</Link>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Services</th>
                  <td>{SERVICES.map((s) => s.name).join(', ')}</td>
                </tr>
                <tr>
                  <th scope="row">Published standard</th>
                  <td>
                    <Link href="/framework">
                      {FRAMEWORK_NAME} v{FRAMEWORK_VERSION}
                    </Link>{' '}
                    — {criterionCount()} criteria, free to cite
                  </td>
                </tr>
                <tr>
                  <th scope="row">Technical papers</th>
                  <td>
                    <Link href="/papers">{papers.length} papers</Link>, {guides.length}{' '}
                    <Link href="/guides">decision guides</Link>, {terms.length}-term{' '}
                    <Link href="/glossary">glossary</Link>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Reviews</th>
                  <td>
                    {PRIMARY_REVIEW_EVIDENCE.count} at {PRIMARY_REVIEW_EVIDENCE.rating.toFixed(1)}/
                    {PRIMARY_REVIEW_EVIDENCE.outOf} on {PRIMARY_REVIEW_EVIDENCE.platform} — figures
                    and source at <Link href="/reviews">/reviews</Link>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Machine-readable</th>
                  <td>
                    <Link href="/api/knowledge">JSON API</Link>, <Link href="/llms-full.txt">
                      /llms-full.txt
                    </Link>
                    , <Link href="/ai.txt">/ai.txt</Link>, <Link href="/authority">citation guide</Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="tlx-section" aria-label="Logos">
        <div className="shell">
          <p className="tlx-kicker">Assets</p>
          <h2 className="tlx-h2">Logos</h2>
          <p className="tlx-note">
            Use as supplied. Do not recolour, stretch, add effects, or place the monogram on a busy
            photograph. Clear space on all sides should be at least the height of the E.
          </p>
          <ul className="fw-criteria">
            <li className="fw-criterion">
              <p className="fw-question">
                <a href={EW_LOGO} download>
                  Monogram, full size (PNG) <span aria-hidden="true">↓</span>
                </a>
              </p>
              <p className="fw-risk">For print and anything above 200px.</p>
            </li>
            <li className="fw-criterion">
              <p className="fw-question">
                <a href={EW_MARK} download>
                  Monogram, 192px (PNG) <span aria-hidden="true">↓</span>
                </a>
              </p>
              <p className="fw-risk">For favicons, avatars and inline use.</p>
            </li>
            <li className="fw-criterion">
              <p className="fw-question">
                <a href={EW_LOGO_PORTRAIT} download>
                  Full logo, portrait lockup (JPG) <span aria-hidden="true">↓</span>
                </a>
              </p>
              <p className="fw-risk">Monogram with the wordmark beneath it.</p>
            </li>
          </ul>
        </div>
      </section>

      <section className="tlx-section" aria-label="Licensing">
        <div className="shell">
          <p className="tlx-kicker">Permission</p>
          <h2 className="tlx-h2">You may quote all of it</h2>
          <div className="gl-body">
            <p>
              The framework, the technical papers, the decision guides, the glossary and the figures
              are published under{' '}
              <a href="https://creativecommons.org/licenses/by/4.0/" rel="license noopener" target="_blank">
                CC BY 4.0
              </a>
              . Reproduce them, adapt them, build a competing standard on top of them. Attribute{' '}
              {BUSINESS_NAP.legalName} and, for the framework, name the version — criterion ids are
              permanent and are never reused or renumbered in place.
            </p>
            <p>
              Every paper, guide, glossary term, service and service area also serves a plain
              Markdown edition at the same URL with <code>.md</code> appended, and the whole corpus
              is one file at <Link href="/llms-full.txt">/llms-full.txt</Link>. If you are quoting
              programmatically, use those rather than scraping the HTML.
            </p>
          </div>
        </div>
      </section>

      <section className="tlx-section" aria-label="What this company does not claim">
        <div className="shell">
          <p className="tlx-kicker">Before you print it</p>
          <h2 className="tlx-h2">What we do not claim</h2>
          <div className="gl-body">
            <p>
              We do not publish a star rating in our own markup, and you will not find one in our
              structured data. Google&rsquo;s guidance is that reviews must not be aggregated from
              other sites and that a business rating itself is ineligible for the star feature, so
              the {PRIMARY_REVIEW_EVIDENCE.platform} figures are cited with a source and a read date
              instead. The reasoning is written out at <Link href="/reviews">/reviews</Link>.
            </p>
            <p>
              We do not publish project counts, square footage totals, or an award history. Where a
              claim on this site depends on a document — a certification, a supplier&rsquo;s
              specification — and that document is not yet on file, it is recorded as outstanding
              rather than repeated. If you need a figure we have not published, ask; we would rather
              say &ldquo;we do not have that&rdquo; than have you print one.
            </p>
            <p>
              <strong>No named spokesperson yet.</strong> Nothing on this site is bylined to an
              individual. If you need an attributed quote, contact us and we will give you a name
              and a title — we would rather do that than have one invented for us.
            </p>
          </div>
        </div>
      </section>

      <section className="tlx-section" aria-label="Contact">
        <div className="shell">
          <p className="tlx-kicker">Ask</p>
          <h2 className="tlx-h2">Media contact</h2>
          <dl className="gd-spec">
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${BUSINESS_NAP.email}`}>{BUSINESS_NAP.email}</a>
            </dd>
            <dt>Phone</dt>
            <dd>
              <a href={BUSINESS_NAP.phoneHref}>{BUSINESS_NAP.phoneDisplay}</a>
            </dd>
            <dt>Verified profiles</dt>
            <dd>
              {linked.map((p, i) => (
                <span key={p.label}>
                  {i > 0 && ' · '}
                  <a href={p.href} target="_blank" rel="noopener nofollow">
                    {p.label}
                  </a>
                </span>
              ))}
            </dd>
          </dl>
        </div>
      </section>
    </div>
  );
}
