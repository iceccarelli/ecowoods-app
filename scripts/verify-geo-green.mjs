#!/usr/bin/env node
/**
 * scripts/verify-geo-green.mjs — the green gate.
 *
 * A city is not done because a page file exists. It is done when a human and a
 * crawler can open /service-areas/{slug}, understand that Ecowoods takes the
 * work there, book a measure, and find the same fact on the sitemap, in the
 * schema's areaServed, in llms.txt, in the markdown twin and in the API.
 *
 * Every other guard in this repository checks one surface. This one checks that
 * the surfaces agree, because the failure this repository has actually shipped
 * is not a broken page — it is two true-looking pages that contradict each
 * other, and a crawler resolving the contradiction against us.
 *
 * WHAT IT REFUSES
 *
 *  1. A published area with no market record. The page would claim coverage the
 *     registry never confirmed.
 *  2. A market that is operational, carries real local content, and has no
 *     page. That is a written page nobody can reach.
 *  3. A published area outside every corridor. An orphan in the geography graph
 *     is an orphan in the internal link graph.
 *  4. A retired status leaking into shipped code: us-proxy, "advertising reach",
 *     "never service area", "not a service area". Those described a world that
 *     ended on 2026-09-10 and they contradict every page published since.
 *     `assessment` is NOT retired and is not checked here: London, Kingston and
 *     the rest of southern Ontario are genuinely served on assessment and the
 *     location graph says so correctly.
 *  5. A hardcoded territory count. "thirty-two areas" was true once, was wrong
 *     for months, and appeared on four surfaces. Counts are derived.
 *  6. A second address or telephone number anywhere in the geography. There is
 *     one shop, one showroom and one number, and they are in Toronto.
 *  7. The two sentences every page owes the reader being split across JSX text
 *     nodes, where React's separator comments make them unliftable by a string
 *     extractor.
 *
 *   node scripts/verify-geo-green.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const WEB = join(ROOT, 'apps/web');
const fail = [];
const read = (rel) => {
  const p = join(WEB, rel);
  if (!existsSync(p)) { fail.push(`${rel} is missing`); return ''; }
  return readFileSync(p, 'utf8');
};

const seo = read('lib/seo-data.ts');
const marketsSrc = read('content/geo/markets.ts');
const corridorsSrc = read('content/geo/corridors.ts');

const slugifyRaw = (x) =>
  x.toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const overrides = Object.fromEntries(
  [...(/AREA_SLUG_OVERRIDES[^=]*=\s*\{([\s\S]*?)\};/.exec(seo)?.[1] ?? '')
    .matchAll(/'([^']+)':\s*'([a-z0-9-]+)'/g)].map((m) => [m[1], m[2]]),
);
const slugify = (x) => overrides[x] ?? slugifyRaw(x);

/* ── the published set ───────────────────────────────────────────────────── */
const listOf = (re, pick = (m) => m[1]) => {
  const block = re.exec(seo);
  return block ? [...block[1].matchAll(/'([^']+)'/g)].map(pick) : [];
};
const areas = listOf(/const AREAS = \[([\s\S]*?)\];/);
const hoods = listOf(/const NEIGHBOURHOODS = \[([\s\S]*?)\];/);
const extra = listOf(/const EXTRA_TORONTO = \[([\s\S]*?)\];/);
const districtBlock = /const DISTRICTS: [^=]*=\s*\[([\s\S]*?)\];/.exec(seo);
const districts = districtBlock
  ? [...districtBlock[1].matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1])
  : [];
const published = [...areas, ...hoods, ...extra, ...districts].map(slugify);

if (published.length < 60) {
  fail.push(`read ${published.length} published area(s) — the reader is blind and this gate checks nothing`);
}

/* ── the registry ────────────────────────────────────────────────────────── */
const registry = new Map();
/*
 * One record per line. `partOf` is read by looking for the district marker and
 * the slug that follows it, rather than by an optional tail group on the whole
 * call — the first version of this used the latter, never matched, and reported
 * all thirty-seven districts as corridor orphans. Every one of them inherits
 * its corridor through its municipality, which is the entire design.
 */
