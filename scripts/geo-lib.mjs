/**
 * scripts/geo-lib.mjs — the pure core of the geo data engine. No I/O, so the
 * guard, the CLI and the tests all run the same code.
 *
 *   validateFacts      provenance rules for apps/web/content/geo/sourced-facts.json
 *   validateCrosswalk  every market has exactly one explicit geography decision
 *   deriveInputs       facts → the market-inputs the opportunity model reads
 *   staleFacts         facts whose source is older than the refresh window
 *
 * Facts are raw published figures. Everything derived (shares, percentiles, the
 * hardwood proxy) is computed here, deterministically, and written to
 * market-inputs.generated.json with the raw figures beside it. Nothing is
 * estimated; a figure that is missing stays missing.
 */
export const ALLOWED_UNITS = [
  'persons', 'dwellings', 'percent', 'CAD', 'USD', 'CAD_per_dwelling', 'count', 'CAD_total',
];
export const METHOD_VERSION = 1;
/** Smallest same-country cohort a percentile may be computed over. */
export const MIN_COHORT = 8;
/** A source older than this is reported by the guard so a refresh is scheduled. */
export const STALE_AFTER_DAYS = 365 * 3;

const str = (v) => typeof v === 'string' && v.trim().length > 0;

export function validateFacts(doc, today = new Date().toISOString().slice(0, 10)) {
  const errs = [];
  if (!doc || doc.schema !== 1 || !Array.isArray(doc.facts)) {
    return ['dataset must be { schema: 1, facts: [] }'];
  }
  const seen = new Set();
  const ids = new Set();
  doc.facts.forEach((f, i) => {
    const at = `fact[${i}]${f?.id ? ` (${f.id})` : ''}`;
    if (!str(f.id)) errs.push(`${at}: missing id`);
    if (!str(f.marketSlug)) errs.push(`${at}: missing marketSlug`);
    if (!str(f.metric)) errs.push(`${at}: missing metric`);
    if (typeof f.value !== 'number' || !Number.isFinite(f.value)) errs.push(`${at}: value must be a finite number`);
    else if (f.value < 0) errs.push(`${at}: negative value`);
    if (!ALLOWED_UNITS.includes(f.unit)) errs.push(`${at}: unit "${f.unit}" is not one of ${ALLOWED_UNITS.join(', ')}`);
    else if (f.unit === 'percent' && typeof f.value === 'number' && f.value > 100) errs.push(`${at}: percent value ${f.value} outside 0..100`);
    if (!str(f.source?.name)) errs.push(`${at}: missing source.name`);
    if (!/^https:\/\/[^\s]+$/.test(f.source?.url ?? '')) errs.push(`${at}: source.url must be an https URL`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.retrievedAt ?? '')) errs.push(`${at}: retrievedAt must be YYYY-MM-DD`);
    else if (f.retrievedAt > today) errs.push(`${at}: retrievedAt ${f.retrievedAt} is in the future`);
    if (!str(f.tableId)) errs.push(`${at}: missing tableId (table/series id)`);
    if (!str(f.normalization)) errs.push(`${at}: missing normalization method`);
    if (!str(f.referencePeriod)) errs.push(`${at}: missing referencePeriod`);
    const key = [f.marketSlug, f.metric, f.tableId, f.referencePeriod].join('|');
    if (seen.has(key)) errs.push(`${at}: duplicate of ${key}`);
    seen.add(key);
    if (f.id && ids.has(f.id)) errs.push(`${at}: duplicate id`);
    ids.add(f.id);
  });
  return errs;
}

export function staleFacts(doc, today = new Date().toISOString().slice(0, 10)) {
  const limit = Date.parse(today) - STALE_AFTER_DAYS * 864e5;
  return doc.facts.filter((f) => Date.parse(f.retrievedAt) < limit).map((f) => f.id);
}

/* ── geography crosswalk ─────────────────────────────────────────────────── */

const ID_SHAPE = {
  'statcan-csd': /^35\d{5}$/, // Ontario census subdivision, 7 digits
  'us-place': /^36\d{5}$/, // New York place, state FIPS + 5-digit place
  'us-cousub': /^36\d{8}$/, // New York county subdivision, state + county + 5
};

