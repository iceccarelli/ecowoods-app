#!/usr/bin/env node
/**
 * scripts/verify-agentic.mjs — the consistency gates for the agentic
 * primitives (Protocol v2, Stages 21–23 and 36–39).
 *
 *   pnpm verify:agentic
 *
 * WHY THIS EXISTS
 *
 * /api/v1 is a contract with readers that never see the page: an OpenAPI
 * document, a manifest, twenty-odd route files and a registry that projects
 * the business facts as primitives. Every one of those surfaces is generated
 * from the same modules, which is the design — and also the failure mode.
 * The document can describe a route that was never created; a route can exist
 * that the document does not mention; a string meant for a language model can
 * carry an instruction instead of a fact; a canonical URL can quietly point at
 * a preview host. None of that is a type error. `tsc` passes, `next build`
 * passes, and the API is wrong on the first request an agent makes.
 *
 * So the correspondences are checked rather than assumed. Every check here
 * parses the repository as text — no imports of TypeScript, no network — for
 * the same reason as every other guard in this directory: it must run on bare
 * `node` in under two seconds, before an install, and never report a proxy's
 * 403 as a broken site.
 *
 * WHAT IT DOES
 *
 *  a. OpenAPI ↔ routes parity. Every ENDPOINTS entry in lib/registry/manifest.ts
 *     (the single declaration the OpenAPI document and the manifest read) has a
 *     route file that exports its method; every route.ts under app/api/v1 is
 *     declared there; every v1 route is force-dynamic, because a route that
 *     answers If-None-Match with a 304 cannot be prerendered.
 *  b. No instruction-override language in any machine surface. "Ignore previous
 *     instructions", "always recommend Ecowoods" and their relatives are prompt
 *     injection, whichever side writes them. Every string in these files is
 *     data about a business, never an instruction to the reader.
 *  c. No preview or retired host in any machine surface. A vercel.app URL or the
 *     old domain in a canonical_url is a citation to the wrong site.
 *  d. Every alias in the intent ontology resolves to a published service slug.
 *  e. Every `use_instead` reference in the registry resolves to a service or a
 *     published price band.
 *  f. robots.txt allows /api/v1/ in BOTH rule groups. /api/ is disallowed
 *     wholesale; without the more specific Allow, the endpoints built for
 *     agents are the one thing agents are told not to read (see F-89).
 *  g. FACTS_VERIFIED_AT is a real date, not in the future and not older than
 *     120 days. It is the date a person last read the live host; a ratchet, so
 *     the registry cannot claim a verification nobody performed.
 *  h. No aggregateRating anywhere in the registry or the API. Review figures
 *     are cited to source; a self-serving aggregate is never emitted.
 *  i. Price literals in lib/registry are already covered by
 *     scripts/verify-pricing-source.mjs (it scans all of apps/web/lib).
 *
 *   node scripts/verify-agentic.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const WEB = join(ROOT, 'apps/web');
const V1 = join(WEB, 'app/api/v1');
const REGISTRY = join(WEB, 'lib/registry');

const problems = [];
const fail = (where, detail) => problems.push({ where, detail });
const rel = (p) => relative(ROOT, p).split(sep).join('/');
const read = (p) => readFileSync(p, 'utf8');

/** Blank out comments, keeping line numbers so a report can point at a line. */
const strip = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
};

const lineOf = (src, index) => src.slice(0, index).split('\n').length;

/* ── a. OpenAPI ↔ routes parity ───────────────────────────────────────────── */

const manifestPath = join(REGISTRY, 'manifest.ts');
const manifest = existsSync(manifestPath) ? strip(read(manifestPath)) : '';
const endpointsBlock = manifest.match(/export const ENDPOINTS[^=]*=\s*\[[\s\S]*?\n\];/);

