'use client';

/**
 * StoryboardHover — YouTube desktop-thumbnail hover, not a crossfade slider.
 *
 * Two modes on one component: scrubbing (mouse X maps straight to a frame,
 * a hard cut, no transition) and an idle cycle (pointer inside but still —
 * after a short delay, advance one frame at a time). Leaving restores the
 * poster. Every frame is mounted up front and shown/hidden with `display`,
 * never `opacity` — a crossfade would read as a template; a cut reads as
 * looking at the actual job.
 *
 * Off-screen work stops (IntersectionObserver, same threshold/shape as
 * KenBurnsStill) and `prefers-reduced-motion: reduce` disables everything
 * in JS, not just CSS — the poster is the only frame that ever renders.
 * Touch never hovers: only `pointerType === 'mouse' | 'pen'` drives scrub
 * or idle-cycle, matching MegaMenu's own convention, so a tap keeps
 * whatever tap/click behaviour the parent already gives it.
 */

import Image, { type StaticImageData } from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { BLUR_WARM } from '@/lib/image';
import { STORYBOARD } from './tokens';
import { isHoverPointer, frameIndexFromMouseX, tickLeftPercent } from './scrub';

export type StoryboardFrame = { src: StaticImageData | string; alt: string };

export type StoryboardHoverProps = {
  frames: StoryboardFrame[];
  posterIndex?: number;
  sizes: string;
  priority?: boolean;
  className?: string;
  paused?: boolean;
};

const resolveSrc = (src: StaticImageData | string): string => (typeof src === 'string' ? src : src.src);

export function StoryboardHover({
  frames,
  posterIndex = 0,
  sizes,
  priority = false,
  className = '',
  paused = false,
}: StoryboardHoverProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [index, setIndex] = useState(posterIndex);
  const idleTimeout = useRef<number | null>(null);
  const idleInterval = useRef<number | null>(null);
  const prefetched = useRef(false);

  const shown = frames.slice(0, STORYBOARD.maxFrames);
  const interactive = shown.length >= 2 && visible && !reduced && !paused;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setReduced(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver((entries) => setVisible(entries[0]?.isIntersecting ?? false), {
      rootMargin: '120px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!interactive) setIndex(posterIndex);
  }, [interactive, posterIndex]);

  const clearIdle = () => {
    if (idleTimeout.current !== null) {
      window.clearTimeout(idleTimeout.current);
      idleTimeout.current = null;
    }
    if (idleInterval.current !== null) {
      window.clearInterval(idleInterval.current);
      idleInterval.current = null;
    }
  };

  const armIdle = () => {
    clearIdle();
    idleTimeout.current = window.setTimeout(() => {
      idleInterval.current = window.setInterval(() => {
        setIndex((n) => (n + 1) % shown.length);
      }, STORYBOARD.cycleMs);
    }, STORYBOARD.enterDelayMs);
  };

  useEffect(() => clearIdle, []);

  if (!interactive) {
    return (
      <div className={`sb-frame-stack ${className}`.trim()} ref={ref}>
        <div className="sb-frame" style={{ display: 'block' }}>
          <Image
            src={shown[posterIndex]?.src ?? frames[0]!.src}
            alt={shown[posterIndex]?.alt ?? frames[0]!.alt}
            sizes={sizes}
            fill
            priority={priority}
            loading={priority ? undefined : 'lazy'}
            placeholder="blur"
            blurDataURL={BLUR_WARM}
            style={{ objectFit: 'cover' }}
          />
        </div>
      </div>
    );
  }

  const onPointerEnter = (e: React.PointerEvent) => {
    if (!isHoverPointer(e.pointerType)) return;
    if (!prefetched.current) {
      prefetched.current = true;
      for (const frame of shown) {
        const img = new window.Image();
        img.src = resolveSrc(frame.src);
      }
    }
    armIdle();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isHoverPointer(e.pointerType)) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setIndex(frameIndexFromMouseX(e.clientX, rect.left, rect.width, shown.length));
    armIdle();
  };

  const onPointerLeave = (e: React.PointerEvent) => {
    if (!isHoverPointer(e.pointerType)) return;
    clearIdle();
    setIndex(posterIndex);
  };

  return (
    <div
      className={`sb-frame-stack ${className}`.trim()}
      ref={ref}
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      {shown.map((frame, n) => (
        <div key={n} className="sb-frame" style={{ display: n === index ? 'block' : 'none' }} aria-hidden={n === index ? undefined : true}>
          <Image
            src={frame.src}
            alt={n === posterIndex ? frame.alt : ''}
            sizes={sizes}
            fill
            priority={priority && n === posterIndex}
            loading={priority && n === posterIndex ? undefined : 'lazy'}
            placeholder="blur"
            blurDataURL={BLUR_WARM}
            style={{ objectFit: 'cover' }}
          />
        </div>
      ))}
      <span className="sb-tick" style={{ left: `${tickLeftPercent(index, shown.length)}%` }} aria-hidden="true" />
    </div>
  );
}
