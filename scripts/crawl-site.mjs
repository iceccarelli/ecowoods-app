#!/usr/bin/env node
/**
 * scripts/crawl-site.mjs — what a crawler actually receives.
 *
 * WRITES: audit/site-crawl.json, audit/site-crawl.csv, audit/site-crawl.md
 *
 *   node scripts/crawl-site.mjs
 *   node scripts/crawl-site.mjs --base https://ecowoods-preview.vercel.app
 *   node scripts/crawl-site.mjs --strict     (an unreachable site is a failure)
 *
 * WHY THIS EXISTS ALONGSIDE audit-current-state.mjs
 *
 * That script reads the repository and is right about the source. This one
 * fetches the deployed site and is right about production. They answer
 * different questions and the gap between them is where the interesting bugs
 * live — a canonical that is correct in the file and absent in the response, a
 * route that redirects in Vercel's config and 404s in reality, a machine
 * surface that returns 200 with an empty body.
 *
 * THE CONTROL PROBE, AND WHY IT IS NOT OPTIONAL
 *
 * This repository has recorded five findings (F-117, F-149, F-166, F-177,
 * F-192) with one shape: a check reported a result it had not measured. The
 * specific mechanism here is that sandboxed CI environments answer every
 * non-allowlisted host with 403, so a crawler run in one reports a completely
 * dead site with total confidence — and the natural response is to go and
 * "fix" a site that was never broken. A false FAIL on a migration is worse
 * than no check at all.
 *
 * So the first request is to a URL that MUST work. If it does not, this script
 * says it cannot tell and exits 0 rather than inventing a verdict. `--strict`
 * is for a machine with known-open egress, where unreachable really is a
 * failure.
 *
 * WHAT IS CHECKED PER URL
 *
 *   status, redirect chain length and final destination
 *   <title>, the first <h1>, and the count of <h1>s
 *   <link rel="canonical"> and whether it matches the requested URL
 *   meta robots
 *   every JSON-LD block, parsed, with its @type(s)
 *   response bytes and whether the body is suspiciously empty
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const BASE = (arg('--base', 'https://ecowoods.ca')).replace(/\/$/, '');
const STRICT = argv.includes('--strict');
const OUT_DIR = join(ROOT, 'audit');

/* ── the URL list, derived from the repo rather than discovered by crawling ──
 *
 * Discovery-by-following-links can only find pages that are linked, and a page
 * that is NOT linked is exactly the thing worth finding. So the list comes from
 * the sitemap source and the alias table, and orphans show up as URLs nothing
 * links to rather than as URLs that were never visited.
 */
const read = (p) => { try { return readFileSync(join(ROOT, p), 'utf8'); } catch { return ''; } };

const STATIC_PATHS = [
  '/', '/about', '/services', '/service-areas', '/framework', '/framework/assess',
  '/guides', '/papers', '/glossary', '/case-studies', '/blog', '/reviews', '/press',
  '/team', '/authority', '/resources', '/technical-library', '/library', '/data',
  '/market', '/standards', '/whats-new', '/r',
  '/hardwood-flooring-toronto', '/hardwood-floor-refinishing-toronto',
  '/hardwood-stairs-toronto',
];
const MACHINE_PATHS = [
  '/robots.txt', '/sitemap.xml', '/llms.txt', '/llms-full.txt', '/ai.txt',
  '/feed.xml', '/api/knowledge', '/api/estimate', '/api/health',
];

let aliasPaths = [];
try {
  aliasPaths = Object.keys(JSON.parse(read('apps/web/content/search/route-aliases.json')).aliases);
} catch { /* pre-change tree */ }

const slugsIn = (f, re = /slug:\s*'([a-z0-9-]+)'/g) => [...read(f).matchAll(re)].map((m) => m[1]);
const dynamicPaths = [
  ...slugsIn('apps/web/lib/guides.ts').map((s) => `/guides/${s}`),
  ...slugsIn('apps/web/lib/papers.ts').map((s) => `/papers/${s}`),
  ...slugsIn('apps/web/lib/service-pages.ts').map((s) => `/services/${s}`),
];

const targets = [
  ...STATIC_PATHS.map((p) => ({ path: p, kind: 'page' })),
  ...dynamicPaths.map((p) => ({ path: p, kind: 'page' })),
  ...MACHINE_PATHS.map((p) => ({ path: p, kind: 'machine' })),
  ...aliasPaths.map((p) => ({ path: p, kind: 'alias' })),
];

