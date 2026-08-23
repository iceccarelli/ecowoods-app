import type { Metadata } from 'next';
import Link from 'next/link';
import { getPapers } from '@/lib/papers';
import { getGuides } from '@/lib/guides';
import { getTerms } from '@/lib/glossary';
import { PILLARS, criterionCount, FRAMEWORK_VERSION } from '@/lib/framework';
import { getArticles } from '@/lib/content/loader';
import { getCaseStudies } from '@/lib/content/case-study-loader';
import { CITIES, SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList, buildWebPageSchema } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';
import { Illustration } from '../components/Illustration';

/**
 * /resources — one door into everything published.
 *
 * WHY THIS EXISTS
 *
 * The corpus outgrew the navigation. Papers, a versioned framework, a self-
 * assessment, six guides, three reference installations, 32 glossary terms, a
 * technical library, articles, case studies, sixteen city pages, a JSON API and
 * four machine files — reachable, individually, from a ten-item flat nav mixing
 * homepage anchors with routes. Every one of those items was findable. None of
 * it was *organised*.
 *
 * AWS solves this with one entry — Documentation — behind which everything is
 * grouped by what the reader is trying to do, not by what team produced it.
 * That is the shape here: Decide, Verify, Understand, Evidence, Data. A visitor
 * who does not yet know whether they need a guide or a paper does not have to
 * know; the section headings ask their question back to them.
 *
 * EVERY COUNT DERIVED. Nothing on this page is typed by hand, so a new paper,
 * guide or term cannot make it wrong.
 */

export const metadata: Metadata = {
  title: 'Resources',
  description:
    'Everything Ecowoods publishes on hardwood flooring, organised by what you are trying to do: decision guides, the Well-Installed Framework and its self-assessment, technical papers, a 32-term glossary, engineering case studies, and a public JSON API.',
  alternates: { canonical: '/resources' },
  openGraph: {
    title: 'Resources — EcoWoods',
    description:
      'Decision guides, a published framework, technical papers, a glossary and a public data API for hardwood flooring in Toronto and the GTA.',
    type: 'website',
    url: `${SITE_URL}/resources`,
  },
};

