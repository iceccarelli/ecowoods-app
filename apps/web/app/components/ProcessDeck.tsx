'use client';

/**
 * ProcessDeck — "How It Works / Four steps to certainty".
 * Desktop keeps the original 4-across funnel grid. On mobile the steps become
 * the shared SwipeDeck, using the light card variant to match this section's
 * paper surface (the pillars/reviews decks sit on dark sections and use the
 * dark panel variant).
 *
 * Sequence is preserved deliberately: each card keeps its 01–04 numeral, and
 * the deck's counter/dots track position — so the steps still read as an order,
 * not a shuffle.
 */

import { ReactNode } from 'react';
import SwipeDeck, { useIsMobile } from './SwipeDeck';

export type FunnelStep = {
  num: string;
  icon: string;
  title: string;
  line: string;
};

export default function ProcessDeck({
  items,
  icon,
}: {
  items: FunnelStep[];
  icon: Record<string, ReactNode>;
}) {
  const { mounted, isMobile } = useIsMobile();

  const grid = (
    <div className="funnel-grid reveal">
      {items.map((step, i) => (
        <div key={step.num} className="funnel-step reveal" data-delay={i + 1}>
          <div className="funnel-step-top">
            <span className="funnel-step-icon" aria-hidden="true">
              {icon[step.icon]}
            </span>
            <span className="funnel-step-num">{step.num}</span>
          </div>
          <h4>{step.title}</h4>
          <p>{step.line}</p>
        </div>
      ))}
    </div>
  );

  if (!mounted || !isMobile || items.length === 0) return grid;

  return (
    <SwipeDeck
      items={items}
      getKey={(s) => s.num}
      ariaLabel="How it works"
      srLabel={(s) => `Step ${s.num}. ${s.title}. ${s.line}`}
      cardClassName="pfd-card--themed pfd-card--step"
      cta={{ href: '#quote', label: 'Start with step one — book your estimate' }}
      renderCard={(s) => (
        <>
          <div className="pfd-step-top">
            <span className="pfd-step-icon" aria-hidden="true">
              {icon[s.icon]}
            </span>
            <span className="pfd-step-num" aria-hidden="true">
              {s.num}
            </span>
          </div>
          <h4 className="pfd-step-title">{s.title}</h4>
          <p className="pfd-step-body">{s.line}</p>
        </>
      )}
    />
  );
}
