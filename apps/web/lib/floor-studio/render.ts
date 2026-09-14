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
import type { Pixels, Point, Quad } from './room';

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

/**
 * sin(), as a table, for the grain only.
 *
 * The grain is three sine waves per pixel and the board tone and phase are two
 * more — six Math.sin() for every pixel of every frame, which at video rate is
 * the whole budget. The board terms are cached per board below; these three are
 * genuinely per pixel, and a thousand-entry table with linear interpolation is
 * indistinguishable from Math.sin in wood grain while costing an index and a
 * multiply. Nothing that produces a NUMBER anyone reads uses this — it draws
 * grain, and only grain.
 */
const SIN_N = 1024;
const SIN = new Float32Array(SIN_N + 1);
for (let i = 0; i <= SIN_N; i += 1) SIN[i] = Math.sin((i / SIN_N) * Math.PI * 2);
const TAU = Math.PI * 2;
function fastSin(x: number): number {
  let t = (x / TAU) % 1;
  if (t < 0) t += 1;
  const f = t * SIN_N;
  const i = f | 0;
  const frac = f - i;
  return SIN[i]! + (SIN[i + 1]! - SIN[i]!) * frac;
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
/**
 * Everything about a configuration that does not change per pixel, resolved
 * once.
 *
 * woodColourAt used to do a catalogue lookup, two hex parses, a second
 * catalogue lookup and an rgba() string parse FOR EVERY PIXEL. At a million
 * pixels a second that is four million string operations a second, and it is
 * the single reason the renderer could not keep up with a camera. None of it
 * depends on where the pixel is.
 */
/* ── real wood, from photographs of the real product ──────────────────────── */

/**
 * A GRAIN TEXTURE IS A PHOTOGRAPH OF A FLOOR THIS COMPANY LAYS.
 *
 * The synthesised grain below — two sine waves along the board and a fine one
 * across it — is deterministic, cheap and honest, and it looks like what it is:
 * a procedural approximation of wood. A homeowner deciding where fifteen
 * thousand dollars goes can tell.
 *
 * So the renderer now prefers a real one. public/textures/grain-<species>.webp
 * is cut from apps/web/public/gallery/<species>-wideplank-02-detail.webp — an
 * actual photograph of that actual product — with three things done to it:
 *
 *   · THE LIGHT IS DIVIDED OUT. The photograph was taken in a room with its own
 *     window. Pasting that shadow into somebody else's room states something
 *     false about their light, and the composite then multiplies their light in
 *     on top of it, so it would be applied twice.
 *   · THE CROP IS CHOSEN, NOT ASSUMED. A centre crop often lands on a mitred
 *     joint, and a joint in a grain texture appears inside every pattern the
 *     visitor picks — including the straight one.
 *   · IT TILES WITHOUT A MIRROR. Reflecting a diagonal produces a chevron. Wood
 *     grain has no symmetry and a texture of it must not either.
 *
 * IT IS STILL NOT GENERATION. Nothing here invents a floor: the pixels are a
 * photograph of a product on the price list, laid out by the catalogue's own
 * board geometry, lit by the room the visitor is standing in. That is the whole
 * difference between this and an image model, and it is why the range under the
 * picture means something.
 *
 * The parameter is optional everywhere. Without it — during a server render, in
 * a unit test, before the image has loaded — the synthesised grain runs exactly
 * as it did, so nothing can ever show a blank floor waiting on a download.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * STATUS: BUILT, TESTED, AND NOT YET WIRED TO THE INTERFACE. ON PURPOSE.
 *
 * Measured side by side against the drawn grain at room scale, this does not
 * yet win. It gets the species colour right and it carries real figure and real
 * character marks — and in the far half of the frame it still reads noisier
 * than the procedural floor it was meant to replace, because a 512-pixel tile
 * minified across a receding plane aliases, and the mip selection below does
 * not yet fully answer that.
 *
 * The honest thing is to say so rather than ship it. A visitor deciding where
 * fifteen thousand dollars goes is owed the better picture, and today the
 * better picture is the drawn one. The textures, the build script that cuts
 * them from the real product photographs, the sampler and the pyramid are all
 * here and under test; what is missing is anisotropic sampling along the
 * board's own axis, which is the next patch and not a paragraph in this one.
 *
 * Pass `grain` to turn it on. Nothing in apps/web does yet.
 * ────────────────────────────────────────────────────────────────────────────
 */
export type GrainTexture = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /**
   * Mean relative luminance of the tile, computed once when it is registered.
   * The texture is used as a DETAIL signal — how much lighter or darker than
   * its own average each point is — so this is the number it is measured
   * against. See woodColourFrom.
   */
  meanLuminance: number;
  /** Box-filtered halvings, level 0 being the full tile. */
  levels: { data: Uint8ClampedArray; width: number; height: number }[];
};

/**
 * Register a decoded tile: measure its mean, and build its mip pyramid.
 *
 * WHY A PYRAMID IS NOT OPTIONAL HERE. A floor runs away from the camera, so the
 * far half of the picture minifies the texture severely — one screen pixel
 * covers many texture pixels. Point-sampling that is aliasing, and aliasing on
 * wood grain looks exactly like static: the first working version of this had
 * correct colour and correct scale and still read as speckled carpet at the
 * back of the room, which is worse than the drawn grain it replaced.
 *
 * Four levels, each a box-filtered half of the one above. The level is chosen
 * per pixel from the homography's own divisor — see the composite loop, where
 * `w` is literally the projective depth.
 */
export function makeGrainTexture(data: Uint8ClampedArray, width: number, height: number): GrainTexture {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 16) {
    sum += fastLuminance(data[i]!, data[i + 1]!, data[i + 2]!);
    n += 1;
  }

  const levels: { data: Uint8ClampedArray; width: number; height: number }[] = [{ data, width, height }];
  let cur = { data, width, height };
  while (cur.width > 8 && cur.height > 8 && levels.length < 5) {
    const w2 = cur.width >> 1;
    const h2 = cur.height >> 1;
    const next = new Uint8ClampedArray(w2 * h2 * 4);
    for (let y = 0; y < h2; y += 1) {
      for (let x = 0; x < w2; x += 1) {
        const o = (y * w2 + x) * 4;
        for (let c = 0; c < 4; c += 1) {
          const a = cur.data[((y * 2) * cur.width + x * 2) * 4 + c]!;
          const b = cur.data[((y * 2) * cur.width + x * 2 + 1) * 4 + c]!;
          const d = cur.data[((y * 2 + 1) * cur.width + x * 2) * 4 + c]!;
          const e = cur.data[((y * 2 + 1) * cur.width + x * 2 + 1) * 4 + c]!;
          next[o + c] = (a + b + d + e) >> 2;
        }
      }
    }
    cur = { data: next, width: w2, height: h2 };
    levels.push(cur);
  }

  return { data, width, height, meanLuminance: n ? Math.max(0.01, sum / n) : 0.2, levels };
}

