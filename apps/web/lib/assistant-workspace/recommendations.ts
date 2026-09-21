/**
 * lib/assistant-workspace/recommendations.ts — "Recommended for your project."
 *
 * ASSISTANT-03. Pure functions over Project Decision State and the real
 * catalog/service registries — no LLM, no network I/O, no invented product,
 * species, service or price. Every `FloorProduct` returned here is a member
 * of `FLOOR_PRODUCTS`; every service is a member of `SERVICES`. A "why it
 * fits" reason is always built from a real field already on that record
 * (`suitedTo`, `maintenance`, `durability`) conditioned on a fact already in
 * state (`objective`, `stairs`, `currentFloor`) — never a claim invented for
 * the occasion. See docs/assistant-workspace/NO_DUPLICATION_GUARANTEE.md.
 *
 * No money math here. `priceBandForService` renders a PUBLISHED band through
 * the same helpers /pricing and every service page already use
 * (`getServicePage`, `bandForCountry`, `formatBand`) — it does not compute an
 * installed-cost range. That arithmetic is ASSISTANT-04's, not built yet.
 */
import {
  FLOOR_PRODUCTS,
  type FloorProduct,
  incompatibilities as catalogIncompatibilities,
  type Incompatibility,
} from '@/lib/floor-studio/catalog';
import { SERVICES, type Service } from '@/lib/seo-data';
import { getServicePage } from '@/lib/service-pages';
import { bandForCountry, formatBand, type PriceBand } from '@/content/constants/pricing';
import type { WorkspaceState } from './types';

export interface ProductRecommendation {
  product: FloorProduct;
  /** Why this floor fits, drawn from the product's own catalog fields. Empty when nothing in state matched yet. */
  whyItFits: string[];
  /** True when this is the floor already recorded in state.targetFloor. */
  selected: boolean;
}

export interface ServiceRecommendation {
  service: Service;
  whyItFits: string[];
  selected: boolean;
  /** A published band, shown only through bandForCountry/formatBand — never a literal. */
  priceBand?: { band: PriceBand; text: string };
}

/**
 * A product is offered only if it can still take the finish already chosen
 * in state, when one has been. Pattern/width compatibility is a property of
 * a full four-axis configuration, not of a product alone — see
 * `selectionIncompatibilities` below for that check.
 */
function productAllowedByState(product: FloorProduct, state: WorkspaceState): boolean {
  const { finishId } = state.targetFloor;
  if (!finishId) return true;
  return product.finishes.includes(finishId);
}

/** Reasons sourced from the product's own fields, conditioned on real state facts. Never invented. */
function whyProductFits(product: FloorProduct, state: WorkspaceState): string[] {
  const reasons: string[] = [];

  if (state.currentFloor.productId === product.id && (state.objective === 'refinish' || state.objective === 'repair')) {
    reasons.push('Matches the floor already there');
  }

  if (state.stairs && product.suitedTo.some((s) => s.toLowerCase().includes('stair'))) {
    reasons.push('Suited to stairs');
  }

  for (const room of state.rooms) {
    const label = room.label.toLowerCase();
    const match = product.suitedTo.find((s) => label.includes(s.toLowerCase()) || s.toLowerCase().includes(label));
    if (match && !reasons.includes(`Suited to ${match}`)) reasons.push(`Suited to ${match}`);
  }

  if (state.sellHorizon === 'selling-soon' && product.maintenance === 'low') {
    reasons.push('Low maintenance');
  }

  return reasons;
}

/**
 * Ranked, filtered `FloorProduct`s. Never returns an id outside
 * `FLOOR_PRODUCTS`. With no state signal yet, returns the full catalog in
 * its published order with no reasons attached — a visitor with nothing set
 * still sees real floors, never an empty shelf.
 */
export function recommendProducts(state: WorkspaceState, limit = FLOOR_PRODUCTS.length): ProductRecommendation[] {
  return FLOOR_PRODUCTS.filter((p) => productAllowedByState(p, state))
    .map((product) => ({
      product,
      whyItFits: whyProductFits(product, state),
      selected: state.targetFloor.productId === product.id,
    }))
    .sort((a, b) => {
      if (a.selected !== b.selected) return a.selected ? -1 : 1;
      if (a.whyItFits.length !== b.whyItFits.length) return b.whyItFits.length - a.whyItFits.length;
      return FLOOR_PRODUCTS.indexOf(a.product).valueOf() - FLOOR_PRODUCTS.indexOf(b.product).valueOf();
    })
    .slice(0, limit);
}

/** The one published band that applies to a service, if it has one — via the real per-service registry, never guessed. */
export function priceBandForService(slug: string, country: WorkspaceState['country']): { band: PriceBand; text: string } | undefined {
  const key = getServicePage(slug)?.pricing;
  if (!key) return undefined;
  const band = bandForCountry(key, country);
  return { band, text: formatBand(band) };
}

const OBJECTIVE_SERVICE_SLUGS: Record<NonNullable<WorkspaceState['objective']>, string[]> = {
  install: ['hardwood-installation'],
  refinish: ['floor-refinishing', 'dust-free-sanding'],
  repair: ['floor-restoration'],
  'not-sure': [],
};

function whyServiceFits(service: Service, state: WorkspaceState): string[] {
  const reasons: string[] = [];
  if (state.objective && OBJECTIVE_SERVICE_SLUGS[state.objective].includes(service.slug)) {
    reasons.push(`Matches your objective: ${state.objective}`);
  }
  if (state.stairs && service.slug === 'stair-refinishing') {
    reasons.push('You mentioned stairs');
  }
  return reasons;
}

/**
 * Ranked `Service`s, matched only against `state.objective` and
 * `state.stairs` — the two signals the brief names as safe to map. With no
 * signal yet, returns every published service with no reasons, same
 * no-empty-shelf rule as `recommendProducts`.
 */
export function recommendServices(state: WorkspaceState): ServiceRecommendation[] {
  return SERVICES.map((service) => ({
    service,
    whyItFits: whyServiceFits(service, state),
    selected: state.selectedServiceSlugs.includes(service.slug),
    priceBand: priceBandForService(service.slug, state.country),
  })).sort((a, b) => {
    if (a.selected !== b.selected) return a.selected ? -1 : 1;
    if (a.whyItFits.length !== b.whyItFits.length) return b.whyItFits.length - a.whyItFits.length;
    return SERVICES.indexOf(a.service) - SERVICES.indexOf(b.service);
  });
}

/**
 * Real incompatibilities, straight from `incompatibilities()` in
 * lib/floor-studio/catalog.ts — never reimplemented here. Only checkable
 * once state names all four axes of a configuration; a partial selection
 * has nothing to report yet, which is the honest answer, not an empty pass.
 */
export function selectionIncompatibilities(state: WorkspaceState): Incompatibility[] {
  const { productId, finishId, patternId, widthId } = state.targetFloor;
  if (!productId || !finishId || !patternId || !widthId) return [];
  return catalogIncompatibilities({ productId, finishId, patternId, widthId });
}
