'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { ProjectStill } from '@/lib/projects';

/**
 * A still that drifts, and stops drifting when nobody is looking at it.
 *
 * THREE THINGS THAT MAKE THIS DIFFERENT FROM A CSS ANIMATION ON A DIV
 *
 * 1. IT PAUSES OFFSCREEN. An IntersectionObserver adds the class that runs the
 *    transform, and removes it on the way out. A page with twenty animated
 *    plates all running at once is a page that drains a phone battery to show
 *    motion nobody can see.
 *
 * 2. THE ORIGIN IS PER PLATE. An overhead of a stair well wants to pull from
 *    the centre; a landing wants the rail line; a foyer wants the lower third
 *    where the floor is. One shared transform-origin makes half the frames
 *    drift away from their own subject.
 *
 * 3. prefers-reduced-motion IS HONOURED BY NOT STARTING. globals.css already
 *    zeroes every animation and transition duration under that query, so the
 *    correct behaviour arrives for free — but the observer is skipped too, so
 *    the component does no work at all rather than running a zero-duration
 *    animation on every scroll.
 *
 * The scrim over the image is deliberately light. This is a company that sells
 * the appearance of wood; a gradient heavy enough to guarantee text contrast is
 * a gradient heavy enough to kill the grain, which is the one thing the
 * photograph is for.
 */
export default function KenBurnsStill({
  still,
  priority = false,
  sizes = '(max-width: 767px) 100vw, (max-width: 1279px) 90vw, 1100px',
  className,
}: {
  still: ProjectStill;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setLive(e.isIntersecting);
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`pj-plate${className ? ` ${className}` : ''}`}>
      <Image
        src={still.src}
        alt={still.alt}
        width={still.width}
        height={still.height}
        sizes={sizes}
        priority={priority}
        className={`pj-plate-img${live ? ' is-live' : ''}`}
        style={{ transformOrigin: still.origin }}
      />
    </div>
  );
}