/**
 * What the texture measures, in inches of real floor.
 *
 * THIS IS THE WHOLE DIFFERENCE BETWEEN WOOD AND NOISE. The first version
 * sampled at `across` and `along` — board-local numbers in 0..1 — which maps
 * the entire 512-pixel photograph across one 5-inch board. On screen that board
 * is perhaps forty pixels wide, so every screen pixel jumped a dozen texture
 * pixels and the result was speckle: the pattern geometry disappeared and an
 * oak floor read as carpet. It looked visibly WORSE than the drawn grain it was
 * meant to replace.
 *
 * A texture has a real-world size and it has to be sampled in real-world units.
 * The crop is roughly two feet of floor, so a 5-inch board spans about a fifth
 * of it and a plank's length spans a couple of repeats — which is what grain
 * does on a real board.
 */
const GRAIN_INCHES = 10;

/**
 * Colour from the photograph, at this point on this board.
 *
 * `across` and `along` are board-local, which is what makes one texture serve
 * every pattern: herringbone and chevron hand back the same two numbers in the
 * block's own frame, so the grain runs along each piece the way it does on a
 * real floor rather than sliding across the room in one direction.
 *
 * The per-board hash offsets where in the texture that board is cut from, so no
 * two boards repeat — the thing that makes a tiled floor look tiled.
 */
function grainAt(tex: GrainTexture, sample: PlankSample, widthIn: number, lod = 0): Rgb {
  const level = tex.levels[Math.max(0, Math.min(tex.levels.length - 1, lod | 0))]!;
  /* Board-local INCHES. `across` and `along` are fractions of the board, so
     multiplying by the board's real width and length puts the sample back into
     the same units the texture is measured in. */
  const acrossIn = sample.across * widthIn;
  const alongIn = sample.along * widthIn * RUN_LENGTH_RATIO;

  /* A per-board offset, so no two boards are cut from the same piece of the
     photograph — the thing that makes a tiled floor look tiled. */
  let u = (acrossIn / GRAIN_INCHES + hash2(sample.key, 29)) % 1;
  let v = (alongIn / GRAIN_INCHES + hash2(sample.key, 53)) % 1;
  if (u < 0) u += 1;
  if (v < 0) v += 1;

  /* Bilinear, because nearest-neighbour on a photograph being minified is the
     other half of why the first version looked like static. */
  const fx = u * level.width - 0.5;
  const fy = v * level.height - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const wrapX = (n: number) => ((n % level.width) + level.width) % level.width;
  const wrapY = (n: number) => ((n % level.height) + level.height) % level.height;
  const x1 = wrapX(x0 + 1);
  const y1 = wrapY(y0 + 1);
  const xa = wrapX(x0);
  const ya = wrapY(y0);
  const at = (x: number, y: number) => (y * level.width + x) * 4;
  const i00 = at(xa, ya);
  const i10 = at(x1, ya);
  const i01 = at(xa, y1);
  const i11 = at(x1, y1);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const ch = (o: number) =>
    lerp(
      lerp(level.data[i00 + o]!, level.data[i10 + o]!, tx),
      lerp(level.data[i01 + o]!, level.data[i11 + o]!, tx),
      ty,
    );
  return { r: ch(0), g: ch(1), b: ch(2) };
}

export type WoodPalette = {
  base: Rgb;
  grain: Rgb;
  variation: number;
  tint: Rgba;
  ok: boolean;
  /** board key → its tone and grain phase. Constant across a whole board, and
      recomputing it per pixel cost two hash2 — two Math.sin — every time. */
  boards: Map<number, { tone: number; phase: number }>;
  /** The photograph of this species, when one has loaded. Named `photo` and not
      `grain` because `grain` above is the species' second PIGMENT — the pair
      the synthesised path mixes between — and two fields of that name in one
      object is how a silent bug gets written. */
  photo?: GrainTexture;
};

const paletteCache = new Map<string, WoodPalette>();

export function woodPalette(productId: string, finishId: string, grain?: GrainTexture): WoodPalette {
  const key = `${productId}|${finishId}|${grain ? 'photo' : 'drawn'}`;
  const hit = paletteCache.get(key);
  if (hit) {
    /* The texture arrives asynchronously, so a palette built before the image
       loaded must pick it up rather than stay procedural for the session. */
    if (grain && hit.photo !== grain) hit.photo = grain;
    return hit;
  }
  const product = productById(productId);
  const finish = finishById(finishId) ?? FINISH_OPTIONS[1]!;
  const made: WoodPalette = product
    ? {
        base: hexToRgb(product.base),
        grain: hexToRgb(product.grain),
        variation: VARIATION[productId] ?? 0.12,
        tint: parseRgba(finish.tint),
        ok: true,
        boards: new Map(),
        photo: grain,
      }
    : { base: { r: 0, g: 0, b: 0 }, grain: { r: 0, g: 0, b: 0 }, variation: 0.12, tint: { r: 0, g: 0, b: 0, a: 0 }, ok: false, boards: new Map(), photo: undefined };
  paletteCache.set(key, made);
  return made;
}

export function woodColourAt(
  productId: string,
  finishId: string,
  sample: PlankSample,
  grain?: GrainTexture,
  widthIn = 5,
): Rgb {
  return woodColourFrom(woodPalette(productId, finishId, grain), sample, widthIn);
}

