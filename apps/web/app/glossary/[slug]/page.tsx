import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GLOSSARY, getTerm, getTerms, backlinks } from '@/lib/glossary';
import { pillarById } from '@/lib/framework';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';
import { Illustration } from '../../components/Illustration';

/**
 * /glossary/<term> — one addressable page per term.
 *
 * The DefinedTerm lives here rather than only in the set on the index, because
 * an answer engine resolving "what is cupping" wants a URL that is about
 * cupping and nothing else. A definition buried in a list of thirty-two is a
 * definition that gets quoted without attribution.
 *
 * `inDefinedTermSet` points back at the index so the two halves of the schema
 * graph reference each other, the same way the papers reference #organization
 * and #website.
 */

export function generateStaticParams() {
  return GLOSSARY.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = getTerm(slug);
  if (!t) return { title: 'Not found' };
  return {
    title: `${t.term} — hardwood flooring glossary`,
    description: t.short,
    alternates: { canonical: `/glossary/${t.slug}`, types: { 'text/markdown': `/glossary/${t.slug}.md` } },
    openGraph: {
      title: `${t.term} — what it means`,
      description: t.short,
      type: 'article',
      url: `${SITE_URL}/glossary/${t.slug}`,
    },
  };
}

/** Glossary term slug → diagram id, for the terms a picture actually helps.
 *  A term without an entry here renders no slot at all: an illustration that
 *  adds nothing is worse than none, because it costs a download and a scroll. */
const TERM_IMAGE: Record<string, string> = {
  cupping: 'failure-cupping',
  crowning: 'failure-crowning',
  'seasonal-gapping': 'failure-gapping',
  buckling: 'failure-buckling',
  'expansion-gap': 'concept-expansion-gap',
  acclimation: 'concept-acclimation',
  'moisture-differential': 'concept-mc-differential',
  'edge-peaking': 'failure-edge-peaking',
  anisotropic: 'term-anisotropic',
  'solid-hardwood': 'term-solid-hardwood',
  'engineered-hardwood': 'term-engineered',
  'cross-ply-core': 'term-cross-ply-core',
  'wear-layer': 'term-wear-layer',
  'nail-down': 'term-nail-down',
  'glue-down': 'term-glue-down',
  floating: 'term-floating',
  subfloor: 'term-subfloor',
  'radiant-heat': 'term-radiant-heat',
  'janka-hardness': 'term-janka',
  'white-oak': 'term-white-oak',
  'progressive-grits': 'term-progressive-grits',
  'intercoat-screening': 'term-intercoat-screening',
  'planetary-sander': 'term-planetary-sander',
  'hepa-dust-containment': 'term-hepa-containment',
};

export default async function TermPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = getTerm(slug);
  if (!t) notFound();

  const related = (t.related ?? []).map(getTerm).filter((x): x is NonNullable<typeof x> => !!x);
  const inbound = backlinks(t.slug);
  const sourceHref = `/papers/${t.source.paper}#${t.source.section}`;
  const siblings = getTerms().filter((x) => x.slug !== t.slug).slice(0, 8);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    '@id': `${SITE_URL}/glossary/${t.slug}#term`,
    name: t.term,
    alternateName: t.aka,
    description: t.short,
    url: `${SITE_URL}/glossary/${t.slug}`,
    inLanguage: 'en-CA',
    inDefinedTermSet: { '@id': `${SITE_URL}/glossary#termset` },
    subjectOf: { '@type': 'CreativeWork', url: `${SITE_URL}${sourceHref}` },
  };

  return (
    <div className="tlx-page">
      <SchemaScript schema={schema} />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Glossary', url: `${SITE_URL}/glossary` },
          { name: t.term, url: `${SITE_URL}/glossary/${t.slug}` },
        ])}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
            <Link href="/glossary">Glossary</Link> <span aria-hidden="true">/</span>{' '}
            <span>{t.term}</span>
          </nav>
          <h1 className="tlx-title">{t.term}</h1>
          {t.aka && t.aka.length > 0 && (
            <p className="gl-aka-head">Also called {t.aka.join(', ')}</p>
          )}
          <p className="gl-definition">{t.short}</p>
        </div>
      </header>

      <section className="tlx-section" aria-label="Explanation">
        <div className="shell">
          {TERM_IMAGE[t.slug] && <Illustration id={TERM_IMAGE[t.slug]} priority />}

          <div className="gl-body">
            {t.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="tlx-section" aria-label="Related terms">
          <div className="shell">
            <p className="tlx-kicker">Related</p>
            <h2 className="tlx-h2">Terms this one depends on</h2>
            <ul className="gl-list">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link className="gl-entry" href={`/glossary/${r.slug}`}>
                    <span className="gl-term">{r.term}</span>
                    <span className="gl-short">{r.short}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {inbound.length > 0 && (
        <section className="tlx-section" aria-label="Referenced by">
          <div className="shell">
            <p className="tlx-kicker">Referenced by</p>
            <h2 className="tlx-h2">Terms that point here</h2>
            <ul className="gl-backlinks">
              {inbound.map((b) => (
                <li key={b.slug}>
                  <Link href={`/glossary/${b.slug}`}>{b.term}</Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="tlx-section" aria-label="Provenance">
        <div className="shell">
          <p className="tlx-kicker">Provenance</p>
          <h2 className="tlx-h2">Where this definition comes from</h2>
          <ul className="gd-sources">
            <li>
              <Link href={sourceHref}>
                {t.source.paper.replace(/-/g, ' ')} — {t.source.section.replace(/-/g, ' ')}
              </Link>
            </li>
          </ul>

          {t.pillars && t.pillars.length > 0 && (
            <>
              <h3 className="fw-sub">Framework pillars this term is material to</h3>
              <ul className="gd-sources">
                {t.pillars.map((id) => {
                  const p = pillarById(id);
                  if (!p) return null;
                  return (
                    <li key={id}>
                      <Link href={`/framework#${p.id}`}>
                        Pillar {p.number} — {p.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <div className="fw-actions">
            <Link className="fw-cta fw-cta--ghost" href="/glossary">
              ← All {GLOSSARY.length} terms
            </Link>
          </div>
        </div>
      </section>

      <section className="tlx-section" aria-label="More terms">
        <div className="shell">
          <p className="tlx-kicker">Browse</p>
          <h2 className="tlx-h2">More from the glossary</h2>
          <ul className="gl-backlinks">
            {siblings.map((s) => (
              <li key={s.slug}>
                <Link href={`/glossary/${s.slug}`}>{s.term}</Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
