export const RENOGUIDE_SYSTEM_PROMPT = `You are RenoGuide, the assistant for Ecowoods — a real Toronto hardwood-flooring company (est. 1998, 25+ yrs, lifetime workmanship warranty).

VOICE: professional, warm, trustworthy, concise, friendly Canadian English.

FORMAT — READ THIS. Your words are printed as PLAIN TEXT into a 392px-wide chat bubble. There is no markdown renderer. A table becomes a wall of pipe characters; **bold** becomes literal asterisks; a > blockquote becomes a stray angle bracket. So:
- Never use tables, headers, bold, italics, blockquotes, or code fences.
- Give a range as one sentence: "Roughly $14,076 to $21,744 for 900 sq ft of white oak in herringbone — about $15.64 to $24.16 a square foot."
- If you must list, use short lines starting with a dash. Three at most.
- Emoji: none.
- Keep replies under about 90 words. This is a conversation on someone's phone, not a document.

WHAT YOU DO: help a homeowner scope a hardwood project, give a transparent ROUGH range, and either BOOK a free in-home measure or capture a quote request so a specialist follows up.

HARD RULES (protect a 25-year reputation):
- NEVER invent specifics. Prices, ranges, hours, phone, availability, appointment times may ONLY be stated if a tool returned them THIS turn. Otherwise say a specialist will confirm.
- Any cost figure is an ESTIMATE that needs an in-home measure to finalize. Say so.
- Never promise a price, a date, or that a specific crew is available.
- Only offer appointment times that get_availability returned. Pass the exact startsAt value to book_measure.

FLOW:
1. Understand the project. Call get_company_context for real contact facts before sharing them.
2. If they share species + rough square footage, call estimate_project and give the labelled rough range. If they mention a finish or a pattern (herringbone, chevron, wire-brushed, smoked...), pass those to estimate_project too — otherwise the number you quote will contradict the one they just saw in the on-site configurator.
3. CLOSE — prefer booking. When there's interest, offer a FREE in-home measure: call get_availability, present 2-3 of the returned times, collect name + email + phone, then call book_measure with the startsAt they chose. Confirm the booked time.
4. If they're not ready to pick a time, collect name + email + phone + postal and call create_quote_request instead — a specialist calls within 1 business day.

CONFIGURATOR HANDOFF: a homeowner may arrive with a message like "I just designed a floor on your site: white oak, satin finish, herringbone, about 900 sq ft in M4K." That is a hot lead who has already told you everything. Do NOT re-interview them. Call estimate_project immediately with exactly those values, give the range, then go straight to step 3.

Be helpful, not pushy. End every turn with one clear next step.`;

export const FLOORING_RATES_CAD_PER_SQFT: Record<string, { low: number; high: number; note: string }> = {
  'red oak':     { low: 9,  high: 14, note: 'classic, widely available' },
  'white oak':   { low: 11, high: 17, note: 'premium grain, very popular' },
  'maple':       { low: 10, high: 15, note: 'hard, light tone' },
  'walnut':      { low: 14, high: 22, note: 'high-end dark hardwood' },
  'hickory':     { low: 11, high: 16, note: 'very hard, rustic character' },
  'refinishing': { low: 4,  high: 7,  note: 'sand + refinish existing floors' },
  'engineered':  { low: 8,  high: 14, note: 'engineered hardwood install' },
};

// ═══════════════════════════════════════════════════════════════════════════
// SHARED PRICING MODEL
// ═══════════════════════════════════════════════════════════════════════════
// One source of truth for the browser configurator AND the estimate_project
// tool in /api/chat. If these ever diverge, a homeowner sees $14,200 on the
// page and RenoGuide says $11,800 thirty seconds later — and a 25-year
// reputation takes the hit. So: one module, imported by both.
//
// ⚠️  ACTION REQUIRED BEFORE LAUNCH
//     FLOORING_RATES_CAD_PER_SQFT above was already in this repo.
//     The FINISH_ and PATTERN_ multipliers below are PLACEHOLDERS I chose to
//     make the model structurally correct — they are NOT Ecowoods' real
//     numbers. Have the estimator confirm them, or the site will quote prices
//     nobody has agreed to honour. They are isolated here so that is a
//     two-minute edit, not a code change.
// ═══════════════════════════════════════════════════════════════════════════

export interface FinishOption {
  id: string;
  label: string;
  blurb: string;
  /** Multiplier on the installed per-sqft rate. PLACEHOLDER — confirm. */
  multiplier: number;
  /** Swatch used by the configurator preview. */
  tint: string;
  sheen: number;
}

export interface PatternOption {
  id: string;
  label: string;
  blurb: string;
  /** Extra labour + waste for the cut. PLACEHOLDER — confirm. */
  multiplier: number;
}

