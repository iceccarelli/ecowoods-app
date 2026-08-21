'use client';

import { useEffect, useRef, useState } from 'react';
import Image, { type StaticImageData } from 'next/image';
import { BLUR_WARM } from '@/lib/image';

/**
 * RotatingTile — one photograph slot that cycles its shots with a Ken Burns push.
 *
 * THREE THINGS THAT SEPARATE THIS FROM A SLIDESHOW
 *
 * 1. STAGGERED STARTS. Twelve tiles all flipping on the same beat reads as a
 *    glitch; the eye catches the synchrony and the whole grid looks mechanical.
 *    Each tile offsets its first advance by `index * 900ms`, so the grid
 *    breathes instead of blinking.
 *
 * 2. FOUR KEN BURNS VARIANTS, not one. `kb0`–`kb3` already exist in globals.css
 *    for FloorCatalog and MachineCatalog and alternate direction, so two
 *    adjacent tiles never drift the same way. A single curve across a grid is
 *    what makes a wall of photos look like a screensaver. The variant is picked
 *    from the tile index, so it is stable per position rather than random per
 *    render — which also keeps it identical between server and client.
 *
 * 3. IT STOPS WHEN NOBODY IS LOOKING. An IntersectionObserver pauses the timer
 *    while the tile is off-screen. Twelve tiles each holding an interval and
 *    running a 9s transform is real battery and CPU on a phone, spent animating
 *    pixels nobody can see.
 *
 * Reduced motion is handled globally (globals.css:1833 zeroes every animation
 * and transition), and the rotation itself also stops: a viewer who asked for
 * less motion should not get content swapping under them either.
 */

export function RotatingTile({
  shots,
  alt,
  index = 0,
  interval = 6000,
  sizes = '(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw',
}: {
  shots: StaticImageData[];
  alt: string;
  index?: number;
  interval?: number;
  sizes?: string;
}) {
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

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
    if (!visible || shots.length < 2) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    // The stagger lives in the first tick, not in a CSS delay, so the offset
    // survives the tile being scrolled away and back.
    const start = window.setTimeout(
      () => {
        setI((n) => (n + 1) % shots.length);
      },
      (index % 6) * 900 + interval,
    );
    const t = window.setInterval(() => setI((n) => (n + 1) % shots.length), interval);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(t);
    };
  }, [visible, shots.length, interval, index]);

  if (!shots.length) return null;
  const kb = index % 4;

  return (
    <div className="rt" ref={ref}>
      {shots.map((s, n) => (
        <div
          key={n}
          className={`rt-layer${n === i ? ' is-on' : ''} gc-kb gc-kb-${kb}`}
          aria-hidden={n === i ? undefined : true}
        >
          <Image
            src={s}
            alt={n === 0 ? alt : ''}
            fill
            sizes={sizes}
            placeholder="blur"
            blurDataURL={BLUR_WARM}
            style={{ objectFit: 'cover' }}
          />
        </div>
      ))}
      {shots.length > 1 && (
        <div className="rt-dots" aria-hidden="true">
          {shots.map((_, n) => (
            <span key={n} className={n === i ? 'is-on' : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
