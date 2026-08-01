/**
 * CaseStudyLayout — render case study with metadata, header, and related content.
 */

import Link from 'next/link';
import type { CaseStudy } from '@/lib/content';
import type { RelatedContent } from '@/lib/graph/contentLinks';

interface CaseStudyLayoutProps {
  metadata: CaseStudy;
  children: React.ReactNode;
  relatedContent?: RelatedContent[];
}

export function CaseStudyLayout({ metadata, children, relatedContent }: CaseStudyLayoutProps) {
  const woodSpeciesText = Array.isArray(metadata.woodSpecies)
    ? metadata.woodSpecies.join(', ')
    : metadata.woodSpecies;

  const projectDateYear = new Date(metadata.projectDate).getFullYear();

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white dark:from-stone-900 dark:to-stone-950">
      {/* Header */}
      <header className="border-b border-stone-200 dark:border-stone-800">
        <div className="mx-auto max-w-3xl px-6 py-8 sm:py-12">
          {/* Breadcrumb */}
          <nav className="mb-4 text-sm text-stone-600 dark:text-stone-400">
            <Link href="/" className="hover:text-stone-900 dark:hover:text-stone-200">
              Home
            </Link>
            <span className="mx-2">/</span>
            <Link href="/technical-library" className="hover:text-stone-900 dark:hover:text-stone-200">
              Technical Library
            </Link>
            <span className="mx-2">/</span>
            <Link href="/case-studies" className="hover:text-stone-900 dark:hover:text-stone-200">
              Case Studies
            </Link>
            <span className="mx-2">/</span>
            <span>{metadata.title}</span>
          </nav>

          {/* Title */}
          <h1 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl text-stone-900 dark:text-stone-50">
            {metadata.title}
          </h1>

          {/* Description */}
          <p className="mb-6 text-lg text-stone-600 dark:text-stone-300">{metadata.description}</p>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
            {/* Project Type */}
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">Project Type</span>
              <span className="text-sm font-medium text-stone-900 dark:text-stone-50">
                {metadata.projectType.replace(/-/g, ' ')}
              </span>
            </div>

            {/* Location */}
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">Location</span>
              <span className="text-sm font-medium text-stone-900 dark:text-stone-50">
                {metadata.location.city}, {metadata.location.province}
              </span>
            </div>

            {/* Year */}
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">Year</span>
              <span className="text-sm font-medium text-stone-900 dark:text-stone-50">{projectDateYear}</span>
            </div>

            {/* Square Footage */}
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">Size</span>
              <span className="text-sm font-medium text-stone-900 dark:text-stone-50">
                {metadata.squareFootage.toLocaleString()} sqft
              </span>
            </div>

            {/* Wood Species */}
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">Wood</span>
              <span className="text-sm font-medium text-stone-900 dark:text-stone-50">{woodSpeciesText}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-3xl px-6 py-12">
        {/* Author & Date */}
        <div className="mb-8 flex items-center justify-between border-b border-stone-200 pb-6 dark:border-stone-800">
          <div>
            <p className="text-sm font-medium text-stone-900 dark:text-stone-50">
              {metadata.author || 'Mark Carelli'}
            </p>
            {metadata.authorTitle && (
              <p className="text-sm text-stone-600 dark:text-stone-400">{metadata.authorTitle}</p>
            )}
          </div>
          <time
            dateTime={metadata.publishedAt}
            className="text-sm text-stone-600 dark:text-stone-400"
          >
            {new Date(metadata.publishedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
        </div>

        {/* Content */}
        <div className="prose prose-stone dark:prose-invert max-w-none">
          <div
            dangerouslySetInnerHTML={{
              __html: typeof metadata.content === 'string' ? metadata.content : '',
            }}
          />
        </div>

        {/* Testimonial (if available) */}
        {metadata.testimonial && (
          <div className="mt-12 border-l-4 border-amber-500 bg-amber-50 p-6 dark:border-amber-400 dark:bg-amber-950">
            <blockquote className="mb-2 text-lg font-medium text-stone-900 dark:text-stone-50">
              {metadata.testimonial.quote}
            </blockquote>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              — {metadata.testimonial.attribution}
            </p>
          </div>
        )}

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

        {/* Related Resources (Topics/Articles from frontmatter) */}
        <aside className="mt-12 space-y-6 border-t border-stone-200 dark:border-stone-800 pt-8">
          {/* Topics */}
          {metadata.topics && metadata.topics.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase text-stone-900 dark:text-stone-50">
                Topics Covered
              </h3>
              <div className="flex flex-wrap gap-2">
                {metadata.topics.map((topic) => (
                  <span
                    key={topic}
                    className="inline-block rounded bg-stone-200 px-3 py-1 text-xs font-medium text-stone-700 dark:bg-stone-800 dark:text-stone-300"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}
        </aside>
      </main>

      {/* Footer CTA */}
      <footer className="border-t border-stone-200 bg-stone-100 dark:border-stone-800 dark:bg-stone-900">
        <div className="mx-auto max-w-3xl px-6 py-8 text-center sm:py-12">
          <h2 className="mb-2 text-2xl font-bold text-stone-900 dark:text-stone-50">Ready for Your Project?</h2>
          <p className="mb-6 text-stone-600 dark:text-stone-300">
            Let's discuss your hardwood installation and create a custom plan.
          </p>
          <Link
            href="/contact"
            className="inline-block rounded-lg bg-amber-600 px-6 py-3 font-semibold text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
          >
            Schedule a Consultation
          </Link>
        </div>
      </footer>
    </div>
  );
}
