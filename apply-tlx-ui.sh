#!/usr/bin/env bash
# apply-tlx-ui.sh — EcoWoods content-layer UI/UX overhaul (2026-08-01)
# Run from the repo root: bash apply-tlx-ui.sh
# Idempotent. Requires: node. Adds dep afterwards: pnpm --filter @ecowoods/web add marked
set -euo pipefail
cd "$(dirname "$0")"
echo "== EcoWoods tlx UI installer =="

mkdir -p "$(dirname 'apps/web/lib/content/markdown.ts')"
cat > 'apps/web/lib/content/markdown.ts' << 'TLX_EOF_7f3a1'
/**
 * Markdown rendering pipeline for the content library.
 *
 * Articles and case studies are authored as GFM markdown in .mdx files;
 * this module converts them to HTML server-side (marked, GFM enabled:
 * tables, task lists) and derives reading time. Content is first-party
 * and repo-controlled, so no sanitizer pass is applied.
 */
import { marked } from 'marked';

const WORDS_PER_MINUTE = 225;

/** Estimated reading time in whole minutes (never 0). */
export function estimateReadingTime(markdown: string): number {
  const words = markdown.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/**
 * Drop a leading `# Heading` — the page layout renders the title itself,
 * so a body-level H1 would duplicate it (and break heading hierarchy).
 */
export function stripLeadingH1(markdown: string): string {
  return markdown.replace(/^\s*#\s[^\n]+\n+/, '');
}

/** Convert a markdown body to HTML for dangerouslySetInnerHTML. */
export function renderMarkdown(markdown: string): string {
  return marked.parse(stripLeadingH1(markdown), { async: false, gfm: true }) as string;
}
TLX_EOF_7f3a1
echo "wrote apps/web/lib/content/markdown.ts"

mkdir -p "$(dirname 'apps/web/app/components/ArticleLayout.tsx')"
cat > 'apps/web/app/components/ArticleLayout.tsx' << 'TLX_EOF_7f3a1'
/**
 * ArticleLayout — the reading experience for technical articles.
 * Styled with the .tlx design system in globals.css (site tokens:
 * paper background, Fraunces display, mono meta strip, copper accents).
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { formatDate } from '@/lib/content/utils';
import type { ArticleMetadata } from '@/lib/content/types';
import type { RelatedContent } from '@/lib/graph/contentLinks';

interface ArticleLayoutProps {
  metadata: ArticleMetadata & { readingTimeMinutes?: number };
  children: ReactNode;
  relatedContent?: RelatedContent[];
}

export function ArticleLayout({ metadata, children, relatedContent }: ArticleLayoutProps) {
  const readingTime = metadata.readingTimeMinutes;

  return (
    <article className="tlx-page">
      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden>/</span>
            <Link href="/technical-library">Technical Library</Link>
            <span aria-hidden>/</span>
            <Link href="/blog">Articles</Link>
            {metadata.category && (
              <>
                <span aria-hidden>/</span>
                <span>{metadata.category.replace(/-/g, ' ')}</span>
              </>
            )}
          </nav>

          <h1 className="tlx-title">{metadata.title}</h1>
          <p className="tlx-lede">{metadata.description}</p>

          <div className="tlx-meta">
            <span>
              By <strong>{metadata.author || 'The Ecowoods Team'}</strong>
            </span>
            <time dateTime={metadata.publishedAt}>{formatDate(metadata.publishedAt)}</time>
            {readingTime ? <span>{readingTime} min read</span> : null}
          </div>
        </div>
      </header>

      <main className="tlx-section">
        <div className="shell">
          {children}

          <aside className="tlx-about">
            <h3>About these guides</h3>
            <p>
              Ecowoods installs, refinishes, and restores hardwood floors across Toronto and the
              GTA. Our technical guides document the standards we hold on real job sites —
              moisture testing, acclimation, dust containment, and finish chemistry.
            </p>
          </aside>

          {metadata.tags && metadata.tags.length > 0 && (
            <div className="tlx-tags" aria-label="Topics">
              {metadata.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          )}

          {relatedContent && relatedContent.length > 0 && (
            <section className="tlx-related" aria-label="Related content">
              <p className="tlx-kicker">Keep reading</p>
              <h2 className="tlx-h2">Related guides &amp; projects</h2>
              <div className="tlx-grid">
                {relatedContent.map((item) => (
                  <Link
                    key={`${item.type}-${item.slug}`}
                    href={item.type === 'article' ? `/blog/${item.slug}` : `/case-studies/${item.slug}`}
                    className="tlx-card"
                  >
                    <span className="tlx-card-tag">
                      {item.type === 'article' ? 'Article' : 'Case study'}
                      {item.sharedTopics.length > 0 && ` · ${item.sharedTopics[0]}`}
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <span className="tlx-card-cta">Read more →</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </article>
  );
}
TLX_EOF_7f3a1
echo "wrote apps/web/app/components/ArticleLayout.tsx"

mkdir -p "$(dirname 'apps/web/app/blog/[slug]/article-content.tsx')"
cat > 'apps/web/app/blog/[slug]/article-content.tsx' << 'TLX_EOF_7f3a1'
/**
 * ArticleContent — renders the pre-converted HTML body of an article
 * inside the .tlx-body typography scope (see globals.css).
 * `content` is HTML produced server-side by lib/content/markdown.ts
 * from first-party, repo-controlled markdown.
 */

interface ArticleContentProps {
  content: string;
}

export function ArticleContent({ content }: ArticleContentProps) {
  return <div className="tlx-body" dangerouslySetInnerHTML={{ __html: content }} />;
}
TLX_EOF_7f3a1
echo "wrote apps/web/app/blog/[slug]/article-content.tsx"

mkdir -p "$(dirname 'apps/web/app/case-studies/[slug]/case-study-layout.tsx')"
cat > 'apps/web/app/case-studies/[slug]/case-study-layout.tsx' << 'TLX_EOF_7f3a1'
/**
 * CaseStudyLayout — project write-up page. The spec strip ("job card")
 * leads with the measured facts of the project; the body renders below
 * in the .tlx-body typography scope. Styled by the .tlx system.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { CaseStudyMetadata } from '@/lib/content/case-study-types';
import type { RelatedContent } from '@/lib/graph/contentLinks';
import { formatDate } from '@/lib/content/utils';

interface CaseStudyLayoutProps {
  metadata: CaseStudyMetadata;
  children: ReactNode;
  relatedContent?: RelatedContent[];
}

export function CaseStudyLayout({ metadata, children, relatedContent }: CaseStudyLayoutProps) {
  const woodSpecies = Array.isArray(metadata.woodSpecies)
    ? metadata.woodSpecies.join(' · ')
    : metadata.woodSpecies;
  const projectYear = metadata.projectDate ? new Date(metadata.projectDate).getFullYear() : null;

  return (
    <article className="tlx-page">
      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden>/</span>
            <Link href="/technical-library">Technical Library</Link>
            <span aria-hidden>/</span>
            <Link href="/case-studies">Case Studies</Link>
          </nav>

          <h1 className="tlx-title">{metadata.title}</h1>
          <p className="tlx-lede">{metadata.description}</p>

          <div className="tlx-meta">
            <time dateTime={metadata.publishedAt}>{formatDate(metadata.publishedAt)}</time>
          </div>

          <dl className="tlx-specs">
            {metadata.projectType && (
              <div className="tlx-spec">
                <dt>Project type</dt>
                <dd>{metadata.projectType.replace(/-/g, ' ')}</dd>
              </div>
            )}
            {metadata.location && (
              <div className="tlx-spec">
                <dt>Location</dt>
                <dd>
                  {metadata.location.city}, {metadata.location.province}
                </dd>
              </div>
            )}
            {projectYear && (
              <div className="tlx-spec">
                <dt>Year</dt>
                <dd>{projectYear}</dd>
              </div>
            )}
            {metadata.squareFootage ? (
              <div className="tlx-spec">
                <dt>Size</dt>
                <dd>{metadata.squareFootage.toLocaleString()} sqft</dd>
              </div>
            ) : null}
            {woodSpecies && (
              <div className="tlx-spec">
                <dt>Wood</dt>
                <dd>{woodSpecies}</dd>
              </div>
            )}
          </dl>
        </div>
      </header>

      <main className="tlx-section">
        <div className="shell">
          {children}

          {relatedContent && relatedContent.length > 0 && (
            <section className="tlx-related" aria-label="Related content">
              <p className="tlx-kicker">Keep reading</p>
              <h2 className="tlx-h2">Related guides &amp; projects</h2>
              <div className="tlx-grid">
                {relatedContent.map((item) => (
                  <Link
                    key={`${item.type}-${item.slug}`}
                    href={item.type === 'article' ? `/blog/${item.slug}` : `/case-studies/${item.slug}`}
                    className="tlx-card"
                  >
                    <span className="tlx-card-tag">
                      {item.type === 'article' ? 'Article' : 'Case study'}
                      {item.sharedTopics.length > 0 && ` · ${item.sharedTopics[0]}`}
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <span className="tlx-card-cta">Read more →</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </article>
  );
}
TLX_EOF_7f3a1
echo "wrote apps/web/app/case-studies/[slug]/case-study-layout.tsx"

mkdir -p "$(dirname 'apps/web/app/technical-library/page.tsx')"
cat > 'apps/web/app/technical-library/page.tsx' << 'TLX_EOF_7f3a1'
import type { Metadata } from 'next';
import Link from 'next/link';
import { getArticles } from '@/lib/content/loader';
import { getCaseStudies } from '@/lib/content/case-study-loader';
import { buildWebPageSchema } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';
import { formatDate } from '@/lib/content/utils';

export const metadata: Metadata = {
  title: 'Technical Library | EcoWoods',
  description:
    'Engineering reference for hardwood flooring installation, finishing, and maintenance in Toronto and the GTA: moisture protocols, species science, and finish chemistry.',
  openGraph: {
    title: 'Technical Library — EcoWoods',
    description:
      'Deep-dive technical content on hardwood flooring installation, moisture management, species selection, and finishing chemistry.',
    type: 'website',
    url: 'https://ecowoods.ca/technical-library',
  },
};

const PILLARS = [
  {
    title: 'Moisture Management',
    body: "Testing protocols, acclimation timelines, subfloor preparation, and humidity control strategies specific to Toronto's seasonal climate.",
    points: ['ASTM moisture standards', 'Seasonal acclimation guides', 'EMC calculations'],
  },
  {
    title: 'Wood Science',
    body: 'Species profiles, tannin chemistry, Janka hardness comparisons, and material selection frameworks for Toronto projects.',
    points: ['Species profiles', 'Tannin risk assessment', 'Cost analysis'],
  },
  {
    title: 'Installation & Finishing',
    body: 'Dust-free techniques, polyurethane chemistry, finish selection, and quality control for residential and commercial projects.',
    points: ['HEPA extraction systems', 'Polyurethane chemistry', 'Application techniques'],
  },
];

export default async function TechnicalLibraryPage() {
  const articles = await getArticles();
  const caseStudies = await getCaseStudies();

  const collectionSchema = buildWebPageSchema({
    title: 'Technical Library — EcoWoods',
    description:
      'Complete technical reference for hardwood flooring engineering, installation, and maintenance.',
    url: 'https://ecowoods.ca/technical-library',
    items: [
      ...articles.map((article) => ({
        '@type': 'TechArticle' as const,
        headline: article.title,
        url: `https://ecowoods.ca/blog/${article.slug}`,
        description: article.description,
        datePublished: article.publishedAt,
      })),
      ...caseStudies.map((caseStudy) => ({
        '@type': 'CaseStudy' as const,
        headline: caseStudy.title,
        url: `https://ecowoods.ca/case-studies/${caseStudy.slug}`,
        description: caseStudy.description,
        datePublished: caseStudy.publishedAt,
      })),
    ],
  });

  return (
    <div className="tlx-page">
      <SchemaScript schema={collectionSchema} />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden>/</span>
            <span>Technical Library</span>
          </nav>
          <h1 className="tlx-title">Technical Library</h1>
          <p className="tlx-lede">
            The engineering reference behind our work: moisture protocols, wood science, and
            finishing chemistry for hardwood floors in Toronto and the GTA.
          </p>
        </div>
      </header>

      <section className="tlx-section" aria-label="Core technical pillars">
        <div className="shell">
          <p className="tlx-kicker">Foundations</p>
          <h2 className="tlx-h2">Core technical pillars</h2>
          <div className="tlx-grid">
            {PILLARS.map((pillar) => (
              <div key={pillar.title} className="tlx-pillar">
                <h3>{pillar.title}</h3>
                <p>{pillar.body}</p>
                <ul>
                  {pillar.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {articles.length > 0 && (
        <section className="tlx-section" aria-label="Technical articles">
          <div className="shell">
            <p className="tlx-kicker">Guides</p>
            <h2 className="tlx-h2">Technical articles</h2>
            <p className="tlx-note">
              In-depth guides covering installation protocols, material science, and decision
              frameworks.
            </p>
            <div className="tlx-grid">
              {articles.map((article) => (
                <Link key={article.slug} href={`/blog/${article.slug}`} className="tlx-card">
                  <span className="tlx-card-tag">
                    {article.category ? article.category.replace(/-/g, ' ') : 'Article'}
                  </span>
                  <h3>{article.title}</h3>
                  <p>{article.description}</p>
                  <span className="tlx-card-data">
                    <span>{formatDate(article.publishedAt)}</span>
                    {article.readingTimeMinutes ? (
                      <span>{article.readingTimeMinutes} min read</span>
                    ) : null}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {caseStudies.length > 0 && (
        <section className="tlx-section" aria-label="Case studies">
          <div className="shell">
            <p className="tlx-kicker">Projects</p>
            <h2 className="tlx-h2">Case studies</h2>
            <p className="tlx-note">
              Project write-ups documenting installation protocols and problem-solving on Toronto
              homes.
            </p>
            <div className="tlx-grid">
              {caseStudies.map((caseStudy) => {
                const species = Array.isArray(caseStudy.woodSpecies)
                  ? caseStudy.woodSpecies.join(' · ')
                  : caseStudy.woodSpecies;
                return (
                  <Link
                    key={caseStudy.slug}
                    href={`/case-studies/${caseStudy.slug}`}
                    className="tlx-card"
                  >
                    <span className="tlx-card-tag">Case study</span>
                    <h3>{caseStudy.title}</h3>
                    <p>{caseStudy.description}</p>
                    <span className="tlx-card-data">
                      <span>
                        {caseStudy.location.city}, {caseStudy.location.province}
                      </span>
                      <span>{caseStudy.squareFootage.toLocaleString()} sqft</span>
                      {species ? <span>{species}</span> : null}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="tlx-section" aria-label="Get an estimate">
        <div className="shell">
          <div className="tlx-cta">
            <h2>Ready to talk about your project?</h2>
            <p>Use this library as reference, then get a free in-home estimate.</p>
            <a href="/#quote" className="btn btn-copper">
              Get free estimate
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
TLX_EOF_7f3a1
echo "wrote apps/web/app/technical-library/page.tsx"

mkdir -p "$(dirname 'apps/web/app/blog/page.tsx')"
cat > 'apps/web/app/blog/page.tsx' << 'TLX_EOF_7f3a1'
import type { Metadata } from 'next';
import Link from 'next/link';
import { getArticles } from '@/lib/content/loader';
import { formatDate } from '@/lib/content/utils';

export const metadata: Metadata = {
  title: 'Technical Articles | EcoWoods',
  description:
    'Technical articles on hardwood flooring: moisture testing, species selection, dust-free sanding, and finish chemistry for Toronto and the GTA.',
};

export default async function BlogPage() {
  const articles = await getArticles();
  const featured = articles.filter((a) => a.featured);
  const rest = articles.filter((a) => !a.featured);

  const renderCard = (article: (typeof articles)[number]) => (
    <Link key={article.slug} href={`/blog/${article.slug}`} className="tlx-card">
      <span className="tlx-card-tag">
        {article.category ? article.category.replace(/-/g, ' ') : 'Article'}
      </span>
      <h3>{article.title}</h3>
      <p>{article.description}</p>
      <span className="tlx-card-data">
        <span>{formatDate(article.publishedAt)}</span>
        {article.readingTimeMinutes ? <span>{article.readingTimeMinutes} min read</span> : null}
      </span>
    </Link>
  );

  return (
    <div className="tlx-page">
      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden>/</span>
            <Link href="/technical-library">Technical Library</Link>
            <span aria-hidden>/</span>
            <span>Articles</span>
          </nav>
          <h1 className="tlx-title">Technical articles</h1>
          <p className="tlx-lede">
            The science behind the craft: moisture, species, sanding, and finish chemistry —
            written from the standards we hold on real job sites.
          </p>
        </div>
      </header>

      <main className="tlx-section">
        <div className="shell">
          {articles.length === 0 ? (
            <p className="tlx-note">No articles published yet. Check back soon.</p>
          ) : (
            <>
              {featured.length > 0 && (
                <>
                  <p className="tlx-kicker">Start here</p>
                  <h2 className="tlx-h2">Featured</h2>
                  <div className="tlx-grid" style={{ marginBottom: '2.5rem' }}>
                    {featured.map(renderCard)}
                  </div>
                </>
              )}
              {rest.length > 0 && (
                <>
                  <p className="tlx-kicker">All guides</p>
                  <h2 className="tlx-h2">Latest articles</h2>
                  <div className="tlx-grid">{rest.map(renderCard)}</div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
TLX_EOF_7f3a1
echo "wrote apps/web/app/blog/page.tsx"

mkdir -p "$(dirname 'apps/web/app/case-studies/page.tsx')"
cat > 'apps/web/app/case-studies/page.tsx' << 'TLX_EOF_7f3a1'
import type { Metadata } from 'next';
import Link from 'next/link';
import { getCaseStudies } from '@/lib/content/case-study-loader';
import { formatDate } from '@/lib/content/utils';

export const metadata: Metadata = {
  title: 'Case Studies | EcoWoods',
  description:
    'Hardwood flooring project write-ups from Toronto and the GTA: moisture engineering, species selection, staircases, and radiant-heat installations.',
};

export default async function CaseStudiesPage() {
  const caseStudies = await getCaseStudies();

  return (
    <div className="tlx-page">
      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden>/</span>
            <Link href="/technical-library">Technical Library</Link>
            <span aria-hidden>/</span>
            <span>Case Studies</span>
          </nav>
          <h1 className="tlx-title">Case studies</h1>
          <p className="tlx-lede">
            Project write-ups documenting how we handle moisture, substrates, species, and
            finishes on Toronto homes.
          </p>
        </div>
      </header>

      <main className="tlx-section">
        <div className="shell">
          {caseStudies.length === 0 ? (
            <p className="tlx-note">No case studies published yet. Check back soon.</p>
          ) : (
            <div className="tlx-grid">
              {caseStudies.map((caseStudy) => {
                const species = Array.isArray(caseStudy.woodSpecies)
                  ? caseStudy.woodSpecies.join(' · ')
                  : caseStudy.woodSpecies;
                return (
                  <Link
                    key={caseStudy.slug}
                    href={`/case-studies/${caseStudy.slug}`}
                    className="tlx-card"
                  >
                    <span className="tlx-card-tag">
                      {caseStudy.projectType ? caseStudy.projectType.replace(/-/g, ' ') : 'Project'}
                    </span>
                    <h3>{caseStudy.title}</h3>
                    <p>{caseStudy.description}</p>
                    <span className="tlx-card-data">
                      <span>
                        {caseStudy.location.city}, {caseStudy.location.province}
                      </span>
                      <span>{caseStudy.squareFootage.toLocaleString()} sqft</span>
                      {species ? <span>{species}</span> : null}
                      <span>{formatDate(caseStudy.publishedAt)}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
TLX_EOF_7f3a1
echo "wrote apps/web/app/case-studies/page.tsx"

# ── globals.css: append tlx block once ──
if grep -q 'TECHNICAL LIBRARY EXPERIENCE' apps/web/app/globals.css; then
  echo "globals.css: tlx block already present"
else
  cat >> apps/web/app/globals.css << 'TLX_EOF_7f3a1'

/* ════════════════════════════════════════════════════════════════════════
   TECHNICAL LIBRARY EXPERIENCE (.tlx-*)
   Content layer for /technical-library, /blog, /case-studies.
   Design language: the Ecowoods "job binder" — warm paper pages, Fraunces
   headlines, and measurement data set in the mono face on cream reading
   strips (the signature: this is a company that measures things).
   All values derive from the token system at the top of this file.
   ════════════════════════════════════════════════════════════════════════ */

.tlx-page { background: var(--paper); color: var(--walnut-950); min-height: 100vh; }

/* ── Hero ── */
.tlx-hero { border-bottom: 1px solid var(--cream-100); padding: 4.5rem 0 3rem; }
.tlx-hero .shell { max-width: 860px; }
.tlx-crumbs { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;
  font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--oak-500); margin-bottom: 1.5rem; }
.tlx-crumbs a { color: inherit; text-decoration: none; }
.tlx-crumbs a:hover, .tlx-crumbs a:focus-visible { color: var(--copper); }
.tlx-crumbs span[aria-hidden] { color: var(--maple-200); }
.tlx-title { font-family: var(--font-display); font-weight: 600; line-height: 1.12;
  font-size: clamp(1.9rem, 4.5vw, 3rem); letter-spacing: -0.01em; margin: 0 0 1rem; }
.tlx-lede { font-size: 1.1rem; line-height: 1.65; color: var(--walnut-700);
  max-width: 62ch; margin: 0 0 1.75rem; }

/* ── Meta strip (the instrument label) ── */
.tlx-meta { display: flex; flex-wrap: wrap; gap: 0.4rem 1.4rem;
  font-family: var(--font-mono); font-size: 0.74rem; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--oak-500); }
