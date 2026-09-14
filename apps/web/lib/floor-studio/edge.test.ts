/**
 * lib/floor-studio/edge.test.ts — CAM-01, the edge the visitor sees.
 *
 * WHAT WAS WRONG
 *
 * buildFloorMask decides floor-or-object for an 8×8 CELL, closes the result,
 * and then dilates once more for margin. compositeFloor then painted strictly
 * by that cell answer:
 *
 *     if (mask.floor[cell] !== 1) continue;
 *
 * So every boundary in the output was quantised to eight pixels and pushed a
 * further cell outward. Measured against objects whose edges are known by
 * construction, that left a band of the ORIGINAL floor 16px wide against a
 * vertical edge and up to 39px against a 45° one, stepping between twenty
 * distinct offsets down the frame. That band is the halo around every sofa,
 * rug and chair leg, and it is what reads as "blocky".
 *
 * These fixtures are the instrument that measured it. Their numbers are
 * asserted rather than described, so the improvement cannot quietly rot.
 *
 * WHY THE NUMBERS ARE BOUNDS AND NOT EQUALITIES
 *
 * A tighter edge is always welcome and must not fail the suite. A looser one
 * is a regression and must. So every assertion is an upper bound, and the
 * baseline it replaced is written beside it.
 */
import { describe, expect, it } from 'vitest';
import { compositeFloor, buildFloorMask } from './render';
import type { Pixels, Quad } from './room';

const W = 480;
const H = 320;

const put = (px: Pixels, x: number, y: number, rgb: [number, number, number]) => {
  const i = (y * px.width + x) * 4;
  px.data[i] = rgb[0];
  px.data[i + 1] = rgb[1];
  px.data[i + 2] = rgb[2];
  px.data[i + 3] = 255;
};

/** Wall above, oak floor below, with grain — a flat field would test nothing. */
function room(): Pixels {
  const px: Pixels = { data: new Uint8ClampedArray(W * H * 4), width: W, height: H };
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const ny = y / H;
      if (ny < 0.45) put(px, x, y, [236, 233, 228]);
      else {
        const d = 1 - 0.18 * (1 - ny);
        const n = (((x * 7 + y * 13) % 11) - 5) * 1.6;
        put(px, x, y, [150 * d + n, 112 * d + n, 74 * d + n]);
      }
    }
  }
  return px;
}

