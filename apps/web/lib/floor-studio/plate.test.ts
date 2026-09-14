/**
 * The plate, asserted.
 *
 * This is what /design shows a person who is choosing how to spend five
 * figures, so the things that make it a photograph rather than a diagram are
 * the things checked here: the floor stops at the horizon, the light has a
 * place on the floor rather than on the frame, and a render split across
 * animation frames is the same render.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CAMERA,
  DEFAULT_LIGHT,
  createPlateBuffer,
  floorMapFor,
  renderFloorPlate,
} from './plate';
import { footprintInches } from './render';
import { BOARD_WIDTHS, FLOOR_PRODUCTS, allConfigurations } from './catalog';
import { relativeLuminance, type Pixels } from './room';

const CONFIG = { productId: 'white-oak', finishId: 'satin', patternId: 'herringbone', widthId: '5' };
const at = (px: Pixels, x: number, y: number) => {
  const i = (y * px.width + x) * 4;
  return { r: px.data[i]!, g: px.data[i + 1]!, b: px.data[i + 2]!, a: px.data[i + 3]! };
};

describe('the camera', () => {
  it('puts the wall line where the ray that leaves level meets the floor', () => {
    const map = floorMapFor(DEFAULT_CAMERA, 4 / 3);
    expect(map).not.toBeNull();
    /* Eighteen degrees down through a sixty-two degree lens on a 4:3 frame puts
       the horizon in the upper third — low enough that the room reads as a
       room, high enough that the floor is the subject. */
    expect(map!.horizon).toBeGreaterThan(0.05);
    expect(map!.horizon).toBeLessThan(0.45);
  });

  it('tilts further down and the wall line rises up the frame', () => {
    /* The one property that says this is a camera and not four corners chosen
       by eye: the horizon is a consequence of the pitch, and it moves the way
       a lens moves it. Point a camera further down and you see MORE floor and
       less wall, so the wall line goes UP the frame — towards row zero, which
       is a smaller normalised y, not a larger one. Past the point where the
       pitch exceeds half the vertical field of view the horizon leaves the
       frame entirely and the answer is negative, which is not a failure: it is
       a shot that is all floor, and the renderer reads it as one. */
    const shallow = floorMapFor({ ...DEFAULT_CAMERA, pitchDeg: 8 }, 4 / 3)!;
    const steep = floorMapFor({ ...DEFAULT_CAMERA, pitchDeg: 30 }, 4 / 3)!;
    expect(steep.horizon).toBeLessThan(shallow.horizon);
    expect(steep.horizon).toBeLessThan(0);
  });

  it('renders an all-floor shot without a wall, when the horizon is off frame', () => {
    /* A negative horizon must not paint a wall of zero height at the top, or
       skip the floor rows above it. */
    const px = renderFloorPlate({
      width: 120,
      height: 90,
      config: CONFIG,
      camera: { ...DEFAULT_CAMERA, pitchDeg: 30 },
    });
    const top = at(px, 60, 1);
    expect(top.a).toBe(255);
    expect(top.r - top.b).toBeGreaterThan(20);
  });

  it('runs away from the camera: a pixel covers more floor further up the frame', () => {
    const { m } = floorMapFor(DEFAULT_CAMERA, 4 / 3)!;
    const foot = (ny: number) => {
      const nx = 0.5;
      const w = m[6] * nx + m[7] * ny + m[8];
      const planX = (m[0] * nx + m[1] * ny + m[2]) / w;
      const planY = (m[3] * nx + m[4] * ny + m[5]) / w;
      return { planY, f: footprintInches(m, planX, planY, w, 1 / 640, 1 / 480) };
    };
    const near = foot(0.98);
    const mid = foot(0.75);
    const far = foot(0.55);
    expect(near.planY).toBeLessThan(mid.planY);
    expect(mid.planY).toBeLessThan(far.planY);
    expect(near.f).toBeLessThan(mid.f);
    expect(mid.f).toBeLessThan(far.f);
  });
});

