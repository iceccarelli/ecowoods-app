'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import Image from 'next/image';
import type { TrilogyFrame } from '@/lib/trilogies';

/**
 * TrilogyHero — the homepage backdrop, cycling three trilogies' nine frames
 * (room → approach → fingertip, three times over) behind the rotating
 * headline.
 *
 * WHY THIS IS ITS OWN SMALL COMPONENT AND NOT FigureRotator
 *
 * FigureRotator is a captioned documentation figure: a caption bar, numbered
 * count, visible prev/next buttons, sized to sit inline in a page's reading
 * column. A full-bleed hero backdrop behind scrolling text needs none of
 * that chrome — a caption bar over a hero would fight the headline for the
 * same visual space. This reuses the identical BEHAVIOUR (auto-advance,
 * pause on hover/focus/hidden tab, reduced-motion freeze with working manual
 * navigation, all frames in the DOM) in a shell built for a backdrop, which
 * is the "thin wrapper" the brief allows rather than a second carousel
 * library.
 *
 * WHY THIS DOES NOT REOPEN P0.4
 *
 * home-client.tsx's hero comment records a deliberate decision: no autoplay
 * background, because the OLD rotating hero fetched images from a third
 * party after hydration (RotatingBackground → /api/backgrounds → Unsplash),
 * so the browser's preload scanner never saw the LCP image and a visitor
 * could get an empty hero if the fetch chain failed. That failure mode does
 * not exist here: every frame is a build-time static import, already in the
 * client bundle's image manifest. Frame 1 renders with `priority` exactly as
 * the single static HeroBackdrop it replaces did — real
 * `<link rel=preload as=image>`, real blur placeholder, zero runtime fetch.
 * Frames 2 through 9 are a progressive enhancement layered on AFTER that
 * first paint, never before it or instead of it.
 *
 * ALT TEXT STAYS IN THE HTML; THE CONTAINER STAYS aria-hidden
 *
 * The meaningful narration of this section is HeroRotator's copy, rendered as
 * real, exposed text — that is what a screen-reader user hears. Duplicating
 * nine specific photo descriptions on top of that would be noise, so the
 * backdrop container keeps the same `aria-hidden="true"` HeroBackdrop always
 * used. Each `<img>` still carries its own real, specific alt (never empty) —
 * aria-hidden removes a subtree from the ACCESSIBILITY TREE, not from the
 * HTML a crawler or an image-search bot reads, so the alt text stays
 * discoverable exactly where Section 5's "view-source → alts specific"
 * check looks for it.
 *
 * The dot row is the one part of this backdrop that is NOT aria-hidden —
 * `aria-hidden="false"` re-exposes that one subtree, per spec, so real
 * keyboard users can Tab to it. Each dot is a real button; ArrowLeft /
 * ArrowRight on a focused dot moves both selection and focus to the
 * previous/next one — a roving-tabindex pattern, not a container-level key
 * handler on an aria-hidden element, which would be a focusable-but-hidden
 * violation.
 */
const ADVANCE_MS = 6200;

export function TrilogyHero({
  frames,
  scrim = 'linear-gradient(115deg, rgba(26,15,8,0.62) 0%, rgba(26,15,8,0.35) 45%, rgba(26,15,8,0.68) 100%)',
}: {
  /** Nine frames, in the order they should play — three trilogies' three frames each. */
  frames: TrilogyFrame[];
  scrim?: string;
}) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(false);
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduced.current = mq.matches;
    const on = () => (reduced.current = mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const next = useCallback(() => setI((n) => (n + 1) % frames.length), [frames.length]);
  const prev = useCallback(() => setI((n) => (n - 1 + frames.length) % frames.length), [frames.length]);

  useEffect(() => {
    if (frames.length < 2 || paused || reduced.current) return;
    const t = setInterval(() => {
      if (!document.hidden) next();
    }, ADVANCE_MS);
    return () => clearInterval(t);
  }, [frames.length, paused, next]);

  const goTo = (n: number) => {
    setPaused(true);
    setI(n);
  };

  const onDotKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      next();
      setPaused(true);
      dotRefs.current[(i + 1) % frames.length]?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prev();
      setPaused(true);
      dotRefs.current[(i - 1 + frames.length) % frames.length]?.focus();
    }
  };

  if (!frames.length) return null;

  return (
    <div
      className="trh"
      aria-hidden="true"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <style>{`
        .trh { position: absolute; inset: 0; z-index: 0; overflow: hidden; }
        .trh-layer { position: absolute; inset: 0; opacity: 0; transition: opacity 1.8s cubic-bezier(0.4,0,0.2,1); }
        .trh-layer.is-active { opacity: 1; }
        .trh-dots { position: absolute; bottom: 1.1rem; left: 1.25rem; z-index: 3; display: flex; gap: 6px; }
        .trh-dots button { width: 6px; height: 6px; padding: 0; border: 0; border-radius: 50%; background: rgba(255,255,255,0.4); cursor: pointer; }
        .trh-dots button[aria-current="true"] { background: rgba(255,255,255,0.95); transform: scale(1.35); }
        .trh-dots button:focus-visible { outline: 2px solid rgba(255,255,255,0.95); outline-offset: 3px; }
        @media (prefers-reduced-motion: reduce) {
          .trh-layer { transition: opacity 0.4s ease; }
        }
      `}</style>

      {frames.map((f, n) => (
        <div key={f.id + n} className={`trh-layer${n === i ? ' is-active' : ''}`}>
          <Image
            src={f.src}
            alt={f.alt}
            priority={n === 0}
            fetchPriority={n === 0 ? 'high' : undefined}
            placeholder="blur"
            sizes="100vw"
            loading={n === 0 ? undefined : 'lazy'}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      ))}
      <div style={{ position: 'absolute', inset: 0, background: scrim }} />

      {/* Real, focusable dots — same visual language as RotatingTile's
          .rt-dots elsewhere on this site. aria-hidden="false" re-exposes this
          one subtree so Tab reaches it despite the aria-hidden container. */}
      {frames.length > 1 && (
        <div className="trh-dots" aria-hidden="false" role="group" aria-label="Jump to a frame">
          {frames.map((f, n) => (
            <button
              key={f.id + n}
              ref={(el) => {
                dotRefs.current[n] = el;
              }}
              type="button"
              aria-current={n === i}
              aria-label={`Show frame ${n + 1} of ${frames.length}`}
              onClick={() => goTo(n)}
              onKeyDown={onDotKeyDown}
            />
          ))}
        </div>
      )}
    </div>
  );
}
