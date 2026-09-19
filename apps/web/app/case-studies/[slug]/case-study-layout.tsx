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
import { ColorMatchFigure } from '@/app/components/ColorMatchFigure';

interface CaseStudyLayoutProps {
  metadata: CaseStudyMetadata;
  children: ReactNode;
  relatedContent?: RelatedContent[];
  /**
   * A frame from the 2026 colour-matching illustration pack
   * (scripts/fixtures/color-matching-manifest.csv), keyed by slug in
   * case-studies/[slug]/page.tsx. Case studies otherwise have no hero image
   * slot — `metadata.images` is used only as an OG-image fallback — so this is
   * additive, not a replacement for anything already here.
   */
  heroImageId?: string;
}

export function CaseStudyLayout({ metadata, children, relatedContent, heroImageId }: CaseStudyLayoutProps) {
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

      {heroImageId && (
        <section className="tlx-section tlx-section--flush" aria-label={`${metadata.title} illustrated`}>
          <div className="shell">
            <ColorMatchFigure id={heroImageId} priority />
          </div>
        </section>
      )}

      <div className="tlx-section">
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
      </div>
    </article>
  );
}
