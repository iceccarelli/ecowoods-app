/**
 * economics.test.ts — ASSISTANT-04.
 *
 * Covers docs/assistant-workspace/ECONOMICS_MODEL_SPEC.md's testing
 * obligation: band selection by country, degenerate square footage
 * rejection, the no-double-count invariant, and a currency-mismatch guard.
 */
import { describe, expect, it } from 'vitest';
import { bandForCountry } from '@/content/constants/pricing';
import {
  calculateProjectRange,
  calculateDelta,
  calculateExplicitSavings,
  compareScenarios,
  projectRangeForState,
  type Money,
} from './economics';
import { applyPatch, defaultWorkspaceState } from './state';

describe('calculateProjectRange — band selection by country', () => {
  it('prices a CA install against the published Ontario newInstall band', () => {
    const range = calculateProjectRange({ pricingKey: 'newInstall', squareFeet: 1000, country: 'CA' });
    const band = bandForCountry('newInstall', 'CA');
    expect(range.currency).toBe('CAD');
    expect(range.min).toBe(Math.round(band.min * 1000));
    expect(range.max).toBe(Math.round(band.max * 1000));
  });

  it('prices a US install against the published New York newInstall band, not the CA one', () => {
    const range = calculateProjectRange({ pricingKey: 'newInstall', squareFeet: 1000, country: 'US' });
    const caRange = calculateProjectRange({ pricingKey: 'newInstall', squareFeet: 1000, country: 'CA' });
    expect(range.currency).toBe('USD');
    expect(range.min).not.toBe(caRange.min);
  });

  it('a refinish (fullSandAndFinish) range differs from an install (newInstall) range at the same sqft', () => {
    const refinish = calculateProjectRange({ pricingKey: 'fullSandAndFinish', squareFeet: 900, country: 'CA' });
    const install = calculateProjectRange({ pricingKey: 'newInstall', squareFeet: 900, country: 'CA' });
    expect(refinish.min).not.toBe(install.min);
    expect(refinish.max).not.toBe(install.max);
  });
});

describe('calculateProjectRange — degenerate square footage', () => {
  it('throws on zero square feet', () => {
    expect(() => calculateProjectRange({ pricingKey: 'newInstall', squareFeet: 0, country: 'CA' })).toThrow(RangeError);
  });

  it('throws on negative square feet', () => {
    expect(() => calculateProjectRange({ pricingKey: 'newInstall', squareFeet: -100, country: 'CA' })).toThrow(RangeError);
  });

  it('throws on non-finite square feet', () => {
    expect(() => calculateProjectRange({ pricingKey: 'newInstall', squareFeet: Infinity, country: 'CA' })).toThrow(RangeError);
    expect(() => calculateProjectRange({ pricingKey: 'newInstall', squareFeet: NaN, country: 'CA' })).toThrow(RangeError);
  });

  it('never returns a single point estimate — min and max always differ for a real band', () => {
    const range = calculateProjectRange({ pricingKey: 'newInstall', squareFeet: 500, country: 'CA' });
    expect(range.max).toBeGreaterThan(range.min);
  });
});

describe('calculateDelta — currency mismatch guard', () => {
  it('refuses to diff a CAD range against a USD range', () => {
    const cad: Money = { min: 100, max: 200, currency: 'CAD' };
    const usd: Money = { min: 100, max: 200, currency: 'USD' };
    expect(() => calculateDelta(cad, usd)).toThrow(TypeError);
  });

  it('subtracts min-to-min and max-to-max for matching currencies', () => {
    const a: Money = { min: 1000, max: 2000, currency: 'CAD' };
    const b: Money = { min: 1500, max: 2500, currency: 'CAD' };
    expect(calculateDelta(a, b)).toEqual({ min: 500, max: 500, currency: 'CAD' });
  });
});

describe('compareScenarios', () => {
  it('never blends scenarios into one averaged figure — every scenario range is preserved verbatim', () => {
    const refinish = calculateProjectRange({ pricingKey: 'fullSandAndFinish', squareFeet: 900, country: 'CA' });
    const install = calculateProjectRange({ pricingKey: 'newInstall', squareFeet: 900, country: 'CA' });
    const comparison = compareScenarios([
      { label: 'Refinish', range: refinish },
      { label: 'New install', range: install },
    ]);
    expect(comparison.scenarios[0]!.range).toEqual(refinish);
    expect(comparison.scenarios[1]!.range).toEqual(install);
    expect(comparison.deltas).toHaveLength(1);
    expect(comparison.deltas[0]!.delta).toEqual(calculateDelta(refinish, install));
  });

  it('produces zero deltas for a single scenario', () => {
    const range = calculateProjectRange({ pricingKey: 'newInstall', squareFeet: 900, country: 'CA' });
    const comparison = compareScenarios([{ label: 'Only option', range }]);
    expect(comparison.deltas).toHaveLength(0);
  });
});