.tlx-meta strong { color: var(--walnut-900); font-weight: 600; }

/* ── Section scaffolding ── */
.tlx-section { padding: 3.25rem 0; }
.tlx-section + .tlx-section { border-top: 1px solid var(--cream-100); }
.tlx-section .shell { max-width: 1080px; }
.tlx-kicker { font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--copper); margin: 0 0 0.6rem; }
.tlx-h2 { font-family: var(--font-display); font-weight: 600; font-size: 1.6rem;
  line-height: 1.2; margin: 0 0 0.75rem; }
.tlx-note { color: var(--walnut-700); max-width: 60ch; margin: 0 0 2rem; line-height: 1.6; }

/* ── Cards ── */
.tlx-grid { display: grid; gap: 1.25rem; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
.tlx-card { display: flex; flex-direction: column; gap: 0.65rem; padding: 1.5rem;
  background: var(--cream-50); border: 1px solid var(--cream-100); border-radius: 14px;
  text-decoration: none; color: inherit;
  transition: border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease; }
.tlx-card:hover, .tlx-card:focus-visible { border-color: var(--copper);
  transform: translateY(-2px); box-shadow: 0 10px 28px rgba(67, 48, 31, 0.10); }
.tlx-card:focus-visible { outline: 2px solid var(--copper); outline-offset: 2px; }
.tlx-card h3 { font-family: var(--font-display); font-weight: 600; font-size: 1.12rem;
  line-height: 1.3; margin: 0; }
.tlx-card p { color: var(--walnut-700); font-size: 0.92rem; line-height: 1.55; margin: 0; }
.tlx-card-tag { font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--copper); }
.tlx-card-data { margin-top: auto; padding-top: 0.75rem; border-top: 1px dashed var(--maple-200);
  font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.04em;
  color: var(--oak-500); display: flex; flex-wrap: wrap; gap: 0.35rem 1rem; }
