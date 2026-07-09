'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ────────────────────────────────────────────────────────────────────────────
   READING PROGRESS RAIL

   The newspaper pattern: a hairline that answers "how much is left?" without
   asking for attention. Three constraints shaped this:

   1. It must not cost frames. The fill is driven by `transform: scaleX()` on a
      compositor layer — no width animation, no layout, no paint. The scroll
      handler is passive and rAF-coalesced, so we write at most once per frame
      no matter how fast the wheel spins.

   2. It must survive the header. `.topbar` hides on scroll-down (translateY
      -100%). The rail is its own fixed element at z-index 90, so it stays put
      while the header slides away — which is exactly when a reader most wants
      to know where they are.

   3. It must be honest about what it is. The bar itself duplicates the
      scrollbar, so it is aria-hidden. The section ticks are real anchor links
      inside a labelled <nav> — a keyboard user gets a genuine skip-nav out of
      it, not a decoration they have to tab past for nothing.

   Section offsets are measured, not assumed: images load late and change the
   document height, so a ResizeObserver on <body> re-measures rather than
   trusting a first-paint snapshot.
   ──────────────────────────────────────────────────────────────────────────── */

/** DOM order. Ids that don't exist on a given route are skipped silently. */
const SECTIONS: { id: string; label: string }[] = [
  { id: 'hero', label: 'Start' },
  { id: 'reviews', label: 'Proof' },
  { id: 'services', label: 'The Standard' },
  { id: 'process', label: 'Process' },
  { id: 'gallery', label: 'Our Work' },
  { id: 'configurator', label: 'Design Your Floor' },
  { id: 'faq', label: 'Answers' },
  { id: 'quote', label: 'Book a Measure' },
];

type Tick = { id: string; label: string; pct: number };

/** Show the rail only once the reader has committed — not over the hero at rest. */
const REVEAL_AFTER_PX = 140;

export default function ReadingProgress() {
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const fillRef = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);

  const measure = useCallback(() => {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - window.innerHeight;
    if (scrollable <= 0) {
      setTicks([]);
      return;
    }
    const next: Tick[] = [];
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (!el) continue;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const pct = Math.min(1, Math.max(0, top / scrollable));
      next.push({ ...s, pct });
    }
    // A rail with one tick tells you nothing.
    setTicks(next.length >= 2 ? next : []);
  }, []);

  useEffect(() => {
    const read = () => {
      frame.current = null;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      const p = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;

      // Write straight to the node. Putting this in React state would rerender
      // the whole rail ~60×/second for a single transform.
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${p})`;
      setVisible(window.scrollY > REVEAL_AFTER_PX);
      setProgress(p);
    };

    const onScroll = () => {
      if (frame.current === null) frame.current = requestAnimationFrame(read);
    };

    read();
    measure();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);

    // Unsplash images land after first paint and change scrollHeight. Without
    // this the ticks are pinned to a document that no longer exists.
    const ro = new ResizeObserver(() => { measure(); onScroll(); });
    ro.observe(document.body);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
      ro.disconnect();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [measure]);

  return (
    <div className="progress-rail" data-visible={visible}>
      <div className="progress-rail-track" aria-hidden="true" />
      <div className="progress-rail-fill" ref={fillRef} aria-hidden="true" />

      {ticks.length > 0 && (
        <nav className="progress-rail-ticks" aria-label="Page sections">
          {ticks.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className="progress-tick"
              style={{ left: `${t.pct * 100}%` }}
              data-passed={progress >= t.pct - 0.005}
              aria-label={`Jump to ${t.label}`}
            >
              <span className="progress-tick-label">{t.label}</span>
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}
