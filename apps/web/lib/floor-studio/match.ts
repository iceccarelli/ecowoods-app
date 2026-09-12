/**
 * lib/floor-studio/match.ts — ECOWOODS AI FLOOR MATCH, and why it is not a model.
 *
 * THE RULE THIS FILE ENFORCES
 *
 * A percentage with no sentence under it is worthless. "96% match" is a number
 * a homeowner cannot check, cannot argue with, and cannot repeat to their
 * partner — which means it does not move a $30,000 decision, it just decorates
 * one. So the score here is not produced and then explained. It is produced BY
 * the explanations: every criterion returns a sentence and a signed weight, the
 * score is the arithmetic over those weights, and `recomputeScore()` proves the
 * two agree. A criterion that cannot say why it moved the number is not allowed
 * to move it.
 *
 * WHY NOT AN ACTUAL MODEL
 *
 * Because there is nothing here a model would do better and several things it
 * would do worse. The inputs are five measured facts about a room and a handful
 * of chosen words. The outputs must be restricted to configurations this
 * company can install, must be stable (a visitor who changes nothing and
 * refreshes must see the same three floors), must be explainable to somebody
 * spending five figures, and must never invent a product. A scoring function
 * satisfies all four by construction and runs in the browser in under a
 * millisecond with no key, no vendor and no outage. The word AI earns its place
 * in this product at the room-reading step and at EcowoodsGuide; here it would
 * be a costume.
 *
 * FEEL FIRST, JANKA LAST
 *
 * The visitor is asked how they want the room to FEEL. Nobody outside the trade
 * opens a renovation by asking about hardness, and a product that greets them
 * with a Janka table is a product built for the person who made it. The
 * technical facts are all still here — they are what the criteria read — they
 * are just not what the visitor is interrogated about.
 *
 * DIVERSITY IS A PRODUCT DECISION, NOT A TIE-BREAK
 *
 * Left alone, a scoring function returns three white oaks that differ by a
 * finish. That is a worse answer than three different woods even when it scores
 * higher, because the visitor came to choose and has been shown one choice
 * wearing three hats. `matchFloors` therefore returns at most one configuration
 * per species in the headline set, and says so here rather than hiding it.
 */
import type { EstimateResult } from '@ecowoods/shared/ai';
import {
  BOARD_WIDTHS,
  FLOOR_PRODUCTS,
  allConfigurations,
  configurationId,
  describeConfiguration,
  patternById,
  priceConfiguration,
  productById,
  widthById,
  type FloorConfiguration,
  type FloorProduct,
} from './catalog';
import type { LightLevel, RoomReading } from './room';

/* ── what the visitor is asked ────────────────────────────────────────────── */

export type FeelTag =
  | 'brighter'
  | 'warmer'
  | 'luxurious'
  | 'peaceful'
  | 'modern'
  | 'natural'
  | 'dramatic'
  | 'value'
  | 'unsure';

export type Feel = { id: FeelTag; label: string; blurb: string };

/** The question, in the order it reads best. Multiple answers are allowed. */
export const FEELS: readonly Feel[] = [
  { id: 'brighter', label: 'Brighter', blurb: 'More light back into the room.' },
  { id: 'warmer', label: 'Warmer', blurb: 'Somewhere you want to sit down.' },
  { id: 'luxurious', label: 'More luxurious', blurb: 'The floor is the thing people notice.' },
  { id: 'peaceful', label: 'More peaceful', blurb: 'Quiet, even, nothing shouting.' },
  { id: 'modern', label: 'More modern', blurb: 'Long clean lines, few interruptions.' },
  { id: 'natural', label: 'More natural', blurb: 'You can feel the grain underfoot.' },
  { id: 'dramatic', label: 'More dramatic', blurb: 'Dark, deliberate, high contrast.' },
  { id: 'value', label: 'Best value', blurb: 'The most floor for the money.' },
  { id: 'unsure', label: 'I’m not sure — choose for me', blurb: 'We will read the room and pick.' },
] as const;

export const isFeelTag = (v: string): v is FeelTag => FEELS.some((f) => f.id === v);

export type RoomType = {
  id: string;
  label: string;
  /** True where the floor takes real traffic and hardness matters. */
  hardWearing: boolean;
};

export const ROOM_TYPES: readonly RoomType[] = [
  { id: 'living', label: 'Living room', hardWearing: false },
  { id: 'bedroom', label: 'Bedroom', hardWearing: false },
  { id: 'kitchen', label: 'Kitchen or dining', hardWearing: true },
  { id: 'hallway', label: 'Hallway or entry', hardWearing: true },
  { id: 'main-floor', label: 'Whole main floor', hardWearing: true },
  { id: 'condo', label: 'Condo', hardWearing: false },
] as const;

