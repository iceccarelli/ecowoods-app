/**
 * Room analysis, asserted against images whose answer is known by construction.
 *
 * The point of building the estimator over raw RGBA rather than over a canvas
 * is precisely this file: a measurement nobody can test is a measurement nobody
 * should trust, and the screen this feeds puts its output in front of a person
 * who can see their own floor.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUAD,
  analyseRoom,
  colourDistance,
  estimateFloorQuad,
  hueChroma,
  lightLevelOf,
  meanRgb,
  quadCoverage,
  relativeLuminance,
  srgbToLinear,
  toneOf,
  undertoneOf,
  UNMEASURABLE_FROM_A_PHOTO,
  type Pixels,
} from './room';
import * as roomModule from './room';

type Rgb = { r: number; g: number; b: number };

/** A flat frame of one colour. */
function solid(width: number, height: number, c: Rgb): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = c.r;
    data[i * 4 + 1] = c.g;
    data[i * 4 + 2] = c.b;
    data[i * 4 + 3] = 255;
  }
  return { data, width, height };
}

/**
 * A room: wall above `horizon`, floor below it as a trapezoid widening toward
 * the camera. Deterministic per-pixel jitter, so the estimator is proven to
 * tolerate a real surface rather than a paint chip.
 */
function room(opts: {
  width: number;
  height: number;
  horizon: number;
  farLeft: number;
  farRight: number;
  wall: Rgb;
  floor: Rgb;
}): Pixels {
  const { width, height, horizon, farLeft, farRight, wall, floor } = opts;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const t = height - 1 === horizon ? 0 : (y - horizon) / (height - 1 - horizon);
    const left = farLeft + (0 - farLeft) * Math.max(0, t);
    const right = farRight + (width - 1 - farRight) * Math.max(0, t);
    for (let x = 0; x < width; x += 1) {
      const inFloor = y >= horizon && x >= left && x <= right;
      const base = inFloor ? floor : wall;
      const jitter = ((x * 7 + y * 13) % 11) - 5;
      const i = (y * width + x) * 4;
      data[i] = base.r + jitter;
      data[i + 1] = base.g + jitter;
      data[i + 2] = base.b + jitter;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

const WALL_WARM = { r: 232, g: 218, b: 196 };
const WALL_COOL = { r: 205, g: 214, b: 232 };
const WALL_NEUTRAL = { r: 224, g: 223, b: 221 };
const FLOOR_MID = { r: 150, g: 110, b: 70 };
const FLOOR_DARK = { r: 46, g: 34, b: 24 };
const FLOOR_LIGHT = { r: 214, g: 198, b: 172 };

describe('colour maths comes from published formulae', () => {
  it('linearises sRGB at the documented breakpoint', () => {
    expect(srgbToLinear(0)).toBe(0);
    expect(srgbToLinear(255)).toBeCloseTo(1, 10);
    /* 10/255 = 0.039 sits below 0.04045 and takes the linear leg. */
    expect(srgbToLinear(10)).toBeCloseTo(10 / 255 / 12.92, 10);
  });

  it('gives white luminance 1 and black 0', () => {
    expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1, 10);
    expect(relativeLuminance(0, 0, 0)).toBe(0);
  });

  it('weights green the most, as the formula does', () => {
    expect(relativeLuminance(0, 255, 0)).toBeGreaterThan(relativeLuminance(255, 0, 0));
    expect(relativeLuminance(255, 0, 0)).toBeGreaterThan(relativeLuminance(0, 0, 255));
  });

  it('derives hue and chroma the ordinary way', () => {
    expect(hueChroma({ r: 255, g: 0, b: 0 }).hueDeg).toBeCloseTo(0, 6);
    expect(hueChroma({ r: 0, g: 255, b: 0 }).hueDeg).toBeCloseTo(120, 6);
    expect(hueChroma({ r: 0, g: 0, b: 255 }).hueDeg).toBeCloseTo(240, 6);
    expect(hueChroma({ r: 128, g: 128, b: 128 }).chroma).toBe(0);
  });
});

describe('undertone refuses to read noise', () => {
  it('calls a near-grey wall neutral however its hue rounds', () => {
    expect(undertoneOf(WALL_NEUTRAL)).toBe('neutral');
    expect(undertoneOf({ r: 250, g: 249, b: 247 })).toBe('neutral');
  });

  it('names a warm wall warm and a cool wall cool', () => {
    expect(undertoneOf(WALL_WARM)).toBe('warm');
    expect(undertoneOf(WALL_COOL)).toBe('cool');
  });
});

describe('tone and light level', () => {
  it('separates light, mid and dark floors', () => {
    expect(toneOf(relativeLuminance(FLOOR_LIGHT.r, FLOOR_LIGHT.g, FLOOR_LIGHT.b))).toBe('light');
    expect(toneOf(relativeLuminance(FLOOR_MID.r, FLOOR_MID.g, FLOOR_MID.b))).toBe('mid');
    expect(toneOf(relativeLuminance(FLOOR_DARK.r, FLOOR_DARK.g, FLOOR_DARK.b))).toBe('dark');
  });

  it('separates a dim room from a bright one', () => {
    expect(lightLevelOf(0.05)).toBe('dim');
    expect(lightLevelOf(0.3)).toBe('balanced');
    expect(lightLevelOf(0.6)).toBe('bright');
  });
});

describe('sampling', () => {
  it('averages the rectangle it was given and nothing else', () => {
    const px = room({ width: 200, height: 150, horizon: 90, farLeft: 60, farRight: 140, wall: WALL_COOL, floor: FLOOR_DARK });
    const top = meanRgb(px, 0, 0, 1, 0.3);
    const bottom = meanRgb(px, 0.4, 0.95, 0.6, 1);
    expect(colourDistance(top, WALL_COOL)).toBeLessThan(12);
    expect(colourDistance(bottom, FLOOR_DARK)).toBeLessThan(12);
  });
});

describe('the floor-plane estimator', () => {
  it('finds the wall line and the far corners of a trapezoid floor', () => {
    const px = room({ width: 200, height: 150, horizon: 90, farLeft: 60, farRight: 140, wall: WALL_WARM, floor: FLOOR_MID });
    const { quad, confidence } = estimateFloorQuad(px);
    expect(confidence).toBe('measured');
    expect(quad[0].y).toBeGreaterThan(0.5);
    expect(quad[0].y).toBeLessThan(0.67);
    expect(quad[0].x).toBeCloseTo(0.3, 1);
    expect(quad[1].x).toBeCloseTo(0.7, 1);
    /* The near corners are the bottom of the frame, always. */
    expect(quad[2]).toEqual({ x: 1, y: 1 });
    expect(quad[3]).toEqual({ x: 0, y: 1 });
  });

  it('follows the wall line up when the floor takes more of the frame', () => {
    const high = estimateFloorQuad(room({ width: 200, height: 150, horizon: 45, farLeft: 60, farRight: 140, wall: WALL_WARM, floor: FLOOR_MID }));
    const low = estimateFloorQuad(room({ width: 200, height: 150, horizon: 110, farLeft: 60, farRight: 140, wall: WALL_WARM, floor: FLOOR_MID }));
    expect(high.quad[0].y).toBeLessThan(low.quad[0].y);
    expect(quadCoverage(high.quad)).toBeGreaterThan(quadCoverage(low.quad));
  });

  it('says weak rather than confident when the frame is one flat surface', () => {
    const { quad, confidence } = estimateFloorQuad(solid(200, 150, FLOOR_MID));
    expect(confidence).toBe('weak');
    expect(quad).toEqual(DEFAULT_QUAD);
  });

  it('says weak on an image too small to read', () => {
    expect(estimateFloorQuad(solid(4, 4, FLOOR_MID)).confidence).toBe('weak');
  });

  it('measures coverage as the area of the quad', () => {
    expect(quadCoverage([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }])).toBeCloseTo(1, 10);
    expect(quadCoverage(DEFAULT_QUAD)).toBeGreaterThan(0);
    expect(quadCoverage(DEFAULT_QUAD)).toBeLessThan(1);
  });
});

