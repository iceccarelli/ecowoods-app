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
 * left off, not from a snapped-back rest position first. A drag that ends
 * back under the release threshold (`index` unchanged) still eases back to
 * rest from that live pixel — no overshoot, there is nothing to overshoot
 * past, but it is not an instant snap either.
 *
 * `prefers-reduced-motion: reduce` is detected here by default (same
 * `matchMedia` check every other motion primitive in this folder uses) but
 * can be overridden by a call site that already computed it, so two
 * listeners don't run for one component tree. Reduced motion collapses
 * every settle below to an instant position swap and the scaleY squash to
 * identity — the deck still changes cards, it just never animates doing it.
 *
 * THREE KINDS OF STEP, per `classifyIndexStep`, each rendered differently:
 *
 * 1. ADJACENT (`nextIndex === prevIndex ± 1`) — the ordinary case. The track
 *    slides exactly one item, with the overshoot above.
 * 2. WRAP (`loop` true, stepping off the last item back to the first, or off
 *    the first back to the last) — looping wraps the DATA, not DOM order:
 *    at `index === 0` the item before it is `items[N-1]`, sitting nowhere
 *    near it in a flat array. So when `loop` is true this component renders
 *    `items` with one clone of the last item prepended and one clone of the
 *    first appended (`extended`, `index` offset by `shift`), and a wrap step
 *    animates onto that clone exactly like an adjacent step — same
 *    overshoot, same duration — then, the instant that settle finishes,
 *    silently swaps the track to the real item's slot with no transition at
 *    all. The clone and the real item are the same photograph in the same
 *    screen position at that instant, so the swap is invisible; the
 *    now-current `visualPos` state (not the raw index prop) is what
 *    `active`/`peek` render from, so the card doesn't relabel itself active
 *    early, mid-flight, either.
 * 3. FAR (anything else — a dot jumped three floors over) — no card-by-card
 *    flight through the whole deck. The track's position is set once,
 *    instantly, cancelling whatever was mid-flight.
 *
 * Autoplay and the arrow buttons only ever request adjacent (or, at a
 * boundary, wrap) steps; only an arbitrary jump — a dot, typically — can
 * produce a far step.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DELUXE } from './tokens';

export type DeluxeStagePeek = 'prev' | 'next' | null;

export type StepKind = 'none' | 'adjacent' | 'wrap-forward' | 'wrap-backward' | 'far';

/**
 * Pure classification of one index change — no DOM, easy to pin down in a
 * test. `direction` is only meaningful for 'adjacent' and the two 'wrap-*'
 * kinds; it is 0 for 'none' and 'far' (a far jump has no single direction
 * to slide in — it snaps instead).
 */
export function classifyIndexStep(
  prevIndex: number,
  nextIndex: number,
  itemCount: number,
  loop: boolean,
): { kind: StepKind; direction: 1 | -1 | 0 } {
  if (itemCount <= 0 || prevIndex === nextIndex) return { kind: 'none', direction: 0 };
  if (nextIndex === prevIndex + 1) return { kind: 'adjacent', direction: 1 };
  if (nextIndex === prevIndex - 1) return { kind: 'adjacent', direction: -1 };
  if (loop && prevIndex === itemCount - 1 && nextIndex === 0) return { kind: 'wrap-forward', direction: 1 };
  if (loop && prevIndex === 0 && nextIndex === itemCount - 1) return { kind: 'wrap-backward', direction: -1 };
  return { kind: 'far', direction: 0 };
}