export const roomTypeById = (id: string): RoomType | undefined =>
  ROOM_TYPES.find((r) => r.id === id);

export type MatchInput = {
  feels: readonly FeelTag[];
  /** The measured reading, where a photograph was analysed. */
  room?: Pick<RoomReading, 'lightLevel' | 'wallUndertone' | 'existingFloorTone'>;
  roomTypeId?: string;
  squareFeet: number;
  /**
   * An installed budget the visitor typed, in CAD. Optional, and used only to
   * caveat — never to hide a floor. Somebody who says $20,000 and falls in love
   * with a $24,000 floor is a conversation, not a filter.
   */
  budgetCad?: number;
};

/* ── the criteria ─────────────────────────────────────────────────────────── */

type Context = {
  input: MatchInput;
  config: FloorConfiguration;
  product: FloorProduct;
  estimate: EstimateResult;
  feels: Set<FeelTag>;
};

/** A signed judgement with the sentence that justifies it. */
type Judgement = { delta: number; sentence: string } | null;

type Criterion = {
  id: string;
  /** Maximum absolute contribution. Only counted when the criterion applies. */
  weight: number;
  evaluate: (ctx: Context) => Judgement;
};

const has = (ctx: Context, ...tags: FeelTag[]) => tags.some((t) => ctx.feels.has(t));

/** Feels that carry an opinion. 'unsure' deliberately carries none. */
const OPINIONATED: FeelTag[] = ['brighter', 'warmer', 'luxurious', 'peaceful', 'modern', 'natural', 'dramatic', 'value'];

const LIGHT_WANTED: Record<LightLevel, string> = {
  dim: 'gives back the light this room does not have much of',
  balanced: 'reads close to its swatch in light like this',
  bright: 'holds its colour in a room this bright instead of washing out',
};

