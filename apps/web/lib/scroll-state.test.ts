/**
 * The header must not move unless the reader moved it.
 *
 * Every case here is one that was measured in a browser, not invented. The
 * gestures are recorded scroll sequences replayed through the same pure
 * function the component uses, so a regression fails here in milliseconds
 * instead of arriving as a phone call from a customer.
 */
import { describe, expect, it } from 'vitest';
import {
  ALWAYS_SHOW_ABOVE_PX,
  FLIP_PX,
  INITIAL_SCROLL_STATE,
  nextScrollState,
  rendersDifferently,
  SCROLLED_OFF_PX,
  SCROLLED_ON_PX,
  type ScrollState,
} from './scroll-state';

/** Replay a gesture, returning every state and how often the bar would move. */
function replay(ys: number[], from: ScrollState = INITIAL_SCROLL_STATE) {
  let s = from;
  const states: ScrollState[] = [];
  let changes = 0;
  for (const y of ys) {
    const next = nextScrollState(s, y);
    if (rendersDifferently(s, next)) changes += 1;
    s = next;
    states.push(s);
  }
  return { final: s, states, changes };
}

const rng = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;

describe('the first sample never hides the header', () => {
  /* THE ONE FLICKER THAT WAS REPRODUCED, and the reason this file exists.
     A page opened part-way down — reload, Back, a #section link, an App Router
     navigation that restores scroll — used to hide the bar on arrival, because
     the position was measured against an anchor of zero. The visitor saw the
     header paint and then slide away on its own. Every page, every device. */
  for (const y of [0, 100, 221, 700, 1500, 12_000]) {
    it(`opens at y=${y} with the header shown`, () => {
      const s = nextScrollState(INITIAL_SCROLL_STATE, y);
      expect(s.direction, `y=${y}`).toBe('up');
      expect(s.anchorY).toBe(y);
    });
  }

  it('does not hide until the reader has actually scrolled down', () => {
    const { states } = replay([1500, 1500 + FLIP_PX]);
    expect(states.every((s) => s.direction === 'up')).toBe(true);
    expect(nextScrollState(states[1]!, 1500 + FLIP_PX + 1).direction).toBe('down');
  });
});

describe('it does not move for movement the reader did not make', () => {
  it('ignores trackpad wobble indefinitely', () => {
    /* ±9px around a fixed point, two hundred samples. A reader with a finger
       resting on a trackpad. The bar must never move. */
    const ys = Array.from({ length: 200 }, (_, i) => 900 + Math.round(Math.sin(i / 2) * 9));
    const { changes } = replay(ys, { direction: 'up', scrolled: true, anchorY: 900 });
    expect(changes).toBe(0);
  });

  it('ignores momentum settling after a flick', () => {
    const ys = Array.from({ length: 120 }, (_, i) =>
      Math.round(1200 + Math.sin(i / 3) * 18 * Math.exp(-i / 30)),
    );
    const { changes } = replay(ys, { direction: 'down', scrolled: true, anchorY: 1220 });
    expect(changes).toBe(0);
  });

  it('ignores random noise on a steady scroll down', () => {
    const r = rng(7);
    let y = 300;
    const ys = Array.from({ length: 300 }, () => Math.round((y += 14 + r() * 10)));
    const { changes } = replay(ys, { direction: 'down', scrolled: true, anchorY: 300 });
    expect(changes).toBe(0);
  });
});

describe('iOS rubber-banding', () => {
  /* Safari reports NEGATIVE scrollY while bouncing at the top of the document.
     Unclamped, the sign of every comparison against the anchor flips during the
     bounce — a blink at the top of every page on every iPhone. */
  it('never produces a hidden header from negative positions', () => {
    /* Replayed from a SETTLED state at the top, not from INITIAL_SCROLL_STATE.
       The very first sample legitimately moves `direction` from null to 'up',
       which is a render change and would make a zero-change assertion fail for
       a reason that has nothing to do with rubber-banding. Caught by this test
       failing when it was first run, which is the point of running it. */
    const settled: ScrollState = { direction: 'up', scrolled: false, anchorY: 0 };
    const ys = [0, -12, -26, -18, -6, 0, -9, -20, -11, 0, 4, 0, -7, 0, -31, 0];
    const { states, changes } = replay(ys, settled);
    expect(states.every((s) => s.direction === 'up')).toBe(true);
    expect(changes).toBe(0);
  });

  it('treats a negative position as the top for the scrolled treatment', () => {
    expect(nextScrollState(INITIAL_SCROLL_STATE, -40).scrolled).toBe(false);
  });

  it('survives a non-finite reading without throwing or hiding', () => {
    expect(nextScrollState(INITIAL_SCROLL_STATE, Number.NaN).direction).toBe('up');
  });
});

