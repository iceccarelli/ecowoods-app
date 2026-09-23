import { describe, expect, it } from 'vitest';
import {
  executeAnalyzeRenovationPriorities,
  executeAttachToProject,
  executeGetEcowoodsBand,
  executeGetHouseProfile,
  executeGetMarketCost,
  executeGetWantVsValue,
  executeProposeConversion,
  filterDismissedCards,
  isFloorOrStairsTrade,
  isNonFloorTrade,
  mergePatches,
} from './chat-tools';
import { applyPatch, defaultWorkspaceState } from './state';
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

  it('stores neighbourhood and floor condition verbatim, so the workspace never has to ask again', () => {
    const out = executeAttachToProject({ neighbourhood: 'Rexdale', floorCondition: 'scratched and dull' });
    expect(out.patch.personalization?.neighbourhood).toBe('Rexdale');
    expect(out.patch.personalization?.floorCondition).toBe('scratched and dull');
    expect(out.understood.some((u) => u.includes('Rexdale'))).toBe(true);
  });

  it('records a mentioned non-floor trade, and drops one Ecowoods does not track', () => {
    const known = executeAttachToProject({ trade: 'roof', tradeStatus: 'mentioned' });
    expect(known.patch.personalization?.otherTrades).toEqual({ roof: 'mentioned' });

    const unknownTrade = executeAttachToProject({ trade: 'hardwood refinish', tradeStatus: 'mentioned' });
    expect(unknownTrade.patch.personalization?.otherTrades ?? {}).toEqual({});

    const unknownStatus = executeAttachToProject({ trade: 'roof', tradeStatus: 'urgent' });
    expect(unknownStatus.patch.personalization?.otherTrades ?? {}).toEqual({});
  });
});

describe('pending providers', () => {
  it('get_house_profile returns pending_key without inventing a profile', () => {
    const out = executeGetHouseProfile({ neighbourhood: 'Leslieville' });
    expect(out.status).toBe('pending_key');
    expect(out.profile).toBeNull();
    // internal note is allowed to say pending_key — it's tool output for the model, not homeowner-facing text.
    expect(out.note.toLowerCase()).toContain('pending_key');
  });

  it('never leaks the internal pending_key status word, or "adapter", into the homeowner-facing card body', () => {
    for (const out of [
      executeGetHouseProfile({}),
      executeGetMarketCost({ trade: 'kitchen' }),
      executeGetWantVsValue({}),
    ]) {
      expect(out.card?.body.toLowerCase()).not.toContain('pending_key');
      expect(out.card?.body.toLowerCase()).not.toContain('adapter');
    }
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

describe('executeAnalyzeRenovationPriorities', () => {
  it('returns no cards when fewer than two projects are known', () => {
    const out = executeAnalyzeRenovationPriorities(defaultWorkspaceState());
    expect(out.status).toBe('not_enough_context');
    expect(out.cards).toEqual([]);
  });

  it('returns a real, id-bearing analysis card once two projects are known', () => {
    const state = applyPatch(defaultWorkspaceState(), {
      objective: 'refinish',
      personalization: { otherTrades: { roof: 'mentioned' } },
    });
    const out = executeAnalyzeRenovationPriorities(state);
    expect(out.status).toBe('ok');
    expect(out.cards[0]?.type).toBe('analysis_available');
    expect(out.cards[0]?.id).toBeTruthy();
  });

  it('proposes the paid deep analysis only once the state is rich enough, with the real server-configured credit cost — never a dollar figure', () => {
    const thin = applyPatch(defaultWorkspaceState(), {
      objective: 'refinish',
      personalization: { otherTrades: { roof: 'mentioned' } },
    });
    expect(executeAnalyzeRenovationPriorities(thin).cards).toHaveLength(1);

    const rich = applyPatch(defaultWorkspaceState(), {
      objective: 'refinish',
      sellHorizon: 'selling-soon',
      rooms: [{ label: 'Whole project', squareFeet: 900 }],
      personalization: { otherTrades: { roof: 'mentioned', kitchen: 'mentioned' }, floorCondition: 'scratched' },
    });
    const richOut = executeAnalyzeRenovationPriorities(rich);
    expect(richOut.cards).toHaveLength(2);
    const paidCard = richOut.cards.find((c) => c.type === 'paid_analysis_proposed');
    expect(paidCard).toBeTruthy();
    // The credit cost IS shown — it's a real, server-resolved number (rule
    // 18/19) — but never a raw CAD figure; "Renovation Credits" is the only
    // customer-facing unit (rule 28).
    expect(paidCard!.body).not.toMatch(/\$\d/);
    expect(paidCard!.body).toContain('Renovation Credits');
  });
});

describe('filterDismissedCards', () => {
  it('drops a card whose id was dismissed, and keeps everything else', () => {
    const cards = [
      { type: 'site_link' as const, id: 'site:/a', title: 'A', body: 'a' },
      { type: 'site_link' as const, id: 'site:/b', title: 'B', body: 'b' },
    ];
    expect(filterDismissedCards(cards, ['site:/a']).map((c) => c.id)).toEqual(['site:/b']);
  });

  it('never filters a card with no id — nothing to match against', () => {
    const cards = [{ type: 'site_link' as const, title: 'A', body: 'a' }];
    expect(filterDismissedCards(cards, ['site:/a'])).toEqual(cards);
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
