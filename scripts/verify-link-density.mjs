#!/usr/bin/env node
/**
 * scripts/verify-link-density.mjs — the authority graph, enforced.
 *
 *   pnpm seo:density
 *   pnpm seo:density --list     print every page's effective link set
 *
 * WHAT THIS ENFORCES AND WHY IT IS NOT THE SAME AS verify-links.mjs
 *
 * verify-links.mjs asks whether a page has any way IN. This asks whether a page
 * has enough ways OUT, and to the right places. Those are different failures
 * with different consequences:
 *
 *   No way in  → the page is not crawled, and does not rank at all.
 *   No way out → the page IS crawled, ranks thinly, and is the end of the
 *                journey. A commercial page that links nowhere is a leaf, and a
 *                crawler reads a leaf as a page the site itself does not think
 *                is connected to anything.
 *
 * A commercial page must reach, through in-content links a reader would
 * plausibly follow:
 *
 *   ≥2 service pages      — what we would actually do
 *   ≥2 decision guides    — the open questions behind the choice
 *   ≥2 case studies       — that it has been done, with numbers
 *   ≥1 technical paper    — the mechanism, citable
 *   ≥1 framework page     — how to judge the quote, including ours
 *   ≥1 estimate CTA       — the way to act
 *
 * The quota is not arbitrary and it is not a ranking trick. It is the shape of
 * an answer a person actually needs: what you would do, what I have to decide,
 * has it worked before, why it works, how do I judge you, how do I start. A
 * page missing two of those is missing part of the answer, and an internal-link
 * count is the only part of that a machine can check.
 *
 * COMPONENTS COUNT, WHICH IS THE WHOLE REASON THIS IS NON-TRIVIAL
 *
 * A crawler sees the RENDERED page. CommercialHeadTermRail contributes five
 * links to every page that renders it, and a guard that only reads the page
 * file would report those pages as link-starved while the live HTML is fine —
 * and would be "fixed" by someone duplicating links that are already there.
 *
 * So this resolves each page's effective link set by following its local
 * component imports transitively, depth-limited and cycle-safe. It is a static
 * approximation of the rendered DOM and it says so; where a link is built from
 * a template literal with an expression in it (`/guides/${slug}`), the pattern
 * is recorded as a WILDCARD for its collection rather than counted as one
 * specific URL — because `guides.map(g => <Link href={`/guides/${g.slug}`}>)`
 * genuinely is "links to every guide", and counting it as one would be wrong in
 * the other direction.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve, extname } from 'node:path';

const ROOT = process.cwd();
const WEB = join(ROOT, 'apps/web');
const APP = join(WEB, 'app');
const LIST = process.argv.includes('--list');

const SKIP_DIR = new Set(['node_modules', '.next', 'dist', 'build', '.turbo', '.git']);
const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (SKIP_DIR.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(full);
  }
  return out;
}

/* ── link extraction ──────────────────────────────────────────────────────
 *
 * Three shapes, because all three are in this codebase:
 *   href="/framework"                     a literal
 *   href={`/guides/${g.slug}`}            a template with an expression
 *   href={`/papers/${p.slug}#${s.id}`}    ditto, with a fragment
 *
 * A template whose static prefix is a known collection becomes `/guides/*`.
 * That is the honest reading: the page links to the collection, and how many
 * members it links to is decided by data this scanner cannot evaluate.
 */
