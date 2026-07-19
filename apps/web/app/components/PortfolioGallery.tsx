'use client';

import Image from 'next/image';
import SwipeDeck, { useIsMobile } from './SwipeDeck';
import { BLUR_WARM, IMG_SIZES } from '@/lib/image';

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
          <Image
            src={g.image}
            alt={g.title}
            fill
            sizes={IMG_SIZES.galleryTile}
            priority={i === 0}
            placeholder="blur"
            blurDataURL={BLUR_WARM}
            style={{ objectFit: 'cover' }}
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
      aspectRatio="3 / 4"
      cta={{ href: '#quote', label: 'Get an estimate for a floor like this' }}
      hint={`Swipe to browse · ${items.length} recent Toronto projects`}
      renderCard={(g) => (
        <>
          <Image
            className="pfd-img"
            src={g.image}
            alt={g.title}
            fill
            sizes={IMG_SIZES.deckCard}
            placeholder="blur"
            blurDataURL={BLUR_WARM}
            draggable={false}
            style={{ objectFit: 'cover' }}
          />
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
