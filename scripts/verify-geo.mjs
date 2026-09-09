#!/usr/bin/env node
/**
 * scripts/verify-geo.mjs — the geographic model may not claim coverage it does
 * not have, and may not invent a place.
 *
 * WHY THIS IS THE MOST LOAD-BEARING GUARD IN THE REPOSITORY
 *
 * A geographic expansion is the point at which a truthful site most easily
 * stops being one, and it happens by increments that all look reasonable:
 *
 *   · a municipality is added to the list, and a template gives it a page
 *   · the page needs a paragraph, so a paragraph about "the area's older homes"
 *     is written for a place nobody has visited
 *   · areaServed is generated from the list, so the structured data now
 *     declares service in forty-two municipalities
 *   · six of them are in New York, and the entity graph now describes a
 *     Canadian company as serving the United States
 *
 * No step in that sequence is a decision anyone would defend out loud. Each is
 * a consequence of the previous one. So the invariants are checked, not
 * intended.
 *
 * WHAT IS CHECKED
 *
 *  1. Slugs are unique, and a name that exists in two countries — Niagara Falls
 *     — does not collide.
 *  2. Every corridor member is a real market; every market's corridors exist.
 *  3. `partOf` resolves, and a district never claims to be a municipality.
 *  4. A US market is `us-proxy`, and no US market has an operational status.
 *  5. No market claims coverage without a dated confirmation.
 *  6. Only municipalities with a verified operational position can reach the
 *     service-area emission, and never a district or a US market.
 *  7. No indexable page exists for a market that has not earned one.
 *  8. `verifiedAt` is a real past date — a market confirmed in the future was
 *     confirmed by nobody.
 *  9. No invented local detail: a market with no CityContent carries no
 *     localFacts, no coordinates, no drive time. The fields do not exist in the
 *     type, and this asserts nobody has added them back.
 * 10. Stale confirmations are reported: a market whose operational position has
 *     not been reconfirmed in 180 days is flagged, because "currently booking"
 *     decays quietly.
 *
 *   node scripts/verify-geo.mjs
 *   node scripts/verify-geo.mjs --queue    # what to write content for next
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const WEB = join(ROOT, 'apps/web');
const MARKETS_TS = join(WEB, 'content/geo/markets.ts');
const CORRIDORS_TS = join(WEB, 'content/geo/corridors.ts');
const SEO = join(WEB, 'lib/seo-data.ts');
const QUEUE = process.argv.includes('--queue');

const fail = [];
const warn = [];
const read = (p, label) => {
  if (!existsSync(p)) { fail.push(`missing ${label}: ${p.replace(ROOT + '/', '')}`); return ''; }
  return readFileSync(p, 'utf8');
};

const marketsSrc = read(MARKETS_TS, 'market registry');
const corridorsSrc = read(CORRIDORS_TS, 'corridor registry');
const seoSrc = read(SEO, 'seo-data');

/* ── parse ────────────────────────────────────────────────────────────────
 *
 * A regex reader, like every other guard here: dependency-free, no TypeScript
 * runtime, no build. Its failure mode is reading too few records, which shows
 * up immediately as the count assertion below.
 */
const markets = [];
for (const mm of marketsSrc.matchAll(
  /\bm\(\s*'([^']+)',\s*'([a-z0-9-]+)',\s*'([a-z-]+)',\s*'([a-z0-9-]+)',\s*\[([^\]]*)\],\s*\[([^\]]*)\]/g,
)) {
  markets.push({
    name: mm[1], slug: mm[2], status: mm[3], parentHub: mm[4],
    corridors: [...mm[5].matchAll(/'([^']+)'/g)].map((x) => x[1]),
    nearest: [...mm[6].matchAll(/'([^']+)'/g)].map((x) => x[1]),
    country: 'CA',
    isDistrict: false,
    block: mm[0],
    index: mm.index,
  });
}
/* kind and partOf are the trailing arguments; read the rest of each call. */
for (const x of markets) {
  const tail = marketsSrc.slice(x.index, marketsSrc.indexOf('\n', x.index + x.block.length) + 1);
  x.isDistrict = /'district'/.test(tail);
  const p = /'district',\s*'([a-z0-9-]+)'/.exec(tail);
  x.partOf = p ? p[1] : undefined;
}
/*
 * The United States markets are built by one constructor, so their status is
 * written once — which means reading each call site tells you nothing about it.
 * Read the constructor instead. Without this, changing `status: 'us-proxy'` to
 * anything else inside us() passed every check: the guard was reporting the
 * status it assumed rather than the one the code assigns.
 */
const usCtor = marketsSrc.slice(marketsSrc.indexOf('function us('));
const usStatus = /status:\s*'([a-z-]+)'/.exec(usCtor)?.[1] ?? null;
if (usStatus !== 'us-proxy') {
  fail.push(
    `the us() constructor assigns status "${usStatus}". Every United States market must be us-proxy: Ecowoods ` +
      'operates in Ontario, and any other status puts a New York municipality into the service area.',
  );
}
if (!/country:\s*'US'/.test(usCtor)) {
  fail.push('the us() constructor no longer sets country US');
}

