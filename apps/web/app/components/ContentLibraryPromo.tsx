/**
 * Content Library Promo — featured articles and case studies on homepage.
 * Showcases technical authority and drives traffic to blog/case-studies.
 */

import Link from 'next/link';
import { getArticles } from '@/lib/content/loader';
import { getCaseStudies } from '@/lib/content/case-study-loader';

export async function ContentLibraryPromo() {
  // Fetch featured articles and case studies
  const articles = await getArticles();
  const caseStudies = await getCaseStudies();

  // Get featured articles (with featured: true in frontmatter)
  const featuredArticles = articles
    .filter((a) => a.featured)
    .slice(0, 2);

  // Get featured case studies
  const featuredCaseStudies = caseStudies
    .filter((c) => c.featured)
    .slice(0, 2);

  // Fallback to latest if no featured
  const displayArticles =
    featuredArticles.length > 0
      ? featuredArticles
      : articles.slice(0, 2);

  const displayCaseStudies =
    featuredCaseStudies.length > 0
      ? featuredCaseStudies
      : caseStudies.slice(0, 2);

  return (
    <section className="section paper-texture">
      <div className="shell">
        <div className="section-head reveal" style={{ maxWidth: '720px' }}>
          <span className="eyebrow">Technical Authority</span>
          <h2>
            Deep dive into <span className="serif-italic">the science.</span>
          </h2>
          <p>
            Real-world engineering guides and case studies from 25+ years of Toronto hardwood flooring installations.
            Learn the methodology behind moisture testing, thermal management, and finish chemistry — straight from the job site.
          </p>
        </div>

        {/* Two-column grid: Articles + Case Studies */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
          {/* Articles Column */}
          <div className="space-y-6 reveal">
            <div className="inline-block">
              <h3 className="text-xl font-bold text-stone-900 dark:text-stone-50 mb-6">Technical Articles</h3>
            </div>
            <div className="space-y-4">
              {displayArticles.map((article) => (
                <Link
                  key={article.slug}
                  href={`/blog/${article.slug}`}
                  className="group block p-5 border border-stone-200 dark:border-stone-700 rounded-lg hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-stone-900 dark:text-stone-50 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors mb-2 line-clamp-2">
                        {article.title}
                      </h4>
                      <p className="text-sm text-stone-600 dark:text-stone-400 line-clamp-2">
                        {article.description}
                      </p>
                      {article.wordCount ? (
                        <div className="mt-3 flex items-center gap-3 text-xs text-stone-500 dark:text-stone-400">
                          <span>{article.wordCount.toLocaleString()} words</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform">
                      →
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300 font-medium text-sm mt-2"
            >
              View all articles
              <span>→</span>
            </Link>
          </div>

          {/* Case Studies Column */}
          <div className="space-y-6 reveal">
            <div className="inline-block">
              <h3 className="text-xl font-bold text-stone-900 dark:text-stone-50 mb-6">Case Studies</h3>
            </div>
            <div className="space-y-4">
              {displayCaseStudies.map((caseStudy) => (
                <Link
                  key={caseStudy.slug}
                  href={`/case-studies/${caseStudy.slug}`}
                  className="group block p-5 border border-stone-200 dark:border-stone-700 rounded-lg hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-block px-2 py-1 text-xs font-semibold text-white bg-amber-600 dark:bg-amber-700 rounded-full">
                          {caseStudy.projectType?.replace(/-/g, ' ')}
                        </span>
                      </div>
                      <h4 className="font-semibold text-stone-900 dark:text-stone-50 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors mb-2 line-clamp-2">
                        {caseStudy.title}
                      </h4>
                      <p className="text-sm text-stone-600 dark:text-stone-400 line-clamp-2">
                        {caseStudy.description}
                      </p>
                      <div className="mt-3 text-xs text-stone-500 dark:text-stone-400">
                        {caseStudy.location.city}, {caseStudy.location.province} · {caseStudy.squareFootage.toLocaleString()} sqft
                      </div>
                    </div>
                    <div className="text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform">
                      →
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <Link
              href="/case-studies"
              className="inline-flex items-center gap-2 text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300 font-medium text-sm mt-2"
            >
              View all case studies
              <span>→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