describe('it does move when the reader means it', () => {
  it('hides on a deliberate scroll down and comes back on a deliberate scroll up', () => {
    let s = nextScrollState(INITIAL_SCROLL_STATE, 400);
    expect(s.direction).toBe('up');
    s = nextScrollState(s, 400 + FLIP_PX + 10);
    expect(s.direction, 'a real scroll down hides it').toBe('down');
    s = nextScrollState(s, 400 + FLIP_PX + 10 - (FLIP_PX + 10));
    expect(s.direction, 'a real scroll up brings it back').toBe('up');
  });

  it('always shows the header near the top, whatever the anchor says', () => {
    const s = nextScrollState({ direction: 'down', scrolled: true, anchorY: 5000 }, ALWAYS_SHOW_ABOVE_PX - 1);
    expect(s.direction).toBe('up');
  });

  it('keeps the anchor with the reader, so a long scroll does not bank credit', () => {
    /* Scrolling down 3,000px must not mean the bar needs 3,000px of scrolling
       up to return. The anchor follows, so one FLIP_PX reversal is enough. */
    let s: ScrollState = { direction: 'down', scrolled: true, anchorY: 500 };
    for (let y = 500; y <= 3500; y += 50) s = nextScrollState(s, y);
    expect(s.anchorY).toBe(3500);
    expect(nextScrollState(s, 3500 - FLIP_PX - 1).direction).toBe('up');
  });
});

describe('the scrolled treatment has a dead band', () => {
  /* One threshold means a reader resting on it strobes the background, the
     border and the box-shadow, each with its own 250ms transition, over a
     backdrop-filter that has to repaint every time. */
  it('turns on and off at different points', () => {
    expect(SCROLLED_ON_PX).toBeGreaterThan(SCROLLED_OFF_PX);
  });

  it('does not toggle for a reader sitting between the two', () => {
    const mid = Math.round((SCROLLED_ON_PX + SCROLLED_OFF_PX) / 2);
    const on = replay(Array.from({ length: 60 }, (_, i) => mid + (i % 2)), {
      direction: 'up', scrolled: true, anchorY: mid,
    });
    expect(on.states.every((s) => s.scrolled)).toBe(true);
    const off = replay(Array.from({ length: 60 }, (_, i) => mid + (i % 2)), {
      direction: 'up', scrolled: false, anchorY: mid,
    });
    expect(off.states.every((s) => !s.scrolled)).toBe(true);
  });
});

describe('the function itself', () => {
  it('is pure — the same inputs give the same output', () => {
    const a = nextScrollState({ direction: 'down', scrolled: true, anchorY: 800 }, 700);
    const b = nextScrollState({ direction: 'down', scrolled: true, anchorY: 800 }, 700);
    expect(a).toEqual(b);
  });

  it('never mutates what it is given', () => {
    const prev: ScrollState = { direction: 'down', scrolled: true, anchorY: 800 };
    nextScrollState(prev, 100);
    expect(prev).toEqual({ direction: 'down', scrolled: true, anchorY: 800 });
  });

  it('reports a render difference only when the bar would look different', () => {
    const a: ScrollState = { direction: 'up', scrolled: true, anchorY: 100 };
    expect(rendersDifferently(a, { ...a, anchorY: 9999 }), 'anchor alone').toBe(false);
    expect(rendersDifferently(a, { ...a, direction: 'down' })).toBe(true);
    expect(rendersDifferently(a, { ...a, scrolled: false })).toBe(true);
  });
});