describe('the reading a person is asked to correct', () => {
  const px = room({ width: 240, height: 180, horizon: 100, farLeft: 70, farRight: 170, wall: WALL_WARM, floor: FLOOR_DARK });
  const reading = analyseRoom(px);

  it('reports the measurements it took', () => {
    expect(reading.wallUndertone).toBe('warm');
    expect(reading.existingFloorTone).toBe('dark');
    expect(reading.floorConfidence).toBe('measured');
    expect(reading.floorCoverage).toBeGreaterThan(0);
    expect(reading.meanLuminance).toBeGreaterThan(0);
    expect(reading.meanLuminance).toBeLessThan(1);
  });

  it('writes a sentence for every measurement, in plain words', () => {
    expect(reading.notes.length).toBeGreaterThanOrEqual(3);
    for (const note of reading.notes) {
      expect(note.length).toBeGreaterThan(20);
      expect(note).not.toMatch(/\d+%\s*confiden/i);
    }
  });

  it('asks for a correction out loud when the reading was weak', () => {
    const flat = analyseRoom(solid(200, 150, FLOOR_MID));
    expect(flat.floorConfidence).toBe('weak');
    expect(flat.notes.join(' ')).toMatch(/drag the four corners/i);
  });

  it('reads a dim room as dim and a bright one as bright', () => {
    const dim = analyseRoom(room({ width: 200, height: 150, horizon: 90, farLeft: 60, farRight: 140, wall: { r: 62, g: 58, b: 54 }, floor: FLOOR_DARK }));
    const bright = analyseRoom(room({ width: 200, height: 150, horizon: 90, farLeft: 60, farRight: 140, wall: { r: 248, g: 246, b: 242 }, floor: FLOOR_LIGHT }));
    expect(dim.lightLevel).toBe('dim');
    expect(bright.lightLevel).toBe('bright');
  });
});

describe('what the module refuses to measure', () => {
  it('names area and room type as questions, with the reason', () => {
    const fields = UNMEASURABLE_FROM_A_PHOTO.map((u) => u.field);
    expect(fields).toContain('area');
    expect(fields).toContain('roomType');
    for (const u of UNMEASURABLE_FROM_A_PHOTO) {
      expect(u.ask.endsWith('?')).toBe(true);
      expect(u.why.length).toBeGreaterThan(40);
    }
  });

  it('exports nothing that sounds like it computes a square footage', () => {
    /* The module's whole ethic is that a photo cannot give an area. If somebody
       adds estimateSquareFeet() one afternoon, this test is the conversation. */
    const suspicious = Object.keys(roomModule).filter((k) => /sqft|squarefeet|squarefootage/i.test(k));
    expect(suspicious).toEqual([]);
  });
});
