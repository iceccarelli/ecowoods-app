/**
 * ArticleLayout — consistent styling for blog post content.
 * Renders article with proper typography, spacing, and semantic HTML.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { formatDate } from '@/lib/content/utils';
import type { ArticleMetadata } from '@/lib/content/types';
import type { RelatedContent } from '@/lib/graph/contentLinks';

interface ArticleLayoutProps {
  metadata: ArticleMetadata;
  children: ReactNode; // MDX content
  relatedContent?: RelatedContent[];
}

export function ArticleLayout({ metadata, children, relatedContent }: ArticleLayoutProps) {
  const readingTime = metadata.readingTimeMinutes || Math.ceil((metadata.wordCount || 0) / 200);

  return (
    <article className="min-h-screen bg-gradient-to-b from-stone-50 to-white dark:from-stone-900 dark:to-stone-950">
      {/* Hero / Header */}
      <header className="border-b border-stone-200 dark:border-stone-800">
        <div className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
          {/* Breadcrumb */}
          <nav className="mb-4 flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
            <Link href="/" className="hover:text-stone-900 dark:hover:text-stone-200">
              Home
            </Link>
            <span>/</span>
            <Link href="/technical-library" className="hover:text-stone-900 dark:hover:text-stone-200">
              Technical Library
            </Link>
            <span>/</span>
            <Link href="/blog" className="hover:text-stone-900 dark:hover:text-stone-200">
              Blog
            </Link>
            {metadata.category && (
              <>
                <span>/</span>
                <span>{metadata.category.replace(/-/g, ' ')}</span>
              </>
            )}
          </nav>

          {/* Title */}
          <h1 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl text-stone-900 dark:text-stone-50">
            {metadata.title}
          </h1>

          {/* Description */}
          <p className="mb-6 text-lg text-stone-600 dark:text-stone-300">{metadata.description}</p>

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-stone-600 dark:text-stone-400">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{metadata.author || 'Mark Carelli'}</span>
              {metadata.authorTitle && <span>·</span>}
              {metadata.authorTitle && <span>{metadata.authorTitle}</span>}
            </div>
            <span>·</span>
            <time dateTime={metadata.publishedAt}>{formatDate(metadata.publishedAt)}</time>
            {readingTime > 0 && (
              <>
                <span>·</span>
                <span>{readingTime} min read</span>
              </>
            )}
            {metadata.semanticDensity && (
              <>
                <span>·</span>
                <span className="inline-block rounded bg-amber-100 px-2 py-1 text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                  Density: {metadata.semanticDensity}/10
                </span>
              </>
            )}
          </div>
        </div>

        {/* Feature Image */}
        {metadata.image && (
          <div className="relative aspect-video w-full overflow-hidden bg-stone-200 dark:bg-stone-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={metadata.image}
              alt={metadata.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}
      </header>

      {/* Content */}
      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="prose prose-stone dark:prose-invert max-w-none">{children}</div>

        {/* Related Content Grid */}
        {relatedContent && relatedContent.length > 0 && (
          <section className="mt-16 border-t border-stone-200 dark:border-stone-800 pt-16">
            <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-50 mb-8">Related Content</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {relatedContent.map((item) => (
                <Link
                  key={`${item.type}-${item.slug}`}
                  href={item.type === 'article' ? `/blog/${item.slug}` : `/case-studies/${item.slug}`}
                  className="group block p-6 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900 dark:to-amber-800 rounded-lg border border-amber-200 dark:border-amber-700 hover:border-amber-500 hover:shadow-lg transition-all duration-200"
                >
                  {/* Content Type Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-block px-3 py-1 text-xs font-semibold text-white bg-amber-600 dark:bg-amber-700 rounded-full">
                      {item.type === 'article' ? 'Article' : 'Case Study'}
                    </span>
                    {item.sharedTopics.length > 0 && (
                      <span className="text-xs text-amber-800 dark:text-amber-200">
                        {item.sharedTopics.slice(0, 1).join(', ')}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-50 group-hover:text-amber-700 dark:group-hover:text-amber-200 transition-colors mb-3">
                    {item.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-amber-800 dark:text-amber-100 line-clamp-2">{item.description}</p>

                  {/* Arrow Indicator */}
                  <div className="mt-4 text-amber-700 dark:text-amber-300 font-medium text-sm group-hover:translate-x-1 transition-transform">
                    Read More →
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 mt-16">
        <div className="mx-auto max-w-2xl px-6 py-8">
          <div className="rounded-lg bg-white p-6 dark:bg-stone-800">
            <h3 className="mb-2 text-sm font-semibold text-stone-900 dark:text-stone-50">About the Author</h3>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              {metadata.author || 'Mark Carelli'} is a hardwood flooring specialist with 25+ years of experience. This article reflects real-world
              installation, testing, and finishing practices across Toronto and the GTA.
            </p>
          </div>

          {/* Tags */}
          {metadata.tags && metadata.tags.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold text-stone-900 dark:text-stone-50">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {metadata.tags.map((tag) => (
                  <a
                    key={tag}
                    href={`/blog?tag=${encodeURIComponent(tag)}`}
                    className="inline-block rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-900 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-100 dark:hover:bg-amber-800"
                  >
                    {tag}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </footer>
    </article>
  );
}
