'use client';

/**
 * CountUp — a number that rolls to its target when it scrolls into view.
 *
 * F-205 — WHAT WAS WRONG, BECAUSE IT SHIPPED AND STAYED SHIPPED
 *
 * This component used to render its value THREE TIMES in the DOM:
 *
 *     <span class="countup-sizer" aria-hidden>26</span>   width reservation
 *     <span class="countup-live"  aria-hidden>0</span>    the animated value
 *     <span class="sr-only">26</span>                     the accessible copy
 *
 * `visibility: hidden` and `.sr-only` hide text from a person looking at the
 * screen. They do not remove it from the document. Every crawler, every answer
 * engine, every reader-mode extractor and every "read this page" assistant
 * concatenates the text nodes — so the homepage hero's single trust stat was
 * published as:
 *
 *     26026+ Years in Toronto        (server HTML, verified on ecowoods.ca)
 *     262626+ Years in Toronto       (after hydration, once the roll finished)
 *
 * On a site whose entire strategy is being quotable by machines, the one
 * number in the hero was unquotable, and no guard could see it because every
 * guard reads source and every human reads the rendered screen, where it looks
 * perfect. `scripts/verify-ui-contract.mjs` check 5 now fails the build on the
 * pattern that caused it.
 *
 * WHAT IT DOES NOW
 *
 * One text node. Nothing hidden, nothing duplicated, nothing to concatenate.
 *
 *  - WIDTH is reserved with `min-width` in `ch` against the FINAL string plus
 *    `font-variant-numeric: tabular-nums`, so every digit is one `ch` wide and
 *    "0" occupies exactly the cell "26" will. No second copy of the number is
 *    needed to hold the space open.
 *  - THE INITIAL STATE IS THE TARGET, not zero. The server therefore renders
 *    the real figure, a JavaScript-off visitor keeps it, and hydration matches.
 *    The roll starts from zero only inside the IntersectionObserver callback,
 *    which never runs on the server.
 *  - prefers-reduced-motion renders the final value and never animates.
 *  - Assistive technology reads the same node everyone else sees. Because the
 *    element is not a live region, the intermediate ticks are not announced.
 */

import { useEffect, useRef, useState } from 'react';

const DURATION = 1600; // ms — deliberate, not frantic

/** ease-out expo: fast start, soft landing */
const ease = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

export default function CountUp({
  to,
  decimals = 0,
  unit = '',
}: {
  to: number;
  decimals?: number;
  unit?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const raf = useRef<number | null>(null);
  /* Target, not 0 — see the note above. This is the whole SSR fix. */
  const [value, setValue] = useState(to);

  const fmt = (n: number) =>
    n.toLocaleString('en-CA', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

  const finalText = `${fmt(to)}${unit}`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(to);
      return;
    }

    const run = () => {
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min((now - start) / DURATION, 1);
        setValue(to * ease(t));
        if (t < 1) raf.current = requestAnimationFrame(step);
      };
      raf.current = requestAnimationFrame(step);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          run();
        } else {
          if (raf.current) cancelAnimationFrame(raf.current);
          setValue(0);
        }
      },
      { threshold: 0.4 },
    );

    io.observe(el);
    return () => {
      io.disconnect();
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [to]);

  return (
    <span
      ref={ref}
      className="countup"
      /* the cell is born at its finished width — no hidden twin required */
      style={{ minWidth: `${finalText.length}ch` }}
    >
      {/* ONE expression, so React emits ONE text node. Two adjacent
          expressions would be split by a comment marker in the SSR HTML. */}
      {`${fmt(value)}${unit}`}
    </span>
  );
}
