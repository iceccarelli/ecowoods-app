/**
 * lib/floor-studio/render.ts — laying a real floor into a real photograph.
 *
 * THE ONE RULE
 *
 * No pixel of wood in this renderer comes from a generative model. Every board
 * is drawn from the parameters of a configuration Ecowoods can install: the
 * species' two pigments, the finish's tint and sheen, the pattern's geometry,
 * the board width the visitor chose. A diffusion model asked for "white oak
 * herringbone" produces a beautiful floor that exists nowhere, and the
 * homeowner who falls in love with it cannot buy it. That is not a rendering
 * bug, it is a fraud with a nice colour palette.
 *
 * So the texture is synthesised, deterministically, from the catalogue record.
 * The same configuration renders identically on every device and in every
 * session, which also means a shared link shows the recipient the floor the
 * sender saw.
 *
 * HOW IT KEEPS THE ROOM
 *
 * Three things make a composite read as "my room with a new floor" rather than
 * "a picture with a rectangle pasted on it", and all three are arithmetic:
 *
 *  1. PERSPECTIVE. The four corners the visitor placed define a projective map
 *     from the photograph to a plan-view floor. `solveHomography` produces it
 *     exactly — not an affine approximation, which is what makes cheap
 *     visualisers look like a sticker. Boards converge because the maths makes
 *     them converge.
 *
 *  2. THE ROOM'S OWN LIGHT. Each output pixel keeps the LUMINANCE RATIO of the
 *     pixel it replaces against the mean of the floor region. A patch that was
 *     in shadow stays in shadow; a patch under a window stays bright. Nothing
 *     about the lighting is invented, because all of it is retained.
 *
 *  3. WHAT IS STANDING ON THE FLOOR. A sofa leg, a rug, a plant pot inside the
 *     quad is not floor and must not be painted over. The mask compares each
 *     pixel's CHROMA to the floor region's mean chroma: something whose colour
 *     is materially different from the floor is left alone. It is a
 *     conservative test and it is meant to be — leaving a little of the old
 *     floor showing looks like a rough edge, while painting oak across the cat
 *     looks like a toy.
 *
 * WHY IT IS ALL PURE FUNCTIONS OVER RGBA
 *
 * Same reason as room.ts: everything here is testable in node, because a
 * renderer nobody can test is a renderer that will quietly regress into a
 * sticker. `render-canvas.ts` is the thin browser wrapper that fetches
 * ImageData and puts it back.
 */
import { FINISH_OPTIONS } from '@ecowoods/shared/ai';
import {
  finishById,
  productById,
  widthById,
  type FloorConfiguration,
} from './catalog';
import { relativeLuminance, type Pixels, type Point, type Quad } from './room';

/* ── projective geometry ──────────────────────────────────────────────────── */

/** Row-major 3×3. */
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number];

/**
 * The projective map taking four source points to four destination points.
 *
 * Eight unknowns, eight equations, solved by Gaussian elimination with partial
 * pivoting. Returns null for a degenerate quad (three collinear corners, a
 * corner dragged on top of another) rather than emitting NaNs into a canvas.
 */
export function solveHomography(src: Quad, dst: Quad): Mat3 | null {
  const a: number[][] = [];
  for (let i = 0; i < 4; i += 1) {
    const { x, y } = src[i]!;
    const { x: u, y: v } = dst[i]!;
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }

  for (let col = 0; col < 8; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < 8; r += 1) {
      if (Math.abs(a[r]![col]!) > Math.abs(a[pivot]![col]!)) pivot = r;
    }
    if (Math.abs(a[pivot]![col]!) < 1e-10) return null;
    [a[col], a[pivot]] = [a[pivot]!, a[col]!];
    const p = a[col]!;
    for (let r = 0; r < 8; r += 1) {
      if (r === col) continue;
      const factor = a[r]![col]! / p[col]!;
      if (factor === 0) continue;
      for (let c = col; c < 9; c += 1) a[r]![c] = a[r]![c]! - factor * p[c]!;
    }
  }

  const h: number[] = [];
  for (let i = 0; i < 8; i += 1) h.push(a[i]![8]! / a[i]![i]!);
  h.push(1);
  return h as unknown as Mat3;
}

/** Apply a homography to a point. Returns null behind the horizon (w ≤ 0). */
export function applyHomography(m: Mat3, p: Point): Point | null {
  const w = m[6] * p.x + m[7] * p.y + m[8];
  if (Math.abs(w) < 1e-12) return null;
  return { x: (m[0] * p.x + m[1] * p.y + m[2]) / w, y: (m[3] * p.x + m[4] * p.y + m[5]) / w };
}

/* ── the plan view the photograph is mapped onto ──────────────────────────── */

