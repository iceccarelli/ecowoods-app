import { describe, it, expect } from 'vitest';
import { MARKETS, type Market } from '@/content/geo/markets';
import { opportunity, opportunityOrder, MIN_CONFIDENCE } from './opportunity';
import { INPUT_SPECS, TOTAL_WEIGHT, MARKET_INPUTS } from '@/content/geo/market-inputs';
import { allocation, CA_RECORD_FLOOR } from './allocation';

describe('the opportunity model', () => {
  it('weights ten inputs to exactly one hundred', () => {
    expect(INPUT_SPECS).toHaveLength(10);
    expect(TOTAL_WEIGHT).toBe(100);
    expect(new Set(INPUT_SPECS.map((s) => s.id)).size).toBe(10);
  });

  it('holds the brief\'s weights, not weights of its own invention', () => {
    const w = Object.fromEntries(INPUT_SPECS.map((s) => [s.id, s.weight]));
    expect(w.purchasingPower).toBe(20);
    expect(w.housingValues).toBe(15);
    expect(w.housingAge).toBe(10);
    expect(w.detachedPrevalence).toBe(10);
    expect(w.renovationPotential).toBe(10);
    expect(w.hardwoodOpportunity).toBe(10);
    expect(w.searchDemand).toBe(10);
    expect(w.competition).toBe(5);
    expect(w.logistics).toBe(5);
    expect(w.corridorValue).toBe(5);
  });

  it('withholds a score until the confidence gate is met', () => {
    // Nothing is sourced yet, so nothing may carry a score. This is the
    // assertion that fails the day somebody types a figure into the model.
    for (const o of opportunityOrder(MARKETS)) {
      if (o.confidence < MIN_CONFIDENCE) expect(o.score, o.slug).toBeNull();
    }
  });

  it('cannot classify a market on routing alone', () => {
    const computed = INPUT_SPECS.filter((s) => s.kind === 'computed').reduce((n, s) => n + s.weight, 0);
    expect(MIN_CONFIDENCE).toBeGreaterThan(computed / 100);
    for (const o of opportunityOrder(MARKETS).filter((x) => x.country === 'CA')) {
      expect(o.classification, o.slug).toBe('UNSCORED');
      expect(o.reason, o.slug).toMatch(/sourced/);
    }
  });

  it('names every missing input and where to get it', () => {
    const o = opportunity(MARKETS.find((m) => m.slug === 'oakville')!);
    expect(o.missing).toHaveLength(8);
    for (const m of o.missing) expect(m.obtainableFrom.length).toBeGreaterThan(10);
    expect(o.missing.reduce((n, m) => n + m.weight, 0)).toBe(90);
  });

  it('never classifies a United States market above FUTURE', () => {
    for (const o of opportunityOrder(MARKETS).filter((x) => x.country === 'US')) {
      expect(o.classification, o.slug).toBe('FUTURE');
      expect(o.reason, o.slug).toMatch(/Ontario/);
    }
  });

  it('scores a confirmed core market above an unconfirmed far one on what it can see', () => {
    const toronto = opportunity(MARKETS.find((m) => m.slug === 'toronto')!);
    const fortErie = opportunity(MARKETS.find((m) => m.slug === 'fort-erie')!);
    expect(toronto.partialScore!).toBeGreaterThan(fortErie.partialScore!);
  });

  it('holds no unsourced figures at all today', () => {
    expect(Object.keys(MARKET_INPUTS)).toEqual([]);
  });

  it('is deterministic', () => {
    const a = opportunityOrder(MARKETS).map((x) => x.slug);
    const b = opportunityOrder(MARKETS).map((x) => x.slug);
    expect(a).toEqual(b);
  });
});

describe('the 80/20 allocation', () => {
  const measured = allocation();
  const by = (m: string) => measured.find((x) => x.measure === m)!;

  it('reports all four measures', () => {
    expect(measured.map((m) => m.measure)).toEqual(['records', 'pages', 'depth', 'graph']);
  });

  it('keeps Canada near the eighty-percent target on the two measures that can move', () => {
    expect(by('records').caShare).toBeGreaterThanOrEqual(CA_RECORD_FLOOR);
    expect(by('records').caShare).toBeLessThan(0.95);
    expect(by('graph').caShare).toBeGreaterThanOrEqual(CA_RECORD_FLOOR);
  });

  it('is structurally 100/0 on pages and depth, and says why', () => {
    expect(by('pages').us).toBe(0);
    expect(by('depth').us).toBe(0);
    expect(by('pages').means).toMatch(/never hold/);
  });

  it('spends the American twenty percent on graph structure rather than pages', () => {
    expect(by('graph').us).toBeGreaterThan(0);
    expect(by('records').us).toBeGreaterThan(0);
  });

  it('would fail the floor if the American map outgrew the Canadian one', () => {
    // The guard reads the file; this asserts the arithmetic it relies on.
    const ca = MARKETS.filter((m: Market) => m.country === 'CA').length;
    const us = MARKETS.filter((m: Market) => m.country === 'US').length;
    expect(ca / (ca + us)).toBeGreaterThanOrEqual(CA_RECORD_FLOOR);
    expect(us / (ca + us)).toBeGreaterThan(0.1);
  });
});