const CRITERIA: Criterion[] = [
  /* ── feel ──────────────────────────────────────────────────────────────── */
  {
    id: 'feel.brighter',
    weight: 3,
    evaluate: (ctx) => {
      if (!has(ctx, 'brighter')) return null;
      if (ctx.product.tone === 'light') return { delta: 1, sentence: `${ctx.product.name} is the lightest floor we lay, which is the whole of what you asked for.` };
      if (ctx.product.tone === 'mid') return { delta: 0.2, sentence: `${ctx.product.name} is mid-toned — brighter than what is probably there, without going pale.` };
      return { delta: -1, sentence: `${ctx.product.name} is a dark floor, which is the opposite of brighter. It is here because it may still be the right room.` };
    },
  },
  {
    id: 'feel.warmer',
    weight: 3,
    evaluate: (ctx) => {
      if (!has(ctx, 'warmer')) return null;
      if (ctx.product.undertone === 'warm') return { delta: 1, sentence: `${ctx.product.name} carries a warm undertone in the wood itself, not in the stain.` };
      if (ctx.product.undertone === 'neutral') return { delta: 0.3, sentence: `${ctx.product.name} is neutral and takes a warm stain readily.` };
      return { delta: -0.8, sentence: `${ctx.product.name} runs cool. It can be warmed with colour, but it is working against itself.` };
    },
  },
  {
    id: 'feel.luxurious',
    weight: 3,
    evaluate: (ctx) => {
      if (!has(ctx, 'luxurious')) return null;
      const pattern = patternById(ctx.config.patternId);
      const width = widthById(ctx.config.widthId);
      const rich = ctx.product.tone === 'dark' ? 0.5 : 0;
      const cut = pattern && (pattern.id === 'herringbone' || pattern.id === 'chevron') ? 0.5 : 0;
      const wide = width && width.inches >= 7 ? 0.3 : 0;
      const delta = Math.min(1, rich + cut + wide) || -0.3;
      return {
        delta,
        sentence:
          delta > 0
            ? `${[cut ? `${pattern!.label} is the cut people photograph` : null, rich ? 'the tone is deep enough to read as deliberate' : null, wide ? 'and the board is wide enough to look specified' : null].filter(Boolean).join(', ')}.`
            : 'This is a handsome everyday floor rather than a statement one.',
      };
    },
  },
  {
    id: 'feel.peaceful',
    weight: 3,
    evaluate: (ctx) => {
      if (!has(ctx, 'peaceful')) return null;
      const straight = ctx.config.patternId === 'straight';
      const calm = ctx.product.id === 'white-oak' || ctx.product.id === 'hard-maple';
      if (straight && calm) return { delta: 1, sentence: `Straight ${ctx.product.name.toLowerCase()} is about as quiet as a floor gets — even colour, long lines, nothing to catch the eye.` };
      if (straight) return { delta: 0.4, sentence: 'Straight plank keeps the lines long, which is most of what makes a room feel still.' };
      return { delta: -0.6, sentence: `${patternById(ctx.config.patternId)?.label ?? 'This pattern'} is a pattern you notice. That is the opposite of peaceful, deliberately.` };
    },
  },
  {
    id: 'feel.modern',
    weight: 3,
    evaluate: (ctx) => {
      if (!has(ctx, 'modern')) return null;
      const width = widthById(ctx.config.widthId);
      const wide = width ? width.inches >= 7 : false;
      const matte = ctx.config.finishId === 'natural-matte' || ctx.config.finishId === 'wire-brushed';
      if (wide && matte) return { delta: 1, sentence: 'Wide boards and a matte surface — the two things that separate a contemporary floor from a nineties one.' };
      if (wide || matte) return { delta: 0.4, sentence: wide ? 'The wide board is the modern half of this; the finish could go further.' : 'The matte finish is the modern half of this; a wider board would go further.' };
      return { delta: -0.5, sentence: 'Narrow boards with a sheen read traditional. Handsome, but not what you asked for.' };
    },
  },
  {
    id: 'feel.natural',
    weight: 3,
    evaluate: (ctx) => {
      if (!has(ctx, 'natural')) return null;
      const textured = ctx.config.finishId === 'wire-brushed' || ctx.config.finishId === 'hand-scraped';
      const character = ctx.product.id === 'hickory' || ctx.product.id === 'red-oak';
      if (textured && character) return { delta: 1, sentence: `${ctx.product.name} has the most colour variation board to board, and the texture means you feel the grain rather than just see it.` };
      if (textured) return { delta: 0.6, sentence: 'A textured surface is the difference between a floor that looks like wood and one that feels like it.' };
      if (character) return { delta: 0.3, sentence: `${ctx.product.name} brings the variation; a wire-brushed or hand-scraped surface would bring the touch.` };
      return { delta: -0.4, sentence: 'A smooth, even floor. Beautiful, and further from the grain than you said you wanted.' };
    },
  },
  {
    id: 'feel.dramatic',
    weight: 3,
    evaluate: (ctx) => {
      if (!has(ctx, 'dramatic')) return null;
      const dark = ctx.product.tone === 'dark' || ctx.config.finishId === 'smoked';
      const cut = ctx.config.patternId === 'chevron' || ctx.config.patternId === 'herringbone';
      if (dark && cut) return { delta: 1, sentence: 'Dark and cut to a pattern. This is the loudest floor in the catalogue and it is not subtle by accident.' };
      if (dark) return { delta: 0.6, sentence: 'Deep enough that the room organises itself around the floor.' };
      if (cut) return { delta: 0.4, sentence: `${patternById(ctx.config.patternId)?.label} carries the drama through geometry rather than colour.` };
      return { delta: -0.7, sentence: 'This is a calm floor. It will not do the thing you asked for.' };
    },
  },
  {
    id: 'feel.value',
    weight: 3,
    evaluate: (ctx) => {
      if (!has(ctx, 'value')) return null;
      /* Value is measured against the cheapest layable version of this
         catalogue, not asserted. Straight plank in a plain finish is the
         floor that costs the least to lay, and the arithmetic says so. */
      const plainest = priceConfiguration(
        { ...ctx.config, finishId: 'natural-matte', patternId: 'straight' },
        ctx.input.squareFeet,
      );
      const premium = ctx.estimate.estimatedHighCad / Math.max(1, plainest.estimatedHighCad);
      if (premium <= 1.01) return { delta: 1, sentence: `${describeConfiguration(ctx.config)} is the least expensive way to lay this species — no pattern waste, no extra finishing passes.` };
      if (premium <= 1.15) return { delta: 0.3, sentence: 'A small premium over the plainest version of this floor, for a finish that earns it.' };
      return { delta: -0.8, sentence: `The pattern and finish add roughly ${Math.round((premium - 1) * 100)}% over the plainest version of the same wood.` };
    },
  },

  /* ── the room, as measured ─────────────────────────────────────────────── */
  {
    id: 'room.light',
    weight: 2,
    evaluate: (ctx) => {
      const level = ctx.input.room?.lightLevel;
      if (!level) return null;
      const tone = ctx.product.tone;
      if (level === 'dim') {
        if (tone === 'light') return { delta: 1, sentence: `Your photo reads dim, and ${ctx.product.name.toLowerCase()} ${LIGHT_WANTED.dim}.` };
        if (tone === 'dark') return { delta: -0.9, sentence: 'Your photo reads dim. A dark floor here will need lamps to carry the room, which is a choice rather than a mistake.' };
        return { delta: 0.2, sentence: 'Your photo reads dim; a mid tone will not fight it.' };
      }
      if (level === 'bright') {
        if (tone === 'dark') return { delta: 0.8, sentence: `Your photo reads bright, and ${ctx.product.name.toLowerCase()} ${LIGHT_WANTED.bright}.` };
        if (tone === 'light') return { delta: -0.2, sentence: 'Your photo reads bright. A light floor can flatten in this much light — worth seeing before you decide.' };
        return { delta: 0.3, sentence: 'Plenty of light to give this floor its colour back.' };
      }
      return { delta: 0.2, sentence: `The light in your photo is balanced, so ${ctx.product.name.toLowerCase()} ${LIGHT_WANTED.balanced}.` };
    },
  },
  {
    id: 'room.undertone',
    weight: 1.5,
    evaluate: (ctx) => {
      const wall = ctx.input.room?.wallUndertone;
      if (!wall || wall === 'neutral') return null;
      if (ctx.product.undertone === wall) return { delta: 0.8, sentence: `Your walls read ${wall}, and so does this floor — the room will feel settled rather than composed.` };
      if (ctx.product.undertone === 'neutral') return { delta: 0.4, sentence: `A neutral floor under ${wall} walls lets the walls decide the temperature.` };
      return { delta: -0.4, sentence: `Your walls read ${wall} and this floor runs the other way. Deliberate contrast works — it is just worth doing on purpose.` };
    },
  },
  {
    id: 'room.contrast',
    weight: 1,
    evaluate: (ctx) => {
      const existing = ctx.input.room?.existingFloorTone;
      if (!existing) return null;
      if (existing === ctx.product.tone) {
        return { delta: -0.3, sentence: `This lands close to the tone already down. If the point of the project is a change, it will not read as one.` };
      }
      return { delta: 0.5, sentence: `A clear step away from the floor that is there now, which is usually why people start.` };
    },
  },
  {
    id: 'room.traffic',
    weight: 2,
    evaluate: (ctx) => {
      const roomType = ctx.input.roomTypeId ? roomTypeById(ctx.input.roomTypeId) : undefined;
      if (!roomType) return null;
      if (!roomType.hardWearing) {
        return ctx.product.durability === 'hard'
          ? { delta: 0.3, sentence: `A ${roomType.label.toLowerCase()} does not punish a floor, so the softer, better-looking woods are genuinely on the table here.` }
          : null;
      }
      if (ctx.product.durability === 'hardest') return { delta: 1, sentence: `${roomType.label} takes the traffic in a house, and ${ctx.product.name.toLowerCase()} is the hardest floor we lay.` };
      if (ctx.product.durability === 'harder') return { delta: 0.5, sentence: `${roomType.label} takes real traffic; ${ctx.product.name.toLowerCase()} is hard enough for it.` };
      return { delta: -0.7, sentence: `${ctx.product.name} is the softest floor here. In a ${roomType.label.toLowerCase()} it will show its life sooner — some people want exactly that.` };
    },
  },

  /* ── money ─────────────────────────────────────────────────────────────── */
  {
    id: 'budget',
    weight: 2.5,
    evaluate: (ctx) => {
      const budget = ctx.input.budgetCad;
      if (!budget || budget <= 0) return null;
      const { estimatedLowCad, estimatedHighCad } = ctx.estimate;
      if (estimatedHighCad <= budget) return { delta: 1, sentence: 'The whole estimated range sits inside the number you gave us.' };
      if (estimatedLowCad <= budget) return { delta: 0.2, sentence: 'The bottom of the range fits your number and the top does not — which is exactly the kind of thing the in-home measure settles.' };
      return { delta: -1, sentence: 'This sits above the number you gave us, at every point in the range. It is shown because you may decide it is worth it, not because we think you should.' };
    },
  },
];