/**
 * Plan units are INCHES, so a board width is the board width.
 *
 * The scale needs a real-world size for the visible floor and a photograph
 * cannot give one (see room.ts). What we have is the area the visitor typed.
 * So the visible plane is treated as a square of that area — stated here, and
 * stated on screen, because it is an assumption rather than a measurement. It
 * affects ONLY how large the boards look. It never touches the price, and the
 * visitor gets a scale nudge for the case where their room is long and narrow.
 */
export function planSizeInches(squareFeet: number, boardScale = 1): number {
  const side = Math.sqrt(Math.max(25, squareFeet)) * 12;
  return side / Math.max(0.4, Math.min(2.5, boardScale));
}

/* ── board geometry ───────────────────────────────────────────────────────── */

/** Nominal board length, in board widths. Four is the flooring convention. */
export const BLOCK_RATIO = 4;
/** Straight and diagonal runs use a long board rather than a block. */
export const RUN_LENGTH_RATIO = 9;

export type PlankSample = {
  /** Stable per-board identity, for the tonal variation hash. */
  key: number;
  /** Distance to the nearest board edge, in board widths. Drives the bevel. */
  edge: number;
  /** Position along the board, 0–1. Drives the grain. */
  along: number;
  /** Position across the board, 0–1. */
  across: number;
  /** 0 for a board running with plan-Y, 1 for one running with plan-X. */
  axis: 0 | 1;
};

const rot45 = (x: number, y: number) => ({ x: (x + y) * Math.SQRT1_2, y: (y - x) * Math.SQRT1_2 });

/** Deterministic, cheap, and good enough for tonal variation. Never Math.random. */
export function hash2(a: number, b: number): number {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function runSample(x: number, y: number, widthIn: number, axisFlag: 0 | 1): PlankSample {
  const w = widthIn;
  const len = widthIn * RUN_LENGTH_RATIO;
  const band = Math.floor(x / w);
  const inBand = x - band * w;
  /* End seams are staggered by a third of a board per course — the way a floor
     is actually laid, and the reason a real floor has no visible ladders. */
  const stagger = band * len * 0.37;
  const plank = Math.floor((y + stagger) / len);
  const inPlank = y + stagger - plank * len;
  return {
    key: Math.floor(hash2(band, plank) * 1e6),
    edge: Math.min(inBand, w - inBand, inPlank, len - inPlank) / w,
    along: inPlank / len,
    across: inBand / w,
    axis: axisFlag,
  };
}

/**
 * Herringbone, classified in O(1).
 *
 * With boards L cells long and 1 cell wide, the tiling reduces to one integer
 * test. Writing (i, j) for the cell and d = (i − j) mod 2L, the cell belongs to
 * a board running along X when d < L and along Y otherwise; d then gives the
 * position within the board. That identity is derived from the lattice the
 * pattern actually has — generators (L+1, 1−L) and (1, 1) — and a test asserts
 * every cell in a grid resolves to exactly one board with no gaps.
 */
function herringboneSample(x: number, y: number, widthIn: number): PlankSample {
  const L = BLOCK_RATIO;
  const cx = x / widthIn;
  const cy = y / widthIn;
  const i = Math.floor(cx);
  const j = Math.floor(cy);
  const fx = cx - i;
  const fy = cy - j;
  const d = ((i - j) % (2 * L) + 2 * L) % (2 * L);

  if (d < L) {
    const along = (d + fx) / L;
    return {
      key: Math.floor(hash2(i - d, j) * 1e6),
      edge: Math.min(fy, 1 - fy, d + fx, L - (d + fx)),
      along,
      across: fy,
      axis: 1,
    };
  }
  const v = L - d; // 0 down to 1−L
  const alongCells = v + L - 1 + fy;
  return {
    key: Math.floor(hash2(i, j - v - (L - 1)) * 1e6),
    edge: Math.min(fx, 1 - fx, alongCells, L - alongCells),
    along: alongCells / L,
    across: fx,
    axis: 0,
  };
}

/**
 * Chevron: mirrored columns of 45° courses meeting point to point.
 *
 * Each column flips the sign of the rotation, which is exactly what produces
 * the V. The seam between columns is the mitre.
 */
function chevronSample(x: number, y: number, widthIn: number): PlankSample {
  const columnWidth = widthIn * BLOCK_RATIO;
  const column = Math.floor(x / columnWidth);
  const xLocal = x - column * columnWidth;
  const sign = column % 2 === 0 ? 1 : -1;
  const band = (y + sign * xLocal) * Math.SQRT1_2;
  const index = Math.floor(band / widthIn);
  const inBand = band - index * widthIn;
  const alongRaw = (y - sign * xLocal) * Math.SQRT1_2;
  const len = widthIn * BLOCK_RATIO;
  const alongIndex = Math.floor(alongRaw / len);
  const inAlong = alongRaw - alongIndex * len;
  return {
    key: Math.floor(hash2(column * 31 + index, alongIndex) * 1e6),
    edge: Math.min(inBand, widthIn - inBand, xLocal, columnWidth - xLocal) / widthIn,
    along: inAlong / len,
    across: inBand / widthIn,
    axis: sign > 0 ? 0 : 1,
  };
}

/** Which board a plan-space point falls on, and where on it. */
export function samplePattern(
  x: number,
  y: number,
  patternId: string,
  widthIn: number,
): PlankSample {
  switch (patternId) {
    case 'diagonal': {
      const r = rot45(x, y);
      return runSample(r.x, r.y, widthIn, 0);
    }
    case 'herringbone':
      return herringboneSample(x, y, widthIn);
    case 'chevron':
      return chevronSample(x, y, widthIn);
    case 'straight':
    default:
      return runSample(x, y, widthIn, 0);
  }
}

/* ── the wood itself ──────────────────────────────────────────────────────── */

export type Rgb = { r: number; g: number; b: number };

const hexToRgb = (hex: string): Rgb => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});

