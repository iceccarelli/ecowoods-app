/**
 * lib/floor-studio/catalog.ts — the floors Ecowoods can actually lay.
 *
 * WHY THIS FILE EXISTS, AND WHAT IT REFUSES TO BE
 *
 * Floor Studio renders a floor into a photograph of someone's living room. The
 * single thing that decides whether that is a product or a gimmick is whether
 * the floor in the picture is one this company can supply and install. Every
 * visualiser in this category fails that test: they hand a generative model a
 * prompt, it invents a plank that exists nowhere, and the homeowner falls in
 * love with a floor that cannot be bought. The wow is real and the sale is
 * impossible, which is worse than no wow at all.
 *
 * So this module is the boundary. A configuration that is not expressible here
 * cannot be rendered, cannot be priced, cannot be shared and cannot be handed
 * to the estimate form. There is no second path.
 *
 * WHERE EVERY FIELD COMES FROM — AND THE THREE NUMBERS THAT ARE NOT HERE
 *
 *   · The species list, the swatch pigments, the finish and pattern
 *     vocabularies are the SAME ones /design has published since it launched.
 *     They are imported from @ecowoods/shared/ai, not re-typed. A visitor who
 *     configures white oak · satin · herringbone in Floor Studio and then opens
 *     /design must see the same floor, because it IS the same record.
 *
 *   · Janka figures are the published hardness values for each commercial
 *     group, already rendered on /design. They are restated here as numbers
 *     rather than strings so ranking can use them; the strings on /design are
 *     now generated from these, so the two cannot drift.
 *
 *   · Seasonal movement is NOT stored. It is computed on demand from
 *     lib/wood — Wood Handbook Table 13–5 coefficients and the published EMC
 *     model — for the board width the visitor actually chose. A stored
 *     millimetre figure would be a claim nobody could re-derive.
 *
 *   · PRICE IS NOT HERE. Not one figure. `priceConfiguration()` delegates to
 *     estimateInstalledRangeCad(), the same function /design renders and the
 *     same function /api/chat's estimate_project tool calls. Three surfaces,
 *     one arithmetic. If they ever disagree a homeowner catches us lying about
 *     money, which is the only category of error this business cannot absorb.
 *
 * BOARD WIDTH CHANGES THE FLOOR AND DOES NOT CHANGE THE BAND
 *
 * Width is a new axis for this repository and it was tempting to give it a
 * price multiplier. It does not get one. The finish and pattern multipliers in
 * @ecowoods/shared/ai are already flagged in that file as placeholders awaiting
 * the estimator's confirmation; adding a third invented multiplier would
 * deepen a debt this repository has already written down. What width really
 * changes is (a) how the floor looks, which the renderer reads, and (b) how far
 * each board moves between a Toronto July and a Toronto February, which
 * lib/wood computes from published coefficients. Both of those are true. A
 * width surcharge would not be.
 *
 * COMPATIBILITY IS CHEMISTRY AND GEOMETRY, NEVER MERCHANDISING
 *
 * Two constraints, and each is a fact about wood rather than a rule we made up
 * to look sophisticated:
 *
 *   1. FUMED & SMOKED IS AN AMMONIA REACTION WITH TANNIN. That is what the
 *      finish blurb on /design already says. Oak has the tannin; hard maple and
 *      hickory effectively do not, and black walnut is dark before you start.
 *      Offering "smoked hard maple" would be offering a process that does not
 *      take on that wood.
 *
 *   2. HERRINGBONE AND CHEVRON ARE CUT AS BLOCKS. The pattern is built from
 *      short pieces whose proportion is fixed by the cut, and past about five
 *      inches the block stops reading as herringbone and starts reading as a
 *      mistake. So those two patterns are offered at 3¼″ and 5″ and not above.
 *
 * Anything else a visitor can select, Ecowoods can lay.
 */
