import { describe, it, expect } from 'vitest';
import {
  MARKETS, CORRIDORS, marketBySlug, corridorById, corridorsFor,
  serviceAreaMarkets, isOperational, assess, contentQueue, indexableMarkets,
} from './index';
import { cityContent } from '@/lib/seo-data';

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

describe('New York State, and the line that still holds', () => {
  const us = () => MARKETS.filter((m) => m.country === 'US');

  it('carries every United States market on a live service status', () => {
    expect(us().length).toBeGreaterThanOrEqual(26);
    for (const m of us()) {
      expect(['us-active', 'us-by-confirmation'], m.slug).toContain(m.status);
      expect(isOperational(m), m.slug).toBe(true);
      expect(m.operationalTruth.verifiedAt, m.slug).not.toBeNull();
      expect(m.operationalTruth.verifiedBy, m.slug).toBe('owner');
    }
  });

  it('puts New York municipalities in the service area, and still excludes districts', () => {
    const area = serviceAreaMarkets();
    expect(area.some((m) => m.country === 'US')).toBe(true);
    expect(area.some((m) => m.slug === 'buffalo')).toBe(true);
    // Williamsville is a village inside Amherst and Kenmore inside Tonawanda.
    // Neither may become a peer City of the town that contains it.
    expect(area.some((m) => m.slug === 'williamsville')).toBe(false);
    expect(area.some((m) => m.slug === 'kenmore')).toBe(false);
    expect(area.every((m) => m.kind === 'municipality')).toBe(true);
  });

  it('never states a second address, telephone or set of hours', () => {
    // The one thing the New York confirmation did not change. A local United
    // States number is the most tempting thing to invent on a page like this
    // and the claim that turns a true service page into a fabricated presence.
    const blob = JSON.stringify(MARKETS);
    expect(blob).not.toMatch(/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/);
    for (const m of us()) {
      expect(m.operationalTruth.statement, m.slug).toMatch(/showroom are in Toronto/);
      expect(m.operationalTruth.statement, m.slug).not.toMatch(/office|storefront|branch/i);
    }
  });

  it('distinguishes the two Niagara Falls and keeps both published', () => {
    const on = MARKETS.find((m) => m.slug === 'niagara-falls-on')!;
    const ny = MARKETS.find((m) => m.slug === 'niagara-falls-ny')!;
    expect(on.country).toBe('CA');
    expect(ny.country).toBe('US');
    expect(isOperational(on) && isOperational(ny)).toBe(true);
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

  it('excludes any corridor-target, whenever one exists again', () => {
    const area = new Set(serviceAreaMarkets().map((m) => m.slug));
    for (const m of MARKETS.filter((x) => x.status === 'corridor-target')) {
      expect(area.has(m.slug), m.slug).toBe(false);
    }
  });

  it('carries every Ontario market confirmed, municipalities and neighbourhoods alike', () => {
    const on = MARKETS.filter((m) => m.region === 'ON');
    expect(on.length).toBeGreaterThanOrEqual(75);
    expect(on.filter((m) => m.kind === 'municipality').length).toBeGreaterThanOrEqual(35);
    const unconfirmed = on.filter((m) => m.operationalTruth.verifiedAt === null);
    expect(unconfirmed.map((m) => m.slug)).toEqual([]);
  });

  it('models the sixteen Toronto neighbourhoods as districts, never as cities', () => {
    const hoods = ['rosedale', 'forest-hill', 'yorkville', 'leaside', 'the-annex', 'high-park',
      'riverdale', 'leslieville', 'the-beaches', 'lawrence-park', 'cabbagetown', 'swansea',
      'davisville-village', 'midtown-toronto', 'king-west', 'liberty-village'];
    const area = new Set(serviceAreaMarkets().map((m) => m.slug));
    for (const slug of hoods) {
      const m = MARKETS.find((x) => x.slug === slug);
      expect(m, slug).toBeDefined();
      expect(m!.kind, slug).toBe('district');
      expect(m!.partOf, slug).toBe('toronto');
      expect(m!.corridors, slug).toEqual([]);
      // F-157: a neighbourhood must never become a schema.org City node.
      expect(area.has(slug), slug).toBe(false);
    }
  });

  it('says who confirmed every market it claims, and never leaves the sentence empty', () => {
    for (const m of MARKETS.filter((x) => x.operationalTruth.verifiedAt !== null)) {
      expect(m.operationalTruth.verifiedBy, m.slug).toBe('owner');
      expect(m.operationalTruth.statement.trim().length, m.slug).toBeGreaterThan(20);
    }
  });

  it('keeps status and confirmation from disagreeing in either direction', () => {
    for (const m of MARKETS.filter((x) => x.country === 'CA')) {
      const operational = ['core-active', 'active-expansion', 'travel-by-confirmation'].includes(m.status);
      if (operational) expect(m.operationalTruth.verifiedAt, m.slug).not.toBeNull();
      if (m.status === 'corridor-target') expect(m.operationalTruth.verifiedAt, m.slug).toBeNull();
    }
  });

  it('does not flatten a two-hour drive into routine daily coverage', () => {
    // Confirming the whole map is one decision; pretending Fort Erie is next
    // door is a different and worse one. The far end of the Niagara belt says
    // what it is, and its own sentence says so too.
    for (const slug of ['fort-erie', 'port-colborne', 'welland', 'kitchener', 'barrie']) {
      const m = MARKETS.find((x) => x.slug === slug)!;
      expect(m.status, slug).toBe('travel-by-confirmation');
      expect(m.operationalTruth.statement, slug).toMatch(/confirmed in advance/);
    }
    for (const slug of ['milton', 'burlington', 'hamilton', 'oshawa']) {
      expect(MARKETS.find((x) => x.slug === slug)!.status, slug).toBe('active-expansion');
    }
  });
});

describe('page-worthiness', () => {
  it('publishes a page only where there is real local content', () => {
    for (const m of indexableMarkets(MARKETS)) {
      expect(m.operationalTruth.verifiedAt, m.slug).not.toBeNull();
      expect(['CA', 'US'], m.slug).toContain(m.country);
      expect(cityContent(m.slug), m.slug).toBeDefined();
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
    // Every Ontario market is confirmed since 2026-09-10, so the subject is
    // synthetic on purpose: the requirement is that an UNCONFIRMED market is
    // unpublishable however well it scores, and that has to stay testable when
    // there is no unconfirmed market left in the file to borrow.
    const strong = MARKETS.find((m) => m.slug === 'hamilton')!;
    const unconfirmed = { ...strong, operationalTruth: { statement: '', verifiedAt: null } };
    const w = assess(unconfirmed);
    expect(w.indexable).toBe(false);
    expect(w.blockers.join(' ')).toContain('operational position unverified');
    expect(w.score).toBeGreaterThan(0);
  });

  it('still refuses a page to a confirmed market with no local content', () => {
    // Confirmation and a page are separate facts. Every Ontario market is
    // confirmed; only the ones with real local content carry a page, and this
    // asserts the gate holds for the rest — a count that falls as content is
    // written and must never reach zero by the gate being loosened.
    const noContent = MARKETS.filter(
      (m) => m.operationalTruth.verifiedAt !== null && m.country === 'CA' && !cityContent(m.slug),
    );
    expect(noContent.length).toBeGreaterThan(5);
    for (const m of noContent) {
      const w = assess(m);
      expect(w.indexable, m.slug).toBe(false);
      expect(w.blockers.join(' '), m.slug).toContain('no local content');
    }
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
    // buffalo-metro and rochester-east are entirely American; the Ontario
    // corridors are entirely Canadian. Exactly one corridor holds both, and it
    // is the one named after the crossing — which is what makes it the only
    // place the two countries can be confused for one another.
    const mixed = CORRIDORS.filter((c) => {
      const countries = new Set(c.members.map((s) => marketBySlug(s)?.country));
      return countries.has('CA') && countries.has('US');
    });
    expect(mixed.map((c) => c.id)).toEqual(['buffalo-niagara']);

    const usOnly = CORRIDORS.filter((c) => c.members.every((s) => marketBySlug(s)?.country === 'US'));
    expect(usOnly.map((c) => c.id).sort()).toEqual(['buffalo-metro', 'rochester-east']);
  });

  it('never lets a United States market into a Canada-only corridor', () => {
    for (const c of CORRIDORS) {
      if (['buffalo-niagara', 'buffalo-metro', 'rochester-east'].includes(c.id)) continue;
      expect(c.members.every((s) => marketBySlug(s)?.country === 'CA'), c.id).toBe(true);
    }
  });
});
