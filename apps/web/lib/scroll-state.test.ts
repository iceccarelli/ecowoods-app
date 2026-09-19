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
    /* A candidate flip now needs a second sample to confirm it — see the
       "a flip needs a second vote" describe block below. */
    const candidate = nextScrollState(states[1]!, 1500 + FLIP_PX + 1);
    expect(candidate.direction, 'still pending, not yet down').toBe('up');
    expect(nextScrollState(candidate, 1500 + FLIP_PX + 2).direction, 'confirmed on the next sample').toBe('down');
  });
});

describe('it does not move for movement the reader did not make', () => {
  it('ignores trackpad wobble indefinitely', () => {
    /* ±9px around a fixed point, two hundred samples. A reader with a finger
       resting on a trackpad. The bar must never move. */
    const ys = Array.from({ length: 200 }, (_, i) => 900 + Math.round(Math.sin(i / 2) * 9));
    const { changes } = replay(ys, { direction: 'up', scrolled: true, anchorY: 900, pending: null });
    expect(changes).toBe(0);
  });

  it('ignores momentum settling after a flick', () => {
    const ys = Array.from({ length: 120 }, (_, i) =>
      Math.round(1200 + Math.sin(i / 3) * 18 * Math.exp(-i / 30)),
    );
    const { changes } = replay(ys, { direction: 'down', scrolled: true, anchorY: 1220, pending: null });
    expect(changes).toBe(0);
  });

  it('ignores random noise on a steady scroll down', () => {
    const r = rng(7);
    let y = 300;
    const ys = Array.from({ length: 300 }, () => Math.round((y += 14 + r() * 10)));
    const { changes } = replay(ys, { direction: 'down', scrolled: true, anchorY: 300, pending: null });
    expect(changes).toBe(0);
  });
});

