/**
 * state.test.ts — ASSISTANT-02.
 *
 * The test that matters: a state serialized and hydrated back comes out
 * carrying the SAME designId, and nothing in this module accepts a second,
 * competing state shape (an unrecognized field is dropped, not carried
 * through; an invalid catalog id never survives a round trip).
 */
import { describe, expect, it } from 'vitest';
import { newDesignId } from '@/lib/floor-studio/design-id';
import { FLOOR_PRODUCTS } from '@/lib/floor-studio/catalog';
import { FINISH_OPTIONS, PATTERN_OPTIONS } from '@ecowoods/shared/ai';
import { applyPatch, defaultWorkspaceState, hydrateWorkspaceState, totalSquareFeet, describeFloorPreference, computedNeedsMeasure } from './state';
import { parseWorkspaceState, serializeWorkspaceState } from './persistence';
import type { WorkspaceState } from './types';

describe('serialize → hydrate round trip', () => {
  it('keeps the same designId', () => {
    const id = newDesignId();
    const state: WorkspaceState = { ...defaultWorkspaceState(), designId: id };
    const raw = serializeWorkspaceState(state);
    const hydrated = parseWorkspaceState(raw, Date.parse(state.updatedAt) + 1000);
    expect(hydrated).not.toBeNull();
    expect(hydrated!.designId).toBe(id);
  });

  it('rejects a state with no valid designId rather than minting one', () => {
    const state = { ...defaultWorkspaceState(), designId: 'not-a-real-id' };
    const raw = JSON.stringify(state);
    expect(parseWorkspaceState(raw)).toBeNull();
  });

  it('rejects state older than the retention window', () => {
    const id = newDesignId();
    const state: WorkspaceState = { ...defaultWorkspaceState(), designId: id, updatedAt: '2000-01-01T00:00:00.000Z' };
    const raw = serializeWorkspaceState(state);
    expect(parseWorkspaceState(raw, Date.parse('2026-01-01T00:00:00.000Z'))).toBeNull();
  });

  it('drops a field this version does not recognize, rather than carrying a second shape through', () => {
    const id = newDesignId();
    const now = new Date().toISOString();
    const raw = JSON.stringify({
      ...defaultWorkspaceState(() => now),
      designId: id,
      // A field from some hypothetical future or forked shape.
      priceEstimateCad: 12345,
      objective: 'refinish',
    });
    const hydrated = parseWorkspaceState(raw);
    expect(hydrated).not.toBeNull();
    expect((hydrated as unknown as Record<string, unknown>).priceEstimateCad).toBeUndefined();
    expect(hydrated!.objective).toBe('refinish');
  });

  it('rebuilds a catalog id only when it resolves against the live catalog', () => {
    const validProduct = FLOOR_PRODUCTS[0]!.id;
    const state = hydrateWorkspaceState(
      { targetFloor: { productId: validProduct, finishId: 'not-a-real-finish' } },
      newDesignId(),
      new Date().toISOString(),
    );
    expect(state.targetFloor.productId).toBe(validProduct);
    expect(state.targetFloor.finishId).toBeUndefined();
  });
});

describe('applyPatch', () => {
  it('never mutates the input state', () => {
    const state = defaultWorkspaceState();
    const frozen = JSON.stringify(state);
    applyPatch(state, { objective: 'install' });
    expect(JSON.stringify(state)).toBe(frozen);
  });

  it('merges targetFloor field by field, not by replacement', () => {
    const state = applyPatch(defaultWorkspaceState(), { targetFloor: { productId: FLOOR_PRODUCTS[0]!.id } });
    const next = applyPatch(state, { targetFloor: { finishId: FINISH_OPTIONS[0]!.id } });
    expect(next.targetFloor.productId).toBe(FLOOR_PRODUCTS[0]!.id);
    expect(next.targetFloor.finishId).toBe(FINISH_OPTIONS[0]!.id);
  });

  it('drops an invalid catalog id from a patch silently rather than storing it', () => {
    const next = applyPatch(defaultWorkspaceState(), { targetFloor: { patternId: 'not-a-real-pattern' } });
    expect(next.targetFloor.patternId).toBeUndefined();
  });
});

describe('derived selectors', () => {
  it('totalSquareFeet sums only rooms that have one', () => {
    const state = applyPatch(defaultWorkspaceState(), {
      rooms: [{ label: 'Living room', squareFeet: 300 }, { label: 'Hallway' }, { label: 'Kitchen', squareFeet: 150 }],
    });
    expect(totalSquareFeet(state)).toBe(450);
  });

  it('totalSquareFeet is undefined when no room has one', () => {
    const state = applyPatch(defaultWorkspaceState(), { rooms: [{ label: 'Living room' }] });
    expect(totalSquareFeet(state)).toBeUndefined();
  });

  it('describeFloorPreference names only the axes that are set', () => {
    const state = applyPatch(defaultWorkspaceState(), {
      targetFloor: { productId: FLOOR_PRODUCTS[0]!.id, patternId: PATTERN_OPTIONS[0]!.id },
    });
    const described = describeFloorPreference(state.targetFloor);
    expect(described).toContain(FLOOR_PRODUCTS[0]!.name);
    expect(described).toContain(PATTERN_OPTIONS[0]!.label);
  });

  it('computedNeedsMeasure asks for square footage before anything else is known', () => {
    expect(computedNeedsMeasure(defaultWorkspaceState())).toContain('Square footage');
  });
});