const NAVY: [number, number, number] = [38, 44, 72];
const QUAD: Quad = [
  { x: 0.18, y: 0.46 },
  { x: 0.82, y: 0.46 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];
const CFG = { productId: 'white-oak', finishId: 'satin', patternId: 'straight', widthId: '5' };

type EdgeReport = { gap: number; worst: number; jitter: number };

/**
 * Paint the room, then for each row find the last pixel the renderer changed
 * as it approaches the object. The distance from there to the object's KNOWN
 * edge is the band of old floor left behind.
 */
function measure(
  paint: (px: Pixels) => void,
  truthX: (y: number) => number,
  y0: number,
  y1: number,
): EdgeReport {
  const px = room();
  paint(px);
  const orig = Uint8ClampedArray.from(px.data);
  const out = compositeFloor(px, QUAD, CFG, { squareFeet: 400 }).pixels;

  const changed = (x: number, y: number): boolean => {
    const i = (y * W + x) * 4;
    return (
      Math.abs(out.data[i]! - orig[i]!) +
        Math.abs(out.data[i + 1]! - orig[i + 1]!) +
        Math.abs(out.data[i + 2]! - orig[i + 2]!) >
      12
    );
  };

  const devs: number[] = [];
  for (let y = y0 + 4; y < y1 - 4; y += 1) {
    const t = truthX(y);
    if (t < 40 || t > W - 40) continue;
    let last = -1;
    for (let x = Math.max(2, t - 70); x < Math.min(W - 2, t + 40); x += 1) if (changed(x, y)) last = x;
    if (last > 0) devs.push(Math.abs(last + 1 - t));
  }
  expect(devs.length, 'the fixture produced no measurable rows').toBeGreaterThan(40);

  const steps: number[] = [];
  for (let i = 1; i < devs.length; i += 1) steps.push(Math.abs(devs[i]! - devs[i - 1]!));
  return {
    gap: devs.reduce((a, b) => a + b, 0) / devs.length,
    worst: Math.max(...devs),
    jitter: steps.reduce((a, b) => a + b, 0) / (steps.length || 1),
  };
}

describe('CAM-01 — the band of old floor left around an object', () => {
  /* Baseline before the per-pixel refinement: gap 16.0px, worst 16px. */
  it('is under two pixels against a vertical edge (was 16)', () => {
    const r = measure(
      (px) => {
        for (let y = Math.round(0.55 * H); y < Math.round(0.95 * H); y += 1)
          for (let x = Math.round(0.5 * W); x < Math.round(0.68 * W); x += 1) put(px, x, y, NAVY);
      },
      () => Math.round(0.5 * W),
      Math.round(0.55 * H),
      Math.round(0.95 * H),
    );
    expect(r.gap).toBeLessThan(2);
    expect(r.worst).toBeLessThanOrEqual(3);
  });

  /* Baseline: gap 34.6px, worst 39px, jitter 1.66px/row across 20 offsets. */
  it('is under two pixels against a 45° edge, and stops stepping (was 34.6)', () => {
    const r = measure(
      (px) => {
        for (let y = Math.round(0.5 * H); y < Math.round(0.98 * H); y += 1) {
          const e = Math.round(0.3 * W + (y - 0.5 * H));
          for (let x = e; x < e + 80; x += 1) if (x < W) put(px, x, y, NAVY);
        }
      },
      (y) => Math.round(0.3 * W + (y - 0.5 * H)),
      Math.round(0.5 * H),
      Math.round(0.98 * H),
    );
    expect(r.gap).toBeLessThan(2);
    expect(r.worst).toBeLessThanOrEqual(8);
    /* The staircase itself: how far the boundary jumps from one row to the
       next. A per-pixel edge on a straight line barely moves. */
    expect(r.jitter).toBeLessThan(0.6);
  });

  /* Baseline: gap 23.2px, worst 29px — the angle a sofa front actually makes. */
  it('is under two pixels against a shallow 18° edge (was 23.2)', () => {
    const r = measure(
      (px) => {
        for (let y = Math.round(0.5 * H); y < Math.round(0.98 * H); y += 1) {
          const e = Math.round(0.28 * W + (y - 0.5 * H) * 0.32);
          for (let x = e; x < e + 80; x += 1) if (x < W) put(px, x, y, NAVY);
        }
      },
      (y) => Math.round(0.28 * W + (y - 0.5 * H) * 0.32),
      Math.round(0.5 * H),
      Math.round(0.98 * H),
    );
    expect(r.gap).toBeLessThan(2);
    expect(r.worst).toBeLessThanOrEqual(4);
  });
});

describe('CAM-01 — the refinement is bounded to the boundary', () => {
  const objectRoom = (): Pixels => {
    const px = room();
    for (let y = Math.round(0.55 * H); y < Math.round(0.9 * H); y += 1)
      for (let x = Math.round(0.4 * W); x < Math.round(0.6 * W); x += 1) put(px, x, y, NAVY);
    return px;
  };

  it('marks no boundary band at all on an empty floor', () => {
    const mask = buildFloorMask(room(), QUAD, {});
    let band = 0;
    for (let i = 0; i < mask.edge.length; i += 1) if (mask.edge[i] === 1) band += 1;
    expect(band).toBe(0);
  });

  it('marks a band around an object, and not the whole quad', () => {
    const mask = buildFloorMask(objectRoom(), QUAD, {});
    let band = 0;
    let inside = 0;
    for (let i = 0; i < mask.edge.length; i += 1) {
      if (mask.inside[i] === 1) inside += 1;
      if (mask.edge[i] === 1) band += 1;
    }
    expect(band).toBeGreaterThan(0);
    expect(band / inside, 'the band must not be the whole quad').toBeLessThan(0.6);
  });

  /**
   * WHERE THE OBJECT-PROTECTION GUARD FOR THIS LIVES, AND WHY NOT HERE.
   *
   * The refinement may never be more permissive than the cell rule it refines.
   * The first version of it consulted chroma and then RETURNED, skipping the
   * luminance test — and the two objects in the fourteen-object fixture whose
   * colour is closest to wood immediately started losing their edges: the
   * cream/jute rug went to 6.3% of its pixels painted, the brass lamp base to
   * 14.9%. audit.test.ts caught both, and still does: reintroducing that early
   * return fails AUDIT-01 · AV-01 today.
   *
   * A fixture for it was drafted here and then deleted rather than shipped.
   * It could not be made to fail. A synthetic object in wood's own hue is
   * either far enough from the floor's brightness that every version protects
   * it, or close enough that every version paints it — measured at four
   * brightness levels, the transition is a step with no window in between, so
   * the test passed under the mutation as readily as under the fix. A test
   * that cannot fail is not a weaker guard than AUDIT-01; it is decoration
   * that would make someone believe this file guards something it does not.
   */

  /* The refinement reuses the statistics the cell decision was made with. If
     it ever grew its own, it would be a second mask with no tests. */
  it('publishes the statistics the cell decision used', () => {
    const mask = buildFloorMask(objectRoom(), QUAD, {});
    expect(mask.stats.sigma).toBeGreaterThan(0);
    expect(mask.stats.chromaTol).toBeGreaterThan(0);
    expect(mask.stats.lumK).toBeGreaterThan(0);
    expect(mask.stats.profile.length).toBe(mask.rows);
  });
});