.tlx-card-cta { color: var(--copper); font-weight: 600; font-size: 0.9rem; }

/* ── Pillars ── */
.tlx-pillar { background: var(--cream-50); border: 1px solid var(--cream-100);
  border-left: 3px solid var(--copper); border-radius: 12px; padding: 1.5rem; }
.tlx-pillar h3 { font-family: var(--font-display); font-size: 1.1rem; margin: 0 0 0.5rem; }
.tlx-pillar p { color: var(--walnut-700); font-size: 0.92rem; line-height: 1.55; margin: 0 0 0.9rem; }
.tlx-pillar ul { list-style: none; margin: 0; padding: 0;
  font-family: var(--font-mono); font-size: 0.76rem; color: var(--oak-500); }
.tlx-pillar li { padding: 0.22rem 0; }
.tlx-pillar li::before { content: '✓ '; color: var(--copper); }

/* ── Case-study spec strip (the job card) ── */
.tlx-specs { display: grid; gap: 1px; background: var(--cream-100);
  border: 1px solid var(--cream-100); border-radius: 12px; overflow: hidden;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); margin-top: 1.75rem; }
.tlx-spec { background: var(--cream-50); padding: 0.85rem 1rem; }
.tlx-spec dt { font-family: var(--font-mono); font-size: 0.64rem; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--oak-500); margin: 0 0 0.25rem; }
.tlx-spec dd { margin: 0; font-size: 0.88rem; font-weight: 600; color: var(--walnut-900); }

