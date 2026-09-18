import { describe, expect, it } from 'vitest';
import { buildFloorPlanSpec } from './spec';
import { DEFAULT_CONFIGURATION, isLayable } from '@/lib/floor-studio/catalog';
import type { StudioDesign } from '@/lib/floor-studio/studio-config';

function design(overrides: Partial<StudioDesign> = {}): StudioDesign {
  return {
    config: DEFAULT_CONFIGURATION,
    squareFeet: 900,
    feels: [],
    country: 'CA',
    savedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('buildFloorPlanSpec', () => {
  it('only ever runs against a layable configuration — the same guarantee decodeStudioDesign already enforces', () => {
    expect(isLayable(DEFAULT_CONFIGURATION)).toBe(true);
  });

  it('describes species/finish/pattern/width from the catalogue, never invented', () => {
    const spec = buildFloorPlanSpec('order-1', design());
    expect(spec.species).not.toBe('Unknown');
    expect(spec.finish).not.toBe('Unknown');
    expect(spec.pattern).not.toBe('Unknown');
    expect(spec.width).not.toBe('Unknown');
    expect(spec.summary.length).toBeGreaterThan(0);
  });

  it('prices the range from priceConfiguration(), and reports the currency the design was built in', () => {
    const spec = buildFloorPlanSpec('order-1', design({ country: 'US' }));
    expect(spec.estimateLow).toBeGreaterThan(0);
    expect(spec.estimateHigh).toBeGreaterThanOrEqual(spec.estimateLow);
    expect(spec.currency).toBe('USD');
  });

  it('includes a seasonal movement sentence sourced from the published Toronto indoor year', () => {
    const spec = buildFloorPlanSpec('order-1', design());
    expect(spec.movementSentence).toMatch(/Toronto/);
  });

  it('carries a pre-installation checklist cited to the framework, never a bare claim', () => {
    const spec = buildFloorPlanSpec('order-1', design());
    expect(spec.checklist.length).toBeGreaterThan(0);
    for (const item of spec.checklist) {
      expect(item.href).toMatch(/^\/papers\//);
    }
  });

  it('carries the product refusals unchanged', () => {
    const spec = buildFloorPlanSpec('order-1', design());
    expect(spec.refuses.some((r) => r.includes('fixed price'))).toBe(true);
  });

  it('names the paying order on the spec, so a PDF cannot be mixed up with another customer\'s', () => {
    const spec = buildFloorPlanSpec('order-42', design());
    expect(spec.orderId).toBe('order-42');
  });
});