import {
  FINISH_OPTIONS,
  PATTERN_OPTIONS,
  DEFAULT_FINISH,
  DEFAULT_PATTERN,
  estimateInstalledRangeCad,
  type EstimateResult,
  type FinishOption,
  type PatternOption,
} from '@ecowoods/shared/ai';
import { SPECIES as WOOD_SPECIES, computeMovement, type WoodSpecies } from '@/lib/wood';

/* ── the axes ─────────────────────────────────────────────────────────────── */

export type ToneKey = 'light' | 'mid' | 'dark';
export type UndertoneKey = 'warm' | 'neutral' | 'cool';
/** Ranked, not scored. A five-point scale invites a number nobody measured. */
export type DurabilityKey = 'hard' | 'harder' | 'hardest';
export type MaintenanceKey = 'low' | 'moderate';

export type BoardWidth = {
  id: string;
  /** Nominal face width in inches, as the trade names it. */
  inches: number;
  label: string;
  /** Why a person would pick it. One line, no superlatives. */
  note: string;
};

/**
 * The four widths Ecowoods lays. `8-plus` is the widest offered and is priced
 * and specified per project — the label says so rather than implying a stock
 * item at exactly eight inches.
 */
export const BOARD_WIDTHS: readonly BoardWidth[] = [
  { id: '3-25', inches: 3.25, label: '3¼″ strip', note: 'The heritage Toronto width. Most seams, least movement per board.' },
  { id: '5', inches: 5, label: '5″ plank', note: 'The modern default. Reads calm without going wide.' },
  { id: '7', inches: 7, label: '7″ wide plank', note: 'Fewer lines, more board. Wants a stable subfloor and a humidifier.' },
  { id: '8-plus', inches: 8, label: '8″ and wider', note: 'Architectural. Specified per project after the moisture readings.' },
] as const;

export const DEFAULT_WIDTH = BOARD_WIDTHS[1].id;

export const widthById = (id: string): BoardWidth | undefined =>
  BOARD_WIDTHS.find((w) => w.id === id);

/* ── the products ─────────────────────────────────────────────────────────── */

export type FloorProduct = {
  /** Stable id, used in URLs, share links and the estimate payload. */
  id: string;
  name: string;
  /**
   * The key into FLOORING_RATES_CAD_PER_SQFT. This is the ONLY link between a
   * catalogue entry and money, and it is a lookup rather than a number.
   */
  rateKey: string;
  /** The id in lib/wood SPECIES, so movement is computed, never stored. */
  movementSpeciesId: string;
  /** Published hardness for the commercial group. */
  janka: number;
  /** Swatch pigments — the same two /design has always painted with. */
  base: string;
  grain: string;
  tone: ToneKey;
  undertone: UndertoneKey;
  durability: DurabilityKey;
  maintenance: MaintenanceKey;
  /** One sentence a person would repeat to their partner. */
  note: string;
  /**
   * The shorter line /design has shown in its swatch tooltip since launch.
   * Kept verbatim so adopting the catalogue changed nothing a visitor sees.
   */
  swatchNote: string;
  /** Rooms this is a sensible specification for, in plain words. */
  suitedTo: readonly string[];
  /** Finish ids this species can actually take. */
  finishes: readonly string[];
};

/** Every finish except the reactive one, which is gated by tannin below. */
const NON_REACTIVE_FINISHES = FINISH_OPTIONS.filter((f) => f.id !== 'smoked').map((f) => f.id);
const ALL_FINISHES = FINISH_OPTIONS.map((f) => f.id);

