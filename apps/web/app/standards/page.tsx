import type { Metadata } from 'next';
import Link from 'next/link';
import { getStandards, stalenessDays, REVIEW_INTERVAL_DAYS } from '@/lib/standards';
import { pillarById, allCriteria } from '@/lib/framework';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

/**
 * /standards — the map of the standards landscape.
 *
 * The register answers a question no competitor in this market answers in
 * public: which bodies govern this trade, which document says what, which of
 * our own criteria depend on it, and WHEN DID YOU LAST CHECK.
 *
 * That last column is the point. Every entry states the date it was verified
 * against the issuing body's own page, and an entry past its review interval
 * says so on the page rather than quietly asserting a currency it no longer has.
 * Publishing your own staleness is a stronger authority signal than publishing
 * a list, because a list anyone can copy and only a maintained one stays true.
 */

/**
 * Rendered daily, not once.
 *
 * This page computes "N days ago" from new Date(). Without a revalidate it is
 * statically rendered at build, that call is frozen at deploy time, and the
 * counter reads "0 days ago" forever — which it did, live, for exactly as long
 * as it took someone to ask whether the site actually updates itself.
 *
 * The staleness column IS the product of this register. A frozen one asserts a
 * currency it does not have, which is the precise failure the page exists to
 * prevent, reproduced inside the page. 86400 = one day: fine-grained enough for
 * a day counter, cheap enough to be free.
 */
export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Standards Register | EcoWoods',
  description:
    'The external standards and bodies hardwood flooring work in Toronto answers to — ASTM concrete moisture and floor preparation methods, NWFA guidelines — each mapped to the Well-Installed Framework criteria that depend on it, with the date we last verified it at the source.',
  alternates: { canonical: '/standards' },
  openGraph: {
    title: 'Standards Register — EcoWoods',
    description:
      'Which bodies govern hardwood flooring, what each document covers, and when we last checked.',
    type: 'website',
    url: `${SITE_URL}/standards`,
    images: [{ url: '/illustrations/og-standards.webp', width: 1200, height: 630 }],
  },
};

const STATUS_LABEL: Record<string, string> = {
  current: 'Current',
  'revision-open': 'Revision open',
  'unverified-edition': 'Edition unverified',
};

export default function StandardsPage() {
  const standards = getStandards();
  const now = new Date();
  const criteria = allCriteria();

  return (
    <div className="tlx-page">
      <SchemaScript
        schema={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          '@id': `${SITE_URL}/standards#collection`,
          name: 'Standards Register — EcoWoods',
          url: `${SITE_URL}/standards`,
          isPartOf: { '@id': `${SITE_URL}/#website` },
          publisher: { '@id': `${SITE_URL}/#organization` },
          hasPart: standards.map((s) => ({
            '@type': 'CreativeWork',
            name: s.designation ? `${s.designation} — ${s.title}` : s.title,
            publisher: { '@type': 'Organization', name: s.body },
            url: s.sourceUrl,
            description: s.governs,
          })),
        }}
      />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Standards', url: `${SITE_URL}/standards` },
        ])}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>Standards</span>
          </nav>
          <h1 className="tlx-title">Standards register</h1>
          <p className="tlx-lede">
            The external documents this trade answers to, each mapped to the{' '}
            <Link href="/framework">framework criteria</Link> that depend on it — and the date we
            last verified it against the issuing body&rsquo;s own page.
          </p>
          <p className="tlx-note">
            We link to the issuing body, never to a reseller or a summary, and we do not reproduce
            the standards themselves. Where an edition could not be confirmed at the source, the
            entry says so instead of guessing.
          </p>
        </div>
      </header>

      {standards.map((s) => {
        const days = stalenessDays(s, now);
        const stale = days > REVIEW_INTERVAL_DAYS;
        return (
          <section key={s.id} className="tlx-section" aria-label={s.title} id={s.id}>
            <div className="shell">
              <article className="std">
                <div className="std-head">
                  <span className="std-body-name">{s.body}</span>
                  {s.designation && <span className="std-desig">{s.designation}</span>}
                  <span className={`std-status std-status--${s.status}`}>
                    {STATUS_LABEL[s.status]}
                  </span>
                </div>
                <h2 className="std-title">{s.title}</h2>
                <p className="std-governs">{s.governs}</p>
                <p className="std-relevance">{s.relevance}</p>

                {s.note && <p className="std-note">{s.note}</p>}

                <dl className="gd-spec">
                  <div className="gd-spec-row">
                    <dt>Primary source</dt>
                    <dd>
                      <a href={s.sourceUrl} rel="noopener nofollow" target="_blank">
                        {s.sourceUrl.replace(/^https:\/\//, '')}
                      </a>
                    </dd>
                  </div>
                  <div className="gd-spec-row">
                    <dt>Last verified</dt>
                    <dd className={stale ? 'std-stale' : undefined}>
                      <time dateTime={s.verifiedAt}>{s.verifiedAt}</time> · {days} day
                      {days === 1 ? '' : 's'} ago
                      {stale ? ` — past the ${REVIEW_INTERVAL_DAYS}-day review interval` : ''}
                    </dd>
                  </div>
                  <div className="gd-spec-row">
                    <dt>Framework pillars</dt>
                    <dd>
                      {s.pillars.map((id, i) => {
                        const p = pillarById(id);
                        if (!p) return null;
                        return (
                          <span key={id}>
                            {i > 0 && ' · '}
                            <Link href={`/framework#${p.id}`}>
                              {p.number}. {p.name}
                            </Link>
                          </span>
                        );
                      })}
                    </dd>
                  </div>
                  {s.criteria && s.criteria.length > 0 && (
                    <div className="gd-spec-row">
                      <dt>Criteria</dt>
                      <dd>
                        {s.criteria.map((cid, i) => {
                          const c = criteria.find((x) => x.id === cid);
                          return (
                            <span key={cid}>
                              {i > 0 && ' · '}
                              <Link href={`/framework#c-${cid}`}>
                                {cid}
                                {c ? ` — ${c.question.slice(0, 60)}${c.question.length > 60 ? '…' : ''}` : ''}
                              </Link>
                            </span>
                          );
                        })}
                      </dd>
                    </div>
                  )}
                </dl>
              </article>
            </div>
          </section>
        );
      })}

      <section className="tlx-section" aria-label="How this is maintained">
        <div className="shell">
          <p className="tlx-kicker">Method</p>
          <h2 className="tlx-h2">How this register is kept honest</h2>
          <p className="tlx-note">
            Every entry carries the date it was last checked at the issuing body&rsquo;s own page,
            and a build guard reports any entry past its {REVIEW_INTERVAL_DAYS}-day review interval
            — so going stale is a visible task rather than something anyone has to remember. A
            register that silently rots is worse than no register: it asserts a currency it does not
            have, to readers with no way to tell.
          </p>
          <p className="tlx-note">
            This is not a news feed and deliberately not an aggregator. Everything we publish
            ourselves is at <Link href="/whats-new">What&rsquo;s new</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
