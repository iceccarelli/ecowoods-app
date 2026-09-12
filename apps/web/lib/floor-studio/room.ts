/**
 * lib/floor-studio/room.ts — what can honestly be read off a photograph.
 *
 * THE LINE THIS MODULE DRAWS
 *
 * A homeowner uploads one photograph of their living room. There are things
 * that photograph genuinely contains and things it does not, and the difference
 * is the difference between a tool and a party trick.
 *
 * IT CONTAINS: how bright the room is, what colour the light in it is, what
 * colour the walls read as, how dark the existing floor is, and roughly where
 * the floor plane meets the walls. All five are statistics over pixels. Every
 * one of them can be recomputed by anybody with the same image and this file,
 * and every one of them changes what floor we should recommend.
 *
 * IT DOES NOT CONTAIN: the square footage. Not approximately, not "within 15%",
 * not with a clever trick. A single uncalibrated photograph with no reference
 * object of known size cannot yield an area, and every product in this category
 * that claims otherwise is guessing and hoping the homeowner does not check.
 * The moment we print "approximately 320 sq ft" under a photo, we have taught
 * them that our numbers are decorative — and the number that matters to this
 * business is the installed range, which is computed FROM the area. So the area
 * is ASKED FOR. It is the one field on the verification screen the visitor must
 * fill in themselves, and the screen says why.
 *
 * Room type is the same: unmeasurable and consequential, so it is a question.
 *
 * WHY THIS RUNS IN THE BROWSER AND NOTHING IS UPLOADED
 *
 * PIPEDA case summary #2006-349 treats photographs of a dwelling's interior as
 * personal information about the person who lives there — that finding is the
 * reason lib/floor-graph/photo-storage.ts refuses to write to a public blob.
 * The cheapest way to honour it is to not collect the image at all. Everything
 * here is arithmetic over an ImageData the browser already has, so the ordinary
 * path of using Floor Studio transmits no photograph anywhere. A visitor who
 * later asks us to keep it goes through grantConsent() like everybody else.
 *
 * EVERY FUNCTION IS PURE AND TAKES RAW PIXELS
 *
 * No canvas, no DOM, no Image. The caller hands over `{ data, width, height }`
 * in RGBA, which is exactly what `CanvasRenderingContext2D.getImageData()`
 * returns — and exactly what a unit test can synthesise. The reason the
 * boundary is drawn there is that a measurement nobody can test is a
 * measurement nobody should trust.
 */
import type { ToneKey, UndertoneKey } from './catalog';

