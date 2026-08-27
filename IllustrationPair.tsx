'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Illustration } from './Illustration';
import { getImage } from '@/lib/images';

/**
 * IllustrationPair — one fact, two drawings of it, alternating.
 *
 * WHY THIS EXISTS RATHER THAN A SECOND FIGURE UNDERNEATH
 *
 * Batch 2 was briefed once and drawn twice: `<id>` and `<id>-b` assert the same
 * thing in two different visual languages — one warmer and more literal, one
 * flatter and more diagrammatic. Stacking both on the page would say they are
 * two facts. They are one, seen twice, so they occupy one slot and take turns.
 *
 * WHY IT CROSS-FADES AND DOES NOT PAN
 *
 * Illustration already offers `kenburns`, and the note above its definition is
 * the reason this component does not use it: a scale inside a fixed frame
 * crops, and on an explanatory figure the crop eats the thing the figure exists
 * to show — the end of a price bar, the copper nosing at the frame edge, the
 * outermost dot on the map. Scene photography can be panned because its subject
 * is the whole scene. A diagram cannot. So the only motion here is opacity, and
 * the second frame earns its keep by being a genuinely different picture rather
 * than a different crop of the same one.
 *
 * WHY THE BOX IS LOCKED TO THE TALLER RATIO
 *
 * prepare-illustrations.sh trims each file to its own content, so a pair can
 * differ sharply in shape — symptom-cause-tree is 1401x916 and its sibling is
 * 918x917. Sizing the stage from the active slide would resize the page every
 * few seconds, which is cumulative layout shift generated on a timer. The stage
 * is therefore fixed to the TALLER of the two ratios and both images are
 * contained inside it: one of them sits in a little empty space, nothing is
 * cropped, and the page never moves.
 */
export function IllustrationPair({
  a,
  b,
  interval = 7000,
  priority = false,
  className = '',
}: {
  a: string;
  b: string;
  interval?: number;
  priority?: boolean;
  className?: string;
}) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduced.current = mq.matches;
    const on = () => (reduced.current = mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const toggle = useCallback(() => setI((n) => (n + 1) % 2), []);

  useEffect(() => {
    if (paused || reduced.current) return;
    const t = setInterval(() => {
      if (!document.hidden) toggle();
    }, interval);
    return () => clearInterval(t);
  }, [paused, interval, toggle]);

  const ia = getImage(a);
  const ib = getImage(b);
  /* A missing sibling degrades to the single figure rather than breaking the
     page. verify-images.mjs fails the build on the missing slot long before
     anyone sees this branch. */
  if (!ia) return null;
  if (!ib) return <Illustration id={a} priority={priority} className={className} />;

  const ratio = Math.max(ia.height / ia.width, ib.height / ib.width);

  return (
    <div
      className={`ilpair ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="ilpair-stage" style={{ aspectRatio: `1 / ${ratio}` }}>
        <div className={`ilpair-layer ${i === 0 ? 'is-on' : ''}`} aria-hidden={i === 0 ? undefined : true}>
          <Illustration id={a} motion="none" priority={priority} />
        </div>
        <div className={`ilpair-layer ${i === 1 ? 'is-on' : ''}`} aria-hidden={i === 1 ? undefined : true}>
          <Illustration id={b} motion="none" />
        </div>
      </div>
      <button
        type="button"
        className="ilpair-toggle"
        onClick={toggle}
        aria-label={i === 0 ? 'Show the second drawing of this figure' : 'Show the first drawing of this figure'}
      >
        <span aria-hidden="true">{i === 0 ? '○ ●' : '● ○'}</span>
      </button>
    </div>
  );
}
