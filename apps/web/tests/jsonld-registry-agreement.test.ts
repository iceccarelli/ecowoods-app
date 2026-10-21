/**
 * tests/jsonld-registry-agreement.test.ts
 *
 * The JSON-LD every indexable page EMITS, checked against the registries it is
 * supposed to be derived from. The page modules are rendered for real (react-dom
 * server) for every URL in the sitemap, the root layout's two nodes are added
 * (app/layout.tsx injects ROOT_ORGANIZATION_SCHEMA and ROOT_WEBSITE_SCHEMA on
 * every route), and the resulting graph is asserted per page:
 *
 *   - one business entity: no Organization/LocalBusiness node on a page beyond
 *     the layout's, and nothing nested that restates the NAP;
 *   - every `{ "@id": … }` reference resolves to a node in that page's graph;
 *   - nodes sharing an @id agree on name / description / serviceType;
 *   - no aggregateRating / review / priceRange / foundingDate outside the root;
 *   - every Offer is a numeric UnitPriceSpecification equal to a published band;
 *   - Service nodes carry the SERVICES registry name and the SERVICE_PAGES band;
 *   - areaServed names are only published areas (or the region wrappers);
 *   - years-in-business text is derived, not stale.
 *
 * It exists because every one of those is a field a hand-edit can break while
 * tsc, lint and the source-level guards stay green.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { BUSINESS_NAP, yearsInBusiness } from '@ecowoods/shared/constants';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => null) }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
  useRouter: () => ({ push() {}, replace() {}, prefetch() {} }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, getAll: () => [], has: () => false }),
}));
vi.mock('next/image', () => ({
  default: (p: any) => {
    const { src, alt, priority, fill, placeholder, blurDataURL, quality, ...rest } = p;
    return require('react').createElement('img', { src: typeof src === 'string' ? src : src?.src, alt, ...rest });
  },
}));

import { renderPage, flattenNodes, type Rendered } from './helpers/render-jsonld';
import { SITE_URL, SERVICES, SERVICE_AREAS, CITIES } from '@/lib/seo-data';
import { ALL_PRICE_BANDS } from '@/content/constants/pricing';
import { getServicePages, bandForPage } from '@/lib/service-pages';
import { ROOT_ORGANIZATION_SCHEMA, ROOT_WEBSITE_SCHEMA, placeForArea } from '@/lib/schema/root-schema';

type Node = Record<string, any>;

/** URLs in the sitemap that are files, not rendered pages. */
const NOT_PAGES = /\.pdf$/i;
/** Rendered outside the harness: needs a client provider tree the harness does not build. */
const HARNESS_SKIP = new Set(['/products/floorforge']);

const layoutNodes: Node[] = [ROOT_ORGANIZATION_SCHEMA as unknown as Node, ROOT_WEBSITE_SCHEMA as unknown as Node];
const BUSINESS_TYPES = /(^|[^A-Za-z])(Organization|LocalBusiness|HomeAndConstructionBusiness|ProfessionalService|GeneralContractor)$/;
const typesOf = (n: Node): string[] => ([] as string[]).concat(n['@type'] ?? []);
const isBusiness = (n: Node) => typesOf(n).some((t) => BUSINESS_TYPES.test(t));

/** Every object (at any depth) in a document. */
function* walk(o: unknown, path = ''): Generator<[Node, string]> {
  if (Array.isArray(o)) {
    for (const [i, x] of o.entries()) yield* walk(x, `${path}[${i}]`);
  } else if (o && typeof o === 'object') {
    yield [o as Node, path];
    for (const [k, v] of Object.entries(o)) yield* walk(v, `${path}.${k}`);
  }
}

let pages: { path: string; r: Rendered; nodes: Node[]; all: Node[] }[] = [];
let renderErrors: { path: string; error: string }[] = [];

beforeAll(async () => {
  const sitemap = (await import('@/app/sitemap')).default;
  const paths = (await sitemap()).map((e) => new URL(e.url).pathname).filter((p) => !NOT_PAGES.test(p) && !HARNESS_SKIP.has(p));
  for (const path of paths) {
    try {
      const r = await renderPage(path);
      const nodes = flattenNodes(r.nodes);
      pages.push({ path, r, nodes, all: [...layoutNodes, ...nodes] });
    } catch (e) {
      renderErrors.push({ path, error: String((e as Error).message).slice(0, 200) });
    }
  }
}, 180_000);