for (const line of marketsSrc.split('\n')) {
  const mm = /\bm\(\s*'([^']+)',\s*'([a-z0-9-]+)',\s*'([a-z-]+)'/.exec(line);
  if (!mm) continue;
  const district = /'district'\s*,\s*'([a-z0-9-]+)'/.exec(line);
  registry.set(mm[2], { slug: mm[2], status: mm[3], country: 'CA', partOf: district?.[1] });
}
for (const line of marketsSrc.split('\n')) {
  const um = /\bus\(\s*'([^']+)',\s*'([a-z0-9-]+)'/.exec(line);
  if (!um) continue;
  const district = /'district'\s*,\s*'([a-z0-9-]+)'/.exec(line);
  registry.set(um[2], { slug: um[2], status: 'us', country: 'US', partOf: district?.[1] });
}
if (registry.size < 60) {
  fail.push(`read ${registry.size} market(s) from the registry — the reader is blind`);
}

/* ── the content map ─────────────────────────────────────────────────────── */
const contentKeys = new Set();
const cStart = seo.indexOf('export const CITY_CONTENT');
if (cStart !== -1) {
  for (const m of seo.slice(cStart).matchAll(/\n {2}'?"?([a-z0-9-]+)'?"?:\s*\{/g)) contentKeys.add(m[1]);
}

/* ── 1. every published area has a market record ─────────────────────────── */
for (const slug of published) {
  if (!registry.has(slug)) {
    fail.push(
      `/service-areas/${slug} is published but has no record in content/geo/markets.ts. The page claims coverage ` +
        'the registry never confirmed, and the API and the schema will disagree with it.',
    );
  }
  if (!contentKeys.has(slug)) {
    fail.push(`/service-areas/${slug} is published with no local content — it renders a template with a name in it`);
  }
}

/* ── 2. every market with content is published ───────────────────────────── */
const publishedSet = new Set(published);
for (const slug of contentKeys) {
  if (!publishedSet.has(slug)) {
    fail.push(
      `${slug} has local content written for it and no page renders it. That is a page that exists in the ` +
        'repository and nowhere a reader or a crawler can reach.',
    );
  }
}

/* ── 3. no orphan in the corridor graph ──────────────────────────────────── */
const corridorMembers = new Set();
for (const cm of corridorsSrc.matchAll(/members:\s*\[([\s\S]*?)\],/g)) {
  for (const s of cm[1].matchAll(/'([^']+)'/g)) corridorMembers.add(s[1]);
}
if (corridorMembers.size < 30) fail.push('read fewer than thirty corridor members — the corridor reader is blind');
for (const slug of published) {
  const rec = registry.get(slug);
  if (!rec) continue;
  const reachable = corridorMembers.has(slug) || (rec.partOf && corridorMembers.has(rec.partOf));
  if (!reachable) {
    fail.push(
      `${slug} is published and sits on no corridor, directly or through its municipality. It is an orphan in the ` +
        'geography graph, which makes it an orphan in the internal link graph.',
    );
  }
}

/* ── 4 + 5 + 6. no contradiction left in shipped code ────────────────────── */
const RETIRED = [
  [/\bus-proxy\b/, 'us-proxy — a retired status meaning "advertising reach, no page"'],
  [/advertising reach/i, '"advertising reach" — every named market is a service area'],
  [/never (?:appear as|be) service area/i, '"never service area" — contradicted by every published New York page'],
  [/not a service area/i, '"not a service area"'],
];
/*
 * A TYPED TERRITORY COUNT, IN ANY SHAPE.
 *
 * The first version of this looked for two specific numbers next to the word
 * "areas". It missed "Nine routes, and what coverage means" sitting in the
 * primary navigation for as long as there were eleven corridors — a stale count
 * on the most-seen component on the site, in the one place a visitor reads
 * before deciding the site knows what it is talking about.
 *
 * Any written-out number in front of a territory noun is now a failure. Counts
 * come from the registry; a typed one is correct until it is not, and nothing
 * tells you when.
 */
/* From three upward. "one" and "two" appear in code (`const one = MARKETS…`)
   and in prose about two areas of a house; nobody has ever typed a stale
   territory count as "two". */
const NUMBER_WORD = '(?:three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|twenty|twenty-six|thirty|thirty-two|forty|forty-five|fifty|sixty|seventy|eighty|ninety|hundred)';
const TERRITORY_NOUN = '(?:areas|area pages|municipalit\\w*|service areas|corridors|routes|cities|markets|neighbourhoods)';
/* Same line only. Allowed to cross a newline it matched a case-study slug
   ending "-three-level-transition" against a `routes:` field below it. */
const STALE_COUNT = new RegExp(`\\b${NUMBER_WORD}\\b[^.<>{}\\n]{0,24}\\b${TERRITORY_NOUN}\\b`, 'i');
const TORONTO_PHONE = /\(?647\)?[\s.-]?244[\s.-]?5156/;
/*
 * The 555 exchange is reserved for fiction precisely so that a form placeholder
 * cannot be mistaken for a real number. Those are input hints, not business
 * facts, and failing them would teach the next person to delete this check
 * rather than the placeholder.
 */
const RESERVED_FICTIONAL = /555[\s.-]?\d{4}/;

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
};

for (const file of [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib')), ...walk(join(WEB, 'content'))]) {
  const rel = file.slice(WEB.length + 1);
  const body = stripComments(readFileSync(file, 'utf8'));
  for (const [re, what] of RETIRED) {
    if (re.test(body)) fail.push(`${rel} still ships ${what}`);
  }
  /* lib/changelog.ts is a DATED RECORD. "sixteen service areas" was true on the
     day that entry was written and rewriting it would falsify the history the
     file exists to keep. A changelog is the one place a stale number is correct. */
  if (!/changelog\.ts$/.test(rel) && STALE_COUNT.test(body)) {
    fail.push(`${rel} hardcodes a territory count. Counts are derived from the registry; a typed one goes stale silently.`);
  }
  for (const hit of body.matchAll(/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g)) {
    if (!TORONTO_PHONE.test(hit[0]) && !RESERVED_FICTIONAL.test(hit[0])) {
      fail.push(`${rel} contains a telephone number that is not the Toronto number: "${hit[0]}"`);
    }
  }
}

/* ── 7. the two required sentences are contiguous in the HTML ────────────
 *
 * Every service-area page owes the reader one sentence — Ecowoods serves this
 * place, book the measure — and every New York page owes a second saying where
 * the shop is. Both must survive being lifted verbatim by something that reads
 * HTML as a string rather than as a tree.
 *
 * Written as mixed JSX children, React's hydratable renderer separates them:
 *
 *     Ecowoods serves <!-- -->Pittsford, NY<!-- -->. Book the measure.
 *
 * A browser and any parsing crawler read that as one sentence. A naive
 * extractor does not, and a live grep for the exact sentence came back empty on
 * every New York page while finding the adjacent static one two lines below —
 * which is how this was found rather than reasoned about. Written as a single
 * template literal it renders as one text node.
 *
 * So the check is on the source: these two sentences are interpolated strings,
 * not JSX children, and a future edit that "tidies" them back into JSX fails.
 */
const areaPage = read('app/service-areas/[city]/page.tsx');
if (areaPage) {
  if (!/`Ecowoods serves \$\{[^}]+\}\. Book the measure\.`/.test(areaPage)) {
    fail.push(
      'app/service-areas/[city]/page.tsx no longer builds "Ecowoods serves {city}. Book the measure." as a single ' +
        'template literal. As mixed JSX children React splits it with separator comments and a string extractor ' +
        'cannot lift the one sentence the page exists to state.',
    );
  }
  if (!/The showroom is Toronto\. The job is in \$\{[^}]+\}\. We take this work\.`/.test(areaPage)) {
    fail.push(
      'app/service-areas/[city]/page.tsx no longer builds the New York showroom sentence as a single template ' +
        'literal. That sentence is the one that keeps a service page from reading as a local presence, and it has ' +
        'to be liftable verbatim.',
    );
  }
}

/* ── report ─────────────────────────────────────────────────────────────── */
const ca = [...registry.values()].filter((x) => x.country === 'CA').length;
const us = [...registry.values()].filter((x) => x.country === 'US').length;

console.log('\nECOWOODS GEO GREEN AUDIT');
console.log('=========================');
console.log(`Markets in registry:            ${registry.size}  (${ca} Ontario, ${us} New York)`);
console.log(`Published service-area pages:   ${published.length}`);
console.log(`Areas with local content:       ${contentKeys.size}`);
console.log(`Areas with no market record:    ${published.filter((s) => !registry.has(s)).length}`);
console.log(`Orphans (no corridor):          ${published.filter((s) => {
  const r = registry.get(s);
  return r && !corridorMembers.has(s) && !(r.partOf && corridorMembers.has(r.partOf));
}).length}`);
console.log(`Retired statuses in shipped code: ${fail.filter((f) => /still ships/.test(f)).length}`);
console.log(`Hardcoded territory counts:     ${fail.filter((f) => /hardcodes a territory count/.test(f)).length}`);
console.log(`Second address or telephone:    ${fail.filter((f) => /telephone number/.test(f)).length}`);

if (fail.length) {
  console.error('GREEN GATE: FAILED\n');
  for (const f of fail) console.error(`  · ${f}\n`);
  process.exit(1);
}
console.log('GREEN GATE: PASSED\n');
