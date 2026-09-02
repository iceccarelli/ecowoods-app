'use client';

import { useId, useState } from 'react';
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
 * REDUCED MOTION
 *
 * There is no autoplay to disable. The only motion is the one the visitor
 * causes, so `prefers-reduced-motion` removes the transition on the wipe and
 * nothing else: the control still works, it just stops easing.
 */
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
  const uid = useId();
  const { before, after } = plateFrames(plate);

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

      <div className="ps-frame" style={{ ['--ps-pos' as string]: `${pos}%` }}>
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
          id={`${uid}-r`}
          className="ps-range"
          type="range"
          min={0}
          max={100}
          step={1}
          value={pos}
          aria-valuetext={`${Math.round(pos)}% ${rightLabel.toLowerCase()}`}
          onChange={(e) => {
            setPos(Number(e.currentTarget.value));
            if (!dragged) {
              setDragged(true);
              track('jobcard_click', { slug: plate.id, from: 'proof-slider' });
            }
          }}
        />
      </div>

      <figcaption className="ps-caption">
        <span className="ps-hint">{plate.instruction}</span>
        {plate.jobSlug && plate.ctaHref ? (
          <Link className="ps-cta" href={plate.ctaHref}>
            {plate.ctaLabel ?? 'See the work'} <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </figcaption>
    </figure>
  );
}
