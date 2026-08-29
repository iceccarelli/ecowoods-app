'use client';

/**
 * HeroRotator — the hero copy resolves itself, one variant at a time.
 *
 * WHAT IT DOES
 *
 * The eyebrow and the headline DECODE: every character starts as a random
 * glyph drawn from the same alphabet as the target character and settles into
 * place left-to-right with a little jitter. The sentence and the fact line
 * cross-fade underneath. The effect reads as type resolving rather than as a
 * slideshow, which is the point — it should feel like the page is addressing
 * the person in front of it, not cycling a banner at them.
 *
 * SIX THINGS THAT ARE DELIBERATE
 *
 * 1. THE FIRST VARIANT IS SERVER-RENDERED, IN FULL, AS REAL TEXT.
 *    `HERO_VARIANTS[0]` is the canonical brand line. It is what lands in the
 *    HTML, so a crawler, an answer engine, or a browser with JavaScript off
 *    reads a complete, correct hero and never a scrambled one. Rotation is a
 *    client-side enhancement layered on a page that is already right.
 *
 * 2. THE DECODE WRITES textContent THROUGH A REF, NOT THROUGH setState.
 *    A scramble is ~45 frames. Re-rendering the hero 45 times per variant,
 *    fifteen variants, forever, is a main-thread bill nobody should pay for a
 *    typographic flourish. React owns the element; the animation owns the
 *    characters inside it. No reconciliation runs during a decode.
 *
 * 3. NOT ONE CHARACTER OF TEXT IS DUPLICATED IN THE DOM.
 *    The h1 names itself for assistive technology with `aria-label`, which
 *    adds no text node. The eyebrow is `aria-hidden` because it is decorative
 *    restatement — everything in it is said again in the lede, the footer and
 *    the schema. A hidden duplicate is still published: that is exactly how
 *    the trust stat came to read `26026+` in the production HTML. See
 *    CountUp.tsx for the post-mortem.
 *
 * 4. THE ENTRY ANIMATION IS CSS, NOT `.reveal`.
 *    `useReveal()` in home-client.tsx observes the `.reveal` nodes that exist
 *    at mount and then disconnects. The two body paragraphs here are keyed by
 *    variant, so React replaces the nodes on every rotation and the observer
 *    would never see them — they would sit at opacity 0 until the 2s
 *    `reveal-fallback` keyframe bailed them out. They use `.hr-body` /
 *    `.hr-support`, which animate themselves on mount.
 *
 * 5. IT CAN BE STOPPED. WCAG 2.2.2 (Pause, Stop, Hide) applies to any
 *    auto-updating content that runs longer than five seconds. There is a real
 *    pause control, hover and keyboard focus pause it, a hidden tab pauses it,
 *    and `prefers-reduced-motion: reduce` disables the rotation and the decode
 *    outright — that visitor gets variant 0, static, forever.
 *
 * 6. THE TRUST STAT IS NOT IN HERE, AND THE CTA DOES NOT ROTATE.
 *    "Get Your Free Written Estimate" is passed in and rendered unchanged for
 *    every variant. The stat is rendered by home-client.tsx, outside this
 *    component, and stays put while the copy changes around it.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { HERO_VARIANTS, headlineText, type HeroVariant } from '../data/hero-variants';

/** How long a variant is held before the next one starts resolving. */
const HOLD_MS = 7600;
/** Frames a character spends scrambling before it settles. */
const CHAR_FRAMES = 9;
/** Frames of stagger per character, so the line resolves left to right. */
const STAGGER = 0.9;

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGIT = '0123456789';

/**
 * A stand-in for one character, drawn from ITS OWN alphabet.
 *
 * The usual Matrix treatment throws katakana and `!<>-_\/[]{}` at everything.
 * On a hardwood flooring site that reads as a screensaver. Substituting like
 * for like — a letter for a letter, a digit for a digit, punctuation and
 * spaces left alone — keeps the line's shape, rhythm and word boundaries
 * intact the whole way through, so it looks like type coming into focus
 * rather than noise being cleared away.
 */
function glyphFor(c: string): string {
  if (UPPER.includes(c)) return UPPER[(Math.random() * UPPER.length) | 0];
  if (LOWER.includes(c)) return LOWER[(Math.random() * LOWER.length) | 0];
  if (DIGIT.includes(c)) return DIGIT[(Math.random() * DIGIT.length) | 0];
  return c;
}

type Slot = { c: string; start: number; end: number };

function plan(text: string): Slot[] {
  return [...text].map((c, i) => {
    const start = i * STAGGER + Math.random() * 6;
    return { c, start, end: start + CHAR_FRAMES + Math.random() * 8 };
  });
}

/**
 * Drives one element's text. The element always ends holding the exact target
 * string: a cancelled run cannot strand a scrambled headline on screen,
 * because every path either settles or is replaced by the next `run`.
 */
function useDecoder<T extends HTMLElement>(ref: { current: T | null }) {
  const raf = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
  }, []);

  const run = useCallback(
    (text: string, animate: boolean) => {
      const node = ref.current;
      if (!node) return;
      stop();
      if (!animate) {
        node.textContent = text;
        return;
      }
      const slots = plan(text);
      let frame = 0;
      const tick = () => {
        let out = '';
        let settled = 0;
        for (const s of slots) {
          if (frame >= s.end) {
            out += s.c;
            settled += 1;
          } else {
            /* Before a slot's start we still emit a character from the
               target's own alphabet rather than a blank. A blank would let
               the line reflow as it fills, and reflowing a display-size
               headline every frame is worse than not animating at all. */
            out += glyphFor(s.c);
          }
        }
        node.textContent = out;
        if (settled === slots.length) {
          raf.current = null;
          return;
        }
        frame += 1;
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    },
    [ref, stop],
  );

  useEffect(() => stop, [stop]);
  return { run, stop };
}