export type Pixels = {
  /** RGBA, row-major, length = width * height * 4. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

/** Normalised image coordinates: 0,0 top-left, 1,1 bottom-right. */
export type Point = { x: number; y: number };

/**
 * The floor plane, as four corners in reading order: far-left, far-right,
 * near-right, near-left. "Far" is the wall line, "near" is the bottom of the
 * frame. This is the quad the visitor drags and the quad the renderer warps
 * a floor into, so the two can never disagree about where the floor is.
 */
export type Quad = [Point, Point, Point, Point];

export type LightLevel = 'dim' | 'balanced' | 'bright';

export type RoomReading = {
  /** Mean relative luminance of the whole frame, 0–1. */
  meanLuminance: number;
  lightLevel: LightLevel;
  /** What the upper third of the frame — mostly wall — reads as. */
  wallUndertone: UndertoneKey;
  /** Mean relative luminance of the seeded floor region, 0–1. */
  existingFloorLuminance: number;
  existingFloorTone: ToneKey;
  /** Where the floor plane appears to be. Always correctable. */
  floorQuad: Quad;
  /** Fraction of the frame the quad covers, 0–1. */
  floorCoverage: number;
  /**
   * `measured` when the floor band separated cleanly from what is above it;
   * `weak` when it did not and the quad is a default rather than a reading.
   * There is no third, confident-sounding value, and there is no percentage:
   * a number like "87% confident" is a claim about a distribution nobody
   * estimated.
   */
  floorConfidence: 'measured' | 'weak';
  /** Plain sentences, each traceable to one statistic above. */
  notes: string[];
};

/* ── colour, from published formulae ──────────────────────────────────────── */

/** sRGB → linear. IEC 61966-2-1, the transfer function, not an approximation. */
export function srgbToLinear(channel8: number): number {
  const c = channel8 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG 2.x relative luminance. The same formula the contrast audit uses. */
export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

export type Rgb = { r: number; g: number; b: number };

/** Hue in degrees and chroma 0–1, from the ordinary HSV derivation. */
export function hueChroma({ r, g, b }: Rgb): { hueDeg: number; chroma: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const chroma = max - min;
  if (chroma === 0) return { hueDeg: 0, chroma: 0 };
  let hue: number;
  if (max === rn) hue = ((gn - bn) / chroma) % 6;
  else if (max === gn) hue = (bn - rn) / chroma + 2;
  else hue = (rn - gn) / chroma + 4;
  hue *= 60;
  if (hue < 0) hue += 360;
  return { hueDeg: hue, chroma };
}

/**
 * Warm, cool or neutral.
 *
 * Below CHROMA_FLOOR the pixel has no colour worth naming and the answer is
 * neutral — most painted walls in this market land there, and calling an
 * off-white "warm" because its hue rounds to 42° would be reading noise.
 */
const CHROMA_FLOOR = 0.05;
export function undertoneOf(rgb: Rgb): UndertoneKey {
  const { hueDeg, chroma } = hueChroma(rgb);
  if (chroma < CHROMA_FLOOR) return 'neutral';
  if (hueDeg < 75 || hueDeg >= 330) return 'warm';
  if (hueDeg >= 165 && hueDeg < 300) return 'cool';
  return 'neutral';
}

/**
 * Light, mid or dark.
 *
 * The cuts are on relative luminance, which is perceptual enough for this and
 * is already the scale the design system's contrast work uses.
 */
export function toneOf(luminance: number): ToneKey {
  if (luminance >= 0.42) return 'light';
  if (luminance <= 0.14) return 'dark';
  return 'mid';
}

export function lightLevelOf(luminance: number): LightLevel {
  if (luminance >= 0.45) return 'bright';
  if (luminance <= 0.16) return 'dim';
  return 'balanced';
}

/* ── sampling ─────────────────────────────────────────────────────────────── */

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Mean RGB over a normalised rectangle. Sampled on a stride, not every pixel. */
export function meanRgb(px: Pixels, x0: number, y0: number, x1: number, y1: number, stride = 2): Rgb {
  const left = Math.max(0, Math.floor(clamp01(x0) * px.width));
  const right = Math.min(px.width, Math.ceil(clamp01(x1) * px.width));
  const top = Math.max(0, Math.floor(clamp01(y0) * px.height));
  const bottom = Math.min(px.height, Math.ceil(clamp01(y1) * px.height));
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = top; y < bottom; y += stride) {
    for (let x = left; x < right; x += stride) {
      const i = (y * px.width + x) * 4;
      r += px.data[i]!;
      g += px.data[i + 1]!;
      b += px.data[i + 2]!;
      n += 1;
    }
  }
  if (n === 0) return { r: 0, g: 0, b: 0 };
  return { r: r / n, g: g / n, b: b / n };
}

/** Euclidean distance in 0–255 RGB. Crude, cheap, and adequate for a run test. */
export const colourDistance = (a: Rgb, b: Rgb): number =>
  Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);

/* ── the floor plane ──────────────────────────────────────────────────────── */

/**
 * WHAT THIS ESTIMATOR ACTUALLY DOES, IN ONE PARAGRAPH
 *
 * A photograph of a room taken by a person standing in it has the floor at the
 * bottom of the frame, running away from the camera and narrowing as it goes.
 * So: sample a reference colour from the bottom centre — the patch that is
 * floor in essentially every such photograph — then walk upward row by row and,
 * on each row, measure how far left and right that colour continues. The row
 * where the run collapses is the wall line. The left and right extents at that
 * row are the far corners. That is the quad.
 *
 * It is a heuristic and it is named as one. It has no opinion about furniture,
 * it will be defeated by a large rug of a different colour, and a photograph
 * taken from a doorway at an angle will need a drag. Which is exactly why the
 * verification screen puts four draggable corners in front of the visitor and
 * treats correction as the normal case rather than the failure case. A model
 * that presented this as certainty would be lying about a thing the visitor can
 * see with their own eyes.
 */
const TOLERANCE = 46;
const MIN_RUN_FRACTION = 0.22;

