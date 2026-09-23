import { describe, expect, it } from 'vitest';
import { computeRenovationSequence } from './renovation-analysis';
import { defaultWorkspaceState } from './state';
import type { WorkspaceState } from './types';

function stateWith(overrides: Partial<WorkspaceState>): WorkspaceState {
  return { ...defaultWorkspaceState(() => '2026-01-01T00:00:00.000Z'), ...overrides };
}

describe('computeRenovationSequence', () => {
  it('returns null with fewer than two known projects', () => {
    expect(computeRenovationSequence(defaultWorkspaceState())).toBeNull();
    expect(
      computeRenovationSequence(stateWith({ objective: 'refinish', personalization: { otherTrades: {} } })),
    ).toBeNull();
  });

  it('sequences envelope work (roof) before floors regardless of sell horizon', () => {
    const result = computeRenovationSequence(
      stateWith({
        objective: 'refinish',
        personalization: { otherTrades: { roof: 'mentioned' } },
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.items[0]!.key).toBe('roof');
    expect(result!.items.map((i) => i.key)).toContain('floor');
  });

  it('prioritizes floors ahead of a non-envelope trade (kitchen) when selling soon', () => {
    const result = computeRenovationSequence(
      stateWith({
        objective: 'refinish',
        sellHorizon: 'selling-soon',
        personalization: { otherTrades: { kitchen: 'mentioned' } },
      }),
    );
    expect(result).not.toBeNull();
    const keys = result!.items.map((i) => i.key);
    expect(keys.indexOf('floor')).toBeLessThan(keys.indexOf('kitchen'));
  });

  it('is deep-analysis-eligible only once enough independent signals are known', () => {
    const thin = computeRenovationSequence(
      stateWith({ objective: 'refinish', personalization: { otherTrades: { kitchen: 'mentioned' } } }),
    );
    expect(thin!.deepAnalysisEligible).toBe(false);

    const rich = computeRenovationSequence(
      stateWith({
        objective: 'refinish',
        sellHorizon: 'selling-soon',
        rooms: [{ label: 'Whole project', squareFeet: 900 }],
        personalization: { otherTrades: { roof: 'mentioned', kitchen: 'mentioned' }, floorCondition: 'scratched and dull' },
      }),
    );
    expect(rich!.deepAnalysisEligible).toBe(true);
  });

  it('never invents a dollar figure in any reason or summary', () => {
    const result = computeRenovationSequence(
      stateWith({
        objective: 'refinish',
        personalization: { otherTrades: { roof: 'mentioned', kitchen: 'mentioned' } },
      }),
    );
    const text = JSON.stringify(result);
    expect(text).not.toMatch(/\$\d/);
  });
});
