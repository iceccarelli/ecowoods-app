'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { plateFrames, type ProofPlate } from '@/content/proof-sliders';
import { track } from '@/lib/analytics';

/**
 * ProofSlider — the same room, before and after, on one handle.
 *
 * NOT IllustrationPair. That component cross-fades two diagrams; a cross-fade
 * is the wrong instrument here because it removes the thing that makes a
 * before/after persuasive, which is that the chair and the window DO NOT MOVE
 * while the floor changes. A wipe keeps the geometry and changes the surface.
 *
 * THE CONTROL IS A RANGE INPUT, AND THAT IS THE WHOLE ACCESSIBILITY STORY
 *
 * The obvious build is a div with pointerdown/pointermove handlers. It is also
 * how most comparison sliders end up keyboard-inoperable, invisible to a screen
 * reader, and broken under touch-action. A native <input type="range"> is
 * already draggable with a mouse, already draggable with a thumb, already
 * arrow-key operable with Home/End and PageUp/PageDown for free, already
 * announced with a role, a value and a label, and already respects the
 * platform's own pointer conventions. It is styled to look like the handle
 * rather than replaced by one.
 *
 * BOTH IMAGES STAY IN THE DOM
 *
 * The AFTER frame is clipped, never hidden. A crawler, a reader-mode parser and
 * anything reading this page without running JavaScript receives two <img>
 * elements with two real alt texts, plus the headline and the factline as
 * ordinary prose. Someone who cannot drag still learns what changed.
 *
 * IT SWEEPS ON ITS OWN, AND STOPS THE INSTANT A HAND ARRIVES
 *
 * A before/after that sits still at 50% is read as a photograph. Most visitors
 * never discover there is a second image, and neither does anything sampling
 * the page. So the wipe sweeps continuously between 14% and 86%, easing at each
 * end and dwelling there long enough for the eye to register both floors.
 *
 * The sweep yields immediately and completely to a person: pointer down, key
 * press or focus stops it, and it resumes only after four seconds of the
 * visitor doing nothing. It never fights the hand on the handle, and it never
 * moves under a screen reader that has focus in it — which is why the value the
 * assistive technology reports is always the paused, accurate one.
 *
 * WHY IT IS DRIVEN THROUGH REFS RATHER THAN STATE
 *
 * Sixty animation frames a second through useState re-renders this subtree
 * sixty times a second for one number. The sweep writes the CSS custom property
 * and the input's value directly; React state holds only what a person set. The
 * DOM is the same either way and the frame budget is not.
 *
 * IT DOES NOT RUN OFFSCREEN OR AGAINST A STATED PREFERENCE
 *
 * An IntersectionObserver stops the loop when the figure leaves the viewport —
 * a page with several of these should not be animating the ones nobody can see.
 * `prefers-reduced-motion: reduce` disables the sweep entirely rather than
 * slowing it: the control still works, it simply never moves by itself.
 */

/** Sweep geometry. Kept out of the component so the numbers are reviewable. */
const SWEEP = {
  /** Never reaches an edge: both floors stay visible at every moment. */
  min: 14,
  max: 86,
  /** One end-to-end pass, in milliseconds. Slow enough to read as deliberate. */
  travelMs: 3400,
  /** Held at each end, so the eye lands on a still frame before it reverses. */
  dwellMs: 1100,
  /** Silence after the last human input before the sweep takes over again. */
  resumeMs: 4000,
} as const;

/** Cosine ease-in-out over 0..1. Starts and stops without a visible jolt. */
const ease = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;