export function isWrapKind(kind: StepKind): boolean {
  return kind === 'wrap-forward' || kind === 'wrap-backward';
}

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

  const N = items.length;
  const shift = loop && N > 1 ? 1 : 0;
  const extended = shift ? [items[N - 1]!, ...items, items[0]!] : items;
  const activePos = index + shift; // the canonical, "at rest" extended-array position

  // What the track is *currently showing* as active — equals `activePos`
  // except mid-flight through a wrap's clone, where it briefly lags behind
  // on purpose (see the file header, kind 2).
  const [visualPos, setVisualPos] = useState(activePos);

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

  const margin = DELUXE.peekPx + DELUXE.gapPx;
  const itemWidth = Math.max(0, containerWidth - margin * 2);
  const step = itemWidth + DELUXE.gapPx;
  const restPx = (pos: number) => -pos * step + margin;

  // The one place the track's transform is written. Never through React's
  // `style` prop — see the file header for why.
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
      prevIndexRef.current = index;
      if (visualPos !== activePos) setVisualPos(activePos);
      return;
    }

    const cameFromDrag = wasDraggingRef.current;
    wasDraggingRef.current = false;
    const prevRealIndex = prevIndexRef.current;
    prevIndexRef.current = index;

    if (prevRealIndex === index && !cameFromDrag) {
      // An unrelated re-render (a resize, a reduced-motion flip) — leave a
      // running settle alone, otherwise make sure we're actually at rest.
      if (!animRef.current) {
        const toPx = restPx(activePos);
        if (lastAppliedPxRef.current !== toPx) {
          el.style.transform = `translateX(${toPx}px)`;
          lastAppliedPxRef.current = toPx;
        }
        if (visualPos !== activePos) setVisualPos(activePos);
      }
      return;
    }

    const { kind, direction } = classifyIndexStep(prevRealIndex, index, N, loop);
    animRef.current?.cancel();
    const fromPx = cameFromDrag ? (lastAppliedPxRef.current ?? restPx(visualPos)) : restPx(visualPos);

    // 'none' only reaches here when `cameFromDrag` is true (the unchanged,
    // not-from-drag case already returned above) — a cancelled drag, eased
    // back to rest with no overshoot: there's nothing to overshoot past.
    if (kind === 'none') {
      const toPx = restPx(activePos);
      if (reducedMotion || typeof el.animate !== 'function') {
        el.style.transform = `translateX(${toPx}px)`;
        lastAppliedPxRef.current = toPx;
        animRef.current = null;
        return;
      }
      const anim = el.animate(
        [{ transform: `translateX(${fromPx}px)` }, { transform: `translateX(${toPx}px)` }],
        { duration: DELUXE.durationMs, easing: DELUXE.ease, fill: 'forwards' },
      );
      anim.onfinish = () => {
        if (animRef.current !== anim) return;
        animRef.current = null;
        // A finished fill:'forwards' animation keeps its effect applied —
        // it outranks a plain inline style in the cascade — so a later
        // bare `el.style.transform` write is silently ignored until this
        // animation is explicitly cancelled.
        el.style.transform = `translateX(${toPx}px)`;
        anim.cancel();
      };
      animRef.current = anim;
      lastAppliedPxRef.current = toPx;
      return;
    }

    if (kind === 'far') {
      // No flying through the whole deck for a distant jump — set the
      // position once, instantly.
      const toPx = restPx(activePos);
      el.style.transform = `translateX(${toPx}px)`;
      lastAppliedPxRef.current = toPx;
      animRef.current = null;
      if (visualPos !== activePos) setVisualPos(activePos);
      return;
    }

    // 'adjacent' or a wrap: animate exactly one step in extended-space —
    // for a wrap that step lands on the clone at the far end, not yet the
    // canonical `activePos`.
    const targetVisualPos = visualPos + direction;
    const toPx = restPx(targetVisualPos);
    const wrap = isWrapKind(kind);

    if (visualPos !== targetVisualPos) setVisualPos(targetVisualPos);

    const snapToCanonical = () => {
      if (!wrap) return;
      // Same photograph, different DOM slot — an instant, unanimated snap
      // from the clone this animation just landed on to the real item's
      // slot, imperceptible because both show the same image in the same
      // screen position.
      const snapPx = restPx(activePos);
      el.style.transform = `translateX(${snapPx}px)`;
      lastAppliedPxRef.current = snapPx;
      setVisualPos(activePos);
    };

    if (reducedMotion || typeof el.animate !== 'function') {
      el.style.transform = `translateX(${toPx}px)`;
      lastAppliedPxRef.current = toPx;
      animRef.current = null;
      snapToCanonical();
      return;
    }

    const overshootPx = fromPx + (toPx - fromPx) * DELUXE.overshoot;
    const anim = el.animate(
      [
        { transform: `translateX(${fromPx}px)`, offset: 0 },
        { transform: `translateX(${overshootPx}px)`, offset: 0.7 },
        { transform: `translateX(${toPx}px)`, offset: 1 },
      ],
      { duration: DELUXE.durationMs, easing: DELUXE.ease, fill: 'forwards' },
    );
    anim.onfinish = () => {
      if (animRef.current !== anim) return; // superseded by a newer step
      animRef.current = null;
      // Same cascade issue as the 'none' branch above: release the
      // finished animation's hold before writing (or re-writing, via
      // snapToCanonical) the inline transform, or the write is ignored.
      el.style.transform = `translateX(${toPx}px)`;
      anim.cancel();
      snapToCanonical();
    };
    animRef.current = anim;
    lastAppliedPxRef.current = toPx;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, itemWidth, dragging, dragOffsetPx, reducedMotion, N, loop, shift]);

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
          const active = n === visualPos;
          const peek: DeluxeStagePeek = n === visualPos - 1 ? 'prev' : n === visualPos + 1 ? 'next' : null;
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
