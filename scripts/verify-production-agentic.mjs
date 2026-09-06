#!/usr/bin/env node
/**
 * scripts/verify-production-agentic.mjs — Stage 45: live production verification
 * of the machine surfaces and the agentic primitives.
 *
 *   node scripts/verify-production-agentic.mjs                      # https://ecowoods.ca
 *   node scripts/verify-production-agentic.mjs --base http://127.0.0.1:3123 --strict
 *   node scripts/verify-production-agentic.mjs --json > audit/production-probe.json
 *
 * WHY THIS EXISTS
 *
 * Fifty guards read the repository. The registry, the API, the markdown twins
 * and llms.txt are projections of the same constants, and the in-process
 * drift suite proves they agree — in the build. This is the check that reads
 * what a browser, a crawler or an agent actually RECEIVES from the deployed
 * host, and compares it with the constants in the repository:
 *
 *   · every machine file and every /api/v1 primitive answers 200 with the
 *     right content-type, an ETag, and 304 on If-None-Match;
 *   · every P0 HTML page self-canonicalises, carries the organisation node
 *     with the constants' NAP, and advertises its markdown twin in <head> and
 *     in a Link header;
 *   · /api/v1/entity, /llms.txt, /index.md and /pricing.md state the same
 *     phone, address, founding year and price bands as
 *     packages/shared/constants and content/constants/pricing.ts;
 *   · robots.txt allows /api/v1/ and llms.txt; no surface names a preview host.
 *
 * NETWORK POLICY — the same as scripts/crawl-site.mjs: a control probe runs
 * first. If the host is unreachable from this machine, the script reports that
 * and exits 0 (or 2 with --strict) rather than inventing a verdict. A proxy's
 * 403 is not a broken site.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : dflt;
};
const BASE = opt('--base', process.env.SITE_URL || 'https://ecowoods.ca').replace(/\/$/, '');
const STRICT = args.includes('--strict');
const JSON_OUT = args.includes('--json');
const UA = 'EcowoodsProductionProbe/1.0 (+https://ecowoods.ca/authority; Stage 45 verification)';

/* ── constants, parsed from the repository as text (no TS import) ───────── */
const constantsSrc = fs.readFileSync(path.join(ROOT, 'packages/shared/constants/index.ts'), 'utf8');
const pricingSrc = fs.readFileSync(path.join(ROOT, 'apps/web/content/constants/pricing.ts'), 'utf8');
const pick = (src, key) => (src.match(new RegExp(`\\b${key}:\\s*'([^']+)'`)) || [])[1];
const pickNum = (src, key) => Number((src.match(new RegExp(`\\b${key}:\\s*([0-9.]+)`)) || [])[1]);
const FACTS = {
  legalName: pick(constantsSrc, 'legalName'),
  phoneDisplay: pick(constantsSrc, 'phoneDisplay'),
  phoneE164: pick(constantsSrc, 'phoneE164'),
  email: pick(constantsSrc, 'email'),
  street: pick(constantsSrc, 'streetAddress'),
  postal: pick(constantsSrc, 'postalCode'),
  founded: pickNum(constantsSrc, 'foundedYear'),
};
const bands = [];
for (const block of pricingSrc.split(/export const /).slice(1)) {
  const label = pick(block, 'label');
  const min = pickNum(block, 'min');
  const max = pickNum(block, 'max');
  if (label && Number.isFinite(min) && Number.isFinite(max) && /PriceBand = \{/.test(block)) bands.push({ label, min, max, text: `$${min.toFixed(2)}–$${max.toFixed(2)}` });
}
for (const [k, v] of Object.entries(FACTS)) if (v === undefined || Number.isNaN(v)) { console.error(`✗ could not parse ${k} from constants`); process.exit(1); }
if (bands.length !== 3) { console.error(`✗ expected 3 price bands in pricing.ts, parsed ${bands.length}`); process.exit(1); }

/* ── probe helpers ──────────────────────────────────────────────────────── */
const results = [];
const failures = [];
const fail = (url, what) => failures.push(`${url} — ${what}`);

async function get(pathname, extraHeaders = {}) {
  const url = `${BASE}${pathname}`;
  const t0 = Date.now();
  const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA, accept: '*/*', ...extraHeaders } });
  const body = await res.text();
  const ms = Date.now() - t0;
  const rec = {
    url: pathname,
    status: res.status,
    final: res.url.replace(BASE, '') || '/',
    ms,
    bytes: body.length,
    contentType: res.headers.get('content-type') || '',
    etag: res.headers.get('etag') || null,
    cacheControl: res.headers.get('cache-control') || null,
    link: res.headers.get('link') || null,
    xRobots: res.headers.get('x-robots-tag') || null,
  };
  results.push(rec);
  return { res, body, rec };
}

