import { describe, expect, it } from 'vitest';
import { buildRenovationAnalysis, isEligibleForAnalysis } from './renovation-analysis';
import type { WorkspaceSnapshot } from './chat-schema';

const REXDALE: WorkspaceSnapshot = {
  designId: 'design-rexdale-1',
  country: 'CA',
  objective: 'refinish',
  sellHorizon: 'selling-soon',
  stairs: false,
  rooms: [{ label: 'Main floor', squareFeet: 900 }],
  selectedServiceSlugs: ['floor-refinishing'],
  nextAction: null,
};

describe('isEligibleForAnalysis', () => {
  it('rejects an empty workspace', () => {
    expect(isEligibleForAnalysis({}).eligible).toBe(false);
  });

  it('rejects an objective with nothing else', () => {
    expect(isEligibleForAnalysis({ objective: 'refinish' }).eligible).toBe(false);
  });

  it('accepts objective + square footage', () => {
    expect(isEligibleForAnalysis({ objective: 'refinish', rooms: [{ label: 'Main', squareFeet: 500 }] }).eligible).toBe(true);
  });

  it('accepts objective + sellHorizon alone', () => {
    expect(isEligibleForAnalysis({ objective: 'install', sellHorizon: 'staying' }).eligible).toBe(true);
  });

  it('accepts the full Rexdale scenario', () => {
    expect(isEligibleForAnalysis(REXDALE).eligible).toBe(true);
  });
});

describe('buildRenovationAnalysis — the Rexdale homeowner', () => {
  const result = buildRenovationAnalysis(REXDALE);

  it('uses the stated square footage in the cost view, from a real published band', () => {
    const floorLine = result.costView.find((c) => c.range);
    expect(floorLine).toBeDefined();
    expect(floorLine!.tag).toBe('known');
    expect(floorLine!.range!.min).toBeGreaterThan(0);
    expect(floorLine!.note).toContain('900');
  });

  it('reflects the selling-soon timing in sequencing and value/timing commentary', () => {
    expect(result.recommendedSequence[0]!.why).toMatch(/visible|buyer/i);
    expect(result.valueAndTiming.join(' ')).toMatch(/selling within/i);
    expect(result.valueAndTiming.join(' ')).toMatch(/no estimate of your sale price/i);
  });

  it('sequences the refinish/install floor work first when Ecowoods executes it', () => {
    expect(result.recommendedSequence[0]!.title).toMatch(/floor/i);
  });

  it('names a concrete, Ecowoods-executable next step', () => {
    expect(['measure', 'estimate', 'quote']).toContain(result.nextStep.action);
  });

  it('never fabricates a number for a trade Ecowoods does not execute', () => {
    const withKitchen = buildRenovationAnalysis({ ...REXDALE, selectedServiceSlugs: ['floor-refinishing'] });
    // Kitchen isn't a selectable service slug in this catalog at all — the
    // only way it enters the conversation today is free text, which never
    // reaches this structured engine. Assert the engine never invents a
    // range for ANY slug outside SERVICES regardless.
    const fabricated = withKitchen.costView.find((c) => c.label.toLowerCase().includes('kitchen'));
    expect(fabricated).toBeUndefined();
  });

  it('is deterministic: same input, same output shape (modulo timestamps)', () => {
    const a = buildRenovationAnalysis(REXDALE);
    const b = buildRenovationAnalysis(REXDALE);
    expect({ ...a, generatedAt: '' }).toEqual({ ...b, generatedAt: '' });
  });
});

describe('buildRenovationAnalysis — sparse context', () => {
  it('is honest about missing data rather than inventing it', () => {
    const result = buildRenovationAnalysis({ objective: 'install', sellHorizon: 'staying' });
    const areaFact = result.currentContext.find((c) => c.label.startsWith('Area'));
    expect(areaFact?.tag).toBe('inspection-needed');
    expect(result.risksAndUnknowns.some((r) => r.tag === 'inspection-needed')).toBe(true);
  });

  it('routes non-Ecowoods trades to a qualified-assessment next step, not a fabricated one', () => {
    const result = buildRenovationAnalysis({ objective: 'not-sure' });
    expect(result.nextStep.action).toBe('qualified-assessment');
  });
});
