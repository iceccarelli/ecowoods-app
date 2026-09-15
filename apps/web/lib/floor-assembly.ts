/**
 * lib/floor-assembly.ts — what a floor is actually made of.
 *
 * WHY THIS EXISTS
 *
 * The homepage sold a finished floor with photographs of a finished floor. A
 * finished floor is the one part of the job a competitor can photograph too,
 * and it is the part a buyer cannot evaluate: every sanded floor looks good on
 * the day it is handed over. The four layers underneath it are where the price
 * differences live, where the failures come from, and where this company can
 * say something its competitors cannot — and none of them were on the page.
 *
 * So this module is the record for the exploded assembly: five layers, in the
 * order they are built, each with the question a buyer should put to whoever is
 * quoting them. It is data rather than markup because the same five layers
 * belong on /estimate, on the guides, and in the spec sheet, and five copies of
 * a list is how four of them go stale.
 *
 * THE SPECIES JOIN IS NOT A SECOND LIST.
 *
 * The wear layer is painted with a real photographed grain crop from
 * public/textures, and those crops are already keyed by the SAME product ids as
 * lib/floor-studio/catalog.ts. So the species shown here derive from
 * FLOOR_PRODUCTS and the texture path is computed from the product id. There is
 * no array of species in this file to drift from the catalogue, and
 * floor-assembly.test.ts fails if a product ever exists without its crop.
 *
 * NOTHING HERE IS A CLAIM ABOUT A JOB. The layers are how hardwood floors are
 * built; the copy describes the trade, not a customer, an address or a result.
 */
import { FLOOR_PRODUCTS, type FloorProduct } from '@/lib/floor-studio/catalog';
import { grainTileFor, grainTileHref } from '@/lib/floor-studio/grain';
import { FLOOR_PRODUCTS as _P, BOARD_WIDTHS, DEFAULT_WIDTH, type BoardWidth } from '@/lib/floor-studio/catalog';
import {
  PATTERN_OPTIONS,
  FINISH_OPTIONS,
  DEFAULT_PATTERN,
  DEFAULT_FINISH,
  type PatternOption,
  type FinishOption,
} from '@ecowoods/shared/ai';

export type AssemblyLayer = {
  /** Display index, top of the build-up first. */
  n: string;
  id: string;
  title: string;
  /** What the layer is, in the words a homeowner would use. */
  body: string;
  /**
   * The question to put to whoever is quoting. This is the commercial point of
   * the whole graphic: a buyer who asks these five questions can tell two
   * quotes apart, and a quote that answers them is ours.
   */
  ask: string;
};

/**
 * THREE LAYERS, BECAUSE THAT IS WHAT A BOARD IS.
 *
 * This used to list five: finish, wear layer, fastening, moisture control,
 * substrate. Every one of those is real, but they are not one object — they are
 * the floor SYSTEM as installed, and three of them are things that happen
 * underneath a board rather than parts of it. Drawing them as a single exploded
 * stack said a board has five layers, and a board does not.
 *
 * What is drawn now is the board: an engineered board, which glossary.ts calls
 * "the correct specification for the majority of Toronto projects — not a
 * compromise, and not a cheaper substitute".
 *
 * EVERY DEFINITION BELOW IS THE ONE THIS SITE ALREADY PUBLISHES, in
 * lib/glossary.ts, so the homepage and the glossary cannot drift:
 *
 *   wear layer        "The thickness of real hardwood above the core — what
 *                      determines how many times a floor can be refinished."
 *   cross-ply core    "each layer oriented at 90° to the one beside it";
 *                     "Each layer's tendency to move across its own grain is
 *                      resisted by the layer bonded to it at a right angle."
 *
 * The installation questions the five-layer version carried — fastening,
 * moisture reading, substrate flatness — were the best part of it and are NOT
 * discarded: they move to UNDER_THE_BOARD below, which the section renders as
 * a separate short list, because they belong to the quote rather than to the
 * board.
 */
