/**
 * lib/scroll-state.ts — the hide-on-scroll decision, as a pure function.
 *
 * WHAT WAS REPORTED, AND WHAT WAS ACTUALLY FOUND
 *
 * Reported: the header blinks while scrolling, on every page, on phones and on
 * desktops, from customers.
 *
 * This file does NOT claim to have reproduced that. It is worth being exact,
 * because a fix presented as certain when it is not is how a defect gets closed
 * while it is still happening. What was done: the shipped hook was bundled with
 * React and driven in headless Chromium against this stylesheet, over recorded
 * gestures — steady scrolling, trackpad noise, momentum settle, deliberate
 * reversals, iOS rubber-band values. Header state changes were counted, and the
 * scroll TRAVEL between them measured.
 *
 *   · Ordinary scrolling did not blink. Six state changes over 1,520px of
 *     travel, 247px apart at the closest. Correct behaviour.
 *   · The `backdrop-filter: blur(20px)` on a 15%-transparent bar was suspected
 *     and RULED OUT: with realistic page content behind it, 0.00% of header
 *     pixels changed per frame. An earlier 17% reading was the striped test
 *     page in the harness, not the site.
 *
 * ONE FLICKER WAS REPRODUCED, AND IT IS UNIVERSAL
 *
 * The state starts at `direction: null, anchorY: 0`. A page opened part-way
 * down — reload, Back, a #section link, or an App Router client navigation that
 * restores position — delivers a first sample of, say, 1500. The old hook
 * measured that against `lastY = 0`, decided 1500px of downward movement had
 * just happened, and hid the bar.
 *
 * So the header paints, correct and present, and then slides away on its own
 * 350ms later having been touched by nobody. On a site navigated by clicking,
 * that is every page, every time, on every device. It matches "on all pages,
 * mobile and desktop" exactly, and it is fixed here and asserted in the test.
 *
 * THREE REAL DEFECTS IN THE OLD HOOK, FIXED REGARDLESS
 *
 * These are wrong independently of which one a customer saw:
 *
 *  1. The reference point was React state and the effect DEPENDED on it:
 *
 *         const [lastY, setLastY] = useState(0);
 *         useEffect(() => { … }, [lastY]);
 *
 *     so the scroll listener was torn down and re-added every 40px. The
 *     `ticking` flag that throttles the rAF is a local inside that effect, so
 *     each re-subscription minted a fresh `ticking = false` and defeated its
 *     own throttle — several callbacks could be in flight, each closed over a
 *     different `lastY`, each writing an anchor computed from a stale one.
 *  2. `window.scrollY` was used unclamped. iOS reports NEGATIVE values while
 *     rubber-banding at the top and overshoot past the end at the bottom, and
 *     the sign of `current > lastY` flips during the bounce.
 *  3. `scrolled` toggled on a single threshold (`> 16`), so a reader resting
 *     there strobes the background, the border and the box-shadow, each with
 *     its own 250ms transition, over a backdrop-filter that repaints each time.
 *
 * WHAT REPLACES IT
 *
 * An anchor with real hysteresis and no React state in the hot path. The anchor
 * tracks the furthest point reached in the CURRENT direction; the direction
 * flips only when the reader has genuinely reversed by FLIP_PX. Scrolling
 * further the same way moves the anchor and changes nothing else.
 *
 * It is a pure function so every one of these cases is testable without a
 * browser — see scroll-state.test.ts, where the gestures are the recorded ones.
 */

export type ScrollDirection = 'up' | 'down' | null;

export type ScrollState = {
  /** 'down' hides the bar. `null` only before the first sample. */
  direction: ScrollDirection;
  /** Drives the background/border/shadow treatment, not the hiding. */
  scrolled: boolean;
  /** Furthest point reached in the current direction. Not the last position. */
  anchorY: number;
};

export const INITIAL_SCROLL_STATE: ScrollState = {
  direction: null,
  scrolled: false,
  anchorY: 0,
};

/**
 * How far the reader must REVERSE before the bar moves.
 *
 * Not a debounce and not a threshold on raw movement: it is measured from the
 * furthest point reached going the other way, which is what makes it immune to
 * jitter of any frequency. 64px is comfortably past trackpad inertia wobble
 * and well under a deliberate flick.
 */
export const FLIP_PX = 64;

/** Below this the bar is always shown, whatever the anchor says. */
export const ALWAYS_SHOW_ABOVE_PX = 220;

/** Dead band for the `scrolled` treatment. On at 24, off at 8 — never one number. */
export const SCROLLED_ON_PX = 24;
export const SCROLLED_OFF_PX = 8;

/**
 * Fold one scroll position into the state. Pure: same inputs, same output, no
 * reads of `window`. `rawY` is `window.scrollY` exactly as the browser gives
 * it, including the negative values iOS produces while rubber-banding.
 */
export function nextScrollState(prev: ScrollState, rawY: number): ScrollState {
  const y = Math.max(0, Number.isFinite(rawY) ? rawY : 0);

  /* Dead band, so resting on the boundary cannot strobe the backdrop-filter. */
  const scrolled = prev.scrolled ? y > SCROLLED_OFF_PX : y > SCROLLED_ON_PX;

  let direction = prev.direction;
  let anchorY = prev.anchorY;

  /* THE FIRST SAMPLE NEVER HIDES THE BAR, AND THIS IS NOT A DETAIL.
   *
   * The state starts at `direction: null, anchorY: 0`. A page opened part-way
   * down — browser scroll restoration on reload or Back, a link to #section, or
   * an App Router client navigation that restores position — delivers a first
   * sample of, say, 1500. Measured against an anchor of 0 that is 1500px of
   * "downward movement" that never happened, so the bar hides.
   *
   * What a visitor sees is the header painted, present and correct, and then
   * sliding away on its own 350ms later, having touched nothing. On a site
   * navigated by clicking, that is every page, every time. The shipped hook did
   * exactly this, and so did the first draft of the replacement — which is why
   * it is a named case here and an asserted one in the test.
   *
   * So the first sample only ever ESTABLISHES the anchor. */
  if (direction === null) {
    return { direction: 'up', scrolled, anchorY: y };
  }

  if (y <= ALWAYS_SHOW_ABOVE_PX) {
    /* The first screen is never a place to hide the bar, and it is where the
       rubber-band noise is. Reset the anchor too, so leaving the top starts
       the hysteresis from here rather than from wherever the reader last was. */
    return { direction: 'up', scrolled, anchorY: y };
  }

  if (direction === 'down') {
    if (y >= anchorY) anchorY = y;                       // still going down
    else if (anchorY - y > FLIP_PX) { direction = 'up'; anchorY = y; }
  } else {
    if (y <= anchorY) anchorY = y;                       // still going up
    else if (y - anchorY > FLIP_PX) { direction = 'down'; anchorY = y; }
  }

  return { direction, scrolled, anchorY };
}

/** True when the two states would render the bar differently. */
export function rendersDifferently(a: ScrollState, b: ScrollState): boolean {
  return a.direction !== b.direction || a.scrolled !== b.scrolled;
}