/* ── Article body ── */
.tlx-body { max-width: 720px; margin: 0 auto; font-size: 1.02rem; line-height: 1.75;
  color: var(--walnut-900); }
.tlx-body > :first-child { margin-top: 0; }
.tlx-body h2 { font-family: var(--font-display); font-weight: 600; font-size: 1.55rem;
  line-height: 1.25; margin: 2.75rem 0 1rem; }
.tlx-body h3 { font-family: var(--font-display); font-weight: 600; font-size: 1.2rem;
  margin: 2.1rem 0 0.75rem; }
.tlx-body h4 { font-weight: 700; font-size: 1rem; margin: 1.75rem 0 0.5rem; }
.tlx-body p { margin: 0 0 1.1rem; }
.tlx-body a { color: var(--copper-deep); text-decoration: underline;
  text-decoration-color: var(--copper); text-underline-offset: 3px; }
.tlx-body a:hover { color: var(--copper); }
.tlx-body ul, .tlx-body ol { margin: 0 0 1.2rem; padding-left: 1.4rem; }
.tlx-body li { margin: 0.3rem 0; }
.tlx-body li::marker { color: var(--copper); }
.tlx-body li > input[type='checkbox'] { accent-color: var(--copper); margin-right: 0.5rem; }
.tlx-body strong { color: var(--walnut-950); }
.tlx-body blockquote { margin: 1.5rem 0; padding: 0.9rem 1.25rem;
  border-left: 3px solid var(--copper); background: var(--cream-50);
  border-radius: 0 10px 10px 0; color: var(--walnut-700); font-style: italic; }
