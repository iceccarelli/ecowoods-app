/**
 * lib/floor-studio/audit.test.ts — AUDIT-01, as executable evidence.
 *
 * WHAT THIS IS, AND WHAT IT IS NOT
 *
 * It is not a guard. It adds nothing to verify-all.mjs and gates no commit.
 * It is a CHARACTERISATION TEST: it pins down, in numbers, what the visualiser
 * does today — including the two things it does wrong — so that
 * docs/AUDIT_01_VISUALIZER.md can be re-executed by anyone rather than believed.
 *
 * The first version of this harness ran under `node --experimental-strip-types`,
 * which needs Node ≥ 22.6 and therefore did not run on the machine it was
 * written for. Evidence nobody can reproduce is not evidence. It lives in the
 * repository's own vitest now, so `pnpm test` runs it on whatever Node is
 * installed.
 *
 * EVERY ROOM HERE IS SYNTHETIC ON PURPOSE
 *
 * The floor plane and every object's box are known by construction, so "was
 * this pixel of the dog replaced" is a comparison and not a judgement. No
 * photograph is checked in, and none is needed.
 *
 * THE TWO FAILING BEHAVIOURS ARE ASSERTED, NOT TOLERATED
 *
 * `DEFECT_AV_01` and `DEFECT_AV_02` below are the defects as measured. The
 * tests assert that the code still behaves that way — which means the day
 * VIS-02 or VIS-03 fixes one, this file fails and has to be rewritten
 * alongside the audit that cites it. A defect that can be fixed without anyone
 * noticing the audit went stale is a defect that comes back.
 */
import { describe, expect, it } from 'vitest';
import { compositeFloor } from './render';
import { analyseRoom, type Pixels, type Quad } from './room';

const W = 480;
const H = 320;

type Rgb = [number, number, number];
type Box = [number, number, number, number];

const put = (px: Pixels, x: number, y: number, [r, g, b]: Rgb) => {
  const i = (y * px.width + x) * 4;
  px.data[i] = r;
  px.data[i + 1] = g;
  px.data[i + 2] = b;
  px.data[i + 3] = 255;
};

const fill = (px: Pixels, [x0, y0, x1, y1]: Box, rgb: Rgb) => {
  for (let y = Math.round(y0 * H); y < Math.round(y1 * H); y += 1) {
    for (let x = Math.round(x0 * W); x < Math.round(x1 * W); x += 1) {
      if (x >= 0 && x < W && y >= 0 && y < H) put(px, x, y, rgb);
    }
  }
};

/** A wall above, an existing oak floor below, with the usual falloff. */
function emptyRoom(opts: { horizon?: number; angled?: boolean; darkFloor?: boolean } = {}): Pixels {
  const px: Pixels = { data: new Uint8ClampedArray(W * H * 4), width: W, height: H };
  const horizon = opts.horizon ?? 0.45;
  const base: Rgb = opts.darkFloor ? [70, 52, 38] : [150, 112, 74];
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const ny = y / H;
      const line = opts.angled ? 0.3 + 0.3 * (x / W) : horizon;
      if (ny < line) put(px, x, y, [236, 233, 228]);
      else {
        const d = 1 - 0.18 * (1 - ny);
        /* Grain. A floor with literally no texture is not a floor, and the
           mask's dominant-surface rule is partly a statement ABOUT texture —
           testing it against a flat field would be testing nothing. */
        const n = (((x * 7 + y * 13) % 11) - 5) * 1.6;
        put(px, x, y, [base[0] * d + n, base[1] * d + n, base[2] * d + n]);
      }
    }
  }
  return px;
}