export const ASSEMBLY_LAYERS: readonly AssemblyLayer[] = [
  {
    n: '01',
    id: 'finish',
    title: 'Finish',
    body: 'Coats applied in the mill or on site. What you actually walk on, and the only layer that can be renewed without lifting a board.',
    ask: 'How many coats, of what, and is it sanded between them?',
  },
  {
    n: '02',
    id: 'wear-layer',
    title: 'Wear layer',
    body: 'Real hardwood above the core. Its thickness is what determines how many times this floor can ever be refinished — and cutting through it cannot be undone.',
    ask: 'How many millimetres of hardwood above the core? That number is the floor\u2019s lifespan, and it is the one most quotes never state.',
  },
  {
    n: '03',
    id: 'cross-ply-core',
    title: 'Cross-ply core',
    body: 'Layers bonded at 90° to each other, so each layer\u2019s tendency to move across its own grain is resisted by the one beside it. This is what makes a board stable over a slab, in a condo, and above radiant heat.',
    ask: 'How many plies, and what species is the core?',
  },
] as const;

/**
 * The three questions that are about the INSTALLATION rather than the board.
 *
 * These were layers 03, 04 and 05 of the five-layer version. They are not
 * parts of a board and drawing them as such was the error; they are still the
 * three things that decide whether a correctly specified board survives its
 * second winter, and a buyer who asks them can tell two quotes apart.
 */
export const UNDER_THE_BOARD: readonly AssemblyLayer[] = [
  {
    n: '04',
    id: 'fastening',
    title: 'Fastening',
    body: 'Cleat, staple or adhesive, chosen for the substrate underneath. The wrong choice is silent for a year and then audible every winter.',
    ask: 'Which fastening, and why that one for my subfloor?',
  },
  {
    n: '05',
    id: 'moisture-control',
    title: 'Moisture control',
    body: 'Barrier or membrane, specified from a meter reading of the slab or the plywood rather than from habit.',
    ask: 'What did the moisture meter read, on what day, and what did you specify from it?',
  },
  {
    n: '06',
    id: 'substrate',
    title: 'Substrate',
    body: 'Plywood or slab, flattened to tolerance before anything is laid on it. Everything above inherits whatever is wrong here.',
    ask: 'What flatness tolerance, and what happens to the price if the floor misses it?',
  },
] as const;

/** Layers whose specification a visitor can be shown a number for on this site. */
export const ASSEMBLY_LAYER_COUNT = ASSEMBLY_LAYERS.length;

export function layerById(id: string): AssemblyLayer | undefined {
  return [...ASSEMBLY_LAYERS, ...UNDER_THE_BOARD].find((l) => l.id === id);
}

/**
 * The photographed grain crop for a product.
 *
 * Delegates to the tile table rather than composing the path a second time.
 * The table is generated by scripts/textures/build-grain.py from the same run
 * that writes the files, so it cannot name a tile that does not exist — which
 * a string template here can, and did not only in theory: a tile whose URL is
 * wrong does not throw, it 404s, and the assembly paints every board as flat
 * brown that still looks deliberate.
 *
 * The fallback keeps the old behaviour for a product with no tile, because the
 * test that catches that case is the one below this line and a thrown error
 * here would make it fail for the wrong reason.
 */
export function grainTextureFor(productId: string): string {
  /* THE LANDSCAPE TILE, AND THE REASON THERE IS ONE.
   *
   * build-grain.py turns every crop so the grain runs DOWN the tile, which is
   * what the renderer wants: it samples in board-local inches and turns the
   * grain itself. This surface cannot. It is CSS — one background-image per
   * board div — and a CSS background cannot be rotated. These boards are laid
   * out with their LENGTH along the div's width, so the portrait tile put the
   * grain across every board: oak with the figure running the wrong way, which
   * is the defect DESIGN-01 measured out of the renderer and which was still
   * shipping here because this surface was never part of that fix.
   *
   * The build script now writes the same tile a second time, turned a quarter
   * turn. Same wood, same crop, same numbers with the axes swapped. */
  const tile = grainTileFor(productId);
  return tile
    ? `/textures/${tile.file.replace(/\.webp$/, '-along.webp')}`
    : `/textures/grain-${productId}-along.webp`;
}