/* ── fetch with a manual redirect walk, so the chain is visible ───────────── */
async function probe(url, maxHops = 5) {
  const chain = [];
  let current = url;
  for (let hop = 0; hop <= maxHops; hop++) {
    let r;
    try {
      r = await fetch(current, { redirect: 'manual', headers: { 'user-agent': 'ecowoods-crawl/1.0' } });
    } catch (e) {
      return { error: String(e).slice(0, 120), chain };
    }
    const loc = r.headers.get('location');
    chain.push({ url: current, status: r.status, location: loc });
    if (r.status >= 300 && r.status < 400 && loc) {
      current = new URL(loc, current).toString();
      continue;
    }
    const body = await r.text();
    return { chain, finalUrl: current, status: r.status, contentType: r.headers.get('content-type'), body };
  }
  return { chain, error: `more than ${maxHops} redirect hops` };
}

const text = (re, s) => { const m = s.match(re); return m ? m[1].replace(/\s+/g, ' ').trim() : null; };

function analyse(t, res) {
  const out = {
    path: t.path, kind: t.kind, url: `${BASE}${t.path}`,
    status: res.status ?? null,
    error: res.error ?? null,
    hops: Math.max(0, res.chain.length - 1),
    finalUrl: res.finalUrl ?? null,
    contentType: res.contentType ?? null,
    bytes: res.body?.length ?? 0,
  };
  if (!res.body) return out;

  if (t.kind === 'alias') {
    /* An alias is correct when it is ONE permanent hop to the canonical.
       308 and 301 both consolidate; 302 and 307 tell a crawler to keep the
       variant indexed, which is the whole thing this is meant to prevent. */
    const first = res.chain[0];
    out.redirect = {
      status: first?.status ?? null,
      permanent: first?.status === 301 || first?.status === 308,
      oneHop: out.hops === 1,
      to: first?.location ?? null,
    };
    return out;
  }

  if (t.kind === 'machine') {
    /* "Empty" means different things for JSON and for text, and using one byte
       threshold for both is how a healthy 43-byte API response gets reported as
       broken. A JSON surface is empty when it has no top-level collections; a
       text surface is empty when there is nothing in it to read. */
    if (out.contentType?.includes('json')) {
      try {
        const parsed = JSON.parse(res.body);
        out.jsonKeys = Object.keys(parsed).slice(0, 20);
        out.empty = out.jsonKeys.length === 0;
      } catch {
        out.jsonParseError = true;
        out.empty = true;
      }
    } else {
      out.empty = out.bytes < 200;
    }
    return out;
  }

  out.title = text(/<title[^>]*>([\s\S]*?)<\/title>/i, res.body);
  out.h1Count = (res.body.match(/<h1[\s>]/gi) || []).length;
  out.h1 = text(/<h1[^>]*>([\s\S]*?)<\/h1>/i, res.body)?.replace(/<[^>]+>/g, '') ?? null;
  out.canonical = text(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i, res.body)
    ?? text(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i, res.body);
  out.canonicalMatchesSelf = out.canonical ? out.canonical.replace(/\/$/, '') === out.url.replace(/\/$/, '') : null;
  out.metaRobots = text(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i, res.body);

  out.jsonLd = [...res.body.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => {
      try {
        const parsed = JSON.parse(m[1]);
        const nodes = parsed['@graph'] ?? [parsed];
        return nodes.flatMap((n) => (Array.isArray(n['@type']) ? n['@type'] : [n['@type']])).filter(Boolean);
      } catch { return ['(unparseable)']; }
    })
    .flat();
  return out;
}

/* ── control probe ───────────────────────────────────────────────────────── */
console.log('');
console.log(`SITE CRAWL — ${BASE}`);
console.log('');

const control = await probe(`${BASE}/`);
const controlBad = control.error || control.status === 403 || (control.status ?? 500) >= 500;
if (controlBad && !STRICT) {
  console.log(
    `· Cannot reach ${BASE}/ from here (${control.error ?? `HTTP ${control.status}`}).\n` +
      `\n` +
      `  Without a working control this cannot tell a broken site from a blocked network,\n` +
      `  so it is not going to claim either. Sandboxed environments answer every\n` +
      `  non-allowlisted host with 403, and a false FAIL on a live site is worse than no\n` +
      `  check — the natural response is to go and fix something that was never broken.\n` +
      `\n` +
      `  Run it from a machine with open egress — a Codespace or a laptop:\n` +
      `\n` +
      `      node scripts/crawl-site.mjs\n`,
  );
  process.exit(0);
}
if (controlBad && STRICT) {
  console.error(`\n✗ --strict: ${BASE}/ unreachable (${control.error ?? control.status}).\n`);
  process.exit(1);
}
console.log(`  control ${BASE}/ answered ${control.status} — network is usable`);
console.log('');

