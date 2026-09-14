/**
 * The tiles, and the numbers that describe them.
 *
 * A grain tile is the one asset in this renderer whose METADATA is load-bearing
 * in a way nobody would notice going wrong. If the declared size in inches
 * drifts from what the tile actually is, the floor renders at the wrong grain
 * scale — five-inch oak with the figure of a two-inch board, or a three-foot
 * one — and every page still looks like a page. So the table in grain.ts and
 * the manifest the build script writes are checked against each other and
 * against the catalogue, here, where a mismatch is a failing test rather than a
 * floor that is quietly the wrong floor.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GRAIN_TILES, grainTileFor, grainTileHref } from './grain';
import { FLOOR_PRODUCTS } from './catalog';

const TEXTURES = path.join(process.cwd(), 'public', 'textures');
const manifest = JSON.parse(
  readFileSync(path.join(TEXTURES, 'grain-manifest.json'), 'utf8'),
) as {
  product: string;
  file: string;
  width: number;
  height: number;
  inchesAcross: number;
  inchesAlong: number;
  grainDegAfter: number;
  rotateDeg: number;
  seamAcross: number;
  seamAlong: number;
  rowBandBefore: number;
  rowBandAfter: number;
}[];

describe('the grain tiles', () => {
  it('say the same thing as the manifest the build script wrote', () => {
    /* Two copies of the same numbers, because the bundle cannot read a JSON
       file at module scope and a fetch for six small integers is a network
       round trip on the critical path. Two copies are fine; two copies that
       disagree are not, and this is the thing that stops them. */
    expect(GRAIN_TILES.map((t) => t.product).sort()).toEqual(
      manifest.map((m) => m.product).sort(),
    );
    for (const entry of manifest) {
      const tile = grainTileFor(entry.product);
      expect(tile, entry.product).toBeDefined();
      expect(tile!.file).toBe(entry.file);
      expect(tile!.width).toBe(entry.width);
      expect(tile!.height).toBe(entry.height);
      expect(tile!.inchesAcross).toBe(entry.inchesAcross);
      expect(tile!.inchesAlong).toBe(entry.inchesAlong);
    }
  });

  it('exist on disk at the path the page will ask for', () => {
    for (const tile of GRAIN_TILES) {
      expect(grainTileHref(tile)).toBe(`/textures/${tile.file}`);
      expect(existsSync(path.join(TEXTURES, tile.file)), tile.file).toBe(true);
    }
  });

  it('covers every species in the catalogue', () => {
    /* A product with no tile still renders — the drawn path needs no
       photograph — but it renders visibly plainer than the ones beside it, and
       a person comparing six species would read that as the wood. */
    for (const product of FLOOR_PRODUCTS) {
      expect(grainTileFor(product.id), product.id).toBeDefined();
    }
  });

  it('runs its grain along the board, in every tile', () => {
    /* The defect that made the photographic floor read as crumpled foil: of the
       five tiles originally shipped, one had its grain on the axis the renderer
       maps to the length of a board. The build script measures the angle after
       rotating and refuses to write a set where any tile is more than five
       degrees off; this is the same claim, asserted where a reader of the
       repository can see it. */
    for (const entry of manifest) {
      const offVertical = Math.abs(90 - Math.abs(entry.grainDegAfter));
      expect(offVertical, `${entry.product} is ${offVertical.toFixed(1)}° off`).toBeLessThan(5);
    }
  });

  it('wraps without printing a line across every board', () => {
    /* A tile is sampled as a torus — the last column is adjacent to the first
       in the render — so a step across that join repeats down every board in
       the room. The build script measures it against the tile's own contrast
       and refuses to write a set above a quarter; this is the same claim where
       a reader can see it. The set runs between 0.027 and 0.091.

       The number is a fraction of the tile's standard deviation, NOT of the
       step between neighbouring pixels. Grain runs along the tile, so
       neighbouring rows are nearly identical, and dividing by that turns a seam
       of under one grey level in 255 on hard maple into a number that reads
       like a failure. */
    for (const entry of manifest) {
      expect(entry.seamAcross, `${entry.product} across`).toBeLessThan(0.25);
      expect(entry.seamAlong, `${entry.product} along`).toBeLessThan(0.25);
    }
  });

  it('does not drift in tone from one end to the other', () => {
    /* The defect this set shipped with, and the reason it is worth a test of
       its own: every guard in this repository passed while two of the six
       tiles were spending about three quarters of their entire contrast on a
       slow light-to-dark ramp down their length. A tile is sampled as a torus,
       so that ramp does not fade out at the end of the tile — it steps back to
       the start, and the step draws a horizontal BAND across every board in
       the room at a fixed interval. Red oak measured 10.3 grey levels of it
       against a tile contrast of 15.5 and white ash 12.7 against 16.3.

       Nothing here was measuring it. The seam check above looks only at the
       first and last ROW, which a ramp passes: the two ends of a drift can be
       made to meet by the wrap while everything between them still slopes. So
       this measures the whole profile — the standard deviation of the row
       means — which is zero for a tile whose lighting is flat along its length
       and large for one that ramps.

       The numbers are written by the build script, which levels the profile on
       both sides of the wrap and refuses to write a set above half a grey
       level. `rowBandBefore` is kept in the manifest beside it because it is
       the evidence that this recipe is doing something: if it ever reads close
       to `rowBandAfter` across the whole set, the levelling has been bypassed
       rather than satisfied. */
    for (const entry of manifest) {
      expect(entry.rowBandAfter, `${entry.product} bands by ${entry.rowBandAfter}`)
        .toBeLessThan(0.5);
    }
    const worstBefore = Math.max(...manifest.map((m) => m.rowBandBefore));
    expect(worstBefore, 'no tile in the set needed levelling — check deband() ran')
      .toBeGreaterThan(1);
  });

  it('is a strip along the grain, not a square', () => {
    /* A tile a few inches long repeats six or eight times down a four-foot
       board, and that repeat is visible as a ripple running across the floor.
       Every tile is cut three to one; allow a little slack for the rounding
       that lands on whole pixels. */
    for (const tile of GRAIN_TILES) {
      expect(tile.inchesAlong / tile.inchesAcross, tile.product).toBeGreaterThan(2.5);
      expect(tile.height / tile.width, tile.product).toBeGreaterThan(2.5);
    }
  });

  it('measures a plausible piece of a real board', () => {
    /* The inches are estimated from the board's share of the frame, so they are
       not exact. They are, however, bounded by what a board IS: nothing in this
       catalogue is under two inches across or over a foot, and no photograph in
       public/gallery frames more than a couple of feet of floor. A tile outside
       that is an arithmetic mistake in the build script, not an estimate. */
    for (const tile of GRAIN_TILES) {
      expect(tile.inchesAcross, tile.product).toBeGreaterThan(2);
      expect(tile.inchesAcross, tile.product).toBeLessThan(12);
      expect(tile.inchesAlong, tile.product).toBeLessThan(48);
    }
  });
});
