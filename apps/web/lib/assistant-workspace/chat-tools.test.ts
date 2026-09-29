import { describe, expect, it } from 'vitest';
import {
  buildProjectSnapshotBlock,
  executeAttachToProject,
  executeFlagRisk,
  executeGetEcowoodsBand,
  executeGetHouseProfile,
  executeGetMarketCost,
  executeGetWantVsValue,
  executeProposeConversion,
  executeProposeDecisionSummary,
  executeProposeSequence,
  executeRetrieveEvidence,
  executeSuggestNextAction,
  isFloorOrStairsTrade,
  isNonFloorTrade,
  mergePatches,
} from './chat-tools';
import { FLOOR_PRODUCTS } from '@/lib/floor-studio/catalog';
import { SERVICES } from '@/lib/seo-data';
import type { CaseStudyEvidence } from './value-scenario';

describe('chat-tools trade classifiers', () => {
  it('flags non-floor trades', () => {
    expect(isNonFloorTrade('kitchen')).toBe(true);
    expect(isNonFloorTrade('Roof replacement')).toBe(true);
    expect(isNonFloorTrade('hardwood refinish')).toBe(false);
  });

  it('recognises floor/stairs trades', () => {
    expect(isFloorOrStairsTrade('hardwood install')).toBe(true);
    expect(isFloorOrStairsTrade('stair refinishing')).toBe(true);
    expect(isFloorOrStairsTrade('kitchen remodel')).toBe(false);
  });
});

describe('executeGetEcowoodsBand', () => {
  it('returns a CAD range from published bands', () => {
    const out = executeGetEcowoodsBand({ species: 'white oak', squareFeet: 800 });
    expect(out.ok).toBe(true);
    expect(out.estimatedLowCad).toBeGreaterThan(0);
    expect(out.estimatedHighCad).toBeGreaterThanOrEqual(out.estimatedLowCad);
    expect(out.currency).toBe('CAD');
    expect(out.card.type).toBe('ecowoods_band');
    expect(out.provider.status).toBe('ok');
  });

  it('also carries the structured cost fields alongside the original prose body', () => {
    const out = executeGetEcowoodsBand({ species: 'white oak', squareFeet: 800 });
    expect(out.card.type).toBe('ecowoods_band');
    if (out.card.type !== 'ecowoods_band') throw new Error('unreachable');
    expect(out.card.minCad).toBe(out.estimatedLowCad);
    expect(out.card.maxCad).toBe(out.estimatedHighCad);
    expect(out.card.currency).toBe('CAD');
    expect(out.card.source).toBe('published_band');
    expect(typeof out.card.body).toBe('string');
  });
});

describe('buildProjectSnapshotBlock', () => {
  it('returns null for an empty/undefined workspace — no card for nothing to show', () => {
    expect(buildProjectSnapshotBlock(undefined)).toBeNull();
    expect(buildProjectSnapshotBlock({})).toBeNull();
  });

  it('summarizes objective, sell horizon, area, stairs and services from a real snapshot', () => {
    const card = buildProjectSnapshotBlock({
      objective: 'refinish',
      sellHorizon: 'selling-soon',
      stairs: true,
      rooms: [{ label: 'Living room', squareFeet: 400 }, { label: 'Hallway', squareFeet: 100 }],
      selectedServiceSlugs: [SERVICES[0]!.slug],
    });
    expect(card?.type).toBe('project_snapshot');
    if (card?.type !== 'project_snapshot') throw new Error('unreachable');
    expect(card.objective).toBe('refinish');
    expect(card.sellHorizon).toBe('selling-soon');
    expect(card.squareFeet).toBe(500);
    expect(card.stairs).toBe(true);
    expect(card.selectedServices).toEqual([SERVICES[0]!.name]);
  });

  it('drops an unknown service slug rather than inventing a name for it', () => {
    const card = buildProjectSnapshotBlock({ objective: 'install', selectedServiceSlugs: ['not-a-real-service'] });
    expect(card?.type).toBe('project_snapshot');
    if (card?.type !== 'project_snapshot') throw new Error('unreachable');
    expect(card.selectedServices).toBeUndefined();
  });
});

