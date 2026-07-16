'use client';

/**
 * TestimonialDeck — "Proof / What clients say".
 * Desktop keeps the original grid; on mobile the reviews become the shared
 * SwipeDeck. Testimonials are peer content you sample, not read in order, so a
 * deck fits them naturally and collapses several screens into one lane.
 */

import { ReactNode } from 'react';
import SwipeDeck, { useIsMobile } from './SwipeDeck';

export type Review = {
  initials: string;
  name: string;
  place: string;
  quote: string;
  stars: number;
};

function Stars({ count, star }: { count: number; star: ReactNode }) {
  return (
    <>
      {Array.from({ length: count }).map((_, j) => (
        <span key={j}>{star}</span>
      ))}
    </>
  );
}

export default function TestimonialDeck({
  items,
  star,
}: {
  items: Review[];
  star: ReactNode;
}) {
  const { mounted, isMobile } = useIsMobile();

  const grid = (
    <div className="testimonial-grid">
      {items.map((r, i) => (
        <article key={i} className="testimonial reveal" data-delay={(i % 3) + 1}>
          <div className="testimonial-stars" aria-label={`${r.stars} out of 5 stars`}>
            <Stars count={r.stars} star={star} />
          </div>
          <blockquote>&ldquo;{r.quote}&rdquo;</blockquote>
          <div className="testimonial-author">
            <div className="testimonial-avatar" aria-hidden="true">
              {r.initials}
            </div>
            <div className="testimonial-meta">
              <div className="name">{r.name}</div>
              <div className="place">{r.place}</div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );

  if (!mounted || !isMobile || items.length === 0) return grid;

  return (
    <SwipeDeck
      items={items}
      getKey={(r) => r.initials + r.name}
      ariaLabel="Client reviews"
      srLabel={(r) => `${r.stars} star review from ${r.name}, ${r.place}: ${r.quote}`}
      cardClassName="pfd-card--panel pfd-card--review"
      cta={{ href: '#quote', label: 'Start your own project' }}
      renderCard={(r) => (
        <>
          <div className="pfd-review-stars" aria-label={`${r.stars} out of 5 stars`}>
            <Stars count={r.stars} star={star} />
          </div>
          <blockquote className="pfd-quote">&ldquo;{r.quote}&rdquo;</blockquote>
          <div className="pfd-author">
            <div className="pfd-avatar" aria-hidden="true">
              {r.initials}
            </div>
            <div className="pfd-author-meta">
              <div className="pfd-author-name">{r.name}</div>
              <div className="pfd-author-place">{r.place}</div>
            </div>
          </div>
        </>
      )}
    />
  );
}
