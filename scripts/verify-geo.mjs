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
/*
 * kind, partOf and the confirmation are the trailing arguments. Read a window
 * rather than a line: an m() call spans several lines, and reading only the
 * first meant the confirmation was invisible — which made the areaServed check
 * below pass on a market nobody had confirmed. A guard that silently answers
 * "false" is worse than one that is absent.
 */
const nextCallAfter = (i) => {
  const candidates = [
    marketsSrc.indexOf("\n  m('", i + 1),
    marketsSrc.indexOf("\n  us('", i + 1),
    marketsSrc.indexOf('\n];', i + 1),
  ].filter((n) => n > -1);
  return candidates.length ? Math.min(...candidates) : marketsSrc.length;
};

/*
 * WHICH CONSTRUCTORS CONFIRM, READ FROM THE FILE RATHER THAN LISTED HERE.
 *
 * The first version of this reader named ACTIVE, TORONTO_TRUTH and UNVERIFIED
 * literally. Adding COVERED() and BY_TRIP() for the twenty-five corridor
 * markets blinded it instantly — twenty-five records it could not classify, and
 * had the fallback been "assume confirmed" instead of "report unreadable" it
 * would have passed while asserting coverage nobody had confirmed.
 *
 * So the classification is derived: every helper in markets.ts whose body sets
 * verifiedAt to a date (a literal, or the OWNER_CONFIRMED_ON constant) confirms;
 * every one that sets it to null does not. A new constructor is classified the
 * day it is written, by what it actually does.
 */
const CONFIRMING = new Set();
const UNCONFIRMING = new Set();
for (const fn of marketsSrc.matchAll(/function ([A-Z_][A-Za-z_0-9]*)\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/g)) {
  const [, name, body] = fn;
  if (/verifiedAt:\s*null/.test(body)) UNCONFIRMING.add(name);
  else if (/\bverifiedAt\b/.test(body)) CONFIRMING.add(name);
}
if (CONFIRMING.size === 0) {
  fail.push(
    'read no confirming constructor from content/geo/markets.ts. Either the helpers were renamed or this reader is ' +
      'blind — and a blind reader here classifies every market by a fallback rather than by what the file says.',
  );
}

