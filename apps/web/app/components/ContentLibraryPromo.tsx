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
