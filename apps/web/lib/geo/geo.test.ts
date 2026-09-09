import { describe, it, expect } from 'vitest';
import {
  MARKETS, CORRIDORS, marketBySlug, corridorById, corridorsFor,
  serviceAreaMarkets, isOperational, assess, contentQueue, indexableMarkets,
} from './index';

describe('the market registry', () => {
  it('has a unique slug per market', () => {
    const slugs = MARKETS.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('distinguishes the two Niagara Falls', () => {
    const both = MARKETS.filter((m) => m.name === 'Niagara Falls');
    expect(both).toHaveLength(2);
    expect(both.map((m) => m.slug).sort()).toEqual(['niagara-falls-ny', 'niagara-falls-on']);
    expect(both.map((m) => m.country).sort()).toEqual(['CA', 'US']);
  });

  it('resolves every nearest, parentHub and partOf to a real market', () => {
    for (const m of MARKETS) {
      expect(marketBySlug(m.parentHub), `${m.slug} parentHub`).toBeDefined();
      for (const n of m.nearest) expect(marketBySlug(n), `${m.slug} nearest ${n}`).toBeDefined();
      if (m.partOf) expect(marketBySlug(m.partOf), `${m.slug} partOf`).toBeDefined();
    }
  });

  it('gives every district a parent municipality and no corridors of its own', () => {
    for (const m of MARKETS.filter((x) => x.kind === 'district')) {
      expect(m.partOf, m.slug).toBeDefined();
      expect(marketBySlug(m.partOf!)?.kind, `${m.slug} parent`).toBe('municipality');
      expect(m.corridors, `${m.slug} corridors`).toEqual([]);
    }
  });

  it('inherits corridor membership through the parent municipality', () => {
    const etobicoke = corridorsFor('etobicoke').map((c) => c.id);
    const toronto = corridorsFor('toronto').map((c) => c.id);
    expect(etobicoke).toEqual(toronto);
    expect(etobicoke).toContain('core-gta');
  });
});

describe('the line the United States markets may not cross', () => {
  it('marks every US market us-proxy and none of them operational', () => {
    const us = MARKETS.filter((m) => m.country === 'US');
    expect(us.length).toBeGreaterThan(0);
    for (const m of us) {
      expect(m.status, m.slug).toBe('us-proxy');
      expect(isOperational(m), m.slug).toBe(false);
    }
  });

  it('keeps every US market out of the service area', () => {
    const area = serviceAreaMarkets();
    expect(area.some((m) => m.country === 'US')).toBe(false);
    expect(area.every((m) => m.region === 'ON')).toBe(true);
  });

  it('never gives a US market a page', () => {
    for (const m of MARKETS.filter((x) => x.country === 'US')) {
      const w = assess(m);
      expect(w.indexable, m.slug).toBe(false);
      expect(w.blockers.join(' ')).toContain('us-proxy');
      expect(w.score).toBe(0);
    }
  });
});

describe('what may be claimed as served', () => {
  it('excludes anything without a dated confirmation', () => {
    for (const m of serviceAreaMarkets()) {
      expect(m.operationalTruth.verifiedAt, m.slug).not.toBeNull();
      expect(m.operationalTruth.statement.length, m.slug).toBeGreaterThan(0);
    }
  });

  it('excludes districts, so no district is a peer City of its own municipality', () => {
    expect(serviceAreaMarkets().every((m) => m.kind === 'municipality')).toBe(true);
    expect(serviceAreaMarkets().some((m) => m.slug === 'etobicoke')).toBe(false);
    expect(serviceAreaMarkets().some((m) => m.slug === 'toronto')).toBe(true);
  });

  it('excludes every corridor-target, because nobody has confirmed one', () => {
    const area = new Set(serviceAreaMarkets().map((m) => m.slug));
    for (const m of MARKETS.filter((x) => x.status === 'corridor-target')) {
      expect(area.has(m.slug), m.slug).toBe(false);
    }
  });
});

describe('page-worthiness', () => {
  it('publishes a page only where there is real local content', () => {
    for (const m of indexableMarkets(MARKETS)) {
      expect(m.operationalTruth.verifiedAt, m.slug).not.toBeNull();
      expect(m.country, m.slug).toBe('CA');
    }
  });

  it('states a reason for every market it will not publish', () => {
    for (const m of MARKETS) {
      const w = assess(m);
      if (!w.indexable) expect(w.blockers.length, m.slug).toBeGreaterThan(0);
      else expect(w.blockers).toEqual([]);
    }
  });

  it('ranks a queue that never contains a US market', () => {
    const q = contentQueue(MARKETS);
    expect(q.length).toBeGreaterThan(0);
    const usSlugs = new Set(MARKETS.filter((m) => m.country === 'US').map((m) => m.slug));
    expect(q.some((w) => usSlugs.has(w.slug))).toBe(false);
    for (let i = 1; i < q.length; i++) expect(q[i - 1].score).toBeGreaterThanOrEqual(q[i].score);
  });

  it('cannot be talked into a page by a high score', () => {
    const unconfirmed = MARKETS.find((m) => m.operationalTruth.verifiedAt === null);
    expect(unconfirmed).toBeDefined();
    expect(assess(unconfirmed!).indexable).toBe(false);
  });
});

describe('corridors', () => {
  it('resolves every member to a market', () => {
    for (const c of CORRIDORS) {
      expect(c.members.length).toBeGreaterThan(1);
      for (const s of c.members) expect(marketBySlug(s), `${c.id} member ${s}`).toBeDefined();
      expect(marketBySlug(c.hub), `${c.id} hub`).toBeDefined();
      expect(c.members[0], `${c.id} starts at its hub`).toBe(c.hub);
    }
  });

  it('agrees with the markets in both directions', () => {
    for (const m of MARKETS.filter((x) => x.kind === 'municipality')) {
      for (const id of m.corridors) {
        expect(corridorById(id)?.members, `${m.slug} in ${id}`).toContain(m.slug);
      }
    }
  });

  it('crosses the border in exactly one corridor', () => {
    const crossing = CORRIDORS.filter((c) =>
      c.members.some((s) => marketBySlug(s)?.country === 'US'),
    );
    expect(crossing.map((c) => c.id)).toEqual(['buffalo-niagara']);
  });
});
