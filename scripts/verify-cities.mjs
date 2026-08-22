#!/usr/bin/env node
/**
 * scripts/verify-cities.mjs
 *
 * Fails when a service-area page would render without local content, when a
 * city asserts a specific job, or when the schema's coverage is typed by hand
 * instead of derived.
 *
 * WHY THIS EXISTS
 *
 * Sixteen areas are published. `CITY_CONTENT` had content for one of them.
 *
 * The other fifteen rendered the same generic paragraph with a place name
 * substituted in — fifteen URLs in the sitemap, competing for fifteen local
 * queries, by being the same page. That is the textbook definition of thin
 * content and it is the most common reason a service-area set sits indexed and
 * unranked. Nothing in the repository noticed, because every one of those pages
 * built, typechecked, returned 200 and had a correct canonical.
 *
 * The second half of the same problem was in the entity graph. Each of the six
 * services in `root-schema.ts` carried its own hand-written `areaServed` array,
 * and they disagreed with each other: installation and refinishing listed four
 * areas, restoration three, custom inlays exactly one. Nothing had decided that
 * inlays stop at the city line — the arrays were written at different times and
 * never reconciled. A proposed patch fixed the disagreement by hand-writing the
 * same ten areas six times, which fixes today and rebuilds the mechanism.
 *
 * WHAT IT DOES
 *
 * 1. Every entry in AREAS has a CITY_CONTENT key, and every key is an AREA.
 * 2. Each entry has a non-empty intro, at least three neighbourhoods, and a
 *    housing note — the three fields that make the page specific to the place.
 * 3. No entry carries `signatureProject`. That is the one field that asserts a
 *    real job, and no job has been confirmed for publication. See
 *    docs/outreach/CLAIMS_REGISTER.md.
 * 4. No two entries share an intro or a housing note. Duplicated copy across
 *    city pages is the failure this guard exists to prevent, and pasting one
 *    entry sixteen times would otherwise satisfy every check above.
 * 5. `root-schema.ts` declares no hand-written areaServed array — coverage is
 *    derived from CITIES, so the schema cannot claim an area with no page or
 *    omit one that has a page.
 *
 *   node scripts/verify-cities.mjs
 *   node scripts/verify-cities.mjs --list
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SEO = path.join(ROOT, 'apps/web/lib/seo-data.ts');
const SCHEMA = path.join(ROOT, 'apps/web/lib/schema/root-schema.ts');
const LIST = process.argv.includes('--list');

const strip = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * Cities whose signatureProject is confirmed and published. Adding a slug here
 * is a statement that the job described is real and cleared for publication.
 */
const SIGNATURE_BASELINE = new Set(['downtown-toronto']);

const src = strip(fs.readFileSync(SEO, 'utf8'));
const problems = [];