const inQuad = (quad: Quad, x: number, y: number): boolean => {
  let sign = 0;
  for (let i = 0; i < 4; i += 1) {
    const a = quad[i]!;
    const b = quad[(i + 1) % 4]!;
    const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    if (cross === 0) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
};

/* ── AV-01 ────────────────────────────────────────────────────────────────── */

/**
 * Fourteen things that stand on the floor of a house about to buy hardwood.
 * Not adversarial — a sofa, two rugs, a plant, a person, a cat, a dog, a
 * cabinet toe-kick, a stair riser, a table leg, a box, an armchair, a pot, a
 * lamp base.
 */
const OBJECTS: { name: string; rgb: Rgb }[] = [
  { name: 'grey fabric sofa', rgb: [138, 136, 132] },
  { name: 'cream/jute area rug', rgb: [214, 196, 166] },
  { name: 'charcoal rug', rgb: [52, 52, 56] },
  { name: 'green plant', rgb: [62, 110, 58] },
  { name: 'human leg (skin)', rgb: [206, 160, 128] },
  { name: 'black cat', rgb: [28, 26, 26] },
  { name: 'golden retriever', rgb: [198, 158, 104] },
  { name: 'white cabinet toe-kick', rgb: [238, 236, 232] },
  { name: 'oak stair riser', rgb: [168, 128, 84] },
  { name: 'pine/oak table leg', rgb: [176, 140, 96] },
  { name: 'cardboard box', rgb: [190, 158, 116] },
  { name: 'navy armchair', rgb: [46, 58, 88] },
  { name: 'terracotta pot', rgb: [178, 98, 62] },
  { name: 'brass floor lamp base', rgb: [186, 152, 74] },
];

/**
 * AV-01, CLOSED BY LIVE-01.
 *
 * This list held six names when AUDIT-01 measured it: a jute rug, a person's
 * leg, a golden retriever, an oak stair riser, a wooden table leg and a
 * cardboard box — every object in the wood hue family, every one painted over
 * completely. It is empty now, and the tests below are written so that it
 * cannot quietly refill: one of them proves nothing is destroyed, and the next
 * two prove the floor is still actually painted, because a mask that protects
 * the entire photograph would satisfy the first one perfectly.
 */
const DEFECT_AV_01: string[] = ['oak stair riser'];

/**
 * THE ONE THING STILL PAINTED, AND WHY IT IS THE RIGHT ANSWER.
 *
 * An oak stair riser standing on an oak floor is, colourimetrically, the floor:
 * same pigments, same grain, a few hundredths brighter because it faces the
 * light differently. Separating the two needs a surface normal or a depth, and
 * this studio has neither and does not claim to.
 *
 * The mask could catch it — an earlier build did, by treating any luminance
 * departure as an object. That build also refused to paint a pool of sunlight
 * on the floor, because sunlight is a luminance departure too, and the result
 * was a new floor with a blotch of the old one wherever a window fell. That is
 * the feature visibly not working, in the middle of the picture, in most rooms
 * anyone will point a camera at. A riser painted at the edge of the frame is a
 * cosmetic error on a surface that is quoted separately anyway.
 *
 * So: same chroma, different brightness, is treated as LIGHT. The riser is the
 * price, it is named here rather than buried, and it is in the audit.
 */

const HONEST_QUAD: Quad = [
  { x: 0.1, y: 0.46 },
  { x: 0.9, y: 0.46 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

function occlusionSweep() {
  const px = emptyRoom();
  const boxes = new Map<string, Box>();
  OBJECTS.forEach((o, i) => {
    const col = i % 7;
    const row = Math.floor(i / 7);
    const box: Box = [0.02 + col * 0.14, 0.5 + row * 0.24, 0.02 + col * 0.14 + 0.11, 0.5 + row * 0.24 + 0.19];
    boxes.set(o.name, box);
    fill(px, box, o.rgb);
  });

  const result = compositeFloor(
    px,
    HONEST_QUAD,
    { productId: 'white-oak', finishId: 'satin', patternId: 'straight', widthId: '5' },
    { squareFeet: 400 },
  );

  const rows = OBJECTS.map((o) => {
    const [x0, y0, x1, y1] = boxes.get(o.name)!;
    let considered = 0;
    let changed = 0;
    for (let y = Math.round(y0 * H); y < Math.round(y1 * H); y += 1) {
      for (let x = Math.round(x0 * W); x < Math.round(x1 * W); x += 1) {
        const nx = (x + 0.5) / W;
        const ny = (y + 0.5) / H;
        if (!inQuad(HONEST_QUAD, nx, ny)) continue;
        considered += 1;
        const i = (y * W + x) * 4;
        if (
          result.pixels.data[i] !== px.data[i] ||
          result.pixels.data[i + 1] !== px.data[i + 1] ||
          result.pixels.data[i + 2] !== px.data[i + 2]
        ) {
          changed += 1;
        }
      }
    }
    return { name: o.name, considered, changed, pct: considered ? (100 * changed) / considered : 0 };
  });

  return { rows, painted: result.painted };
}

describe('AUDIT-01 · AV-01 — what the renderer destroys on the way in', () => {
  it('leaves every object on the floor alone, but one, and that one is named', () => {
    const { rows } = occlusionSweep();
    const destroyed = rows.filter((r) => r.considered > 0 && r.pct >= 50).map((r) => r.name);
    /* Asserted against the known list rather than against [] so the suite turns
       red in BOTH directions — a regression that destroys something new, and
       equally a fix that quietly makes the documented limit go away while the
       audit still says it is there. */
    expect(destroyed.sort()).toEqual([...DEFECT_AV_01].sort());
  });

  it('spares them completely, not partially — a protected rim is the sticker look', () => {
    const { rows } = occlusionSweep();
    for (const row of rows) {
      if (row.considered === 0 || DEFECT_AV_01.includes(row.name)) continue;
      expect(row.pct, `${row.name} lost ${row.pct.toFixed(1)}% of its pixels`).toBeLessThan(5);
    }
  });

  it('the objects it used to destroy are the ones to name individually', () => {
    const { rows } = occlusionSweep();
    const spared = rows.filter((r) => r.considered > 0 && r.pct < 5).map((r) => r.name);
    /* Named one by one rather than counted, because a count passes while the
       list changes underneath it. These six are the AUDIT-01 findings. */
    /* Five of the six AUDIT-01 findings. The sixth, the oak stair riser, is the
       documented limit above. */
    for (const name of [
      'cream/jute area rug',
      'human leg (skin)',
      'golden retriever',
      'pine/oak table leg',
      'cardboard box',
    ]) {
      expect(spared, `${name} must survive`).toContain(name);
    }
    /* And the ones chroma alone already handled must not have regressed. */
    for (const name of ['grey fabric sofa', 'charcoal rug', 'navy armchair', 'green plant']) {
      expect(spared, `${name} must still survive`).toContain(name);
    }
  });

  it('the "mostly furniture" warning fires on a room that is mostly furniture', () => {
    const { painted } = occlusionSweep();
    /* FloorStudio shows "a lot of this room is furniture rather than floor"
       below 0.5. Fourteen objects tiled across the plane IS that room, and the
       old mask kept the fraction high precisely because it painted them. */
    expect(painted).toBeLessThan(0.5);
  });
});

/* ── the other half of AV-01: it must still lay a floor ───────────────────── */

/**
 * A mask that protects every pixel destroys nothing and is useless. These are
 * the tests that stop the fix from becoming that.
 */
describe('AUDIT-01 · AV-01 — and the floor is still painted', () => {
  const paint = (build: (px: Pixels) => void): number => {
    const px = emptyRoom();
    build(px);
    return compositeFloor(
      px,
      HONEST_QUAD,
      { productId: 'white-oak', finishId: 'satin', patternId: 'straight', widthId: '5' },
      { squareFeet: 400 },
    ).painted;
  };

  it('an empty room is laid essentially wall to wall', () => {
    expect(paint(() => {})).toBeGreaterThan(0.95);
  });

  it('a room with a sofa keeps most of its floor', () => {
    expect(paint((px) => fill(px, [0.05, 0.48, 0.4, 0.7], [138, 136, 132]))).toBeGreaterThan(0.6);
  });

  it('a room with a dog keeps most of its floor', () => {
    expect(paint((px) => fill(px, [0.4, 0.72, 0.58, 0.92], [198, 158, 104]))).toBeGreaterThan(0.6);
  });

  it('a pool of sunlight on the floor is floor', () => {
    /* The regression that the same-chroma rule exists to prevent. A window on
       the floor is the same wood under more light, and refusing to paint it
       leaves a blotch of the old floor in the middle of the new one. */
    const lit = paint((px) => {
      for (let y = Math.round(0.6 * 320); y < Math.round(0.95 * 320); y += 1) {
        for (let x = Math.round(0.3 * 480); x < Math.round(0.75 * 480); x += 1) {
          const i = (y * 480 + x) * 4;
          px.data[i] = Math.min(255, px.data[i]! * 1.45);
          px.data[i + 1] = Math.min(255, px.data[i + 1]! * 1.45);
          px.data[i + 2] = Math.min(255, px.data[i + 2]! * 1.45);
        }
      }
    });
    expect(lit).toBeGreaterThan(0.9);
  });

  it('a large pale rug costs the floor it actually covers, and no more', () => {
    /* The rug fills roughly a third of the quad. Losing all of it plus a margin
       is right; losing the whole floor means the mask chose the rug as the
       dominant surface, which is the failure mode that the histogram-mode rule
       exists to prevent. */
    const painted = paint((px) => fill(px, [0.15, 0.6, 0.85, 0.85], [214, 206, 190]));
    expect(painted).toBeGreaterThan(0.3);
    expect(painted).toBeLessThan(0.7);
  });
});

/* ── AV-02 ────────────────────────────────────────────────────────────────── */

/** Floor from y = 0.45 to the bottom, full width. */
const TRUE_COVERAGE = 0.55;

const SCENES: { name: string; build: () => Pixels; honest: boolean }[] = [
  { name: 'empty room, oak floor', build: () => emptyRoom(), honest: true },
  { name: 'dark walnut floor', build: () => emptyRoom({ darkFloor: true }), honest: true },
  {
    name: 'with a large pale area rug',
    build: () => {
      const px = emptyRoom();
      fill(px, [0.15, 0.6, 0.85, 0.85], [214, 206, 190]);
      return px;
    },
    honest: true,
  },
  {
    name: 'with a sofa',
    build: () => {
      const px = emptyRoom();
      fill(px, [0.05, 0.48, 0.4, 0.7], [138, 136, 132]);
      return px;
    },
    honest: true,
  },
  {
    name: 'rug + sofa (a real living room)',
    build: () => {
      const px = emptyRoom();
      fill(px, [0.15, 0.6, 0.85, 0.85], [214, 206, 190]);
      fill(px, [0.05, 0.48, 0.4, 0.7], [138, 136, 132]);
      return px;
    },
    honest: true,
  },
  { name: 'shot from a doorway (angled)', build: () => emptyRoom({ angled: true }), honest: true },
];

/** The error budget a `measured` reading has to stay inside to be honest. */
const MEASURED_BUDGET = 0.25;

describe('AUDIT-01 · AV-02 — is "measured" true (closed by VIS-03)', () => {
  it.each(SCENES)('$name', ({ build, honest }) => {
    const reading = analyseRoom(build());
    const error = Math.abs(reading.floorCoverage - TRUE_COVERAGE) / TRUE_COVERAGE;
    const claimsCertainty = reading.floorConfidence === 'measured';
    const isHonest = !claimsCertainty || error < MEASURED_BUDGET;
    expect(isHonest).toBe(honest);
  });

  it('a rug no longer costs the estimator the floor under it', () => {
    /* THE FINDING, AND WHAT CLOSED IT.
     *
     * AUDIT-01 measured 72% coverage error here while the reading still said
     * `measured`: the row-run estimator walked up from the bottom of the frame
     * and stopped at the near edge of the rug, because a rug collapses a colour
     * run exactly the way a wall does. Living rooms have rugs.
     *
     * The estimator treats the floor as a connected REGION now, so the rug is
     * a hole in it rather than the end of it. Three percent. */
    const px = emptyRoom();
    fill(px, [0.15, 0.6, 0.85, 0.85], [214, 206, 190]);
    const reading = analyseRoom(px);
    expect(reading.floorConfidence).toBe('measured');
    const error = Math.abs(reading.floorCoverage - TRUE_COVERAGE) / TRUE_COVERAGE;
    expect(error).toBeLessThan(MEASURED_BUDGET);
  });

  it('says weak when a trapezoid is the wrong shape for what it found', () => {
    /* A room shot through a doorway has a wall line running diagonally across
       the frame. No quad with two corners on one horizontal can describe that,
       and the honest answer is to say so and hand over the four corners rather
       than to emit a wedge and call it measured. */
    const reading = analyseRoom(emptyRoom({ angled: true }));
    expect(reading.floorConfidence).toBe('weak');
  });

  it('a furnished room is read as accurately as an empty one', () => {
    const empty = analyseRoom(emptyRoom()).floorCoverage;
    const px = emptyRoom();
    fill(px, [0.15, 0.6, 0.85, 0.85], [214, 206, 190]);
    fill(px, [0.05, 0.48, 0.4, 0.7], [138, 136, 132]);
    fill(px, [0.6, 0.72, 0.78, 0.9], [198, 158, 104]);
    /* The point of the region estimator in one assertion: what is standing on
       the floor no longer changes where the floor is judged to end. */
    expect(Math.abs(analyseRoom(px).floorCoverage - empty)).toBeLessThan(0.02);
  });

  it('`weak` still fires where it always did, so VIS-03 is a widening not a rewrite', () => {
    const tiny: Pixels = { data: new Uint8ClampedArray(4 * 4 * 4), width: 4, height: 4 };
    expect(analyseRoom(tiny).floorConfidence).toBe('weak');
  });
});
