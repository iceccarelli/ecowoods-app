'use client';

/**
 * SwipeDeck — the one deck engine every mobile card section uses.
 *
 * Extracted so the portfolio, the Ecowoods Standard pillars, and the
 * testimonials all share identical physics, controls, haptics, a11y and
 * reduced-motion behaviour. Sections differ only in what a card *contains*
 * (via renderCard) and its chrome (via cardClassName) — never in how it feels.
 *
 * Reversible + non-destructive: the front card flies off, the next rises, and
 * the stack loops both directions. No external gesture library — pointer events
 * + CSS transforms. `touch-action: pan-y` keeps vertical page scroll owned by
 * the browser so the deck never hijacks the scroll of the page around it.
 */

import {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

const SWIPE_THRESHOLD = 84;
const MAX_VISIBLE = 3;

/** SSR-safe mobile check. `mounted` guards against hydration mismatch: render
 *  the server/desktop markup until we know we're on a touch-width viewport. */
export function useIsMobile(query = '(max-width: 767px)') {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia(query);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);
  return { mounted, isMobile };
}

export type SwipeDeckProps<T> = {
  items: T[];
  getKey: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  /** accessible label read for the current front card */
  srLabel: (item: T) => string;
  ariaLabel: string;
  /** extra class on each card, e.g. 'pfd-card--panel' */
  cardClassName?: string;
  /** stack height as a CSS aspect-ratio string, default '3 / 4' */
  aspectRatio?: string;
  /** optional conversion CTA beneath the deck */
  cta?: { href: string; label: string } | null;
  hint?: string;
};