describe('a flip needs a second vote', () => {
  /* MEASURED, NOT INVENTED — see the follow-up note at the top of
     scroll-state.ts. scripts/measure-scroll-scratch.mjs, driven against a
     production build with Playwright, sampled window.scrollY on every
     requestAnimationFrame during real wheel-driven scrolling and found single
     frames that read 60-92px behind the trend they were already on, with the
     very next frame resuming exactly where the trend left off. FLIP_PX is
     64px; a 92px excursion clears it outright, on a gesture that was never a
     reversal. These numbers are the ones actually observed. */
  it('does not flip on a single 67px excursion that immediately resumes the trend', () => {
    let s: ScrollState = { direction: 'down', scrolled: true, anchorY: 2000, pending: null };
    s = nextScrollState(s, 2050);
    expect(s.direction).toBe('down');
    // The measured anomaly: one sample 67px behind the anchor …
    s = nextScrollState(s, 2050 - 67);
    expect(s.direction, 'a single corrupted sample must not flip it').toBe('down');
    // … and the next sample resumes the original downward trend.
    s = nextScrollState(s, 2075);
    expect(s.direction, 'the trend continuing rejects the candidate').toBe('down');
    expect(s.anchorY).toBe(2075);
  });

  it('does not flip on a single 92px excursion either — the largest one measured', () => {
    let s: ScrollState = { direction: 'down', scrolled: true, anchorY: 2000, pending: null };
    s = nextScrollState(s, 2000 - 92);
    expect(s.direction).toBe('down');
    s = nextScrollState(s, 2025);
    expect(s.direction, 'resumes downward — the excursion was noise').toBe('down');
  });

  it('DOES flip when a second sample genuinely continues the new direction', () => {
    let s: ScrollState = { direction: 'down', scrolled: true, anchorY: 2000, pending: null };
    s = nextScrollState(s, 2000 - (FLIP_PX + 10));
    expect(s.direction, 'still down — pending, not yet confirmed').toBe('down');
    s = nextScrollState(s, 2000 - (FLIP_PX + 30));
    expect(s.direction, 'a second sample further up confirms it').toBe('up');
  });

  it('a pending candidate is invisible to rendersDifferently', () => {
    const a: ScrollState = { direction: 'down', scrolled: true, anchorY: 2000, pending: null };
    const b = nextScrollState(a, 2000 - (FLIP_PX + 10));
    expect(b.pending).not.toBeNull();
    expect(rendersDifferently(a, b), 'a candidate alone must not repaint the bar').toBe(false);
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
    const settled: ScrollState = { direction: 'up', scrolled: false, anchorY: 0, pending: null };
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
    // A deliberate flick is many samples, not one — two confirm it here,
    // both real forward movement in the new direction, exactly what the
    // confirmation step above is designed to let through without delay a
    // person would ever notice.
    s = nextScrollState(s, 400 + FLIP_PX + 10);
    s = nextScrollState(s, 400 + FLIP_PX + 20);
    expect(s.direction, 'a real scroll down hides it').toBe('down');
    const upCandidate = s.anchorY - (FLIP_PX + 10);
    s = nextScrollState(s, upCandidate);
    s = nextScrollState(s, upCandidate - 10); // further up still, confirming it
    expect(s.direction, 'a real scroll up brings it back').toBe('up');
  });

  it('always shows the header near the top, whatever the anchor says', () => {
    const s = nextScrollState(
      { direction: 'down', scrolled: true, anchorY: 5000, pending: null },
      ALWAYS_SHOW_ABOVE_PX - 1,
    );
    expect(s.direction).toBe('up');
  });

  it('keeps the anchor with the reader, so a long scroll does not bank credit', () => {
    /* Scrolling down 3,000px must not mean the bar needs 3,000px of scrolling
       up to return. The anchor follows, so one FLIP_PX reversal is enough —
       confirmed by a second sample continuing the same way, per the block
       above. */
    let s: ScrollState = { direction: 'down', scrolled: true, anchorY: 500, pending: null };
    for (let y = 500; y <= 3500; y += 50) s = nextScrollState(s, y);
    expect(s.anchorY).toBe(3500);
    s = nextScrollState(s, 3500 - FLIP_PX - 1);
    s = nextScrollState(s, 3500 - FLIP_PX - 11);
    expect(s.direction).toBe('up');
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
      direction: 'up', scrolled: true, anchorY: mid, pending: null,
    });
    expect(on.states.every((s) => s.scrolled)).toBe(true);
    const off = replay(Array.from({ length: 60 }, (_, i) => mid + (i % 2)), {
      direction: 'up', scrolled: false, anchorY: mid, pending: null,
    });
    expect(off.states.every((s) => !s.scrolled)).toBe(true);
  });
});

describe('the function itself', () => {
  it('is pure — the same inputs give the same output', () => {
    const a = nextScrollState({ direction: 'down', scrolled: true, anchorY: 800, pending: null }, 700);
    const b = nextScrollState({ direction: 'down', scrolled: true, anchorY: 800, pending: null }, 700);
    expect(a).toEqual(b);
  });

  it('never mutates what it is given', () => {
    const prev: ScrollState = { direction: 'down', scrolled: true, anchorY: 800, pending: null };
    nextScrollState(prev, 100);
    expect(prev).toEqual({ direction: 'down', scrolled: true, anchorY: 800, pending: null });
  });

  it('reports a render difference only when the bar would look different', () => {
    const a: ScrollState = { direction: 'up', scrolled: true, anchorY: 100, pending: null };
    expect(rendersDifferently(a, { ...a, anchorY: 9999 }), 'anchor alone').toBe(false);
    expect(rendersDifferently(a, { ...a, direction: 'down' })).toBe(true);
    expect(rendersDifferently(a, { ...a, scrolled: false })).toBe(true);
  });

  it('a pending candidate does not mutate what it is given either', () => {
    const prev: ScrollState = { direction: 'down', scrolled: true, anchorY: 2000, pending: null };
    nextScrollState(prev, 2000 - (FLIP_PX + 10));
    expect(prev.pending).toBeNull();
  });
});
