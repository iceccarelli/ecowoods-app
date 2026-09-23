import { describe, expect, it } from 'vitest';
import {
  executeAttachToProject,
  executeGetEcowoodsBand,
  executeGetHouseProfile,
  executeGetMarketCost,
  executeGetWantVsValue,
  executeProposeConversion,
  isFloorOrStairsTrade,
  isNonFloorTrade,
  mergePatches,
} from './chat-tools';
import { FLOOR_PRODUCTS } from '@/lib/floor-studio/catalog';
import { SERVICES } from '@/lib/seo-data';

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
