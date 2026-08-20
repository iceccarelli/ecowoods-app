import type { Metadata } from 'next';
import Link from 'next/link';
import { getTerms, termsByLetter } from '@/lib/glossary';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

/**
 * /glossary — the A–Z index.
 *
 * Emits a DefinedTermSet containing every term, which is the schema type answer
 * engines read for "what is X" questions. The individual DefinedTerm lives on
 * each term's own page; this is the set they belong to.
 */

export const metadata: Metadata = {
  title: 'Hardwood Flooring Glossary | EcoWoods',
  description:
    'Canonical definitions for hardwood flooring terms — acclimation, cupping, crowning, moisture differential, cross-ply core, intercoat screening and more. Every entry sourced to a published technical paper.',
  alternates: { canonical: '/glossary' },
  openGraph: {
    title: 'Hardwood Flooring Glossary — EcoWoods',
    description:
      'Canonical, sourced definitions for the terms that decide whether a hardwood floor succeeds or fails.',
    type: 'website',
    url: `${SITE_URL}/glossary`,
  },
};

export default function GlossaryPage() {
  const terms = getTerms();
  const groups = termsByLetter();

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': `${SITE_URL}/glossary#termset`,
    name: 'EcoWoods Hardwood Flooring Glossary',
    description:
      'Canonical definitions for hardwood flooring terminology, each sourced to a published technical paper.',
    url: `${SITE_URL}/glossary`,
    inLanguage: 'en-CA',
    publisher: { '@id': `${SITE_URL}/#organization` },
    hasDefinedTerm: terms.map((t) => ({
      '@type': 'DefinedTerm',
      '@id': `${SITE_URL}/glossary/${t.slug}#term`,
      name: t.term,
      description: t.short,
      url: `${SITE_URL}/glossary/${t.slug}`,
    })),
  };

  return (
    <div className="tlx-page">
      <SchemaScript schema={schema} />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Glossary', url: `${SITE_URL}/glossary` },
        ])}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>Glossary</span>
          </nav>
          <h1 className="tlx-title">Glossary</h1>
          <p className="tlx-lede">
            {terms.length} terms, one page each, cross-linked. Every definition restates something
            already published in a <Link href="/papers">technical paper</Link> on this site — none
            of them introduces a figure or a claim the papers do not carry, and a build guard
            enforces it.
          </p>
          <nav className="gl-jump" aria-label="Jump to letter">
            {groups.map((g) => (
              <a key={g.letter} href={`#letter-${g.letter}`}>
                {g.letter}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {groups.map((group) => (
        <section
          key={group.letter}
          id={`letter-${group.letter}`}
          className="tlx-section"
          aria-label={`Terms beginning with ${group.letter}`}
        >
          <div className="shell">
            <h2 className="gl-letter">{group.letter}</h2>
            <ul className="gl-list">
              {group.terms.map((t) => (
                <li key={t.slug}>
                  <Link className="gl-entry" href={`/glossary/${t.slug}`}>
                    <span className="gl-term">{t.term}</span>
                    {t.aka && t.aka.length > 0 && (
                      <span className="gl-aka">also {t.aka.join(', ')}</span>
                    )}
                    <span className="gl-short">{t.short}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      <section className="tlx-section" aria-label="Where the definitions come from">
        <div className="shell">
          <p className="tlx-kicker">Provenance</p>
          <h2 className="tlx-h2">Why every entry cites a paper</h2>
          <p className="tlx-note">
            A glossary is only worth reading if it is right, and the only way to keep one right at
            scale is to make every entry a view onto something that was already reviewed. When a
            term needs substance no paper covers, the paper gets written first.
          </p>
          <div className="fw-actions">
            <Link className="fw-cta" href="/framework">
              The Well-Installed Framework →
            </Link>
            <Link className="fw-cta fw-cta--ghost" href="/guides">
              Decision guides
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
