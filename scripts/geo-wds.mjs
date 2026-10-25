/**
 * scripts/geo-wds.mjs — Canadian indicators from Statistics Canada's official
 * Web Data Service full-table CSVs (www150.statcan.gc.ca/t1/wds), used because
 * the Census Profile host refuses automated requests.
 *
 * Which line becomes which fact is written down in WDS_TABLES, against member
 * names read from the cubes' own metadata (scripts/geo-wds-cube.mjs). A row is
 * taken only when it is unambiguous: its geography is a crosswalk DGUID, every
 * dimension is either a named selector or a "Total - …" aggregate, the scalar
 * factor is units, and exactly one such row exists per geography.
 *
 * No census-subdivision cube carries period of construction, so housing age
 * (and the hardwood proxy built on it) stays unavailable for Canada from this
 * route.
 */
import { parseCsvLine, censusNumber } from './geo-sources.mjs';

const tv = (pid) => `https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=${pid}01`;

export const WDS_TABLES = [
  {
    pid: '98100060', tableId: '98-10-0060-01',
    title: 'Statistics Canada, Table 98-10-0060-01, Household income statistics by dwelling and household characteristics: Canada, provinces and territories, census divisions and census subdivisions',
    url: tv('98100060'), period: '2021 Census (income year 2020)',
    metrics: [{ metric: 'median_household_income', unit: 'CAD', selectors: ['Median total income of households ($) (2020)'] }],
  },
  {
    pid: '98100240', tableId: '98-10-0240-01',
    title: 'Statistics Canada, Table 98-10-0240-01, Structural type of dwelling by tenure: Canada, provinces and territories, census divisions and census subdivisions',
    url: tv('98100240'), period: '2021 Census',
    note: 'Private households, which are occupied private dwellings.',
    metrics: [
      { metric: 'structural_total', unit: 'dwellings', selectors: ['Number of private households', 'Total - Structural type of dwelling'] },
      { metric: 'single_detached', unit: 'dwellings', selectors: ['Number of private households', 'Single-detached house'] },
    ],
  },
  {
    pid: '98100257', tableId: '98-10-0257-01',
    title: 'Statistics Canada, Table 98-10-0257-01, Value (owner-estimated) of dwelling by structural type of dwelling: Canada, provinces and territories and census subdivisions with a population 5,000 or more',
    url: tv('98100257'), period: '2021 Census',
    metrics: [{ metric: 'median_dwelling_value', unit: 'CAD', selectors: ['Median value of dwelling $', 'Number of private households', 'Total - Structural type of dwelling'], range: [50_000, 10_000_000] }],
  },
];

const DIM_TAIL = /\s*\(\d+C?\)\s*$/;
export const dimName = (h) => h.replace(DIM_TAIL, '').trim();

/**
 * Stream one cube's CSV and return Map<csd, Map<metric, {value, geo}>> plus
 * the decisions that did not become a value.
 */
export async function readWdsCube(lines, table, wantedCsds) {
  const found = new Map();
  const notes = [];
  const seen = new Map(); // `${csd}|${metric}` → count of qualifying rows
  let col = null;
  let dims = [];
  for await (const line of lines) {
    if (!line) continue;
    const c = parseCsvLine(line);
    if (!col) {
      const head = c.map((h) => h.replace(/^﻿/, '').trim());
      col = Object.fromEntries(head.map((h, i) => [h, i]));
      for (const need of ['REF_DATE', 'GEO', 'DGUID', 'UOM', 'SCALAR_FACTOR', 'VALUE']) {
        if (!(need in col)) throw new Error(`${table.pid}: CSV is missing column ${need}`);
      }
      dims = head.slice(col.DGUID + 1, col.UOM).map((h, k) => ({ name: dimName(h), at: col.DGUID + 1 + k }));
      if (dims.length < 2) throw new Error(`${table.pid}: found ${dims.length} dimension column(s) between DGUID and UOM`);
      continue;
    }
    const csd = (c[col.DGUID] ?? '').slice(-7);
    if (!wantedCsds.has(csd)) continue;
    const cells = dims.map((d) => c[d.at]);
    for (const m of table.metrics) {
      const sel = new Set(m.selectors);
      const matched = cells.filter((x) => sel.has(x)).length;
      if (matched !== sel.size) continue;
      if (!cells.every((x, i) => sel.has(x) || /^Total\b/.test(x))) continue;
      const key = `${csd}|${m.metric}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
      if (c[col.SCALAR_FACTOR] !== 'units') { notes.push(`${csd} ${m.metric}: scalar factor "${c[col.SCALAR_FACTOR]}" is not units`); continue; }
      const value = censusNumber(c[col.VALUE]);
      if (value == null) continue;
      if (!found.has(csd)) found.set(csd, new Map());
      found.get(csd).set(m.metric, { value, geo: c[col.GEO], ref: c[col.REF_DATE] });
    }
  }
  for (const [key, n] of seen) {
    if (n > 1) {
      const [csd, metric] = key.split('|');
      found.get(csd)?.delete(metric);
      notes.push(`${csd} ${metric}: ${n} qualifying rows, ambiguous — left unavailable`);
    }
  }
  return { found, notes };
}

const geoMatches = (geo, name) => geo.split(',')[0].trim().toLowerCase() === name.toLowerCase();

/** Facts for every direct Canadian market the cubes cover. `report` collects what did not become a fact. */
export function wdsFacts(reads, map, markets, retrievedAt, report) {
  const facts = [];
  for (const m of markets.filter((x) => x.country === 'CA')) {
    const g = map.markets[m.slug]?.direct;
    if (!g) continue;
    for (const { table, result } of reads) {
      const got = result.found.get(g.id);
      for (const spec of table.metrics) {
        const hit = got?.get(spec.metric);
        if (!hit) { report.push(`${m.slug}: no usable ${spec.metric} in table ${table.tableId}`); continue; }
        if (!geoMatches(hit.geo, g.name)) { report.push(`${m.slug}: CSD ${g.id} is "${hit.geo}" in ${table.tableId}, crosswalk expects "${g.name}" — skipped`); continue; }
        if (spec.range && (hit.value < spec.range[0] || hit.value > spec.range[1])) {
          report.push(`${m.slug}: ${spec.metric} ${hit.value} is outside ${spec.range.join('..')} — not trusted`);
          continue;
        }
        facts.push({
          id: `${m.slug}.${spec.metric}.${table.tableId}`,
          marketSlug: m.slug, metric: spec.metric, value: hit.value, unit: spec.unit,
          geography: hit.geo, referencePeriod: table.period,
          source: { name: table.title, url: table.url },
          retrievedAt, tableId: table.tableId,
          normalization: `Published figure copied as-is.${table.note ? ` ${table.note}` : ''} Shares and percentiles are derived later by geo-lib.deriveInputs.`,
          geographyId: g.id, geographySystem: g.system,
        });
      }
    }
  }
  return facts;
}
