/**
 * earned-catalog.test.ts — the regression that matters: a turn that did not
 * touch a floor-relevant field must never earn a catalogue, even when an
 * earlier turn already set state.objective. This is the exact "roof vs
 * kitchen vs floors" scenario the generic-catalogue bug produced.
 */
import { describe, expect, it } from 'vitest';
import { defaultWorkspaceState, applyPatch } from './state';
import { computeEarnedCatalog, isFloorRelevantPatch } from './earned-catalog';

describe('isFloorRelevantPatch', () => {
  it('is false for an empty patch', () => {
    expect(isFloorRelevantPatch({})).toBe(false);
  });

  it('is false for a patch that only sets sellHorizon or nextAction', () => {
    expect(isFloorRelevantPatch({ sellHorizon: 'selling-soon' })).toBe(false);
    expect(isFloorRelevantPatch({ nextAction: 'measure' })).toBe(false);
  });

  it('is true when the patch sets objective, targetFloor, selectedServiceSlugs, or stairs', () => {
    expect(isFloorRelevantPatch({ objective: 'refinish' })).toBe(true);
    expect(isFloorRelevantPatch({ targetFloor: { productId: 'white-oak' } })).toBe(true);
    expect(isFloorRelevantPatch({ selectedServiceSlugs: ['dust-free-sanding'] })).toBe(true);
    expect(isFloorRelevantPatch({ stairs: true })).toBe(true);
  });
});

describe('computeEarnedCatalog', () => {
  it('returns undefined for an unrelated turn even when state.objective is already set', () => {
    // Prior turn: "my oak floor is scratched" already set objective='refinish'.
    const state = applyPatch(defaultWorkspaceState(), { objective: 'refinish' });
    // This turn: "kitchen vs roof vs floors — what should I do first?" — attach_to_project
    // had nothing floor-relevant to add (sellHorizon only).
    const thisTurnPatch = { sellHorizon: 'selling-soon' as const };
    expect(computeEarnedCatalog(state, thisTurnPatch)).toBeUndefined();
  });

  it('returns undefined for a completely empty turn patch', () => {
    const state = applyPatch(defaultWorkspaceState(), { objective: 'refinish' });
    expect(computeEarnedCatalog(state, {})).toBeUndefined();
  });

  it('returns a catalogue when this turn sets objective for the first time', () => {
    const state = defaultWorkspaceState();
    const thisTurnPatch = { objective: 'refinish' as const };
    const catalog = computeEarnedCatalog(state, thisTurnPatch);
    expect(catalog).toBeDefined();
    expect(catalog!.products.length + catalog!.services.length).toBeGreaterThan(0);
  });

  it('returns a catalogue when this turn sets a floor preference, using the projected (post-patch) state', () => {
    const state = applyPatch(defaultWorkspaceState(), { objective: 'install' });
    const thisTurnPatch = { targetFloor: { productId: 'white-oak' as const } };
    const catalog = computeEarnedCatalog(state, thisTurnPatch);
    expect(catalog).toBeDefined();
    expect(catalog!.products.some((p) => p.product.id === 'white-oak' && p.selected)).toBe(true);
  });

  it('caps combined products + services at the total limit', () => {
    const state = defaultWorkspaceState();
    const catalog = computeEarnedCatalog(state, { objective: 'refinish' }, { products: 2, total: 3 });
    expect(catalog).toBeDefined();
    expect(catalog!.products.length).toBeLessThanOrEqual(2);
    expect(catalog!.products.length + catalog!.services.length).toBeLessThanOrEqual(3);
  });

  it('returns undefined when the resulting state still has no objective', () => {
    // A patch that names stairs but never establishes an objective.
    const state = defaultWorkspaceState();
    expect(computeEarnedCatalog(state, { stairs: true })).toBeUndefined();
  });
});