/**
 * map: { schema:1, markets: { slug: { direct:{system,id,name} } | { parent:slug } | { unmapped:reason } } }
 * markets: [{ slug, country, kind, partOf? }]
 */
export function validateCrosswalk(map, markets) {
  const errs = [];
  if (!map || map.schema !== 1 || typeof map.markets !== 'object') return ['crosswalk must be { schema: 1, markets: {} }'];
  const bySlug = new Map(markets.map((m) => [m.slug, m]));
  const used = new Map();
  for (const m of markets) {
    const e = map.markets[m.slug];
    if (!e) { errs.push(`${m.slug}: no geography decision (map it, give it a parent, or mark it unmapped with a reason)`); continue; }
    const kinds = ['direct', 'parent', 'unmapped'].filter((k) => k in e);
    if (kinds.length !== 1) { errs.push(`${m.slug}: exactly one of direct | parent | unmapped required`); continue; }
    if (e.direct) {
      const { system, id, name } = e.direct;
      if (!ID_SHAPE[system]) errs.push(`${m.slug}: unknown geography system "${system}"`);
      else if (!ID_SHAPE[system].test(id ?? '')) errs.push(`${m.slug}: ${system} id "${id}" has the wrong shape`);
      if (!str(name)) errs.push(`${m.slug}: direct geography needs the official name to check against the file`);
      if ((system === 'statcan-csd') !== (m.country === 'CA')) errs.push(`${m.slug}: ${system} does not belong to country ${m.country}`);
      if (m.kind !== 'municipality') errs.push(`${m.slug}: a district may not claim its own direct geography; use its parent`);
      const k = `${system}:${id}`;
      if (used.has(k)) errs.push(`${m.slug}: ${k} is already used by ${used.get(k)}`);
      used.set(k, m.slug);
    } else if (e.parent) {
      if (m.kind !== 'district' || m.partOf !== e.parent) errs.push(`${m.slug}: parent must be its registry partOf (${m.partOf ?? 'none'}), got "${e.parent}"`);
      if (!bySlug.has(e.parent)) errs.push(`${m.slug}: parent "${e.parent}" is not a market`);
    } else if (!str(e.unmapped)) errs.push(`${m.slug}: unmapped needs a reason`);
  }
  for (const slug of Object.keys(map.markets)) if (!bySlug.has(slug)) errs.push(`${slug}: not a market in the registry`);
  return errs;
}

/* ── derivation ──────────────────────────────────────────────────────────── */

/** Mid-rank percentile, 0–100, one decimal. Ties share the same score. */
export function percentile(value, cohort) {
  const below = cohort.filter((x) => x < value).length;
  const equal = cohort.filter((x) => x === value).length;
  return Math.round(((below + 0.5 * equal) / cohort.length) * 1000) / 10;
}

const REQ = {
  purchasingPower: ['median_household_income'],
  housingValues: ['median_dwelling_value'],
  housingAge: ['period_total', 'built_early'],
  detachedPrevalence: ['structural_total', 'single_detached'],
};

const raw = (facts, slug, metric) => facts.find((f) => f.marketSlug === slug && f.metric === metric);

/** The measured quantity for one input from one geography's facts, or null. */
function measure(inputId, facts, slug) {
  if (inputId === 'purchasingPower' || inputId === 'housingValues') {
    const f = raw(facts, slug, REQ[inputId][0]);
    return f ? { value: f.value, unit: f.unit, parts: [f] } : null;
  }
  const share = (num, den) => {
    const n = raw(facts, slug, num), d = raw(facts, slug, den);
    return n && d && d.value > 0 ? { value: (n.value / d.value) * 100, unit: 'percent', parts: [n, d] } : null;
  };
  if (inputId === 'housingAge') return share('built_early', 'period_total');
  if (inputId === 'detachedPrevalence') return share('single_detached', 'structural_total');
  if (inputId === 'hardwoodOpportunity') {
    const a = measure('housingAge', facts, slug), b = measure('detachedPrevalence', facts, slug);
    return a && b ? { value: (a.value * b.value) / 100, unit: 'percent', parts: [...a.parts, ...b.parts] } : null;
  }
  return null;
}

const INPUT_IDS = ['purchasingPower', 'housingValues', 'housingAge', 'detachedPrevalence', 'hardwoodOpportunity'];
const round = (n, p = 1) => Math.round(n * 10 ** p) / 10 ** p;

