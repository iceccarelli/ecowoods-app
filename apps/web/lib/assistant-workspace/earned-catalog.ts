/**
 * lib/assistant-workspace/earned-catalog.ts — whether THIS turn earned a
 * "Worth considering" / "Services" catalogue, and what it contains.
 *
 * Fixes the generic-catalogue bug: previously the ConversationPane showed
 * ProductCard/ServiceCard grids whenever `state.objective` was set at all —
 * so once a visitor mentioned refinishing early in a conversation, every
 * later reply (including "roof vs kitchen vs floors?") kept showing
 * flooring products/services underneath, whether or not that turn had
 * anything to do with them. A homeowner asking a sequencing question does
 * not want a flooring catalogue reattached to the answer.
 *
 * `computeEarnedCatalog` only returns a catalogue when THIS turn's patch —
 * the one just applied from the model's `attach_to_project` call or the
 * keyword fallback — actually touched a floor-relevant field (objective,
 * targetFloor, selectedServiceSlugs, stairs). A turn that changed nothing
 * floor-related (a market-cost question about kitchens/roofs, a pure
 * information question) returns undefined — zero cards, per
 * ASK_FRANCISCO_AGENT_PROMPT's "no irrelevant cards" rule.
 *
 * Pure function over Project Decision State + a patch — no LLM, no network
 * I/O, same discipline as recommendations.ts. Caller attaches the result to
 * the specific assistant message it answers, never to a floating block that
 * survives into later, unrelated turns.
 */
import { recommendProducts, recommendServices, type ProductRecommendation, type ServiceRecommendation } from './recommendations';
import { applyPatch } from './state';
import type { WorkspacePatch, WorkspaceState } from './types';

export interface EarnedCatalog {
  products: ProductRecommendation[];
  services: ServiceRecommendation[];
}

export interface EarnedCatalogLimits {
  /** Max product cards. */
  products: number;
  /** Max combined product + service cards for one turn — never a card grid. */
  total: number;
}

export const DEFAULT_EARNED_CATALOG_LIMITS: EarnedCatalogLimits = { products: 2, total: 3 };

/** True only when a patch actually names a floor-relevant field — not just any non-empty patch. */
export function isFloorRelevantPatch(patch: WorkspacePatch): boolean {
  return Boolean(
    patch.objective !== undefined || patch.targetFloor || patch.selectedServiceSlugs || patch.stairs !== undefined,
  );
}

/**
 * The catalogue THIS turn earned, or undefined when this turn's patch didn't
 * touch a floor-relevant field, or the resulting state still has no
 * objective (nothing to recommend against yet).
 */
export function computeEarnedCatalog(
  state: WorkspaceState,
  turnPatch: WorkspacePatch,
  limits: EarnedCatalogLimits = DEFAULT_EARNED_CATALOG_LIMITS,
): EarnedCatalog | undefined {
  if (!isFloorRelevantPatch(turnPatch)) return undefined;

  const projected = applyPatch(state, turnPatch);
  if (!projected.objective) return undefined;

  const products = recommendProducts(projected, limits.products);
  const remaining = Math.max(0, limits.total - products.length);
  const services = recommendServices(projected).slice(0, remaining);

  if (!products.length && !services.length) return undefined;
  return { products, services };
}
