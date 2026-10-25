import { describe, it, expect } from 'vitest';
import { MARKETS } from '@/content/geo/markets';
import { MARKET_INPUTS } from '@/content/geo/market-inputs';
import { localCensusLine } from './public-facts';

describe('localCensusLine', () => {
  it('gives a municipality a cited sentence with the published counts and medians', () => {
    const l = localCensusLine('oakville', 'Oakville');
    expect(l).not.toBeNull();
    expect(l!.text).toMatch(/^Statistics Canada's 2021 Census counts [\d,]+ private households in Oakville, \d+% of them in single-detached houses\./);
    expect(l!.text).toMatch(/median household income was \$[\d,]+ \(2020\)/);
    expect(l!.sources).toHaveLength(3);
    for (const s of l!.sources) expect(s.url).toMatch(/^https:\/\/www150\.statcan\.gc\.ca\//);
  });

  it('never gives a district its parent municipality’s figures', () => {
    for (const m of MARKETS.filter((x) => x.kind === 'district')) {
      expect(localCensusLine(m.slug, m.name), m.slug).toBeNull();
    }
  });

  it('gives nothing to a market with no census figures (New York)', () => {
    for (const m of MARKETS.filter((x) => x.country === 'US')) {
      expect(localCensusLine(m.slug, m.name), m.slug).toBeNull();
    }
  });

  it('publishes no score, percentile or ranking', () => {
    for (const m of MARKETS) {
      const l = localCensusLine(m.slug, m.name);
      if (!l) continue;
      expect(l.text, m.slug).not.toMatch(/percentile|score|rank|priority|confidence/i);
    }
    expect(Object.keys(MARKET_INPUTS).length).toBeGreaterThan(0);
  });
});