export default function SwipeDeck<T>({
  items,
  getKey,
  renderCard,
  srLabel,
  ariaLabel,
  cardClassName = '',
  aspectRatio = '3 / 4',
  cta = null,
  hint,
}: SwipeDeckProps<T>) {
  const n = items.length;
  const [deck, setDeck] = useState<T[]>(items);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [anim, setAnim] = useState<null | 'next' | 'prev'>(null);

  const gesture = useRef<{ x: number; y: number; axis: null | 'x' | 'y'; id: number } | null>(null);
  const reduce = useRef(false);
  useEffect(() => {
    reduce.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const front = deck[0];
  const busy = anim !== null;
  const currentIndex = items.findIndex((it) => getKey(it) === getKey(front));

  const haptic = () => {
    try {
      navigator.vibrate?.(8);
    } catch {
      /* unsupported — silent */
    }
  };

  const commit = useCallback((dir: 'next' | 'prev') => {
    setDeck((d) => [...d.slice(1), d[0]]);
    setAnim(null);
    setDx(0);
    setDragging(false);
    void dir;
  }, []);

  const go = useCallback(
    (dir: 'next' | 'prev') => {
      if (busy || n < 2) return;
      haptic();
      if (dir === 'prev') {
        // slot the target directly behind the front so it's the revealed card
        setDeck((d) => [d[0], d[d.length - 1], ...d.slice(1, d.length - 1)]);
      }
      if (reduce.current) {
        commit(dir);
        return;
      }
      setAnim(dir);
    },
    [busy, n, commit],
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (busy || n < 2) return;
    gesture.current = { x: e.clientX, y: e.clientY, axis: null, id: e.pointerId };
    setDragging(true);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const mx = e.clientX - g.x;
    const my = e.clientY - g.y;
    if (g.axis === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
      g.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
    }
    if (g.axis === 'y') return; // vertical → let the page scroll
    if (g.axis === 'x') setDx(mx);
  };

  const endGesture = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    if (g.axis === 'x' && dx <= -SWIPE_THRESHOLD) go('next');
    else if (g.axis === 'x' && dx >= SWIPE_THRESHOLD) go('prev');
    else {
      setDx(0);
      setDragging(false);
    }
  };

  const cardStyle = (pos: number): CSSProperties => {
    if (pos === 0) {
      let transform = 'translate3d(0,0,0) rotate(0deg)';
      let transition = dragging ? 'none' : 'transform .34s cubic-bezier(.22,.61,.36,1)';
      let opacity = 1;
      if (anim === 'next') {
        transform = 'translate3d(-135%,0,0) rotate(-16deg)';
        transition = 'transform .34s cubic-bezier(.4,0,.6,1), opacity .34s';
        opacity = 0;
      } else if (anim === 'prev') {
        transform = 'translate3d(135%,0,0) rotate(16deg)';
        transition = 'transform .34s cubic-bezier(.4,0,.6,1), opacity .34s';
        opacity = 0;
      } else if (dragging) {
        transform = `translate3d(${dx}px,0,0) rotate(${dx * 0.04}deg)`;
      }
      return { transform, transition, opacity, zIndex: 40, touchAction: 'pan-y' };
    }
    const y = pos * 15;
    const scale = 1 - pos * 0.05;
    return {
      transform: `translate3d(0,${y}px,0) scale(${scale})`,
      transition: 'transform .34s cubic-bezier(.22,.61,.36,1)',
      opacity: pos >= MAX_VISIBLE ? 0 : 1,
      zIndex: 40 - pos,
      touchAction: 'pan-y',
    };
  };

  const dragHint = dragging && dx <= -24 ? 'next' : dragging && dx >= 24 ? 'prev' : null;

  return (
    <div className="pfd" aria-roledescription="carousel" aria-label={ariaLabel}>
      <div className="pfd-stack" style={{ aspectRatio }}>
        {deck.slice(0, MAX_VISIBLE).map((item, pos) => (
          <div
            key={getKey(item)}
            className={`pfd-card ${cardClassName}`}
            style={cardStyle(pos)}
            onPointerDown={pos === 0 ? onPointerDown : undefined}
            onPointerMove={pos === 0 ? onPointerMove : undefined}
            onPointerUp={pos === 0 ? endGesture : undefined}
            onPointerCancel={pos === 0 ? endGesture : undefined}
            onTransitionEnd={
              pos === 0
                ? (e) => {
                    if (e.propertyName === 'transform' && anim) commit(anim);
                  }
                : undefined
            }
            aria-hidden={pos !== 0}
          >
            {pos === 0 && dragHint && (
              <span className={`pfd-flag pfd-flag--${dragHint}`}>
                {dragHint === 'prev' ? '‹ Previous' : 'Next ›'}
              </span>
            )}
            {renderCard(item)}
          </div>
        ))}
      </div>

      <div className="pfd-controls">
        <button type="button" className="pfd-nav" onClick={() => go('prev')} disabled={busy} aria-label="Previous">
          ‹
        </button>
        <div className="pfd-progress" aria-hidden="true">
          <span className="pfd-count">
            {currentIndex + 1} / {n}
          </span>
          <span className="pfd-dots">
            {items.map((it, i) => (
              <span key={getKey(it)} className={`pfd-dot ${i === currentIndex ? 'is-active' : ''}`} />
            ))}
          </span>
        </div>
        <button type="button" className="pfd-nav" onClick={() => go('next')} disabled={busy} aria-label="Next">
          ›
        </button>
      </div>

      {cta && (
        <a className="pfd-cta" href={cta.href}>
          <span>{cta.label}</span>
          <span className="pfd-cta-arrow" aria-hidden="true">
            →
          </span>
        </a>
      )}

      {hint && (
        <p className="pfd-hint" aria-hidden="true">
          {hint}
        </p>
      )}

      <div
        className="pfd-sr"
        tabIndex={0}
        role="group"
        aria-label={`${ariaLabel}. Item ${currentIndex + 1} of ${n}. Use left and right arrow keys to browse.`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            go('next');
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            go('prev');
          }
        }}
      >
        <span aria-live="polite">{srLabel(front)}</span>
      </div>
    </div>
  );
}