/* ── the result ───────────────────────────────────────────────────────────── */

export type MatchReason = { criterion: string; delta: number; weight: number; sentence: string };

export type Match = {
  config: FloorConfiguration;
  id: string;
  name: string;
  /** 0–100, integer. Reconstructible from `reasons` — see recomputeScore(). */
  score: number;
  /** Sentences that raised the score, strongest first. */
  reasons: string[];
  /** Sentences that lowered it. Shown, never hidden. */
  caveats: string[];
  /** Every judgement, for the tests and for anybody auditing a number. */
  judgements: MatchReason[];
  estimate: EstimateResult;
};

/**
 * -weight → 0, 0 → 50, +weight → 100, over the criteria that applied.
 *
 * A floor nothing is known about scores 50 rather than 0, which is honest: with
 * no feels chosen and no photo analysed there is no evidence either way, and a
 * product that prints 4% on a perfectly good floor because the visitor has not
 * answered anything yet is lying about its own certainty.
 */
export function recomputeScore(judgements: MatchReason[]): number {
  const possible = judgements.reduce((sum, j) => sum + j.weight, 0);
  if (possible === 0) return 50;
  const awarded = judgements.reduce((sum, j) => sum + j.delta * j.weight, 0);
  const ratio = (awarded + possible) / (2 * possible);
  return Math.round(Math.max(0, Math.min(1, ratio)) * 100);
}

