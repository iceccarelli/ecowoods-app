import { describe, it, expect, vi } from 'vitest';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => null) }));

const APP = path.resolve(__dirname, '../app');
const PUBLIC = path.resolve(__dirname, '../public');
const ROOT_PUBLIC = path.resolve(__dirname, '../../../public');

/** Does `urlPath` resolve to a page, a route handler, a rewrite target or a static file? */
function resolves(urlPath: string): boolean {
  const clean = urlPath.replace(/\/+$/, '') || '/';
  if (clean === '/') return true;
  // Metadata routes are app/robots.ts and app/sitemap.ts.
  if (clean === '/robots.txt') return existsSync(path.join(APP, 'robots.ts'));
  if (clean === '/sitemap.xml') return existsSync(path.join(APP, 'sitemap.ts'));
  // Markdown twins: /x/y.md is served by app/md/x/y (see the rewrites in next.config.js).
  if (clean.endsWith('.md')) {
    const stem = clean.slice(0, -3);
    if (stem === '/index') return existsSync(path.join(APP, 'md', 'route.ts'));
    return resolvesUnder(path.join(APP, 'md'), stem) && resolves(stem);
  }
  return resolvesUnder(APP, clean);
}

let usedDynamic = false;
function resolvesUnder(root: string, clean: string): boolean {
  usedDynamic = false;
  if (root === APP && (existsSync(path.join(PUBLIC, clean)) || existsSync(path.join(ROOT_PUBLIC, clean)))) return true;
  // Markdown twins are rewritten to app/md/**.
  const parts = clean.split('/').filter(Boolean);
  const walk = (dir: string, i: number): boolean => {
    if (i === parts.length) {
      return ['page.tsx', 'page.ts', 'route.ts', 'route.tsx'].some((f) => existsSync(path.join(dir, f)));
    }
    if (!existsSync(dir) || !statSync(dir).isDirectory()) return false;
    const seg = parts[i]!;
    const entries = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const e of entries) {
      const n = e.name;
      const isGroup = /^\(.+\)$/.test(n);
      const isDynamic = /^\[.+\]$/.test(n) && !n.startsWith('[...');
      const isCatchAll = n.startsWith('[...');
      if (n === seg && walk(path.join(dir, n), i + 1)) return true;
      if (isGroup && walk(path.join(dir, n), i)) return true;
      if (isDynamic && walk(path.join(dir, n), i + 1)) { usedDynamic = true; return true; }
      if (isCatchAll) { usedDynamic = true; return true; }
    }
    // a file route like app/llms.txt/route.ts is a directory named llms.txt (handled above)
    return false;
  };
  return walk(root, 0);
}

async function textOf(mod: string): Promise<string> {
  const m = (await import(mod)) as { GET: (r?: Request) => Promise<Response> | Response };
  const res = await m.GET(new Request('https://ecowoods.ca' + '/x'));
  return res.text();
}

const SURFACES = [
  ['llms.txt', '@/app/llms.txt/route'],
  ['llms-full.txt', '@/app/llms-full.txt/route'],
  ['ai.txt', '@/app/ai.txt/route'],
] as const;

describe('machine-readable surfaces', () => {
  for (const [name, mod] of SURFACES) {
    describe(name, () => {
      it('every ecowoods.ca URL is a real route', async () => {
        const text = await textOf(mod);
        const urls = [...text.matchAll(/https:\/\/ecowoods\.ca(\/[^\s)>\]"'`,;]*)?/g)].map((m) => (m[1] ?? '/').replace(/[.]+$/, ''));
        expect(urls.length).toBeGreaterThan(3);
        const concrete = urls.filter((u) => !/[{}:<*]/.test(u)); // documented URL templates are not URLs
        const sitemap = (await import('@/app/sitemap')).default;
        const inSitemap = new Set((await sitemap()).map((e) => new URL(e.url).pathname.replace(/\/+$/, '') || '/'));
        /* A URL that only resolves through a dynamic segment (/services/[slug])
           must also be a published slug — the sitemap is that list. */
        const dead = [...new Set(concrete.map((u) => u.split('#')[0]!.split('?')[0]!))].filter((u) => {
          const bare = u.replace(/\.md$/, '').replace(/\/+$/, '') || '/';
          if (!resolves(u)) return true;
          return usedDynamic && !inSitemap.has(bare);
        });
        expect(dead).toEqual([]);
      });
      it('carries the registry phone and never a different North American number', async () => {
        const text = await textOf(mod);
        const phones = [...text.matchAll(/\(?\b(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/g)].map((m) => `${m[1]}${m[2]}${m[3]}`);
        const ours = BUSINESS_NAP.phoneE164.replace(/\D/g, '').slice(-10);
        for (const p of phones) expect(p).toBe(ours);
      });
    });
  }
});

describe('identity agrees across the schema graph and /api/v1/entity', () => {
  it('same @id, phone, address, sameAs and potentialAction targets', async () => {
    const { ROOT_ORGANIZATION_SCHEMA } = await import('@/lib/schema/root-schema');
    const { GET } = await import('@/app/api/v1/entity/route');
    const org = ROOT_ORGANIZATION_SCHEMA as unknown as Record<string, any>;
    const api = (await (await GET(new Request('https://ecowoods.ca/api/v1/entity'))).json()).data;

    expect(org['@id']).toBe('https://ecowoods.ca/#organization');
    expect(api.schema_id).toBe(org['@id']);
    expect(org.telephone.replace(/\D/g, '')).toBe(api.telephone_e164.replace(/\D/g, ''));
    expect(org.telephone.replace(/\D/g, '')).toBe(BUSINESS_NAP.phoneE164.replace(/\D/g, ''));
    expect(org.address.streetAddress).toBe(api.address.street);
    expect(org.address.postalCode).toBe(api.address.postal_code);
    expect([...org.sameAs].sort()).toEqual([...api.same_as].sort());
    expect(org.sameAs).toContain('https://www.homestars.com/profile/2897115-ecowood');
    expect(org.aggregateRating).toBeUndefined();

    const targets = (org.potentialAction as { target: { urlTemplate: string } }[]).map((a) => a.target.urlTemplate);
    expect(targets).toContain('https://ecowoods.ca/estimate');
    expect(targets).toContain(BUSINESS_NAP.phoneHref);
  });

  it('areaServed is limited to the published list (plus its region wrappers)', async () => {
    const { ROOT_ORGANIZATION_SCHEMA } = await import('@/lib/schema/root-schema');
    const { SERVICE_AREAS } = await import('@/lib/seo-data');
    const org = ROOT_ORGANIZATION_SCHEMA as unknown as Record<string, any>;
    const served: string[] = (Array.isArray(org.areaServed) ? org.areaServed : [org.areaServed]).map((a: { name: string }) => a.name);
    const published = new Set(SERVICE_AREAS.map((a) => a.name.replace(/,\s*(NY|ON)$/, '')));
    // "Toronto" is the city of the published address, not an extra municipality.
    const allowed = new Set(['Greater Toronto Area', 'Ontario', 'Canada', 'Toronto']);
    const extras = served.filter((n) => !published.has(n.replace(/,\s*(NY|ON)$/, '')) && !allowed.has(n));
    expect(extras).toEqual([]);
  });
});