.tlx-body hr { border: 0; border-top: 1px solid var(--cream-100); margin: 2.5rem 0; }

/* The signature: measurement data on cream reading strips */
.tlx-body table { width: 100%; border-collapse: collapse; margin: 1.5rem 0;
  font-size: 0.88rem; line-height: 1.45; }
.tlx-body thead th { font-family: var(--font-mono); font-size: 0.7rem;
  letter-spacing: 0.1em; text-transform: uppercase; color: var(--oak-500);
  text-align: left; padding: 0.55rem 0.8rem; border-bottom: 2px solid var(--copper); }
.tlx-body tbody td { padding: 0.55rem 0.8rem; border-bottom: 1px solid var(--cream-100);
  font-variant-numeric: tabular-nums; vertical-align: top; }
.tlx-body tbody tr:nth-child(odd) td { background: var(--cream-50); }
.tlx-body td:first-child, .tlx-body th:first-child { padding-left: 1rem; }
.tlx-body code { font-family: var(--font-mono); font-size: 0.86em;
  background: var(--cream-100); border-radius: 5px; padding: 0.12em 0.4em; }
.tlx-body pre { margin: 1.5rem 0; padding: 1.1rem 1.25rem; overflow-x: auto;
  background: var(--cream-50); border: 1px solid var(--cream-100);
  border-left: 3px solid var(--copper); border-radius: 0 10px 10px 0;
  font-family: var(--font-mono); font-size: 0.82rem; line-height: 1.6;
  color: var(--walnut-900); }
