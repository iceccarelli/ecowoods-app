#!/usr/bin/env node
/**
 * scripts/geo-measure.mjs — GEO-000: measure the geography production actually
 * serves, as sets, and say where the sets disagree.
 *
 *   node scripts/geo-measure.mjs                                   # https://ecowoods.ca, print summary
 *   node scripts/geo-measure.mjs --write docs/GEO_MEASUREMENT_20260911.json
 *   node scripts/geo-measure.mjs --base http://127.0.0.1:3111 --json
 *
 * WHY THIS EXISTS
 *
 * The geography is emitted on at least fourteen surfaces — the markets,
 * locations, graph and corridors APIs, the sitemap, llms.txt, llms-full.txt,
 * ai.txt, the /service-areas index and its Markdown twin, /about, /team, the
 * organisation JSON-LD and every /service-areas/{slug} page. Every guard in
 * this repository reads the SOURCE. None of them reads what a crawler
 * receives, and at the GEO-000 baseline every guard was green while the
 * surfaces disagreed about which places are served (docs/GEO_CONTRADICTION_LOG.md).
 *
 * So this reads production, turns each surface into a SET of slugs, and
 * reports each set against every other. The global invariant the GEO series
 * works toward (docs/GEO_SOURCE_MAP.md §7) is that the published sets are
 * equal; this is the instrument that says whether they are.
 *
 * WHAT IT DOES NOT DO
 *
 *   · It does not decide anything. It measures and reports; `--strict` is the
 *     only mode that exits non-zero on a disagreement, and GEO-000 does not
 *     wire it into `pnpm verify` (it needs the network; see verify-all SKIP).
 *   · It does not trust a cached edge. Every request carries a cache-buster,
 *     and a short list of surfaces is ALSO fetched without one, so a stale edge
 *     response is recorded as what it is rather than mistaken for the build.
 *   · It does not render JavaScript. Everything it reads is in the HTML or the
 *     machine files as served.
 *
 * NETWORK POLICY — same as verify-production-agentic.mjs: a control probe runs
 * first; an unreachable host is reported and the script exits 2 without a
 * verdict. A proxy's 403 is not a broken site.
 *
 * Dependency-free. Node 18+.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : dflt;
};
const BASE = opt('--base', process.env.SITE_URL || 'https://ecowoods.ca').replace(/\/$/, '');
const WRITE = opt('--write', null);
const JSON_OUT = args.includes('--json');
const STRICT = args.includes('--strict');
const CONCURRENCY = Number(opt('--concurrency', '6'));
const UA = 'EcowoodsGeoMeasure/1.0 (+https://ecowoods.ca/corridors; GEO-000 measurement)';
const CB = `cb=${Date.now()}`;

/*
 * Entities the GEO protocol names explicitly. Probed whether or not any
 * surface mentions them, because "absent everywhere" is itself a measurement:
 * it is the difference between DISCOVERY_ONLY and a ghost URL.
 */
const TARGET_ENTITIES = [
  'toronto', 'pickering', 'ajax', 'whitby', 'oshawa', 'lakeview-park', 'clarington', 'bowmanville', 'kawartha-lakes',
  'oakville', 'burlington', 'hamilton', 'stoney-creek', 'grimsby', 'lincoln', 'beamsville', 'st-catharines', 'thorold',
  'welland', 'niagara-falls-on', 'niagara-falls', 'niagara-on-the-lake', 'fort-erie', 'port-colborne',
  'mississauga', 'milton', 'cambridge', 'kitchener', 'waterloo', 'waterloo-region', 'kitchener-waterloo', 'guelph',
  'brantford', 'paris', 'ayr', 'woodstock', 'buffalo', 'rochester-ny', 'niagara-falls-ny',
];

/* Surfaces fetched both with and without the cache-buster. */
const EDGE_PROBES = ['/team', '/about', '/corridors', '/service-areas', '/llms.txt', '/sitemap.xml', '/api/v1/markets'];

/* ── http ───────────────────────────────────────────────────────────────── */
const withCb = (p) => `${p}${p.includes('?') ? '&' : '?'}${CB}`;
const sha = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);

async function get(pathname, { bust = true, accept = '*/*' } = {}) {
  const url = `${BASE}${bust ? withCb(pathname) : pathname}`;
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA, accept } });
    const body = await res.text();
    return {
      path: pathname,
      busted: bust,
      status: res.status,
      final: res.url.replace(BASE, '').replace(/[?&]cb=\d+$/, '') || '/',
      bytes: body.length,
      fingerprint: sha(body),
      edge: {
        x_vercel_cache: res.headers.get('x-vercel-cache'),
        age: res.headers.get('age'),
        cache_control: res.headers.get('cache-control'),
      },
      body,
    };
  } catch (e) {
    return { path: pathname, busted: bust, status: 0, error: String(e instanceof Error ? e.message : e), body: '' };
  }
}

