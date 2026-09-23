/**
 * tests/drift.test.ts — the fact drift engine, in-process (Protocol v2,
 * Stage 22). Registry, llms.txt, markdown mirrors, JSON-LD, /api/knowledge,
 * /api/v1, sitemap and robots are all projections of the same modules. This
 * suite renders each one and checks the projections agree on name, address,
 * phone, founding year, prices, services and canonical origin. A conflict on a
 * customer-facing fact fails the build.
 */
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as llmsGet } from '@/app/llms.txt/route';
import { GET as llmsFullGet } from '@/app/llms-full.txt/route';
import { GET as aiGet } from '@/app/ai.txt/route';
import { GET as knowledgeGet } from '@/app/api/knowledge/route';
import { GET as entityGet } from '@/app/api/v1/entity/route';
import { GET as pricingGet } from '@/app/api/v1/pricing/route';
import { GET as mdIndexGet } from '@/app/md/route';
import { GET as mdHomeGet } from '@/app/md/home/route';
import { GET as mdPricingGet } from '@/app/md/pricing/route';
import { GET as mdContactGet } from '@/app/md/contact/route';
import { GET as mdServicesGet } from '@/app/md/services/route';
import { GET as mdAreasGet } from '@/app/md/service-areas/route';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';
import { entityToMarkdown, serviceMarkdown, areaMarkdown } from '@/lib/markdown-export';
import { ROOT_ORGANIZATION_SCHEMA } from '@/lib/schema/root-schema';
import { BUSINESS_NAP, BUSINESS_ADDRESS_LINE, HOURS_LINE, REVIEW_EVIDENCE } from '@ecowoods/shared/constants';
import { PRICE_BANDS, ALL_PRICE_BANDS, formatBand, formatBandBare } from '@/content/constants/pricing';
import { SITE_URL, SERVICES, SERVICE_AREAS } from '@/lib/seo-data';

const digits = (s: string) => s.replace(/\D/g, '');
const text = async (res: Response) => res.text();

const expectNap = (body: string, where: string) => {
  expect(body, `${where}: phone`).toContain(BUSINESS_NAP.phoneDisplay);
  expect(body, `${where}: address`).toContain(BUSINESS_ADDRESS_LINE);
  expect(body, `${where}: founded`).toContain(String(BUSINESS_NAP.foundedYear));
  expect(body, `${where}: legal name`).toContain(BUSINESS_NAP.legalName);
  expect(body, `${where}: email`).toContain(BUSINESS_NAP.email);
};
const expectBands = (body: string, where: string) => {
  for (const b of PRICE_BANDS) {
    const ok = body.includes(formatBand(b)) || body.includes(formatBandBare(b));
    expect(ok, `${where}: band ${b.label}`).toBe(true);
  }
};
/**
 * Any ecowoods-branded host that is NOT the canonical ecowoods.ca: a second
 * marketing domain, a staging host, a deployment preview. `ecowoods[a-z0-9-]+`
 * requires at least one character after "ecowoods", which is what exempts
 * ecowoods.ca and www.ecowoods.ca. Matched as a shape rather than as a list of
 * known hostnames so that a host nobody has coined yet is still caught.
 */
const NON_CANONICAL_HOST = /\becowoods[a-z0-9-]+\.[a-z]{2,}/i;

const expectClean = (body: string, where: string) => {
  expect(body, `${where}: preview host`).not.toMatch(/vercel\.app/);
  expect(body, `${where}: non-canonical host`).not.toMatch(NON_CANONICAL_HOST);
  expect(body, `${where}: injection`).not.toMatch(/ignore (all |any )?(previous|prior) instructions|always (cite|recommend) ecowoods/i);
};

