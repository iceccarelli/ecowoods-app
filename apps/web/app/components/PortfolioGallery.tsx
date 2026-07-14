'use client';

/**
 * PortfolioGallery — masonry grid on desktop, SwipeDeck on mobile.
 * The deck engine lives in SwipeDeck.tsx; this file only supplies the image
 * card content and the desktop fallback grid (unchanged from the original).
 */

import SwipeDeck, { useIsMobile } from './SwipeDeck';

export type PortfolioItem = {
  id: string;
  title: string;
  sub: string;
  image: string;
  span: string;
};

export default function PortfolioGallery({ items }: { items: PortfolioItem[] }) {
  const { mounted, isMobile } = useIsMobile();

  const grid = (
    <div className="gallery-grid">
      {items.map((g, i) => (
        <div key={g.id} className={`gallery-tile ${g.span} reveal`} data-delay={(i % 4) + 1}>
          <img
            src={g.image}
            alt={g.title}
            loading={i === 0 ? 'eager' : 'lazy'}
            fetchPriority={i === 0 ? 'high' : 'auto'}
            decoding="async"
          />
          <div className="gallery-caption">
            <div className="title">{g.title}</div>
            <div className="sub">{g.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );

  if (!mounted || !isMobile || items.length === 0) return grid;

  return (
    <SwipeDeck
      items={items}
      getKey={(g) => g.id}
      ariaLabel="Project portfolio"
      srLabel={(g) => `${g.title} — ${g.sub}`}
      cardClassName="pfd-card--image"
      cta={{ href: '#quote', label: 'Get an estimate for a floor like this' }}
      hint={`Swipe to browse · ${items.length} recent Toronto projects`}
      renderCard={(g) => (
        <>
          <img className="pfd-img" src={g.image} alt={g.title} draggable={false} decoding="async" />
          <div className="pfd-scrim" />
          <div className="pfd-caption">
            <div className="pfd-title">{g.title}</div>
            <div className="pfd-sub">{g.sub}</div>
          </div>
        </>
      )}
    />
  );
}
