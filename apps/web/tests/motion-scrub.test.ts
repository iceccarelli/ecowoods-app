/**
 * tests/motion-scrub.test.ts — the one mouse-X → frame-index calculation
 * StoryboardHover, RotatingTile, and the FloorCatalog/MachineCatalog active
 * card + lightbox stage all import instead of each carrying their own copy
 * (MOTION-01b). Pure functions, no DOM.
 */
import { describe, it, expect } from 'vitest';
import { frameIndexFromMouseX, isHoverPointer, tickLeftPercent } from '@/app/components/motion/scrub';

describe('frameIndexFromMouseX', () => {
  it('maps the left edge to frame 0 and the right edge to the last frame', () => {
    expect(frameIndexFromMouseX(0, 0, 300, 3)).toBe(0);
    expect(frameIndexFromMouseX(299, 0, 300, 3)).toBe(2);
  });
  it('divides the width evenly across frames', () => {
    // 300px / 3 frames = 100px each: [0,100) -> 0, [100,200) -> 1, [200,300) -> 2
    expect(frameIndexFromMouseX(50, 0, 300, 3)).toBe(0);
    expect(frameIndexFromMouseX(150, 0, 300, 3)).toBe(1);
    expect(frameIndexFromMouseX(250, 0, 300, 3)).toBe(2);
  });
  it('clamps a pointer that has strayed outside the rect', () => {
    expect(frameIndexFromMouseX(-500, 0, 300, 3)).toBe(0);
    expect(frameIndexFromMouseX(5000, 0, 300, 3)).toBe(2);
  });
  it('respects a rect that does not start at x=0', () => {
    expect(frameIndexFromMouseX(120, 100, 300, 3)).toBe(0);
    expect(frameIndexFromMouseX(220, 100, 300, 3)).toBe(1);
    expect(frameIndexFromMouseX(399, 100, 300, 3)).toBe(2);
  });
  it('never divides by zero or returns a negative index for degenerate input', () => {
    expect(frameIndexFromMouseX(50, 0, 0, 3)).toBe(0);
    expect(frameIndexFromMouseX(50, 0, 300, 0)).toBe(0);
  });
  it('is stable across frame counts of any size, not just 3', () => {
    expect(frameIndexFromMouseX(0, 0, 600, 6)).toBe(0);
    expect(frameIndexFromMouseX(599, 0, 600, 6)).toBe(5);
    expect(frameIndexFromMouseX(300, 0, 600, 6)).toBe(3);
  });
});

describe('isHoverPointer', () => {
  it('treats mouse and pen as hover-capable', () => {
    expect(isHoverPointer('mouse')).toBe(true);
    expect(isHoverPointer('pen')).toBe(true);
  });
  it('is a no-op for touch — the whole point of checking pointerType', () => {
    expect(isHoverPointer('touch')).toBe(false);
  });
  it('rejects anything else rather than defaulting to true', () => {
    expect(isHoverPointer('')).toBe(false);
    expect(isHoverPointer('unknown')).toBe(false);
  });
});

describe('tickLeftPercent', () => {
  it('places the first frame at 0% and the last at 100%', () => {
    expect(tickLeftPercent(0, 3)).toBe(0);
    expect(tickLeftPercent(2, 3)).toBe(100);
  });
  it('does not divide by zero for a single-frame set', () => {
    expect(tickLeftPercent(0, 1)).toBe(0);
  });
});
