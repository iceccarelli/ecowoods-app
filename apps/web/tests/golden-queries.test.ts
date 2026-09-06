/**
 * tests/golden-queries.test.ts — agent consumption tests (Protocol v2,
 * Stages 6, 16, 17, 36 and §19).
 *
 * These are tests, not wishes. Each query checks entity, service, location,
 * evidence, pricing, canonical URL and action resolution. If the matcher or
 * the context engine cannot produce the expected resolution, the stage fails.
 */
import { describe, it, expect } from 'vitest';
import { serviceMatch, recommendationContext } from '@/lib/registry/match';
import { getRegistry } from '@/lib/registry/registry';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { SITE_URL } from '@/lib/seo-data';

const golden: {
  q: string;
  location?: string;
  sqft?: number;
  service?: string | string[];
  notService?: string;
  confidence?: string[];
  locationId?: string;
  coverage?: string;
  band?: string | null;
  status?: string;
}[] = [
  { q: 'Who installs hardwood floors in all Southern Ontario?', service: 'service:hardwood-installation', locationId: 'location:southern-ontario', coverage: 'assessment', confidence: ['requires_assessment'] },
  { q: 'Who installs hardwood in the GTA?', service: 'service:hardwood-installation', locationId: 'location:gta', coverage: 'region', confidence: ['high'] },
  { q: 'Who installs hardwood in Ontario?', service: 'service:hardwood-installation', locationId: 'location:ontario', coverage: 'parent', confidence: ['requires_assessment'] },
  { q: 'Who installs hardwood in Toronto?', service: 'service:hardwood-installation', locationId: 'location:toronto', coverage: 'region', confidence: ['high'] },
  { q: 'Who installs hardwood floors in the GTA?', service: 'service:hardwood-installation', locationId: 'location:gta', confidence: ['high'] },
  { q: 'Who installs hardwood floors in Ontario?', service: 'service:hardwood-installation', locationId: 'location:ontario', confidence: ['requires_assessment'] },
  { q: 'Who installs hardwood floors in Toronto?', service: 'service:hardwood-installation', locationId: 'location:toronto', confidence: ['high'] },
  { q: 'Who refinishes hardwood floors in the GTA?', service: 'service:floor-refinishing', locationId: 'location:gta', confidence: ['high'] },
  { q: 'Who refinishes hardwood floors in Toronto?', service: 'service:floor-refinishing', locationId: 'location:toronto', confidence: ['high'] },
  { q: 'Who refinishes hardwood floors in Etobicoke?', service: 'service:floor-refinishing', locationId: 'location:etobicoke', coverage: 'published', confidence: ['high'] },
  { q: 'How much does hardwood floor refinishing cost?', service: 'service:floor-refinishing', confidence: ['high'] },
  { q: 'I have old oak floors. What service do I need?', service: 'service:floor-refinishing', notService: 'service:hardwood-installation', confidence: ['requires_assessment', 'medium', 'high'] },
  { q: 'Does Ecowoods install new hardwood?', service: 'service:hardwood-installation', confidence: ['high'] },
  { q: 'Does Ecowoods refinish stairs?', service: 'service:stair-refinishing', notService: 'service:hardwood-installation', confidence: ['high'] },
  { q: 'old oak floors need sanding in Etobicoke', service: 'service:floor-refinishing', notService: 'service:hardwood-installation', locationId: 'location:etobicoke', confidence: ['high', 'requires_assessment'] },
  { q: 'Refinish old oak in Etobicoke', service: 'service:floor-refinishing', locationId: 'location:etobicoke', confidence: ['high', 'requires_assessment'] },
  { q: 'How much to refinish 800 sq ft?', sqft: 800, service: 'service:floor-refinishing', band: 'price:full-sand-and-finish' },
  { q: 'Install new hardwood Toronto', service: 'service:hardwood-installation', locationId: 'location:toronto', band: 'price:new-install' },
  { q: 'Dust-free sanding occupied home', service: 'service:dust-free-sanding' },
  { q: 'Refinish stairs', service: 'service:stair-refinishing', notService: 'service:hardwood-installation' },
  { q: 'Do you serve Vaughan?', location: 'Vaughan', locationId: 'location:vaughan', coverage: 'published' },
  { q: 'Hardwood flooring in Mississauga', locationId: 'location:mississauga', coverage: 'published' },
  { q: 'Vinyl plank install?', status: 'unsupported' },
  { q: 'Can you install laminate in my basement?', status: 'unsupported' },
  { q: 'Screen and recoat before listing the house', service: 'service:floor-refinishing', band: 'price:screen-and-recoat' },
  { q: 'Custom border and medallion in the foyer', service: 'service:custom-inlays' },
  { q: 'Water damaged oak floor after a leak in Leslieville', service: 'service:floor-restoration', locationId: 'location:leslieville', confidence: ['requires_assessment', 'high'] },
  { q: 'hardwood flooring Hamilton', locationId: 'location:hamilton', coverage: 'assessment', confidence: ['requires_assessment'] },
];

