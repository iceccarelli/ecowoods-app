/**
 * scripts/geo-sources.mjs — readers for the two official downloads, and the
 * definition of which published line becomes which fact.
 *
 *   Canada  Statistics Canada, Census Profile, 2021 Census of Population
 *           (catalogue 98-401-X2021005), CSV. Rows are keyed by ALT_GEO_CODE
 *           (the census subdivision code) and CHARACTERISTIC_NAME; the figure
 *           is C1_COUNT_TOTAL.
 *   US      Census Bureau, American Community Survey 5-year (2024 release,
 *           2020–2024), the API's JSON array-of-arrays. One file per
 *           geography level (place, county subdivision).
 *
 * A line that is missing, suppressed ("x", "F"), negative (ACS sentinels) or
 * ambiguous (the characteristic name matches more than once) yields NO fact.
 * Both readers stream or scan once and keep only the mapped geographies.
 */
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

export const CA_SOURCE = {
  name: 'Statistics Canada, Census Profile, 2021 Census of Population (98-401-X2021005)',
  url: 'https://www150.statcan.gc.ca/n1/en/catalogue/98-401-X2021005',
  tableId: '98-401-X2021005',
  referencePeriod: '2021 Census',
};
export const US_SOURCE = {
  name: 'U.S. Census Bureau, American Community Survey 5-Year Estimates, 2024 release',
  url: 'https://www.census.gov/data/developers/data-sets/acs-5year/2024.html',
  referencePeriod: 'ACS 2020–2024 5-year',
};

const SHARE_NOTE = 'Published count copied as-is; shares and percentiles are derived later by geo-lib.deriveInputs.';

/** metric → how Statistics Canada labels the line (exact text, whitespace-collapsed). */
export const CA_LINES = [
  { metric: 'population', name: 'Population, 2021', unit: 'persons' },
  { metric: 'private_dwellings', name: 'Total private dwellings', unit: 'dwellings' },
  { metric: 'median_household_income', name: 'Median total income of household in 2020 ($)', unit: 'CAD', period: '2021 Census (income year 2020)' },
  { metric: 'median_dwelling_value', name: 'Median value of dwellings ($)', unit: 'CAD' },
  { metric: 'period_total', name: 'Total - Occupied private dwellings by period of construction - 25% sample data', unit: 'dwellings' },
  { metric: 'built_1960_or_before', name: '1960 or before', unit: 'dwellings' },
  { metric: 'built_1961_1980', name: '1961 to 1980', unit: 'dwellings' },
  { metric: 'structural_total', name: 'Total - Occupied private dwellings by structural type of dwelling - 100% data', unit: 'dwellings' },
  { metric: 'single_detached', name: 'Single-detached house', unit: 'dwellings' },
];

/** ACS variable → metric. B25034 007–011 sum to "built before 1980". */
export const US_VARS = [
  { v: 'B01003_001E', metric: 'population', unit: 'persons', table: 'B01003' },
  { v: 'B25001_001E', metric: 'private_dwellings', unit: 'dwellings', table: 'B25001' },
  { v: 'B19013_001E', metric: 'median_household_income', unit: 'USD', table: 'B19013' },
  { v: 'B25077_001E', metric: 'median_dwelling_value', unit: 'USD', table: 'B25077' },
  { v: 'B25034_001E', metric: 'period_total', unit: 'dwellings', table: 'B25034' },
  ...['007', '008', '009', '010', '011'].map((n) => ({ v: `B25034_${n}E`, metric: `built_early_${n}`, unit: 'dwellings', table: 'B25034' })),
  { v: 'B25024_001E', metric: 'structural_total', unit: 'dwellings', table: 'B25024' },
  { v: 'B25024_002E', metric: 'single_detached', unit: 'dwellings', table: 'B25024' },
];
export const US_VARIABLES = US_VARS.map((x) => x.v);

const collapse = (s) => s.replace(/\s+/g, ' ').trim();

export function parseCsvLine(line) {
  const out = [];
  let cell = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cell); cell = ''; } else cell += c;
  }
  out.push(cell);
  return out;
}

/** Census figure → number, or null when suppressed, blank or not a count. */
export const censusNumber = (s) => {
  if (s == null) return null;
  const t = String(s).replace(/[,\s$]/g, '');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
};

/**
 * Stream a Census Profile CSV. Returns
 *   { found: Map<csd, Map<metric, {value, geoName, dguid}>>, ambiguous: Set<"csd|metric">, names: Map<csd, geoName> }
 * keeping only the wanted CSD codes and the lines in CA_LINES.
 */
export async function readCensusProfile(lines, wantedCsds, spec = CA_LINES) {
  const byName = new Map();
  for (const s of spec) byName.set(collapse(s.name), s);
  const found = new Map(), names = new Map(), ambiguous = new Set();
  const dups = new Map();
  let col = null;
  for await (const line of lines) {
    if (!line) continue;
    const cells = parseCsvLine(line);
    if (!col) {
      const head = cells.map((h) => h.replace(/^﻿/, '').trim());
      col = Object.fromEntries(head.map((h, i) => [h, i]));
      for (const need of ['ALT_GEO_CODE', 'GEO_NAME', 'CHARACTERISTIC_NAME', 'C1_COUNT_TOTAL']) {
        if (!(need in col)) throw new Error(`Census Profile CSV is missing column ${need}`);
      }
      continue;
    }
    const csd = cells[col.ALT_GEO_CODE];
    if (!wantedCsds.has(csd)) continue;
    names.set(csd, cells[col.GEO_NAME]);
    const s = byName.get(collapse(cells[col.CHARACTERISTIC_NAME] ?? ''));
    if (!s) continue;
    const key = `${csd}|${s.metric}`;
    if (dups.has(key)) { ambiguous.add(key); continue; }
    dups.set(key, true);
    const value = censusNumber(cells[col.C1_COUNT_TOTAL]);
    if (value == null) continue;
    if (!found.has(csd)) found.set(csd, new Map());
    found.get(csd).set(s.metric, { value, geoName: cells[col.GEO_NAME], dguid: cells[col.DGUID] ?? null });
  }
  for (const k of ambiguous) { const [csd, m] = k.split('|'); found.get(csd)?.delete(m); }
  return { found, ambiguous, names };
}