/** Position at a given moment of the cycle, in percent. */
function sweepAt(elapsedMs: number): number {
  const leg = SWEEP.travelMs + SWEEP.dwellMs;
  const cycle = elapsedMs % (leg * 2);
  const span = SWEEP.max - SWEEP.min;
  if (cycle < SWEEP.travelMs) return SWEEP.min + span * ease(cycle / SWEEP.travelMs);
  if (cycle < leg) return SWEEP.max;
  const back = cycle - leg;
  if (back < SWEEP.travelMs) return SWEEP.max - span * ease(back / SWEEP.travelMs);
  return SWEEP.min;
}
export function ProofSlider({
  plate,
  priority = false,
  className = '',
}: {
  plate: ProofPlate;
  /** True only for a slider above the fold. verify-preload.mjs counts these. */
  priority?: boolean;
  className?: string;
}) {
  const [pos, setPos] = useState(50);
  const [dragged, setDragged] = useState(false);
  const [auto, setAuto] = useState(false);
  const uid = useId();
  const { before, after } = plateFrames(plate);

  const frameRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAt = useRef(0);
  const heldUntil = useRef(0);
  const visible = useRef(false);

  /** Write a position to the DOM without a render. */
  const paint = useCallback((p: number) => {
    frameRef.current?.style.setProperty('--ps-pos', `${p}%`);
    if (inputRef.current) inputRef.current.value = String(Math.round(p));
  }, []);

  /** A person touched it. Stop, hand over, and come back later. */
  const yieldToHuman = useCallback(() => {
    heldUntil.current = performance.now() + SWEEP.resumeMs;
    setAuto(false);
  }, []);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return undefined;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (reduced?.matches) return undefined;

    const io = new IntersectionObserver(
      ([entry]) => { visible.current = Boolean(entry?.isIntersecting); },
      { threshold: 0.25 },
    );
    io.observe(el);

    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick);
      if (!visible.current || now < heldUntil.current) return;
      if (!startedAt.current) startedAt.current = now;
      setAuto(true);
      paint(sweepAt(now - startedAt.current));
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      io.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [paint]);

  const leftLabel = plate.leftHandle === 'during' ? 'During' : 'Before';
  const rightLabel = 'After';

  return (
    <figure className={`ps ${className}`.trim()} aria-labelledby={`${uid}-h`}>
      <div className="ps-head">
        <p className="ps-kicker">{plate.kicker}</p>
        <h3 className="ps-headline" id={`${uid}-h`}>
          {plate.headline}
        </h3>
        <p className="ps-factline">{plate.factline}</p>
      </div>

      <div
        ref={frameRef}
        className="ps-frame"
        data-auto={auto ? '1' : '0'}
        style={{ ['--ps-pos' as string]: `${pos}%` }}
        onPointerDown={yieldToHuman}
        onTouchStart={yieldToHuman}
      >
        {/* The left frame is the ground. It is never clipped. */}
        <Image
          className="ps-img"
          src={before}
          alt={plate.beforeAlt}
          sizes="(max-width: 900px) 100vw, 1120px"
          priority={priority}
          placeholder="blur"
        />
        {/* The right frame is clipped, NOT hidden — see the note above. */}
        <div className="ps-after" aria-hidden="true">
          <Image
            className="ps-img"
            src={after}
            alt=""
            sizes="(max-width: 900px) 100vw, 1120px"
            priority={priority}
            placeholder="blur"
          />
        </div>
        {/* Kept in the document for anything that cannot run the clip. */}
        <span className="sr-only">{plate.afterAlt}</span>

        <span className="ps-tag ps-tag-left" aria-hidden="true">{leftLabel}</span>
        <span className="ps-tag ps-tag-right" aria-hidden="true">{rightLabel}</span>

        <span className="ps-line" aria-hidden="true">
          <span className="ps-knob">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6 4 12l5 6M15 6l5 6-5 6" />
            </svg>
          </span>
        </span>

        <label className="sr-only" htmlFor={`${uid}-r`}>
          {`Reveal the ${leftLabel.toLowerCase()} or ${rightLabel.toLowerCase()} floor — ${plate.headline}`}
        </label>
        <input
          ref={inputRef}
          id={`${uid}-r`}
          className="ps-range"
          type="range"
          min={0}
          max={100}
          step={1}
          /* defaultValue, not value: the sweep writes this element directly, and
             a controlled input would fight it every frame. React owns the value
             only once a person has set one, which setPos below records. */
          defaultValue={pos}
          aria-valuetext={`${Math.round(pos)}% ${rightLabel.toLowerCase()}`}
          onFocus={yieldToHuman}
          onKeyDown={yieldToHuman}
          onChange={(e) => {
            yieldToHuman();
            const next = Number(e.currentTarget.value);
            setPos(next);
            paint(next);
            if (!dragged) {
              setDragged(true);
              track('jobcard_click', { slug: plate.id, from: 'proof-slider' });
            }
          }}
        />
      </div>

      <figcaption className="ps-caption">
        {/* One line, two truths. The sweep is announced as decorative motion so
            assistive technology does not narrate a moving number, and the
            instruction stays the accessible name of what to do about it. */}
        <span className="ps-hint">
          <span className={`ps-live${auto ? ' is-on' : ''}`} aria-hidden="true" />
          {plate.instruction}
        </span>
        {plate.jobSlug && plate.ctaHref ? (
          <Link className="ps-cta" href={plate.ctaHref}>
            {plate.ctaLabel ?? 'See the work'} <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </figcaption>
    </figure>
  );
}
