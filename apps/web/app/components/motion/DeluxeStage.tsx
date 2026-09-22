'use client';

/**
 * DeluxeStage — the peeking-carousel physics borrowed from AWS's own
 * customer-story rail: neighbours rest squashed to scaleY(0.9), the active
 * card is scaleY(1), and advancing settles in 800ms ease-out with a real
 * overshoot — DELUXE.overshoot, not a bezier curve nudged to look like one
 * — at 70% of the move. Only the physics are borrowed; radius, type and
 * colour stay whatever the call site already uses. This primitive never
 * restyles a card, it only moves the track it sits in.
 *
 * The overshoot is a Web Animations API keyframe on the track itself
 * (`el.animate([...], {duration, easing})`), not a CSS `transition` —
 * a single cubic-bezier cannot both ease out AND loop back past its target,
 * so the settle is driven imperatively. That is also why the track's
 * transform is never written through React's `style` prop: this component
 * and the browser's own animation engine would fight over the same
 * property on every re-render. It moves in pixels, `itemWidth + gap`
 * measured off the mounted DOM, never `translateX(-100%)` — a percentage
 * move on a track with a gap between items lands short or long.
 *
 * Live pointer drag is a first-class input, not a special case bolted on
 * after release: the call site owns its own gesture detection (tap vs.
 * drag, the release threshold, whatever the card itself does on tap) and
 * hands this component two numbers — `dragging` and `dragOffsetPx` — while
 * the drag is live. On release, the call site just calls `onIndex` with
 * wherever it landed; the settle continues from the exact pixel the drag
 * left off, not from a snapped-back rest position first.
 *
 * `prefers-reduced-motion: reduce` is detected here by default (same
 * `matchMedia` check every other motion primitive in this folder uses) but
 * can be overridden by a call site that already computed it, so two
 * listeners don't run for one component tree. Reduced motion collapses the
 * settle to an instant position swap and the scaleY squash to identity —
 * the deck still changes cards, it just never animates doing it.
 *
 * Looping wraps the DATA, not the DOM order: at `index === 0` the item
 * before it is `items[N-1]`, and the track still needs to slide to it, not
 * jump across the whole flat array. So when `loop` is true this component
 * renders `items` with one clone of the last item prepended and one clone
 * of the first item appended — `index` is offset by one to match — which
 * gives every boundary a real, positioned neighbour to slide to. The clone
 * gets its own key (`${key}--clone-start/end`); crossing the exact seam
 * (the last card back to the first) is the one transition that doesn't
 * carry a shared React key across the wrap and settles instantly instead
 * of sliding — every other step, including every other loop-around, slides
 * and overshoots normally.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DELUXE } from './tokens';

export type DeluxeStagePeek = 'prev' | 'next' | null;

export type DeluxeStageProps<T> = {
  items: T[];
  index: number;
  onIndex: (next: number) => void;
  renderItem: (item: T, state: { active: boolean; peek: DeluxeStagePeek }) => React.ReactNode;
  getKey: (item: T) => string;
  ariaLabel: string;
  loop?: boolean;
  /** True while the call site's own pointer handlers are mid-drag. */
  dragging?: boolean;
  /** Live px offset from the drag's start point, while `dragging` is true. */
  dragOffsetPx?: number;
  /** Override the internal `matchMedia` reduced-motion check. */
  reducedMotion?: boolean;
  /** The call site's own prev/next controls make this component's built-in
   *  nav buttons redundant — off by default. */
  showNav?: boolean;
};