.tlx-body pre code { background: none; padding: 0; border-radius: 0; }

@media (max-width: 640px) {
  .tlx-body table { display: block; overflow-x: auto; }
}

/* ── About / tags footer ── */
.tlx-about { max-width: 720px; margin: 3.5rem auto 0; padding: 1.4rem 1.5rem;
  background: var(--cream-50); border: 1px solid var(--cream-100); border-radius: 12px; }
.tlx-about h3 { font-family: var(--font-display); font-size: 1rem; margin: 0 0 0.4rem; }
.tlx-about p { color: var(--walnut-700); font-size: 0.9rem; line-height: 1.6; margin: 0; }
.tlx-tags { max-width: 720px; margin: 1.5rem auto 0; display: flex; flex-wrap: wrap; gap: 0.5rem; }
.tlx-tags span { font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.06em;
  padding: 0.3rem 0.75rem; border: 1px solid var(--cream-100); border-radius: 999px;
  background: var(--cream-50); color: var(--oak-500); }

/* ── Related ── */
.tlx-related { max-width: 860px; margin: 4rem auto 0; padding-top: 2.5rem;
  border-top: 1px solid var(--cream-100); }
.tlx-related .tlx-grid { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }

/* ── CTA band ── */
.tlx-cta { background: var(--walnut-950); color: var(--cream-50); border-radius: 18px;
  padding: 2.5rem 2rem; text-align: center; }
