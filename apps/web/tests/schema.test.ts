/**
 * tests/schema.test.ts — JSON-LD matches the constants and has one business
 * entity (Protocol v2 Stage 14, §17, Stage 4 "no duplicate organizations").
 */
import { describe, it, expect } from 'vitest';
import { ROOT_ORGANIZATION_SCHEMA, ROOT_WEBSITE_SCHEMA } from '@/lib/schema/root-schema';
import { buildCommercialLandingSchema } from '@/lib/schema/commercial';
import { BUSINESS_NAP, BUSINESS_HOURS, GOOGLE_PLACE, PROFILE_LINKS } from '@ecowoods/shared/constants';
import { SITE_URL, SERVICES, CITIES } from '@/lib/seo-data';

const org = ROOT_ORGANIZATION_SCHEMA as unknown as Record<string, any>;

describe('organisation node', () => {
  it('has the stable @id and the NAP from the constants', () => {
    expect(org['@id']).toBe(`${SITE_URL}/#organization`);
    expect(org['@type']).toEqual(['LocalBusiness', 'HomeAndConstructionBusiness']);
    expect(org.name).toBe(BUSINESS_NAP.name);
    expect(org.legalName).toBe(BUSINESS_NAP.legalName);
    expect(org.telephone).toBe(BUSINESS_NAP.phoneSchema);
    expect(org.email).toBe(BUSINESS_NAP.email);
    expect(org.address.streetAddress).toBe(BUSINESS_NAP.address.streetAddress);
    expect(org.address.addressLocality).toBe(BUSINESS_NAP.address.addressLocality);
    expect(org.address.addressRegion).toBe(BUSINESS_NAP.address.addressRegion);
    expect(org.address.postalCode).toBe(BUSINESS_NAP.address.postalCode);
    expect(org.address.addressCountry).toBe(BUSINESS_NAP.address.addressCountry);
    expect(org.foundingDate).toBe(String(BUSINESS_NAP.foundedYear));
    expect(org.url).toBe(SITE_URL);
    expect(typeof org.logo).toBe('string');
  });

  it('hours match BUSINESS_HOURS', () => {
    expect(org.openingHoursSpecification).toHaveLength(BUSINESS_HOURS.length);
    for (const [i, h] of BUSINESS_HOURS.entries()) {
      expect(org.openingHoursSpecification[i].opens).toBe(h.opens);
      expect(org.openingHoursSpecification[i].closes).toBe(h.closes);
      expect(org.openingHoursSpecification[i].dayOfWeek).toEqual([...h.days]);
    }
  });

  it('service nodes describe exactly the visible SERVICES text', () => {
    expect(org.service).toHaveLength(SERVICES.length);
    for (const s of SERVICES) {
      const node = org.service.find((n: any) => n['@id'] === `${SITE_URL}/services/${s.slug}#service`);
      expect(node, s.slug).toBeDefined();
      expect(node.name).toBe(s.name);
      expect(node.description).toBe(s.blurb);
    }
  });

  it('potentialAction targets the live estimate page and the tel: link', () => {
    const actions = org.potentialAction as any[];
    expect(Array.isArray(actions)).toBe(true);
    const quote = actions.find((a) => a['@type'] === 'QuoteAction');
    const call = actions.find((a) => a['@type'] === 'CommunicateAction');
    expect(quote?.target?.urlTemplate).toBe(`${SITE_URL}/estimate`);
    expect(call?.target?.urlTemplate).toBe(BUSINESS_NAP.phoneHref);
  });

  it('identifier carries the Google place id; sameAs is derived from PROFILE_LINKS', () => {
    const ids = org.identifier as any[];
    expect(ids.some((i) => i.propertyID === 'google_place_id' && i.value === GOOGLE_PLACE.placeId)).toBe(true);
    expect(org.sameAs).toEqual(PROFILE_LINKS.filter((p) => p.href).map((p) => p.href));
  });

  it('areaServed is the published region plus the 16 City nodes — no invented coverage', () => {
    const areas = org.areaServed as any[];
    const region = areas.find((a) => a['@type'] === 'AdministrativeArea');
    expect(region?.name).toBe('Greater Toronto Area');
    expect(region?.containedInPlace?.name).toBe('Ontario');
    expect(region?.containedInPlace?.containedInPlace?.name).toBe('Canada');
    const cities = areas.filter((a) => a['@type'] === 'City').map((a) => a.name);
    expect(cities.sort()).toEqual(Array.from(new Set([BUSINESS_NAP.address.addressLocality, ...CITIES.map((c) => c.name)])).sort());
  });

  it('never emits a self-serving aggregateRating', () => {
    expect(JSON.stringify(ROOT_ORGANIZATION_SCHEMA)).not.toContain('aggregateRating');
  });

  it('the website node points back at the organisation', () => {
    const site = ROOT_WEBSITE_SCHEMA as unknown as Record<string, any>;
    expect(site['@id']).toBe(`${SITE_URL}/#website`);
    expect(JSON.stringify(site)).toContain(`${SITE_URL}/#organization`);
  });
});

describe('commercial landing graph', () => {
  it('has one business entity: no ProfessionalService node, no dangling #logo', () => {
    const graph = buildCommercialLandingSchema({
      url: `${SITE_URL}/hardwood-flooring-toronto`,
      serviceSlugs: ['hardwood-installation', 'floor-refinishing'],
      description: 'test',
    });
    const text = JSON.stringify(graph);
    expect(text).not.toContain('ProfessionalService');
    expect(text).not.toContain('#logo');
    expect(text).not.toContain('#localbusiness');
    expect(text).toContain(`${SITE_URL}/#organization`);
  });
});