const parseJsonLd = (html) => {
  const out = [];
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try { out.push(JSON.parse(m[1])); } catch { out.push({ __parseError: true }); }
  }
  return out;
};
const canonicalOf = (html) => (html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/) || html.match(/<link[^>]*href="([^"]+)"[^>]*rel="canonical"/) || [])[1];
const altMarkdown = (html) => (html.match(/<link[^>]*rel="alternate"[^>]*type="text\/markdown"[^>]*href="([^"]+)"/) || html.match(/<link[^>]*type="text\/markdown"[^>]*href="([^"]+)"/) || [])[1];
const walkTypes = (node, acc = []) => {
  if (Array.isArray(node)) node.forEach((n) => walkTypes(n, acc));
  else if (node && typeof node === 'object') {
    if (node['@type']) acc.push({ type: node['@type'], id: node['@id'], node });
    if (node['@graph']) walkTypes(node['@graph'], acc);
  }
  return acc;
};

/* ── the matrix ─────────────────────────────────────────────────────────── */
const P0_HTML = ['/', '/about', '/services', '/services/floor-refinishing', '/services/hardwood-installation', '/pricing', '/service-areas', '/service-areas/etobicoke', '/estimate', '/contact', '/reviews', '/hardwood-flooring-toronto'];
const MD = ['/index.md', '/about.md', '/services.md', '/services/floor-refinishing.md', '/pricing.md', '/service-areas.md', '/service-areas/etobicoke.md', '/estimate.md', '/contact.md', '/reviews.md', '/hardwood-flooring-toronto.md', '/md'];
const API = ['/api/v1', '/api/v1/entity', '/api/v1/services', '/api/v1/services/floor-refinishing', '/api/v1/locations', '/api/v1/locations/etobicoke', '/api/v1/pricing', '/api/v1/reviews', '/api/v1/evidence', '/api/v1/sources', '/api/v1/faq', '/api/v1/pages', '/api/v1/actions', '/api/v1/graph', '/api/v1/manifest', '/api/v1/changes', '/api/v1/citations', '/api/v1/citations/hardwood-floor-refinishing', '/api/v1/openapi.json', '/api/v1/service-match?project=refinish%20old%20oak&location=Etobicoke&sqft=800', '/api/v1/recommendation-context?query=who%20refinishes%20hardwood%20floors%20in%20Etobicoke'];
const LEGACY = ['/robots.txt', '/sitemap.xml', '/llms.txt', '/llms-full.txt', '/ai.txt', '/feed.xml', '/api/knowledge?collection=pricing', '/api/health', '/api/market', '/api/estimate'];

