#!/usr/bin/env node
/**
 * scripts/verify-canonical.mjs
 *
 * Fails when a public route does not declare its own canonical URL, when the
 * root layout declares one for everybody, or when a page title carries the
 * brand name that the title template is going to append anyway.
 *
 * WHY THIS EXISTS
 *
 * F-142, and it is the most expensive bug in this repository so far.
 *
 * The root layout carried:
 *
 *     alternates: {
 *       canonical: '/',
 *       types: { 'application/rss+xml': [ ... ] },
 *     }
 *
 * Next merges metadata from the root layout down into every page, and a page
 * that does not declare `alternates.canonical` inherits the parent's object
 * whole. So /technical-library served
 *
 *     <link rel="canonical" href="https://ecowoods.ca">
 *
 * and so did /blog, /case-studies and /products/floorforge. That element is not
 * a hint. It is the page telling a crawler "I am a duplicate of the homepage;
 * index that instead of me." The sitemap offered 101 URLs. Roughly one was
 * indexed. Fourteen guards, tsc, and a production build all passed, every day,
 * for the whole time it was true — because nothing in this repository had ever
 * read the rendered <head>.
 *
 * The reason it is worth a guard rather than a one-line fix is that the failure
 * is silent in both directions. Adding a route is the moment it recurs: a new
 * page.tsx with a title and a description looks complete, and inherits a wrong
 * canonical without a single warning anywhere.
 *
 * THE TITLE CHECK, in the same file, because it is the same mistake
 *
 * The root template is `%s · Ecowoods`. Twelve pages set titles ending in
 * ' | EcoWoods', which rendered as 'Technical Library | EcoWoods · Ecowoods'.
 * The paper route was worse: title + subtitle + brand + brand, 130+ characters
 * of which a result shows about sixty. Both are metadata composed twice by
 * people who could not see the composed result. See F-143.
 *
 * WHAT IT DOES
 *
 * 1. Reads apps/web/app/layout.tsx and fails if `alternates` contains
 *    `canonical`. The RSS `types` entry is fine and expected — it is genuinely
 *    site-wide.
 * 2. For every public route below, requires that its own page.tsx or the
 *    layout.tsx beside it declares `alternates` with a `canonical`.
 * 3. Fails on any `title:` whose literal ends in the brand name, since the
 *    template appends it.
 *
 * Comments are stripped before matching. Two guards in this repository have
 * already failed by reading their own documentation as a violation (F-58,
 * F-106); this one is documented at length, so it strips first.
 *
 *   node scripts/verify-canonical.mjs
 *   node scripts/verify-canonical.mjs --list
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP = path.join(ROOT, 'apps/web/app');
const LIST = process.argv.includes('--list');

if (!fs.existsSync(APP)) {
  console.error('verify-canonical: apps/web/app not found — run from the repo root.');
  process.exit(2);
}

/**
 * Every route that appears in sitemap.ts. Dynamic segments are listed by their
 * directory name because one page.tsx serves the whole set — if
 * papers/[slug]/page.tsx declares a canonical, all three papers have one.
 *
 * This list is written rather than derived, and that is deliberate: deriving it
 * from sitemap.ts would mean a route dropped from the sitemap also silently
 * drops out of this check, and a route missing from the sitemap is its own bug.
 * scripts/verify-links.mjs already walks the route tree; this is the head.
 */
const ROUTES = [
  '',                      // the homepage
  'design',
  'technical-library',
  'papers',
  'papers/[slug]',
  'products/floorforge',
  'blog',
  'blog/[slug]',
  'case-studies',
  'case-studies/[slug]',
  'authority',
  'framework',
  'framework/assess',
  'resources',
  'market',
  'whats-new',
  'standards',
  'library',
  'data',
  'glossary',
  'glossary/[slug]',
  'guides',
  'guides/[slug]',
  'service-areas',
  'service-areas/[city]',
];

/* ── strip comments so the prose above cannot be read as code ─────────────── */
const strip = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const read = (p) => (fs.existsSync(p) ? strip(fs.readFileSync(p, 'utf8')) : null);

const problems = [];
const ok = [];

/* ── 1. the root layout must not canonicalise on everyone's behalf ────────── */
const layoutPath = path.join(APP, 'layout.tsx');
const layout = read(layoutPath);
if (layout === null) {
  console.error('verify-canonical: apps/web/app/layout.tsx not found.');
  process.exit(2);
}
const rootAlternates = layout.match(/alternates:\s*\{[\s\S]*?\n {2}\}/);
if (rootAlternates && /canonical:/.test(rootAlternates[0])) {
  problems.push({
    file: 'apps/web/app/layout.tsx',
    kind: 'root-canonical',
    detail:
      'the root layout declares alternates.canonical — every page that does not ' +
      'override it inherits this exact URL',
  });
}