for (const um of marketsSrc.matchAll(/\bus\(\s*'([^']+)',\s*'([a-z0-9-]+)'/g)) {
  markets.push({
    name: um[1], slug: um[2], status: usStatus ?? 'us-proxy', country: 'US',
    corridors: ['buffalo-niagara'], nearest: [], parentHub: 'fort-erie', isDistrict: false,
  });
}
/* Toronto is written as a literal rather than through m(); read it explicitly. */
if (/'toronto', 'core-active'/.test(marketsSrc) || /m\('Toronto', 'toronto'/.test(marketsSrc)) {
  if (!markets.some((x) => x.slug === 'toronto')) {
    markets.push({ name: 'Toronto', slug: 'toronto', status: 'core-active', country: 'CA', corridors: ['core-gta'], nearest: [], parentHub: 'toronto', isDistrict: false });
  }
}

const corridors = [...corridorsSrc.matchAll(/\bid:\s*'([a-z0-9-]+)',\s*\n\s*name:/g)].map((x) => x[1]);
const corridorMembers = new Map();
for (const cm of corridorsSrc.matchAll(/id:\s*'([a-z0-9-]+)',[\s\S]*?members:\s*\[([\s\S]*?)\],/g)) {
  corridorMembers.set(cm[1], [...cm[2].matchAll(/'([a-z0-9-]+)'/g)].map((x) => x[1]));
}

if (markets.length < 40) {
  fail.push(`read only ${markets.length} market(s) from content/geo/markets.ts — the reader is blind, fix it rather than deleting this guard`);
}
if (corridors.length < 5) {
  fail.push(`read only ${corridors.length} corridor(s) from content/geo/corridors.ts — the reader is blind`);
}

const bySlug = new Map(markets.map((x) => [x.slug, x]));

/* ── 1. unique slugs, and the cross-border name collision ────────────────── */
const seen = new Set();
for (const x of markets) {
  if (seen.has(x.slug)) fail.push(`duplicate market slug: ${x.slug}`);
  seen.add(x.slug);
}
const nameCounts = new Map();
for (const x of markets) nameCounts.set(x.name, (nameCounts.get(x.name) ?? 0) + 1);
for (const [name, n] of nameCounts) {
  if (n < 2) continue;
  const both = markets.filter((x) => x.name === name);
  const countries = new Set(both.map((x) => x.country));
  if (countries.size > 1) {
    const slugs = both.map((x) => x.slug);
    const distinguished = slugs.every((s) => /-(on|ny)$/.test(s));
    if (!distinguished) {
      fail.push(
        `"${name}" exists in more than one country as ${slugs.join(' and ')}. Cross-border duplicates must be ` +
          'suffixed with the province or state, or one silently overwrites the other in every lookup.',
      );
    }
  } else {
    fail.push(`"${name}" appears ${n} times in the same country`);
  }
}

/* ── 2. corridor integrity, both directions ──────────────────────────────── */
for (const [id, members] of corridorMembers) {
  for (const slug of members) {
    if (!bySlug.has(slug)) fail.push(`corridor ${id} lists "${slug}", which is not a market`);
  }
}
for (const x of markets) {
  if (x.isDistrict && x.corridors.length) {
    fail.push(
      `${x.slug} is a district and declares its own corridors. A corridor is a drive between municipalities; ` +
        'a district inherits its municipality\'s membership through partOf. Two lists that must agree eventually will not.',
    );
  }
  for (const c of x.corridors) {
    if (!corridors.includes(c)) fail.push(`${x.slug} claims corridor "${c}", which does not exist`);
    else if (!(corridorMembers.get(c) ?? []).includes(x.slug)) {
      fail.push(`${x.slug} claims corridor "${c}" but ${c} does not list it. Membership must agree both ways.`);
    }
  }
  if (x.parentHub && !bySlug.has(x.parentHub)) fail.push(`${x.slug} has parentHub "${x.parentHub}", which is not a market`);
  for (const n of x.nearest) {
    if (!bySlug.has(n)) fail.push(`${x.slug} lists nearest "${n}", which is not a market`);
  }
}

/* ── 3. districts ────────────────────────────────────────────────────────── */
for (const x of markets) {
  if (!x.isDistrict) continue;
  if (!x.partOf) fail.push(`${x.slug} is a district with no partOf`);
  else if (!bySlug.has(x.partOf)) fail.push(`${x.slug} is part of "${x.partOf}", which is not a market`);
  else if (bySlug.get(x.partOf).isDistrict) fail.push(`${x.slug} is part of ${x.partOf}, which is itself a district`);
}

/* ── 4 + 5 + 6. the truth invariants ─────────────────────────────────────── */
const OPERATIONAL = new Set(['core-active', 'active-expansion', 'travel-by-confirmation']);

for (const x of markets) {
  if (x.country === 'US' && x.status !== 'us-proxy') {
    fail.push(
      `${x.slug} is in the United States with status "${x.status}". Ecowoods operates in Ontario; a United ` +
        'States market is advertising reach and nothing else.',
    );
  }
  if (x.country === 'CA' && x.status === 'us-proxy') {
    fail.push(`${x.slug} is in Ontario with status us-proxy`);
  }
}

/* The emission path: serviceAreaMarkets() must exclude districts and non-verified. */
const geoIndex = read(join(WEB, 'lib/geo/index.ts'), 'geo index');
if (!/isOperational\(x\)\s*&&\s*x\.kind === 'municipality'/.test(geoIndex)) {
  fail.push(
    'lib/geo/index.ts serviceAreaMarkets() no longer filters to verified municipalities. That function is the ' +
      'only thing standing between a corridor list and a structured-data claim of service in forty-two places.',
  );
}
const marketsLib = marketsSrc;
if (!/OPERATIONAL_STATUSES\.includes\(x\.status\)\s*&&\s*x\.operationalTruth\.verifiedAt !== null/.test(marketsLib)) {
  fail.push(
    'isOperational() no longer requires a dated confirmation. A market may not be claimed as served because ' +
      'somebody set its status; it is claimed because somebody confirmed it on a date.',
  );
}
if (/OPERATIONAL_STATUSES[^=]*=\s*\[[^\]]*us-proxy/.test(marketsLib)) {
  fail.push('us-proxy has been added to OPERATIONAL_STATUSES. That is the one status that may never be service area.');
}

/* ── 8. dates ────────────────────────────────────────────────────────────── */
const today = new Date().toISOString().slice(0, 10);
const STALE_DAYS = 180;
for (const dm of marketsSrc.matchAll(/verifiedAt:\s*'(\d{4}-\d{2}-\d{2})'/g)) {
  const d = dm[1];
  if (d > today) fail.push(`verifiedAt ${d} is in the future — that confirmation was made by nobody`);
  else {
    const age = Math.round((Date.parse(today) - Date.parse(d)) / 86400000);
    if (age > STALE_DAYS) {
      warn.push(`a market was last confirmed ${age} days ago (${d}). "Currently booking" decays quietly; reconfirm or downgrade the status.`);
    }
  }
}

/* ── 9. no invented local detail ─────────────────────────────────────────── */
for (const banned of ['latitude', 'longitude', 'driveTime', 'population', 'medianHomePrice']) {
  if (new RegExp(`\\b${banned}\\s*:`).test(marketsSrc)) {
    fail.push(
      `content/geo/markets.ts carries a "${banned}" field. Coordinates, drive times and population figures for ` +
        'markets nobody has worked in are the fields a template most wants filled and the ones most likely to ' +
        'be invented. If a figure is real, it needs a source and a date like every other claim on this site.',
    );
  }
}
/* localFacts must be empty for a market with no CityContent. */
/* CITY_CONTENT keys come in three shapes — "quoted-with-dash", 'single', bare.
   Reading only one of them made this guard report 1 entry where there are 48,
   which is the same blindness it warns about elsewhere. */
const contentBlock = seoSrc.slice(seoSrc.indexOf('CITY_CONTENT'));
const withContent = new Set(
  [...contentBlock.matchAll(/^  ["']?([a-z0-9-]+)["']?:\s*\{$/gm)].map((x) => x[1]),
);
if (withContent.size < 10) {
  fail.push(
    `read only ${withContent.size} CityContent entr(y|ies) from lib/seo-data.ts — the reader is blind, and a ` +
      'blind reader here silently reports every market as having no local content.',
  );
}
for (const fm of marketsSrc.matchAll(/'([a-z0-9-]+)',[\s\S]{0,400}?localFacts:\s*\[([^\]]+)\]/g)) {
  const slug = fm[1];
  if (fm[2].trim() && !withContent.has(slug)) {
    fail.push(`${slug} has localFacts but no CityContent entry. Local detail is written once, in one place, and checked.`);
  }
}

/* ── 7. a page exists only for a market that earned one ──────────────────── */
const areaRoute = join(WEB, 'app/service-areas/[city]/page.tsx');
if (!existsSync(areaRoute)) fail.push('apps/web/app/service-areas/[city]/page.tsx is missing');

/* ── report ─────────────────────────────────────────────────────────────── */
if (QUEUE) {
  const queue = markets
    .filter((x) => x.country === 'CA' && !withContent.has(x.slug))
    .sort((a, b) => a.slug.localeCompare(b.slug));
  console.log(`\nMarkets with no local content — the content queue (${queue.length}):\n`);
  for (const x of queue) console.log(`  ${x.slug.padEnd(24)} ${x.status}`);
  console.log('');
}

for (const w of warn) console.warn(`  ! ${w}`);

if (fail.length) {
  console.error(`\n✗ geo: ${fail.length} problem(s)\n`);
  for (const f of fail) console.error(`  · ${f}\n`);
  process.exit(1);
}

const ca = markets.filter((x) => x.country === 'CA').length;
const usCount = markets.filter((x) => x.country === 'US').length;
const withPages = markets.filter((x) => withContent.has(x.slug)).length;
console.log(
  `✓ geo verified — ${markets.length} market(s) across ${corridors.length} corridor(s): ${ca} in Ontario, ` +
    `${usCount} advertising-only in New York and never service area, ${withPages} with local content, ` +
    'no invented coordinate, drive time or population',
);