export const FLOOR_PRODUCTS: readonly FloorProduct[] = [
  {
    id: 'white-oak',
    name: 'White Oak',
    rateKey: 'white oak',
    movementSpeciesId: 'white-oak',
    janka: 1360,
    base: '#c9a882',
    grain: '#a8865e',
    tone: 'mid',
    undertone: 'neutral',
    durability: 'harder',
    maintenance: 'low',
    note: 'Calm, modern, takes any stain. The floor most Toronto renovations end up choosing.',
    swatchNote: 'Calm, modern, takes any stain',
    suitedTo: ['living rooms', 'open-plan main floors', 'condos', 'bedrooms'],
    finishes: ALL_FINISHES,
  },
  {
    id: 'red-oak',
    name: 'Red Oak',
    rateKey: 'red oak',
    movementSpeciesId: 'red-oak',
    janka: 1290,
    base: '#c69574',
    grain: '#a06f4d',
    tone: 'mid',
    undertone: 'warm',
    durability: 'hard',
    maintenance: 'low',
    note: 'The Canadian heritage floor. If the house already has oak, this is what it is.',
    swatchNote: 'The Canadian heritage floor',
    suitedTo: ['pre-war houses', 'hallways', 'stairs', 'matching an existing floor'],
    finishes: ALL_FINISHES,
  },
  {
    id: 'black-walnut',
    name: 'Black Walnut',
    rateKey: 'walnut',
    movementSpeciesId: 'black-walnut',
    janka: 1010,
    base: '#6b4b34',
    grain: '#4a3122',
    tone: 'dark',
    undertone: 'warm',
    durability: 'hard',
    maintenance: 'moderate',
    note: 'Deep, quiet, expensive-looking. The softest floor here — it marks, and people choose it anyway.',
    swatchNote: 'Deep, quiet, expensive-looking',
    suitedTo: ['principal rooms', 'studies', 'bright south-facing rooms'],
    finishes: NON_REACTIVE_FINISHES,
  },
  {
    id: 'hard-maple',
    name: 'Hard Maple',
    rateKey: 'maple',
    movementSpeciesId: 'hard-maple',
    janka: 1450,
    base: '#e0c69f',
    grain: '#c4a87f',
    tone: 'light',
    undertone: 'cool',
    durability: 'harder',
    maintenance: 'moderate',
    note: 'Bright, uniform, contemporary. Makes a dim room read lighter than paint does.',
    swatchNote: 'Bright, uniform, contemporary',
    suitedTo: ['north-facing rooms', 'basements above grade', 'minimal interiors'],
    /* No fuming: hard maple has no meaningful tannin for ammonia to react with. */
    finishes: NON_REACTIVE_FINISHES,
  },
  {
    id: 'hickory',
    name: 'Hickory',
    rateKey: 'hickory',
    /* True hickory, not pecan: the two are separate rows in Table 13–5 and
       differ by about 30% tangentially. The harder of the two is what gets
       laid as flooring. */
    movementSpeciesId: 'true-hickory',
    janka: 1820,
    base: '#c08e5e',
    grain: '#8a5c33',
    tone: 'mid',
    undertone: 'warm',
    durability: 'hardest',
    maintenance: 'low',
    note: 'The hardest floor we lay, with the most colour variation board to board. Family-proof.',
    swatchNote: 'Hardest we lay. Family-proof.',
    suitedTo: ['kitchens', 'entryways', 'houses with dogs', 'rentals'],
    finishes: NON_REACTIVE_FINISHES,
  },
] as const;

export const DEFAULT_PRODUCT = FLOOR_PRODUCTS[0].id;

export const productById = (id: string): FloorProduct | undefined =>
  FLOOR_PRODUCTS.find((p) => p.id === id);

/** The species record lib/wood knows, for the movement arithmetic. */
export const woodSpeciesFor = (product: FloorProduct): WoodSpecies | undefined =>
  WOOD_SPECIES.find((s) => s.id === product.movementSpeciesId);

export const finishById = (id: string): FinishOption | undefined =>
  FINISH_OPTIONS.find((f) => f.id === id);

export const patternById = (id: string): PatternOption | undefined =>
  PATTERN_OPTIONS.find((p) => p.id === id);

/* ── configurations ───────────────────────────────────────────────────────── */

export type FloorConfiguration = {
  productId: string;
  finishId: string;
  patternId: string;
  widthId: string;
};

/** Patterns cut as blocks. See the header — geometry, not merchandising. */
const BLOCK_PATTERNS = new Set(['herringbone', 'chevron']);
const BLOCK_MAX_INCHES = 5;

export type Incompatibility = { axis: 'finish' | 'pattern' | 'width'; reason: string };

