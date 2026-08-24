#!/usr/bin/env node
/**
 * scripts/audit-current-state.mjs — the state of the site, from the source.
 *
 * WRITES: audit/current-state.json  (and audit/current-state.md, a readable digest)
 *
 * WHAT THIS IS AND IS NOT
 *
 * It is a STATIC audit. It reads the repository — every route file, every
 * metadata export, every schema builder call, every internal link — and reports
 * what the source says. It never fetches a URL, so it cannot be wrong about the
 * network and cannot be blocked by an egress proxy, which is the failure that
 * has produced five findings in this repository (F-117, F-149, F-166, F-177,
 * F-192: a check reporting a result it did not actually measure).
 *
 * The cost of that choice is real and is stated in the output rather than
 * hidden: `confidence` on every extracted field. A `title` set as a string
 * literal in an exported `metadata` object is `high`. A title produced by
 * `generateMetadata()` from a database row is `dynamic` — this script says so
 * instead of guessing. Anything it cannot determine is `null` with a reason,
 * never an empty string that reads like an absence.
 *
 * The live counterpart is scripts/crawl-site.mjs, which fetches the deployed
 * site and reports what a crawler actually receives. Run both. Where they
 * disagree, the crawl is right about production and this is right about the
 * repository, and the gap between them is the interesting part.
 *
 *   node scripts/audit-current-state.mjs
 *   node scripts/audit-current-state.mjs --quiet
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative, extname, dirname } from 'node:path';

const ROOT = process.cwd();
const WEB = join(ROOT, 'apps/web');
const APP = join(WEB, 'app');
const OUT_DIR = join(ROOT, 'audit');
const QUIET = process.argv.includes('--quiet');

const SKIP_DIR = new Set(['node_modules', '.next', 'dist', 'build', '.turbo', '.git']);

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (SKIP_DIR.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };

/* ── route derivation ──────────────────────────────────────────────────────
 *
 * App Router path rules, applied literally rather than approximately:
 *   (group)   → removed from the URL entirely
 *   @slot     → parallel route, not a URL
 *   [slug]    → dynamic segment, kept as-is so the shape is visible
 *   page.tsx  → an HTML route
 *   route.ts  → a handler; may serve HTML, text, XML or JSON
 */
function routeFromFile(file) {
  const rel = relative(APP, dirname(file)).split(/[\\/]/).filter(Boolean);
  const segs = rel.filter((s) => !(s.startsWith('(') && s.endsWith(')')) && !s.startsWith('@'));
  return '/' + segs.join('/');
}

/**
 * Is this URL meant to be in the index?
 *
 * Authenticated areas, API handlers and per-record document routes are not.
 * Getting this wrong in either direction ruins every count downstream, so the
 * rule is explicit and listed rather than inferred from a heuristic.
 */
const NON_INDEXABLE_PREFIXES = ['/api', '/admin', '/mypage', '/docs/', '/login', '/register', '/verify-email', '/md/'];
const isIndexable = (route) =>
  !NON_INDEXABLE_PREFIXES.some((p) => (p.endsWith('/') ? route.startsWith(p) : route === p || route.startsWith(p + '/')));

/* ── extraction ───────────────────────────────────────────────────────────── */