export function DeluxeStage<T>({
  items,
  index,
  onIndex,
  renderItem,
  getKey,
  ariaLabel,
  loop = true,
  dragging = false,
  dragOffsetPx = 0,
  reducedMotion: reducedMotionProp,
  showNav = false,
}: DeluxeStageProps<T>) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [detectedReduced, setDetectedReduced] = useState(false);

  const prevIndexRef = useRef(index);
  const wasDraggingRef = useRef(false);
  const lastAppliedPxRef = useRef<number | null>(null);
  const animRef = useRef<Animation | null>(null);

  useEffect(() => {
    if (reducedMotionProp !== undefined || typeof window === 'undefined') return;
    setDetectedReduced(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  }, [reducedMotionProp]);
  const reducedMotion = reducedMotionProp ?? detectedReduced;

  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      setContainerWidth(el?.clientWidth || 0);
      return;
    }
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const N = items.length;
  const shift = loop && N > 1 ? 1 : 0;
  const extended = shift ? [items[N - 1]!, ...items, items[0]!] : items;
  const activePos = index + shift;

  const margin = DELUXE.peekPx + DELUXE.gapPx;
  const itemWidth = Math.max(0, containerWidth - margin * 2);
  const step = itemWidth + DELUXE.gapPx;
  const restPx = (pos: number) => -pos * step + margin;

  // The one place the track's transform is written. Never through React's
  // `style` prop — see the file header for why. Positions here are always
  // `activePos` (within `extended`), not the raw `index` prop.
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el || !itemWidth) return;

    if (dragging) {
      animRef.current?.cancel();
      animRef.current = null;
      const px = restPx(activePos) + dragOffsetPx;
      el.style.transform = `translateX(${px}px)`;
      lastAppliedPxRef.current = px;
      wasDraggingRef.current = true;
      prevIndexRef.current = activePos;
      return;
    }

    const cameFromDrag = wasDraggingRef.current;
    wasDraggingRef.current = false;
    const prevIndex = prevIndexRef.current;
    prevIndexRef.current = activePos;
    const toPx = restPx(activePos);

    if (prevIndex === activePos && !cameFromDrag) {
      // An unrelated re-render (a resize, a reduced-motion flip) — leave a
      // running settle alone, otherwise make sure we're actually at rest.
      if (!animRef.current && lastAppliedPxRef.current !== toPx) {
        el.style.transform = `translateX(${toPx}px)`;
        lastAppliedPxRef.current = toPx;
      }
      return;
    }

    animRef.current?.cancel();
    const fromPx = cameFromDrag ? (lastAppliedPxRef.current ?? restPx(prevIndex)) : restPx(prevIndex);

    if (reducedMotion || typeof el.animate !== 'function') {
      el.style.transform = `translateX(${toPx}px)`;
      lastAppliedPxRef.current = toPx;
      animRef.current = null;
      return;
    }

    // Real overshoot: only advancing to a *different* card overshoots past
    // it before settling back. A cancelled drag (index unchanged) eases
    // straight back to rest — there is nothing to overshoot past.
    const overshootPx = prevIndex === activePos ? toPx : fromPx + (toPx - fromPx) * DELUXE.overshoot;
    const anim = el.animate(
      [
        { transform: `translateX(${fromPx}px)`, offset: 0 },
        { transform: `translateX(${overshootPx}px)`, offset: 0.7 },
        { transform: `translateX(${toPx}px)`, offset: 1 },
      ],
      { duration: DELUXE.durationMs, easing: DELUXE.ease, fill: 'forwards' },
    );
    anim.onfinish = () => {
      if (animRef.current === anim) animRef.current = null;
    };
    animRef.current = anim;
    lastAppliedPxRef.current = toPx;
  }, [activePos, itemWidth, dragging, dragOffsetPx, reducedMotion]);

  useEffect(() => () => animRef.current?.cancel(), []);

  const goTo = (next: number) => {
    if (N === 0) return;
    const wrapped = loop ? ((next % N) + N) % N : Math.min(N - 1, Math.max(0, next));
    onIndex(wrapped);
  };

  const canPrev = loop || index > 0;
  const canNext = loop || index < N - 1;

  return (
    <div
      ref={stageRef}
      className="deluxe-stage"
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
    >
      <div
        ref={trackRef}
        className="deluxe-track"
        style={{ gap: `${DELUXE.gapPx}px` }}
      >
        {extended.map((item, n) => {
          const active = n === activePos;
          const peek: DeluxeStagePeek = n === activePos - 1 ? 'prev' : n === activePos + 1 ? 'next' : null;
          const scaleY = reducedMotion ? 1 : active ? 1 : DELUXE.inactiveScaleY;
          const key = shift && n === 0 ? `${getKey(item)}--clone-start` : shift && n === extended.length - 1 ? `${getKey(item)}--clone-end` : getKey(item);
          return (
            <div
              key={key}
              className={`deluxe-item${active ? ' is-active' : ''}`}
              style={{
                flex: `0 0 ${itemWidth || 100}px`,
                transform: `scaleY(${scaleY})`,
                transition: itemWidth && !reducedMotion ? `transform ${DELUXE.durationMs}ms ${DELUXE.ease}` : 'none',
              }}
              aria-hidden={active ? undefined : true}
            >
              {renderItem(item, { active, peek })}
            </div>
          );
        })}
      </div>
      {showNav && (
        <>
          <button type="button" className="deluxe-nav deluxe-nav-prev" aria-label="Previous" onClick={() => goTo(index - 1)} disabled={!canPrev}>
            ‹
          </button>
          <button type="button" className="deluxe-nav deluxe-nav-next" aria-label="Next" onClick={() => goTo(index + 1)} disabled={!canNext}>
            ›
          </button>
        </>
      )}
    </div>
  );
}