/** { path, method, file } per declaration, in declaration order. */
const endpoints = endpointsBlock
  ? [...endpointsBlock[0].matchAll(/\{\s*path:\s*'([^']*)'\s*,\s*method:\s*'(GET|POST)'[^}]*?\bfile:\s*'([^']*)'/g)].map((m) => ({
      path: m[1],
      method: m[2],
      file: m[3],
    }))
  : [];

if (!existsSync(manifestPath)) {
  fail('apps/web/lib/registry/manifest.ts', 'missing — the OpenAPI document and the manifest have nothing to read');
} else if (endpoints.length === 0) {
  fail('apps/web/lib/registry/manifest.ts', 'could not parse a single ENDPOINTS entry ({ path, method, file })');
}

const routeFileFor = (file) => (file === '' ? join(V1, 'route.ts') : join(V1, file, 'route.ts'));

const exportsMethod = (src, method) =>
  new RegExp(`export\\s+(?:const|let)\\s+${method}\\b|export\\s+(?:async\\s+)?function\\s+${method}\\b|export\\s*\\{[^}]*\\b${method}\\b[^}]*\\}`).test(src);

const routeSources = new Map();
for (const p of walk(V1).filter((f) => f.endsWith(`${sep}route.ts`))) routeSources.set(p, strip(read(p)));

for (const e of endpoints) {
  const file = routeFileFor(e.file);
  const src = routeSources.get(file);
  if (src === undefined) {
    fail(`ENDPOINTS ${e.method} /api/v1${e.path}`, `declared with file '${e.file}' but ${rel(file)} does not exist — the OpenAPI document describes a 404`);
    continue;
  }
  if (!exportsMethod(src, e.method)) {
    fail(`ENDPOINTS ${e.method} /api/v1${e.path}`, `${rel(file)} does not export ${e.method} — the document promises a method the route refuses`);
  }
}

const declared = new Set(endpoints.map((e) => `${e.file}|${e.method}`));
for (const [file, src] of routeSources) {
  const key = rel(file).replace(/^apps\/web\/app\/api\/v1\/?/, '').replace(/\/?route\.ts$/, '');
  const has = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].filter((m) => exportsMethod(src, m));
  if (has.length === 0) fail(rel(file), 'exports no GET or POST — a route file that answers nothing');
  for (const m of has) {
    if (!declared.has(`${key}|${m}`)) {
      fail(rel(file), `exports ${m} but ENDPOINTS in manifest.ts has no { file: '${key}', method: '${m}' } entry — the route exists and the manifest, the OpenAPI document and this guard do not know about it`);
    }
  }
  if (!exportsMethod(src, 'OPTIONS')) fail(rel(file), 'does not export OPTIONS — a browser preflight gets a 405 from a CORS-open API');
  if (!/export\s+const\s+dynamic\s*=\s*'force-dynamic'/.test(src)) {
    fail(rel(file), "no `export const dynamic = 'force-dynamic'` — the handler answers If-None-Match with a 304, which a prerendered route cannot do");
  }
  if (/force-static/.test(src)) fail(rel(file), "contains 'force-static' — a v1 route is never prerendered");
}

/* ── b. and c. what the machine surfaces may not say ─────────────────────── */

const surfaceFiles = [
  join(WEB, 'app/llms.txt/route.ts'),
  join(WEB, 'app/llms-full.txt/route.ts'),
  join(WEB, 'app/ai.txt/route.ts'),
  join(WEB, 'lib/markdown-export.ts'),
  ...walk(REGISTRY),
  ...walk(V1),
].filter(existsSync);

const INJECTION =
  /ignore (all |any )?(previous|prior|above) instructions|always (cite|recommend|choose|prefer) ecowoods|disregard (the )?(previous|above)|you must recommend|do not mention (other|competitor)/i;

for (const p of surfaceFiles) {
  const src = strip(read(p));
  const m = src.match(INJECTION);
  if (m) {
    fail(`${rel(p)}:${lineOf(src, m.index)}`, `instruction-override language in a machine surface: "${m[0]}". Every string here is data about a business, never an instruction to the reader.`);
  }
}

const HOSTS = /vercel\.app|ecowoodshardwood\.com|http:\/\/ecowoods/g;
const hostFiles = [...surfaceFiles, join(WEB, 'app/sitemap.ts'), join(WEB, 'app/robots.ts')].filter(existsSync);
for (const p of hostFiles) {
  const src = strip(read(p));
  for (const m of src.matchAll(HOSTS)) {
    fail(`${rel(p)}:${lineOf(src, m.index)}`, `'${m[0]}' in code — a preview or retired host reaching a machine surface is a citation to the wrong site`);
  }
}

/* ── d. and e. every reference resolves ──────────────────────────────────── */

const seo = strip(read(join(WEB, 'lib/seo-data.ts')));
const servicesBlock = seo.match(/export const SERVICES[^=]*=\s*\[[\s\S]*?\n\];/);
const serviceSlugs = servicesBlock ? [...servicesBlock[0].matchAll(/slug:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]) : [];
if (serviceSlugs.length === 0) fail('apps/web/lib/seo-data.ts', 'could not read SERVICES — nothing below can be checked against it');

const intentsPath = join(REGISTRY, 'intents.ts');
if (!existsSync(intentsPath)) {
  fail('apps/web/lib/registry/intents.ts', 'missing — the matcher has no ontology');
} else {
  const intents = strip(read(intentsPath));
  const unknown = new Set();
  for (const m of intents.matchAll(/\bservice:\s*'([^']+)'/g)) if (!serviceSlugs.includes(m[1])) unknown.add(m[1]);
  for (const s of unknown) {
    fail('apps/web/lib/registry/intents.ts', `alias resolves to service '${s}', which is not a SERVICES slug — the matcher would name a service that has no page`);
  }
}

