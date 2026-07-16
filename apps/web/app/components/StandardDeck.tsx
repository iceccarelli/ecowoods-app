'use client';

/**
 * StandardDeck — "The Ecowoods Standard" pillars.
 * Desktop keeps the original 4-up grid (glanceable at once). On mobile, where
 * the pillars otherwise stack into four full-height screens, they become the
 * shared SwipeDeck so the value props are one thumb-swipe apart.
 */

import { ReactNode } from 'react';
import SwipeDeck, { useIsMobile } from './SwipeDeck';

export type Pillar = {
  icon: string;
  title: string;
  proof: string;
};

export default function StandardDeck({
  items,
  icon,
}: {
  items: Pillar[];
  icon: Record<string, ReactNode>;
}) {
  const { mounted, isMobile } = useIsMobile();

  const grid = (
    <div className="standard-grid">
      {items.map((p, i) => (
        <div key={p.title} className="standard-pillar reveal" data-delay={i + 1}>
          <div className="standard-pillar-icon" aria-hidden="true">
            {icon[p.icon]}
          </div>
          <h4>{p.title}</h4>
          <p>{p.proof}</p>
        </div>
      ))}
    </div>
  );

  if (!mounted || !isMobile || items.length === 0) return grid;

  return (
    <SwipeDeck
      items={items}
      getKey={(p) => p.title}
      ariaLabel="The Ecowoods Standard"
      srLabel={(p) => `${p.title}. ${p.proof}`}
      cardClassName="pfd-card--panel pfd-card--standard"
      cta={{ href: '#quote', label: 'Get this standard in your home' }}
      hint={`Swipe through what makes Ecowoods different · ${items.length} standards`}
      renderCard={(p) => (
        <>
          <div className="pfd-panel-icon" aria-hidden="true">
            {icon[p.icon]}
          </div>
          <h4 className="pfd-panel-title">{p.title}</h4>
          <p className="pfd-panel-body">{p.proof}</p>
        </>
      )}
    />
  );
}