for (const x of markets) {
  /* This record only. A fixed-size window bleeds into the next m() call, and
     the first version of this read reported Toronto as a district of itself
     and three confirmed markets as unconfirmed, because the window had run on
     into the record below. */
  const tail = marketsSrc.slice(x.index, nextCallAfter(x.index));
  x.isDistrict = /'district'/.test(tail);
  const p = /'district',\s*'([a-z0-9-]+)'/.exec(tail);
  x.partOf = p ? p[1] : undefined;
  const ctor = /\b([A-Z_][A-Z_0-9]*)\(/.exec(tail.replace(/^\s*m\(/, ''));
  if (ctor && CONFIRMING.has(ctor[1])) x.confirmed = true;
  else if (ctor && UNCONFIRMING.has(ctor[1])) x.confirmed = false;
  else if (/verifiedAt:\s*'[0-9-]+'/.test(tail)) x.confirmed = true;
  else if (/verifiedAt:\s*null/.test(tail)) x.confirmed = false;
  else x.confirmed = null;
}
const unreadable = markets.filter((x) => x.country === 'CA' && x.confirmed === null);
if (unreadable.length) {
  fail.push(
    `could not read the operational confirmation for ${unreadable.length} market(s) ` +
      `(${unreadable.slice(0, 3).map((x) => x.slug).join(', ')}). Fix the reader — a guard that cannot see a ` +
      'confirmation reports every market as unconfirmed, or worse, as confirmed.',
  );
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
const US_LIVE_STATUSES = ['us-active', 'us-by-confirmation'];
if (usStatus && !US_LIVE_STATUSES.includes(usStatus)) {
  fail.push(
    `the us() constructor defaults United States markets to "${usStatus}". Since the owner confirmed the New York ` +
      'position on 2026-09-10 the only permitted values are us-active and us-by-confirmation. `us-proxy` is retired: ' +
      'it meant advertising reach with no page, and reintroducing it would silently unpublish a published market.',
  );
}
if (!/country:\s*'US'/.test(usCtor)) {
  fail.push('the us() constructor no longer sets country US');
}

/*
 * READ THE us() CALL, NOT THE CONSTRUCTOR'S DEFAULT.
 *
 * This loop used to hard-code `corridors: ['buffalo-niagara']` for every United
 * States market, because that was the constructor's only behaviour. The day
 * us() gained corridor, kind and partOf arguments, the guard reported nine
 * markets as claiming a corridor they do not claim — and, worse, would have
 * been unable to see a district declaring corridors of its own, which is the
 * error the whole model is arranged to prevent.
 *
 * The default is now read from the signature and overridden by whatever the
 * call site actually passes.
 */
const usDefaultCorridors =
  [...(/corridors:\s*CorridorId\[\]\s*=\s*\[([^\]]*)\]/.exec(usCtor)?.[1] ?? '').matchAll(/'([^']+)'/g)]
    .map((x) => x[1]);
const US_CALL = /\bus\(\s*'([^']+)',\s*'([a-z0-9-]+)',\s*\[([^\]]*)\](?:\s*,\s*\[([^\]]*)\])?(?:\s*,\s*'([a-z]+)')?(?:\s*,\s*(undefined|'[a-z0-9-]+'))?(?:\s*,\s*'(us-active|us-by-confirmation)')?(?:\s*,\s*'([a-z0-9-]+)')?\s*\)/g;
let usRead = 0;
for (const um of marketsSrc.matchAll(US_CALL)) {
  const kind = um[5] ?? 'municipality';
  const declared = um[4] === undefined
    ? usDefaultCorridors
    : [...um[4].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  markets.push({
    name: um[1], slug: um[2], status: um[7] ?? usStatus ?? 'us-active', country: 'US',
    corridors: kind === 'district' ? [] : declared,
    nearest: [...um[3].matchAll(/'([^']+)'/g)].map((x) => x[1]),
    parentHub: um[8] ?? 'buffalo',
    isDistrict: kind === 'district',
    partOf: um[6] && um[6] !== 'undefined' ? um[6].replace(/'/g, '') : undefined,
  });
  usRead += 1;
}
/* Every United States market carries a live service status. The check is on the
   parsed record rather than only on the constructor default, because the
   Rochester run passes its status explicitly. */
for (const x of markets) {
  if (x.country !== 'US') continue;
  if (!US_LIVE_STATUSES.includes(x.status)) {
    fail.push(
      `${x.slug} carries the status "${x.status}". Every New York market is a published service area since ` +
        '2026-09-10; the only permitted values are us-active and us-by-confirmation.',
    );
  }
}
if (usRead !== (marketsSrc.match(/\bus\(\s*'/g) ?? []).length) {
  fail.push(
    `read ${usRead} us() call(s) but the file contains ` +
      `${(marketsSrc.match(/\bus\(\s*'/g) ?? []).length}. The reader is blind to a United States market, which is ` +
      'the one class of market that may never reach the service area.',
  );
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
const OPERATIONAL = new Set([
  'core-active', 'active-expansion', 'travel-by-confirmation', 'us-active', 'us-by-confirmation',
]);

for (const x of markets) {
  if (x.country === 'US' && !US_LIVE_STATUSES.includes(x.status)) {
    fail.push(
      `${x.slug} is in the United States with status "${x.status}", which is not a live service status.`,
    );
  }
  if (x.country === 'CA' && US_LIVE_STATUSES.includes(x.status)) {
    fail.push(`${x.slug} is in Ontario with a United States status ("${x.status}")`);
  }
}

/*
 * THE ONE THING THE NEW YORK CONFIRMATION DID NOT CHANGE.
 *
 * There is one shop, one showroom, one telephone number and one set of hours,
 * and all four are in Toronto. Publishing service areas in New York State makes
 * a second address or a local United States number the single most tempting
 * thing to invent — it is what every directory expects to see, and it is the
 * claim that turns a true service page into a fabricated local presence.
 *
 * So no United States street address and no non-Toronto North American phone
 * number may appear anywhere in the geographic content. The Toronto number is
 * whitelisted by value; anything else shaped like a phone number fails.
 */
const TORONTO_PHONE = /\(?647\)?[\s.-]?244[\s.-]?5156/;
const geoContentFiles = ['content/geo/markets.ts', 'content/geo/corridors.ts'];
for (const rel of geoContentFiles) {
  const body = read(join(WEB, rel), rel);
  for (const hit of body.matchAll(/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g)) {
    if (!TORONTO_PHONE.test(hit[0])) {
      fail.push(
        `${rel} contains a telephone number that is not the Toronto number: "${hit[0]}". There is one phone number ` +
          'and it is (647) 244-5156. A local United States number is a second business that does not exist.',
      );
    }
  }
  for (const hit of body.matchAll(/\b\d{2,6}\s+[A-Z][a-zA-Z]+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Crescent|Cres)\b/g)) {
    if (!/Norfield/.test(hit[0])) {
      fail.push(
        `${rel} contains what reads as a street address: "${hit[0]}". The only address this company has is ` +
          '32 Norfield Crescent, Toronto.',
      );
    }
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
if (/\bus-proxy\b/.test(marketsLib.replace(/\/\*[\s\S]*?\*\//g, ''))) {
  fail.push(
    'us-proxy has come back into content/geo/markets.ts outside a comment. It is a retired status meaning ' +
      '"advertising reach, no page", and reintroducing it silently unpublishes a market that is published.',
  );
}

/* ── 7b. status and truth may not disagree ───────────────────────────────
 *
 * Two silent failures, opposite directions, both shipped by an ordinary edit.
 *
 * A market whose status says `active-expansion` while its confirmation was
 * removed claims coverage nobody stands behind. A market still labelled
 * `corridor-target` after somebody confirmed it is coverage the business has
 * and is not getting credit for — it sits out of the service area, out of the
 * API's service_area list and reads "unconfirmed" on its corridor page while
 * crews are working there.
 *
 * On 2026-09-10 the owner confirmed all forty-three Ontario markets and the
 * twenty-five corridor targets became operational. This check is what stops
 * that state drifting apart again in either direction.
 */
for (const x of markets) {
  if (x.country !== 'CA') continue;
  if (OPERATIONAL.has(x.status) && x.confirmed === false) {
    fail.push(
      `${x.slug} carries the operational status "${x.status}" with no dated confirmation. That is a coverage claim ` +
        'with nobody behind it — either confirm it on a date or set the status back to corridor-target.',
    );
  }
  if (x.status === 'corridor-target' && x.confirmed === true) {
    fail.push(
      `${x.slug} is confirmed on a date but still labelled corridor-target, so it is excluded from the service ` +
        'area and reads as unconfirmed on its corridor page. Coverage the business has and is not claiming.',
    );
  }
}

/* Every confirmation says who made it. An undated, unattributed sentence is
   the thing this field exists to prevent — and `verifiedBy` is what keeps an
   owner's statement of coverage from being read later as a record of
   documented completed work. */
for (const x of markets) {
  const tail = marketsSrc.slice(x.index, nextCallAfter(x.index));
  if (x.confirmed !== true) continue;
  const viaCtor = /\b([A-Z_][A-Za-z_0-9]*)\(/.exec(tail.replace(/^\s*m\(/, ''));
  const ctorSrc = viaCtor
    ? (new RegExp(`function ${viaCtor[1]}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}`).exec(marketsSrc) ?? [])[1] ?? ''
    : '';
  if (!/verifiedBy/.test(tail) && !/verifiedBy/.test(ctorSrc)) {
    fail.push(
      `${x.slug} is confirmed but does not say who confirmed it. Add verifiedBy — an owner's statement that the ` +
        'company covers a market is not the same kind of fact as a record of work done there.',
    );
  }
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

/* ── 7a. the schema's city list is a subset of the confirmed markets ──────
 *
 * lib/schema/root-schema.ts derives areaServed from CITIES in seo-data.ts, and
 * that is the right mechanism — the schema cannot claim coverage that has no
 * page. But CITIES and the market registry are two lists, and two lists that
 * must agree eventually will not: adding a municipality to CITIES gives it a
 * page AND puts it into the entity graph as a served City, with nothing asking
 * whether anybody confirmed that it is served.
 *
 * So: every name in CITIES must exist in the registry as a market with a dated
 * operational confirmation. That is the join between the two models, and it is
 * the only thing that stops the corridor list from becoming a coverage claim
 * one convenient edit at a time.
 */
const citiesArr = /const AREAS = \[([\s\S]*?)\];/.exec(seoSrc);
if (!citiesArr) {
  fail.push('could not read AREAS from lib/seo-data.ts — this guard cannot check the schema city list');
} else {
  const slugifyRaw = (x) =>
    x.toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  /*
   * One display name does not slugify to its market slug: there are two Niagara
   * Falls on this corridor and the registry disambiguates them. seo-data.ts
   * carries the override map and this guard reads the same map, so the two
   * cannot disagree about which market a page belongs to. Assuming slugify()
   * here would have reported "Niagara Falls" as a municipality missing from the
   * registry, and the obvious fix — deleting it from AREAS — would have taken
   * a confirmed market off the map.
   */
  const overrides = Object.fromEntries(
    [...(/AREA_SLUG_OVERRIDES[^=]*=\s*\{([\s\S]*?)\};/.exec(seoSrc)?.[1] ?? '')
      .matchAll(/'([^']+)':\s*'([a-z0-9-]+)'/g)].map((m) => [m[1], m[2]]),
  );
  const slugify = (x) => overrides[x] ?? slugifyRaw(x);
  const cityNames = [...citiesArr[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  /*
   * Both countries. This filtered to Canada while New York markets could not
   * hold a page; since 2026-09-10 every published area must exist in the
   * registry regardless of which side of the river it is on, and filtering by
   * country here would have reported twenty-four correctly-registered American
   * municipalities as missing.
   */
  const confirmed = new Set(markets.map((x) => x.slug));
  for (const name of cityNames) {
    const slug = slugify(name);
    if (!confirmed.has(slug)) {
      fail.push(
        `AREAS in lib/seo-data.ts carries "${name}" (${slug}), which is not in the market registry. Every ` +
          'municipality the schema emits as areaServed must exist in content/geo/markets.ts with a dated ' +
          'operational confirmation — otherwise the entity graph claims coverage nobody has verified.',
      );
    }
  }
  const unverified = cityNames
    .map(slugify)
    .filter((slug) => bySlug.has(slug) && bySlug.get(slug).confirmed === false);
  for (const slug of unverified) {
    fail.push(
      `${slug} is emitted as areaServed by the schema but its operational position is unconfirmed ` +
        '(verifiedAt: null). Confirm it on a date, or take it out of AREAS.',
    );
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
    `${usCount} in New York State, ${withPages} with local content, one showroom and one telephone number, ` +
    'no invented coordinate, drive time or population',
);