.tlx-cta h2 { font-family: var(--font-display); font-size: 1.5rem; margin: 0 0 0.6rem; }
.tlx-cta p { color: var(--maple-200); margin: 0 0 1.5rem; }

@media (prefers-reduced-motion: reduce) {
  .tlx-card, .tlx-card:hover { transition: none; transform: none; }
}
TLX_EOF_7f3a1
  echo "globals.css: tlx block appended"
fi

# ── splices ──
node << 'TLX_EOF_7f3a1'
const fs = require('fs');
const edit = (f, from, to, { optional = false } = {}) => {
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes(to)) { console.log('skip (already applied):', f); return; }
  if (!s.includes(from)) {
    if (optional) { console.log('skip (anchor absent):', f); return; }
    throw new Error('ANCHOR NOT FOUND in ' + f + ': ' + JSON.stringify(from.slice(0, 60)));
  }
  fs.writeFileSync(f, s.replace(from, to));
  console.log('spliced:', f);
};

// loader.ts
edit('apps/web/lib/content/loader.ts',
  "import grayMatter from 'gray-matter';",
  "import grayMatter from 'gray-matter';\nimport { renderMarkdown, estimateReadingTime } from './markdown';");
edit('apps/web/lib/content/loader.ts',
  "    return {\n      ...metadata,\n      content: body,\n    };",
  "    return {\n      ...metadata,\n      readingTimeMinutes: metadata.readingTimeMinutes ?? estimateReadingTime(body),\n      content: renderMarkdown(body),\n    };");