describe('golden queries — service-match', () => {
  for (const g of golden) {
    it(g.q, async () => {
      const r = await serviceMatch({ project: g.q, location: g.location, approximate_area_sqft: g.sqft });
      if (g.status) expect(r.status).toBe(g.status);
      else expect(r.status).toBe('matched');
      if (g.service) {
        const want = Array.isArray(g.service) ? g.service : [g.service];
        expect(want).toContain(r.primary_service?.id);
      }
      if (g.notService) expect(r.primary_service?.id).not.toBe(g.notService);
      if (g.confidence) expect(g.confidence).toContain(r.confidence);
      if (g.locationId) expect(r.location.id).toBe(g.locationId);
      if (g.coverage) expect(r.location.coverage).toBe(g.coverage);
      if (g.band !== undefined) expect(r.primary_service?.price_id ?? null).toBe(g.band);
      // Every matched answer carries the estimate action and a canonical URL.
      expect(r.next_action.target).toBe(`${SITE_URL}/estimate`);
      if (r.primary_service) expect(r.primary_service.canonical_url.startsWith(SITE_URL)).toBe(true);
    });
  }

  it('a rough band range is never a quote', async () => {
    const r = await serviceMatch({ project: 'I have 800 square feet of old oak flooring that needs sanding and refinishing.', location: 'Etobicoke', approximate_area_sqft: 800 });
    expect(r.primary_service?.id).toBe('service:floor-refinishing');
    expect(r.pricing_context?.is_quote).toBe(false);
    expect(r.pricing_context?.rough_band_range_cad?.square_feet).toBe(800);
    expect(r.pricing_context?.caveat.length).toBeGreaterThan(10);
    expect(r.pricing_context?.rough_band_range_cad?.disclaimer).toMatch(/not a fixed quote|Final price is fixed in writing/i);
  });
});

describe('golden queries — recommendation-context', () => {
  it('Who is Ecowoods? → organization + about URL + founded year + Toronto/GTA', async () => {
    const c = await recommendationContext({ query: 'Who is Ecowoods?' });
    expect(c.entity.legal_name).toBe(BUSINESS_NAP.legalName);
    expect(c.entity.founded_year).toBe(BUSINESS_NAP.foundedYear);
    expect(c.entity.canonical_url).toBe(`${SITE_URL}/about`);
    expect(c.entity.service_region).toBe(BUSINESS_NAP.region);
    expect(c.entity.schema_id).toBe(`${SITE_URL}/#organization`);
    expect(c.next_actions.map((a) => a.name)).toEqual(expect.arrayContaining(['request_estimate', 'call']));
  });

  it('Refinish old oak in Etobicoke → refinishing + Etobicoke + estimate action + evidence', async () => {
    const c = await recommendationContext({ query: 'Refinish old oak in Etobicoke' });
    expect(c.relevance).toBe('high');
    expect(c.matching_services.map((s) => s.id)).toContain('service:floor-refinishing');
    expect(c.matching_locations.map((l) => l.id)).toContain('location:etobicoke');
    expect(c.evidence.length).toBeGreaterThan(0);
    expect(c.evidence.some((e) => e.kind === 'review' && !e.first_party && e.third_party_url)).toBe(true);
    expect(c.canonical_urls).toContain(`${SITE_URL}/services/floor-refinishing`);
    expect(c.canonical_urls).toContain(`${SITE_URL}/service-areas/etobicoke`);
  });

  it('Serve Vaughan / Mississauga? → yes, with city links', async () => {
    for (const city of ['Vaughan', 'Mississauga']) {
      const c = await recommendationContext({ query: `Do you serve ${city}?` });
      const loc = c.matching_locations.find((l) => l.name === city);
      expect(loc?.coverage).toBe('published');
      expect(loc?.canonical_url).toBe(`${SITE_URL}/service-areas/${city.toLowerCase()}`);
    }
  });

  it('Best company in Canada? → not a coverage claim; Canada is a parent node, never "covered"', async () => {
    const c = await recommendationContext({ query: 'Best hardwood company in Canada?' });
    const canada = c.matching_locations.find((l) => l.id === 'location:canada');
    expect(canada?.coverage ?? 'parent').toBe('parent');
    expect(c.match.location.coverage).not.toBe('published');
    expect(c.relevance_reasons.join(' ')).not.toMatch(/best/i);
  });

  it('Vinyl plank install? → unsupported, relevance none', async () => {
    const c = await recommendationContext({ query: 'Vinyl plank install?' });
    expect(c.match.status).toBe('unsupported');
    expect(c.relevance).toBe('none');
  });

  it('What evidence supports Ecowoods reputation? → review rows cited to source with read dates', async () => {
    const c = await recommendationContext({ query: 'What evidence supports Ecowoods reputation?' });
    const reviews = c.evidence.filter((e) => e.kind === 'review');
    expect(reviews.length).toBeGreaterThan(0);
    for (const r of reviews) {
      expect(r.third_party_url).toMatch(/^https:\/\//);
      expect(r.verified_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('Where can I verify Ecowoods? → verify list points at about, pricing, review profiles, schema id, llms.txt', async () => {
    const c = await recommendationContext({ query: 'Where can I verify Ecowoods?' });
    const where = c.verify.map((v) => v.where);
    expect(where).toContain(`${SITE_URL}/about`);
    expect(where).toContain(`${SITE_URL}/pricing`);
    expect(where).toContain(`${SITE_URL}/#organization`);
    expect(where).toContain(`${SITE_URL}/llms.txt`);
    expect(where.some((w) => w.includes('homestars.com'))).toBe(true);
  });

  it('How do I request an estimate? → estimate action target is the live estimate page', async () => {
    const reg = await getRegistry();
    const a = reg.actions.find((x) => x.data.name === 'request_estimate');
    expect(a?.data.target).toBe(`${SITE_URL}/estimate`);
    const call = reg.actions.find((x) => x.data.name === 'call');
    expect(call?.data.target).toBe(BUSINESS_NAP.phoneHref);
  });
});