describe('executeRetrieveEvidence', () => {
  const emptyPool: CaseStudyEvidence[] = [];

  it('returns found: 0 and no cards for a topic with no matching source', () => {
    const out = executeRetrieveEvidence('qqxxzzz999nonexistentqq', emptyPool);
    expect(out.found).toBe(0);
    expect(out.cards).toEqual([]);
  });

  it('returns evidence cards with a real canonical href for a topic guides actually cover', () => {
    const out = executeRetrieveEvidence('refinish', emptyPool);
    expect(out.found).toBeGreaterThan(0);
    for (const card of out.cards) {
      expect(card.type).toBe('evidence');
      if (card.type !== 'evidence') continue;
      expect(card.href).toMatch(/^https:\/\/ecowoods\.ca\//);
      expect(['strong', 'moderate', 'weak']).toContain(card.strength);
    }
  });
});

describe('executeProposeDecisionSummary / executeProposeSequence / executeFlagRisk / executeSuggestNextAction', () => {
  it('propose_decision_summary packages the model-supplied content into a typed card unchanged in shape', () => {
    const out = executeProposeDecisionSummary({
      situation: 'A 2,000 sq ft home with floors, a dated kitchen and an aging roof.',
      whatMatters: ['Selling in 9 months', 'Floors are the fastest win'],
      firstStep: 'Get a free in-home measure for the floors.',
    });
    expect(out.card.type).toBe('decision_summary');
    if (out.card.type !== 'decision_summary') throw new Error('unreachable');
    expect(out.card.whatMatters).toHaveLength(2);
  });

  it('propose_sequence caps steps at 6', () => {
    const steps = Array.from({ length: 10 }, (_, i) => ({ label: `Step ${i}` }));
    const out = executeProposeSequence({ steps });
    expect(out.card.type).toBe('sequence');
    if (out.card.type !== 'sequence') throw new Error('unreachable');
    expect(out.card.steps).toHaveLength(6);
  });

  it('flag_risk carries issue/impact/unknown/resolvedBy through', () => {
    const out = executeFlagRisk({
      issue: 'Subfloor condition not yet inspected',
      impact: 'Could change install cost',
      unknown: 'Moisture reading',
      resolvedBy: 'Free in-home measure',
    });
    expect(out.card.type).toBe('risk');
    if (out.card.type !== 'risk') throw new Error('unreachable');
    expect(out.card.unknown).toBe('Moisture reading');
    expect(out.card.resolvedBy).toBe('Free in-home measure');
  });

  it('suggest_next_action falls back to measure for an unrecognized action rather than throwing', () => {
    const out = executeSuggestNextAction({ action: 'not-a-real-action', body: 'x' });
    expect(out.card.type).toBe('next_action');
    if (out.card.type !== 'next_action') throw new Error('unreachable');
    expect(out.card.action).toBe('measure');
  });

  it('suggest_next_action routes floor_studio to a real /floor-studio href', () => {
    const out = executeSuggestNextAction({ action: 'floor_studio', body: 'See it in your room.' });
    if (out.card.type !== 'next_action') throw new Error('unreachable');
    expect(out.card.href).toBe('https://ecowoods.ca/floor-studio');
  });

  it('suggest_next_action never invents a destination for an external trade followup', () => {
    const out = executeSuggestNextAction({ action: 'external_trade_followup', body: 'This is a job for a roofer.' });
    if (out.card.type !== 'next_action') throw new Error('unreachable');
    expect(out.card.href).toBeUndefined();
  });
});

describe('executeAttachToProject', () => {
  it('accepts catalog ids and drops unknown ones', () => {
    const product = FLOOR_PRODUCTS[0]!;
    const service = SERVICES[0]!;
    const out = executeAttachToProject({
      objective: 'install',
      productId: product.id,
      serviceSlugs: [service.slug, 'not-a-real-service'],
      squareFeet: 900,
    });
    expect(out.patch.objective).toBe('install');
    expect(out.patch.targetFloor?.productId).toBe(product.id);
    expect(out.patch.selectedServiceSlugs).toEqual([service.slug]);
    expect(out.patch.rooms?.[0]?.squareFeet).toBe(900);
    expect(out.understood.length).toBeGreaterThan(0);
  });

  it('rejects invented product ids', () => {
    const out = executeAttachToProject({ productId: 'totally-fake-sku' });
    expect(out.patch.targetFloor).toBeUndefined();
  });
});

describe('pending providers', () => {
  it('get_house_profile returns pending_key without inventing a profile', () => {
    const out = executeGetHouseProfile({ neighbourhood: 'Leslieville' });
    expect(out.status).toBe('pending_key');
    expect(out.profile).toBeNull();
    expect(out.note.toLowerCase()).toContain('pending_key');
  });

  it('get_market_cost is pending for kitchen and redirects floors', () => {
    const kitchen = executeGetMarketCost({ trade: 'kitchen' });
    expect(kitchen.status).toBe('pending_key');
    expect(kitchen.amount).toBeNull();

    const floor = executeGetMarketCost({ trade: 'hardwood refinish' });
    expect(floor.status).toBe('use_ecowoods_band');
  });

  it('get_want_vs_value is pending and not quantified', () => {
    const out = executeGetWantVsValue({ wants: ['new kitchen'] });
    expect(out.status).toBe('pending_key');
    expect(out.quantified).toBe(false);
  });
});

describe('executeProposeConversion', () => {
  it('sets nextAction without claiming a booking', () => {
    const out = executeProposeConversion({ action: 'measure', reason: 'ready for measure' });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.patch.nextAction).toBe('measure');
      expect(out.note).toMatch(/does not write/i);
      expect(out.card?.type).toBe('conversion_proposed');
    }
  });

  it('rejects unknown actions', () => {
    const out = executeProposeConversion({ action: 'helicopter' });
    expect(out.ok).toBe(false);
  });
});

describe('mergePatches', () => {
  it('merges floor prefs and lets later scalars win', () => {
    const merged = mergePatches([
      { objective: 'install', targetFloor: { productId: 'a' } },
      { objective: 'refinish', targetFloor: { finishId: 'satin' }, nextAction: 'measure' },
    ]);
    expect(merged.objective).toBe('refinish');
    expect(merged.targetFloor).toEqual({ productId: 'a', finishId: 'satin' });
    expect(merged.nextAction).toBe('measure');
  });
});
