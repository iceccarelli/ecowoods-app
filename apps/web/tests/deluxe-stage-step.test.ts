/**
 * tests/deluxe-stage-step.test.ts — the step classifier behind DeluxeStage's
 * settle (MOTION-01c). This is the logic that decides whether an index
 * change slides one card with an overshoot, wraps through a clone and
 * silently snaps, or jumps instantly with no animation at all — the exact
 * bug 01c fixes (wrap and far jumps used to fly across the whole deck).
 * Pure function, no DOM, so the wrap targets and far-snap behaviour are
 * locked down without a browser.
 */
import { describe, it, expect } from 'vitest';
import { classifyIndexStep, isWrapKind } from '@/app/components/motion/DeluxeStage';

describe('classifyIndexStep', () => {
  const N = 12;

  it('classifies an ordinary forward step as adjacent', () => {
    expect(classifyIndexStep(3, 4, N, true)).toEqual({ kind: 'adjacent', direction: 1 });
  });
  it('classifies an ordinary backward step as adjacent', () => {
    expect(classifyIndexStep(4, 3, N, true)).toEqual({ kind: 'adjacent', direction: -1 });
  });
  it('classifies the last-to-first step as a forward wrap when looping', () => {
    expect(classifyIndexStep(N - 1, 0, N, true)).toEqual({ kind: 'wrap-forward', direction: 1 });
  });
  it('classifies the first-to-last step as a backward wrap when looping', () => {
    expect(classifyIndexStep(0, N - 1, N, true)).toEqual({ kind: 'wrap-backward', direction: -1 });
  });
  it('treats the same last/first step as a far jump when not looping', () => {
    expect(classifyIndexStep(N - 1, 0, N, false)).toEqual({ kind: 'far', direction: 0 });
    expect(classifyIndexStep(0, N - 1, N, false)).toEqual({ kind: 'far', direction: 0 });
  });
  it('classifies a distant jump (a dot click) as far, looping or not', () => {
    expect(classifyIndexStep(0, 6, N, true)).toEqual({ kind: 'far', direction: 0 });
    expect(classifyIndexStep(0, 6, N, false)).toEqual({ kind: 'far', direction: 0 });
    expect(classifyIndexStep(11, 2, N, true)).toEqual({ kind: 'far', direction: 0 });
  });
  it('classifies no change as none regardless of loop', () => {
    expect(classifyIndexStep(5, 5, N, true)).toEqual({ kind: 'none', direction: 0 });
    expect(classifyIndexStep(5, 5, N, false)).toEqual({ kind: 'none', direction: 0 });
  });
  it('never classifies a wrap on a 1-item or 0-item deck', () => {
    expect(classifyIndexStep(0, 0, 1, true)).toEqual({ kind: 'none', direction: 0 });
    expect(classifyIndexStep(0, 0, 0, true)).toEqual({ kind: 'none', direction: 0 });
  });
  it('does not misclassify a 2-item deck\'s only step as a wrap', () => {
    // With N=2, index 0 -> 1 is both "adjacent" (0+1=1) and would also read
    // as a boundary — adjacent must win, since it's a real single-step
    // move, not a wrap through a clone.
    expect(classifyIndexStep(0, 1, 2, true)).toEqual({ kind: 'adjacent', direction: 1 });
    expect(classifyIndexStep(1, 0, 2, true)).toEqual({ kind: 'adjacent', direction: -1 });
  });
});

describe('isWrapKind', () => {
  it('is true only for the two wrap kinds', () => {
    expect(isWrapKind('wrap-forward')).toBe(true);
    expect(isWrapKind('wrap-backward')).toBe(true);
  });
  it('is false for adjacent, far and none', () => {
    expect(isWrapKind('adjacent')).toBe(false);
    expect(isWrapKind('far')).toBe(false);
    expect(isWrapKind('none')).toBe(false);
  });
});