function linksIn(src) {
  const out = new Set();
  for (const m of src.matchAll(/href=(["'])(\/[^"'#]*)\1/g)) out.add(m[2]);
  for (const m of src.matchAll(/href=\{["'](\/[^"'#]*)["']\}/g)) out.add(m[1]);
  for (const m of src.matchAll(/href=\{`(\/[^`]*)`\}/g)) {
    const raw = m[1];
    const i = raw.indexOf('${');
    if (i === -1) { out.add(raw.split('#')[0]); continue; }
    const prefix = raw.slice(0, i).replace(/\/$/, '');
    out.add(prefix ? `${prefix}/*` : '/*');
  }
  // Anchor-only CTAs: href="/#quote" and href="#quote" both reach the form.
  if (/href=(["'`{])[^"'`}]*#quote/.test(src)) out.add('#quote');
  return out;
}

/**
 * `href={f.href}` — a link whose destination is a value this scanner cannot
 * evaluate. It is a real link in the rendered HTML and it is invisible here.
 *
 * This is the one place a static link audit is guaranteed to undercount, so it
 * is counted and printed rather than left implicit. A page reported as reaching
 * "0 guides" while carrying six unresolvable hrefs is telling you the scanner
 * is blind, not that the page is broken — and the fix in that case is usually
 * worth making anyway: `<Link href={f.href}>Read the guide</Link>` repeated six
 * times is six identical anchors, which is weak for a reader and weaker for a
 * crawler than naming the guide.
 */
function unresolvableLinks(src) {
  return [...src.matchAll(/href=\{([A-Za-z_$][\w$.]*)\}/g)].map((m) => m[1]);
}

/** Local component imports — `./components/X`, `../components/X`, `@/lib/...`. */
function localImports(file, src) {
  const out = [];
  for (const m of src.matchAll(/from\s+['"](\.{1,2}\/[^'"]+|@\/[^'"]+)['"]/g)) {
    const spec = m[1];
    const base = spec.startsWith('@/') ? join(WEB, spec.slice(2)) : resolve(dirname(file), spec);
    for (const cand of [`${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
      if (existsSync(cand)) { out.push(cand); break; }
    }
  }
  return out;
}

const files = walk(APP);
const srcOf = new Map(files.map((f) => [f, read(f)]));
const ownLinks = new Map();
const importsOf = new Map();
for (const f of files) {
  ownLinks.set(f, linksIn(srcOf.get(f)));
  importsOf.set(f, localImports(f, srcOf.get(f)));
}

/** Own links plus everything reachable through local component imports. */
function effectiveLinks(file, depth = 4, seen = new Set()) {
  if (seen.has(file) || depth < 0) return new Set();
  seen.add(file);
  const out = new Set(ownLinks.get(file) ?? []);
  for (const dep of importsOf.get(file) ?? []) {
    if (!srcOf.has(dep)) {
      // a lib/ module, outside app/ — read it once, don't recurse into the world
      for (const l of linksIn(read(dep))) out.add(l);
      continue;
    }
    for (const l of effectiveLinks(dep, depth - 1, seen)) out.add(l);
  }
  return out;
}

/* ── classification ───────────────────────────────────────────────────────── */
const CATEGORIES = {
  services: (h) => h === '/services/*' || (h.startsWith('/services/') && h !== '/services'),
  guides: (h) => h === '/guides/*' || (h.startsWith('/guides/') && h !== '/guides'),
  caseStudies: (h) => h === '/case-studies/*' || (h.startsWith('/case-studies/') && h !== '/case-studies'),
  papers: (h) => h === '/papers/*' || (h.startsWith('/papers/') && h !== '/papers'),
  framework: (h) => h === '/framework' || h.startsWith('/framework/'),
  cta: (h) => h === '#quote' || h === '/#quote',
};

/**
 * A wildcard satisfies the quota for its collection, because it genuinely is a
 * link to every member. A page rendering `SERVICES.map(...)` links to six
 * service pages; counting that as one would fail a page that is doing the thing
 * this guard exists to require.
 */
const countIn = (links, key) => {
  const hits = [...links].filter(CATEGORIES[key]);
  return hits.some((h) => h.endsWith('/*')) ? Infinity : hits.length;
};

/** Shown in the table header so the two tiers are visible, not implied. */
const TIER_LABEL = (intent) =>
  intent === 'commercial' || intent === 'problem' ? 'money' : 'support';

/**
 * TWO TIERS, because one quota applied to every canonical is a quota nobody
 * believes.
 *
 * MONEY — a `commercial` or `problem` cluster canonical. Someone arriving here
 * is ready to hire or has a floor that is failing, and the six things below are
 * what they need before they can act: what we would do, what they still have to
 * decide, that it has been done before with numbers, why the method works, how
 * to judge the quote, and how to start.
 *
 * SUPPORTING — a `decision`, `entity` or `local` canonical. These answer a
 * narrower question and dragging them to the full quota would mean padding.
 * /about does not need two case studies. It does need to say what this company
 * does, show one piece of evidence, and offer a way to start, because a page
 * that answers "who are you" and then dead-ends has wasted the only visit where
 * someone was asking.
 *
 * Raising a quota is a content decision. Lowering one to make this pass is not.
 */
const QUOTA_MONEY = { services: 2, guides: 2, caseStudies: 2, papers: 1, framework: 1, cta: 1 };
const QUOTA_SUPPORTING = { services: 1, guides: 0, caseStudies: 1, papers: 0, framework: 0, cta: 1 };
const quotaFor = (intent) =>
  intent === 'commercial' || intent === 'problem' ? QUOTA_MONEY : QUOTA_SUPPORTING;

/* ── which pages are held to it ───────────────────────────────────────────
 * The cluster canonicals from the topic map, plus every service page. Those are
 * the pages a commercial query lands on; everything else on the site is
 * supporting material and is governed by verify-links.mjs instead.
 */
const mapSrc = read(join(WEB, 'content/search/topic-map.ts'));
const clusters = [...mapSrc.matchAll(
  /id:\s*'([^']+)',\s*\n\s*intent:\s*'([^']+)',\s*\n\s*canonical:\s*'([^']+)'/g,
)].map(([, id, intent, canonical]) => ({ id, intent, canonical }));

if (clusters.length === 0) {
  console.error('\n✗ topic-map.ts parsed to zero clusters — this guard would check nothing.\n');
  process.exit(1);
}

/** Route → page file, for the static routes only. */
function routeOf(file) {
  const rel = relative(APP, dirname(file)).split(/[\\/]/).filter(Boolean);
  const segs = rel.filter((s) => !(s.startsWith('(') && s.endsWith(')')) && !s.startsWith('@'));
  return '/' + segs.join('/');
}
const pageFiles = files.filter((f) => /[\\/]page\.tsx$/.test(f));
const byRoute = new Map(pageFiles.map((f) => [routeOf(f), f]));

/* A cluster canonical that lives under a dynamic segment is checked through its
   template, because that is the file that produces every member of it. */
const dynamicParent = (route) => {
  const parent = route.slice(0, route.lastIndexOf('/'));
  return byRoute.get(`${parent}/[slug]`) ?? byRoute.get(`${parent}/[city]`);
};

const targets = [];
for (const c of clusters) {
  const file = byRoute.get(c.canonical) ?? dynamicParent(c.canonical);
  if (!file) {
    console.error(`\n✗ cluster ${c.id} → ${c.canonical} has no page file. Run pnpm seo:topics.\n`);
    process.exit(1);
  }
  targets.push({ label: c.canonical, id: c.id, intent: c.intent, file });
}
/* Deduplicate: several clusters can resolve to one template (all the guides). */
const seenFile = new Set();
const checked = targets.filter((t) => (seenFile.has(t.file) ? false : seenFile.add(t.file)));

/* ── breadcrumbs on every deep page ───────────────────────────────────────
 * A page two or more segments from the root without BreadcrumbList gives Google
 * no path to display and no parent to attribute it to.
 */
const deepPages = pageFiles.filter((f) => {
  const r = routeOf(f);
  return r.split('/').filter(Boolean).length >= 2 &&
    !['/api', '/admin', '/mypage', '/docs', '/md'].some((p) => r.startsWith(p));
});

/* ── run ──────────────────────────────────────────────────────────────────── */
const problems = [];
const rows = [];

for (const t of checked) {
  const links = effectiveLinks(t.file);
  const counts = Object.fromEntries(Object.keys(QUOTA_MONEY).map((k) => [k, countIn(links, k)]));
  const unresolvable = unresolvableLinks(srcOf.get(t.file) ?? '').length;
  rows.push({ ...t, counts, total: links.size, unresolvable });
  const quota = quotaFor(t.intent);
  for (const [k, need] of Object.entries(quota)) {
    if (need === 0) continue;
    if (counts[k] < need) {
      problems.push({
        where: `${t.label}  (${relative(ROOT, t.file)})`,
        why: `reaches ${counts[k] === Infinity ? 'all' : counts[k]} ${k}, needs ${need}`,
      });
    }
  }
}

/**
 * A page's sibling `layout.tsx` is part of what the URL renders, and for a
 * client-component page it is the ONLY place metadata and JSON-LD can live —
 * Next forbids exporting `metadata` from a `'use client'` module. A scanner
 * that reads only page.tsx reports those pages as missing both, and the fix
 * someone then applies is to add a second copy somewhere it does not belong.
 */
const siblingLayout = (file) => {
  const cand = join(dirname(file), 'layout.tsx');
  return existsSync(cand) ? cand : null;
};

for (const f of deepPages) {
  const src = srcOf.get(f) ?? '';
  const layout = siblingLayout(f);
  const reachable = [f, ...(layout ? [layout] : []), ...(importsOf.get(f) ?? [])];
  const hasCrumbs = reachable.some((r) => /buildBreadcrumbList|BreadcrumbList/.test(srcOf.get(r) ?? read(r)));
  if (!hasCrumbs) {
    problems.push({
      where: `${routeOf(f)}  (${relative(ROOT, f)})`,
      why: 'a deep page with no BreadcrumbList — Google has no parent to attribute it to and no path to display',
    });
  }
}

/* ── report ───────────────────────────────────────────────────────────────── */
console.log('');
console.log(`LINK DENSITY — ${checked.length} commercial/decision page(s), ${deepPages.length} deep page(s)`);
console.log('');
const H = ['services', 'guides', 'caseStudies', 'papers', 'framework', 'cta'];
console.log(`  ${'page'.padEnd(42)}${'tier'.padStart(9)}${H.map((h) => h.slice(0, 5).padStart(7)).join('')}${'unres'.padStart(7)}`);
for (const r of rows.sort((a, b) => a.label.localeCompare(b.label))) {
  const cells = H.map((h) => {
    const v = r.counts[h];
    const s = v === Infinity ? 'all' : String(v);
    const need = quotaFor(r.intent)[h];
    return (need > 0 && v < need ? `${s}✗` : need === 0 ? `${s}·` : s).padStart(7);
  }).join('');
  console.log(`  ${r.label.padEnd(42)}${TIER_LABEL(r.intent).padStart(9)}${cells}${String(r.unresolvable || '').padStart(7)}`);
}
console.log('');

if (LIST) {
  for (const r of rows) {
    console.log(`  ${r.label}`);
    for (const l of [...effectiveLinks(r.file)].sort()) console.log(`      ${l}`);
    console.log('');
  }
}

if (problems.length) {
  console.error(`✗ ${problems.length} link-density problem(s):\n`);
  for (const p of problems) {
    console.error(`  ${p.where}`);
    console.error(`    → ${p.why}\n`);
  }
  console.error(
    'Add the links in content, with anchor text that says where they go. Do not add a\n' +
      'block of bare links to satisfy this — the quota exists because a reader needs those\n' +
      'six things, and a footer of naked URLs gives them none of it.\n',
  );
  process.exit(1);
}

console.log('✓ link density verified — every commercial page reaches services, guides, evidence, method, standard and a CTA\n');
process.exit(0);