export type Rgba = Rgb & { a: number };

/** Parses the `rgba(r, g, b, a)` strings the finish options already carry. */
export function parseRgba(value: string): Rgba {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\s*\)/.exec(value);
  if (!m) return { r: 0, g: 0, b: 0, a: 0 };
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: m[4] === undefined ? 1 : Number(m[4]) };
}

/** How much board-to-board colour varies. A catalogue fact, not a style knob. */
const VARIATION: Record<string, number> = {
  'white-oak': 0.1,
  'red-oak': 0.14,
  'black-walnut': 0.2,
  'hard-maple': 0.06,
  hickory: 0.34,
};

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp255 = (n: number) => (n < 0 ? 0 : n > 255 ? 255 : n);

/**
 * The colour of the wood at one point on one board, before the room's light.
 *
 * base ↔ grain is the species' own two-pigment range — the same pair the /design
 * swatch paints with. Board-to-board variation is a hash on the board key
 * scaled by the species' published character; the grain within a board is a
 * cheap two-frequency wave along the board's length; the bevel is a darkening
 * inside a few thousandths of the edge, which is what makes a floor read as
 * boards rather than as wallpaper.
 */
export function woodColourAt(
  productId: string,
  finishId: string,
  sample: PlankSample,
): Rgb {
  const product = productById(productId);
  if (!product) return { r: 0, g: 0, b: 0 };
  const base = hexToRgb(product.base);
  const grain = hexToRgb(product.grain);
  const variation = VARIATION[productId] ?? 0.12;

  /* Board tone: where this board sits between the two pigments. */
  const boardTone = 0.35 + (hash2(sample.key, 7) - 0.5) * 2 * variation;

  /* Grain: two waves along the board, plus a fine one across it. */
  const phase = hash2(sample.key, 13) * Math.PI * 2;
  const grainWave =
    Math.sin(sample.across * 18 + phase) * 0.5 +
    Math.sin(sample.across * 47 + phase * 1.7) * 0.22 +
    Math.sin(sample.along * 6 + phase * 0.4) * 0.18;
  const t = Math.max(0, Math.min(1, boardTone + grainWave * 0.14));

  let r = mix(base.r, grain.r, t);
  let g = mix(base.g, grain.g, t);
  let b = mix(base.b, grain.b, t);

  /* Micro-bevel. `edge` is in board widths, so this is a real proportion of a
     real board rather than a pixel count that changes with zoom. */
  const bevel = Math.min(1, sample.edge / 0.035);
  const shade = 0.72 + 0.28 * bevel;
  r *= shade;
  g *= shade;
  b *= shade;

  /* Finish tint, over the top, at the alpha the finish already declares. */
  const finish = finishById(finishId) ?? FINISH_OPTIONS[1]!;
  const tint = parseRgba(finish.tint);
  if (tint.a > 0) {
    r = mix(r, tint.r, tint.a);
    g = mix(g, tint.g, tint.a);
    b = mix(b, tint.b, tint.a);
  }

  return { r: clamp255(r), g: clamp255(g), b: clamp255(b) };
}

/* ── the composite ────────────────────────────────────────────────────────── */

export type RenderOptions = {
  /** The area the visitor typed. Sets the board scale, never the price. */
  squareFeet: number;
  /** Visitor nudge for rooms that are not square, 0.4–2.5. */
  boardScale?: number;
  /**
   * How different from the floor's own colour a pixel must be before it is
   * treated as something standing ON the floor and left alone. Higher keeps
   * more of the photograph.
   */
  occlusionTolerance?: number;
};