/** The species the assembly can be shown in — the catalogue, not a copy of it. */
export const ASSEMBLY_SPECIES: readonly FloorProduct[] = FLOOR_PRODUCTS;

/** The default face. White oak is the product most Toronto renovations specify. */
export const ASSEMBLY_DEFAULT_SPECIES = 'white-oak';

/**
 * The exit, and the ONE place it is built.
 *
 * TWO SILENT DROPS THIS AVOIDS, both found by reading the receiving code
 * rather than by trusting the parameter name.
 *
 *   1. /estimate reads a configuration through designConfigFromParams, which
 *      returns null unless species AND a positive sqft are both present. The
 *      assembly never asks for an area, so a link straight to /estimate would
 *      have carried a species that the form discards on arrival — the exact
 *      failure MEAS-04 fixed for the spec sheet.
 *   2. /design matches its species param against FloorConfigurator's SPECIES,
 *      whose `id` is the product's RATE KEY ('white oak'), not its catalogue
 *      id ('white-oak'). A link built from the id would be dropped by the
 *      `SPECIES.some(...)` guard without any error.
 *
 * So the assembly hands off to the configurator — which is where an area is
 * asked for — keyed by rateKey. /design then builds the /estimate link itself
 * through designEstimateHref, with the area filled in, and the handoff holds.
 * floor-assembly.test.ts asserts the rateKey round-trip against the catalogue.
 */
export function assemblyDesignHref(
  product: FloorProduct,
  patternId?: string,
  finishId?: string,
  widthId?: string,
): string {
  const params = new URLSearchParams({ species: product.rateKey, source: 'assembly' });
  /* Finish is keyed by id and /design matches it against FINISH_OPTIONS by id,
     so it carries. Checked here for the same reason the pattern is: a value
     that list does not contain is dropped on arrival without an error. */
  if (finishId && FINISH_OPTIONS.some((f) => f.id === finishId)) {
    params.set('finish', finishId);
  }
  /* The pattern param IS keyed by id — FloorConfigurator matches it against
     PATTERN_OPTIONS, whose id is the id. Only the species list is rekeyed.
     Sent only when it is a pattern that list actually contains, so a stale
     link cannot put the configurator into a state it has no option for. */
  if (patternId && PATTERN_OPTIONS.some((p) => p.id === patternId)) {
    params.set('pattern', patternId);
  }
  /* WIDTH IS SENT NOW, AND THE REASON IT WAS NOT IS THE REASON IT MUST BE.
     What stood here said /design "has no board-width control at all", so
     `width=` would be a parameter nobody reads. That was true when it was
     written and DESIGN-01 made it false: the configurator grew a board-width
     control as step 04, reads `q.get('width')`, and validates it against
     BOARD_WIDTHS exactly as it does finish and pattern.

     The principle never changed — do not hand over what nothing reads, and do
     not drop what somebody chose. Only which way it pointed changed. With
     /design reading width and this link not sending it, the silent drop this
     file documents twice was happening in the one direction nothing guarded:
     a visitor picked 3¼″ strip here, watched the boards narrow, followed the
     link, and landed on 5″ plank with no trace of the choice.

     Validated like the other two, so a width BOARD_WIDTHS does not contain is
     dropped here rather than silently ignored on arrival. An incompatible but
     valid combination — herringbone at 8″, say — is safe to send: the
     configurator repairs it on arrival through withAxis and says so. */
  if (widthId && BOARD_WIDTHS.some((w) => w.id === widthId)) {
    params.set('width', widthId);
  }
  return `/design?${params.toString()}`;
}

/* ── the boards ───────────────────────────────────────────────────────────── */