edit('apps/web/lib/content/loader.ts',
  "      const content = await fs.readFile(filepath, 'utf-8');\n      const { metadata } = parseArticleFile(filename, content);",
  "      const content = await fs.readFile(filepath, 'utf-8');\n      const { metadata, body } = parseArticleFile(filename, content);");
edit('apps/web/lib/content/loader.ts',
  "        readingTimeMinutes: metadata.readingTimeMinutes,",
  "        readingTimeMinutes: metadata.readingTimeMinutes ?? estimateReadingTime(body),");
edit('apps/web/lib/content/loader.ts',
  "author: data.author || 'Mark Carelli',", "author: data.author || 'The Ecowoods Team',", { optional: true });

// case-study-loader.ts
edit('apps/web/lib/content/case-study-loader.ts',
  "from './case-study-types';",
  "from './case-study-types';\nimport { renderMarkdown } from './markdown';");
edit('apps/web/lib/content/case-study-loader.ts', 'content: body,', 'content: renderMarkdown(body),');
edit('apps/web/lib/content/case-study-loader.ts',
  "author: data.author || 'Mark Carelli',", "author: data.author || 'The Ecowoods Team',", { optional: true });

// blog/[slug]/page.tsx
edit('apps/web/app/blog/[slug]/page.tsx',
  "      name: article.author || 'Mark Carelli',\n      title: article.authorTitle || 'Lead Architect',",
  "      name: article.author || 'Ecowoods',\n      title: article.authorTitle,", { optional: true });
{
  const f = 'apps/web/app/blog/[slug]/page.tsx';
  let s = fs.readFileSync(f, 'utf8');
  const n = s.replace(/publishedTime: (?!new Date)([A-Za-z.]*publishedAt)/g, 'publishedTime: new Date($1).toISOString()');
  if (n !== s) { fs.writeFileSync(f, n); console.log('spliced: publishedTime ISO'); }
}

// case-studies/[slug]/page.tsx
edit('apps/web/app/case-studies/[slug]/page.tsx',
  "      <CaseStudyLayout metadata={caseStudy} relatedContent={relatedContent}>\n        {caseStudy.content}\n      </CaseStudyLayout>",
  "      <CaseStudyLayout metadata={caseStudy} relatedContent={relatedContent}>\n        <div className=\"tlx-body\" dangerouslySetInnerHTML={{ __html: caseStudy.content }} />\n      </CaseStudyLayout>");
edit('apps/web/app/case-studies/[slug]/page.tsx',
  "caseStudy.author || 'Mark Carelli'", "caseStudy.author || 'Ecowoods'", { optional: true });
edit('apps/web/app/case-studies/[slug]/page.tsx',
  "caseStudy.authorTitle || 'Lead Architect'", 'caseStudy.authorTitle', { optional: true });

// schema builders + type comment
edit('apps/web/lib/schema/builders.ts',
  "      name: config.author?.name || 'Mark Carelli',", "      name: config.author?.name || 'Ecowoods',", { optional: true });
edit('apps/web/lib/content/types.ts',
  '/** Author name (default: Mark Carelli) */', '/** Author name (default: The Ecowoods Team) */', { optional: true });

// mdx bylines -> The Ecowoods Team
const path = require('path');
for (const d of ['apps/web/content/articles', 'apps/web/content/case-studies']) {
  for (const x of fs.readdirSync(d).filter((n) => n.endsWith('.mdx'))) {
    const p = path.join(d, x);
    let s = fs.readFileSync(p, 'utf8');
    const before = s;
    s = s.replace(/^author: Mark Carelli$/m, 'author: The Ecowoods Team');
    s = s.replace(/^author-title: Lead Architect, EcoWoods\n/m, '');
    if (s !== before) { fs.writeFileSync(p, s); console.log('byline:', x); }
  }
}
console.log('splices done');
TLX_EOF_7f3a1

echo "== done — now run: pnpm --filter @ecowoods/web add marked && pnpm --filter web build =="
