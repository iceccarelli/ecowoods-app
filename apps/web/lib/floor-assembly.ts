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
import { PATTERN_OPTIONS, DEFAULT_PATTERN, type PatternOption } from '@ecowoods/shared/ai';

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

/** Top of the build-up first — the order you meet them, not the order they are laid. */
export const ASSEMBLY_LAYERS: readonly AssemblyLayer[] = [
  {
    n: '01',
    id: 'finish',
    title: 'Finish',
    body: 'Coats applied on site or in the mill. What you walk on, and the only layer that can be renewed without lifting a board.',
    ask: 'How many coats, and of what — and is the last one sanded between?',
  },
  {
    n: '02',
    id: 'wear-layer',
    title: 'Wear layer',
    body: 'The sandable thickness above the tongue. It decides how many times this floor can ever be refinished.',
    ask: 'How many millimetres above the tongue? That number sets how many refinishes you get.',
  },
  {
    n: '03',
    id: 'fastening',
    title: 'Fastening',
    body: 'Cleat, staple or adhesive, chosen for the substrate underneath. The wrong choice is silent for a year and then audible every winter.',
    ask: 'Which fastening, and why that one for my subfloor?',
  },
  {
    n: '04',
    id: 'moisture-control',
    title: 'Moisture control',
    body: 'Barrier or membrane, specified from a meter reading of the slab or the plywood rather than from habit.',
    ask: 'What did the moisture meter read, on what day, and what did you specify from it?',
  },
  {
    n: '05',
    id: 'substrate',
    title: 'Substrate',
    body: 'Plywood or slab, flattened to tolerance before anything is laid on it. Everything above inherits whatever is wrong here.',
    ask: 'What flatness tolerance, and what happens to the price if the floor misses it?',
  },
] as const;

/** Layers whose specification a visitor can be shown a number for on this site. */
export const ASSEMBLY_LAYER_COUNT = ASSEMBLY_LAYERS.length;

export function layerById(id: string): AssemblyLayer | undefined {
  return ASSEMBLY_LAYERS.find((l) => l.id === id);
}

/**
 * The photographed grain crop for a product.
 *
 * public/textures/grain-manifest.json records one crop per product, named by
 * the product id. Computed rather than stored so a new species in the
 * catalogue needs a crop and nothing else.
 */
export function grainTextureFor(productId: string): string {
  return `/textures/grain-${productId}.webp`;
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
export function assemblyDesignHref(product: FloorProduct, patternId?: string): string {
  const params = new URLSearchParams({ species: product.rateKey, source: 'assembly' });
  /* The pattern param IS keyed by id — FloorConfigurator matches it against
     PATTERN_OPTIONS, whose id is the id. Only the species list is rekeyed.
     Sent only when it is a pattern that list actually contains, so a stale
     link cannot put the configurator into a state it has no option for. */
  if (patternId && PATTERN_OPTIONS.some((p) => p.id === patternId)) {
    params.set('pattern', patternId);
  }
  return `/design?${params.toString()}`;
}

/* ── the boards ───────────────────────────────────────────────────────────── */

/** The patterns the assembly can be laid in — the shared list, not a copy. */
export const ASSEMBLY_PATTERNS: readonly PatternOption[] = PATTERN_OPTIONS;

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
  const push = (x: number, y: number, w: number, h: number, rot: number) =>
    out.push({ x, y, w, h, rot });

  if (patternId === 'straight' || patternId === 'diagonal') {
    /* Running bond: each course's end joints offset by a third of a board, so
       no two joints line up. Laying them flush is the mark of a rushed floor. */
    const rows = Math.ceil(100 / W);
    for (let r = 0; r < rows; r++) {
      const off = ((r % 3) * L) / 3;
      for (let x = -L + off; x < 110; x += L + 0.4) push(x, r * W, L, W - 0.28, 0);
    }
    return {
      boards: out,
      fieldRot: patternId === 'diagonal' ? 45 : 0,
      scale: patternId === 'diagonal' ? 1.5 : 1,
    };
  }

  if (patternId === 'herringbone') {
    /* Interlocking L-pairs: each board butts into the SIDE of its neighbour and
       the courses STEP. That step is the whole difference from chevron. */
    const colW = L * 0.72;
    for (let c = -3; c < Math.ceil(100 / colW) + 3; c++) {
      const sign = c % 2 === 0 ? -45 : 45;
      for (let k = -14; k < 26; k++) {
        push(c * colW, k * (W + 0.5) * 1.42 - 60, L + W * 1.6, W - 0.28, sign);
      }
    }
    return { boards: out, fieldRot: 0, scale: 1.25 };
  }

  /* Chevron: mitred, meeting point-to-point, so the apexes line up into
     continuous rows. `d` is the reach of a board turned 45 degrees; a rising
     board starts a full d lower so its far end lands on the seam where the
     falling board begins. The small overlap covers the corner void a
     rectangle leaves where a real mitre would close. */
  const d = L / Math.SQRT2;
  const rowH = (W + 0.6) * Math.SQRT2;
  for (let r = -8; r < Math.ceil(100 / rowH) + 8; r++) {
    for (let c = -3; c < Math.ceil(100 / d) + 3; c++) {
      const rising = c % 2 === 0;
      push(c * d, r * rowH + (rising ? d : 0), L + W * 0.75, W - 0.28, rising ? -45 : 45);
    }
  }
  return { boards: out, fieldRot: 0, scale: 1.1 };
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
