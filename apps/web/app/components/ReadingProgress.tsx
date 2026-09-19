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

   BLINK-01 FOLLOW-UP — THIS COMPONENT WAS RE-RENDERING EVERY SCROLL FRAME,
   ON EVERY PAGE, CONTRADICTING ITS OWN COMMENT ABOVE.

   Constraint 1 says the fill must not cost frames and is written straight to
   a ref for exactly that reason. `setProgress(p)` sat two lines below it,
   called unconditionally inside the same rAF-throttled `read()`, with `p` a
   float that is different on almost every frame while scrolling. React does
   not bail out of a state update for a genuinely different value, so this
   component re-rendered on every animation frame of every scroll, on every
   route — mounted globally from layout.tsx — competing for the same
   requestAnimationFrame budget as Header's own scroll-driven render.

   Said plainly: this was not the cause of the reported header blink.
   scripts/measure-scroll-scratch.mjs, run against a production build before
   and after this fix, reproduces the same flicker either way — the actual
   mechanism, and the fix for it, are in lib/scroll-state.ts's own follow-up
   note. This is a second, independently real defect found on the way there:
   spending a render on every scroll frame, on every page, for a value read
   back only as a handful of discrete booleans, is real main-thread cost
   worth removing on its own terms, whether or not it was the customer's bug.

   `progress` is only ever READ to decide whether a tick has been passed —
   a handful of discrete boolean flips, not a continuous value — so the fix
   is the same shape as the fill: keep the continuous number out of state,
   and only call setState when the thing actually rendered from it changes. */

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
  const [passed, setPassed] = useState<boolean[]>([]);
  const [visible, setVisible] = useState(false);
  const fillRef = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  // The scroll handler needs the current ticks without re-subscribing every
  // time `ticks` changes (which would reset `frame`/`ticking` state the same
  // way BLINK-01 already diagnosed for the header). Kept in sync by the
  // effect below, read only inside `read()`.
  const ticksRef = useRef<Tick[]>([]);
  const passedRef = useRef<boolean[]>([]);

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
    ticksRef.current = ticks;
  }, [ticks]);

  useEffect(() => {
    const read = () => {
      frame.current = null;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      const p = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;

      // Write straight to the node. Putting this in React state would rerender
      // the whole rail ~60×/second for a single transform.
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${p})`;
      // A boolean threshold: React already bails out of the state update (and
      // the render) when this is the same value as last frame, via Object.is.
      setVisible(window.scrollY > REVEAL_AFTER_PX);

      // `progress` used to be React state here, updated every frame — the
      // defect this whole comment block above documents. What actually needs
      // to be RENDERED is which ticks are passed, a handful of booleans that
      // only flip a few times per scroll. Compute that, and only touch state
      // when the array is actually different from last frame's.
      const cur = ticksRef.current;
      if (cur.length) {
        const next = cur.map((t) => p >= t.pct - 0.005);
        const prev = passedRef.current;
        const same = prev.length === next.length && next.every((v, i) => v === prev[i]);
        if (!same) {
          passedRef.current = next;
          setPassed(next);
        }
      }
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
          {ticks.map((t, i) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className="progress-tick"
              style={{ left: `${t.pct * 100}%` }}
              data-passed={passed[i] ?? false}
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