async function pool(items, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k]);
    }
  });
  await Promise.all(workers);
  return out;
}

const json = (r) => {
  try { return JSON.parse(r.body); } catch { return null; }
};
const strip = ({ body, ...rest }) => rest;

/* ── parsers ────────────────────────────────────────────────────────────── */
/* `(?<!\/app)`: the HTML also carries Next's own chunk paths, and
   "/_next/static/chunks/app/service-areas/page-1a2b3c.js" is not a service area.
   The first production run counted it as one (html_index_links 90 vs 89). */
const areaSlugsIn = (text) =>
  [...new Set([...text.matchAll(/(?<!\/app)\/service-areas\/([a-z0-9-]+?)(?:\.md)?(?=[\s"')<>\]#?,.]|$)/g)].map((m) => m[1]))].sort();
const corridorIdsIn = (text) =>
  [...new Set([...text.matchAll(/\/corridors\/([a-z0-9-]+)/g)].map((m) => m[1]))].sort();
const jsonLd = (html) => {
  const out = [];
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try { out.push(JSON.parse(m[1])); } catch { out.push({ __parseError: true }); }
  }
  return out;
};
const canonicalOf = (html) =>
  (html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/) || html.match(/<link[^>]*href="([^"]+)"[^>]*rel="canonical"/) || [])[1] ?? null;
const titleOf = (html) => (html.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1]?.trim() ?? null;
const h1Of = (html) => (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1]?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() ?? null;
const text = (html) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const nodesOf = (node, acc = []) => {
  if (Array.isArray(node)) node.forEach((n) => nodesOf(n, acc));
  else if (node && typeof node === 'object') {
    if (node['@type']) acc.push(node);
    if (node['@graph']) nodesOf(node['@graph'], acc);
  }
  return acc;
};
const placeChain = (p) => {
  const chain = [];
  let cur = p;
  while (cur && typeof cur === 'object' && chain.length < 6) {
    chain.push(`${Array.isArray(cur['@type']) ? cur['@type'].join('+') : cur['@type']}:${cur.name}`);
    cur = cur.containedInPlace;
  }
  return chain;
};

/* ── sets ───────────────────────────────────────────────────────────────── */
const diff = (a, b) => a.filter((x) => !b.includes(x));

async function main() {
  const control = await get('/robots.txt', { bust: false });
  if (control.status !== 200) {
    console.error(`✗ control probe ${BASE}/robots.txt → ${control.status || control.error}. Host unreachable from here; no verdict.`);
    process.exit(2);
  }

  const paths = {
    markets: '/api/v1/markets',
    locations: '/api/v1/locations',
    graph: '/api/v1/graph',
    corridors: '/api/v1/corridors',
    sitemap: '/sitemap.xml',
    llms: '/llms.txt',
    llms_full: '/llms-full.txt',
    ai: '/ai.txt',
    index_html: '/service-areas',
    index_md: '/service-areas.md',
    about: '/about',
    team: '/team',
    home: '/',
    corridors_html: '/corridors',
  };
  const fetched = Object.fromEntries(
    await pool(Object.entries(paths), async ([k, p]) => [k, await get(p)]),
  );

  const markets = json(fetched.markets) ?? {};
  const locations = json(fetched.locations) ?? {};
  const graph = json(fetched.graph) ?? {};
  const corridorsApi = json(fetched.corridors) ?? {};
  const locItems = (locations.items ?? []).map((l) => l.data ?? {});
  const bySlug = Object.fromEntries(locItems.map((l) => [l.slug, l]));
  const slugOfLocId = (id) => String(id ?? '').replace(/^location:/, '');

  const llmsBody = fetched.llms.body;
  const perArea = llmsBody.split('### Per-area routing')[1]?.split('\n### ')[0] ?? '';

  const homeOrg = nodesOf(jsonLd(fetched.home.body)).find((n) => String(n['@id'] ?? '').endsWith('/#organization'));
  const aboutText = text(fetched.about.body);
  const teamText = text(fetched.team.body);

  const sets = {
    markets_all: (markets.markets ?? []).map((m) => m.slug).sort(),
    markets_service_area: (markets.service_area ?? []).map((m) => m.slug).sort(),
    markets_has_page: (markets.markets ?? []).filter((m) => m.has_page).map((m) => m.slug).sort(),
    locations_published: locItems.filter((l) => l.coverage === 'published').map((l) => l.slug).sort(),
    locations_in_area_served: locItems.filter((l) => l.in_area_served).map((l) => l.slug).sort(),
    locations_assessment: locItems.filter((l) => l.coverage === 'assessment' && l.tier === 'municipality').map((l) => l.slug).sort(),
    graph_serves: (graph.edges ?? []).filter((e) => e.predicate === 'serves').map((e) => slugOfLocId(e.to)).sort(),
    sitemap_service_areas: areaSlugsIn(fetched.sitemap.body),
    llms_per_area: areaSlugsIn(perArea),
    llms_full_service_areas: areaSlugsIn(fetched.llms_full.body),
    ai_txt_service_areas: areaSlugsIn(fetched.ai.body),
    html_index_links: areaSlugsIn(fetched.index_html.body),
    md_index_links: areaSlugsIn(fetched.index_md.body),
    /* GEO-002: a corridor's `members` are municipalities, and the districts
       inside each are nested under it. Both levels are read here, because what
       this set answers is "which places does the corridor surface name". */
    corridor_members: [...new Set((corridorsApi.corridors ?? []).flatMap((c) =>
      (c.members ?? []).flatMap((m) => [m.slug, ...((m.districts ?? []).map((d) => d.slug))]),
    ))].sort(),
  };

  /* The invariant pivot: what the sitemap tells a crawler is a service-area page. */
  const PIVOT = 'sitemap_service_areas';
  const invariant = Object.fromEntries(
    Object.entries(sets)
      .filter(([k]) => !['markets_all', 'corridor_members', 'locations_assessment'].includes(k))
      .map(([k, v]) => [k, { size: v.length, missing_vs_sitemap: diff(sets[PIVOT], v), extra_vs_sitemap: diff(v, sets[PIVOT]) }]),
  );

  /* Per-entity probe: everything any surface names, plus the protocol's list. */
  const universe = [...new Set([
    ...sets.markets_all, ...sets.locations_published, ...sets.locations_assessment,
    ...sets.sitemap_service_areas, ...sets.graph_serves, ...TARGET_ENTITIES,
  ])].sort();

  const entities = await pool(universe, async (slug) => {
    const [html, md, api] = await Promise.all([
      get(`/service-areas/${slug}`),
      get(`/service-areas/${slug}.md`),
      get(`/api/v1/locations/${slug}`),
    ]);
    const nodes = html.status === 200 ? nodesOf(jsonLd(html.body)) : [];
    const page = nodes.find((n) => n['@type'] === 'WebPage');
    const loc = json(api)?.data ?? json(api)?.item?.data ?? null;
    const mk = (markets.markets ?? []).find((m) => m.slug === slug) ?? null;
    return {
      slug,
      market: mk ? { country: mk.country, region: mk.region, kind: mk.kind, part_of: mk.part_of, status: mk.status, verified_at: mk.verified_at, has_page: mk.has_page } : null,
      in_markets_service_area: sets.markets_service_area.includes(slug),
      html: { status: html.status, canonical: canonicalOf(html.body), title: titleOf(html.body), h1: h1Of(html.body) },
      md: { status: md.status },
      api_location: { status: api.status, coverage: loc?.coverage ?? bySlug[slug]?.coverage ?? null, tier: loc?.tier ?? bySlug[slug]?.tier ?? null, parent: slugOfLocId(loc?.parent_id ?? bySlug[slug]?.parent_id) || null, in_area_served: loc?.in_area_served ?? bySlug[slug]?.in_area_served ?? null },
      sitemap: sets.sitemap_service_areas.includes(slug),
      graph_serves: sets.graph_serves.includes(slug),
      llms: sets.llms_per_area.includes(slug),
      jsonld_spatial: page?.spatialCoverage ? placeChain(page.spatialCoverage) : null,
    };
  });

  /* Machine-detectable contradictions. Semantic ones are in the log; these are the mechanical subset. */
  const contradictions = [];
  const add = (id, slug, detail) => contradictions.push({ id, slug, detail });
  for (const e of entities) {
    /* A region node (Toronto) is served through the published areas inside it
       — its districts and neighbourhoods — and has no page of its own by
       design (docs/GEO_SOURCE_MAP.md §7). Anything else without a page is a
       coverage claim with nothing behind it. */
    if (e.in_markets_service_area && e.html.status !== 200 && e.api_location.coverage !== 'region') add('SERVICE_AREA_WITHOUT_PAGE', e.slug, `markets.service_area lists it; /service-areas/${e.slug} → ${e.html.status}`);
    if (e.in_markets_service_area && e.api_location.coverage === 'assessment') add('SERVICE_AREA_VS_ASSESSMENT', e.slug, 'markets.service_area lists it; locations says coverage=assessment ("do not present as covered")');
    /* in_area_served is defined as "the organisation's JSON-LD lists this place
       as a City" (lib/registry/types.ts), so a district or neighbourhood with a
       page is correctly false. What must agree is a MUNICIPALITY: served in the
       markets API ⇔ a City in the JSON-LD. */
    if (e.market?.kind === 'municipality' && e.in_markets_service_area !== (e.api_location.in_area_served === true)) add('SERVICE_AREA_VS_IN_AREA_SERVED', e.slug, `markets.service_area=${e.in_markets_service_area}, locations.in_area_served=${e.api_location.in_area_served}`);
    if (e.sitemap && e.html.status !== 200) add('SITEMAP_GHOST', e.slug, `in sitemap, HTML → ${e.html.status}`);
    if (e.html.status === 200 && !e.sitemap) add('PAGE_NOT_IN_SITEMAP', e.slug, 'HTML 200, absent from sitemap');
    if (e.html.status === 200 && e.md.status !== 200) add('MISSING_MD_TWIN', e.slug, `.md → ${e.md.status}`);
    if (e.html.status === 200 && e.html.canonical && !e.html.canonical.endsWith(`/service-areas/${e.slug}`)) add('CANONICAL_MISMATCH', e.slug, e.html.canonical);
    if (e.market?.country === 'US' && ['gta', 'southern-ontario', 'ontario', 'canada'].includes(e.api_location.parent)) add('US_UNDER_CANADIAN_PARENT', e.slug, `locations parent=${e.api_location.parent}`);
    if (e.market?.kind === 'district' && e.jsonld_spatial?.[0]?.startsWith('City:')) add('DISTRICT_AS_CITY', e.slug, e.jsonld_spatial.join(' ⊂ '));
    if (e.market?.country === 'CA' && e.jsonld_spatial?.length === 1) add('NO_REGION_IN_PLACE', e.slug, e.jsonld_spatial.join(''));
  }

  const edge = await pool(EDGE_PROBES, async (p) => {
    const [plain, busted] = await Promise.all([get(p, { bust: false }), get(p, { bust: true })]);
    return {
      path: p,
      plain: strip(plain),
      busted: strip(busted),
      stale_suspected: plain.status !== busted.status || plain.fingerprint !== busted.fingerprint,
    };
  });

  const counts = {
    about_areas: Number((aboutText.match(/(\d+) areas across/) || [])[1] ?? NaN) || null,
    about_region_label: (aboutText.match(/\d+ areas across ([^:]+):/) || [])[1]?.trim() ?? null,
    team_municipalities_and_neighbourhoods: Number((teamText.match(/(\d+) municipalities and neighbourhoods/) || [])[1] ?? NaN) || null,
    llms_serving_line: (llmsBody.match(/^- Serving: .*$/m) || [])[0] ?? null,
    llms_says_outside_gta_not_published: /outside the GTA are assessed per project/.test(llmsBody),
    md_index_says_elsewhere_not_published: /Projects elsewhere in Southern Ontario are assessed per project/.test(fetched.index_md.body),
    org_jsonld_areaServed: (homeOrg?.areaServed ?? []).map((a) => placeChain(a).join(' ⊂ ')),
    sitemap_corridor_ids: corridorIdsIn(fetched.sitemap.body),
  };

  const result = {
    measured_at: new Date().toISOString(),
    base: BASE,
    tool: 'scripts/geo-measure.mjs',
    method: 'live HTTP GET with a per-run cache-buster; sets parsed from the served bytes; no JavaScript executed',
    surfaces: Object.fromEntries(Object.entries(fetched).map(([k, r]) => [k, strip(r)])),
    sets,
    set_sizes: Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v.length])),
    invariant_vs_sitemap: invariant,
    counts,
    edge_staleness: edge,
    entities,
    contradictions,
  };

  if (WRITE) {
    const file = path.resolve(WRITE);
    let doc = {};
    if (fs.existsSync(file)) {
      try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { doc = {}; }
    }
    doc.production = result;
    fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`);
  }

  if (JSON_OUT) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    console.log(`\nGEO MEASUREMENT — ${BASE} — ${result.measured_at}\n`);
    for (const [k, v] of Object.entries(result.set_sizes)) console.log(`  ${k.padEnd(26)} ${String(v).padStart(4)}`);
    console.log(`\n  about: ${counts.about_areas} areas across "${counts.about_region_label}"  ·  team: ${counts.team_municipalities_and_neighbourhoods}`);
    const stale = edge.filter((e) => e.stale_suspected);
    console.log(`  edge: ${stale.length} of ${edge.length} probed surfaces differ with/without cache-buster${stale.length ? ` (${stale.map((s) => s.path).join(', ')})` : ''}`);
    const byId = contradictions.reduce((a, c) => ((a[c.id] = (a[c.id] || 0) + 1), a), {});
    console.log(`\n  contradictions: ${contradictions.length}`);
    for (const [id, n] of Object.entries(byId)) console.log(`    ${id.padEnd(30)} ${n}`);
    if (WRITE) console.log(`\n  written: ${WRITE} (key "production"; other keys preserved)`);
    console.log('');
  }
  if (STRICT && contradictions.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