/**
 * Why a combination cannot be laid — empty means it can.
 *
 * Returns reasons rather than a boolean because the UI shows them. A control
 * that silently disables itself teaches a visitor that the product is broken;
 * one that says "hard maple has no tannin for the ammonia to react with"
 * teaches them something true and makes the company look like it knows what it
 * is doing, which it does.
 */
export function incompatibilities(config: FloorConfiguration): Incompatibility[] {
  const out: Incompatibility[] = [];
  const product = productById(config.productId);
  const width = widthById(config.widthId);
  if (!product) return [{ axis: 'finish', reason: 'Unknown species.' }];

  if (!finishById(config.finishId)) {
    out.push({ axis: 'finish', reason: 'Unknown finish.' });
  } else if (!product.finishes.includes(config.finishId)) {
    out.push({
      axis: 'finish',
      reason: `Fuming is an ammonia reaction with the tannin in the wood. ${product.name} does not carry enough of it for the reaction to take, so we do not offer it smoked.`,
    });
  }

  if (!patternById(config.patternId)) out.push({ axis: 'pattern', reason: 'Unknown pattern.' });
  if (!width) out.push({ axis: 'width', reason: 'Unknown board width.' });

  if (width && BLOCK_PATTERNS.has(config.patternId) && width.inches > BLOCK_MAX_INCHES) {
    out.push({
      axis: 'width',
      reason: `${patternById(config.patternId)?.label ?? 'This pattern'} is cut as blocks, and past ${BLOCK_MAX_INCHES}″ the proportion stops reading as a pattern. We lay it at 3¼″ and 5″.`,
    });
  }

  return out;
}

export const isLayable = (config: FloorConfiguration): boolean =>
  incompatibilities(config).length === 0;

/** Stable, URL-safe, and the id the estimate payload and share link carry. */
export const configurationId = (c: FloorConfiguration): string =>
  `${c.productId}__${c.finishId}__${c.patternId}__${c.widthId}`;

export function parseConfigurationId(id: string): FloorConfiguration | null {
  const parts = id.split('__');
  if (parts.length !== 4) return null;
  const config: FloorConfiguration = {
    productId: parts[0]!,
    finishId: parts[1]!,
    patternId: parts[2]!,
    widthId: parts[3]!,
  };
  return isLayable(config) ? config : null;
}

export const DEFAULT_CONFIGURATION: FloorConfiguration = {
  productId: DEFAULT_PRODUCT,
  finishId: DEFAULT_FINISH,
  patternId: DEFAULT_PATTERN,
  widthId: DEFAULT_WIDTH,
};

/**
 * Move one axis and return a configuration that can actually be laid.
 *
 * A visitor on 7″ herringbone who switches to 8″ must not land on a floor that
 * does not exist, and must not be told "no" either. The rule is: change what
 * they asked for, then repair the axis that broke — never the axis they just
 * touched. `repairedAxes` is what the UI narrates, so the correction is visible
 * rather than magic.
 */
export function withAxis(
  config: FloorConfiguration,
  axis: keyof FloorConfiguration,
  value: string,
): { config: FloorConfiguration; repairedAxes: (keyof FloorConfiguration)[] } {
  const next: FloorConfiguration = { ...config, [axis]: value };
  const repaired: (keyof FloorConfiguration)[] = [];
  if (isLayable(next)) return { config: next, repairedAxes: repaired };

  const product = productById(next.productId);
  if (product && !product.finishes.includes(next.finishId) && axis !== 'finishId') {
    next.finishId = product.finishes.includes(DEFAULT_FINISH) ? DEFAULT_FINISH : product.finishes[0]!;
    repaired.push('finishId');
  }

  const width = widthById(next.widthId);
  if (width && BLOCK_PATTERNS.has(next.patternId) && width.inches > BLOCK_MAX_INCHES) {
    if (axis === 'widthId') {
      next.patternId = DEFAULT_PATTERN;
      repaired.push('patternId');
    } else {
      next.widthId = DEFAULT_WIDTH;
      repaired.push('widthId');
    }
  }

  return { config: isLayable(next) ? next : DEFAULT_CONFIGURATION, repairedAxes: repaired };
}