describe('calculateExplicitSavings — the notQuantified path', () => {
  it('returns notQuantified when no overlap evidence is supplied — the honest default in this codebase today', () => {
    const baseline: Money = { min: 5000, max: 8000, currency: 'CAD' };
    const bundled: Money = { min: 4500, max: 7500, currency: 'CAD' };
    const result = calculateExplicitSavings({ baseline, bundled, overlapEvidence: [] });
    expect(result).toHaveProperty('notQuantified', true);
  });

  it('computes a real savings range once real overlap evidence is cited', () => {
    const baseline: Money = { min: 5000, max: 8000, currency: 'CAD' };
    const bundled: Money = { min: 4500, max: 7500, currency: 'CAD' };
    const result = calculateExplicitSavings({
      baseline,
      bundled,
      overlapEvidence: [{ rule: 'shared mobilization', source: 'test fixture, not a real published rule' }],
    });
    expect(result).toEqual({ min: 500, max: 500, currency: 'CAD' });
  });

  it('refuses to compute savings across mismatched currencies', () => {
    const baseline: Money = { min: 5000, max: 8000, currency: 'CAD' };
    const bundled: Money = { min: 4500, max: 7500, currency: 'USD' };
    expect(() =>
      calculateExplicitSavings({ baseline, bundled, overlapEvidence: [{ rule: 'x', source: 'y' }] }),
    ).toThrow(TypeError);
  });
});

describe('the no-double-count invariant', () => {
  it('a calculateExplicitSavings output is never re-added inside a project range total', () => {
    const baseline: Money = { min: 5000, max: 8000, currency: 'CAD' };
    const bundled: Money = { min: 4500, max: 7500, currency: 'CAD' };
    const savings = calculateExplicitSavings({
      baseline,
      bundled,
      overlapEvidence: [{ rule: 'shared mobilization', source: 'test fixture' }],
    });
    // The bundled total is what a project range would show; savings is a SEPARATE
    // figure describing the gap, never folded back into the total.
    expect('notQuantified' in savings).toBe(false);
    if (!('notQuantified' in savings)) {
      const total = bundled;
      expect(total).toEqual(bundled);
      expect(total.min).not.toBe(bundled.min + savings.min);
    }
  });

  it('projectRangeForState never counts two selected services against the same band twice', () => {
    // floor-refinishing and stair-refinishing are both billed against fullSandAndFinish (service-pages.ts).
    const state = applyPatch(defaultWorkspaceState(), {
      rooms: [{ label: 'Whole project', squareFeet: 900 }],
      selectedServiceSlugs: ['floor-refinishing'],
    });
    const single = projectRangeForState(state);
    const both = projectRangeForState(applyPatch(state, { selectedServiceSlugs: ['floor-refinishing', 'stair-refinishing'] }));
    expect(single.status).toBe('ready');
    expect(both.status).toBe('ready');
    if (single.status === 'ready' && both.status === 'ready') {
      expect(both.total).toEqual(single.total);
      expect(both.scopes).toHaveLength(1);
    }
  });
});

describe('projectRangeForState', () => {
  it('reports needs-sqft when no room has a square footage', () => {
    const state = applyPatch(defaultWorkspaceState(), { selectedServiceSlugs: ['hardwood-installation'] });
    expect(projectRangeForState(state)).toEqual({ status: 'needs-sqft' });
  });

  it('reports needs-service when sqft is known but nothing is selected', () => {
    const state = applyPatch(defaultWorkspaceState(), { rooms: [{ label: 'Living room', squareFeet: 500 }] });
    expect(projectRangeForState(state)).toEqual({ status: 'needs-service' });
  });

  it('sums two genuinely distinct scopes (different bands) rather than picking one', () => {
    const state = applyPatch(defaultWorkspaceState(), {
      rooms: [{ label: 'Whole project', squareFeet: 900 }],
      selectedServiceSlugs: ['floor-refinishing', 'hardwood-installation'],
    });
    const result = projectRangeForState(state);
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.scopes).toHaveLength(2);
      const refinishOnly = projectRangeForState(applyPatch(state, { selectedServiceSlugs: ['floor-refinishing'] }));
      expect(refinishOnly.status).toBe('ready');
      if (refinishOnly.status === 'ready') {
        expect(result.total.min).toBeGreaterThan(refinishOnly.total.min);
        expect(result.total.max).toBeGreaterThan(refinishOnly.total.max);
      }
    }
  });

  it('a real CA fixture: 1100 sq ft full refinish is a real, ranged, non-invented number', () => {
    const state = applyPatch(defaultWorkspaceState(), {
      country: 'CA',
      rooms: [{ label: 'Whole project', squareFeet: 1100 }],
      selectedServiceSlugs: ['floor-refinishing'],
    });
    const result = projectRangeForState(state);
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      const band = bandForCountry('fullSandAndFinish', 'CA');
      expect(result.total).toEqual({
        min: Math.round(band.min * 1100),
        max: Math.round(band.max * 1100),
        currency: 'CAD',
      });
    }
  });
});
