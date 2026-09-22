'use client';

/**
 * DeluxeStage — the peeking-carousel physics borrowed from AWS's own
 * customer-story rail: neighbours rest squashed to scaleY(0.9), the active
 * card is scaleY(1), and advancing settles in 800ms ease-out with a small
 * overshoot around 70% of the move. Only the physics are borrowed — radius,
 * type, and colour stay whatever the call site already uses; this primitive
 * never restyles a card, it only moves it.
 *
 * The track moves in pixels (`itemWidth + gap`), never `translateX(-100%)`
 * — a percentage move on a track that has a gap between items lands short
 * or long and hitches at the end of the animation. `itemWidth` is measured
 * off the mounted DOM, not assumed from a token.
 *
 * `prefers-reduced-motion: reduce` collapses the settle to an instant swap
 * (duration 1ms) and drops the scaleY squash entirely — the deck still
 * changes cards, it just never animates doing it.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { DELUXE } from './tokens';

export type DeluxeStagePeek = 'prev' | 'next' | null;

export type DeluxeStageProps<T> = {
  items: T[];
  index: number;
  onIndex: (next: number) => void;
  renderItem: (item: T, state: { active: boolean; peek: DeluxeStagePeek }) => React.ReactNode;
  getKey: (item: T) => string;
  ariaLabel: string;
  loop?: boolean;
};

export function DeluxeStage<T>({ items, index, onIndex, renderItem, getKey, ariaLabel, loop = true }: DeluxeStageProps<T>) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [itemWidth, setItemWidth] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setReduced(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setItemWidth(width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const N = items.length;
  const step = itemWidth + DELUXE.gapPx;
  const trackPx = -index * step;

  const goTo = (next: number) => {
    if (N === 0) return;
    const wrapped = loop ? ((next % N) + N) % N : Math.min(N - 1, Math.max(0, next));
    onIndex(wrapped);
  };

  const canPrev = loop || index > 0;
  const canNext = loop || index < N - 1;

  const duration = reduced ? 1 : DELUXE.durationMs;

  return (
    <div
      className="deluxe-stage"
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      style={{ overflow: 'hidden', position: 'relative' }}
    >
      <div ref={viewportRef} className="deluxe-viewport" style={{ width: `calc(100% - ${DELUXE.peekPx * 2}px - ${DELUXE.gapPx * 2}px)`, margin: '0 auto' }}>
        <div
          className="deluxe-track"
          style={{
            display: 'flex',
            gap: `${DELUXE.gapPx}px`,
            transform: `translateX(${itemWidth ? trackPx : 0}px)`,
            transition: itemWidth ? `transform ${duration}ms ${DELUXE.ease}` : 'none',
          }}
        >
          {items.map((item, n) => {
            const active = n === index;
            const peek: DeluxeStagePeek = n === index - 1 ? 'prev' : n === index + 1 ? 'next' : null;
            const scaleY = reduced ? 1 : active ? 1 : DELUXE.inactiveScaleY;
            return (
              <div
                key={getKey(item)}
                className={`deluxe-item${active ? ' is-active' : ''}`}
                style={{
                  flex: `0 0 ${itemWidth || 100}px`,
                  transform: `scaleY(${scaleY})`,
                  transformOrigin: 'center',
                  transition: itemWidth ? `transform ${duration}ms ${DELUXE.ease}` : 'none',
                }}
                aria-hidden={active ? undefined : true}
              >
                {renderItem(item, { active, peek })}
              </div>
            );
          })}
        </div>
      </div>
      <button type="button" className="deluxe-nav deluxe-nav-prev" aria-label="Previous" onClick={() => goTo(index - 1)} disabled={!canPrev}>
        ‹
      </button>
      <button type="button" className="deluxe-nav deluxe-nav-next" aria-label="Next" onClick={() => goTo(index + 1)} disabled={!canNext}>
        ›
      </button>
    </div>
  );
}

export function useDeluxeReducedMotion(): boolean {
  const reduced = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }, []);
  return reduced;
}