export function woodColourFrom(palette: WoodPalette, sample: PlankSample, widthIn = 5, lod = 0): Rgb {
  if (!palette.ok) return { r: 0, g: 0, b: 0 };


  const base = palette.base;
  const grain = palette.grain;
  const variation = palette.variation;

  /* Board tone and grain phase are properties of the BOARD, not the pixel. */
  let board = palette.boards.get(sample.key);
  if (!board) {
    board = {
      tone: 0.35 + (hash2(sample.key, 7) - 0.5) * 2 * variation,
      phase: hash2(sample.key, 13) * Math.PI * 2,
    };
    palette.boards.set(sample.key, board);
  }
  const boardTone = board.tone;
  const phase = board.phase;

  /* Grain: two waves along the board, plus a fine one across it. */
  const grainWave =
    fastSin(sample.across * 18 + phase) * 0.5 +
    fastSin(sample.across * 47 + phase * 1.7) * 0.22 +
    fastSin(sample.along * 6 + phase * 0.4) * 0.18;
  const t = Math.max(0, Math.min(1, boardTone + grainWave * 0.14));

  let r = mix(base.r, grain.r, t);
  let g = mix(base.g, grain.g, t);
  let b = mix(base.b, grain.b, t);

  /* THE PHOTOGRAPH MODULATES THE CATALOGUE'S COLOUR. IT DOES NOT REPLACE IT.
   *
   * Replacing was the first attempt and it looked worse than the drawn grain it
   * was meant to improve on. Two reasons, and both matter:
   *
   *   · A texture is ONE board's face. Repeating it gives every board in the
   *     room the same tone, and board-to-board variation is most of what makes
   *     a floor read as a floor from across it — the drawn model has it, from
   *     the species' published `character` figure, and the photograph cannot.
   *   · Flattening the illumination normalises each tile to its own mean, which
   *     also flattens the SPECIES apart: white oak came back near-white and
   *     walnut lost its depth. The catalogue's two pigments are the published
   *     colour of the product and must stay the thing that decides it.
   *
   * So the photograph is used as a DETAIL signal: how much lighter or darker
   * than its own average this point is. Grain, figure, medullary ray, the
   * character marks in hickory — all of it survives, multiplying a colour that
   * still comes from the catalogue record. The result is real wood in the
   * product's own colour, with the board-to-board variation a real floor has.
   */
  if (palette.photo) {
    const px = grainAt(palette.photo, sample, widthIn, lod);
    const detail = fastLuminance(px.r | 0, px.g | 0, px.b | 0) / palette.photo.meanLuminance;
    /* Clamped, because a knot is genuinely near-black and a blown highlight in
       the source photograph is not information about the wood. */
    const k = Math.max(0.55, Math.min(1.6, detail));
    r *= k;
    g *= k;
    b *= k;
  }

  /* Micro-bevel. `edge` is in board widths, so this is a real proportion of a
     real board rather than a pixel count that changes with zoom. */
  const bevel = Math.min(1, sample.edge / 0.035);
  const shade = 0.72 + 0.28 * bevel;
  r *= shade;
  g *= shade;
  b *= shade;

  /* Finish tint, over the top, at the alpha the finish already declares. */
  const tint = palette.tint;
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
   * How different from the floor's own colour a cell must be before it is
   * treated as something standing ON the floor and left alone. Higher keeps
   * more of the photograph.
   */
  chromaTolerance?: number;
  /**
   * How many robust deviations of the floor's own luminance a cell must be
   * away before the same applies. This is the signal that sees a person's foot,
   * a light dog and a jute rug, none of which chroma can distinguish from oak.
   */
  luminanceSigmas?: number;
  /** A mask already built for this frame — live video reuses one across
      configuration changes instead of recomputing per repaint. */
  mask?: FloorMask;
  /**
   * The photograph of this species, decoded. Optional everywhere: without it
   * the synthesised grain runs exactly as it did, so a slow network shows a
   * drawn floor rather than no floor.
   */
  grain?: GrainTexture;
};

export type MaskOptions = Pick<RenderOptions, 'chromaTolerance' | 'luminanceSigmas'>;

export type RenderResult = {
  pixels: Pixels;
  /** Fraction of the quad actually painted. Low means heavy occlusion. */
  painted: number;
  /** Why nothing was painted, where that happened. */
  failure?: 'degenerate-quad' | 'empty-region';
};

/**
 * sRGB → linear, as a 256-entry table.
 *
 * relativeLuminance() in room.ts is the published formula and stays exactly
 * as it is — it is what the contrast work and the tests read. It also calls
 * Math.pow three times, and this renderer calls it twice for every pixel of
 * every frame. At video rate that is roughly six million pow() a second for
 * 256 distinct inputs. The table is the same function, memoised by its only
 * possible argument.
 */
const LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i += 1) {
  const c = i / 255;
  LINEAR[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
const fastLuminance = (r: number, g: number, b: number): number =>
  0.2126 * LINEAR[r & 255]! + 0.7152 * LINEAR[g & 255]! + 0.0722 * LINEAR[b & 255]!;

/** Chroma as the two opponent axes, normalised out of brightness. */
const chromaOf = (r: number, g: number, b: number) => {
  const sum = r + g + b || 1;
  return { u: (r - g) / sum, v: (g - b) / sum };
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

/* ── the mask: what is standing on the floor ──────────────────────────────── */

/**
 * WHAT WAS HERE BEFORE, AND WHY IT PAINTED OAK OVER A PERSON'S FOOT
 *
 * The entire object-protection system used to be one line:
 *
 *     if (hypot(c.u - meanU, c.v - meanV) > tolerance) continue;
 *
 * A pixel survived if and only if its CHROMA differed from the floor's mean
 * chroma. No luminance, no texture, no spatial coherence, no notion of an
 * object at all — a per-pixel colour test and nothing else. AUDIT-01 measured
 * it against fourteen things that stand on the floor of a house about to buy
 * hardwood and found six painted over completely: a jute rug, a person's leg, a
 * golden retriever, an oak stair riser, a wooden table leg, a cardboard box.
 * Every one of them sits in the same hue family as wood, which is not a
 * coincidence — it is what is in a room with a wooden floor.
 *
 * THE THREE THINGS IT NOW USES INSTEAD, AND WHY EACH ONE IS NECESSARY
 *
 * 1. ROBUST FLOOR STATISTICS, NOT THE MEAN. A large pale rug covering a third
 *    of the quad drags a mean until the rug looks like the floor and the floor
 *    looks like an object. The median and the median absolute deviation do not
 *    move until more than half the region is contaminated, and more than half
 *    the floor being covered is a photograph of a rug rather than of a floor.
 *
 * 2. LUMINANCE AS WELL AS CHROMA. Skin, a light dog, jute and cardboard all
 *    share wood's hue. What they do not share is its brightness: against a mid
 *    oak floor each is two to four robust deviations lighter. Chroma catches
 *    the green plant and the navy chair; luminance catches the ones chroma
 *    cannot see. Both are needed and neither is sufficient.
 *
 * 3. OBJECTS ARE REGIONS, NOT PIXELS. This is the part that actually works. A
 *    single pixel differing from the floor is noise; four thousand connected
 *    pixels differing from the floor is a dog. So the decision is made on a
 *    grid of cells and then CLOSED — dilate, erode — which fills the interior
 *    of an object whose middle happens to match wood while its edges do not,
 *    and erases isolated cells that are just grain. One more dilation leaves a
 *    margin around every object, because a rim of old floor at the edge of the
 *    sofa reads as a rough edge and oak across the sofa reads as a toy.
 *
 * WHAT THIS IS STILL NOT
 *
 * It is not segmentation. It does not know what a dog is. It is a statistical
 * separation of "surface that behaves like the floor region" from "everything
 * else", made spatially coherent — which is a different and much weaker claim
 * than the one a model would let us make, and it is the claim the studio makes.
 * The four draggable corners remain the visitor's answer to any of it.
 */

/** Analysis cell, in pixels. Small enough to follow a chair leg, large enough
    that a thousand of them is still cheap on a phone at video rate. */
const CELL = 8;

export type FloorMask = {
  cols: number;
  rows: number;
  /** 1 where the cell has any of the quad in it. */
  inside: Uint8Array;
  /** 1 where the cell straddles the quad's edge and still needs the per-pixel
      test. A few percent of the grid; everything else skips four cross
      products per pixel. */
  border: Uint8Array;
  /** 1 where the cell is floor and may be painted. */
  floor: Uint8Array;
  /**
   * CAM-01. 1 where the cell sits on the floor/not-floor boundary — it has
   * both a floor and a non-floor cell in its eight neighbours.
   *
   * These are the only cells where the 8-pixel answer is wrong for some of the
   * pixels in it, and they are the only ones that pay for a per-pixel test.
   *
   * NOT "a few percent", which is what this comment said first and what the
   * `border` band actually is. Measured with six objects in the quad, the band
   * is 41% of it at 400×300 and 50% at 640×480, because it is three rings
   * around every object's perimeter and a furnished room has a lot of
   * perimeter. On an empty floor it is zero. The cost is real and is stated in
   * the commit rather than hidden behind an adjective.
   */
  edge: Uint8Array;
  /**
   * The numbers the per-cell decision was made with, so the per-pixel
   * refinement can make THE SAME decision at higher resolution rather than a
   * second, subtly different one. A refinement that disagrees with the mask is
   * a new mask with no tests.
   */
  stats: {
    medU: number;
    medV: number;
    medRes: number;
    sigma: number;
    chromaTol: number;
    lumK: number;
    lightNotObject: number;
    /** The floor's luminance profile down the frame, by cell row. */
    profile: Float32Array;
  };
  /** Robust centre of the floor region's luminance, 0–1. */
  medianLuminance: number;
  /** Fraction of in-quad cells judged to be something standing on the floor. */
  occluded: number;
};

const medianOf = (xs: number[]): number => {
  if (!xs.length) return 0;
  const a = [...xs].sort((p, q) => p - q);
  const m = a.length >> 1;
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2;
};

/** 1.4826 × MAD is the consistent estimator of σ for a normal distribution. */
const robustSigma = (xs: number[], centre: number): number =>
  1.4826 * medianOf(xs.map((x) => Math.abs(x - centre)));

/**
 * Decide, per cell, whether the photograph shows floor there.
 *
 * Exported and pure so the fixture set in audit.test.ts can hold it to a
 * number rather than to a description.
 */
export function buildFloorMask(px: Pixels, quad: Quad, options: MaskOptions = {}): FloorMask {
  const cols = Math.max(1, Math.ceil(px.width / CELL));
  const rows = Math.max(1, Math.ceil(px.height / CELL));
  const n = cols * rows;

  const lum = new Float32Array(n);
  const cu = new Float32Array(n);
  const cv = new Float32Array(n);
  const count = new Int32Array(n);

  for (let y = 0; y < px.height; y += 2) {
    const ny = (y + 0.5) / px.height;
    const row = (y / CELL) | 0;
    for (let x = 0; x < px.width; x += 2) {
      const nx = (x + 0.5) / px.width;
      if (!inQuad(quad, nx, ny)) continue;
      const i = (y * px.width + x) * 4;
      const r = px.data[i]!;
      const g = px.data[i + 1]!;
      const b = px.data[i + 2]!;
      const c = ((x / CELL) | 0) + row * cols;
      lum[c] += fastLuminance(r, g, b);
      const ch = chromaOf(r, g, b);
      cu[c] += ch.u;
      cv[c] += ch.v;
      count[c] += 1;
    }
  }

  const live: number[] = [];
  for (let c = 0; c < n; c += 1) {
    if (count[c] === 0) continue;
    lum[c] /= count[c]!;
    cu[c] /= count[c]!;
    cv[c] /= count[c]!;
    live.push(c);
  }

  /* A FLOOR IS NOT ONE BRIGHTNESS, IT IS A GRADIENT.
   *
   * Light falls off with depth. In an ordinary room the near floor is a third
   * brighter than the far floor, and near a window more than that. Comparing
   * every cell to ONE number therefore flags the far half of a perfectly
   * ordinary floor as an object — which is exactly what the live camera showed:
   * pointed at a room it repainted the near floor and left big unexplained
   * patches of the old floor further in.
   *
   * So the comparison is made against the floor's own profile down the frame.
   * Take the median luminance of each cell ROW, smooth it, and measure every
   * cell against its own row. What is left after that is the residual — how far
   * this cell departs from what the floor is doing at that depth — and the
   * residual is the thing that is flat enough for a single threshold to mean
   * something at the top of the frame and the bottom.
   *
   * A row's median is robust to whatever is standing in that row, for the same
   * reason the global one was: an object has to cover more than half the row
   * before it moves it, and an object covering more than half a row is a rug,
   * which the mode test below still catches.
   */
  const rowMedian = new Float32Array(rows).fill(NaN);
  for (let ry = 0; ry < rows; ry += 1) {
    const inRow: number[] = [];
    for (let cx = 0; cx < cols; cx += 1) {
      const c = cx + ry * cols;
      if (count[c] > 0) inRow.push(lum[c]!);
    }
    if (inRow.length >= 3) rowMedian[ry] = medianOf(inRow);
  }
  /* A LINE THROUGH THE ROW MEDIANS, NOT THE ROW MEDIANS THEMSELVES.
   *
   * Taking each row's own median follows the floor's falloff perfectly — and
   * also follows a band of furniture, because a row that is mostly sofa has a
   * sofa's median. On the fourteen-object fixture that lifted the profile to
   * the objects' own level in the rows they occupy and hid an oak stair riser
   * inside it.
   *
   * Light falling off with depth is close to linear over the height of one
   * frame, and a straight line cannot be bent by one band of furniture the way
   * a per-row value can. So fit one, by least squares over the rows that have
   * enough of the quad in them to have a median at all. What the line cannot
   * follow, the residual threshold's own slack absorbs. */
  let sw = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let ry = 0; ry < rows; ry += 1) {
    const v = rowMedian[ry]!;
    if (Number.isNaN(v)) continue;
    sw += 1;
    sx += ry;
    sy += v;
    sxx += ry * ry;
    sxy += ry * v;
  }
  const profile = new Float32Array(rows);
  const denom = sw * sxx - sx * sx;
  if (sw >= 3 && Math.abs(denom) > 1e-9) {
    const slope = (sw * sxy - sx * sy) / denom;
    const intercept = (sy - slope * sx) / sw;
    for (let ry = 0; ry < rows; ry += 1) profile[ry] = intercept + slope * ry;
  } else {
    const flat = sw ? sy / sw : 0;
    for (let ry = 0; ry < rows; ry += 1) profile[ry] = flat;
  }

  const residual = new Float32Array(n);
  for (const c of live) residual[c] = lum[c]! - profile[(c / cols) | 0]!;

  /* THE FLOOR IS THE MODE OF THE RESIDUAL.
   *
   * The median survives up to half the region being something else, which is
   * not enough: a living room can hold a rug, a sofa, a table and a dog inside
   * the quad, and those are mostly LIGHTER than a mid oak floor, so the
   * contamination is large and one-sided.
   *
   * So take the DOMINANT SURFACE. Histogram the residuals, find the heaviest
   * mode, and take the centre and spread from it. Robust to any amount of
   * contamination provided no single object covers more of the quad than the
   * floor does — the same assumption the quad itself encodes, and when it fails
   * the visitor drags the corners. */
  const BINS = 64;
  const SPREAD = 0.5;
  const hist = new Int32Array(BINS);
  const binOf = (r: number) =>
    Math.min(BINS - 1, Math.max(0, Math.round(((r + SPREAD) / (2 * SPREAD)) * (BINS - 1))));
  for (const c of live) hist[binOf(residual[c]!)] += 1;

  /* SMOOTH FIRST, AND TAKE THE HEAVIEST MODE — NOT THE TALLEST BIN.
   *
   * A real floor has grain, so its cells spread across adjacent bins. A rug is
   * flat, so all of its land in one. Measured on a room with a large pale rug,
   * the floor held 780 cells over two bins while the rug held 420 in a single
   * bin — and the tallest bin was the RUG's. The mask then took the rug for the
   * floor and painted oak onto it and nothing else. Texture is evidence of
   * floor; a rule that punishes it is the wrong rule. */
  const smooth = new Float32Array(BINS);
  for (let b = 0; b < BINS; b += 1) {
    smooth[b] = (hist[Math.max(0, b - 1)]! + hist[b]! * 2 + hist[Math.min(BINS - 1, b + 1)]!) / 4;
  }

  /* Two brakes on how far a mode may grow. KEEP is the height a neighbouring
     bin must still have to be the same surface; WIDTH is the hard stop, because
     beyond it this is not one surface under different light, it is two. */
  const MAX_SPAN = 12;
  const spanOf = (peak: number): { lo: number; hi: number; mass: number } => {
    const keep = smooth[peak]! * 0.35;
    let a = peak;
    let z = peak;
    while (a > 0 && smooth[a - 1]! >= keep && z - (a - 1) < MAX_SPAN) a -= 1;
    while (z < BINS - 1 && smooth[z + 1]! >= keep && z + 1 - a < MAX_SPAN) z += 1;
    let mass = 0;
    for (let b = a; b <= z; b += 1) mass += hist[b]!;
    return { lo: a, hi: z, mass };
  };

  let best = { lo: 0, hi: BINS - 1, mass: -1, peak: 0 };
  for (let b = 0; b < BINS; b += 1) {
    if (smooth[b]! <= 0) continue;
    const left = b > 0 ? smooth[b - 1]! : -1;
    const right = b < BINS - 1 ? smooth[b + 1]! : -1;
    if (smooth[b]! < left || smooth[b]! < right) continue;
    const span = spanOf(b);
    if (span.mass > best.mass) best = { ...span, peak: b };
  }

  const mode = live.filter((c) => {
    const b = binOf(residual[c]!);
    return b >= best.lo && b <= best.hi;
  });
  /* Too small a mode is noise rather than a surface; fall back to everything
     inside the quad, which is what this function did before. */
  const surface = mode.length >= 8 ? mode : live;

  const res = surface.map((c) => residual[c]!);
  const medRes = medianOf(res);
  const medU = medianOf(surface.map((c) => cu[c]!));
  const medV = medianOf(surface.map((c) => cv[c]!));
  /* Set after the mask is final — see below. */
  let medLum = medianOf(surface.map((c) => lum[c]!));

  /* MEMBERSHIP COMES FROM THE MODE; SCALE COMES FROM ITS CORE.
   *
   * The expanded mode is deliberately generous so a floor stays one surface.
   * Measuring the spread across that whole span reads the generosity back as
   * variation — on the fourteen-object fixture it put the deviation at its cap,
   * which moved the threshold past an oak stair riser standing on the floor it
   * matched. The three bins at the peak are the floor's own grain, without the
   * reach the membership rule needs. */
  const core = surface.filter((c) => Math.abs(binOf(residual[c]!) - best.peak) <= 1);
  const coreRes = (core.length >= 8 ? core : surface).map((c) => residual[c]!);
  const sigma = Math.min(0.03, Math.max(0.008, robustSigma(coreRes, medianOf(coreRes))));


  const chromaTol = options.chromaTolerance ?? 0.075;
  const lumK = options.luminanceSigmas ?? 2.2;

  /* SAME COLOUR, DIFFERENT BRIGHTNESS, IS LIGHT — NOT AN OBJECT.
   *
   * Chroma is normalised out of brightness, so a pool of sunlight on an oak
   * floor has the oak's chroma and the sun's luminance. The luminance test
   * alone calls that an object and refuses to paint it, and the result is a
   * new floor with a blotch of the old one wherever a window falls — in every
   * daylit room, which is most of them. render.test.ts caught it: a matte and a
   * satin floor stopped differing, because the lit pool the sheen shows up in
   * was the part being skipped.
   *
   * So below a small fraction of the chroma tolerance, brightness is taken as
   * light and the luminance test does not apply.
   *
   * THE PRICE OF THAT, STATED RATHER THAN HIDDEN: an object made of the same
   * wood as the floor — an oak stair riser is the case in the fixture — is no
   * longer separable by colour statistics, and gets painted. That is a real
   * limit and it is the right trade: a riser painted at the edge of the frame
   * is a cosmetic error on a surface that is quoted separately anyway, and a
   * sunlit patch left unpainted is the feature visibly not working, in the
   * middle of the picture, for almost everyone. Telling the two apart needs
   * geometry — a plane normal, or depth — and this codebase has neither and
   * does not claim to. */
  const LIGHT_NOT_OBJECT = chromaTol * 0.3;

  const floor = new Uint8Array(n);
  for (const c of live) {
    const dChroma = Math.hypot(cu[c]! - medU, cv[c]! - medV);
    if (dChroma > chromaTol) { floor[c] = 0; continue; }
    if (dChroma < LIGHT_NOT_OBJECT) { floor[c] = 1; continue; }
    floor[c] = Math.abs(residual[c]! - medRes) / sigma > lumK ? 0 : 1;
  }

  /* ── morphology, on cells that are inside the quad ─────────────────────── */
  const inside = new Uint8Array(n);
  for (const c of live) inside[c] = 1;

  /* Which cells the quad's edge actually cuts. Four corner tests each; a cell
     whose four corners agree is wholly in or wholly out. */
  const border = new Uint8Array(n);
  for (const c of live) {
    const cx = (c % cols) * CELL;
    const cy = ((c / cols) | 0) * CELL;
    let inCount = 0;
    for (const [ox, oy] of [[0, 0], [CELL, 0], [0, CELL], [CELL, CELL]] as const) {
      if (inQuad(quad, (cx + ox) / px.width, (cy + oy) / px.height)) inCount += 1;
    }
    if (inCount !== 4) border[c] = 1;
  }

  const neighbours = (c: number): number[] => {
    const x = c % cols;
    const y = (c / cols) | 0;
    const out: number[] = [];
    for (let dy = -1; dy <= 1; dy += 1)
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dy) continue;
        const nx2 = x + dx;
        const ny2 = y + dy;
        if (nx2 < 0 || ny2 < 0 || nx2 >= cols || ny2 >= rows) continue;
        out.push(nx2 + ny2 * cols);
      }
    return out;
  };

  /** Grow the NOT-floor set by one ring. */
  const growObjects = (src: Uint8Array): Uint8Array => {
    const out = new Uint8Array(src);
    for (const c of live) {
      if (src[c] === 0) continue;
      for (const k of neighbours(c)) if (inside[k] && src[k] === 0) { out[c] = 0; break; }
    }
    return out;
  };

  /** Shrink the NOT-floor set by one ring. */
  const shrinkObjects = (src: Uint8Array): Uint8Array => {
    const out = new Uint8Array(src);
    for (const c of live) {
      if (src[c] === 1) continue;
      let anyFloor = false;
      for (const k of neighbours(c)) if (inside[k] && src[k] === 1) { anyFloor = true; break; }
      if (!anyFloor) continue;
      let objectNeighbours = 0;
      for (const k of neighbours(c)) if (inside[k] && src[k] === 0) objectNeighbours += 1;
      /* A cell surrounded mostly by floor was grain, not a chair leg. */
      if (objectNeighbours <= 2) out[c] = 1;
    }
    return out;
  };

  /* CLOSE: grow then shrink. Fills the wood-coloured middle of an object whose
     edges gave it away, and leaves genuine floor alone. */
  let m = growObjects(floor);
  m = shrinkObjects(m);
  /* FILL WHAT THE OBJECT ENCLOSES.
   *
   * The edges of an oak stair riser give it away against an oak floor — a
   * luminance step of a few hundredths — while its middle is, colourimetrically,
   * floor. Grow-and-shrink only reaches one cell in from that edge, so the
   * riser came back eighty-six percent painted with a protected rim: the exact
   * "sticker" look this renderer exists to avoid.
   *
   * Real floor is connected to the edge of the quad. Anything the object ring
   * encloses is not floor, whatever colour it is. So flood the floor set
   * inward from the quad's boundary and give back everything the flood never
   * reached. This needs no idea of what the object is, which is the point. */
  const reached = new Uint8Array(n);
  const stack: number[] = [];
  for (const c of live) {
    if (m[c] !== 1) continue;
    const x = c % cols;
    const y = (c / cols) | 0;
    const border =
      x === 0 || y === 0 || x === cols - 1 || y === rows - 1 ||
      neighbours(c).some((k) => !inside[k]);
    if (border) { reached[c] = 1; stack.push(c); }
  }
  /* The flood is 4-CONNECTED while the object ring is 8-connected. That
     pairing is not a detail: with both at 8, the flood slips diagonally
     between two object cells that touch only at a corner, and every enclosed
     region leaks. */
  const orthogonal = (c: number): number[] => {
    const x = c % cols;
    const y = (c / cols) | 0;
    const out: number[] = [];
    if (x > 0) out.push(c - 1);
    if (x < cols - 1) out.push(c + 1);
    if (y > 0) out.push(c - cols);
    if (y < rows - 1) out.push(c + cols);
    return out;
  };
  while (stack.length) {
    const c = stack.pop()!;
    for (const k of orthogonal(c)) {
      if (!inside[k] || reached[k] || m[k] !== 1) continue;
      reached[k] = 1;
      stack.push(k);
    }
  }
  for (const c of live) if (m[c] === 1 && reached[c] === 0) m[c] = 0;

  /* One more ring of margin around whatever survived. Conservative on purpose:
     a rim of old floor is a rough edge, oak across the cat is a toy. */
  m = growObjects(m);

  /* CAM-01 — THE BAND WHERE EIGHT PIXELS IS THE WRONG ANSWER.
   *
   * Everything above decides floor-or-object for an 8×8 cell and then dilates
   * once more for margin. Measured on a synthetic room whose object edge is
   * known by construction, that leaves a band of the ORIGINAL floor 16 pixels
   * wide against a vertical edge and up to 39 against a 45° one, stepping
   * between 20 distinct offsets down the frame. That band is the halo around
   * every sofa, rug and leg in the output, and it is what reads as "blocky".
   *
   * The cell decision is right about the INTERIOR of an object and right about
   * open floor. It is only wrong within one cell of the boundary. So mark that
   * boundary and let compositeFloor answer per pixel there — see refineEdge. */
  const edge = new Uint8Array(n);
  for (const c of live) {
    let sawFloor = m[c] === 1;
    let sawObject = m[c] === 0;
    for (const k of neighbours(c)) {
      if (!inside[k]) continue;
      if (m[k] === 1) sawFloor = true;
      else sawObject = true;
    }
    if (sawFloor && sawObject) edge[c] = 1;
  }

  /* WIDE ENOUGH TO REACH THE REAL EDGE.
   *
   * One ring recovers one cell. The margin this has to undo is thicker than
   * that — the close grows the object set once and the final margin pass grows
   * it again — so a one-cell band measured 8px of the 16px gap on a vertical
   * edge and 19 of 34 on a diagonal: better, and still a halo. Two more rings
   * put the per-pixel test everywhere the cell grid could have been wrong,
   * and nowhere else. */
  for (let pass = 0; pass < 2; pass += 1) {
    const grown = new Uint8Array(edge);
    for (const c of live) {
      if (edge[c] === 1) continue;
      for (const k of neighbours(c)) {
        if (inside[k] && edge[k] === 1) { grown[c] = 1; break; }
      }
    }
    edge.set(grown);
  }

  let occludedCells = 0;
  for (const c of live) if (m[c] === 0) occludedCells += 1;

  /* THE SHADING BASELINE IS THE MEDIAN OF WHAT WE ARE ACTUALLY PAINTING.
   *
   * compositeFloor keeps the room's light by holding each pixel's luminance
   * RATIO against this number, so it has to be the floor's own level and
   * nothing else. Taking it from the statistics that BUILT the mask is subtly
   * wrong: those run over every cell the quad touches, including the sliver of
   * wall a quad's top edge usually clips, and a wall is four times brighter
   * than a mid oak floor. With the baseline up there every floor pixel lands
   * below one, the shading clamp flattens the whole picture, and the sheen term
   * — which only acts above one — never fires at all. A satin floor and a matte
   * floor come out identical, which is what render.test.ts caught.
   *
   * The cells the mask finally calls floor are exactly the right sample. */
  const paintedCells = live.filter((c) => m[c] === 1);
  if (paintedCells.length >= 4) {
    /* THE MEAN HERE, NOT THE MEDIAN — and the difference is the whole sheen.
     *
     * Sheen is "returns more light where the room was already bright", so the
     * baseline has to be a value that a bright patch is ABOVE. A median is not:
     * in a room where a window lights more than half the visible floor, the
     * median IS the lit floor, the lit floor's ratio is exactly one, and the
     * gloss term — which only acts above one — never fires anywhere. A matte
     * floor and a satin floor come out identical, in the one room where the
     * difference between them is most visible.
     *
     * Weighted by each cell's sample count so a cell the quad only clips does
     * not carry the same weight as one wholly inside it. */
    let sum = 0;
    let weight = 0;
    for (const c of paintedCells) {
      sum += lum[c]! * count[c]!;
      weight += count[c]!;
    }
    if (weight > 0) medLum = sum / weight;
  }

  return {
    cols,
    rows,
    inside,
    border,
    floor: m,
    edge,
    stats: {
      medU,
      medV,
      medRes,
      sigma,
      chromaTol,
      lumK,
      lightNotObject: LIGHT_NOT_OBJECT,
      profile,
    },
    medianLuminance: medLum,
    occluded: live.length ? occludedCells / live.length : 0,
  };
}