function judge(input: MatchInput, config: FloorConfiguration): Match | null {
  const product = productById(config.productId);
  if (!product) return null;
  const estimate = priceConfiguration(config, input.squareFeet);
  const ctx: Context = { input, config, product, estimate, feels: new Set(input.feels) };

  const judgements: MatchReason[] = [];
  for (const criterion of CRITERIA) {
    const verdict = criterion.evaluate(ctx);
    if (!verdict) continue;
    judgements.push({
      criterion: criterion.id,
      delta: Math.max(-1, Math.min(1, verdict.delta)),
      weight: criterion.weight,
      sentence: verdict.sentence,
    });
  }

  const positives = judgements.filter((j) => j.delta > 0).sort((a, b) => b.delta * b.weight - a.delta * a.weight);
  const negatives = judgements.filter((j) => j.delta < 0).sort((a, b) => a.delta * a.weight - b.delta * b.weight);

  return {
    config,
    id: configurationId(config),
    name: describeConfiguration(config),
    score: recomputeScore(judgements),
    reasons: positives.map((j) => j.sentence),
    caveats: negatives.map((j) => j.sentence),
    judgements,
    estimate,
  };
}

/**
 * The headline recommendations.
 *
 * `perProduct` caps how many configurations of the same species may appear. It
 * defaults to 1 for the reason in the header: three white oaks in three hats is
 * not a choice. Pass a higher number where the surface is a full browse rather
 * than a recommendation.
 *
 * Ties break on the configuration id, so the same input always produces the
 * same three floors in the same order. A recommender that reshuffles on refresh
 * teaches a visitor that it was never reasoning.
 */
export function matchFloors(input: MatchInput, limit = 3, perProduct = 1): Match[] {
  const scored = allConfigurations()
    .map((config) => judge(input, config))
    .filter((m): m is Match => m !== null)
    .sort((a, b) => (b.score - a.score) || a.id.localeCompare(b.id));

  const seen = new Map<string, number>();
  const out: Match[] = [];
  for (const match of scored) {
    const count = seen.get(match.config.productId) ?? 0;
    if (count >= perProduct) continue;
    seen.set(match.config.productId, count + 1);
    out.push(match);
    if (out.length >= limit) break;
  }
  return out;
}

/** Every configuration of one species, best first. For "show me more oak". */
export function matchWithinProduct(input: MatchInput, productId: string, limit = 6): Match[] {
  return allConfigurations()
    .filter((c) => c.productId === productId)
    .map((config) => judge(input, config))
    .filter((m): m is Match => m !== null)
    .sort((a, b) => (b.score - a.score) || a.id.localeCompare(b.id))
    .slice(0, limit);
}

/** Score one configuration the visitor chose themselves. */
export const scoreConfiguration = (input: MatchInput, config: FloorConfiguration): Match | null =>
  judge(input, config);

/** Exposed so a test can assert the criteria set has not silently grown. */
export const CRITERION_IDS = CRITERIA.map((c) => c.id);

/** Everything the matcher can possibly consider, for the machine surfaces. */
export const MATCH_INPUT_VOCABULARY = {
  feels: FEELS.map((f) => f.id),
  roomTypes: ROOM_TYPES.map((r) => r.id),
  species: FLOOR_PRODUCTS.map((p) => p.id),
  widths: BOARD_WIDTHS.map((w) => w.id),
  criteria: CRITERION_IDS,
} as const;

/** True where the visitor gave the matcher an opinion to work with. */
export const hasFeelOpinion = (feels: readonly FeelTag[]): boolean =>
  feels.some((f) => OPINIONATED.includes(f));