const WHAT = {
  purchasingPower: (m) => `median household income ${fmtMoney(m)}`,
  housingValues: (m) => `median dwelling value ${fmtMoney(m)}`,
  housingAge: (m) => `${round(m.value)}% of occupied dwellings built ${m.early}`,
  detachedPrevalence: (m) => `${round(m.value)}% of occupied dwellings are single-detached`,
  hardwoodOpportunity: (m) => `older-detached index ${round(m.value)} (share older × share detached ÷ 100)`,
};
const fmtMoney = (m) => `${m.unit} ${Math.round(m.value).toLocaleString('en-CA')}`;

/**
 * facts + crosswalk + markets → { inputs, summary }.
 *
 * Each input is scored as a mid-rank percentile within the SAME COUNTRY, over
 * markets with their own direct geography (a district does not vote in the
 * cohort it inherits from). CAD and USD are never ranked against each other.
 * A cohort smaller than MIN_COHORT yields no score. A district inherits its
 * parent's score and says so; it is never presented as a direct measurement.
 */
export function deriveInputs(facts, map, markets, meta = {}) {
  const inputs = {};
  const missing = [];
  const bySlug = new Map(markets.map((m) => [m.slug, m]));
  const direct = markets.filter((m) => map.markets[m.slug]?.direct);

  for (const id of INPUT_IDS) {
    for (const country of ['CA', 'US']) {
      const rows = direct
        .filter((m) => m.country === country)
        .map((m) => ({ m, q: measure(id, facts, m.slug) }))
        .filter((x) => x.q);
      if (rows.length < MIN_COHORT) {
        if (rows.length) missing.push(`${id}/${country}: cohort of ${rows.length} is below ${MIN_COHORT}`);
        continue;
      }
      const cohort = rows.map((x) => x.q.value);
      for (const { m, q } of rows) {
        const g = map.markets[m.slug].direct;
        inputs[m.slug] ??= {};
        inputs[m.slug][id] = make(id, q, percentile(q.value, cohort), rows.length, country, {
          kind: 'direct', system: g.system, id: g.id, name: g.name,
        }, meta);
      }
    }
  }
  for (const m of markets.filter((x) => map.markets[x.slug]?.parent)) {
    const pSlug = map.markets[m.slug].parent;
    for (const id of INPUT_IDS) {
      const p = inputs[pSlug]?.[id];
      if (!p) continue;
      inputs[m.slug] ??= {};
      inputs[m.slug][id] = {
        ...p,
        geography: { ...p.geography, kind: 'parent', parentSlug: pSlug, for: bySlug.get(m.slug).name },
        note: `${p.note} — parent geography (${bySlug.get(pSlug).name}); ${bySlug.get(m.slug).name} has no census geography of its own in this dataset`,
      };
    }
  }
  const sorted = Object.fromEntries(Object.keys(inputs).sort().map((s) => [s, inputs[s]]));
  return { inputs: sorted, missing };
}

function make(id, q, score, n, country, geography, meta) {
  const parts = q.parts;
  const early = country === 'CA' ? 'in or before 1980' : 'before 1980';
  const view = { value: q.value, unit: q.unit, early };
  const proxy = id === 'hardwoodOpportunity';
  const first = parts[0];
  return {
    score,
    basis: proxy ? 'proxy' : 'measured',
    note: `${WHAT[id](view)}; percentile ${score} among ${n} ${country === 'CA' ? 'Canadian' : 'United States'} markets with their own census geography` +
      (proxy ? '. PROXY: hardwood prevalence is not census-measured; this is housing age × detached prevalence, not a hardwood count' : ''),
    raw: { value: round(q.value, 4), unit: q.unit, components: parts.map((p) => ({ factId: p.id, metric: p.metric, value: p.value, unit: p.unit })) },
    geography,
    vintage: [...new Set(parts.map((p) => p.referencePeriod))].join('; '),
    source: {
      title: [...new Set(parts.map((p) => p.source.name))].join(' + '),
      url: first.source.url,
      retrievedAt: parts.map((p) => p.retrievedAt).sort().at(-1),
    },
    method: `v${meta.methodVersion ?? METHOD_VERSION}: mid-rank percentile within ${country}`,
  };
}