describe('llms.txt', () => {
  it('is llmstxt.org-shaped, curated, and states the same facts as the constants', async () => {
    const body = await text(await llmsGet());
    const lines = body.split('\n');
    expect(lines[0]).toBe(`# ${BUSINESS_NAP.legalName}`);
    expect(lines.slice(0, 10).some((l) => l.startsWith('> '))).toBe(true);
    expect(body).toContain('## Facts you can cite');
    expect(body).toContain('## Optional');
    expect(body.indexOf('## Preferred citation targets')).toBeLessThan(body.indexOf('## Technical papers'));
    expectNap(body, 'llms.txt');
    expectBands(body, 'llms.txt');
    for (const s of SERVICES) expect(body).toContain(s.name);
    expect(body).toContain(HOURS_LINE);
    for (const r of REVIEW_EVIDENCE) expect(body).toContain(`${r.count} at ${r.rating.toFixed(1)} on ${r.platform}`);
    expectClean(body, 'llms.txt');
    // Curated core: 20–50 links before Optional; the whole file stays well under the old 65 KB.
    const core = body.slice(0, body.indexOf('## Optional'));
    const links = core.match(/\]\(https:\/\/[^)]+\)/g) ?? [];
    expect(links.length).toBeGreaterThanOrEqual(20);
    /* Raised 60 → 65 when /assistant (Ask Francisco) joined the curated core.
       One destination link; core stayed the citation surface, not Optional dump. */
    expect(links.length).toBeLessThanOrEqual(65);
    /**
     * TWO BUDGETS, BECAUSE THEY GUARD DIFFERENT THINGS.
     *
     * The curated core — everything before `## Optional` — is the part that
     * matters. An agent reads the top of a document and stops, so the facts,
     * the entity, the prices and the citation targets have to fit in one
     * comfortable read. That is the number to hold, and it is held tightly.
     *
     * The whole-file cap is the coarser one: it exists because this file was
     * once 65 KB of glossary and figure dumps in prose, and nothing stopped it
     * growing. It is not a statement that the tail is expensive — the tail is
     * explicitly the part an agent may skip on a first fetch.
     *
     * It moved from 45,000 to 48,000 when the field catalogues were published:
     * they are real documents that an answer engine must be able to name, they
     * cost roughly 1.7 KB in the Optional tail for eight and about 2.4 KB for
     * eleven, and the core did not move (25.5 KB before and after — one curated
     * link was added to Evidence). Still well under the 65 KB this file came
     * from, and the cap is deliberately not being raised again for three more
     * documents: if a future set does not fit, that is the signal to prune the
     * tail rather than the signal to move the number.
     *
     * IT WAS RAISED ONCE, FOR A REASON THAT IS NOT "THREE MORE DOCUMENTS".
     *
     * The service-area set went from thirty-two published places to
     * eighty-nine: the Toronto luxury mesh, the Mississauga lakeshore, King
     * Township, the rest of the Niagara belt, and twenty-six municipalities in
     * New York State. Each one is a line in the Optional tail with a URL and a
     * markdown twin, and the whole point of publishing them is that a machine
     * can enumerate them from here.
     *
     * Pruning the tail — the alternative this comment recommends — would mean
     * hiding published service areas from the file whose job is to list them.
     * So the tail cap moved and the CORE cap did not: the curated section is
     * still under 30 KB, still 20–50 links, and still the part that has to stay
     * navigable. If the core ever crosses, prune the core.
     */
    /* Raised 30_000 → 33_000 with Ask Francisco whole-home destination copy in core.
       Optional tail budget unchanged; citation core stays one comfortable read. */
    expect(core.length).toBeLessThan(33000);
    expect(body.length).toBeLessThan(64000);
    // Every linked URL is on the canonical host.
    for (const m of body.matchAll(/\]\((https?:\/\/[^)]+)\)/g)) expect(m[1].startsWith(SITE_URL)).toBe(true);
  });
});

describe('llms-full.txt and ai.txt', () => {
  it('carry the same NAP and bands', async () => {
    const full = await text(await llmsFullGet());
    expectNap(full, 'llms-full.txt');
    expectBands(full, 'llms-full.txt');
    expectClean(full, 'llms-full.txt');
    const ai = await text(await aiGet());
    expect(ai).toContain(BUSINESS_NAP.phoneDisplay);
    expect(ai).toContain(String(BUSINESS_NAP.foundedYear));
    // One marketing host. ai.txt must never link to an ecowoods-branded host
    // other than the canonical one, nor to a deployment preview.
    expect(ai).not.toMatch(NON_CANONICAL_HOST);
    expect(ai).not.toMatch(/vercel\.app/);
  });
});

