/**
 * lib/assistant-workspace/interpret.ts — free text to a structured patch.
 *
 * Keyword fallback / supplement for the workspace composer. The live path is
 * POST /api/assistant/chat (structured model + tools). This matcher still
 * runs when the model is unavailable (503 / network) and as a safety net
 * after a model turn so obvious catalog hits land even if attach_to_project
 * was skipped. It never invents a product, finish, pattern, service or
 * price — every match comes from FLOOR_PRODUCTS, FINISH_OPTIONS,
 * PATTERN_OPTIONS, SERVICES.
 *
 * A message that matches nothing returns an empty patch — never a guess
 * dressed up as an understood answer.
 */
import { FLOOR_PRODUCTS, FINISH_OPTIONS, PATTERN_OPTIONS, BOARD_WIDTHS, SERVICES } from './state';
import type { WorkspacePatch } from './types';

export interface InterpretResult {
  patch: WorkspacePatch;
  /** What this pass understood, in plain words, for the assistant's reply. */
  understood: string[];
}

const OBJECTIVE_KEYWORDS: { match: RegExp; value: WorkspacePatch['objective'] }[] = [
  { match: /\brefinish(ing)?\b|\bresand(ing)?\b|\bre-sand(ing)?\b|\brecoat(ing)?\b|\bre-coat(ing)?\b|\bscreen\b/i, value: 'refinish' },
  { match: /\bnew[- ]floor(ing)?\b|\binstall(ation|ing)?\b|\bnew hardwood\b/i, value: 'install' },
  { match: /\brepair(s|ing)?\b|\bdamage\b|\bfix(ing)?\b|\bcupping\b|\bgapping\b|\bbuckl(e|ing)\b/i, value: 'repair' },
];

const SELL_HORIZON_KEYWORDS: { match: RegExp; value: WorkspacePatch['sellHorizon'] }[] = [
  { match: /\b(selling|sell soon|list the house|pre-list|realtor)\b/i, value: 'selling-soon' },
  { match: /\b(staying|living here|forever home|not selling)\b/i, value: 'staying' },
];

const STAIRS_KEYWORDS = /\b(stairs?|staircase|steps)\b/i;

/** Case-insensitive whole-word-ish match against a catalog label/name. */
function labelMatches(text: string, label: string): boolean {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
}

export function interpretMessage(text: string): InterpretResult {
  const patch: WorkspacePatch = {};
  const understood: string[] = [];
  const targetFloor: WorkspacePatch['targetFloor'] = {};

  for (const { match, value } of OBJECTIVE_KEYWORDS) {
    if (match.test(text)) {
      patch.objective = value;
      understood.push(`objective: ${value}`);
      break;
    }
  }

  for (const { match, value } of SELL_HORIZON_KEYWORDS) {
    if (match.test(text)) {
      patch.sellHorizon = value;
      understood.push(`sell horizon: ${value}`);
      break;
    }
  }

  if (STAIRS_KEYWORDS.test(text)) {
    patch.stairs = true;
    understood.push('stairs: included');
  }

  const product = FLOOR_PRODUCTS.find((p) => labelMatches(text, p.name));
  if (product) {
    targetFloor.productId = product.id;
    understood.push(`species: ${product.name}`);
  }

  const finish = FINISH_OPTIONS.find((f) => labelMatches(text, f.label));
  if (finish) {
    targetFloor.finishId = finish.id;
    understood.push(`finish: ${finish.label}`);
  }

  const pattern = PATTERN_OPTIONS.find((p) => labelMatches(text, p.label));
  if (pattern) {
    targetFloor.patternId = pattern.id;
    understood.push(`pattern: ${pattern.label}`);
  }

  const width = BOARD_WIDTHS.find((w) => labelMatches(text, w.label));
  if (width) {
    targetFloor.widthId = width.id;
    understood.push(`width: ${width.label}`);
  }

  if (Object.keys(targetFloor).length) patch.targetFloor = targetFloor;

  const matchedServices = SERVICES.filter((s) => labelMatches(text, s.name));
  if (matchedServices.length) {
    patch.selectedServiceSlugs = matchedServices.map((s) => s.slug);
    understood.push(...matchedServices.map((s) => `service: ${s.name}`));
  }

  const sqftMatch = text.match(/(\d{2,5})\s*(?:sq\.?\s*ft|square feet|sqft)/i);
  if (sqftMatch) {
    const sqft = Number(sqftMatch[1]);
    if (Number.isFinite(sqft) && sqft > 0 && sqft < 20000) {
      patch.rooms = [{ label: 'Whole project', squareFeet: Math.round(sqft) }];
      understood.push(`square footage: ${Math.round(sqft)}`);
    }
  }

  return { patch, understood };
}
