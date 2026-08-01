/**
 * Blog index — list all published articles.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getArticles } from '@/lib/content/loader';
import { formatDate } from '@/lib/content/utils';
import { buildBreadcrumbList, SchemaScript } from '@/lib/schema';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ecowoods.ca';

export const metadata: Metadata = {
  title: 'Blog — EcoWoods Hardwood Flooring',
  description: 'Technical articles on hardwood flooring, installation, finishing, and species selection for Toronto contractors and homeowners.',
  openGraph: {
    title: 'Blog — EcoWoods Hardwood Flooring',
    description: 'Technical articles on hardwood flooring installation and finishing.',
    images: [
      {
        url: `${SITE_URL}/og-image.jpg`,
        width: 1200,
        height: 630,
      },
    ],
  },
};

export default async function BlogPage() {
  const articles = await getArticles();

  const breadcrumbSchema = buildBreadcrumbList([
    { name: 'Home', url: SITE_URL },
    { name: 'Blog', url: `${SITE_URL}/blog` },
  ]);

  return (
    <>
      <SchemaScript schema={breadcrumbSchema} />
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white dark:from-stone-900 dark:to-stone-950">
        {/* Header */}
        <header className="border-b border-stone-200 dark:border-stone-800">
          <div className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
            <nav className="mb-4 text-sm text-stone-600 dark:text-stone-400">
              <Link href="/" className="hover:text-stone-900 dark:hover:text-stone-200">
                Home
              </Link>
              <span className="mx-2">/</span>
              <span>Blog</span>
            </nav>
            <h1 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl text-stone-900 dark:text-stone-50">Blog</h1>
            <p className="text-lg text-stone-600 dark:text-stone-300">
              Technical articles on hardwood flooring, installation, finishing, and species selection. Sourced from 25+ years of Toronto installations.
            </p>
          </div>
        </header>

        {/* Articles Grid */}
        <main className="mx-auto max-w-4xl px-6 py-12">
          {articles.length === 0 ? (
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-8 text-center dark:border-stone-800 dark:bg-stone-900">
              <p className="text-stone-600 dark:text-stone-400">No articles published yet. Check back soon.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Featured Articles */}
              {articles.filter((a) => a.featured).length > 0 && (
                <section>
                  <h2 className="mb-4 text-2xl font-bold text-stone-900 dark:text-stone-50">Featured</h2>
                  <div className="space-y-4">
                    {articles
                      .filter((a) => a.featured)
                      .map((article) => (
                        <ArticleCard key={article.slug} article={article} featured />
                      ))}
                  </div>
                </section>
              )}

              {/* All Articles */}
              <section>
                <h2 className="mb-4 text-2xl font-bold text-stone-900 dark:text-stone-50">Latest Articles</h2>
                <div className="space-y-4">
                  {articles.map((article) => (
                    <ArticleCard key={article.slug} article={article} />
                  ))}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

function ArticleCard({
  article,
  featured = false,
}: {
  article: Awaited<ReturnType<typeof getArticles>>[number];
  featured?: boolean;
}) {
  return (
    <article
      className={`group overflow-hidden rounded-lg border transition-colors hover:border-amber-300 dark:hover:border-amber-700 ${
        featured
          ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950'
          : 'border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900'
      }`}
    >
      <Link href={`/blog/${article.slug}`} className="block p-6 no-underline">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xl font-bold text-stone-900 group-hover:text-amber-700 dark:text-stone-50 dark:group-hover:text-amber-400">
            {article.title}
          </h3>
          {featured && <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">FEATURED</span>}
        </div>

        <p className="mb-4 text-stone-600 dark:text-stone-400">{article.description}</p>

        <div className="flex flex-wrap items-center gap-3 text-sm text-stone-500 dark:text-stone-500">
          <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
          {article.readingTimeMinutes && (
            <>
              <span>·</span>
              <span>{article.readingTimeMinutes} min read</span>
            </>
          )}
          {article.category && (
            <>
              <span>·</span>
              <span className="inline-block rounded bg-stone-200 px-2 py-1 text-xs dark:bg-stone-800">{article.category.replace(/-/g, ' ')}</span>
            </>
          )}
        </div>
      </Link>
    </article>
  );
}
