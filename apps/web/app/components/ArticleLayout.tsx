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

      <div className="tlx-section">
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
      </div>
    </article>
  );
}