/** Fisher–Yates over indices 1..n-1. Index 0 is the server-rendered variant
 *  and is never shuffled back into the middle of the deck. */
function shuffleTail(n: number): number[] {
  const a = Array.from({ length: n - 1 }, (_, i) => i + 1);
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function HeroRotator({
  variants = HERO_VARIANTS,
  holdMs = HOLD_MS,
  ctaHref,
  ctaLabel,
  ctaArrow,
}: {
  variants?: HeroVariant[];
  holdMs?: number;
  /** The CTA never changes. It is passed in so it sits INSIDE the rotating
   *  block visually while staying outside the rotation logically. */
  ctaHref: string;
  ctaLabel: string;
  ctaArrow?: ReactNode;
}) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [motion, setMotion] = useState(false);

  const eyebrowRef = useRef<HTMLSpanElement | null>(null);
  const leadRef = useRef<HTMLSpanElement | null>(null);
  const emRef = useRef<HTMLElement | null>(null);

  const eyebrow = useDecoder(eyebrowRef);
  const lead = useDecoder(leadRef);
  const em = useDecoder(emRef);

  const v = variants[i] ?? variants[0];
  const n = variants.length;

  /* Motion is opt-OUT, so it starts false and is enabled only after we have
     asked. That ordering also guarantees the first client render matches the
     server render exactly — no hydration warning, no first-paint flicker. */
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setMotion(!mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  /* The order the remaining variants appear in, decided on the client so two
     visitors do not walk the same sequence. */
  const order = useRef<number[]>([]);
  const cursor = useRef(0);

  const advance = useCallback(() => {
    if (n < 2) return;
    if (cursor.current >= order.current.length) {
      order.current = shuffleTail(n);
      cursor.current = 0;
    }
    setI(order.current[cursor.current] ?? 0);
    cursor.current += 1;
  }, [n]);

  /* Rotation. Off without motion; paused on hover, on keyboard focus inside
     the hero, on an explicit pause, and on a hidden tab. */
  useEffect(() => {
    if (!motion || paused || n < 2) return;
    let t = window.setTimeout(advance, holdMs);
    const onVis = () => {
      window.clearTimeout(t);
      if (!document.hidden) t = window.setTimeout(advance, holdMs);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [motion, paused, n, holdMs, advance, i]);

  /* Paint the current variant. `animate` is false on the first client pass, so
     the hydrated DOM is identical to the server's before anything moves. */
  const emText = v.headline.em ?? '';
  useEffect(() => {
    const animate = motion && i !== 0;
    eyebrow.run(v.eyebrow, animate);
    lead.run(v.headline.lead, animate);
    em.run(emText, animate);
  }, [i, motion, v.eyebrow, v.headline.lead, emText, eyebrow, lead, em]);

  const body = v.lede ?? v.support;
  const tail = v.lede ? v.support : null;

  return (
    <div
      className="hr"
      data-variant={v.id}
      data-typing={motion && i !== 0 ? 'true' : 'false'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Decorative restatement: every fact in the eyebrow is published again
          in the lede, the footer and the JSON-LD. Hiding it from AT costs a
          screen-reader user nothing and saves them a scrambling string. */}
      <p className="hr-eyebrow reveal" data-delay="1" aria-hidden="true">
        <span ref={eyebrowRef}>{v.eyebrow}</span>
        <i className="hr-caret" />
      </p>

      <h1 className="hr-h1 reveal" data-delay="1" aria-label={headlineText(v)}>
        <span ref={leadRef} aria-hidden="true">
          {v.headline.lead}
        </span>
        {v.headline.em && (
          <>
            <br />
            <em ref={emRef} aria-hidden="true">
              {v.headline.em}
            </em>
          </>
        )}
      </h1>

      {/* keyed by variant so the node is replaced and .hr-body replays */}
      <p className="hero-lede hr-body" key={`${v.id}-b`}>
        {body}
      </p>
      {tail && (
        <p className="hr-support" key={`${v.id}-s`}>
          {tail}
        </p>
      )}

      <div className="hero-actions reveal" data-delay="3">
        <a className="btn btn-copper btn-lg" href={ctaHref}>
          {ctaLabel}
          {ctaArrow && <span className="btn-arrow">{ctaArrow}</span>}
        </a>

        {/* WCAG 2.2.2 (Pause, Stop, Hide). Rendered only once motion is on,
            because with reduced motion there is nothing running to pause.
            It sits in the CTA row rather than floating absolutely: flexbox
            pushes it to the far right on desktop and wraps it underneath on a
            phone, so it can never land on top of the trust bar. */}
        {motion && n > 1 && (
          <button
            type="button"
            className="hr-pause"
            aria-pressed={paused}
            onClick={() => setPaused((p) => !p)}
          >
            <span className="hr-pause-glyph" aria-hidden="true">
              {paused ? '\u25b6' : '\u275a\u275a'}
            </span>
            {paused ? 'Resume the rotating headline' : 'Pause the rotating headline'}
          </button>
        )}
      </div>
    </div>
  );
}
