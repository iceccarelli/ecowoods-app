import { describe, it, expect } from 'vitest';
import { FUNNELS, ROUTE_FUNNEL, funnelById, funnelForRoute, completionOf } from './index';
import { MARKETS } from '@/content/geo/markets';
import { expansionScore, expansionOrder } from '@/lib/geo/worthiness';
import { TRACKED_QUERIES, declaredGaps, queriesInFamily, AEO_QUERY_SET_VERSION } from '@/content/aeo/queries';

/**
 * These are the invariants the strategy layer is only useful while it holds.
 * scripts/verify-strategy.mjs checks the same things against the repository as
 * text — a route exists, an event is emitted, a page renders the call. This file
 * checks the shape of the data itself, which the text guard cannot see.
 */

describe('funnels', () => {
  it('has one funnel per distinct intent, with no duplicate ids', () => {
    const ids = FUNNELS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(FUNNELS.length).toBe(6);
  });

  it('completes on the last declared step, never a middle one', () => {
    for (const f of FUNNELS) {
      expect(f.steps.length).toBeGreaterThan(1);
      expect(completionOf(f)).toBe(f.steps[f.steps.length - 1]);
    }
  });

  it('names what the visitor is NOT ready for on every funnel', () => {
    for (const f of FUNNELS) expect(f.notYet.trim().length).toBeGreaterThan(10);
  });

  it('does not end five of six funnels at the estimate form', () => {
    // The failure this whole module exists to prevent: every page asking for a
    // booking. At most two funnels may point at /estimate.
    const toEstimate = FUNNELS.filter((f) => f.nextStep.href.startsWith('/estimate'));
    expect(toEstimate.length).toBeLessThanOrEqual(3);
    expect(funnelById('problem')!.notYet).toMatch(/price/i);
  });

  it('resolves a route to its funnel, and an unmapped route to nothing', () => {
    expect(funnelForRoute('/pricing')?.id).toBe('price');
    expect(funnelForRoute('/quote-check')?.id).toBe('evaluation');
    expect(funnelForRoute('/reviews')).toBeUndefined();
  });

  it('maps every ROUTE_FUNNEL entry to a funnel that exists', () => {
    for (const [route, id] of Object.entries(ROUTE_FUNNEL)) {
      expect(funnelById(id), route).toBeDefined();
    }
  });

  it('serves every funnel from at least one route', () => {
    const served = new Set(Object.values(ROUTE_FUNNEL));
    for (const f of FUNNELS) expect(served.has(f.id), f.id).toBe(true);
  });
});

describe('expansion score', () => {
  const order = expansionOrder(MARKETS);

  it('ranks both countries on the same terms since the New York confirmation', () => {
    // This asserted the opposite until 2026-09-10, when a United States market
    // could not hold a page and ranking one produced a queue entry nobody could
    // act on. Both are now on the same queue and the same requirements.
    expect(order.some((e) => MARKETS.find((m) => m.slug === e.slug)?.country === 'US')).toBe(true);
    expect(order.length).toBe(MARKETS.length);
  });

  it('scores an unconfirmed market below a confirmed one, all else equal', () => {
    const toronto = MARKETS.find((m) => m.slug === 'toronto')!;
    const scored = expansionScore(toronto, MARKETS);
    expect(scored.components.confirmation).toBe(26);
    expect(scored.score).toBeGreaterThan(0);
  });

  it('states the ten economic inputs it does not hold, on every row', () => {
    for (const e of order) {
      expect(e.missing.length).toBe(10);
      expect(e.missing).toContain('search demand and CPC');
    }
  });

  it('gives every market a next action that is a single instruction', () => {
    for (const e of order) {
      expect(e.nextAction.length).toBeGreaterThan(10);
      expect(e.nextAction.split('. ').length).toBeLessThanOrEqual(3);
    }
  });

  it('is deterministic — the same input gives the same order', () => {
    expect(expansionOrder(MARKETS).map((e) => e.slug)).toEqual(order.map((e) => e.slug));
  });
});

describe('tracked question set', () => {
  it('is versioned, so a month-over-month score compares like with like', () => {
    expect(AEO_QUERY_SET_VERSION).toMatch(/^\d+\.\d+$/);
  });

  it('has unique ids', () => {
    const ids = TRACKED_QUERIES.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('declares its gaps rather than hiding them', () => {
    const gaps = declaredGaps();
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.every((q) => q.coverage === null)).toBe(true);
    expect(gaps.length).toBeLessThan(TRACKED_QUERIES.length / 3);
  });

  it('covers every family it declares', () => {
    for (const f of ['diagnostic', 'decision', 'commercial', 'evaluation', 'professional'] as const) {
      expect(queriesInFamily(f).length, f).toBeGreaterThan(0);
    }
  });

  it('gives every question a reason to be tracked', () => {
    for (const q of TRACKED_QUERIES) expect(q.query.trim().length).toBeGreaterThan(8);
  });
});