export default async function ResourcesPage() {
  const [articles, caseStudies] = await Promise.all([getArticles(), getCaseStudies()]);
  const papers = getPapers();
  const guides = getGuides();
  const decisions = guides.filter((g) => g.kind === 'decision');
  const references = guides.filter((g) => g.kind === 'reference');
  const terms = getTerms();

  return (
    <div className="tlx-page">
      <SchemaScript
        schema={buildWebPageSchema({
          title: 'Resources — EcoWoods',
          description: 'Every published hardwood flooring resource, organised by intent.',
          url: `${SITE_URL}/resources`,
          items: [
            ...papers.map((p) => ({
              '@type': 'TechArticle' as const,
              headline: p.title,
              url: `${SITE_URL}/papers/${p.slug}`,
              description: p.abstract,
              datePublished: p.publishedAt,
            })),
            ...guides.map((g) => ({
              '@type': 'TechArticle' as const,
              headline: g.title,
              url: `${SITE_URL}/guides/${g.slug}`,
              description: g.question,
              datePublished: g.publishedAt,
            })),
          ],
        })}
      />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Resources', url: `${SITE_URL}/resources` },
        ])}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>Resources</span>
          </nav>
          <h1 className="tlx-title">Resources</h1>
          <p className="tlx-lede">
            Everything we publish, organised by what you are trying to do rather than by what it is
            called. All of it is free to read, free to cite, and written to be used on any
            contractor in the GTA — including us.
          </p>
          <p className="fw-meta">
            <span>{papers.length} papers</span>
            <span aria-hidden="true">·</span>
            <span>{guides.length} guides</span>
            <span aria-hidden="true">·</span>
            <span>{criterionCount()} framework criteria</span>
            <span aria-hidden="true">·</span>
            <span>{terms.length} glossary terms</span>
            <span aria-hidden="true">·</span>
            <span>{articles.length + caseStudies.length} articles &amp; case studies</span>
          </p>
        </div>
      </header>

      <section className="tlx-section tlx-section--flush" aria-label="The science behind these resources">
        <div className="shell">
          <Illustration id="resources-hero" priority motion="kenburns" />
        </div>
      </section>

      {/* 1 — DECIDE */}
      <section className="tlx-section" aria-label="Decide">
        <div className="shell">
          <p className="tlx-kicker">If you are choosing</p>
          <h2 className="tlx-h2">Decision guides</h2>
          <p className="tlx-note">
            Each one takes a question where the choice is still open, names what actually decides
            it, and gives the answer with the conditions under which it changes.
          </p>
          <div className="tlx-grid">
            {decisions.map((g) => (
              <Link key={g.slug} className="tlx-card" href={`/guides/${g.slug}`}>
                <span className="tlx-card-tag">Decision guide</span>
                <h3>{g.title}</h3>
                <p>{g.question}</p>
                <div className="tlx-card-data">
                  <span>{g.readingMinutes} min</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 2 — VERIFY */}
      <section className="tlx-section" aria-label="Verify">
        <div className="shell">
          <p className="tlx-kicker">If you are holding a quote</p>
          <h2 className="tlx-h2">The Well-Installed Framework</h2>
          <p className="tlx-note">
            A published, versioned specification for judging a hardwood installation —{' '}
            {PILLARS.length} pillars, {criterionCount()} binary criteria, every one sourced to a
            paper below. Score any contractor against it.
          </p>
          <div className="fw-actions">
            <Link className="fw-cta" href="/framework/assess">
              Score a quote →
            </Link>
            <Link className="fw-cta fw-cta--ghost" href="/framework">
              Read the specification (v{FRAMEWORK_VERSION})
            </Link>
          </div>
          <ul className="gd-sources" style={{ marginTop: '1.5rem' }}>
            {PILLARS.map((p) => (
              <li key={p.id}>
                <Link href={`/framework#${p.id}`}>
                  Pillar {p.number} — {p.name}
                </Link>{' '}
                <span className="gl-aka">{p.criteria.length} criteria</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 3 — BUILD */}
      <section className="tlx-section" aria-label="Reference installations">
        <div className="shell">
          <p className="tlx-kicker">If you want the whole thing specified</p>
          <h2 className="tlx-h2">Reference installations</h2>
          <p className="tlx-note">
            One scenario resolved end to end — substrate, product, method, sequence, and the places
            it goes wrong.
          </p>
          <div className="tlx-grid">
            {references.map((g) => (
              <Link key={g.slug} className="tlx-card" href={`/guides/${g.slug}`}>
                <span className="tlx-card-tag">Reference installation</span>
                <h3>{g.title}</h3>
                <p>{g.question}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 4 — UNDERSTAND */}
      <section className="tlx-section" aria-label="Technical papers">
        <div className="shell">
          <p className="tlx-kicker">If you want the engineering</p>
          <h2 className="tlx-h2">Technical papers</h2>
          <p className="tlx-note">
            Published in full as HTML, not gated. Everything above cites these.
          </p>
          <div className="tlx-grid">
            {papers.map((p) => (
              <Link key={p.slug} className="tlx-card" href={`/papers/${p.slug}`}>
                <span className="tlx-card-tag">Paper · v{p.version}</span>
                <h3>{p.title}</h3>
                <p>{p.abstract}</p>
                <div className="tlx-card-data">
                  <span>{p.sections.length} sections</span>
                  <span>{p.readingMinutes} min</span>
                </div>
              </Link>
            ))}
          </div>
          <div className="fw-actions">
            <Link className="fw-cta fw-cta--ghost" href="/glossary">
              Glossary — {terms.length} terms
            </Link>
            <Link className="fw-cta fw-cta--ghost" href="/technical-library">
              Technical library
            </Link>
          </div>
        </div>
      </section>

      {/* 5 — EVIDENCE */}
      <section className="tlx-section" aria-label="Evidence">
        <div className="shell">
          <p className="tlx-kicker">If you want to see it applied</p>
          <h2 className="tlx-h2">Case studies and articles</h2>
          <div className="clp-secondary">
            <div className="clp-secondary-col">
              <h3>Engineering case studies</h3>
              <ul className="clp-links">
                {caseStudies.slice(0, 6).map((c) => (
                  <li key={c.slug}>
                    <Link href={`/case-studies/${c.slug}`}>{c.title}</Link>
                  </li>
                ))}
              </ul>
              <Link href="/case-studies" className="clp-more">
                All case studies <span aria-hidden>→</span>
              </Link>
            </div>
            <div className="clp-secondary-col">
              <h3>Articles</h3>
              <ul className="clp-links">
                {articles.slice(0, 6).map((a) => (
                  <li key={a.slug}>
                    <Link href={`/blog/${a.slug}`}>{a.title}</Link>
                  </li>
                ))}
              </ul>
              <Link href="/blog" className="clp-more">
                All articles <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 6 — WHERE */}
      <section className="tlx-section" aria-label="Service areas">
        <div className="shell">
          <p className="tlx-kicker">If you want to know whether we work near you</p>
          <h2 className="tlx-h2">Service areas</h2>
          <ul className="clp-areas">
            {CITIES.map((c) => (
              <li key={c.slug}>
                <Link href={`/service-areas/${c.slug}`}>{c.name}</Link>
              </li>
            ))}
          </ul>
          <Link href="/service-areas" className="clp-more">
            All service areas <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* 7 — DATA */}
      <section className="tlx-section" aria-label="Data and citation">
        <div className="shell">
          <p className="tlx-kicker">If you are a researcher, a journalist or an AI system</p>
          <h2 className="tlx-h2">Data and citation</h2>
          <p className="tlx-note">
            The whole corpus is available as structured data under CC BY 4.0. Quote it, build on
            it, train on it — attribution by URL is the only condition. Every reference page is
            also styled for print, so Print → Save as PDF produces a clean, attributed document.
          </p>
          <ul className="gd-sources">
            <li>
              <Link href="/library">/library</Link> — every diagram and photograph, indexed and
              linked to what explains it
            </li>
            <li>
              <Link href="/data">/data</Link> — numbered, captioned, citable figures with their
              source tables
            </li>
            <li>
              <a href="/api/knowledge">/api/knowledge</a> — the entire corpus as JSON, CORS-open, no
              key
            </li>
            <li>
              <a href="/feed.xml">/feed.xml</a> — RSS 2.0 over every dated publication
            </li>
            <li>
              <a href="/llms.txt">/llms.txt</a> — concise brief for language models
            </li>
            <li>
              <a href="/ai.txt">/ai.txt</a> — full citation guide for AI systems
            </li>
            <li>
              <a href="/sitemap.xml">/sitemap.xml</a> — every indexable route
            </li>
            <li>
              <Link href="/authority">Authority &amp; citation guide</Link> — how to cite this
              business, and what it does not claim
            </li>
          </ul>
        </div>
      </section>

      <section className="tlx-section" aria-label="Talk to us">
        <div className="shell">
          <div className="tlx-cta">
            <h2>Read enough?</h2>
            <p>
              Every number above is published so a decision can be made without talking to anyone.
              When you want the conversation, it starts with an in-home moisture reading.
            </p>
            <a className="btn btn-copper" href="/#quote">
              Book a free estimate
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