export const FINISH_OPTIONS: readonly FinishOption[] = [
  { id: 'natural-matte',  label: 'Natural Matte',   blurb: 'The grain, unedited. Hides everyday life.', multiplier: 1.0,  tint: 'rgba(196, 152, 106, 0.00)', sheen: 0.06 },
  { id: 'satin',          label: 'Satin',           blurb: 'A soft returning light. The default for a reason.', multiplier: 1.03, tint: 'rgba(196, 152, 106, 0.06)', sheen: 0.16 },
  { id: 'wire-brushed',   label: 'Wire-Brushed',    blurb: 'Texture you feel barefoot. Forgives dogs.', multiplier: 1.1,  tint: 'rgba(120, 84, 54, 0.10)', sheen: 0.1 },
  { id: 'smoked',         label: 'Fumed & Smoked',  blurb: 'Ammonia-reacted tannins. Deep, permanent, moody.', multiplier: 1.22, tint: 'rgba(52, 32, 18, 0.34)', sheen: 0.13 },
  { id: 'hand-scraped',   label: 'Hand-Scraped',    blurb: 'Every board touched by a person. Slow, and it shows.', multiplier: 1.3, tint: 'rgba(96, 64, 38, 0.16)', sheen: 0.09 },
] as const;

export const PATTERN_OPTIONS: readonly PatternOption[] = [
  { id: 'straight',    label: 'Straight Plank', blurb: 'Long, quiet lines. Makes a room read larger.', multiplier: 1.0 },
  { id: 'diagonal',    label: 'Diagonal',       blurb: '45° across the joists. Costs waste, buys movement.', multiplier: 1.12 },
  { id: 'herringbone', label: 'Herringbone',    blurb: 'The one people photograph.', multiplier: 1.38 },
  { id: 'chevron',     label: 'Chevron',        blurb: 'Mitred point-to-point. The hardest floor we lay.', multiplier: 1.52 },
] as const;

export const DEFAULT_SPECIES = 'white oak';
export const DEFAULT_FINISH = FINISH_OPTIONS[1].id;
export const DEFAULT_PATTERN = PATTERN_OPTIONS[0].id;

export interface EstimateInput {
  species: string;
  squareFeet: number;
  finish?: string;
  pattern?: string;
}

export interface EstimateResult {
  species: string;
  squareFeet: number;
  finish: string;
  pattern: string;
  perSqftLowCad: number;
  perSqftHighCad: number;
  estimatedLowCad: number;
  estimatedHighCad: number;
  perSqftCad: string;
  /** True when we fell back to red oak because the species wasn't recognised. */
  speciesFallback: boolean;
  disclaimer: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Deterministic, side-effect free. Called from a React render loop on every
 * slider tick AND from a server-side AI tool. Keep it cheap and pure.
 */
export function estimateInstalledRangeCad(input: EstimateInput): EstimateResult {
  const speciesKey = input.species.toLowerCase().trim();
  const known = FLOORING_RATES_CAD_PER_SQFT[speciesKey];
  const rate = known ?? FLOORING_RATES_CAD_PER_SQFT['red oak'];

  const finish = FINISH_OPTIONS.find((f) => f.id === input.finish);
  const pattern = PATTERN_OPTIONS.find((p) => p.id === input.pattern);
  const mult = (finish?.multiplier ?? 1) * (pattern?.multiplier ?? 1);

  // Refinishing is a labour service on an existing floor: install patterns
  // don't apply, so we never let a chevron multiplier inflate a sanding quote.
  const patternApplies = speciesKey !== 'refinishing';
  const effective = patternApplies ? mult : (finish?.multiplier ?? 1);

  const sqft = Math.max(0, input.squareFeet);
  const low = round2(rate.low * effective);
  const high = round2(rate.high * effective);

  return {
    species: known ? speciesKey : 'red oak',
    squareFeet: sqft,
    finish: finish?.id ?? DEFAULT_FINISH,
    pattern: patternApplies ? (pattern?.id ?? DEFAULT_PATTERN) : DEFAULT_PATTERN,
    perSqftLowCad: low,
    perSqftHighCad: high,
    estimatedLowCad: Math.round(low * sqft),
    estimatedHighCad: Math.round(high * sqft),
    perSqftCad: `$${low}-$${high}/sqft`,
    speciesFallback: !known,
    disclaimer:
      'Rough range only, based on typical GTA conditions. Subfloor, stairs, transitions and moisture ' +
      'all move the number. Final price is fixed in writing after a free in-home measure.',
  };
}

/**
 * The exact sentence a configurator hands to RenoGuide. Written as a homeowner
 * would say it, so the model reliably extracts species + sqft and calls
 * estimate_project rather than asking three clarifying questions first.
 */
export function describeFloorForChat(input: EstimateInput & { postal?: string }): string {
  const finish = FINISH_OPTIONS.find((f) => f.id === input.finish)?.label ?? 'satin';
  const pattern = PATTERN_OPTIONS.find((p) => p.id === input.pattern)?.label ?? 'straight plank';
  const where = input.postal ? ` in ${input.postal.toUpperCase()}` : '';
  return (
    `I just designed a floor on your site: ${input.species}, ${finish.toLowerCase()} finish, ` +
    `${pattern.toLowerCase()}, about ${Math.round(input.squareFeet)} sq ft${where}. ` +
    `What's the realistic range, and what would change it?`
  );
}

export function bookMeasureIntent(input: EstimateInput & { postal?: string }): string {
  return (
    `${describeFloorForChat(input)} I'd like to book the free in-home measure — ` +
    `what times are open?`
  );
}
