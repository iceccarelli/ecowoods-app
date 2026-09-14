/**
 * The renderer, asserted.
 *
 * A visualiser nobody can test regresses into a sticker, quietly, and the first
 * person to notice is a homeowner who stops trusting the picture. So the
 * geometry is checked against known answers, the tiling is checked for gaps and
 * overlaps the way a floor would be, and the composite is checked for the two
 * properties that make it read as a room: the light survives and the furniture
 * survives.
 */
import { describe, expect, it } from 'vitest';
import {
  BLOCK_RATIO,
  applyHomography,
  compositeFloor,
  hash2,
  parseRgba,
  planSizeInches,
  samplePattern,
  solveHomography,
  buildFloorMask,
  createCompositeBuffer,
  woodColourAt,
  woodColourFrom,
  woodPalette,
  makeGrainTexture,
  RUN_LENGTH_RATIO,
} from './render';
import { relativeLuminance, type Pixels, type Quad } from './room';
import { FLOOR_PRODUCTS, allConfigurations, type FloorConfiguration } from './catalog';

const UNIT: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

describe('the projective map', () => {
  it('takes the four corners exactly where they were sent', () => {
    const dst: Quad = [
      { x: 10, y: 20 },
      { x: 210, y: 5 },
      { x: 260, y: 180 },
      { x: -20, y: 160 },
    ];
    const m = solveHomography(UNIT, dst)!;
    expect(m).not.toBeNull();
    for (let i = 0; i < 4; i += 1) {
      const p = applyHomography(m, UNIT[i]!)!;
      expect(p.x).toBeCloseTo(dst[i]!.x, 6);
      expect(p.y).toBeCloseTo(dst[i]!.y, 6);
    }
  });

  it('round-trips through its own inverse', () => {
    const quad: Quad = [
      { x: 0.3, y: 0.6 },
      { x: 0.72, y: 0.6 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const forward = solveHomography(quad, UNIT)!;
    const back = solveHomography(UNIT, quad)!;
    const probe = { x: 0.5, y: 0.8 };
    const there = applyHomography(forward, probe)!;
    const home = applyHomography(back, there)!;
    expect(home.x).toBeCloseTo(probe.x, 6);
    expect(home.y).toBeCloseTo(probe.y, 6);
  });

  it('is genuinely projective, not affine — parallel lines converge', () => {
    /* A trapezoid receiving a square: equal steps in plan space must produce
       UNEQUAL steps in the image, or the floor is a sticker. */
    const trapezoid: Quad = [
      { x: 0.3, y: 0.5 },
      { x: 0.7, y: 0.5 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const m = solveHomography(UNIT, trapezoid)!;
    const near = applyHomography(m, { x: 0, y: 0.9 })!;
    const nearR = applyHomography(m, { x: 1, y: 0.9 })!;
    const far = applyHomography(m, { x: 0, y: 0.1 })!;
    const farR = applyHomography(m, { x: 1, y: 0.1 })!;
    expect(nearR.x - near.x).toBeGreaterThan(farR.x - far.x);
  });

  it('returns null for a degenerate quad rather than emitting NaN', () => {
    const collapsed: Quad = [
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
    ];
    expect(solveHomography(UNIT, collapsed)).toBeNull();
  });
});

describe('board scale', () => {
  it('grows with the area the visitor typed and never with the price', () => {
    expect(planSizeInches(1600)).toBeGreaterThan(planSizeInches(400));
    /* A bigger nudge means fewer inches across the frame — bigger boards. */
    expect(planSizeInches(900, 2)).toBeLessThan(planSizeInches(900, 1));
  });

  it('refuses a nonsensical area rather than dividing by zero', () => {
    expect(Number.isFinite(planSizeInches(0))).toBe(true);
    expect(planSizeInches(0)).toBeGreaterThan(0);
  });
});

describe('the tilings are floors, not wallpaper', () => {
  const patterns = ['straight', 'diagonal', 'herringbone', 'chevron'];

  it('returns a board for every point, with in-range coordinates', () => {
    for (const pattern of patterns) {
      for (let x = 0; x < 200; x += 3.3) {
        for (let y = 0; y < 200; y += 4.7) {
          const s = samplePattern(x, y, pattern, 5);
          expect(Number.isFinite(s.key), pattern).toBe(true);
          expect(s.along, pattern).toBeGreaterThanOrEqual(0);
          expect(s.along, pattern).toBeLessThanOrEqual(1.0001);
          expect(s.across, pattern).toBeGreaterThanOrEqual(0);
          expect(s.across, pattern).toBeLessThanOrEqual(1.0001);
          expect(s.edge, pattern).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('herringbone covers every cell exactly once, with both orientations', () => {
    /* One board per cell, and the two orientations alternate in blocks of
       BLOCK_RATIO — the identity the classifier is derived from. */
    const seen = new Map<number, Set<number>>();
    let alongX = 0;
    let alongY = 0;
    for (let i = 0; i < 2 * BLOCK_RATIO * 4; i += 1) {
      for (let j = 0; j < 2 * BLOCK_RATIO * 4; j += 1) {
        const s = samplePattern(i + 0.5, j + 0.5, 'herringbone', 1);
        if (s.axis === 1) alongX += 1;
        else alongY += 1;
        if (!seen.has(s.key)) seen.set(s.key, new Set());
        seen.get(s.key)!.add(i * 1000 + j);
      }
    }
    /* Half the cells run each way, which is what herringbone is. */
    expect(Math.abs(alongX - alongY)).toBeLessThanOrEqual(2 * BLOCK_RATIO * 4);
    /* Each board owns exactly BLOCK_RATIO cells away from the sampled edges. */
    const sizes = [...seen.values()].map((s) => s.size);
    expect(Math.max(...sizes)).toBe(BLOCK_RATIO);
  });

  it('staggers end seams so a straight floor has no ladders', () => {
    const a = samplePattern(2.5, 10, 'straight', 5);
    const b = samplePattern(7.5, 10, 'straight', 5);
    expect(a.along).not.toBeCloseTo(b.along, 3);
  });

  it('mirrors chevron columns, which is what makes the V', () => {
    const left = samplePattern(1, 20, 'chevron', 5);
    const right = samplePattern(5 * BLOCK_RATIO + 1, 20, 'chevron', 5);
    expect(left.axis).not.toBe(right.axis);
  });

  it('marks the board edges, so a floor reads as boards', () => {
    const middle = samplePattern(2.5, 22.5, 'straight', 5);
    const seam = samplePattern(0.02, 22.5, 'straight', 5);
    expect(seam.edge).toBeLessThan(middle.edge);
  });
});

describe('the wood is drawn from the catalogue and nothing else', () => {
  it('is deterministic — the same board is the same colour every time', () => {
    const s = samplePattern(13.7, 41.2, 'herringbone', 5);
    const a = woodColourAt('white-oak', 'satin', s);
    const b = woodColourAt('white-oak', 'satin', s);
    expect(a).toEqual(b);
  });

  it('puts every species inside its own two pigments, give or take the finish', () => {
    for (const product of FLOOR_PRODUCTS) {
      let min = 255;
      let max = 0;
      for (let x = 0; x < 60; x += 1.7) {
        const s = samplePattern(x, x * 1.3, 'straight', 5);
        const c = woodColourAt(product.id, 'natural-matte', s);
        min = Math.min(min, c.r);
        max = Math.max(max, c.r);
      }
      const base = parseInt(product.base.slice(1, 3), 16);
      const grain = parseInt(product.grain.slice(1, 3), 16);
      expect(min, product.id).toBeGreaterThanOrEqual(Math.min(base, grain) * 0.6);
      expect(max, product.id).toBeLessThanOrEqual(Math.max(base, grain) * 1.2);
    }
  });

  it('darkens a fumed oak against the same oak untreated', () => {
    const s = samplePattern(11, 23, 'straight', 5);
    const plain = woodColourAt('white-oak', 'natural-matte', s);
    const smoked = woodColourAt('white-oak', 'smoked', s);
    expect(relativeLuminance(smoked.r, smoked.g, smoked.b)).toBeLessThan(
      relativeLuminance(plain.r, plain.g, plain.b),
    );
  });

  it('varies hickory more board to board than hard maple, as the catalogue says', () => {
    const spread = (id: string) => {
      const values: number[] = [];
      for (let k = 0; k < 200; k += 1) {
        values.push(woodColourAt(id, 'natural-matte', { key: k, edge: 1, along: 0.5, across: 0.5, axis: 0, lenIn: 45 }).r);
      }
      return Math.max(...values) - Math.min(...values);
    };
    expect(spread('hickory')).toBeGreaterThan(spread('hard-maple'));
  });

  it('parses the rgba strings the finishes already carry', () => {
    expect(parseRgba('rgba(196, 152, 106, 0.06)')).toEqual({ r: 196, g: 152, b: 106, a: 0.06 });
    expect(parseRgba('rgb(1, 2, 3)')).toEqual({ r: 1, g: 2, b: 3, a: 1 });
    expect(parseRgba('not a colour').a).toBe(0);
  });

  it('hashes without Math.random, so a shared link shows the same floor', () => {
    expect(hash2(3, 9)).toBe(hash2(3, 9));
    expect(hash2(3, 9)).not.toBe(hash2(9, 3));
  });
});

/* ── the composite ────────────────────────────────────────────────────────── */

type Rgb = { r: number; g: number; b: number };

function frame(width: number, height: number, paint: (x: number, y: number) => Rgb): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const c = paint(x, y);
      const i = (y * width + x) * 4;
      data[i] = c.r;
      data[i + 1] = c.g;
      data[i + 2] = c.b;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

const FLOOR_QUAD: Quad = [
  { x: 0.2, y: 0.5 },
  { x: 0.8, y: 0.5 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

const CONFIG: FloorConfiguration = {
  productId: 'white-oak',
  finishId: 'satin',
  patternId: 'straight',
  widthId: '5',
};

const pixelAt = (px: Pixels, x: number, y: number) => {
  const i = (y * px.width + x) * 4;
  return { r: px.data[i]!, g: px.data[i + 1]!, b: px.data[i + 2]! };
};

describe('compositing a floor into a photograph', () => {
  const base = frame(160, 120, (x, y) => (y < 60 ? { r: 232, g: 226, b: 214 } : { r: 120, g: 112, b: 104 }));

  it('paints inside the quad and leaves the walls alone', () => {
    const { pixels, painted } = compositeFloor(base, FLOOR_QUAD, CONFIG, { squareFeet: 400 });
    expect(painted).toBeGreaterThan(0.8);
    expect(pixelAt(pixels, 80, 10)).toEqual(pixelAt(base, 80, 10));
    expect(pixelAt(pixels, 80, 110)).not.toEqual(pixelAt(base, 80, 110));
  });

  it('never mutates the photograph it was given', () => {
    const copy = new Uint8ClampedArray(base.data);
    compositeFloor(base, FLOOR_QUAD, CONFIG, { squareFeet: 400 });
    expect(base.data).toEqual(copy);
  });

  it('keeps the room’s own light — a shadow stays a shadow', () => {
    /* Same floor, one half in shade. The composite must preserve the ordering
       of brightness, because that ordering IS the lighting of the room. */
    const shaded = frame(160, 120, (x, y) => {
      if (y < 60) return { r: 232, g: 226, b: 214 };
      const k = x < 80 ? 0.55 : 1;
      return { r: Math.round(150 * k), g: Math.round(140 * k), b: Math.round(130 * k) };
    });
    const { pixels } = compositeFloor(shaded, FLOOR_QUAD, CONFIG, { squareFeet: 400 });
    const dark = pixelAt(pixels, 40, 110);
    const lit = pixelAt(pixels, 120, 110);
    expect(relativeLuminance(dark.r, dark.g, dark.b)).toBeLessThan(
      relativeLuminance(lit.r, lit.g, lit.b),
    );
  });

  it('leaves what is standing on the floor alone', () => {
    /* A strongly coloured rug inside the quad. Painting oak across it is the
       single thing that makes a visualiser look like a toy. */
    const withRug = frame(160, 120, (x, y) => {
      if (y < 60) return { r: 232, g: 226, b: 214 };
      const onRug = x > 60 && x < 100 && y > 80 && y < 110;
      return onRug ? { r: 30, g: 90, b: 160 } : { r: 150, g: 140, b: 130 };
    });
    const { pixels } = compositeFloor(withRug, FLOOR_QUAD, CONFIG, { squareFeet: 400 });
    expect(pixelAt(pixels, 80, 95)).toEqual(pixelAt(withRug, 80, 95));
    expect(pixelAt(pixels, 20, 115)).not.toEqual(pixelAt(withRug, 20, 115));
  });

  it('renders every layable configuration without throwing or blanking', () => {
    for (const config of allConfigurations()) {
      const { painted, failure } = compositeFloor(base, FLOOR_QUAD, config, { squareFeet: 900 });
      expect(failure, JSON.stringify(config)).toBeUndefined();
      expect(painted, JSON.stringify(config)).toBeGreaterThan(0.5);
    }
  });

  it('reports a degenerate quad instead of drawing nonsense', () => {
    const collapsed: Quad = [
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
    ];
    const { failure, painted } = compositeFloor(base, collapsed, CONFIG, { squareFeet: 400 });
    expect(failure).toBe('degenerate-quad');
    expect(painted).toBe(0);
  });

  it('gives a satin floor more highlight than a matte one in the same room', () => {
    /* A pool of light on the floor, the way a window puts one there. Sheen is
       a property of how a surface returns light, so a room with no variation
       in its light cannot show the difference — and neither can a test. */
    const bright = frame(160, 120, (x, y) => {
      if (y < 60) return { r: 240, g: 236, b: 228 };
      const pool = Math.hypot(x - 80, y - 100) < 45 ? 1.45 : 1;
      const v = Math.round(150 * pool);
      return { r: v, g: Math.round(v * 0.95), b: Math.round(v * 0.9) };
    });
    const matte = compositeFloor(bright, FLOOR_QUAD, { ...CONFIG, finishId: 'natural-matte' }, { squareFeet: 400 });
    const satin = compositeFloor(bright, FLOOR_QUAD, { ...CONFIG, finishId: 'satin' }, { squareFeet: 400 });
    const lum = (px: Pixels) => {
      let total = 0;
      let n = 0;
      for (let y = 70; y < 118; y += 1) {
        for (let x = 20; x < 140; x += 1) {
          const c = pixelAt(px, x, y);
          total += relativeLuminance(c.r, c.g, c.b);
          n += 1;
        }
      }
      return total / n;
    };
    expect(lum(satin.pixels)).toBeGreaterThan(lum(matte.pixels));
  });
});

/**
 * A grating: one smooth cycle every eight texels, at low contrast.
 *
 * Wood grain is a band-limited signal, and this is the smallest honest model of
 * one. Low contrast because the renderer clamps the photograph's detail term —
 * a knot is genuinely near-black and a blown highlight is not information — and
 * a probe that sits on the clamp measures the clamp instead of the filter. A
 * one-texel checkerboard is the other trap: bilinear reconstruction of it is
 * itself an aliasing pattern, so the measurement moves with the sampling grid.
 */
function gratingTexture(size = 64, cycleTexels = 8) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const v = 128 + 25 * Math.sin((2 * Math.PI * (x + y * 0.3)) / cycleTexels);
      const i = (y * size + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return makeGrainTexture(data, size, size);
}

function flatTexture(size = 64) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 128;
    data[i + 1] = 128;
    data[i + 2] = 128;
    data[i + 3] = 255;
  }
  return makeGrainTexture(data, size, size);
}

describe('the mip pyramid', () => {
  it('goes all the way down to one texel', () => {
    const tex = flatTexture(64);
    expect(tex.levels.map((l) => l.width)).toEqual([64, 32, 16, 8, 4, 2, 1]);
    expect(tex.levels[tex.levels.length - 1]!.height).toBe(1);
  });

  it('box-filters, so a grating flattens towards its own mean', () => {
    /* One cycle every eight texels is gone by the third halving, and what is
       left must be the mean — not a phase of the original. A level that still
       carries the grating is point-sampling, and the pyramid is decoration. */
    const tex = gratingTexture(64, 8);
    const swing = (lv: { data: Uint8ClampedArray }) => {
      let lo = 255;
      let hi = 0;
      for (let i = 0; i < lv.data.length; i += 4) {
        lo = Math.min(lo, lv.data[i]!);
        hi = Math.max(hi, lv.data[i]!);
      }
      return hi - lo;
    };
    expect(swing(tex.levels[0]!)).toBeGreaterThan(40);
    expect(swing(tex.levels[3]!)).toBeLessThan(6);
  });

  it('does not stop before a room-sized scene needs it to', () => {
    /* A 512-texel tile covering ten inches, in a photograph where one screen
       pixel covers an inch of floor, needs level 5.7. The pyramid that shipped
       stopped at 4 and every pixel in the frame sampled a texture finer than it
       could resolve — which is what made the photographic floor read as static.
       Ten levels is 512 → 1; anything short of that reintroduces the bug. */
    expect(flatTexture(512).levels.length).toBe(10);
  });
});

describe('the mip level a pixel asks for', () => {
  /* `tex` is explicit and has NO default. Writing a default here and then
     passing `undefined` to mean "no photograph" is how a test quietly measures
     a thing against itself: JavaScript fills the default in for an explicit
     undefined, so both sides of the comparison would have had the grating. */
  const spreadAt = (footprintIn: number, tex: ReturnType<typeof gratingTexture> | undefined) => {
    const palette = woodPalette('white-oak', 'satin', tex);
    const out: number[] = [];
    /* Both axes, and an irrational-ish step, so the probe cannot lock to the
       grating's own period and report a phase as a filter. */
    for (let i = 0; i < 40; i += 1) {
      for (let j = 0; j < 40; j += 1) {
        const c = woodColourFrom(
          palette,
          { key: 11, edge: 1, along: i / 41, across: j / 41, axis: 0, lenIn: 45 },
          5,
          footprintIn,
        );
        out.push(c.r);
      }
    }
    const mean = out.reduce((a, b) => a + b, 0) / out.length;
    return Math.sqrt(out.reduce((a, b) => a + (b - mean) ** 2, 0) / out.length);
  };

  it('resolves the texture when one pixel covers less than one texel', () => {
    /* A 64-texel tile over ten inches is 6.4 texels to the inch, so a pixel
       covering a fiftieth of an inch is well inside level 0 and the grating
       must still be there. */
    expect(spreadAt(0.02, gratingTexture(64, 8))).toBeGreaterThan(5);
  });

  it('filters the texture away when one pixel covers many texels', () => {
    /* Two inches per pixel is thirteen texels — more than a full cycle of the
       grating — so nothing of the grating can survive, and what is left must be
       what the renderer would have drawn with no photograph at all. Measuring
       against THAT rather than against zero is the point: the drawn grain is
       still in the picture and has no footprint term, so a bare threshold here
       would be measuring the sine waves and calling it the filter. Detail that
       survives a thirteen-texel pixel is the renderer inventing information the
       scene cannot carry, which is exactly what aliasing is. */
    const drawnOnly = spreadAt(2, undefined);
    expect(Math.abs(spreadAt(2, gratingTexture(64, 8)) - drawnOnly)).toBeLessThan(0.2);
  });

  it('never gets noisier as the pixel gets larger', () => {
    /* The property the shipped version broke. Its level came from the ratio
       against the near edge of the quad, so the near field asked for level 0
       while really covering twenty texels — and the whole pyramid sat four and
       a half levels too fine for every pixel in the frame. */
    const spreads = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 4].map((f) => spreadAt(f, gratingTexture(64, 8)));
    for (let i = 1; i < spreads.length; i += 1) {
      expect(spreads[i]!).toBeLessThanOrEqual(spreads[i - 1]! + 0.25);
    }
    expect(spreads[spreads.length - 1]!).toBeLessThan(spreads[0]! / 4);
  });
});

describe('a board knows its own length', () => {
  it('reports the run length for a straight board and the block for a parquet', () => {
    /* `along` is a fraction, and the inches it stands for are the fraction
       times THIS board's length. A straight run is nine widths; a herringbone
       or chevron block is four. Reading nine for all of them stretched the
       photograph along a parquet block by 9/4. */
    const w = 5;
    expect(samplePattern(1, 1, 'straight', w).lenIn).toBeCloseTo(w * RUN_LENGTH_RATIO, 6);
    expect(samplePattern(1, 1, 'diagonal', w).lenIn).toBeCloseTo(w * RUN_LENGTH_RATIO, 6);
    expect(samplePattern(1, 1, 'herringbone', w).lenIn).toBeCloseTo(w * BLOCK_RATIO, 6);
    expect(samplePattern(1, 1, 'chevron', w).lenIn).toBeCloseTo(w * BLOCK_RATIO, 6);
  });

  it('measures the same inch of board wherever you sample it', () => {
    /* along × lenIn is a distance, and stepping a tenth of an inch along the
       plan must move it a tenth of an inch — within one board, and allowing
       for the wrap at the end seam. */
    const w = 5;
    let checked = 0;
    for (let t = 0; t < 400; t += 1) {
      const a = samplePattern(3.1, 2 + t * 0.1, 'straight', w);
      const b = samplePattern(3.1, 2 + (t + 1) * 0.1, 'straight', w);
      if (a.key !== b.key) continue;
      expect(b.along * b.lenIn - a.along * a.lenIn).toBeCloseTo(0.1, 6);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(300);
  });
});


describe('a composite done in bands', () => {
  /* The studio renders the photographic floor a band of rows per animation
     frame, because at studio size the photograph triples the cost — 75ms drawn
     against 212ms measured — and a fifth of a second in one call is a fifth of
     a second in which the page ignores every click.

     That is only safe if a band depends on nothing carried over from the last
     one. If it did, the floor would show seams wherever an animation frame
     happened to end, and they would move around with the device. */
  const room = frame(180, 140, (x, y) => {
    if (y < 56) return { r: 238, g: 235, b: 230 };
    const v = Math.round(172 * (0.82 + 0.28 * ((y - 56) / 84)) * (1 + 0.08 * Math.sin(x * 0.13)));
    /* Something standing on it, so `painted` is not trivially 1 and the
       weighting the caller has to do is actually exercised. */
    if (y > 96 && y < 126 && x > 42 && x < 138) return { r: 214, g: 212, b: 206 };
    return { r: v, g: Math.round(v * 0.94), b: Math.round(v * 0.86) };
  });
  const QUAD: Quad = [
    { x: 0.08, y: 0.4 },
    { x: 0.92, y: 0.4 },
    { x: 1.2, y: 1 },
    { x: -0.2, y: 1 },
  ];

  it('is the same picture as one done in a single pass', () => {
    const mask = buildFloorMask(room, QUAD, {});
    for (const patternId of ['straight', 'diagonal', 'herringbone', 'chevron']) {
      const config = { ...CONFIG, patternId };
      const whole = compositeFloor(room, QUAD, config, { squareFeet: 400, mask });
      const buffer = createCompositeBuffer(room);
      for (let y = 0; y < room.height; y += 23) {
        compositeFloor(room, QUAD, config, {
          squareFeet: 400,
          mask,
          into: buffer,
          rows: [y, Math.min(room.height, y + 23)],
        });
      }
      let differing = 0;
      for (let i = 0; i < whole.pixels.data.length; i += 1) {
        if (whole.pixels.data[i] !== buffer.data[i]) differing += 1;
      }
      expect(differing, patternId).toBe(0);
    }
  });

  it('reports a painted fraction the caller can add up correctly', () => {
    /* `painted` is over the rows THIS call was asked for. The top band of a
       room is mostly wall; averaging the bands unweighted would drag the figure
       down on its own, and that figure is what decides whether a visitor is
       told their photograph is mostly furniture. Weighted by `considered` it
       comes out exactly equal to the whole-frame answer. */
    const mask = buildFloorMask(room, QUAD, {});
    const whole = compositeFloor(room, QUAD, CONFIG, { squareFeet: 400, mask });
    const buffer = createCompositeBuffer(room);
    let painted = 0;
    let considered = 0;
    for (let y = 0; y < room.height; y += 23) {
      const part = compositeFloor(room, QUAD, CONFIG, {
        squareFeet: 400,
        mask,
        into: buffer,
        rows: [y, Math.min(room.height, y + 23)],
      });
      painted += part.painted * part.considered;
      considered += part.considered;
    }
    expect(considered).toBe(whole.considered);
    expect(considered).toBeGreaterThan(0);
    /* And the rug is actually being protected, or this measures nothing. */
    expect(whole.painted).toBeLessThan(0.95);
    expect(painted / considered).toBeCloseTo(whole.painted, 10);
  });

  it('starts from the room, so an unfinished band is not a hole in it', () => {
    /* The one way to use this wrong is to hand it a blank buffer. The rows a
       band has not reached yet have to still be the photograph. */
    const buffer = createCompositeBuffer(room);
    compositeFloor(room, QUAD, CONFIG, { squareFeet: 400, into: buffer, rows: [0, 20] });
    for (let y = 100; y < room.height; y += 1) {
      for (let x = 0; x < room.width; x += 7) {
        const i = (y * room.width + x) * 4;
        expect(buffer.data[i], `row ${y}`).toBe(room.data[i]);
      }
    }
  });
});