/* ── 2. every public route declares its own ───────────────────────────────── */
for (const route of ROUTES) {
  const dir = route ? path.join(APP, route) : APP;
  const page = read(path.join(dir, 'page.tsx'));
  const own = read(path.join(dir, 'layout.tsx'));

  if (page === null) {
    problems.push({
      file: `apps/web/app/${route}/page.tsx`.replace('//', '/'),
      kind: 'missing-page',
      detail: 'route is listed here but has no page.tsx — the list or the route is wrong',
    });
    continue;
  }

  const declares = (src) =>
    src !== null && /alternates:\s*\{[\s\S]*?canonical\s*:/.test(src);

  if (declares(page) || declares(own)) {
    ok.push(route === '' ? '/' : `/${route}`);
  } else {
    problems.push({
      file: `apps/web/app/${route}/page.tsx`.replace('//', '/'),
      kind: 'inherits',
      detail:
        'no alternates.canonical here or in the layout beside it — this route ' +
        'serves whatever the root layout says, which is not this route',
    });
  }
}

/* ── 3. no title may carry the brand the template appends ─────────────────── */
/**
 * Only the top-level `title` is checked. `openGraph.title` and `twitter.title`
 * are NOT run through the root template — a share card has no surrounding page
 * to give it context, so spelling the brand out there is correct, and the first
 * version of this guard flagged fifteen of them. Those nested objects are cut
 * out by brace matching before anything is matched, which is more work than a
 * regex on indentation and does not break the first time a file is reformatted.
 */
const TEMPLATE = (layout.match(/template:\s*['"`](.*?)['"`]/) || [])[1] ?? '';
const BRAND = TEMPLATE.replace(/%s/g, '').replace(/[^A-Za-z]/g, '');

/** Remove `key: { ... }` and everything nested inside it. */
const cutBlock = (src, key) => {
  let out = src;
  for (;;) {
    const at = out.search(new RegExp(`\\b${key}\\s*:\\s*\\{`));
    if (at === -1) return out;
    let i = out.indexOf('{', at);
    let depth = 0;
    for (; i < out.length; i++) {
      if (out[i] === '{') depth++;
      else if (out[i] === '}') { depth--; if (depth === 0) { i++; break; } }
    }
    out = out.slice(0, at) + out.slice(i);
  }
};

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
};

/**
 * Only metadata is metadata. A page also builds schema.org objects, and those
 * carry a `name`/`title` that SHOULD spell the brand out — a WebPage node in a
 * knowledge graph has no title template above it. The second version of this
 * guard flagged eight of those. So the search space is narrowed to two things
 * and nothing else: the exported `metadata` literal, and the body of
 * `generateMetadata`, which exists only to build one.
 */
const balancedFrom = (src, at) => {
  const open = src.indexOf('{', at);
  if (open === -1) return '';
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(open, i + 1); }
  }
  return '';
};

const metadataScopes = (src) => {
  const out = [];
  const lit = src.search(/export\s+const\s+metadata\b[^=]*=\s*\{/);
  if (lit !== -1) out.push(balancedFrom(src, lit));
  const gen = src.search(/export\s+async\s+function\s+generateMetadata\b/);
  if (gen !== -1) {
    // Skip the parameter list, then take the function body.
    const brace = src.indexOf('{', src.indexOf(')', gen));
    out.push(balancedFrom(src, brace - 1));
  }
  return out.filter(Boolean);
};

const titleRe = new RegExp(
  `title:\\s*(['"\`])([^'"\`]*?)\\s*[|\\-–—]\\s*${BRAND}\\s*\\1`,
  'i',
);
for (const f of walk(APP)) {
  const src = read(f);
  if (src === null) continue;
  for (const scope of metadataScopes(src)) {
    const own = cutBlock(cutBlock(scope, 'openGraph'), 'twitter');
    const m = own.match(titleRe);
    if (m) {
      problems.push({
        file: path.relative(ROOT, f),
        kind: 'double-brand',
        detail: `title ends in the brand, and the template appends '${TEMPLATE}' to it: "${m[2].trim()} … ${BRAND}"`,
      });
      break;
    }
  }
}

/* ── report ───────────────────────────────────────────────────────────────── */
if (LIST) {
  for (const r of ok) console.log(`  ✓ ${r}`);
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} metadata problem(s) in the rendered <head>:\n`);
  for (const p of problems) {
    console.error(`  · ${p.file}`);
    console.error(`      ${p.detail}\n`);
  }
  console.error(
    '  A canonical is per-route by nature. Declare it on the page:\n\n' +
      "      export const metadata: Metadata = {\n" +
      "        alternates: { canonical: '/your-route' },\n" +
      "      };\n\n" +
      '  For a client component, put it in the layout.tsx beside it.\n',
  );
  process.exit(1);
}

console.log(
  `✓ canonicals verified — ${ok.length} public route(s), each declaring its own; ` +
    `root layout canonicalises nothing; no title duplicates the brand`,
);