describe('every indexable page renders and emits parseable JSON-LD', () => {
  it('renders every sitemap URL through its real page module', () => {
    expect(renderErrors).toEqual([]);
    expect(pages.length).toBeGreaterThan(250);
  });

  it('every @context is schema.org', () => {
    const bad: string[] = [];
    for (const { path, nodes } of pages) {
      for (const n of nodes) if (n['@context'] && n['@context'] !== 'https://schema.org') bad.push(`${path}: @context ${n['@context']}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('one business entity per page', () => {
  it('no page body emits an Organization/LocalBusiness node of its own — the layout owns it', () => {
    const bad: string[] = [];
    for (const { path, nodes } of pages) {
      for (const n of nodes) if (isBusiness(n) && n['@id'] !== `${SITE_URL}/#organization`) bad.push(`${path}: top-level ${typesOf(n)} ${n['@id'] ?? ''}`);
      for (const n of nodes) if (isBusiness(n) && n['@id'] === `${SITE_URL}/#organization` && Object.keys(n).length > 3) bad.push(`${path}: root org re-declared in the page body`);
    }
    expect(bad).toEqual([]);
  });

  it('no nested business node restates the NAP (phone, e-mail, address, areaServed)', () => {
    const bad: string[] = [];
    for (const { path, nodes } of pages) {
      for (const n of nodes)
        for (const [o, at] of walk(n)) {
          if (!isBusiness(o)) continue;
          for (const k of ['telephone', 'email', 'address', 'areaServed', 'sameAs', 'openingHoursSpecification', 'aggregateRating']) {
            if (k in o) bad.push(`${path}${at}: nested ${typesOf(o)} carries ${k}`);
          }
        }
    }
    expect(bad).toEqual([]);
  });

  it('no page body carries aggregateRating, review, ratingValue, priceRange or foundingDate', () => {
    const bad: string[] = [];
    for (const { path, nodes } of pages) {
      for (const n of nodes)
        for (const [o, at] of walk(n)) {
          for (const k of ['aggregateRating', 'review', 'reviewRating', 'ratingValue', 'priceRange', 'foundingDate'] as const) {
            if (k in o) bad.push(`${path}${at}: ${k}`);
          }
        }
    }
    expect(bad).toEqual([]);
  });

  it('the layout organisation carries no rating and no priceRange either', () => {
    const text = JSON.stringify(layoutNodes);
    for (const k of ['aggregateRating', 'reviewRating', 'ratingValue', '"priceRange"']) expect(text).not.toContain(k);
  });
});

describe('@id references resolve and shared @ids agree', () => {
  it('every { "@id": … } reference points at a node defined in the page graph (page + layout)', () => {
    const bad: string[] = [];
    /* A reference may point at a node that lives on ANOTHER page of the site
       (a glossary term's inDefinedTermSet → the set on /glossary): that is how
       linked data is meant to work, provided the page at that URL really
       defines the id. */
    const definedOn = new Map<string, Set<string>>();
    for (const { path, nodes } of pages) {
      const ids = new Set<string>();
      for (const n of nodes) for (const [o] of walk(n)) if (typeof o['@id'] === 'string' && Object.keys(o).length > 1) ids.add(o['@id']);
      definedOn.set(path, ids);
    }
    for (const { path, all } of pages) {
      const defined = new Set<string>();
      const refs: [string, string][] = [];
      for (const n of all)
        for (const [o, at] of walk(n)) {
          if (typeof o['@id'] !== 'string') continue;
          if (Object.keys(o).length > 1) defined.add(o['@id']);
          else refs.push([o['@id'], at]);
        }
      for (const [id, at] of refs) {
        if (defined.has(id)) continue;
        const elsewhere = id.startsWith(`${SITE_URL}/`) ? definedOn.get(id.slice(SITE_URL.length).split('#')[0]!.replace(/\/+$/, '') || '/') : undefined;
        if (!elsewhere?.has(id)) bad.push(`${path}${at}: dangling ${id}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('no two top-level nodes in a page share an @id', () => {
    const bad: string[] = [];
    for (const { path, nodes } of pages) {
      const seen = new Set<string>();
      for (const n of nodes) {
        if (typeof n['@id'] !== 'string') continue;
        if (seen.has(n['@id'])) bad.push(`${path}: duplicate ${n['@id']}`);
        seen.add(n['@id']);
      }
    }
    expect(bad).toEqual([]);
  });

  it('a node defined twice (layout + page) agrees on name, description, serviceType and url', () => {
    const bad: string[] = [];
    for (const { path, all } of pages) {
      const byId = new Map<string, Node[]>();
      for (const n of all)
        for (const [o] of walk(n)) {
          if (typeof o['@id'] !== 'string' || Object.keys(o).length < 3) continue;
          // vitest stubs every image import to a basename-derived path, so two
          // images named 01.webp collide here; real builds hash them apart.
          if (o['@id'].includes('/_next/static/media/')) continue;
          byId.set(o['@id'], [...(byId.get(o['@id']) ?? []), o]);
        }
      for (const [id, defs] of byId) {
        for (const k of ['name', 'description', 'serviceType', 'url']) {
          const vals = new Set(defs.map((d) => d[k]).filter((v) => v !== undefined));
          if (vals.size > 1) bad.push(`${path}: ${id} disagrees on ${k}: ${[...vals].map((v) => JSON.stringify(v).slice(0, 60)).join(' vs ')}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('prices are the published bands, as numbers', () => {
  const bandKey = (min: number, max: number, cur: string) => `${cur}:${min}-${max}`;
  const published = new Set(ALL_PRICE_BANDS.map((b) => bandKey(b.min, b.max, b.currency)));

  it('every Offer / UnitPriceSpecification anywhere in the graph is numeric and equals a published band', () => {
    const bad: string[] = [];
    for (const { path, all } of pages) {
      for (const n of all)
        for (const [o, at] of walk(n)) {
          if (typesOf(o).includes('Offer')) {
            if ('priceRange' in o) bad.push(`${path}${at}: Offer.priceRange (not an Offer property)`);
            if ('price' in o) bad.push(`${path}${at}: Offer.price on a banded offer`);
          }
          if (typesOf(o).includes('UnitPriceSpecification')) {
            if ('price' in o) bad.push(`${path}${at}: UnitPriceSpecification.price (${JSON.stringify(o.price)}) — bands use minPrice/maxPrice`);
            if (typeof o.minPrice !== 'number' || typeof o.maxPrice !== 'number') bad.push(`${path}${at}: non-numeric band`);
            else if (!published.has(bandKey(o.minPrice, o.maxPrice, o.priceCurrency))) bad.push(`${path}${at}: ${o.priceCurrency} ${o.minPrice}-${o.maxPrice} is not a published band`);
          }
        }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('the root organisation: each service offer is the SERVICE_PAGES band; the catalog is every published band', () => {
    const org = layoutNodes[0]!;
    for (const sp of getServicePages()) {
      const node = org.service.find((s: Node) => s['@id'] === `${SITE_URL}/services/${sp.slug}#service`);
      expect(node, sp.slug).toBeDefined();
      const band = bandForPage(sp);
      if (!band) expect(node.offers, `${sp.slug} has no band, so no offer`).toBeUndefined();
      else {
        expect(node.offers).toHaveLength(1);
        expect(node.offers[0].priceSpecification.minPrice).toBe(band.min);
        expect(node.offers[0].priceSpecification.maxPrice).toBe(band.max);
        expect(node.offers[0].priceCurrency).toBe(band.currency);
      }
    }
    const catalog = org.hasOfferCatalog.itemListElement as Node[];
    expect(catalog.map((o) => bandKey(o.priceSpecification.minPrice, o.priceSpecification.maxPrice, o.priceCurrency)).sort()).toEqual([...published].sort());
  });
});

describe('Service nodes carry the SERVICES registry and the SERVICE_PAGES band', () => {
  it('every /services/<slug>#service node on any page: registry name, blurb, band', () => {
    const bad: string[] = [];
    let seen = 0;
    for (const { path, all } of pages) {
      for (const n of all) {
        for (const [o, at] of walk(n)) {
          const m = typeof o['@id'] === 'string' && o['@id'].startsWith(`${SITE_URL}/services/`) && o['@id'].endsWith('#service') && o['@type'] === 'Service' ? /services\/([^#]+)#service/.exec(o['@id']) : null;
          if (!m || Object.keys(o).length < 3) continue;
          seen++;
          const slug = m[1]!;
          const svc = SERVICES.find((s) => s.slug === slug);
          if (!svc) {
            bad.push(`${path}${at}: ${slug} is not a registry service`);
            continue;
          }
          if (o.name !== svc.name) bad.push(`${path}${at}: name ${JSON.stringify(o.name)} != ${JSON.stringify(svc.name)}`);
          if (o.description !== undefined && o.description !== svc.blurb) bad.push(`${path}${at}: description differs from the registry blurb`);
          const band = bandForPage(getServicePages().find((p) => p.slug === slug)!);
          const offers = ([] as Node[]).concat(o.offers ?? []);
          if (!band && offers.length) bad.push(`${path}${at}: offer on a service with no published band`);
          for (const off of offers) {
            const ps = off.priceSpecification;
            if (band && (ps?.minPrice !== band.min || ps?.maxPrice !== band.max || off.priceCurrency !== band.currency)) bad.push(`${path}${at}: offer differs from the ${slug} band`);
          }
        }
      }
    }
    expect(seen).toBeGreaterThan(50);
    expect([...new Set(bad)]).toEqual([]);
  });

  it('every one of the six services has its own page emitting its Service node', () => {
    for (const s of SERVICES) {
      const p = pages.find((x) => x.path === `/services/${s.slug}`);
      expect(p, s.slug).toBeDefined();
      const node = p!.nodes.find((n) => n['@id'] === `${SITE_URL}/services/${s.slug}#service`);
      expect(node, `${s.slug} Service node`).toBeDefined();
      expect(node!.name).toBe(s.name);
      expect(node!.url).toBe(`${SITE_URL}/services/${s.slug}`);
    }
  });
});

describe('areaServed / spatialCoverage name only published areas', () => {
  const published = new Set(SERVICE_AREAS.map((a) => a.name.replace(/,\s*(NY|ON)$/, '')));
  const allowed = new Set(['Greater Toronto Area', 'Ontario', 'Canada', 'New York', 'United States', 'Toronto', 'Toronto and the Greater Toronto Area', ...published]);
  it('every areaServed/spatialCoverage/containedInPlace name is a published area or a region wrapper', () => {
    const bad: string[] = [];
    for (const { path, all } of pages) {
      for (const n of all)
        for (const [o, at] of walk(n)) {
          for (const k of ['areaServed', 'spatialCoverage', 'contentLocation'] as const) {
            if (!(k in o)) continue;
            for (const place of ([] as Node[]).concat(o[k])) {
              for (const [pl, pat] of walk(place)) {
                if (typeof pl.name === 'string' && !allowed.has(pl.name.replace(/,\s*(NY|ON)$/, ''))) bad.push(`${path}${at}.${k}${pat}: ${pl.name}`);
              }
            }
          }
        }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('each /service-areas/<slug> page: WebPage + Service are about exactly that place, and offer only registry services', () => {
    const bad: string[] = [];
    for (const area of SERVICE_AREAS) {
      const p = pages.find((x) => x.path === `/service-areas/${area.slug}`);
      if (!p) {
        bad.push(`${area.slug}: not rendered`);
        continue;
      }
      const url = `${SITE_URL}/service-areas/${area.slug}`;
      const web = p.nodes.find((n) => n['@id'] === `${url}#webpage`);
      const svc = p.nodes.find((n) => n['@id'] === `${url}#service`);
      if (!web || !svc) {
        bad.push(`${area.slug}: missing WebPage/Service node`);
        continue;
      }
      const place = JSON.parse(JSON.stringify(placeForArea(area)));
      if (JSON.stringify(web.spatialCoverage) !== JSON.stringify(place)) bad.push(`${area.slug}: spatialCoverage differs from placeForArea`);
      if (JSON.stringify(svc.areaServed) !== JSON.stringify(place)) bad.push(`${area.slug}: Service.areaServed differs from placeForArea`);
      const offered = (svc.hasOfferCatalog?.itemListElement ?? []).map((i: Node) => i.itemOffered['@id']).sort();
      const expected = SERVICES.map((s) => `${SITE_URL}/services/${s.slug}#service`).sort();
      if (JSON.stringify(offered) !== JSON.stringify(expected)) bad.push(`${area.slug}: offer catalog is not the six registry services`);
      const crumbs = p.nodes.find((n) => n['@type'] === 'BreadcrumbList')?.itemListElement ?? [];
      if (crumbs.at(-1)?.item !== url) bad.push(`${area.slug}: breadcrumb leaf is not the page URL`);
    }
    expect(bad).toEqual([]);
  });

  it('the CITIES list is a subset of the published areas (the service pages claim only CITIES)', () => {
    const names = new Set(SERVICE_AREAS.map((a) => a.slug));
    expect(CITIES.filter((c) => !names.has(c.slug)).map((c) => c.slug)).toEqual([]);
  });
});

describe('page nodes are about the page they sit on', () => {
  const PAGE_TYPES = ['WebPage', 'AboutPage', 'ContactPage', 'CollectionPage', 'ImageGallery', 'TechArticle', 'DefinedTermSet', 'Dataset'];
  it('a page-typed node with a url names the sitemap URL of the page that emitted it', () => {
    const bad: string[] = [];
    for (const { path, nodes } of pages) {
      const own = `${SITE_URL}${path === '/' ? '' : path}`;
      for (const n of nodes) {
        if (!typesOf(n).some((t) => PAGE_TYPES.includes(t)) || typeof n.url !== 'string') continue;
        if (n.url.replace(/\/+$/, '') !== own) bad.push(`${path}: ${typesOf(n)} url ${n.url}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('every in-site URL inside the JSON-LD is on the canonical origin, and every BreadcrumbList ends at the page itself', () => {
    const bad: string[] = [];
    for (const { path, nodes } of pages) {
      for (const n of nodes) {
        const text = JSON.stringify(n);
        for (const m of text.matchAll(/https?:\/\/(?:www\.)?ecowoods\.[a-z]+[^"\\]*/g)) if (!m[0].startsWith(SITE_URL)) bad.push(`${path}: ${m[0]}`);
        if (n['@type'] === 'BreadcrumbList') {
          const leaf = n.itemListElement.at(-1)?.item as string | undefined;
          const own = `${SITE_URL}${path === '/' ? '' : path}`;
          if (path !== '/' && leaf && leaf.replace(/\/+$/, '') !== own) bad.push(`${path}: breadcrumb leaf ${leaf}`);
          const positions = n.itemListElement.map((i: Node) => i.position);
          if (JSON.stringify(positions) !== JSON.stringify(positions.map((_: number, i: number) => i + 1))) bad.push(`${path}: breadcrumb positions ${positions}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('NAP and derived facts', () => {
  it('any telephone/email in the page JSON-LD is the registry value, in schema or display form', () => {
    const phones = new Set([BUSINESS_NAP.phoneSchema, BUSINESS_NAP.phoneDisplay, BUSINESS_NAP.phoneE164]);
    const bad: string[] = [];
    for (const { path, nodes } of pages)
      for (const n of nodes)
        for (const [o, at] of walk(n)) {
          if ('telephone' in o && !phones.has(o.telephone)) bad.push(`${path}${at}: telephone ${o.telephone}`);
          if ('email' in o && o.email !== BUSINESS_NAP.email) bad.push(`${path}${at}: email ${o.email}`);
          if (o['@type'] === 'PostalAddress' && o.postalCode && o.postalCode !== BUSINESS_NAP.address.postalCode) bad.push(`${path}${at}: postalCode ${o.postalCode}`);
        }
    expect(bad).toEqual([]);
  });

  it('the layout organisation foundingDate is the registry year, never computed', () => {
    expect(layoutNodes[0]!.foundingDate).toBe(String(BUSINESS_NAP.foundedYear));
  });

  it('"since/established <founding year> — N years" text in any node uses the derived year count', () => {
    const bad: string[] = [];
    let seen = 0;
    const re = new RegExp(`(?:[Ss]ince|established)\\s+${BUSINESS_NAP.foundedYear}\\s+[—–-]\\s+(\\d+)\\s+years`, 'g');
    for (const { path, nodes } of pages) {
      for (const m of JSON.stringify(nodes).matchAll(re)) {
        seen++;
        if (Number(m[1]) !== yearsInBusiness()) bad.push(`${path}: ${m[0]} (now ${yearsInBusiness()})`);
      }
    }
    expect(seen).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });
});