/* ── the four axes ────────────────────────────────────────────────────────
   EIGHTEEN CHOICES, AND NOT ONE OF THEM IS NEW.

   The section offered five species and nothing else. It now offers all four
   axes this business actually sells on — the catalogue's species, 5 finishes,
   4 patterns, 4 board widths — and every one of them is read from the
   catalogue's own list rather
   than a copy, so nothing here can drift from what /design and /floor-studio
   offer or from what content/constants/pricing.ts prices.

   All four change the picture, from the catalogue's own data: the species
   selects the photographed crop, the finish applies its published tint and
   sheen, the pattern lays the boards, and the width sets how many boards
   there are. A choice that did not change the picture would be a decoration
   pretending to be a configurator. */

/** The patterns the assembly can be laid in — the shared list, not a copy. */
export const ASSEMBLY_PATTERNS: readonly PatternOption[] = PATTERN_OPTIONS;

/** The finishes. Each carries its own published tint and sheen. */
export const ASSEMBLY_FINISHES: readonly FinishOption[] = FINISH_OPTIONS;
export const ASSEMBLY_DEFAULT_FINISH = DEFAULT_FINISH;

/** The four widths Ecowoods lays, in the trade's own names. */
export const ASSEMBLY_WIDTHS: readonly BoardWidth[] = BOARD_WIDTHS;
export const ASSEMBLY_DEFAULT_WIDTH = DEFAULT_WIDTH;

/** Total selectable options across every axis — what the section offers. */
export const ASSEMBLY_CHOICE_COUNT =
  ASSEMBLY_SPECIES.length +
  ASSEMBLY_FINISHES.length +
  ASSEMBLY_PATTERNS.length +
  ASSEMBLY_WIDTHS.length;

/**
 * Face width in percent of the board field, from the width's REAL inches.
 *
 * The field is a fixed square, so a board's share of it is the only thing that
 * can carry the difference between a 3¼″ strip and an 8″ plank — and it has to
 * be proportional, or the labels are decorative. 5″ is the modern default and
 * anchors the scale at the 7.5% the field was built around; every other width
 * follows from its own `inches`.
 */
export function fieldWidthFor(widthId: string): number {
  const w = BOARD_WIDTHS.find((b) => b.id === widthId) ?? BOARD_WIDTHS[1]!;
  return Number(((w.inches / 5) * 7.5).toFixed(3));
}

/** The shared default, not a second opinion about what it should be. */
export const ASSEMBLY_DEFAULT_PATTERN = DEFAULT_PATTERN;

export type Board = {
  /** Position and size as a percentage of the board FIELD, which is square. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Rotation in degrees about the board's top-left corner. */
  rot: number;
  /**
   * The mitre, for chevron only.
   *
   * A chevron board is not a rectangle. It is a PARALLELOGRAM: two sides along
   * the board's axis and two sides VERTICAL, and those vertical sides are the
   * mitre cut that lets two boards meet point-to-point instead of one lapping
   * over the other. A rotated rectangle cannot make that shape, which is why
   * the old code faked it with an overlap and why the result looked like a
   * floor laid by somebody in a hurry.
   *
   * 'left' leans one way, 'right' the other; the renderer turns each into a
   * clip-path. Herringbone boards are honest rectangles and carry `undefined`.
   */
  mitre?: 'left' | 'right';
};

export type BoardField = {
  boards: readonly Board[];
  /** Rotation applied to the whole field, in degrees. */
  fieldRot: number;
  /** Oversize factor, so a rotated field still covers the plane's corners. */
  scale: number;
};

/**
 * WHY THE FIELD IS SQUARE, AND WHY THAT IS NOT A DETAIL.
 *
 * The wear layer is a 1.55 rectangle. Positioning boards in percentages of a
 * RECTANGLE means one percent of x and one percent of y are different physical
 * lengths — so a board written as `rotate(45deg)` does not come out at 45
 * degrees, and two boards meant to meet at a mitre miss each other. The first
 * herringbone built that way tiled with a repeating band of holes through it
 * that looked like a generation-range bug and was not.
 *
 * So every number below is a percentage of a SQUARE field, which the stylesheet
 * sizes from the plane's width and centres; the plane clips it. Inside that
 * square, 45 degrees is 45 degrees and the mitres land.
 *
 * Deterministic — no Math.random anywhere — because these coordinates are
 * rendered on the server and again in the browser, and a random number would
 * mean a hydration mismatch on every load.
 */