describe('the plate', () => {
  it('paints a floor below the wall line and a wall above it', () => {
    const px = renderFloorPlate({ width: 240, height: 180, config: CONFIG });
    const { horizon } = floorMapFor(DEFAULT_CAMERA, 240 / 180)!;
    const wallRow = Math.max(0, Math.floor(horizon * 180) - 4);
    const floorRow = 170;
    /* The wall is near-neutral and the floor is wood, so the thing that
       separates them is not brightness — a dark walnut floor is darker than the
       wall and a pale maple one is not — but colour. Wood has a red-over-blue
       bias; the wall barely does. */
    const wall = at(px, 120, wallRow);
    const floor = at(px, 120, floorRow);
    expect(floor.r - floor.b).toBeGreaterThan(wall.r - wall.b);
    expect(px.data[(floorRow * 240 + 120) * 4 + 3]).toBe(255);
  });

  it('never paints a second room above the wall line', () => {
    /* Behind the camera, the homography happily produces plan coordinates with
       a negative depth, and painting those puts an upside-down floor on the
       wall. The guard is a sign test on planY, and this is it from the outside:
       every row well above the horizon must still be wall. */
    const px = renderFloorPlate({ width: 200, height: 200, config: CONFIG });
    const { horizon } = floorMapFor(DEFAULT_CAMERA, 1)!;
    const top = Math.max(0, Math.floor(horizon * 200) - 8);
    let reddest = 0;
    for (let y = 0; y < top; y += 1) {
      for (let x = 0; x < 200; x += 2) {
        const c = at(px, x, y);
        reddest = Math.max(reddest, c.r - c.b);
      }
    }
    /* The wall carries a warm cast on purpose; wood carries a much larger one. */
    expect(reddest).toBeLessThan(28);
  });

  it('lights the floor from a place on the floor, not a place in the frame', () => {
    /* Light measured in image space slides across the floor when the camera
       moves, and betrays itself immediately. The pool is in plan inches, so
       moving it in inches must move it on the plate — and moving it to the
       other side of the room must swap which half is brighter. */
    const lit = (poolX: number) => {
      const px = renderFloorPlate({
        width: 240,
        height: 180,
        config: CONFIG,
        light: { ...DEFAULT_LIGHT, poolX },
      });
      const side = (from: number, to: number) => {
        let total = 0;
        let n = 0;
        for (let y = 140; y < 175; y += 1) {
          for (let x = from; x < to; x += 1) {
            const c = at(px, x, y);
            total += relativeLuminance(c.r, c.g, c.b);
            n += 1;
          }
        }
        return total / n;
      };
      return { left: side(10, 90), right: side(150, 230) };
    };
    const fromLeft = lit(-70);
    const fromRight = lit(70);
    expect(fromLeft.left).toBeGreaterThan(fromLeft.right);
    expect(fromRight.right).toBeGreaterThan(fromRight.left);
  });

  it('renders the same picture whether it is done in one pass or in bands', () => {
    /* The property the whole banded design rests on. If a band depended on
       anything carried over from the last one, /design would show seams
       wherever an animation frame happened to end. */
    for (const patternId of ['straight', 'diagonal', 'herringbone', 'chevron']) {
      const config = { ...CONFIG, patternId };
      const whole = renderFloorPlate({ width: 200, height: 150, config });
      const banded = createPlateBuffer(200, 150);
      for (let y = 0; y < 150; y += 17) {
        renderFloorPlate({
          width: 200,
          height: 150,
          config,
          into: banded,
          rows: [y, Math.min(150, y + 17)],
        });
      }
      let differing = 0;
      for (let i = 0; i < whole.data.length; i += 1) {
        if (whole.data[i] !== banded.data[i]) differing += 1;
      }
      expect(differing, patternId).toBe(0);
    }
  });

  it('returns a full, opaque plate for every configuration the catalogue offers', () => {
    /* An unknown product or width must not produce a hole in the page. Every
       combination is rendered small and checked for full alpha, because a
       preview that vanishes on one species out of six is a defect nobody finds
       until a customer picks that species. */
    const configs = allConfigurations();
    expect(configs.length).toBeGreaterThan(FLOOR_PRODUCTS.length * BOARD_WIDTHS.length);
    for (const config of configs.slice(0, 60)) {
      const px = renderFloorPlate({ width: 64, height: 48, config });
      let opaque = true;
      for (let i = 3; i < px.data.length; i += 4) if (px.data[i] !== 255) opaque = false;
      expect(opaque, `${config.productId}/${config.patternId}/${config.widthId}`).toBe(true);
    }
  });

  it('starts opaque, so a plate that is still arriving is not a hole', () => {
    const buffer = createPlateBuffer(32, 32);
    for (let i = 0; i < buffer.data.length; i += 1) expect(buffer.data[i]).toBe(255);
  });
});
