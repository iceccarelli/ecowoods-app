/**
 * The floor has to be a floor.
 *
 * WHY THIS EXISTS
 *
 * The homepage shipped a herringbone whose boards LAPPED OVER ONE ANOTHER, and
 * a chevron doing the same down every seam. Customers saw it. Nothing in the
 * repository could: there were tests for how many boards were generated, for
 * which axes came from the catalogue, and for whether any text had leaked into
 * the animated element — and not one of them asked whether the boards were in
 * the right places.
 *
 * So this rasterises the actual geometry. Every pattern, at every board width
 * the catalogue offers, is turned into polygons and sampled on a grid:
 *
 *   OVERLAP must be zero. Two boards in the same place is not a floor, it is
 *   the defect that was on screen.
 *   COVERAGE must be near total. What is missing is the joint and only the
 *   joint, so the bound is computed from the joint rather than typed in — a
 *   hole in the tiling and a wide grout line are not the same thing and must
 *   not be allowed to pass for one another.
 *
 * The polygons are built the same way the browser builds them: `transform-origin
 * is 0 0`, so a board is rotated about its TOP-LEFT corner, and a chevron board
 * is a parallelogram because its clip-path makes it one.
 */
import { describe, expect, it } from 'vitest';
import { ASSEMBLY_WIDTHS, boardsFor, fieldWidthFor, type Board } from './floor-assembly';

const PATTERNS = ['straight', 'diagonal', 'herringbone', 'chevron'] as const;

/** The four corners as the browser lays them out, mitre included. */
function corners(b: Board): [number, number][] {
  const t = (b.rot * Math.PI) / 180;
  const u: [number, number] = [Math.cos(t), Math.sin(t)];
  const p: [number, number] = [-Math.sin(t), Math.cos(t)];
  const P = (a: number, c: number): [number, number] => [
    b.x + a * u[0] + c * p[0],
    b.y + a * u[1] + c * p[1],
  ];
  if (!b.mitre) return [P(0, 0), P(b.w, 0), P(b.w, b.h), P(0, b.h)];
  return b.mitre === 'left'
    ? [P(b.h, 0), P(b.w, 0), P(b.w - b.h, b.h), P(0, b.h)]
    : [P(0, 0), P(b.w - b.h, 0), P(b.w, b.h), P(b.h, b.h)];
}

function inside(x: number, y: number, q: [number, number][]): boolean {
  let c = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    const [xi, yi] = q[i]!;
    const [xj, yj] = q[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Sample the middle of the field, away from the edges the container clips. */
function sample(boards: Board[], step = 1.1) {
  const polys = boards.map(corners);
  let cells = 0;
  let covered = 0;
  let overlapped = 0;
  for (let x = 12; x < 88; x += step) {
    for (let y = 12; y < 88; y += step) {
      cells += 1;
      let hits = 0;
      for (const q of polys) if (inside(x, y, q)) hits += 1;
      if (hits > 0) covered += 1;
      if (hits > 1) overlapped += 1;
    }
  }
  return { coverage: (covered / cells) * 100, overlap: (overlapped / cells) * 100 };
}

describe('no board is ever laid on top of another', () => {
  /* THE DEFECT THAT REACHED CUSTOMERS. The old herringbone made every board
     longer than its slot (`L + W * 1.6`) and gave every column the same
     vertical offset; the old chevron said in its own comment that it used "a
     small overlap" because a rectangle cannot make a mitre. Both are visible
     in a screenshot and neither was measurable by anything here. */
  for (const w of ASSEMBLY_WIDTHS) {
    for (const p of PATTERNS) {
      it(`${p} at ${w.label} lays no board twice`, () => {
        const { overlap } = sample(boardsFor(p, { width: fieldWidthFor(w.id) }).boards);
        expect(overlap, `${p} @ ${w.label} overlaps ${overlap.toFixed(2)}%`).toBeLessThan(0.05);
      });
    }
  }
});

describe('the floor has no holes in it', () => {
  /* What is not covered must be the joint. The bound comes from the joint the
     generator uses — 4% of the board width, off both axes — with a margin for
     the sampling grid, so a genuine gap cannot hide behind a generous number. */
  for (const w of ASSEMBLY_WIDTHS) {
    for (const p of PATTERNS) {
      it(`${p} at ${w.label} is covered but for its joints`, () => {
        const { coverage } = sample(boardsFor(p, { width: fieldWidthFor(w.id) }).boards);
        expect(coverage, `${p} @ ${w.label} covers ${coverage.toFixed(1)}%`).toBeGreaterThan(90);
      });
    }
  }
});

describe('the mitre belongs to chevron and to nothing else', () => {
  it('every chevron board is mitred and no other board is', () => {
    const chev = boardsFor('chevron', { width: fieldWidthFor('5') }).boards;
    expect(chev.length).toBeGreaterThan(0);
    expect(chev.every((b) => b.mitre === 'left' || b.mitre === 'right')).toBe(true);
    for (const p of ['straight', 'diagonal', 'herringbone'] as const) {
      const bs = boardsFor(p, { width: fieldWidthFor('5') }).boards;
      expect(bs.some((b) => b.mitre), p).toBe(false);
    }
  });

  it('leans both ways, in roughly equal measure', () => {
    const chev = boardsFor('chevron', { width: fieldWidthFor('5') }).boards;
    const left = chev.filter((b) => b.mitre === 'left').length;
    expect(Math.abs(left / chev.length - 0.5)).toBeLessThan(0.1);
  });
});

describe('the field is generated for the screen, not for infinity', () => {
  /* The lattice runs diagonally: one index walks ALONG a course and advances
     several board widths a step, the other walks across it one width a step.
     Looping both over the same square range generated 2,888 boards for a
     100-unit field, nearly all of them off-screen and every one a DOM node. */
  for (const w of ASSEMBLY_WIDTHS) {
    for (const p of PATTERNS) {
      it(`${p} at ${w.label} stays within a sane board count`, () => {
        const n = boardsFor(p, { width: fieldWidthFor(w.id) }).boards.length;
        expect(n, `${p} @ ${w.label} generated ${n}`).toBeGreaterThan(20);
        expect(n, `${p} @ ${w.label} generated ${n}`).toBeLessThan(900);
      });
    }
  }
});