/** `title: 'X'` inside an exported metadata object. Literal only. */
function extractTitle(src) {
  if (/export\s+async\s+function\s+generateMetadata/.test(src)) {
    return { value: null, confidence: 'dynamic', why: 'generateMetadata() — resolved per request' };
  }
  const m = src.match(/export\s+const\s+metadata[\s\S]{0,4000}?\btitle:\s*(['"`])([\s\S]*?)\1/);
  if (m) return { value: m[2].trim(), confidence: 'high' };
  if (/export\s+const\s+metadata/.test(src)) {
    return { value: null, confidence: 'low', why: 'metadata exported but title is not a string literal' };
  }
  return { value: null, confidence: 'none', why: 'no metadata export — inherits the layout title template' };
}

function extractCanonical(src) {
  const m = src.match(/alternates:\s*\{[\s\S]{0,400}?canonical:\s*(['"`])([\s\S]*?)\1/);
  if (m) return { value: m[2].trim(), confidence: 'high' };
  const dyn = src.match(/alternates:\s*\{[\s\S]{0,400}?canonical:/);
  if (dyn) return { value: null, confidence: 'dynamic', why: 'canonical is an expression' };
  return { value: null, confidence: 'none', why: 'no alternates.canonical — Next emits none' };
}

/** First <h1>. Text-ish only; JSX expressions are reported as dynamic. */
function extractH1(src) {
  const count = (src.match(/<h1[\s>]/g) || []).length;
  if (count === 0) return { value: null, count: 0, confidence: 'none', why: 'no <h1> in this file' };
  const m = src.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (!m) return { value: null, count, confidence: 'low', why: '<h1> present but not closed in this file' };
  const inner = m[1];
  const hasExpr = /\{/.test(inner);
  const text = inner.replace(/\{[^}]*\}/g, '·').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return {
    value: text || null,
    count,
    confidence: hasExpr ? 'partial' : 'high',
    ...(hasExpr ? { why: 'contains a JSX expression, shown as ·' } : {}),
  };
}

/** Schema builders called, plus any literal '@type' emitted inline. */
function extractSchema(src) {
  const builders = [...src.matchAll(/\bbuild([A-Z][A-Za-z]*)\s*\(/g)].map((m) => `build${m[1]}`);
  const types = [...src.matchAll(/'@type':\s*'([A-Za-z]+)'/g)].map((m) => m[1]);
  const scripts = (src.match(/<SchemaScript\b/g) || []).length;
  return {
    builders: [...new Set(builders)].sort(),
    inlineTypes: [...new Set(types)].sort(),
    schemaScriptBlocks: scripts,
  };
}

/** Internal hrefs. Template literals are kept in their `${}` form on purpose. */
function extractLinks(src) {
  const out = new Set();
  for (const m of src.matchAll(/href=(["'])(\/[^"']*)\1/g)) out.add(m[2]);
  for (const m of src.matchAll(/href=\{`(\/[^`]*)`\}/g)) out.add(m[1]);
  return [...out].sort();
}

/* ── the scan ─────────────────────────────────────────────────────────────── */

const appFiles = walk(APP);
const pageFiles = appFiles.filter((f) => /[\\/](page)\.(tsx|ts|jsx|js)$/.test(f));
const handlerFiles = appFiles.filter((f) => /[\\/](route)\.(ts|js)$/.test(f));

/**
 * A `'use client'` page cannot export `metadata` — Next forbids it — so its
 * title and canonical live in the sibling `layout.tsx`. The first version of
 * this audit read only page.tsx and reported /products/floorforge as having no
 * canonical when it has had one all along. A false finding costs more than a
 * missed one: someone goes and adds a second canonical where it cannot work.
 */
const withLayout = (file) => {
  const cand = join(dirname(file), 'layout.tsx');
  return existsSync(cand) ? read(file) + '\n/* ---- sibling layout ---- */\n' + read(cand) : read(file);
};

/**
 * The H1 is frequently not in page.tsx.
 *
 * The homepage renders `home-client.tsx`; /blog/[slug] and /case-studies/[slug]
 * render MDX, where the H1 comes from the document's own first heading. A
 * scanner that reads only the route file reports all three as having no H1 —
 * three false findings on three of the most important URLs on the site, and the
 * "fix" for any of them would be to add a SECOND H1.
 *
 * So the H1 pass follows one level of local component imports, and where the
 * page renders MDX it says so rather than reporting an absence. One level is
 * deliberate: it is enough for the real cases and it keeps this from wandering
 * into the whole component tree, where the first <h1> found would belong to
 * something else.
 */
const RESOLVE_RE = /from\s+['"](\.{1,2}\/[^'"]+|@\/[^'"]+)['"]/g;
const resolveLocal = (file, spec) => {
  const base = spec.startsWith('@/') ? join(WEB, spec.slice(2)) : join(dirname(file), spec);
  for (const c of [`${base}.tsx`, `${base}.ts`, join(base, 'index.tsx')]) if (existsSync(c)) return c;
  return null;
};
const srcWithComponents = (file) => {
  let out = withLayout(file);
  for (const m of out.matchAll(RESOLVE_RE)) {
    const dep = resolveLocal(file, m[1]);
    if (dep && dep !== file) out += '\n/* ---- ' + relative(ROOT, dep) + ' ---- */\n' + read(dep);
  }
  return out;
};
/** True where the route's content is an MDX document, whose own H1 is the H1. */
const rendersMdx = (src) => /MDXRemote|compileMDX|mdx-remote|\.mdx/.test(src);

const pages = pageFiles.map((file) => {
  const src = withLayout(file);
  const route = routeFromFile(file);
  const title = extractTitle(src);
  const canonical = extractCanonical(src);
  const h1 = (() => {
    const direct = extractH1(src);
    if (direct.count > 0) return direct;
    const wide = extractH1(srcWithComponents(file));
    if (wide.count > 0) return { ...wide, confidence: 'component', why: 'rendered by an imported component, not by the route file' };
    if (rendersMdx(src)) {
      return { value: null, count: 1, confidence: 'mdx', why: 'the H1 is the first heading of the MDX document this route renders' };
    }
    return direct;
  })();
  const schema = extractSchema(src);
  const links = extractLinks(src);
  return {
    route,
    file: relative(ROOT, file),
    indexable: isIndexable(route),
    dynamic: /\[/.test(route),
    title,
    canonical,
    h1,
    schema,
    internalLinks: links,
    internalLinkCount: links.length,
    bytes: src.length,
  };
});

const handlers = handlerFiles.map((file) => {
  const src = read(file);
  const route = routeFromFile(file);
  return {
    route,
    file: relative(ROOT, file),
    indexable: isIndexable(route),
    /* A handler under app/ whose directory name carries an extension IS the
       served path — app/llms.txt/route.ts serves /llms.txt. That is how every
       machine-readable surface on this site is built, so it is worth naming. */
    machineReadable: /\.(txt|xml|json)$/.test(route) || route.startsWith('/api/'),
    exportsGET: /export\s+(async\s+)?function\s+GET/.test(src),
    forceStatic: /dynamic\s*=\s*'force-static'/.test(src),
  };
});

/* ── machine-readable surfaces, named explicitly ───────────────────────────
 *
 * Listed rather than discovered, because the interesting fact about this set is
 * whether an EXPECTED surface is missing — and a discovery-based list can only
 * ever report what exists, which is the one thing that cannot be missing.
 */
const EXPECTED_MACHINE_SURFACES = [
  { path: '/robots.txt', impl: 'apps/web/app/robots.ts' },
  { path: '/sitemap.xml', impl: 'apps/web/app/sitemap.ts' },
  { path: '/llms.txt', impl: 'apps/web/app/llms.txt/route.ts' },
  { path: '/llms-full.txt', impl: 'apps/web/app/llms-full.txt/route.ts' },
  { path: '/ai.txt', impl: 'apps/web/app/ai.txt/route.ts' },
  { path: '/feed.xml', impl: 'apps/web/app/feed.xml/route.ts' },
  { path: '/api/knowledge', impl: 'apps/web/app/api/knowledge/route.ts' },
  { path: '/api/estimate', impl: 'apps/web/app/api/estimate/route.ts' },
  { path: '/api/market', impl: 'apps/web/app/api/market/route.ts' },
  { path: '/api/health', impl: 'apps/web/app/api/health/route.ts' },
];
const machineSurfaces = EXPECTED_MACHINE_SURFACES.map((s) => ({
  ...s,
  present: existsSync(join(ROOT, s.impl)),
}));

/* ── content collections ──────────────────────────────────────────────────── */
const listSlugs = (dir, ext) => {
  try {
    return readdirSync(join(WEB, dir))
      .filter((f) => extname(f) === ext)
      .map((f) => f.replace(new RegExp(`\\${ext}$`), ''))
      .sort();
  } catch { return []; }
};

const slugsFromLib = (libFile) => {
  const src = read(join(WEB, 'lib', libFile));
  return [...new Set([...src.matchAll(/slug:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]))].sort();
};

const collections = {
  caseStudies: listSlugs('content/case-studies', '.mdx'),
  articles: listSlugs('content/articles', '.mdx'),
  papers: slugsFromLib('papers.ts'),
  guides: slugsFromLib('guides.ts'),
  glossary: slugsFromLib('glossary.ts'),
  servicePages: slugsFromLib('service-pages.ts'),
};

/* ── service areas, read from the source of truth ─────────────────────────── */
function extractAreaList(name) {
  const src = read(join(WEB, 'lib/seo-data.ts'));
  const m = src.match(new RegExp(`const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!m) return [];
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}
const serviceAreas = {
  municipalities: extractAreaList('AREAS'),
  neighbourhoods: extractAreaList('NEIGHBOURHOODS'),
};
serviceAreas.total = serviceAreas.municipalities.length + serviceAreas.neighbourhoods.length;

/* ── pricing: every decimal price literal in the tree ──────────────────────
 *
 * The point is not the count. It is WHERE they are: a price literal outside
 * content/constants/pricing.ts is a number that can drift from the published
 * band without any guard noticing, and each one is a place a customer could be
 * shown a figure the rest of the site does not agree with.
 */
const PRICE_LITERAL = /(?<![\w.])\$\s?\d{1,3}\.\d{2}(?![\d])/g;
const SCAN_ROOTS = ['apps/web/app', 'apps/web/lib', 'apps/web/content', 'packages/shared'];
const SCAN_EXT = new Set(['.ts', '.tsx', '.mdx', '.md', '.json']);
const PRICING_SOURCE = 'apps/web/content/constants/pricing.ts';

/* Same exemptions as scripts/verify-pricing-source.mjs, and they have to be the
   same or the two disagree about the state of the tree — which is worse than
   either being wrong, because there is no way to tell which to believe. */
const PRICE_EXEMPT_FILES = new Set([PRICING_SOURCE, 'apps/web/content/claims.ts']);
const PRICE_EXEMPT_LINES = ['pricing-allow', 'Give a range as one sentence'];

const priceLiterals = [];
for (const rootDir of SCAN_ROOTS) {
  for (const f of walk(join(ROOT, rootDir))) {
    if (!SCAN_EXT.has(extname(f))) continue;
    const rel = relative(ROOT, f);
    if (PRICE_EXEMPT_FILES.has(rel)) continue;
    const code = /\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(f);
    read(f).split('\n').forEach((line, i) => {
      if (PRICE_EXEMPT_LINES.some((x) => line.includes(x))) return;
      const t = line.trim();
      if (code && (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'))) return;
      for (const m of line.matchAll(PRICE_LITERAL)) {
        priceLiterals.push({ file: rel, line: i + 1, literal: m[0], text: line.trim().slice(0, 120).trimEnd() });
      }
    });
  }
}

/* ── inconsistencies ──────────────────────────────────────────────────────
 *
 * Each one is a specific, named contradiction found in this tree — not a
 * category that might contain one. A finding with no file and no line is a
 * worry, not a finding.
 */
const findings = [];
/** A `//` or `*` line in a source file is documentation, not a published claim. */
const isCodeFile = (f) => /\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(f);
const isCommentLine = (line) => {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('*/');
};

const grepAll = (re) => {
  const hits = [];
  for (const rootDir of SCAN_ROOTS) {
    for (const f of walk(join(ROOT, rootDir))) {
      if (!SCAN_EXT.has(extname(f))) continue;
      const rel = relative(ROOT, f);
      const code = isCodeFile(f);
      read(f).split('\n').forEach((line, i) => {
        if (code && isCommentLine(line)) return;
        if (re.test(line)) hits.push({ file: rel, line: i + 1, text: line.trim().slice(0, 160).trimEnd() });
        re.lastIndex = 0;
      });
    }
  }
  return hits;
};

const dust997 = grepAll(/99\.7\s*%/);
const dust995 = grepAll(/99\.5\s*%/);
if (dust997.length) {
  findings.push({
    id: 'CS-01',
    severity: 'high',
    subject: 'dust capture percentage',
    summary:
      `The figure 99.7% is published in ${dust997.length} place(s) with no source recorded ` +
      `anywhere in the repository. Separately, ${dust995.length} place(s) — the case studies — ` +
      `report a MEASURED 99.5%, from on-site particle counts, for what may or may not be the ` +
      `same quantity.`,
    why:
      'The two figures are probably measuring different things — a HEPA element is rated at ' +
      'the filter, a particle count is measured in the room — but nothing in this repository ' +
      'says so, and that is the whole problem: neither number carries a protocol, an ' +
      'instrument or a date. A published performance claim needs a source under the ' +
      'Competition Act, and this one is not a footnote: two of the occurrences are inside FAQ ' +
      'answers emitted as FAQPage JSON-LD and restated verbatim by answer engines, and one is ' +
      'the SERVICES blurb that feeds llms.txt and /api/knowledge.',
    resolution:
      'Owner decision, not a code change — which is why nothing here was edited. Either (a) ' +
      'state what the 99.7% measures, with instrument and protocol, and register it; or (b) ' +
      'publish the measured room figure and cite the case-study particle counts; or (c) drop ' +
      'the percentage and keep the claim that is already supported — HEPA-sealed extraction at ' +
      'the machine, containment at the room, most clients stay in the house. Registered as ' +
      'method.dustCapturePct (status: unsourced) in apps/web/content/claims.ts, where the ' +
      'policy fences it to editorial contexts; `pnpm seo:claims` reports the gap and ' +
      '`--strict` fails on it once the queue is meant to be empty.',
    occurrences: dust997,
    adjacentMeasuredFigure: dust995,
  });
}

const warrantyA = grepAll(/25[–-]35\s*year/i);
const warrantyB = grepAll(/25 to 50 years/i);
if (warrantyA.length && warrantyB.length) {
  findings.push({
    id: 'CS-02',
    severity: 'high',
    subject: 'warranty length',
    summary:
      'Two incompatible warranty statements are live: "25–35 years on finish, up to 50 years ' +
      'structural" and "Manufacturer finish and structural warranties — 25 to 50 years".',
    why:
      'The second phrasing reads as a single span and implies a 50-year FINISH warranty, which ' +
      'no manufacturer offers. A warranty length is the one claim on this site that is directly ' +
      'contractual — it is restated in the quote and the contract.',
    resolution:
      'Reconcile onto the first phrasing and attach the manufacturer warranty documents. ' +
      'Registered as warranty.finish (status: unsourced) in apps/web/content/claims.ts.',
    occurrences: [...warrantyA, ...warrantyB],
  });
}

/* The constants module IS the phone number and the claim registry quotes it to
   describe it. Neither is drift. */
const NAP_EXEMPT = new Set(['packages/shared/constants/index.ts', 'apps/web/content/claims.ts']);
const hardcodedPhone = grepAll(/'\(647\)\s*244-5156'/).filter((h) => !NAP_EXEMPT.has(h.file));
if (hardcodedPhone.length) {
  findings.push({
    id: 'CS-03',
    severity: 'medium',
    subject: 'NAP drift risk',
    summary: `The live phone number is typed as a string literal in ${hardcodedPhone.length} place(s).`,
    why:
      'verify-business-facts.mjs bans the RETIRED number but cannot ban the current one — so a ' +
      'literal copy of the current number passes every guard today and silently becomes a second ' +
      'source of truth the day the number changes. That is exactly how the previous drift ' +
      'happened: the site, the schema and the email templates ended up on three different numbers.',
    resolution: 'Import BUSINESS_NAP.phoneDisplay. scripts/verify-claims.mjs now fails on this.',
    occurrences: hardcodedPhone,
  });
}

if (priceLiterals.length) {
  findings.push({
    id: 'CS-04',
    severity: 'medium',
    subject: 'price literals outside the constants module',
    summary: `${priceLiterals.length} decimal price literal(s) exist outside ${PRICING_SOURCE}.`,
    why:
      'Every one is a figure that can drift from the published band with no guard noticing. ' +
      'Most are in editorial content where a worked example is legitimate; the ones in app/ and ' +
      'lib/ are not.',
    resolution: 'pnpm seo:pricing lists them and fails on any outside the allowed content paths.',
    occurrences: priceLiterals.slice(0, 50),
    truncated: priceLiterals.length > 50,
  });
}

/* ── commercial query coverage ─────────────────────────────────────────────
 * Read from the topic map's JSON companion so this script stays dependency-free
 * (it cannot import TypeScript) and cannot fall out of step with the redirects.
 */
let aliasMap = {};
try {
  aliasMap = JSON.parse(read(join(WEB, 'content/search/route-aliases.json'))).aliases ?? {};
} catch { /* absent on a tree before this change */ }

const realRoutes = new Set(pages.map((p) => p.route));
const commercialCoverage = Object.entries(aliasMap).map(([alias, canonical]) => ({
  alias,
  canonical,
  canonicalExists:
    realRoutes.has(canonical) ||
    // /services/:slug, /guides/:slug etc. are dynamic routes with a data source
    Object.values(collections).some((list) => list.includes(canonical.split('/').pop())),
  aliasCollidesWithRealRoute: realRoutes.has(alias),
}));

/* ── the report ───────────────────────────────────────────────────────────── */
const indexablePages = pages.filter((p) => p.indexable);
const report = {
  $schema: 'audit/current-state.schema (informal)',
  generatedBy: 'scripts/audit-current-state.mjs',
  generatedAt: new Date().toISOString(),
  method: 'static analysis of the repository — no URL is fetched; see scripts/crawl-site.mjs for the live counterpart',
  repository: { root: relative(ROOT, WEB) || 'apps/web' },

  summary: {
    routeFiles: pageFiles.length,
    handlerFiles: handlerFiles.length,
    indexablePages: indexablePages.length,
    dynamicRoutes: pages.filter((p) => p.dynamic).length,
    pagesWithCanonical: indexablePages.filter((p) => p.canonical.confidence === 'high').length,
    pagesWithoutCanonical: indexablePages.filter((p) => p.canonical.confidence === 'none').length,
    pagesWithTitleLiteral: indexablePages.filter((p) => p.title.confidence === 'high').length,
    pagesWithNoH1: indexablePages.filter((p) => p.h1.count === 0).length,
    pagesWithMultipleH1: indexablePages.filter((p) => p.h1.count > 1).length,
    pagesEmittingSchema: indexablePages.filter((p) => p.schema.schemaScriptBlocks > 0).length,
    machineSurfacesPresent: machineSurfaces.filter((s) => s.present).length,
    machineSurfacesExpected: machineSurfaces.length,
    priceLiteralsOutsideConstants: priceLiterals.length,
    commercialAliases: Object.keys(aliasMap).length,
    findings: findings.length,
  },

  routes: pages,
  handlers,
  machineSurfaces,
  collections,
  serviceAreas,
  pricing: {
    source: PRICING_SOURCE,
    literalsOutsideSource: priceLiterals,
  },
  commercialCoverage,
  findings,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'current-state.json'), JSON.stringify(report, null, 2) + '\n');

/* A JSON file nobody opens is not an audit. The digest is what gets read. */
const md = [];
md.push('# Current state — static audit');
md.push('');
md.push(`Generated by \`scripts/audit-current-state.mjs\` at ${report.generatedAt}.`);
md.push('');
md.push('Static analysis of the repository. No URL is fetched — see `scripts/crawl-site.mjs`');
md.push('for the live counterpart, and treat any disagreement between them as the finding.');
md.push('');
md.push('## Summary');
md.push('');
md.push('| Measure | Value |');
md.push('| --- | ---: |');
for (const [k, v] of Object.entries(report.summary)) {
  md.push(`| ${k.replace(/([A-Z])/g, ' $1').toLowerCase()} | ${v} |`);
}
md.push('');
md.push('## Findings');
md.push('');
if (!findings.length) md.push('None.');
for (const f of findings) {
  md.push(`### ${f.id} — ${f.subject} (${f.severity})`);
  md.push('');
  md.push(f.summary);
  md.push('');
  md.push(`**Why it matters.** ${f.why}`);
  md.push('');
  md.push(`**Resolution.** ${f.resolution}`);
  md.push('');
  if (f.occurrences?.length) {
    md.push('```');
    for (const o of f.occurrences.slice(0, 12)) md.push(`${o.file}:${o.line}  ${o.text ?? o.literal}`);
    if (f.occurrences.length > 12) md.push(`… and ${f.occurrences.length - 12} more`);
    md.push('```');
    md.push('');
  }
}
md.push('## Indexable routes');
md.push('');
md.push('| Route | Title | Canonical | H1 | Schema blocks | Internal links |');
md.push('| --- | --- | --- | --- | ---: | ---: |');
for (const p of indexablePages.sort((a, b) => a.route.localeCompare(b.route))) {
  const t = p.title.value ?? `_${p.title.confidence}_`;
  const c = p.canonical.value ?? `_${p.canonical.confidence}_`;
  const h = p.h1.value ?? `_${p.h1.confidence}_`;
  md.push(`| \`${p.route}\` | ${String(t).slice(0, 70)} | ${c} | ${String(h).slice(0, 50)} | ${p.schema.schemaScriptBlocks} | ${p.internalLinkCount} |`);
}
md.push('');
writeFileSync(join(OUT_DIR, 'current-state.md'), md.join('\n').replace(/\n+$/, '') + '\n');

if (!QUIET) {
  console.log('');
  console.log('CURRENT STATE — static audit');
  console.log('');
  for (const [k, v] of Object.entries(report.summary)) {
    console.log(`  ${String(v).padStart(5)}  ${k.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
  }
  console.log('');
  if (findings.length) {
    console.log(`  ${findings.length} finding(s):`);
    for (const f of findings) console.log(`    ${f.id}  [${f.severity}]  ${f.subject} — ${f.summary.slice(0, 90)}…`);
    console.log('');
  }
  console.log('  → audit/current-state.json');
  console.log('  → audit/current-state.md');
  console.log('');
}

/* Exit 0 always. This is an audit, not a gate — the gates are the verify:* and
   seo:* scripts, and an audit that fails the build is an audit nobody runs. */
process.exit(0);