export async function* fileLines(path) {
  const rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const l of rl) yield l;
}

/** ACS API JSON → Map<geoid, { name, values: Map<variable, number|null> }>. */
export function readAcs(json) {
  const [head, ...rows] = json;
  const ix = Object.fromEntries(head.map((h, i) => [h, i]));
  if (!('NAME' in ix) || !('state' in ix)) throw new Error('ACS JSON needs NAME and state columns');
  const out = new Map();
  for (const r of rows) {
    const geoid = r[ix.state] + (ix.county != null ? r[ix.county] : '') + (ix['county subdivision'] != null ? r[ix['county subdivision']] : '') + (ix.place != null ? r[ix.place] : '');
    const values = new Map();
    for (const v of US_VARIABLES) if (v in ix) values.set(v, censusNumber(r[ix[v]]));
    out.set(geoid, { name: r[ix.NAME], values });
  }
  return out;
}

/* ── facts ───────────────────────────────────────────────────────────────── */

const base = (slug, metric, unit, src, retrievedAt, tableId, period, geo, extra) => ({
  id: `${slug}.${metric}.${tableId}`,
  marketSlug: slug, metric, value: extra.value, unit,
  geography: geo, referencePeriod: period,
  source: { name: src.name, url: src.url },
  retrievedAt, tableId, normalization: SHARE_NOTE,
  geographyId: extra.geographyId, geographySystem: extra.geographySystem,
});

/**
 * Build facts for one country from what was read. `report` collects every
 * decision that did not become a fact (name mismatch, missing, ambiguous).
 */
export function caFacts(read, map, markets, retrievedAt, report) {
  const facts = [];
  for (const m of markets.filter((x) => x.country === 'CA')) {
    const g = map.markets[m.slug]?.direct;
    if (!g) continue;
    const got = read.found.get(g.id);
    const seen = read.names.get(g.id);
    if (seen == null) { report.push(`${m.slug}: CSD ${g.id} is not in the file`); continue; }
    if (seen !== g.name) { report.push(`${m.slug}: CSD ${g.id} is "${seen}" in the file, crosswalk expects "${g.name}" — skipped`); continue; }
    for (const s of CA_LINES) {
      const hit = got?.get(s.metric);
      if (!hit) { report.push(`${m.slug}: no usable "${s.name}" (missing, suppressed or ambiguous)`); continue; }
      const metric = s.metric === 'built_1960_or_before' || s.metric === 'built_1961_1980' ? s.metric : s.metric;
      facts.push(base(m.slug, metric, s.unit, CA_SOURCE, retrievedAt, CA_SOURCE.tableId, s.period ?? CA_SOURCE.referencePeriod, g.name,
        { value: hit.value, geographyId: g.id, geographySystem: g.system }));
    }
    /* Two published lines make "built 1980 or earlier"; keep both raw, add the sum only when both exist. */
    const a = got?.get('built_1960_or_before'), b = got?.get('built_1961_1980');
    if (a && b) {
      facts.push(base(m.slug, 'built_early', 'dwellings', CA_SOURCE, retrievedAt, CA_SOURCE.tableId, CA_SOURCE.referencePeriod, g.name,
        { value: a.value + b.value, geographyId: g.id, geographySystem: g.system }));
    }
  }
  return facts.filter((f) => f.metric !== 'built_1960_or_before' && f.metric !== 'built_1961_1980');
}

export function usFacts(acsMaps, map, markets, retrievedAt, report) {
  const all = new Map();
  for (const mp of acsMaps) for (const [k, v] of mp) all.set(k, v);
  const facts = [];
  for (const m of markets.filter((x) => x.country === 'US')) {
    const g = map.markets[m.slug]?.direct;
    if (!g) continue;
    const row = all.get(g.id);
    if (!row) { report.push(`${m.slug}: GEOID ${g.id} is not in the supplied ACS file(s)`); continue; }
    if (row.name !== g.name) { report.push(`${m.slug}: GEOID ${g.id} is "${row.name}" in the file, crosswalk expects "${g.name}" — skipped`); continue; }
    const mk = (spec, value, metric = spec.metric) => facts.push(base(m.slug, metric, spec.unit, { ...US_SOURCE }, retrievedAt, spec.table, US_SOURCE.referencePeriod, g.name,
      { value, geographyId: g.id, geographySystem: g.system }));
    for (const spec of US_VARS.filter((x) => !x.metric.startsWith('built_early_'))) {
      const v = row.values.get(spec.v);
      if (v == null) { report.push(`${m.slug}: no usable ${spec.v} (${spec.metric})`); continue; }
      mk(spec, v);
    }
    const parts = US_VARS.filter((x) => x.metric.startsWith('built_early_')).map((x) => row.values.get(x.v));
    if (parts.every((x) => x != null)) mk({ unit: 'dwellings', table: 'B25034' }, parts.reduce((a, b) => a + b, 0), 'built_early');
    else report.push(`${m.slug}: B25034 pre-1980 lines incomplete`);
  }
  return facts;
}
