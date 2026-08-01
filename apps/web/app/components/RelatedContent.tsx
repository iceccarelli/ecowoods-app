'use client';

import Link from 'next/link';
import type { RelatedContent } from '@/lib/graph/contentLinks';

interface RelatedContentProps {
  items: RelatedContent[];
}

/**
 * Display 2–4 related articles/case studies
 * Shown at the bottom of article/case study detail pages
 */
export function RelatedContent({ items }: RelatedContentProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <section className=\"mt-16 border-t border-gray-200 pt-16\">
      <h2 className=\"text-2xl font-bold text-gray-900 mb-8\">Related Content</h2>
      <div className=\"grid grid-cols-1 md:grid-cols-2 gap-8\">
        {items.map((item) => (
          <Link
            key={`${item.type}-${item.slug}`}
            href={item.type === 'article' ? `/blog/${item.slug}` : `/case-studies/${item.slug}`}
            className=\"group block p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200 hover:border-green-500 hover:shadow-lg transition-all duration-200\"
          >
            {/* Content Type Badge */}
            <div className=\"flex items-center justify-between mb-4\">
              <span className=\"inline-block px-3 py-1 text-xs font-semibold text-white bg-green-600 rounded-full\">
                {item.type === 'article' ? 'Technical Article' : 'Case Study'}
              </span>
              {item.sharedTopics.length > 0 && (
                <span className=\"text-xs text-gray-600\">
                  {item.sharedTopics.slice(0, 1).join(', ')}
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className=\"text-lg font-semibold text-gray-900 group-hover:text-green-600 transition-colors mb-3\">
              {item.title}
            </h3>

            {/* Description */}
            <p className=\"text-sm text-gray-700 line-clamp-2\">{item.description}</p>

            {/* Shared Topics */}
            {item.sharedTopics.length > 0 && (
              <div className=\"mt-4 flex flex-wrap gap-2\">
                {item.sharedTopics.slice(0, 2).map((topic) => (
                  <span
                    key={topic}
                    className=\"inline-block text-xs bg-white text-gray-700 px-2 py-1 rounded border border-gray-300\"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            )}

            {/* Arrow Indicator */}
            <div className=\"mt-4 text-green-600 font-medium text-sm group-hover:translate-x-1 transition-transform\">
              Read More →
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
"