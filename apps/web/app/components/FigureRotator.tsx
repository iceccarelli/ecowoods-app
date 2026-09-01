'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { StaticImageData } from 'next/image';

export type RotatorSlide = {
  id: string;
  src: StaticImageData;
  alt: string;
  caption: string;
  href?: string;
  width: number;
  height: number;
};

/**
 * A rotating spotlight over the site's own figures.
 *
 * WHY IT IS NOT A BACKGROUND ROTATOR
 *
 * The obvious move was to rotate these behind the hero. It is the wrong one.
 * Most of the 74 images are explanatory and carry callout labels — meter
 * readings, machine names, Janka values — and a labelled figure under a 0.55
 * scrim with a headline on top is noise. It would make the hero worse and the
 * figures useless simultaneously.
 *
 * So they rotate at readable size, each with its own caption and a link to the
 * page that explains it. The rotation is the point: a visitor who came for a
 * price sees, in twenty seconds, that this company can explain moisture
 * differential, the four-machine sequence and what cupping actually is. That is
 * the argument the whole corpus makes, made visually, without asking anyone to
 * click first.
 *
 * WHAT IT DOES NOT COST
 *
 * The first slide is rendered server-side, so a crawler and a cold visitor both
 * get a real figure immediately and the layout is reserved from the manifest's
 * own dimensions. The rest lazy-load.
 *
 * `priority` IS OPT-IN, AND DEFAULTS OFF. It used to be hard-coded true on the
 * first slide, which emitted a <link rel=preload as=image> for a 1600px figure
 * in the document head. That was defensible when this was the most important
 * image on the page. It stopped being defensible the moment the homepage hero
 * got a real preload of its own (P2.5): the browser then had two large images
 * competing for the same first-round bandwidth, and the one that lost was the
 * LCP element. Measured on the live site — three `as="image"` preloads in the
 * head, only one of them the hero.
 *
 * Both current call sites render this rotator well below the fold — on the
 * homepage it sits after the quote form, seven sections down — so neither
 * passes it. Pass `priority` only where this component IS the largest element
 * in the viewport on load, and never on a page that already preloads a hero.
 * Auto-advance stops on hover, on keyboard focus, when the tab is hidden, and
 * entirely under prefers-reduced-motion — where it becomes a plain manual
 * control, which is also what it is for anyone using a keyboard.
 *
 * Every slide is in the DOM at all times, so all of it is in the HTML a crawler
 * reads. Only the opacity changes.
 */
export function FigureRotator({
  slides,
  interval = 6500,
  priority = false,
  label = 'What we can explain',
}: {
  slides: RotatorSlide[];
  interval?: number;
  /** Preload the first slide. Only when this rotator is the LCP element. */
  priority?: boolean;
  label?: string;
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

  const next = useCallback(() => setI((n) => (n + 1) % slides.length), [slides.length]);
  const prev = useCallback(() => setI((n) => (n - 1 + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    if (slides.length < 2 || paused || reduced.current) return;
    const t = setInterval(() => {
      if (!document.hidden) next();
    }, interval);
    return () => clearInterval(t);
  }, [slides.length, paused, interval, next]);

  if (!slides.length) return null;
  const active = slides[i];

  return (
    <section
      className="figrot"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="figrot-stage" style={{ aspectRatio: `${active.width} / ${active.height}` }}>
        {slides.map((s, n) => (
          <figure
            key={s.id}
            className={`figrot-slide ${n === i ? 'is-active' : ''}`}
            aria-hidden={n === i ? undefined : true}
            {...(n === i ? {} : { inert: '' as unknown as boolean })}
          >
            <Image
              src={s.src}
              alt={s.alt}
              sizes="(max-width: 767px) 100vw, (max-width: 1200px) 90vw, 1000px"
              className="figrot-img"
              priority={priority && n === 0}
              loading={n === 0 ? undefined : 'lazy'}
            />
          </figure>
        ))}
      </div>

      <div className="figrot-bar">
        <p className="figrot-caption" aria-live="polite">
          {active.href ? <a href={active.href}>{active.caption}</a> : active.caption}
        </p>
        <div className="figrot-controls">
          <button type="button" className="figrot-btn" onClick={prev} aria-label="Previous figure">
            <span aria-hidden="true">←</span>
          </button>
          <span className="figrot-count">
            {i + 1} / {slides.length}
          </span>
          <button type="button" className="figrot-btn" onClick={next} aria-label="Next figure">
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}
