import { describe, it, expect } from 'vitest';
import { SCOPE_ITEMS } from '@/content/quote-check/scope-items';
import { compare, perSquareFoot, isEntered, benchmarkRow, type QuoteInput } from './compare';

const q = (label: string, includes: string[], total?: number, areaSqFt?: number): QuoteInput => ({
  label,
  includes,
  total,
  areaSqFt,
});

const ALL = SCOPE_ITEMS.map((i) => i.id);

describe('the checklist itself', () => {
  it('has unique ids', () => {
    expect(new Set(ALL).size).toBe(ALL.length);
  });

  it('cites a published page for every item claiming to be published', () => {
    for (const i of SCOPE_ITEMS) {
      if (i.basis === 'published') expect(i.cite, i.id).toMatch(/^\/(guides|papers)\//);
      else expect(i.cite, i.id).toBeUndefined();
    }
  });

  it('states no price, percentage or comparative judgement anywhere', () => {
    // The guard enforces this over the file; this asserts it over the values
    // that actually reach a user's screen.
    const text = SCOPE_ITEMS.map((i) => `${i.label} ${i.why}`).join(' ');
    expect(text).not.toMatch(/\$\s?\d/);
    expect(text).not.toMatch(/\b\d+(\.\d+)?\s?%/);
    expect(text).not.toMatch(/\b(cheaper|overpriced|best|worst|inferior|superior|rip-?off|scam)\b/i);
  });
});

describe('perSquareFoot', () => {
  it('divides the two numbers the visitor entered', () => {
    expect(perSquareFoot(q('a', [], 8500, 1000))).toBe(8.5);
    expect(perSquareFoot(q('a', [], 7431, 842))).toBe(8.83);
  });

  it('is undefined rather than wrong when a number is missing or nonsensical', () => {
    expect(perSquareFoot(q('a', [], 8500))).toBeUndefined();
    expect(perSquareFoot(q('a', [], undefined, 1000))).toBeUndefined();
    expect(perSquareFoot(q('a', [], 0, 1000))).toBeUndefined();
    expect(perSquareFoot(q('a', [], 8500, 0))).toBeUndefined();
    expect(perSquareFoot(q('a', [], Number.NaN, 1000))).toBeUndefined();
    expect(perSquareFoot(q('a', [], 8500, Number.POSITIVE_INFINITY))).toBeUndefined();
  });
});

describe('isEntered', () => {
  it('needs a label and something said about the quote', () => {
    expect(isEntered(q('', ALL, 8500, 1000))).toBe(false);
    expect(isEntered(q('A', []))).toBe(false);
    expect(isEntered(q('A', ['moisture-readings']))).toBe(true);
    expect(isEntered(q('A', [], 8500))).toBe(true);
  });
});

describe('compare', () => {
  it('says nothing useful about a single quote, and says so', () => {
    const c = compare([q('A', ALL, 8500, 1000), q('B', [])]);
    expect(c.verdict).toBe('insufficient');
    expect(c.statement).toMatch(/at least two/);
  });

  it('calls identical complete scopes comparable', () => {
    const c = compare([q('A', ALL, 8500, 1000), q('B', ALL, 9200, 1000)]);
    expect(c.verdict).toBe('comparable');
    expect(c.divergent).toEqual([]);
    expect(c.absentEverywhere).toEqual([]);
    expect(c.statement).toMatch(/measuring the same job/);
  });

  it('separates "missing from this one" from "missing from all of them"', () => {
    const partial = ALL.filter((id) => id !== 'subfloor-prep' && id !== 'stairs-transitions');
    const c = compare([q('A', partial, 8500, 1000), q('B', partial, 9200, 1000)]);
    expect(c.verdict).toBe('comparable-with-gaps');
    // Neither quote is marked against the other for something neither mentions.
    expect(c.readings.every((r) => r.missing.length === 0)).toBe(true);
    expect(c.absentEverywhere.map((i) => i.id).sort()).toEqual(['stairs-transitions', 'subfloor-prep']);
  });

  it('refuses to compare totals when a scope-changing item appears in one quote only', () => {
    const withPrep = ALL;
    const without = ALL.filter((id) => id !== 'subfloor-prep');
    const c = compare([q('A', withPrep, 9500, 1000), q('B', without, 7900, 1000)]);
    expect(c.verdict).toBe('not-comparable');
    expect(c.divergent.map((i) => i.id)).toEqual(['subfloor-prep']);
    expect(c.readings[1].missingScope.map((i) => i.id)).toEqual(['subfloor-prep']);
    expect(c.statement).toMatch(/not a price difference/);
  });

  it('does not call quotes incomparable over an item that changes certainty, not scope', () => {
    const warranty = SCOPE_ITEMS.find((i) => i.id === 'warranty-in-contract');
    expect(warranty?.changesScope).toBe(false);
    const without = ALL.filter((id) => id !== 'warranty-in-contract');
    const c = compare([q('A', ALL, 8500, 1000), q('B', without, 8400, 1000)]);
    expect(c.verdict).toBe('comparable');
    expect(c.readings[1].missing.map((i) => i.id)).toEqual(['warranty-in-contract']);
    expect(c.readings[1].missingScope).toEqual([]);
  });

  it('reports the per-square-foot spread using only the visitor’s own numbers', () => {
    const c = compare([q('A', ALL, 8500, 1000), q('B', ALL, 6200, 1000)]);
    // These are the quotient of two invented test inputs, not a price this
    // business publishes. The assertions exist precisely to prove the tool
    // echoes the visitor's own arithmetic and never substitutes ours.
    expect(c.statement).toContain('$6.20'); // pricing-allow: test fixture, not a published band
    expect(c.statement).toContain('$8.50'); // pricing-allow: test fixture, not a published band
  });

  it('never prices a missing item, in any code path', () => {
    const cases = [
      compare([q('A', ALL, 9500, 1000), q('B', ALL.filter((i) => i !== 'subfloor-prep'), 7900, 1000)]),
      compare([q('A', [], 9500, 1000), q('B', [], 7900, 1000)]),
      compare([q('A', ALL, 9500, 1000), q('B', ALL, 9500, 1000)]),
    ];
    for (const c of cases) {
      // The only dollar figures anywhere are the ones the visitor typed.
      const dollars = [...c.statement.matchAll(/\$([\d.]+)/g)].map((m) => m[1]);
      for (const d of dollars) expect(['9.50', '7.90', '6.20', '8.50']).toContain(d);
    }
  });

  it('ignores checklist ids it does not recognise', () => {
    const c = compare([q('A', ['moisture-readings', 'not-a-real-item'], 1, 1), q('B', ['moisture-readings'], 1, 1)]);
    expect(c.union).toEqual(['moisture-readings']);
    expect(c.verdict).not.toBe('not-comparable');
  });
});

describe('benchmarkRow', () => {
  it('carries no label, no total, no area', () => {
    const row = benchmarkRow([q('Company A', ['moisture-readings'], 8500, 1000), q('B', ['subfloor-prep'], 9200, 1000)]);
    expect(row).toEqual({ quoteCount: 2, includedIds: [['moisture-readings'], ['subfloor-prep']] });
    expect(JSON.stringify(row)).not.toMatch(/Company A|8500|1000/);
  });

  it('drops ids that are not in the checklist', () => {
    const row = benchmarkRow([q('A', ['moisture-readings', 'injected'], 1, 1)]);
    expect(row.includedIds).toEqual([['moisture-readings']]);
  });
});