/** The quad used when nothing separated: the bottom 45% with a gentle taper. */
export const DEFAULT_QUAD: Quad = [
  { x: 0.2, y: 0.55 },
  { x: 0.8, y: 0.55 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

export function estimateFloorQuad(px: Pixels): { quad: Quad; confidence: 'measured' | 'weak' } {
  if (px.width < 8 || px.height < 8) return { quad: DEFAULT_QUAD, confidence: 'weak' };

  const reference = meanRgb(px, 0.35, 0.9, 0.65, 1);
  const sampleRows = Math.min(120, px.height);
  const rowStep = Math.max(1, Math.floor(px.height / sampleRows));
  const centre = Math.floor(px.width / 2);
  const colStep = Math.max(1, Math.floor(px.width / 160));

  let horizonRow = 0;
  let leftAtHorizon = 0;
  let rightAtHorizon = px.width - 1;
  let found = false;

  for (let y = px.height - 1; y >= 0; y -= rowStep) {
    let left = centre;
    let right = centre;
    for (let x = centre; x >= 0; x -= colStep) {
      const i = (y * px.width + x) * 4;
      const here = { r: px.data[i]!, g: px.data[i + 1]!, b: px.data[i + 2]! };
      if (colourDistance(here, reference) > TOLERANCE) break;
      left = x;
    }
    for (let x = centre; x < px.width; x += colStep) {
      const i = (y * px.width + x) * 4;
      const here = { r: px.data[i]!, g: px.data[i + 1]!, b: px.data[i + 2]! };
      if (colourDistance(here, reference) > TOLERANCE) break;
      right = x;
    }
    const run = right - left;
    if (run < px.width * MIN_RUN_FRACTION) {
      horizonRow = y;
      found = true;
      break;
    }
    leftAtHorizon = left;
    rightAtHorizon = right;
    horizonRow = y;
  }

  /* The run never collapsed — the whole frame reads as one surface. That is a
     photograph of a floor, not of a room, and the honest answer is a default
     quad plus a request for a correction. */
  if (!found || horizonRow > px.height * 0.92) {
    return { quad: DEFAULT_QUAD, confidence: 'weak' };
  }

  const yFar = clamp01(horizonRow / px.height);
  const xFarLeft = clamp01(leftAtHorizon / px.width);
  const xFarRight = clamp01(rightAtHorizon / px.width);

  /* A far edge narrower than a fifth of the frame is a corridor of noise, not a
     wall line. Say weak and hand over the default rather than a confident
     sliver. */
  if (xFarRight - xFarLeft < 0.2) return { quad: DEFAULT_QUAD, confidence: 'weak' };

  const quad: Quad = [
    { x: xFarLeft, y: yFar },
    { x: xFarRight, y: yFar },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  return { quad, confidence: 'measured' };
}

/** Shoelace area of the quad, as a fraction of the frame. */
export function quadCoverage(quad: Quad): number {
  let area = 0;
  for (let i = 0; i < 4; i += 1) {
    const a = quad[i]!;
    const b = quad[(i + 1) % 4]!;
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

/* ── the reading ──────────────────────────────────────────────────────────── */

const luminanceOf = (rgb: Rgb) => relativeLuminance(rgb.r, rgb.g, rgb.b);

/**
 * Everything this photograph honestly says, plus the sentences that say it.
 *
 * The notes are written for a person reading a verification screen. Each one
 * names the measurement rather than asserting a conclusion, because the next
 * control on that screen is the one that corrects it.
 */
export function analyseRoom(px: Pixels): RoomReading {
  const whole = meanRgb(px, 0, 0, 1, 1, 3);
  const meanLuminance = luminanceOf(whole);
  const lightLevel = lightLevelOf(meanLuminance);

  const upper = meanRgb(px, 0.1, 0.02, 0.9, 0.3, 2);
  const wallUndertone = undertoneOf(upper);

  const { quad, confidence } = estimateFloorQuad(px);

  /* Sample the existing floor from inside the near half of the quad, which is
     the part of the plane least likely to be furniture. */
  const nearTop = (quad[0]!.y + 1) / 2;
  const floorRgb = meanRgb(px, 0.3, nearTop, 0.7, 0.98, 2);
  const existingFloorLuminance = luminanceOf(floorRgb);
  const existingFloorTone = toneOf(existingFloorLuminance);

  const notes: string[] = [];
  notes.push(
    lightLevel === 'bright'
      ? 'This room reads bright. A darker floor will hold its colour here instead of looking flat.'
      : lightLevel === 'dim'
        ? 'This room reads dim. A lighter floor gives back more of the light you already have.'
        : 'The light in this room is balanced — most floors will read close to their swatch.',
  );
  notes.push(
    wallUndertone === 'neutral'
      ? 'The walls read neutral, which means the floor decides the temperature of the room.'
      : `The walls read ${wallUndertone}. A floor with the same undertone will feel settled; the opposite one will feel deliberate.`,
  );
  notes.push(
    `The floor that is there now reads ${existingFloorTone}. That is what you are comparing everything against.`,
  );
  if (confidence === 'weak') {
    notes.push(
      'We could not separate the floor from the rest of the photo with any confidence — drag the four corners onto the floor and it will be right.',
    );
  }

  return {
    meanLuminance,
    lightLevel,
    wallUndertone,
    existingFloorLuminance,
    existingFloorTone,
    floorQuad: quad,
    floorCoverage: quadCoverage(quad),
    floorConfidence: confidence,
    notes,
  };
}

/* ── what we refuse to measure, stated where a developer will read it ─────── */

/**
 * The two facts Floor Studio needs and a photograph cannot give it.
 *
 * Exported as data rather than written into JSX so the verification screen, the
 * markdown twin and anything else that has to explain the ask all say the same
 * thing.
 */
export const UNMEASURABLE_FROM_A_PHOTO = [
  {
    field: 'area',
    ask: 'How many square feet are we covering?',
    why: 'A single photo with nothing of known size in it cannot give an area. We would rather ask than print a number that is quietly wrong — the installed range is computed from this.',
  },
  {
    field: 'roomType',
    ask: 'What room is this?',
    why: 'It changes what we recommend — a kitchen and a bedroom want different hardness — and no photograph reliably says which is which.',
  },
] as const;
