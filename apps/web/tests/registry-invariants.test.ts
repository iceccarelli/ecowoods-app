/**
 * tests/registry-invariants.test.ts — Protocol v2 §21 consistency invariants,
 * encoded. A change that violates one cannot be marked PASS.
 */
import { describe, it, expect } from 'vitest';
import { getRegistry, buildGraph } from '@/lib/registry/registry';
import { ROOT_ORGANIZATION_SCHEMA } from '@/lib/schema/root-schema';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { PRICE_BANDS } from '@/content/constants/pricing';
import { SITE_URL, SERVICES, SERVICE_AREAS } from '@/lib/seo-data';

const digits = (s: string) => s.replace(/\D/g, '');
const today = new Date().toISOString().slice(0, 10);

describe('§21 invariants', () => {
  it('1–3: one phone, one address, one founded year across registry, actions and JSON-LD', async () => {
    const reg = await getRegistry();
    const org = reg.organization.data;
    const ld = ROOT_ORGANIZATION_SCHEMA as unknown as Record<string, any>;
    expect(digits(org.telephone_e164)).toBe(digits(BUSINESS_NAP.phoneE164));
    expect(digits(ld.telephone)).toBe(digits(BUSINESS_NAP.phoneE164));
    const call = reg.actions.find((a) => a.data.name === 'call');
    expect(digits(call!.data.target)).toBe(digits(BUSINESS_NAP.phoneE164));
    expect(org.address.street).toBe(BUSINESS_NAP.address.streetAddress);
    expect(org.address.postal_code).toBe(BUSINESS_NAP.address.postalCode);
    expect(ld.address.postalCode).toBe(BUSINESS_NAP.address.postalCode);
    expect(org.founded_year).toBe(BUSINESS_NAP.foundedYear);
    expect(ld.foundingDate).toBe(String(BUSINESS_NAP.foundedYear));
    expect(org.email).toBe(BUSINESS_NAP.email);
  });

  it('4: one canonical origin on every primitive', async () => {
    const reg = await getRegistry();
    const all = [reg.organization, ...reg.services, ...reg.locations, ...reg.prices, ...reg.reviews, ...reg.sources, ...reg.evidence, ...reg.faq, ...reg.pages, ...reg.actions];
    for (const p of all) {
      expect(p.canonical_url.startsWith(SITE_URL), p.id).toBe(true);
      expect(p.canonical_url).not.toMatch(/vercel\.app|ecowoodshardwood|http:\/\//);
    }
    expect(all.length).toBeGreaterThan(100);
  });

  it('5: price bands in the registry equal the pricing constants', async () => {
    const reg = await getRegistry();
    expect(reg.prices).toHaveLength(PRICE_BANDS.length);
    for (const b of PRICE_BANDS) {
      const p = reg.prices.find((x) => x.data.band_key === b.key)!;
      expect(p.data.min).toBe(b.min);
      expect(p.data.max).toBe(b.max);
      expect(p.data.currency).toBe(b.currency);
      expect(p.data.unit).toBe(b.unit);
      expect(p.data.label).toBe(b.label);
      expect(p.data.is_quote).toBe(false);
      expect(p.data.caveat.length).toBeGreaterThan(10);
    }
  });

  it('6: service ids equal SERVICES slugs; every alias and use_instead resolves', async () => {
    const reg = await getRegistry();
    expect(reg.services.map((s) => s.data.slug).sort()).toEqual(SERVICES.map((s) => s.slug).sort());
    const ids = new Set(reg.services.map((s) => s.id));
    for (const s of reg.services) {
      for (const w of s.data.wrong_when) {
        if (w.use_instead.startsWith('service:')) expect(ids.has(w.use_instead), w.use_instead).toBe(true);
        else expect(['price:screen-and-recoat', 'unsupported', 'requires_assessment']).toContain(w.use_instead);
      }
      for (const r of s.data.related_service_ids) expect(ids.has(r)).toBe(true);
      expect(s.data.aliases.length).toBeGreaterThan(3);
    }
  });

  it('7: every published location has a page and a markdown twin; the published set equals SERVICE_AREAS', async () => {
    const reg = await getRegistry();
    const published = reg.locations.filter((l) => l.data.coverage === 'published');
    expect(published.map((l) => l.data.slug).sort()).toEqual(SERVICE_AREAS.map((a) => a.slug).sort());
    for (const l of published) {
      expect(l.data.page_id).toBeTruthy();
      expect(l.data.markdown_url).toBe(`${SITE_URL}/service-areas/${l.data.slug}.md`);
    }
    for (const l of reg.locations.filter((x) => x.data.coverage === 'assessment')) {
      expect(l.status).toBe('unverified');
      expect(l.provenance.note).toMatch(/not a published service area/i);
    }
  });

  it('8: evidence and reviews carry dates, sources and canonical citation URLs', async () => {
    const reg = await getRegistry();
    for (const e of reg.evidence) {
      expect(e.provenance.verified_at, e.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.provenance.verified_at <= today, e.id).toBe(true);
      expect(e.data.citation_url.startsWith(SITE_URL)).toBe(true);
      expect(e.source.url).toMatch(/^https:\/\//);
    }
    for (const r of reg.reviews) {
      expect(r.data.read_on <= today).toBe(true);
      expect(r.data.rating).toBeLessThanOrEqual(r.data.out_of);
      expect(r.data.published_as).toBe('cited_statistic');
      expect(r.data.profile_url).toMatch(/^https:\/\//);
    }
    for (const s of reg.sources) expect(s.data.url).toMatch(/^https:\/\//);
  });

  it('9: ids are unique; no primitive is in conflict; FAQ answers are visible on canonical pages', async () => {
    const reg = await getRegistry();
    const all = [reg.organization, ...reg.services, ...reg.locations, ...reg.prices, ...reg.reviews, ...reg.sources, ...reg.evidence, ...reg.faq, ...reg.pages, ...reg.actions];
    const ids = all.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(all.every((p) => p.status !== 'conflict')).toBe(true);
    for (const f of reg.faq) for (const u of f.data.visible_on) expect(u.startsWith(SITE_URL)).toBe(true);
  });

  it('10: the graph is closed — every edge endpoint is a node; offers → services; serves → published locations', async () => {
    const reg = await getRegistry();
    const g = await buildGraph();
    const nodeIds = new Set(g.nodes.map((n) => n.id));
    for (const e of g.edges) {
      expect(nodeIds.has(e.from), `${e.from} -${e.predicate}->`).toBe(true);
      expect(nodeIds.has(e.to), `-${e.predicate}-> ${e.to}`).toBe(true);
      if (e.predicate === 'offers') expect(e.to.startsWith('service:')).toBe(true);
      if (e.predicate === 'serves') {
        const loc = reg.locations.find((l) => l.id === e.to);
        expect(loc?.data.coverage).toBe('published');
      }
    }
    expect(g.edges.filter((e) => e.predicate === 'offers')).toHaveLength(SERVICES.length);
    expect(g.edges.filter((e) => e.predicate === 'serves')).toHaveLength(SERVICE_AREAS.length);
  });
});
