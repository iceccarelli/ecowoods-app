import { describe, it, expect } from 'vitest';
import { MARKETS, type Market } from '@/content/geo/markets';
import { opportunity, opportunityOrder, MIN_CONFIDENCE } from './opportunity';
import { INPUT_SPECS, TOTAL_WEIGHT, MARKET_INPUTS } from '@/content/geo/market-inputs';
import { allocation, meanDepth, MIN_MEAN_DEPTH } from './allocation';

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
    for (const o of opportunityOrder(MARKETS)) {
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

  it('holds United States markets to the same confidence gate as Canadian ones', () => {
    // The cap at FUTURE was retired with the New York confirmation. What
    // replaced it is nothing: both countries are unscored until the census
    // inputs are sourced, which is the honest position for both.
    for (const o of opportunityOrder(MARKETS).filter((x) => x.country === 'US')) {
      expect(o.classification, o.slug).toBe('UNSCORED');
      expect(o.score, o.slug).toBeNull();
      expect(o.missing.length, o.slug).toBe(8);
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

  it('keeps Canada the centre of gravity without rationing New York', () => {
    expect(by('records').caShare).toBeGreaterThan(0.6);
    expect(by('records').caShare).toBeLessThan(0.95);
  });

  it('publishes pages and depth in both countries', () => {
    expect(by('pages').us).toBeGreaterThan(0);
    expect(by('depth').us).toBeGreaterThan(0);
  });

  it('publishes in both countries and carries graph structure in both', () => {
    expect(by('graph').us).toBeGreaterThan(0);
    expect(by('records').us).toBeGreaterThan(0);
    expect(by('pages').ca).toBeGreaterThan(by('pages').us);
  });

  it('keeps every published page above the local-content floor, in both countries', () => {
    const mean = meanDepth();
    expect(mean.ca).toBeGreaterThanOrEqual(MIN_MEAN_DEPTH);
    expect(mean.us).toBeGreaterThanOrEqual(MIN_MEAN_DEPTH);
  });
});