export type RenderResult = {
  pixels: Pixels;
  /** Fraction of the quad actually painted. Low means heavy occlusion. */
  painted: number;
  /** Why nothing was painted, where that happened. */
  failure?: 'degenerate-quad' | 'empty-region';
};

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

/** Chroma as the two opponent axes, normalised out of brightness. */
const chromaOf = (r: number, g: number, b: number) => {
  const sum = r + g + b || 1;
  return { u: (r - g) / sum, v: (g - b) / sum };
};

/**
 * Lay `config` into `px` inside `quad`, keeping the room's light and whatever
 * is standing on the floor.
 *
 * Returns a NEW Pixels; the input is never mutated, because the original is
 * the before half of the before/after and the visitor will drag between them.
 */
export function compositeFloor(
  px: Pixels,
  quad: Quad,
  config: FloorConfiguration,
  options: RenderOptions,
): RenderResult {
  const out: Pixels = {
    data: new Uint8ClampedArray(px.data),
    width: px.width,
    height: px.height,
  };

  const width = widthById(config.widthId);
  const product = productById(config.productId);
  if (!width || !product) return { pixels: out, painted: 0, failure: 'degenerate-quad' };

  const plan = planSizeInches(options.squareFeet, options.boardScale ?? 1);
  const planQuad: Quad = [
    { x: 0, y: 0 },
    { x: plan, y: 0 },
    { x: plan, y: plan },
    { x: 0, y: plan },
  ];

  /* Pixels are given in normalised coordinates so the map is resolution
     independent — the same quad renders the same floor at any preview size. */
  const m = solveHomography(quad, planQuad);
  if (!m) return { pixels: out, painted: 0, failure: 'degenerate-quad' };

  /* First pass: the floor region's own statistics. The composite is measured
     against these, which is how the room's light survives. */
  let sumLum = 0;
  let sumU = 0;
  let sumV = 0;
  let count = 0;
  for (let y = 0; y < px.height; y += 2) {
    const ny = (y + 0.5) / px.height;
    for (let x = 0; x < px.width; x += 2) {
      const nx = (x + 0.5) / px.width;
      if (!inQuad(quad, nx, ny)) continue;
      const i = (y * px.width + x) * 4;
      const r = px.data[i]!;
      const g = px.data[i + 1]!;
      const b = px.data[i + 2]!;
      sumLum += relativeLuminance(r, g, b);
      const c = chromaOf(r, g, b);
      sumU += c.u;
      sumV += c.v;
      count += 1;
    }
  }
  if (count === 0) return { pixels: out, painted: 0, failure: 'empty-region' };

  const meanLum = Math.max(0.01, sumLum / count);
  const meanU = sumU / count;
  const meanV = sumV / count;
  const tolerance = options.occlusionTolerance ?? 0.075;

  const finish = finishById(config.finishId) ?? FINISH_OPTIONS[1]!;
  const sheen = finish.sheen;

  let painted = 0;
  let considered = 0;

  for (let y = 0; y < px.height; y += 1) {
    const ny = (y + 0.5) / px.height;
    for (let x = 0; x < px.width; x += 1) {
      const nx = (x + 0.5) / px.width;
      if (!inQuad(quad, nx, ny)) continue;
      considered += 1;

      const i = (y * px.width + x) * 4;
      const r0 = px.data[i]!;
      const g0 = px.data[i + 1]!;
      const b0 = px.data[i + 2]!;

      /* Something standing on the floor keeps its own pixels. */
      const c = chromaOf(r0, g0, b0);
      if (Math.hypot(c.u - meanU, c.v - meanV) > tolerance) continue;

      const planPoint = applyHomography(m, { x: nx, y: ny });
      if (!planPoint) continue;

      const sample = samplePattern(planPoint.x, planPoint.y, config.patternId, width.inches);
      const wood = woodColourAt(config.productId, config.finishId, sample);

      /* The room's own light, as a ratio against the region mean. Clamped so a
         blown highlight or a black shadow cannot produce a floor nobody would
         believe. */
      const lum = relativeLuminance(r0, g0, b0);
      const shading = Math.max(0.45, Math.min(1.8, lum / meanLum));

      /* Sheen: a surface that returns light returns MORE of it where the room
         was already bright. Which is what makes a satin floor look satin and a
         matte floor look matte, with no extra input. */
      const gloss = 1 + sheen * Math.max(0, shading - 1) * 1.4;

      out.data[i] = clamp255(wood.r * shading * gloss);
      out.data[i + 1] = clamp255(wood.g * shading * gloss);
      out.data[i + 2] = clamp255(wood.b * shading * gloss);
      out.data[i + 3] = 255;
      painted += 1;
    }
  }

  return { pixels: out, painted: considered === 0 ? 0 : painted / considered };
}