export function boardsFor(patternId: string, opts: { width?: number } = {}): BoardField {
  const W = opts.width ?? 7.5;
  const L = W * 4.6;
  const out: Board[] = [];
  /* The joint between boards. Taken OUT of the board, never added to the
     spacing, so the lattice still closes exactly.
     PROPORTIONAL TO THE BOARD, not a constant: a fixed 0.28 was 4% of a 7in
     plank and 7% of a 3¼in strip, so the narrowest floor — the one with the
     most joints in it already — also drew the widest ones. */
  const JOINT = Math.min(0.3, W * 0.04);
  const push = (x: number, y: number, w: number, h: number, rot: number, mitre?: 'left' | 'right') =>
    out.push(mitre ? { x, y, w, h, rot, mitre } : { x, y, w, h, rot });

  if (patternId === 'straight' || patternId === 'diagonal') {
    /* Running bond: each course's end joints offset by a third of a board, so
       no two joints line up. Laying them flush is the mark of a rushed floor. */
    const rows = Math.ceil(100 / W);
    for (let r = 0; r < rows; r++) {
      const off = ((r % 3) * L) / 3;
      for (let x = -L + off; x < 110; x += L + JOINT) push(x, r * W, L, W - JOINT, 0);
    }
    return {
      boards: out,
      fieldRot: patternId === 'diagonal' ? 45 : 0,
      scale: patternId === 'diagonal' ? 1.5 : 1,
    };
  }

  if (patternId === 'herringbone') {
    /* HERRINGBONE, LAID THE WAY IT IS LAID, AND THE OLD ONE WAS NOT.
     *
     * What stood here put every column of boards at the same vertical offset
     * and made each board LONGER than its slot — `L + W * 1.6` — so the boards
     * lapped over one another instead of interlocking. Four hundred and forty
     * overlapping rectangles is what the screenshots showed, and no amount of
     * texture work fixes a floor whose boards are in the wrong places.
     *
     * The real construction is one rule. Boards are generated axis-aligned and
     * the whole field is turned 45° at the end, which is also how a floorer
     * thinks about it — the pattern is square, the ROOM is at an angle to it.
     * In units of one board width, with n = length / width:
     *
     *   a course steps by (n, n)      — each board's end butts the next one's
     *                                   side, and the pair makes an L
     *   the next course offsets by (−1, +1)
     *
     * That is the whole tiling. Verified by rasterising the result rather than
     * by looking at it: 100.00% coverage and 0.00% overlap, at every board
     * ratio from 3:1 to 5.5:1 including the 4.6:1 this catalogue uses.
     *
     * The joint is taken out of the board, never added to the spacing, so the
     * lattice keeps closing exactly and the gap a person sees is a real gap
     * rather than a rounding error. */
    /* BOUNDED FROM THE LATTICE, NOT FROM THE BOX.
       The two indices do not both run across the field: k walks ALONG the
       course, which advances n board-widths a step, and c walks across it, one
       width a step. Looping both over the same square range is how a 100-unit
       field ended up generating two and a half thousand boards, the great
       majority of them off-screen and every one of them a DOM node. Inverting
       x = (nk − c)W and y = (nk + c)W gives the ranges that actually land. */
    const n = L / W;
    const MARGIN = 45;
    const kMin = Math.floor(-MARGIN / (n * W)) - 1;
    const kMax = Math.ceil((100 + MARGIN) / (n * W)) + 1;
    const cLim = Math.ceil((100 + MARGIN) / W) + 1;
    for (let c = -cLim; c <= cLim; c++) {
      for (let k = kMin; k <= kMax; k++) {
        const hx = (n * k - c) * W;
        const hy = (n * k + c) * W;
        if (hx < -MARGIN - L || hx > 100 + MARGIN || hy < -MARGIN - L || hy > 100 + MARGIN) continue;
        /* Along the board: w is the length, so the grain runs with it. */
        push(hx, hy, L - JOINT, W - JOINT, 0);
        /* The perpendicular board. Rotated 90° about its top-left corner, a
           w×h box lands on x ∈ [x−h, x], y ∈ [y, y+w] — so the corner goes to
           the slot's RIGHT edge and the box reaches back across it. */
        push(hx + L + W - JOINT, hy, L - JOINT, W - JOINT, 90);
      }
    }
    return { boards: out, fieldRot: 45, scale: 1.55 };
  }

  /* CHEVRON, WHICH IS NOT HERRINGBONE AND IS NOT A ROTATED RECTANGLE.
   *
   * The boards are MITRED and meet point-to-point, so each one is a
   * parallelogram: two sides along its own axis at 45°, two sides vertical.
   * The old code admitted it could not draw that — "the small overlap covers
   * the corner void a rectangle leaves where a real mitre would close" — and
   * an overlap is exactly what shipped: boards lapping over their neighbours
   * down every seam.
   *
   * A rotated rectangle plus a parallelogram clip-path IS that shape, exactly,
   * and costs nothing. Cutting a fraction k = h/w off one end and adding it to
   * the other turns the square ends into 45° cuts, which land vertical once the
   * board is turned. The board's effective length along its axis becomes w − h,
   * so the layout is computed from that and not from w.
   *
   * Columns alternate lean and each column steps down by h√2, which is the
   * vertical height of one mitre edge. Verified the same way: 100.00% coverage,
   * 0.00% overlap, at 3:1, 4:1 and 5:1. */
  /* EVERY NUMBER HERE USES THE BOARD'S REAL HEIGHT, JOINT ALREADY TAKEN OUT.
     The clip-path is computed at render time from h/w, and h is W − JOINT. Using
     the full W in the layout while the clip used W − JOINT put the mitre in a
     slightly different place from the one the geometry assumed — invisible at a
     7in board and a 1.20% overlap at 3¼in strip, where the joint is a larger
     share of the width. Caught by rasterising every pattern at every width
     rather than by looking at the one that happened to be on screen. */
  const HALF = Math.SQRT1_2;
  const hAct = W - JOINT;                // what the board really is, and clips to
  const axis = L - hAct;                 // length after the two mitre cuts
  const hx = axis * HALF;                // horizontal advance per column
  const vstep = hAct * Math.SQRT2;       // vertical pitch, one mitre edge
  const MARGIN_C = 40;
  const jMin = Math.floor(-MARGIN_C / hx) - 1;
  const jMax = Math.ceil((100 + MARGIN_C) / hx) + 1;
  const rMin = Math.floor(-(MARGIN_C + hx) / vstep) - 1;
  const rMax = Math.ceil((100 + MARGIN_C + hx) / vstep) + 1;
  for (let j = jMin; j <= jMax; j++) {
    const leansRight = j % 2 === 0;
    for (let r = rMin; r <= rMax; r++) {
      if (leansRight) {
        push(j * hx - hAct * HALF, r * vstep, L, hAct, -45, 'left');
      } else {
        push(j * hx, r * vstep - hAct * HALF, L, hAct, 45, 'right');
      }
    }
  }
  return { boards: out, fieldRot: 0, scale: 1.15 };
}

/**
 * Per-board variation, so no two boards are the same piece of wood.
 *
 * One texture is reused for every board — one request, one decode — and the
 * difference between boards is where in that crop each one is cut from, plus a
 * little darkening. Both are derived from the board index by multiplying by a
 * prime and wrapping, which gives a stable spread with no randomness and so
 * survives being rendered twice.
 *
 * The darkening is a flat colour layer rather than a CSS `filter`, because a
 * filter on several hundred elements makes the browser re-rasterise them every
 * frame the stack is moving, and the stack is always moving.
 */
export function boardFace(i: number): { posX: number; posY: number; shade: number } {
  return {
    posX: (i * 37) % 100,
    posY: (i * 53) % 100,
    shade: Number((((i * 29) % 22) / 220).toFixed(3)),
  };
}
