import type { Metadata } from 'next';
import Link from 'next/link';
import { IllustrationThumb } from '../components/IllustrationThumb';
import { getGuides } from '@/lib/guides';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList, buildWebPageSchema } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

export const metadata: Metadata = {
  title: 'Decision Guides & Reference Installations',
  description:
    'Structured answers to the decisions a Toronto homeowner actually faces — solid versus engineered, nail-down versus glue-down versus floating, how to evaluate a quote — plus complete reference specifications for the common GTA scenarios.',
  alternates: { canonical: '/guides' },
  openGraph: {
    title: 'Decision Guides & Reference Installations — EcoWoods',
    description:
      'The decision, the criteria that settle it, and the complete specification for the common Toronto scenarios.',
    type: 'website',
    url: `${SITE_URL}/guides`,
  },
};

/** Every guide already owns an image; the index simply never showed it. */
const GUIDE_THUMB: Record<string, string> = {
  'solid-vs-engineered-hardwood-toronto': 'guide-solid-vs-engineered',
  'nail-down-glue-down-or-floating': 'guide-method',
  'how-to-evaluate-a-hardwood-quote': 'guide-evaluate-quote',
  'reference-condominium-concrete-slab': 'guide-ref-condo',
  'reference-radiant-heat-main-floor': 'guide-ref-radiant',
  'reference-refinishing-existing-hardwood': 'guide-ref-refinish',
  'hardwood-flooring-cost-toronto': 'guide-cost-toronto',
  'how-to-choose-hardwood-contractor-toronto': 'guide-choose-contractor',
  'white-oak-flooring-toronto': 'guide-white-oak',
  'dustless-hardwood-refinishing-toronto': 'guide-dustless',
  'herringbone-chevron-parquet-toronto': 'guide-herringbone-parquet',
};

export default function GuidesPage() {
  const decisions = getGuides('decision');
  const references = getGuides('reference');

  return (
    <div className="tlx-page">
      <SchemaScript
        schema={buildWebPageSchema({
          title: 'Decision Guides & Reference Installations — EcoWoods',
          description:
            'Structured decision guides and complete reference specifications for hardwood flooring in Toronto and the GTA.',
          url: `${SITE_URL}/guides`,
          items: [...decisions, ...references].map((g) => ({
            '@type': 'TechArticle' as const,
            headline: g.title,
            url: `${SITE_URL}/guides/${g.slug}`,
            description: g.question,
            datePublished: g.publishedAt,
          })),
        })}
      />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Guides', url: `${SITE_URL}/guides` },
        ])}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>Guides</span>
          </nav>
          <h1 className="tlx-title">Decision guides</h1>
          <p className="tlx-lede">
            Two kinds of document. A <strong>decision guide</strong> answers a question where the
            choice is still open — what actually decides it, in what order, and what the answer is.
            A <strong>reference installation</strong> shows one scenario fully resolved, end to end,
            so it can be checked against or handed to someone else.
          </p>
          <p className="tlx-note">
            Nothing here introduces a figure that is not already published in a{' '}
            <Link href="/papers">technical paper</Link> on this site, and a build guard enforces it.
          </p>
        </div>
      </header>

      <section className="tlx-section" aria-label="Decision guides">
        <div className="shell">
          <p className="tlx-kicker">Choose</p>
          <h2 className="tlx-h2">Decision guides</h2>
          <p className="tlx-note">The question, the criteria that settle it, and the answer.</p>
          <div className="tlx-grid">
            {decisions.map((g) => (
              <Link key={g.slug} className="tlx-card" href={`/guides/${g.slug}`}>
                <IllustrationThumb id={GUIDE_THUMB[g.slug]} className="tlx-card-thumb" />
                <span className="tlx-card-tag">Decision guide</span>
                <h3>{g.title}</h3>
                <p>{g.question}</p>
                <div className="tlx-card-data">
                  <span>{g.readingMinutes} min</span>
                  <span>{g.publishedAt}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="tlx-section" aria-label="Reference installations">
        <div className="shell">
          <p className="tlx-kicker">Assembled</p>
          <h2 className="tlx-h2">Reference installations</h2>
          <p className="tlx-note">
            One scenario, fully specified: substrate, product, method, sequence and the places it
            goes wrong.
          </p>
          <div className="tlx-grid">
            {references.map((g) => (
              <Link key={g.slug} className="tlx-card" href={`/guides/${g.slug}`}>
                <IllustrationThumb id={GUIDE_THUMB[g.slug]} className="tlx-card-thumb" />
                <span className="tlx-card-tag">Reference installation</span>
                <h3>{g.title}</h3>
                <p>{g.question}</p>
                <div className="tlx-card-data">
                  <span>{g.readingMinutes} min</span>
                  <span>{g.publishedAt}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="tlx-section" aria-label="The framework">
        <div className="shell">
          <p className="tlx-kicker">Underneath</p>
          <h2 className="tlx-h2">All of this sits on one framework</h2>
          <p className="tlx-note">
            Every guide points back at the pillars it bears on. The framework says what to check on
            any quote; the guides say what to do about the answer.
          </p>
          <div className="fw-actions">
            <Link className="fw-cta" href="/framework/assess">
              Score a quote against it →
            </Link>
            <Link className="fw-cta fw-cta--ghost" href="/framework">
              Read the specification
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
