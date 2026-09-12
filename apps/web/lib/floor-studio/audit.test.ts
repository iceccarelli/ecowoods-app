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
        put(px, x, y, [base[0] * d, base[1] * d, base[2] * d]);
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
 * AV-01 AS MEASURED. Every name here is an object the renderer destroys.
 *
 * VIS-02 must empty this list. When it does, this test fails and
 * docs/AUDIT_01_VISUALIZER.md §2 must be rewritten in the same patch.
 */
const DEFECT_AV_01 = [
  'cream/jute area rug',
  'human leg (skin)',
  'golden retriever',
  'oak stair riser',
  'pine/oak table leg',
  'cardboard box',
];

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
  it('leaves every object on the floor alone (this is what VIS-02 must make true)', () => {
    const { rows } = occlusionSweep();
    const destroyed = rows.filter((r) => r.considered > 0 && r.pct >= 50).map((r) => r.name);
    /* Asserted against the measured list rather than against [] so the suite is
       green today and turns red the moment the behaviour changes in either
       direction — a fix, or a regression that destroys something new. */
    expect(destroyed.sort()).toEqual([...DEFECT_AV_01].sort());
  });

  it('destroys them completely rather than partially — this is not a soft edge', () => {
    const { rows } = occlusionSweep();
    for (const name of DEFECT_AV_01) {
      const row = rows.find((r) => r.name === name)!;
      expect(row.pct).toBeGreaterThan(99);
    }
  });

  it('every object it does spare is one whose hue is not wood', () => {
    const { rows } = occlusionSweep();
    const spared = rows.filter((r) => r.considered > 0 && r.pct < 50).map((r) => r.name);
    expect(spared).toContain('grey fabric sofa');
    expect(spared).toContain('charcoal rug');
    expect(spared).toContain('navy armchair');
    /* The mask is a chroma test and nothing else, so the rule that decides is
       colour rather than what the thing is. Stated as an assertion because it
       is the whole diagnosis: it is not that the mask is weak, it is that it
       is measuring the wrong quantity. */
    expect(spared).not.toContain('human leg (skin)');
  });

  it('the "mostly furniture" warning cannot fire, because the furniture was painted', () => {
    const { painted } = occlusionSweep();
    /* FloorStudio.tsx shows "a lot of this room is furniture rather than floor"
       when painted < 0.5. Six of fourteen objects are painted rather than
       skipped, so the fraction stays high in precisely the rooms that need the
       warning. */
    expect(painted).toBeGreaterThan(0.5);
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
    honest: false,
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
    honest: false,
  },
  { name: 'shot from a doorway (angled)', build: () => emptyRoom({ angled: true }), honest: true },
];

/** The error budget a `measured` reading has to stay inside to be honest. */
const MEASURED_BUDGET = 0.25;

describe('AUDIT-01 · AV-02 — is "measured" true', () => {
  it.each(SCENES)('$name', ({ build, honest }) => {
    const reading = analyseRoom(build());
    const error = Math.abs(reading.floorCoverage - TRUE_COVERAGE) / TRUE_COVERAGE;
    const claimsCertainty = reading.floorConfidence === 'measured';
    const isHonest = !claimsCertainty || error < MEASURED_BUDGET;
    expect(isHonest).toBe(honest);
  });

  it('a rug costs the estimator most of the floor and none of its confidence', () => {
    const px = emptyRoom();
    fill(px, [0.15, 0.6, 0.85, 0.85], [214, 206, 190]);
    const reading = analyseRoom(px);
    expect(reading.floorConfidence).toBe('measured');
    /* Roughly a sixth of the true plane. VIS-03 must make this read `weak`, or
       make the coverage right. Either one flips this test. */
    expect(reading.floorCoverage).toBeLessThan(0.25);
  });

  it('`weak` still fires where it always did, so VIS-03 is a widening not a rewrite', () => {
    const tiny: Pixels = { data: new Uint8ClampedArray(4 * 4 * 4), width: 4, height: 4 };
    expect(analyseRoom(tiny).floorConfidence).toBe('weak');
  });
});
