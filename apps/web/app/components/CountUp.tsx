'use client';

/**
 * CountUp — a number that rolls from 0 to its target when it scrolls into view.
 *
 * Re-arms on exit, so it replays every time the stat re-enters the viewport
 * (and on every page load) rather than firing once and going inert.
 *
 * Details that matter:
 *  - IntersectionObserver, not a scroll listener: no main-thread work while the
 *    bar is off-screen.
 *  - requestAnimationFrame with an ease-out curve, so it decelerates into the
 *    final value. Linear counters read as slot machines.
 *  - The element reserves its FINAL width up front (a hidden sizer holding the
 *    finished string). Without it, "0" -> "5,200" widens mid-flight and shoves
 *    the row around — undoing the subgrid alignment.
 *  - prefers-reduced-motion: renders the final value immediately. Numbers
 *    ticking in peripheral vision is a real vestibular trigger.
 *  - Assistive tech gets the FINAL number once, never the intermediate ticks.
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
  const [value, setValue] = useState(0);
  const [reduced, setReduced] = useState(false);

  const fmt = (n: number) =>
    n.toLocaleString('en-CA', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      setReduced(true);
      setValue(to);
      return;
    }

    const el = ref.current;
    if (!el) return;

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
    <span ref={ref} className="countup">
      <span className="countup-sizer" aria-hidden="true">
        {fmt(to)}
        {unit}
      </span>
      <span className="countup-live" aria-hidden="true">
        {fmt(reduced ? to : value)}
        {unit}
      </span>
      <span className="sr-only">
        {fmt(to)}
        {unit}
      </span>
    </span>
  );
}