async function main() {
  // Control probe.
  try {
    const r = await fetch(`${BASE}/robots.txt`, { headers: { 'user-agent': UA } });
    if (!r.ok) throw new Error(`status ${r.status}`);
  } catch (e) {
    const msg = `control probe ${BASE}/robots.txt failed: ${e instanceof Error ? e.message : e}`;
    if (STRICT) { console.error(`✗ ${msg}`); process.exit(2); }
    console.log(`· ${msg} — host unreachable from here; no verdict.`);
    process.exit(0);
  }

  // Machine files.
  const robots = await get('/robots.txt');
  if (!/text\/plain/.test(robots.rec.contentType)) fail('/robots.txt', `content-type ${robots.rec.contentType}`);
  for (const p of ['/llms.txt', '/llms-full.txt', '/md/', '/api/v1/', '/api/knowledge']) if (!robots.body.includes(`Allow: ${p}`)) fail('/robots.txt', `missing Allow: ${p}`);
  if (!/Sitemap: https?:\/\/[^\s]+\/sitemap\.xml/.test(robots.body)) fail('/robots.txt', 'no Sitemap line');

  const sitemap = await get('/sitemap.xml');
  if (!/xml/.test(sitemap.rec.contentType)) fail('/sitemap.xml', `content-type ${sitemap.rec.contentType}`);
  const locs = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => !/\.(png|jpg|jpeg|webp|svg)$/i.test(u));
  if (locs.length < 50) fail('/sitemap.xml', `only ${locs.length} <loc>`);
  for (const u of locs) if (!u.startsWith(BASE.replace('http://127.0.0.1', 'http://127.0.0.1')) && !u.startsWith('https://ecowoods.ca')) fail('/sitemap.xml', `off-canonical loc ${u}`);
  for (const p of ['/pricing', '/estimate', '/contact', '/services/floor-refinishing', '/service-areas/etobicoke']) if (!locs.some((u) => u.endsWith(p))) fail('/sitemap.xml', `missing ${p}`);
  if (/vercel\.app|ecowoodshardwood\.com/.test(sitemap.body)) fail('/sitemap.xml', 'preview or old host present');

  const llms = await get('/llms.txt');
  if (!llms.body.startsWith(`# ${FACTS.legalName}`)) fail('/llms.txt', 'H1 is not the legal name');
  if (!llms.body.split('\n').slice(0, 10).some((l) => l.startsWith('> '))) fail('/llms.txt', 'no blockquote summary');
  for (const [k, v] of [['phone', FACTS.phoneDisplay], ['street', FACTS.street], ['postal', FACTS.postal], ['founded', String(FACTS.founded)], ['email', FACTS.email]]) if (!llms.body.includes(v)) fail('/llms.txt', `missing ${k} ${v}`);
  for (const b of bands) if (!llms.body.includes(b.text)) fail('/llms.txt', `missing band ${b.label} ${b.text}`);
  if (!llms.body.includes('## Optional')) fail('/llms.txt', 'no ## Optional section');
  if (/vercel\.app|https?:\/\/(www\.)?ecowoodshardwood\.com/.test(llms.body)) fail('/llms.txt', 'preview or old host linked');
  // Every linked URL must resolve (sample up to 40 distinct).
  const linked = [...new Set([...llms.body.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((m) => m[1]))].slice(0, 40);
  for (const u of linked) {
    const rel = u.replace(/^https?:\/\/[^/]+/, '') || '/';
    try {
      const r = await fetch(`${BASE}${rel}`, { method: 'GET', headers: { 'user-agent': UA } });
      if (r.status !== 200) fail('/llms.txt', `linked ${rel} → ${r.status}`);
    } catch (e) { fail('/llms.txt', `linked ${rel} unreachable`); }
  }

  for (const p of LEGACY.slice(3)) {
    const { rec } = await get(p);
    // /api/health reports the upstream (Bank of Canada) state in its status
    // code by design: 503 means the upstream is down or unreachable from here,
    // not that the site is. Anything else must be 200.
    if (p === '/api/health' ? ![200, 503].includes(rec.status) : rec.status !== 200) fail(p, `status ${rec.status}`);
  }

  // Markdown twins.
  for (const p of MD) {
    const { rec, body } = await get(p);
    if (rec.status !== 200) { fail(p, `status ${rec.status}`); continue; }
    if (!/text\/markdown/.test(rec.contentType)) fail(p, `content-type ${rec.contentType}`);
    if (!body.trim().startsWith('#')) fail(p, 'does not start with a heading');
    if (/vercel\.app|https?:\/\/(www\.)?ecowoodshardwood\.com/.test(body)) fail(p, 'preview or old host');
  }
  const homeMd = await get('/index.md');
  for (const b of bands) if (!homeMd.body.includes(b.text)) fail('/index.md', `missing band ${b.text}`);
  if (!homeMd.body.includes(FACTS.phoneDisplay)) fail('/index.md', 'missing phone');
  const pricingMd = await get('/pricing.md');
  for (const b of bands) if (!pricingMd.body.includes(b.text)) fail('/pricing.md', `missing band ${b.text}`);

  // P0 HTML pages.
  for (const p of P0_HTML) {
    const { rec, body } = await get(p);
    if (rec.status !== 200) { fail(p, `status ${rec.status}`); continue; }
    if (!/text\/html/.test(rec.contentType)) fail(p, `content-type ${rec.contentType}`);
    const canonical = canonicalOf(body);
    const expected = p === '/' ? [BASE, `${BASE}/`, 'https://ecowoods.ca', 'https://ecowoods.ca/'] : [`${BASE}${p}`, `https://ecowoods.ca${p}`];
    if (!canonical || !expected.includes(canonical)) fail(p, `canonical ${canonical}`);
    const md = altMarkdown(body);
    if (!md) fail(p, 'no <link rel="alternate" type="text/markdown">');
    if (!rec.link || !/text\/markdown/.test(rec.link)) fail(p, 'no Link: rel=alternate text/markdown header');
    const ld = parseJsonLd(body);
    if (ld.some((x) => x.__parseError)) fail(p, 'JSON-LD parse error');
    const nodes = walkTypes(ld);
    const org = nodes.find((n) => n.id === 'https://ecowoods.ca/#organization' || n.id === `${BASE}/#organization`);
    if (!org) fail(p, 'no organisation node');
    else {
      const o = org.node;
      if (o.legalName !== FACTS.legalName) fail(p, `JSON-LD legalName ${o.legalName}`);
      if ((o.telephone || '').replace(/\D/g, '') !== FACTS.phoneE164.replace(/\D/g, '')) fail(p, `JSON-LD telephone ${o.telephone}`);
      if (o.address?.postalCode !== FACTS.postal) fail(p, `JSON-LD postalCode ${o.address?.postalCode}`);
      if (String(o.foundingDate) !== String(FACTS.founded)) fail(p, `JSON-LD foundingDate ${o.foundingDate}`);
      if (JSON.stringify(o).includes('aggregateRating')) fail(p, 'self-serving aggregateRating');
      const actions = Array.isArray(o.potentialAction) ? o.potentialAction : [];
      if (!actions.some((a) => a['@type'] === 'QuoteAction' && /\/estimate$/.test(a.target?.urlTemplate || ''))) fail(p, 'no QuoteAction → /estimate');
      if (!actions.some((a) => a['@type'] === 'CommunicateAction' && (a.target?.urlTemplate || '').replace(/\D/g, '') === FACTS.phoneE164.replace(/\D/g, ''))) fail(p, 'no CommunicateAction → tel');
    }
    const dupBiz = nodes.filter((n) => (Array.isArray(n.type) ? n.type : [n.type]).some((t) => /LocalBusiness|ProfessionalService|HomeAndConstructionBusiness/.test(String(t))));
    if (dupBiz.length > 1) fail(p, `${dupBiz.length} business entities in JSON-LD (expected 1)`);
    if (!body.includes(FACTS.phoneDisplay) && !body.includes(FACTS.phoneE164)) fail(p, 'phone not in HTML');
    if (/https?:\/\/[a-z0-9-]+\.vercel\.app/.test(body)) fail(p, 'preview host in HTML');
  }

  // /api/v1 primitives.
  for (const p of API) {
    const { rec, body, res } = await get(p);
    if (rec.status !== 200) { fail(p, `status ${rec.status}`); continue; }
    if (!/application\/json/.test(rec.contentType)) fail(p, `content-type ${rec.contentType}`);
    if (!rec.etag) fail(p, 'no ETag');
    let json;
    try { json = JSON.parse(body); } catch { fail(p, 'invalid JSON'); continue; }
    if (res.headers.get('access-control-allow-origin') !== '*') fail(p, 'CORS not open');
    if (rec.etag && !p.includes('?')) {
      const again = await fetch(`${BASE}${p}`, { headers: { 'user-agent': UA, 'if-none-match': rec.etag } });
      if (again.status !== 304 && again.status !== 200) fail(p, `If-None-Match → ${again.status}`);
      if (again.status === 200 && (again.headers.get('etag') || '') === rec.etag) fail(p, 'If-None-Match matched but 200 returned (304 expected)');
    }
    if (p === '/api/v1/entity') {
      const d = json.data || {};
      if (d.legal_name !== FACTS.legalName) fail(p, `legal_name ${d.legal_name}`);
      if (d.telephone_e164 !== FACTS.phoneE164) fail(p, `telephone ${d.telephone_e164}`);
      if (d.address?.postal_code !== FACTS.postal) fail(p, `postal ${d.address?.postal_code}`);
      if (d.founded_year !== FACTS.founded) fail(p, `founded ${d.founded_year}`);
      if (d.email !== FACTS.email) fail(p, `email ${d.email}`);
    }
    if (p === '/api/v1/pricing') {
      for (const b of bands) if (!(json.items || []).some((i) => i.data?.min === b.min && i.data?.max === b.max)) fail(p, `band ${b.label} ${b.text} missing`);
    }
    if (p === '/api/v1/manifest') {
      for (const e of json.api?.endpoints || []) if (!String(e.url).startsWith('https://ecowoods.ca/api/v1') && !String(e.url).startsWith(`${BASE}/api/v1`)) fail(p, `endpoint off-canonical ${e.url}`);
    }
    if (p.startsWith('/api/v1/service-match?')) {
      if (json.primary_service?.id !== 'service:floor-refinishing') fail(p, `primary ${json.primary_service?.id}`);
      if (json.location?.id !== 'location:etobicoke') fail(p, `location ${json.location?.id}`);
      if (json.pricing_context?.is_quote !== false) fail(p, 'pricing context is not flagged is_quote:false');
    }
    if (p === '/api/v1/openapi.json' && json.openapi !== '3.1.0') fail(p, `openapi ${json.openapi}`);
    if (/vercel\.app|ecowoodshardwood\.com/.test(body)) fail(p, 'preview or old host in payload');
  }

  // Negative: unknown id → 404 JSON, never 500.
  const nf = await get('/api/v1/services/does-not-exist');
  if (nf.rec.status !== 404) fail('/api/v1/services/does-not-exist', `status ${nf.rec.status}`);

  /* ── report ───────────────────────────────────────────────────────────── */
  const summary = { base: BASE, probedAt: new Date().toISOString(), probes: results.length, failures, results };
  if (JSON_OUT) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    for (const r of results) console.log(`${String(r.status).padStart(3)} ${r.ms.toString().padStart(5)}ms ${(r.contentType.split(';')[0] || '-').padEnd(24)} etag=${r.etag ? 'Y' : 'N'} link=${r.link ? 'Y' : 'N'} ${r.url}`);
    console.log('');
    if (failures.length) {
      console.log(`✗ ${failures.length} production problem(s):`);
      for (const f of failures) console.log(`  · ${f}`);
    } else {
      console.log(`✓ production verified — ${results.length} probes against ${BASE}: machine files, ${MD.length} markdown twins, ${P0_HTML.length} P0 pages, ${API.length} /api/v1 primitives; NAP, founding year and ${bands.length} price bands identical to the repository constants.`);
    }
  }
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => { console.error(`✗ probe crashed: ${e instanceof Error ? e.stack : e}`); process.exit(1); });
