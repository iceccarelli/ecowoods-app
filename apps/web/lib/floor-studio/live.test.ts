/**
 * lib/floor-studio/live.test.ts — the camera loop, without a camera.
 *
 * Everything that decides anything in the live view is a pure function over
 * numbers, which is the only reason any of it can be held to a standard. These
 * are the standards.
 */
import { describe, expect, it } from 'vitest';
import {
  CAMERA_MESSAGES,
  FRAME_BUDGET_MS,
  LIVE_WIDTHS,
  SETTLED_DISTANCE,
  advanceLive,
  blendQuad,
  classifyCameraError,
  liveCaption,
  openingQuad,
  quadDistance,
  startingLadder,
  stepLadder,
} from './live';
import type { Pixels, Quad } from './room';

const A: Quad = [
  { x: 0.2, y: 0.5 },
  { x: 0.8, y: 0.5 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];
const B: Quad = [
  { x: 0.3, y: 0.4 },
  { x: 0.7, y: 0.4 },
  { x: 0.9, y: 1 },
  { x: 0.1, y: 1 },
];

describe('the resolution ladder', () => {
  it('starts in the middle, not at the top — a first frame must never stutter', () => {
    const l = startingLadder();
    expect(l.width).toBe(LIVE_WIDTHS[2]);
    expect(l.index).toBeGreaterThan(0);
    expect(l.index).toBeLessThan(LIVE_WIDTHS.length - 1);
  });

  it('does not drop a rung on one slow frame', () => {
    let ladder = startingLadder();
    let run = { slow: 0, fast: 0 };
    const start = ladder.width;
    for (let i = 0; i < 5; i += 1) {
      ({ ladder, run } = stepLadder(ladder, 90, run));
    }
    expect(ladder.width).toBe(start);
  });

  it('drops a rung on a sustained run of slow frames', () => {
    let ladder = startingLadder();
    let run = { slow: 0, fast: 0 };
    for (let i = 0; i < 8; i += 1) ({ ladder, run } = stepLadder(ladder, 90, run));
    expect(ladder.width).toBeLessThan(LIVE_WIDTHS[2]!);
  });

  it('a single fast frame resets the slow run, so it does not drop on noise', () => {
    let ladder = startingLadder();
    let run = { slow: 0, fast: 0 };
    for (let i = 0; i < 5; i += 1) ({ ladder, run } = stepLadder(ladder, 90, run));
    ({ ladder, run } = stepLadder(ladder, 4, run));
    for (let i = 0; i < 5; i += 1) ({ ladder, run } = stepLadder(ladder, 90, run));
    expect(ladder.width).toBe(LIVE_WIDTHS[2]);
  });

  it('climbs only on real headroom, and slowly', () => {
    let ladder = startingLadder();
    let run = { slow: 0, fast: 0 };
    /* At exactly budget there is nothing spare — climbing here would guarantee
       the next rung is over budget and the ladder would oscillate forever. */
    for (let i = 0; i < 40; i += 1) ({ ladder, run } = stepLadder(ladder, FRAME_BUDGET_MS * 0.9, run));
    expect(ladder.width).toBe(LIVE_WIDTHS[2]);
    for (let i = 0; i < 40; i += 1) ({ ladder, run } = stepLadder(ladder, 3, run));
    expect(ladder.width).toBeGreaterThan(LIVE_WIDTHS[2]!);
  });

  it('never walks off either end', () => {
    let ladder = startingLadder();
    let run = { slow: 0, fast: 0 };
    for (let i = 0; i < 500; i += 1) ({ ladder, run } = stepLadder(ladder, 400, run));
    expect(ladder.width).toBe(LIVE_WIDTHS[0]);
    for (let i = 0; i < 2000; i += 1) ({ ladder, run } = stepLadder(ladder, 1, run));
    expect(ladder.width).toBe(LIVE_WIDTHS[LIVE_WIDTHS.length - 1]);
  });
});

describe('the boundary, frame over frame', () => {
  it('alpha 0 holds and alpha 1 jumps', () => {
    expect(blendQuad(A, B, 0)).toEqual(A);
    expect(blendQuad(A, B, 1)).toEqual(B);
  });

  it('clamps a nonsense alpha rather than flying off', () => {
    expect(blendQuad(A, B, -5)).toEqual(A);
    expect(blendQuad(A, B, 12)).toEqual(B);
  });

  it('a blend always lands between the two, never past either', () => {
    const mid = blendQuad(A, B, 0.34);
    for (let i = 0; i < 4; i += 1) {
      const lo = Math.min(A[i]!.x, B[i]!.x);
      const hi = Math.max(A[i]!.x, B[i]!.x);
      expect(mid[i]!.x).toBeGreaterThanOrEqual(lo);
      expect(mid[i]!.x).toBeLessThanOrEqual(hi);
    }
  });

  it('distance is zero for a quad against itself', () => {
    expect(quadDistance(A, A)).toBe(0);
  });

  it('converges in about a quarter of a second, and reports settled when it has', () => {
    let q = A;
    let steps = 0;
    for (; steps < 60; steps += 1) {
      const next = blendQuad(q, B, 0.34);
      const moved = quadDistance(q, next);
      q = next;
      if (moved < SETTLED_DISTANCE) break;
    }
    /* Six frames at 24 fps is a quarter of a second — fast enough to feel
       immediate, slow enough that the boundary does not twitch. */
    expect(steps).toBeLessThan(20);
    expect(quadDistance(q, B)).toBeLessThan(0.02);
  });
});

/* A frame with a wall above and a floor below, with grain. */
function frame(width: number, height: number, horizon = 0.45): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const n = (((x * 7 + y * 13) % 11) - 5) * 1.6;
      if (y / height < horizon) {
        data[i] = 236;
        data[i + 1] = 233;
        data[i + 2] = 228;
      } else {
        data[i] = 150 + n;
        data[i + 1] = 112 + n;
        data[i + 2] = 74 + n;
      }
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

describe('one live step', () => {
  it('the first frame is taken whole — there is nothing to blend against', () => {
    const r = advanceLive(null, frame(320, 240));
    expect(r.settled).toBe(false);
    expect(r.quad.length).toBe(4);
  });

  it('a weak frame barely moves a boundary that was already good', () => {
    /* A frame that is all one surface reads weak: the run never collapses. */
    const flat = frame(320, 240, 0);
    const before = openingQuad();
    const after = advanceLive(before, flat);
    expect(after.confidence).toBe('weak');
    expect(quadDistance(before, after.quad)).toBeLessThan(0.05);
  });

  it('a run of identical frames settles', () => {
    const f = frame(320, 240);
    let q: Quad | null = null;
    let settled = false;
    for (let i = 0; i < 40 && !settled; i += 1) {
      const r = advanceLive(q, f);
      q = r.quad;
      settled = r.settled;
    }
    expect(settled).toBe(true);
  });
});

describe('when the camera does not open', () => {
  it('names the cause rather than shrugging', () => {
    expect(classifyCameraError({ name: 'NotAllowedError' })).toBe('denied');
    expect(classifyCameraError({ name: 'NotFoundError' })).toBe('no-camera');
    expect(classifyCameraError({ name: 'NotReadableError' })).toBe('in-use');
    expect(classifyCameraError({ name: 'TypeError' })).toBe('unsupported');
    expect(classifyCameraError(new Error('boom'))).toBe('unknown');
  });

  it('every cause has a sentence, and every sentence offers the way through', () => {
    for (const [cause, message] of Object.entries(CAMERA_MESSAGES)) {
      expect(message.length, cause).toBeGreaterThan(40);
      /* Upload is the fallback for every single failure, so every message has
         to say so — a dead end is what makes someone leave. */
      expect(/upload|photo/i.test(message), cause).toBe(true);
    }
  });
});

describe('what the live view is allowed to say', () => {
  const reading = (confidence: 'measured' | 'weak', settled: boolean) => ({
    quad: openingQuad(),
    confidence,
    settled,
  });

  it('never claims a measurement', () => {
    const said = [
      liveCaption(reading('weak', false), 0.9),
      liveCaption(reading('measured', false), 0.9),
      liveCaption(reading('measured', true), 0.9),
      liveCaption(reading('measured', true), 0.1),
    ];
    for (const s of said) expect(/measured|accurate|exact|precise/i.test(s)).toBe(false);
  });

  it('asks for what it needs when the reading is weak', () => {
    expect(liveCaption(reading('weak', false), 0.9)).toMatch(/floor/i);
  });

  it('explains a mostly-furniture frame instead of looking broken', () => {
    expect(liveCaption(reading('measured', true), 0.1)).toMatch(/furniture/i);
  });
});
