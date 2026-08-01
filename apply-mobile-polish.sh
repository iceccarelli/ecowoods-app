#!/usr/bin/env bash
# apply-mobile-polish.sh — EcoWoods mobile/tablet polish (2026-08-01)
# Run from the repo root: bash apply-mobile-polish.sh
# Then: pnpm --filter web build   (must be green BEFORE any deploy)
set -euo pipefail
cd "$(dirname "$0")"
echo "== EcoWoods mobile polish =="

# 1. Harden all auto-fit/auto-fill grids against sub-360px viewports
node << 'NODE_MOB_EOF_4c9d2'
const fs = require('fs');
const f = 'apps/web/app/globals.css';
let s = fs.readFileSync(f, 'utf8');
const re = /repeat\((auto-fit|auto-fill), minmax\((2[89]\d|3[0-4]\d)px, 1fr\)\)/g;
const n = (s.match(re) || []).length;
s = s.replace(re, (m, mode, px) => `repeat(${mode}, minmax(min(100%, ${px}px), 1fr))`);
fs.writeFileSync(f, s);
console.log(n ? `hardened ${n} grid(s)` : 'grids already hardened');
NODE_MOB_EOF_4c9d2

# 2. Append tlx responsive layer + clp styles (once)
if grep -q 'tlx responsive layer' apps/web/app/globals.css; then
  echo "globals.css: responsive layer already present"
else
  cat >> apps/web/app/globals.css << 'MOB_EOF_4c9d2'

/* ── tlx responsive layer: tablet & phone refinement ── */
@media (max-width: 1023px) {
  .tlx-hero { padding: 3.5rem 0 2.5rem; }
  .tlx-section { padding: 2.75rem 0; }
}

@media (max-width: 767px) {
  .tlx-hero { padding: 2.75rem 0 2rem; }
  .tlx-section { padding: 2.25rem 0; }
  .tlx-lede { font-size: 1.02rem; }
  .tlx-grid { gap: 1rem; }
  .tlx-card { padding: 1.25rem; }
  .tlx-specs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tlx-body { font-size: 0.98rem; line-height: 1.7; }
  .tlx-body h2 { font-size: 1.38rem; margin-top: 2.25rem; }
  .tlx-body h3 { font-size: 1.12rem; }
  .tlx-body table { font-size: 0.82rem; }
  .tlx-body thead th, .tlx-body tbody td { padding: 0.45rem 0.6rem; }
  .tlx-body pre { font-size: 0.78rem; padding: 0.9rem 1rem; }
  .tlx-about { padding: 1.1rem 1.15rem; margin-top: 2.75rem; }
  .tlx-related { margin-top: 3rem; padding-top: 2rem; }
  .tlx-cta { padding: 2rem 1.25rem; }
}

@media (max-width: 400px) {
  .tlx-title { font-size: 1.65rem; }
  .tlx-meta { font-size: 0.7rem; }
  .tlx-card-data { font-size: 0.68rem; }
}

@media (pointer: coarse) {
  .tlx-crumbs a { padding: 0.35rem 0.15rem; margin: -0.35rem -0.15rem; }
  .tlx-tags span { padding: 0.45rem 0.85rem; }
}

/* ── homepage content-library promo (.clp-*) ── */
.clp-grid { display: grid; gap: 2rem; margin-top: 2.5rem; grid-template-columns: 1fr; }
@media (min-width: 900px) { .clp-grid { grid-template-columns: 1fr 1fr; } }
.clp-col h3 { font-family: var(--font-display); font-weight: 600; font-size: 1.2rem;
  margin: 0 0 1rem; }
.clp-col .tlx-card + .tlx-card { margin-top: 1rem; }
.clp-more { display: inline-flex; align-items: center; gap: 0.4rem; margin-top: 1.25rem;
  color: var(--copper-deep); font-weight: 600; font-size: 0.92rem; text-decoration: none; }
.clp-more:hover, .clp-more:focus-visible { color: var(--copper); }
MOB_EOF_4c9d2
  echo "globals.css: responsive layer appended"
fi

# 3. On-brand, responsive ContentLibraryPromo
cat > apps/web/app/components/ContentLibraryPromo.tsx << 'MOB_EOF_4c9d2'
/**
 * ContentLibraryPromo — homepage section surfacing the technical library.
 * Server component (reads content from disk); rendered into the client
 * homepage as a prop from app/page.tsx. Styled with site tokens via the
 * .clp-* / .tlx-card classes in globals.css.
 */
import Link from 'next/link';
import { getArticles } from '@/lib/content/loader';
import { getCaseStudies } from '@/lib/content/case-study-loader';
import { formatDate } from '@/lib/content/utils';

export async function ContentLibraryPromo() {
  const [articles, caseStudies] = await Promise.all([getArticles(), getCaseStudies()]);
  if (articles.length === 0 && caseStudies.length === 0) return null;

  const featuredArticles = articles.filter((a) => a.featured);
  const displayArticles = (featuredArticles.length > 0 ? featuredArticles : articles).slice(0, 3);
  const featuredCaseStudies = caseStudies.filter((c) => c.featured);
  const displayCaseStudies = (featuredCaseStudies.length > 0 ? featuredCaseStudies : caseStudies).slice(0, 2);

  return (
    <section className="section paper-texture">
      <div className="shell">
        <div className="section-head reveal" style={{ maxWidth: '720px' }}>
          <span className="eyebrow">Technical Authority</span>
          <h2>
            Deep dive into <span className="serif-italic">the science.</span>
          </h2>
          <p>
            Engineering guides and project write-ups on the methodology behind moisture testing,
            thermal management, and finish chemistry — straight from the job site.
          </p>
        </div>

        <div className="clp-grid">
          {displayArticles.length > 0 && (
            <div className="clp-col reveal">
              <h3>Technical articles</h3>
              {displayArticles.map((article) => (
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
              ))}
              <Link href="/blog" className="clp-more">
                All articles <span aria-hidden>→</span>
              </Link>
            </div>
          )}

          {displayCaseStudies.length > 0 && (
            <div className="clp-col reveal">
              <h3>Case studies</h3>
              {displayCaseStudies.map((caseStudy) => (
                <Link key={caseStudy.slug} href={`/case-studies/${caseStudy.slug}`} className="tlx-card">
                  <span className="tlx-card-tag">Case study</span>
                  <h3>{caseStudy.title}</h3>
                  <p>{caseStudy.description}</p>
                  <span className="tlx-card-data">
                    <span>
                      {caseStudy.location.city}, {caseStudy.location.province}
                    </span>
                    <span>{caseStudy.squareFootage.toLocaleString()} sqft</span>
                  </span>
                </Link>
              ))}
              <Link href="/case-studies" className="clp-more">
                All case studies <span aria-hidden>→</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
MOB_EOF_4c9d2
echo "wrote ContentLibraryPromo.tsx"

echo "== done — REQUIRED next: pnpm --filter web build (green route table before deploy) =="
