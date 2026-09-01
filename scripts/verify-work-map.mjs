#!/usr/bin/env node
/**
 * scripts/verify-work-map.mjs
 *
 * The map of completed work is the one feature on this site that could publish
 * somebody's home address. This guard exists so that it structurally cannot.
 *
 * SIX CHECKS
 *
 *  1. NO ADDRESS, STRUCTURALLY. No Canadian postal code, no "123 Something
 *     Street", no unit or apartment number, and no field named address, street,
 *     postal, unit, suite or civic — anywhere in the file. Not a lint: the
 *     shapes are rejected by pattern, so the mistake cannot be typed in.
 *
 *  2. THREE DECIMAL PLACES, NOT FOUR. 3 dp is ~110 m: a neighbourhood. 4 dp is
 *     ~11 m: a house. The difference between "we work in Rosedale" and "we
 *     worked at this address" is one keystroke, so the keystroke is banned
 *     rather than trusted to memory.
 *
 *  3. INSIDE THE FRAME. Every pin falls within the GTA bounding box. This
 *     catches the classic transposition — lat and lng swapped puts Rosedale in
 *     Antarctica, and a map is the one component where wrong data still looks
 *     plausible because it is just a dot in a slightly different place.
 *
 *  4. EVERY PIN IS EVIDENCE. Each entry names a case study that exists, and its
 *     year, square footage and neighbourhood are re-read from that .mdx and
 *     compared. A pin cannot be added by typing one; it is added by publishing
 *     the job. Same contract as verify-job-cards.mjs.
 *
 *  5. THE AREA IS A REAL PAGE. areaSlug resolves to a served
 *     /service-areas/<slug>, so every pin can link somewhere a visitor can go,
 *     and serviceSlug resolves to a real /services/<slug>.
 *
 *  6. UNVERIFIED COORDINATES DO NOT REACH SCHEMA. While COORDS_VERIFIED is
 *     false, no GeoCoordinates node may be emitted. A drawn map at 60 km wide
 *     tolerates a 300 m error; a machine-readable claim does not, because
 *     nothing downstream will ever re-check it.
 *
 *   node scripts/verify-work-map.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FILE = path.join(ROOT, 'apps/web/content/work-map.ts');
const CASE_DIR = path.join(ROOT, 'apps/web/content/case-studies');
const SEO = path.join(ROOT, 'apps/web/lib/seo-data.ts');
const SERVICE_PAGES = path.join(ROOT, 'apps/web/lib/service-pages.ts');

if (!fs.existsSync(FILE)) {
  console.error('verify-work-map: apps/web/content/work-map.ts not found.');
  process.exit(2);
}
const src = fs.readFileSync(FILE, 'utf8');
const fail = [];

/* ── 1. nothing that could be an address ─────────────────────────────────── */
const BANNED = [
  [/\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/, 'a Canadian postal code'],
  // 1–3 capitalised words before the thoroughfare type: "18 Chestnut Park Road",
  // "4 Rosedale Heights Drive". An earlier version allowed exactly one word and
  // therefore missed every two-word street in the city, which is most of them.
  [/\b\d{1,5}\s+(?:[A-Z][a-zA-Z'-]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Crescent|Cres|Drive|Dr|Boulevard|Blvd|Lane|Ln|Court|Crt|Place|Pl|Way|Terrace|Trail|Gardens|Gate|Park)\b/, 'a street address'],
  [/\b(?:unit|apt|apartment|suite)\s*#?\s*\d+/i, 'a unit or suite number'],
  // The key is matched as a SUBSTRING and case-insensitively. `streetAddress:`,
  // `civicNumber:`, `postalCode:` are all the same mistake wearing camelCase,
  // and an exact-token match caught none of them — the first negative test of
  // this guard put a real Rosedale address in the file and it passed.
  [/^[ \t]*\w*(?:address|street|postal|postcode|unit|suite|civic|housenumber)\w*[ \t]*[?!]?:/mi, 'a field that holds an address'],
];
for (const [re, what] of BANNED) {
  const m = src.match(re);
  if (m) fail.push(`work-map.ts contains ${what}: "${m[0].trim()}". This file publishes neighbourhoods, never locations.`);
}

/* ── parse the entries ───────────────────────────────────────────────────── */
const entries = [];
for (const block of src.split(/\n\s*\{\s*\n/).slice(1)) {
  const body = block.split(/\n\s*\},?\s*\n/)[0];
  const get = (k) => {
    const m = body.match(new RegExp(`\\b${k}:\\s*'([^']*)'`)) || body.match(new RegExp(`\\b${k}:\\s*(-?[\\d.]+)`));
    return m ? m[1] : null;
  };
  if (!get('areaSlug')) continue;
  entries.push({
    areaSlug: get('areaSlug'),
    label: get('label'),
    lat: get('lat'),
    lng: get('lng'),
    year: get('year'),
    sqft: get('sqft'),
    serviceSlug: get('serviceSlug'),
    caseStudySlug: get('caseStudySlug'),
  });
}
if (!entries.length) {
  console.error('verify-work-map: read no entries out of work-map.ts — the parser is blind. Fix the reader.');
  process.exit(2);
}

/* ── 2 + 3. precision and frame ──────────────────────────────────────────── */
const bounds = (() => {
  const m = src.match(/GTA_BOUNDS\s*=\s*\{([^}]*)\}/);
  const n = (k) => Number((m[1].match(new RegExp(`${k}:\\s*(-?[\\d.]+)`)) || [])[1]);
  return { minLat: n('minLat'), maxLat: n('maxLat'), minLng: n('minLng'), maxLng: n('maxLng') };
})();

for (const e of entries) {
  for (const axis of ['lat', 'lng']) {
    const raw = e[axis];
    const dp = (raw.split('.')[1] ?? '').length;
    if (dp > 3) {
      fail.push(`${e.label}: ${axis} ${raw} has ${dp} decimal places. Three is a neighbourhood (~110 m); four is a house (~11 m). Round it.`);
    }
  }
  const lat = Number(e.lat), lng = Number(e.lng);
  if (lat < bounds.minLat || lat > bounds.maxLat || lng < bounds.minLng || lng > bounds.maxLng) {
    fail.push(`${e.label}: ${lat}, ${lng} is outside the GTA frame. Check for transposed lat/lng.`);
  }
}

/* ── 4. every pin is evidence ────────────────────────────────────────────── */
for (const e of entries) {
  const mdx = path.join(CASE_DIR, `${e.caseStudySlug}.mdx`);
  if (!fs.existsSync(mdx)) {
    fail.push(`${e.label}: caseStudySlug "${e.caseStudySlug}" has no .mdx. A pin must point at a published job.`);
    continue;
  }
  const doc = fs.readFileSync(mdx, 'utf8');
  const hood = (doc.match(/^\s*neighbourhood:\s*(.+)$/m) || [])[1]?.trim();
  const date = (doc.match(/^project-date:\s*(\d{4})-/m) || [])[1];
  const sqft = (doc.match(/^square-footage:\s*(\d+)/m) || [])[1];
  if (hood && hood !== e.label) fail.push(`${e.label}: the case study says the neighbourhood is "${hood}".`);
  if (date && date !== e.year) fail.push(`${e.label}: year ${e.year} but project-date is ${date}.`);
  if (sqft && sqft !== e.sqft) fail.push(`${e.label}: sqft ${e.sqft} but square-footage is ${sqft}.`);
}

/* ── 5. areas and services are real pages ────────────────────────────────── */
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const seo = fs.readFileSync(SEO, 'utf8');
const areaSlugs = new Set();
for (const list of ['AREAS', 'NEIGHBOURHOODS']) {
  const m = seo.match(new RegExp(`const ${list}\\s*=\\s*\\[([\\s\\S]*?)\\]`));
  if (m) for (const s of m[1].matchAll(/'([^']+)'/g)) areaSlugs.add(slugify(s[1]));
}
const serviceSlugs = new Set(
  [...fs.readFileSync(SERVICE_PAGES, 'utf8').matchAll(/slug:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]),
);
if (!areaSlugs.size || !serviceSlugs.size) {
  console.error('verify-work-map: could not read the area or service manifests — fix the reader, do not delete the check.');
  process.exit(2);
}
for (const e of entries) {
  if (!areaSlugs.has(e.areaSlug)) fail.push(`${e.label}: areaSlug "${e.areaSlug}" is in no service area, so the pin links nowhere.`);
  if (!serviceSlugs.has(e.serviceSlug)) fail.push(`${e.label}: serviceSlug "${e.serviceSlug}" is not a service we sell.`);
}

/* ── 6. unverified coordinates stay out of schema ────────────────────────── */
const verified = /COORDS_VERIFIED\s*=\s*true/.test(src);
if (!verified) {
  const schemaDirs = ['apps/web/lib/schema', 'apps/web/lib/graph', 'apps/web/lib/structured-data.ts'];
  for (const rel of schemaDirs) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) continue;
    const files = fs.statSync(p).isDirectory()
      ? fs.readdirSync(p).map((f) => path.join(p, f)).filter((f) => /\.tsx?$/.test(f))
      : [p];
    for (const f of files) {
      const s = fs.readFileSync(f, 'utf8');
      if (/work-map|WORK_PLACES/.test(s) && /GeoCoordinates/.test(s)) {
        fail.push(
          `${path.relative(ROOT, f)} emits GeoCoordinates from the work map while COORDS_VERIFIED is false. ` +
            'A drawn map tolerates a 300 m error; a machine-readable claim does not. Verify the centroids first — runbook §11.',
        );
      }
    }
  }
}

if (fail.length) {
  console.error(`✗ work map: ${fail.length} problem(s)\n`);
  for (const f of fail) console.error(`  · ${f}`);
  console.error('');
  process.exit(1);
}

const years = entries.map((e) => Number(e.year));
console.log(
  `✓ work map verified — ${entries.length} pin(s), ${new Set(entries.map((e) => e.areaSlug)).size} area(s), ` +
    `${Math.min(...years)}–${Math.max(...years)}; every figure matches its case study; ` +
    `neighbourhood precision only, no address in the file; ` +
    `coordinates ${verified ? 'verified — schema permitted' : 'UNVERIFIED — held out of schema'}`,
);