/** Every layable combination. Used by tests, the API primitive and the matcher. */
export function allConfigurations(): FloorConfiguration[] {
  const out: FloorConfiguration[] = [];
  for (const product of FLOOR_PRODUCTS) {
    for (const finishId of product.finishes) {
      for (const pattern of PATTERN_OPTIONS) {
        for (const width of BOARD_WIDTHS) {
          const config = { productId: product.id, finishId, patternId: pattern.id, widthId: width.id };
          if (isLayable(config)) out.push(config);
        }
      }
    }
  }
  return out;
}

/* ── naming ───────────────────────────────────────────────────────────────── */

/** "White Oak · Satin · Herringbone · 5″ plank" — one line, everywhere. */
export function describeConfiguration(c: FloorConfiguration): string {
  const product = productById(c.productId);
  const finish = finishById(c.finishId);
  const pattern = patternById(c.patternId);
  const width = widthById(c.widthId);
  return [product?.name, finish?.label, pattern?.label, width?.label]
    .filter(Boolean)
    .join(' · ');
}

/* ── money: a delegation, never a calculation ─────────────────────────────── */

/**
 * The installed range for a configuration over an area.
 *
 * Width is deliberately absent from the arguments passed downstream. See the
 * header: it changes the floor and the movement, not the published band.
 */
export function priceConfiguration(c: FloorConfiguration, squareFeet: number): EstimateResult {
  const product = productById(c.productId);
  return estimateInstalledRangeCad({
    species: product?.rateKey ?? FLOOR_PRODUCTS[0].rateKey,
    squareFeet,
    finish: c.finishId,
    pattern: c.patternId,
  });
}

/* ── movement: computed from published coefficients, never stored ─────────── */

/**
 * A Toronto indoor year, as the Wood Handbook describes it.
 *
 * 21°C is the temperature every one of these houses is held at. 50% relative
 * humidity in July and 25% in February is the swing a GTA house without a
 * humidifier actually sees, and it is the same pair /tools/floor-movement uses
 * as its worked example. Both ends sit inside the published EMC envelope, so
 * the result carries no extrapolation caveat.
 */
export const TORONTO_INDOOR_YEAR = { tempC: 21, rhLowPct: 25, rhHighPct: 50 } as const;

export type MovementNote = {
  /** Width change of ONE board across the year, millimetres. */
  boardMovementMm: number;
  /** The same thing said the way a person experiences it: a seasonal gap. */
  sentence: string;
};

const MM_PER_INCH = 25.4;

/**
 * What this floor does between July and February, in millimetres, for the width
 * the visitor chose. Returns null rather than inventing a figure when the
 * species is not in the published table.
 */
export function movementFor(c: FloorConfiguration): MovementNote | null {
  const product = productById(c.productId);
  const width = widthById(c.widthId);
  if (!product || !width) return null;
  const species = woodSpeciesFor(product);
  if (!species) return null;

  const result = computeMovement({
    species,
    orientation: 'flatsawn',
    boardWidthMm: width.inches * MM_PER_INCH,
    tempC: TORONTO_INDOOR_YEAR.tempC,
    rhLowPct: TORONTO_INDOOR_YEAR.rhLowPct,
    rhHighPct: TORONTO_INDOOR_YEAR.rhHighPct,
  });
  if (!result) return null;

  const mm = Math.abs(result.boardMovementMm);
  return {
    boardMovementMm: mm,
    sentence:
      `A ${width.label.replace(/ .*/, '')} ${product.name.toLowerCase()} board changes about ` +
      `${mm.toFixed(1)} mm across its width between a Toronto July and a Toronto February, flatsawn, ` +
      `at 21°C. That is arithmetic from the Wood Handbook coefficients, not a warranty — ` +
      `it is why wide boards want a humidifier.`,
  };
}
