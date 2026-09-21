/**
 * recommendations.test.ts — ASSISTANT-03.
 *
 * The tests that matter: recommendations never contain an id outside the
 * live catalog/service registry, and real incompatibilities (from
 * lib/floor-studio/catalog.ts, never reimplemented) are surfaced rather than
 * silently dropped or silently allowed.
 */
import { describe, expect, it } from 'vitest';
import { FLOOR_PRODUCTS } from '@/lib/floor-studio/catalog';
import { SERVICES } from '@/lib/seo-data';
import { defaultWorkspaceState, applyPatch } from './state';
import { recommendProducts, recommendServices, priceBandForService, selectionIncompatibilities } from './recommendations';

const KNOWN_PRODUCT_IDS = new Set(FLOOR_PRODUCTS.map((p) => p.id));
const KNOWN_SERVICE_SLUGS = new Set(SERVICES.map((s) => s.slug));

describe('recommendProducts', () => {
  it('never returns a product id outside FLOOR_PRODUCTS', () => {
    const state = applyPatch(defaultWorkspaceState(), { objective: 'install' });
    const recs = recommendProducts(state);
    for (const r of recs) expect(KNOWN_PRODUCT_IDS.has(r.product.id)).toBe(true);
  });

  it('returns the full catalog with no reasons when nothing is known yet', () => {
    const recs = recommendProducts(defaultWorkspaceState());
    expect(recs).toHaveLength(FLOOR_PRODUCTS.length);
    for (const r of recs) expect(r.whyItFits).toHaveLength(0);
  });

  it('boosts a product suited to stairs when state.stairs is true, and says why', () => {
    const state = applyPatch(defaultWorkspaceState(), { stairs: true });
    const recs = recommendProducts(state);
    const stairSuited = recs.find((r) => r.product.suitedTo.some((s) => s.includes('stairs')));
    expect(stairSuited).toBeDefined();
    expect(stairSuited!.whyItFits).toContain('Suited to stairs');
  });

  it('marks the product already in targetFloor as selected and sorts it first', () => {
    const productId = FLOOR_PRODUCTS[2]!.id;
    const state = applyPatch(defaultWorkspaceState(), { targetFloor: { productId } });
    const recs = recommendProducts(state);
    expect(recs[0]!.product.id).toBe(productId);
    expect(recs[0]!.selected).toBe(true);
  });

  it('filters out a product that cannot take the chosen finish', () => {
    // black-walnut and hard-maple carry NON_REACTIVE_FINISHES — 'smoked' should exclude them.
    const state = applyPatch(defaultWorkspaceState(), { targetFloor: { finishId: 'smoked' } });
    const recs = recommendProducts(state);
    for (const r of recs) expect(r.product.finishes).toContain('smoked');
  });

  it('respects the requested limit', () => {
    const recs = recommendProducts(defaultWorkspaceState(), 2);
    expect(recs).toHaveLength(2);
  });
});

describe('recommendServices', () => {
  it('never returns a service slug outside SERVICES', () => {
    const state = applyPatch(defaultWorkspaceState(), { objective: 'refinish' });
    const recs = recommendServices(state);
    for (const r of recs) expect(KNOWN_SERVICE_SLUGS.has(r.service.slug)).toBe(true);
  });

  it('matches services to the objective, and says why', () => {
    const state = applyPatch(defaultWorkspaceState(), { objective: 'refinish' });
    const recs = recommendServices(state);
    const refinishing = recs.find((r) => r.service.slug === 'floor-refinishing');
    expect(refinishing).toBeDefined();
    expect(refinishing!.whyItFits.length).toBeGreaterThan(0);
  });

  it('marks a selected service slug as selected', () => {
    const state = applyPatch(defaultWorkspaceState(), { selectedServiceSlugs: ['dust-free-sanding'] });
    const recs = recommendServices(state);
    expect(recs.find((r) => r.service.slug === 'dust-free-sanding')!.selected).toBe(true);
  });

  it('never returns a price band that is not the real published one', () => {
    const state = applyPatch(defaultWorkspaceState(), { country: 'CA' });
    const recs = recommendServices(state);
    for (const r of recs) {
      if (!r.priceBand) continue;
      // Re-derive independently and compare — no drift between the card and the source.
      const again = priceBandForService(r.service.slug, 'CA');
      expect(r.priceBand.text).toBe(again!.text);
    }
  });
});

describe('selectionIncompatibilities', () => {
  it('reports nothing when the selection is incomplete', () => {
    const state = applyPatch(defaultWorkspaceState(), { targetFloor: { productId: FLOOR_PRODUCTS[0]!.id } });
    expect(selectionIncompatibilities(state)).toHaveLength(0);
  });

  it('surfaces a real incompatibility from catalog.ts — hard maple cannot be smoked', () => {
    const state = applyPatch(defaultWorkspaceState(), {
      targetFloor: { productId: 'hard-maple', finishId: 'smoked', patternId: 'straight', widthId: '5' },
    });
    const incompat = selectionIncompatibilities(state);
    expect(incompat.length).toBeGreaterThan(0);
    expect(incompat.some((i) => i.axis === 'finish')).toBe(true);
  });

  it('reports nothing for a compatible, complete selection', () => {
    const state = applyPatch(defaultWorkspaceState(), {
      targetFloor: { productId: 'white-oak', finishId: 'satin', patternId: 'straight', widthId: '5' },
    });
    expect(selectionIncompatibilities(state)).toHaveLength(0);
  });
});
