import { describe, it, expect } from 'vitest';
import { MARKETS, type Market } from '@/content/geo/markets';
import { opportunity, opportunityOrder, MIN_CONFIDENCE, evidenceFactor } from './opportunity';
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
      // Whatever is sourced, a market under the gate is UNSCORED and says why.
      if (o.confidence < MIN_CONFIDENCE) {
        expect(o.classification, o.slug).toBe('UNSCORED');
        expect(o.reason, o.slug).toMatch(/sourced/);
      } else {
        expect(o.classification, o.slug).not.toBe('UNSCORED');
      }
    }
  });

  it('names every missing input and where to get it', () => {
    const o = opportunity(MARKETS.find((m) => m.slug === 'oakville')!);
    // Canada has income, dwelling value and detached prevalence from the 2021
    // census tables. Housing age (no subdivision-level table), the hardwood
    // proxy built on it, renovation permits, search demand and competition
    // are not sourced.
    expect(o.missing.map((m) => m.id).sort()).toEqual(
      ['competition', 'hardwoodOpportunity', 'housingAge', 'renovationPotential', 'searchDemand'],
    );
    for (const m of o.missing) expect(m.obtainableFrom.length).toBeGreaterThan(10);
    expect(o.missing.reduce((n, m) => n + m.weight, 0)).toBe(45);
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

  it('holds only cited, labelled census figures', () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const [slug, inputs] of Object.entries(MARKET_INPUTS)) {
      for (const [id, v] of Object.entries(inputs)) {
        const at = `${slug}.${id}`;
        expect(v!.source.url, at).toMatch(/^https:\/\//);
        expect(v!.source.title.length, at).toBeGreaterThan(10);
        expect(v!.source.retrievedAt, at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(v!.source.retrievedAt <= today, at).toBe(true);
        expect(v!.score, at).toBeGreaterThanOrEqual(0);
        expect(v!.score, at).toBeLessThanOrEqual(100);
        expect(v!.geography?.kind, at).toMatch(/^(direct|parent)$/);
        if (id === 'hardwoodOpportunity') expect(v!.basis, at).toBe('proxy');
      }
    }
  });

  it('keeps Canadian and United States figures in their own currency and cohort', () => {
    for (const m of MARKETS) {
      const pp = MARKET_INPUTS[m.slug]?.purchasingPower;
      if (!pp) continue;
      expect(pp.raw?.unit, m.slug).toBe(m.country === 'CA' ? 'CAD' : 'USD');
    }
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

describe('confidence reflects the weight the evidence earns', () => {
  const src = { title: 'T', url: 'https://example.org/t', retrievedAt: '2026-10-20' };
  const direct = { kind: 'direct' as const, system: 'statcan-csd', id: '3520005', name: 'Toronto' };
  const original: Record<string, unknown> = {};
  const put = (slug: string, v: Record<string, unknown>) => {
    if (!(slug in original)) original[slug] = (MARKET_INPUTS as Record<string, unknown>)[slug];
    (MARKET_INPUTS as Record<string, unknown>)[slug] = v;
  };
  const restore = (slug: string) => {
    if (original[slug] === undefined) delete (MARKET_INPUTS as Record<string, unknown>)[slug];
    else (MARKET_INPUTS as Record<string, unknown>)[slug] = original[slug];
    delete original[slug];
  };
  const toronto = MARKETS.find((m) => m.slug === 'toronto')!;

  it('halves a proxy, halves a parent geography, and quarters both', () => {
    expect(evidenceFactor({ basis: 'measured', geography: { kind: 'direct' } })).toBe(1);
    expect(evidenceFactor({ basis: 'proxy', geography: { kind: 'direct' } })).toBe(0.5);
    expect(evidenceFactor({ basis: 'measured', geography: { kind: 'parent' } })).toBe(0.5);
    expect(evidenceFactor({ basis: 'proxy', geography: { kind: 'parent' } })).toBe(0.25);
  });

  it('scores a market with four measured inputs and a proxy at 70% and labels each component', () => {
    const v = (score: number, basis: 'measured' | 'proxy' = 'measured', geography = direct) => ({ score, note: 'n', source: src, basis, geography });
    put('toronto', {
      purchasingPower: v(80), housingValues: v(80), housingAge: v(80), detachedPrevalence: v(80), hardwoodOpportunity: v(80, 'proxy'),
    });
    try {
      const o = opportunity(toronto);
      // 20+15+10+10 + 10×0.5 + 5 + 5 (computed) = 70 of 100
      expect(o.confidence).toBe(0.7);
      expect(o.score).not.toBeNull();
      expect(o.components.find((c) => c.id === 'hardwoodOpportunity')).toMatchObject({ basis: 'proxy', effectiveWeight: 5 });
      expect(o.components.find((c) => c.id === 'searchDemand')).toMatchObject({ basis: 'unavailable', score: null });
    } finally {
      restore('toronto');
    }
  });

  it('keeps a district on parent figures below the gate, however high the parent scores', () => {
    const district = MARKETS.find((m) => m.kind === 'district' && m.partOf === 'toronto')!;
    const parent = { ...direct, kind: 'parent' as const, parentSlug: 'toronto' };
    const v = (score: number, basis: 'measured' | 'proxy' = 'measured') => ({ score, note: 'n', source: src, basis, geography: parent });
    put(district.slug, {
      purchasingPower: v(99), housingValues: v(99), housingAge: v(99), detachedPrevalence: v(99), hardwoodOpportunity: v(99, 'proxy'),
    });
    try {
      const o = opportunity(district);
      expect(o.confidence).toBeLessThan(MIN_CONFIDENCE);
      expect(o.score).toBeNull();
      expect(o.classification).toBe('UNSCORED');
    } finally {
      restore(district.slug);
    }
  });
});