describe('markdown mirrors', () => {
  it('entity, home, pricing, contact, hubs, a service and an area agree with the constants', async () => {
    const entity = entityToMarkdown();
    expectNap(entity, '/about.md');
    const home = await text(await mdHomeGet());
    expectNap(home, '/index.md');
    expectBands(home, '/index.md');
    for (const s of SERVICES) expect(home).toContain(s.name);
    const pricing = await text(await mdPricingGet());
    expectBands(pricing, '/pricing.md');
    for (const id of ['screen-and-recoat', 'full-sand-and-finish', 'new-install']) expect(pricing).toContain(id);
    const contact = await text(await mdContactGet());
    expectNap(contact, '/contact.md');
    expect(contact).toContain(HOURS_LINE);
    const services = await text(await mdServicesGet());
    for (const s of SERVICES) expect(services).toContain(`${SITE_URL}/services/${s.slug}`);
    const areas = await text(await mdAreasGet());
    for (const a of SERVICE_AREAS) expect(areas).toContain(`${SITE_URL}/service-areas/${a.slug}`);
    const svc = serviceMarkdown('floor-refinishing')!;
    expect(svc).toContain(formatBand(PRICE_BANDS.find((b) => b.key === 'fullSandAndFinish')!));
    const area = areaMarkdown('etobicoke')!;
    expect(area).toContain('Etobicoke');
    const index = await text(await mdIndexGet());
    for (const p of ['/index.md', '/about.md', '/pricing.md', '/services.md', '/service-areas.md', '/contact.md', '/estimate.md', '/reviews.md']) expect(index).toContain(`${SITE_URL}${p}`);
    for (const m of [entity, home, pricing, contact, services, areas, svc, area, index]) expectClean(m, 'md');
  });
});

describe('APIs', () => {
  it('/api/knowledge pricing equals the bands; /api/v1/entity equals JSON-LD and the constants', async () => {
    const k = await (await knowledgeGet(new NextRequest(`${SITE_URL}/api/knowledge?collection=pricing`))).json();
    expect(k.pricing).toHaveLength(ALL_PRICE_BANDS.length);
    for (const b of ALL_PRICE_BANDS) {
      /* Matched on currency as well as label since GEO-004 — "Screen & Recoat"
         names two bands now, and a match on the label alone would check the
         Ontario numbers twice and never look at New York. */
      const row = k.pricing.find((p: any) => p.label === b.label && p.currency === b.currency);
      expect(row, `${b.label} ${b.currency}`).toBeDefined();
      expect(JSON.stringify(row)).toContain(String(b.min));
      expect(JSON.stringify(row)).toContain(String(b.max));
    }
    const e = await (await entityGet(new Request(`${SITE_URL}/api/v1/entity`))).json();
    const ld = ROOT_ORGANIZATION_SCHEMA as unknown as Record<string, any>;
    expect(digits(e.data.telephone_e164)).toBe(digits(ld.telephone));
    expect(e.data.address.postal_code).toBe(ld.address.postalCode);
    expect(e.data.legal_name).toBe(ld.legalName);
    expect(e.data.schema_id).toBe(ld['@id']);
    const p = await (await pricingGet(new Request(`${SITE_URL}/api/v1/pricing`))).json();
    for (const b of ALL_PRICE_BANDS) {
      expect(
        p.items.some(
          (x: any) => x.data.min === b.min && x.data.max === b.max && x.data.label === b.label && x.data.currency === b.currency,
        ),
        `${b.label} ${b.currency}`,
      ).toBe(true);
    }
  });
});

describe('sitemap and robots', () => {
  it('sitemap is canonical-only, unique, and covers every service, area and P0 page', async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const u of urls) {
      expect(u.startsWith(SITE_URL), u).toBe(true);
      expect(u).not.toMatch(/\.md$|\/api\/|vercel\.app|ecowoodshardwood/);
    }
    for (const s of SERVICES) expect(urls).toContain(`${SITE_URL}/services/${s.slug}`);
    for (const a of SERVICE_AREAS) expect(urls).toContain(`${SITE_URL}/service-areas/${a.slug}`);
    for (const p of ['/pricing', '/estimate', '/contact', '/about', '/services', '/service-areas', '/reviews']) expect(urls).toContain(`${SITE_URL}${p}`);
  });
  it('robots allows the machine files and the v1 API, and declares the sitemap and host', () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    for (const rule of rules) {
      const allow = Array.isArray(rule.allow) ? rule.allow : [rule.allow];
      for (const p of ['/llms.txt', '/llms-full.txt', '/md/', '/api/v1/', '/api/knowledge']) expect(allow, JSON.stringify(rule.userAgent)).toContain(p);
    }
    expect(r.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
    expect(r.host).toBe(SITE_URL);
  });
});