/* ── the published areas ──────────────────────────────────────────────────── */
const areasBlock = src.match(/const AREAS = \[([\s\S]*?)\];/);
if (!areasBlock) {
  console.error('verify-cities: could not read AREAS from seo-data.ts');
  process.exit(2);
}
const slugify = (s) =>
  s.toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const areas = [...areasBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

/* ── the content map ──────────────────────────────────────────────────────── */
const contentStart = src.indexOf('export const CITY_CONTENT');
if (contentStart === -1) {
  console.error('verify-cities: could not find CITY_CONTENT');
  process.exit(2);
}
const contentSrc = src.slice(contentStart);

/** Split the object into per-key blocks by brace matching. */
const entries = new Map();
const keyRe = /\n {2}'?"?([a-z-]+)'?"?:\s*\{/g;
let m;
while ((m = keyRe.exec(contentSrc)) !== null) {
  const open = contentSrc.indexOf('{', m.index);
  let depth = 0;
  let i = open;
  for (; i < contentSrc.length; i++) {
    if (contentSrc[i] === '{') depth++;
    else if (contentSrc[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  entries.set(m[1], contentSrc.slice(open, i + 1));
}

/* ── 1. coverage, both directions ─────────────────────────────────────────── */
for (const a of areas) {
  const slug = slugify(a);
  if (!entries.has(slug)) {
    problems.push({
      where: `CITY_CONTENT['${slug}']`,
      detail: `${a} is a published service area with no local content — its page renders the generic paragraph with a place name substituted in`,
    });
  }
}
const areaSlugs = new Set(areas.map(slugify));
for (const k of entries.keys()) {
  if (!areaSlugs.has(k)) {
    problems.push({ where: `CITY_CONTENT['${k}']`, detail: 'has content but is not in AREAS — no page renders it' });
  }
}

/* ── 2 & 3. each entry is specific, and asserts no job ────────────────────── */
/**
 * Reads a string field, single- or double-quoted. The first version of this
 * matched single quotes only and reported the one pre-existing entry —
 * downtown-toronto, written with double quotes — as having a zero-length intro,
 * a zero-length housing note and no neighbourhoods. Three confident findings
 * about content that was there and correct. A guard that cannot read the code
 * it polices is worse than no guard, which is the lesson of F-149 in a
 * different file.
 */
const field = (block, name) => {
  for (const q of ["'", '"']) {
    const r = new RegExp(`${name}:\\s*\\n?\\s*${q}((?:[^${q}\\\\]|\\\\.)*)${q}`);
    const hit = block.match(r);
    if (hit) return hit[1];
  }
  return '';
};
for (const [slug, block] of entries) {
  const intro = field(block, 'intro');
  const housing = field(block, 'housingNote');
  const hoods = (block.match(/neighbourhoods:\s*\[([\s\S]*?)\]/) || [, ''])[1];
  const hoodCount = [...hoods.matchAll(/'[^']+'|"[^"]+"/g)].length;

  if (intro.length < 80) problems.push({ where: slug, detail: `intro is ${intro.length} characters — too short to be about this place` });
  if (housing.length < 80) problems.push({ where: slug, detail: `housingNote is ${housing.length} characters — too short to be about this place` });
  if (hoodCount < 3) problems.push({ where: slug, detail: `${hoodCount} neighbourhood(s) listed — at least 3` });
  /**
   * signatureProject asserts a specific real job. That is exactly the kind of
   * claim this project does not invent — but downtown-toronto has carried one
   * since long before this guard, it is published, and it reads as a genuine
   * account of a genuine job. A guard is not licence to delete approved
   * content because it is the kind of content that needs approval.
   *
   * So this is a ratchet with a baseline, like verify-tokens and verify-schema:
   * what is already published stays, and a NEW one fails the build until
   * someone adds it here deliberately, having confirmed the job.
   */
  if (/signatureProject\s*:/.test(block) && !SIGNATURE_BASELINE.has(slug)) {
    problems.push({
      where: slug,
      detail:
        'declares signatureProject, which asserts a specific real job. If it is confirmed for ' +
        'publication, add the slug to SIGNATURE_BASELINE in this file. See docs/outreach/CLAIMS_REGISTER.md.',
    });
  }
}

/* ── 4. no two cities share copy ──────────────────────────────────────────── */
for (const name of ['intro', 'housingNote']) {
  const seen = new Map();
  for (const [slug, block] of entries) {
    const v = field(block, name);
    if (!v) continue;
    if (seen.has(v)) {
      problems.push({
        where: `${seen.get(v)} and ${slug}`,
        detail: `share the same ${name} — duplicated copy across city pages is the exact failure this guard exists to prevent`,
      });
    } else seen.set(v, slug);
  }
}

/* ── 5. the schema derives its coverage ───────────────────────────────────── */
const schema = strip(fs.readFileSync(SCHEMA, 'utf8'));
const handWritten = [...schema.matchAll(/areaServed:\s*\[[^\]]*'[^']+'[^\]]*\]/g)];
if (handWritten.length) {
  problems.push({
    where: 'lib/schema/root-schema.ts',
    detail: `${handWritten.length} hand-written areaServed array(s). Derive from CITIES so the graph cannot claim an area with no page, or omit one that has a page.`,
  });
}
if (!/CITIES/.test(schema)) {
  problems.push({ where: 'lib/schema/root-schema.ts', detail: 'does not reference CITIES — coverage is not derived from the published areas' });
}

/* ── report ───────────────────────────────────────────────────────────────── */
if (LIST) for (const k of entries.keys()) console.log(`  ✓ /service-areas/${k}`);

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s) in the service-area coverage:\n`);
  for (const p of problems) console.error(`  · ${p.where}\n      ${p.detail}\n`);
  console.error(
    '  A service-area page with no local content is the same page as fifteen others\n' +
      '  with a place name swapped in. That is what thin content is, and it is why a\n' +
      '  local page set can sit indexed and unranked for months.\n',
  );
  process.exit(1);
}

console.log(`✓ cities verified — ${areas.length} area(s), each with distinct local content; schema coverage derived from CITIES`);