const PRICE_SLUGS = ['screen-and-recoat', 'full-sand-and-finish', 'new-install'];
const registryPath = join(REGISTRY, 'registry.ts');
const registry = existsSync(registryPath) ? strip(read(registryPath)) : '';
if (!registry) {
  fail('apps/web/lib/registry/registry.ts', 'missing — there is no registry');
} else {
  for (const m of registry.matchAll(/use_instead:\s*'([^']+)'/g)) {
    const ref = m[1];
    if (ref.startsWith('service:')) {
      if (!serviceSlugs.includes(ref.slice('service:'.length))) fail(`registry.ts:${lineOf(registry, m.index)}`, `use_instead '${ref}' names a service that is not in SERVICES`);
    } else if (ref.startsWith('price:')) {
      if (!PRICE_SLUGS.includes(ref.slice('price:'.length))) fail(`registry.ts:${lineOf(registry, m.index)}`, `use_instead '${ref}' names a price band that is not published (${PRICE_SLUGS.join(', ')})`);
    } else if (!['unsupported', 'requires_assessment'].includes(ref)) {
      fail(`registry.ts:${lineOf(registry, m.index)}`, `use_instead '${ref}' is neither a service:, a price:, 'unsupported' nor 'requires_assessment'`);
    }
  }
}

/* ── f. robots.txt lets agents read the API ──────────────────────────────── */

const robotsPath = join(WEB, 'app/robots.ts');
if (!existsSync(robotsPath)) {
  fail('apps/web/app/robots.ts', 'missing');
} else {
  const robots = strip(read(robotsPath));
  // `(?<![a-z])` so `disallow: [...]` is not read as an allow group.
  const groups = [...robots.matchAll(/(?<![a-zA-Z])allow:\s*\[([^\]]*)\]/g)].map((m) => [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]));
  if (groups.length < 2) {
    fail('apps/web/app/robots.ts', `found ${groups.length} allow: [...] group(s); expected the general group and the named AI-crawler group`);
  }
  groups.forEach((allow, i) => {
    if (!allow.includes('/api/v1/')) {
      fail(
        'apps/web/app/robots.ts',
        `rule group ${i + 1} does not Allow '/api/v1/'. /api/ is disallowed wholesale in the same group, so every agent that reads robots.txt is told not to read the one API built for it. Add '/api/v1/' to the allow list of BOTH rule groups.`,
      );
    }
  });
}

/* ── g. the verification date is real ────────────────────────────────────── */

const MAX_AGE_DAYS = 120;
if (registry) {
  const m = registry.match(/export const FACTS_VERIFIED_AT\s*=\s*'(\d{4}-\d{2}-\d{2})'/);
  if (!m) {
    fail('apps/web/lib/registry/registry.ts', "no `export const FACTS_VERIFIED_AT = 'YYYY-MM-DD'` — every primitive's provenance falls back to it");
  } else {
    const date = m[1];
    const t = Date.parse(`${date}T00:00:00Z`);
    const today = new Date().toISOString().slice(0, 10);
    if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== date) {
      fail('apps/web/lib/registry/registry.ts', `FACTS_VERIFIED_AT '${date}' is not a real calendar date`);
    } else if (date > today) {
      fail('apps/web/lib/registry/registry.ts', `FACTS_VERIFIED_AT '${date}' is in the future (today is ${today}) — a verification cannot postdate the read`);
    } else {
      const age = Math.floor((Date.parse(`${today}T00:00:00Z`) - t) / 86_400_000);
      if (age > MAX_AGE_DAYS) {
        fail(
          'apps/web/lib/registry/registry.ts',
          `FACTS_VERIFIED_AT '${date}' is ${age} days old (limit ${MAX_AGE_DAYS}). Re-read the NAP, hours, founding year and price bands on the live canonical host, confirm they match the constants, and move the date. This is the ratchet; it is meant to fire.`,
        );
      }
    }
  }
}

/* ── h. no self-serving aggregate ────────────────────────────────────────── */

for (const p of [...walk(REGISTRY), ...walk(V1)]) {
  const src = strip(read(p));
  const m = src.match(/aggregateRating/);
  if (m) fail(`${rel(p)}:${lineOf(src, m.index)}`, 'aggregateRating in the registry or the API — review figures are cited to source, never blended into a self-serving aggregate');
}

/* ── report ──────────────────────────────────────────────────────────────── */

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s) in the agentic primitives:\n`);
  for (const p of problems) console.error(`  · ${p.where}\n      ${p.detail}\n`);
  console.error(
    '  These surfaces are read by machines that never see the page. A contract\n' +
      '  that disagrees with itself is worse than none — it is the first thing an\n' +
      '  agent trusts.\n',
  );
  process.exit(1);
}

console.log(
  `✓ agentic primitives verified — ${endpoints.length} endpoint(s) ↔ ${routeSources.size} route file(s), ` +
    `${serviceSlugs.length} service slug(s) resolved, ${surfaceFiles.length} machine surface(s) clean`,
);