/**
 * CAM-01 — how much of THIS pixel is floor, on the boundary band.
 *
 * The same three-way rule buildFloorMask applies to a cell, applied to a
 * pixel, against the same statistics — so this is the cell decision at higher
 * resolution rather than a second opinion.
 *
 * TWO THINGS MAKE IT SAFE TO PAINT ON WHAT THE CELL GRID REFUSED:
 *
 * 1. It is only consulted inside `mask.edge` — one cell either side of the
 *    boundary. The interior of an object is never reconsidered, so an object
 *    the cell grid protected stays protected in its middle whatever this says.
 * 2. It averages a 3×3 neighbourhood rather than trusting one pixel. A single
 *    pixel of a wood floor differs from the floor's median by more than an
 *    object does — that is what grain IS, and it is the reason the decision
 *    was made on cells in the first place. Three by three is enough to put the
 *    grain back below the threshold without reaching across the edge.
 *
 * Returns coverage in 0..1, not a boolean: a hard per-pixel answer trades an
 * 8-pixel staircase for a 1-pixel one, and the edge of a sofa against a floor
 * is not a hard edge in the photograph either.
 */
function floorCoverageAt(px: Pixels, x: number, y: number, mask: FloorMask, cellRow: number): number {
  const st = mask.stats;
  let lum = 0;
  let u = 0;
  let v = 0;
  let k = 0;
  const x0 = Math.max(0, x - 1);
  const x1 = Math.min(px.width - 1, x + 1);
  const y0 = Math.max(0, y - 1);
  const y1 = Math.min(px.height - 1, y + 1);
  for (let yy = y0; yy <= y1; yy += 1) {
    for (let xx = x0; xx <= x1; xx += 1) {
      const i = (yy * px.width + xx) * 4;
      const r = px.data[i]!;
      const g = px.data[i + 1]!;
      const b = px.data[i + 2]!;
      lum += fastLuminance(r, g, b);
      const ch = chromaOf(r, g, b);
      u += ch.u;
      v += ch.v;
      k += 1;
    }
  }
  if (k === 0) return 0;
  lum /= k;
  u /= k;
  v /= k;

  /* IT MAY NEVER BE MORE PERMISSIVE THAN THE CELL RULE IT REFINES.
   *
   * The first version ramped DOWNWARD past each threshold — full coverage at
   * the threshold, zero a little beyond it. That is looser than the cell test,
   * which is zero AT the threshold, and it cost exactly what you would expect:
   * the two objects whose colour is closest to wood started losing their
   * edges. Measured on the fourteen-object fixture, the cream/jute rug went
   * from under 5% of its pixels painted to 6.3%, and the brass lamp base to
   * 14.9%. AUDIT-01 caught both.
   *
   * So each ramp reaches ZERO at the threshold and full coverage a little
   * INSIDE it. Every pixel the cell rule would have called object is still
   * refused; the ramp only softens pixels that were already going to be
   * painted. The margin this exists to recover is untouched by that, because
   * those cells are ordinary floor sitting well inside both tolerances — they
   * were excluded by the dilation, not by the test. */
  const ramp = (value: number, threshold: number): number => {
    if (value >= threshold) return 0;
    const inside = (threshold - value) / (threshold * 0.35);
    return inside >= 1 ? 1 : inside;
  };

  const dChroma = Math.hypot(u - st.medU, v - st.medV);
  const chromaCoverage = ramp(dChroma, st.chromaTol);
  if (chromaCoverage <= 0) return 0;

  /* Same colour, different brightness, is light rather than an object — the
     rule that keeps a sunlit patch from being skipped. */
  if (dChroma < st.lightNotObject) return chromaCoverage;

  const profile = st.profile[cellRow] ?? 0;
  const z = Math.abs(lum - profile - st.medRes) / Math.max(1e-6, st.sigma);
  return Math.min(chromaCoverage, ramp(z, st.lumK));
}

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

  /* The mask decides WHERE, and carries the robust luminance centre the
     shading is measured against. One pass, reusable across a configuration
     change — which is what makes live video affordable. */
  const mask = options.mask ?? buildFloorMask(px, quad, options);
  if (mask.medianLuminance === 0 && mask.occluded === 0) {
    let any = false;
    for (let c = 0; c < mask.floor.length && !any; c += 1) if (mask.floor[c] === 1) any = true;
    if (!any) return { pixels: out, painted: 0, failure: 'empty-region' };
  }
  const meanLum = Math.max(0.01, mask.medianLuminance);

  const finish = finishById(config.finishId) ?? FINISH_OPTIONS[1]!;
  const sheen = finish.sheen;
  const palette = woodPalette(config.productId, config.finishId, options.grain);

  /* The divisor at the NEAREST point of the quad — the bottom of the frame,
     where the floor is least minified. Every other pixel's level is measured
     against this one, so the near field samples the full tile and the far field
     samples a half or a quarter of it. */
  const nearW = Math.abs(m[6] * 0.5 + m[7] * 1.0 + m[8]);
  const wRef = Number.isFinite(nearW) && nearW > 0 ? nearW : 0;

  let painted = 0;
  let considered = 0;

  /* The mask already knows which cells lie inside the quad — a cell with no
     samples in it got no count and is not floor. So the per-pixel inQuad test,
     four cross products deep, only has to run on the ragged border cells. That
     is a few percent of them. */
  const m00 = m[0];
  const m01 = m[1];
  const m02 = m[2];
  const m10 = m[3];
  const m11 = m[4];
  const m12 = m[5];
  const m20 = m[6];
  const m21 = m[7];
  const m22 = m[8];

  for (let y = 0; y < px.height; y += 1) {
    const ny = (y + 0.5) / px.height;
    const cellRow = ((y / CELL) | 0) * mask.cols;
    for (let x = 0; x < px.width; x += 1) {
      const cell = ((x / CELL) | 0) + cellRow;
      if (mask.inside[cell] !== 1) continue;
      const nx = (x + 0.5) / px.width;
      if (mask.border[cell] === 1 && !inQuad(quad, nx, ny)) continue;
      considered += 1;

      /* Something standing on the floor keeps its own pixels. The decision was
         made for this cell, with its neighbours, not for this pixel alone —
         see buildFloorMask. On the one-cell band either side of the boundary
         it is made per pixel instead, because eight pixels is the wrong answer
         for some of the pixels in those cells and only for those (CAM-01). */
      let alpha = 1;
      if (mask.edge[cell] === 1) {
        alpha = floorCoverageAt(px, x, y, mask, (y / CELL) | 0);
        if (alpha <= 0.02) continue;
      } else if (mask.floor[cell] !== 1) {
        continue;
      }

      const i = (y * px.width + x) * 4;
      const r0 = px.data[i]!;
      const g0 = px.data[i + 1]!;
      const b0 = px.data[i + 2]!;

      const w = m20 * nx + m21 * ny + m22;
      if (w > -1e-12 && w < 1e-12) continue;
      const planX = (m00 * nx + m01 * ny + m02) / w;
      const planY = (m10 * nx + m11 * ny + m12) / w;

      const sample = samplePattern(planX, planY, config.patternId, width.inches);
      /* MIP LEVEL FROM THE PROJECTIVE DIVISOR.
         `w` is the homography's homogeneous divisor at this pixel, which IS the
         depth scale: large near the camera, small at the wall line. The texture
         minifies by the same factor, so the level that matches is the log2 of
         the ratio against the near edge. No derivatives, no extra sampling —
         the number was already computed to project the point. */
      const lod = wRef > 0 ? Math.log2(Math.max(1, wRef / Math.max(1e-6, Math.abs(w)))) : 0;
      const wood = woodColourFrom(palette, sample, width.inches, lod);

      /* The room's own light, as a ratio against the region mean. Clamped so a
         blown highlight or a black shadow cannot produce a floor nobody would
         believe. */
      const lum = fastLuminance(r0, g0, b0);
      const shading = Math.max(0.45, Math.min(1.8, lum / meanLum));

      /* Sheen: a surface that returns light returns MORE of it where the room
         was already bright. Which is what makes a satin floor look satin and a
         matte floor look matte, with no extra input. */
      const gloss = 1 + sheen * Math.max(0, shading - 1) * 1.4;

      const wr = wood.r * shading * gloss;
      const wg = wood.g * shading * gloss;
      const wb = wood.b * shading * gloss;
      if (alpha >= 0.999) {
        out.data[i] = clamp255(wr);
        out.data[i + 1] = clamp255(wg);
        out.data[i + 2] = clamp255(wb);
      } else {
        /* Partial coverage on the boundary band. The old floor is what shows
           through, which is what it does at a real edge. */
        const inv = 1 - alpha;
        out.data[i] = clamp255(wr * alpha + r0 * inv);
        out.data[i + 1] = clamp255(wg * alpha + g0 * inv);
        out.data[i + 2] = clamp255(wb * alpha + b0 * inv);
      }
      out.data[i + 3] = 255;
      painted += alpha;
    }
  }

  return { pixels: out, painted: considered === 0 ? 0 : painted / considered };
}