/* ── crawl, gently ───────────────────────────────────────────────────────── */
const rows = [];
for (const t of targets) {
  const res = await probe(`${BASE}${t.path}`);
  const row = analyse(t, res);
  rows.push(row);
  const mark = row.error ? '!' : row.status === 200 ? '·' : row.status >= 300 && row.status < 400 ? '→' : '✗';
  console.log(`  ${mark} ${String(row.status ?? 'ERR').padEnd(4)} ${t.path}`);
  await new Promise((r) => setTimeout(r, 120)); // be a polite crawler of your own site
}

/* ── findings ────────────────────────────────────────────────────────────── */
const problems = [];
for (const r of rows) {
  if (r.error) problems.push({ path: r.path, why: `request failed: ${r.error}` });
  else if (r.kind === 'alias') {
    if (!r.redirect?.permanent) problems.push({ path: r.path, why: `alias answered ${r.status}; a variant slug must be a permanent (301/308) redirect or crawlers keep it indexed` });
    else if (!r.redirect.oneHop) problems.push({ path: r.path, why: `alias took ${r.hops} hops; every hop loses signal` });
  } else if (r.status !== 200) problems.push({ path: r.path, why: `answered ${r.status}` });
  else if (r.kind === 'machine' && r.empty) problems.push({ path: r.path, why: r.jsonParseError ? `200 with a body that is not valid JSON` : `200 but effectively empty (${r.bytes} bytes) — a machine surface that answers empty is worse than one that 404s, because nothing alerts on it` });
  else if (r.kind === 'page') {
    if (!r.title) problems.push({ path: r.path, why: 'no <title>' });
    if (r.h1Count === 0) problems.push({ path: r.path, why: 'no <h1>' });
    if (r.h1Count > 1) problems.push({ path: r.path, why: `${r.h1Count} <h1> elements` });
    if (!r.canonical) problems.push({ path: r.path, why: 'no rel=canonical' });
    else if (r.canonicalMatchesSelf === false) problems.push({ path: r.path, why: `canonical points elsewhere: ${r.canonical}` });
    if (!r.jsonLd?.length) problems.push({ path: r.path, why: 'no JSON-LD' });
    if (r.metaRobots && /noindex/i.test(r.metaRobots)) problems.push({ path: r.path, why: `meta robots says ${r.metaRobots}` });
  }
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'site-crawl.json'), JSON.stringify({
  base: BASE, crawledAt: new Date().toISOString(), totals: { urls: rows.length, problems: problems.length }, rows, problems,
}, null, 2) + '\n');

const csvEsc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const CSV_COLS = ['path', 'kind', 'status', 'hops', 'title', 'h1', 'h1Count', 'canonical', 'canonicalMatchesSelf', 'metaRobots', 'bytes'];
writeFileSync(join(OUT_DIR, 'site-crawl.csv'),
  [CSV_COLS.join(','), ...rows.map((r) => CSV_COLS.map((c) => csvEsc(c === 'jsonLd' ? r[c]?.join(' ') : r[c])).join(','))].join('\n') + '\n');

const md = ['# Live crawl', '', `\`${BASE}\` · ${new Date().toISOString()} · ${rows.length} URL(s) · ${problems.length} problem(s)`, ''];
if (problems.length) {
  md.push('## Problems', '');
  for (const p of problems) md.push(`- \`${p.path}\` — ${p.why}`);
  md.push('');
}
md.push('## Every URL', '', '| Path | Kind | Status | Hops | Title | Canonical OK | JSON-LD |', '| --- | --- | ---: | ---: | --- | :---: | --- |');
for (const r of rows) {
  md.push(`| \`${r.path}\` | ${r.kind} | ${r.status ?? 'ERR'} | ${r.hops} | ${(r.title ?? '').slice(0, 60)} | ${r.canonicalMatchesSelf === null ? '–' : r.canonicalMatchesSelf ? 'yes' : 'NO'} | ${(r.jsonLd ?? []).join(', ')} |`);
}
writeFileSync(join(OUT_DIR, 'site-crawl.md'), md.join('\n') + '\n');

console.log('');
console.log(`  ${rows.length} URL(s), ${problems.length} problem(s)`);
console.log('  → audit/site-crawl.json / .csv / .md');
console.log('');
if (problems.length) {
  for (const p of problems.slice(0, 30)) console.error(`  ✗ ${p.path} — ${p.why}`);
  if (problems.length > 30) console.error(`  … and ${problems.length - 30} more`);
  console.error('');
  process.exit(1);
}
process.exit(0);
