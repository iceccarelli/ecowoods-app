import { describe, it, expect } from 'vitest';
import { MARKETS } from '@/content/geo/markets';
import { matchLeadsToMarkets } from './market-demand';

describe('matchLeadsToMarkets', () => {
  it('matches by exact market name, ignoring case, accents and punctuation', () => {
    const d = matchLeadsToMarkets(
      [{ city: 'MISSISSAUGA', count: 2 }, { city: ' st catharines ', count: 1 }, { city: 'Etobicoke', count: 3 }],
      MARKETS,
    );
    expect(d.byMarket.get('mississauga')).toBe(2);
    expect(d.byMarket.get('st-catharines')).toBe(1);
    expect(d.byMarket.get('etobicoke')).toBe(3);
    expect(d.unmatched).toEqual([]);
    expect(d.total).toBe(6);
  });

  it('reports unknown cities and missing cities instead of guessing', () => {
    const d = matchLeadsToMarkets(
      [{ city: 'Ottawa', count: 2 }, { city: null, count: 1 }, { city: '  ', count: 1 }, { city: 'Mississauga, ON', count: 1 }],
      MARKETS,
    );
    expect(d.unmatched).toEqual([{ city: 'Ottawa', count: 2 }, { city: 'Mississauga, ON', count: 1 }]);
    expect(d.noCity).toBe(2);
    expect(d.byMarket.size).toBe(0);
  });

  it('does not pick a side for a name that two markets share', () => {
    const d = matchLeadsToMarkets([{ city: 'Niagara Falls', count: 4 }], MARKETS);
    expect(d.byMarket.get('niagara-falls-on')).toBeUndefined();
    expect(d.byMarket.get('niagara-falls-ny')).toBeUndefined();
    expect(d.unmatched).toEqual([{ city: 'Niagara Falls', count: 4 }]);
  });
});
