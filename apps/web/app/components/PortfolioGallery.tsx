'use client';

/**
 * PortfolioGallery
 * ----------------
 * Desktop / SSR / no-JS: renders the ORIGINAL masonry grid, byte-for-byte, so
 * search engines and non-touch users see exactly what they saw before.
 *
 * Mobile (<=767px, after hydration): swaps the grid for a reversible looping
 * card deck — a physical, draggable stack you browse both directions. Nothing
 * is ever discarded (this is a portfolio, not a dating app): the front card
 * rotates to the back and loops. The front card's project feeds the estimate
 * CTA beneath the deck, so browsing has a conversion path.
 *
 * No external gesture library: pointer events + CSS transforms only. The card
 * uses `touch-action: pan-y`, so vertical page scrolling stays owned by the
 * browser and only horizontal drags are treated as swipes — this is what keeps
 * the deck from hijacking the scroll of the page around it.
 */

import {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

export type PortfolioItem = {
  id: string;
  title: string;
  sub: string;
  image: string;
  span: string;
};

const SWIPE_THRESHOLD = 84; // px of horizontal travel needed to commit
const MAX_VISIBLE = 3; // cards drawn in the stack (front + 2 peeking)

export default function PortfolioGallery({ items }: { items: PortfolioItem[] }) {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Original masonry — the SSR output and the desktop experience, untouched.
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

  // Before hydration and on desktop we return the grid, which matches the
  // server render exactly (no hydration mismatch). Mobile swaps after mount.
  if (!mounted || !isMobile || items.length === 0) return grid;
  return <PortfolioDeck items={items} />;
}

function PortfolioDeck({ items }: { items: PortfolioItem[] }) {
  const n = items.length;
  const [deck, setDeck] = useState<PortfolioItem[]>(items);
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
  const currentIndex = items.findIndex((it) => it.id === front.id);

  const haptic = () => {
    try {
      navigator.vibrate?.(8);
    } catch {
      /* not supported — silent */
    }
  };

  // Both directions resolve to the same fly-out: the front card leaves and the
  // card behind it becomes the new front. For "prev" we first slot the target
  // (the last card) directly behind the front, so the revealed card is the one
  // we want — no flicker — and the commit is identical to "next".
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
        // Move the last card to just behind the front before it flies away.
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

  // ---- pointer drag on the front card -----------------------------------
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
    if (g.axis === null) {
      if (Math.abs(mx) > 8 || Math.abs(my) > 8) {
        g.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
      }
    }
    if (g.axis === 'y') return; // vertical → let the page scroll (touch-action: pan-y)
    if (g.axis === 'x') setDx(mx);
  };

  const endGesture = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    if (g.axis === 'x' && dx <= -SWIPE_THRESHOLD) {
      go('next');
    } else if (g.axis === 'x' && dx >= SWIPE_THRESHOLD) {
      go('prev');
    } else {
      setDx(0);
      setDragging(false);
    }
  };

  // ---- per-card transform ------------------------------------------------
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
    // Cards behind: stepped down and scaled to read as a real stack + peek.
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

  const dragHint =
    dragging && dx <= -24 ? 'next' : dragging && dx >= 24 ? 'prev' : null;

  return (
    <div className="pfd" aria-roledescription="carousel" aria-label="Project portfolio">
      <div className="pfd-stack">
        {deck.slice(0, MAX_VISIBLE).map((item, pos) => (
          <div
            key={item.id}
            className="pfd-card"
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
            <img className="pfd-img" src={item.image} alt={item.title} draggable={false} decoding="async" />
            <div className="pfd-scrim" />
            {pos === 0 && dragHint && (
              <span className={`pfd-flag pfd-flag--${dragHint}`}>
                {dragHint === 'prev' ? '‹ Previous' : 'Next ›'}
              </span>
            )}
            <div className="pfd-caption">
              <div className="pfd-title">{item.title}</div>
              <div className="pfd-sub">{item.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Controls: prev / counter+dots / next */}
      <div className="pfd-controls">
        <button type="button" className="pfd-nav" onClick={() => go('prev')} disabled={busy} aria-label="Previous project">
          ‹
        </button>
        <div className="pfd-progress" aria-hidden="true">
          <span className="pfd-count">
            {currentIndex + 1} / {n}
          </span>
          <span className="pfd-dots">
            {items.map((it, i) => (
              <span key={it.id} className={`pfd-dot ${i === currentIndex ? 'is-active' : ''}`} />
            ))}
          </span>
        </div>
        <button type="button" className="pfd-nav" onClick={() => go('next')} disabled={busy} aria-label="Next project">
          ›
        </button>
      </div>

      <a className="pfd-cta" href="#quote">
        <span>Get an estimate for a floor like this</span>
        <span className="pfd-cta-arrow" aria-hidden="true">→</span>
      </a>

      <p className="pfd-hint" aria-hidden="true">
        Swipe to browse · {n} recent Toronto projects
      </p>

      {/* Screen-reader announcement + keyboard control */}
      <div
        className="pfd-sr"
        tabIndex={0}
        role="group"
        aria-label={`Project ${currentIndex + 1} of ${n}: ${front.title}. Use left and right arrow keys to browse.`}
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
        <span aria-live="polite">
          {front.title} — {front.sub}
        </span>
      </div>
    </div>
  );
}
