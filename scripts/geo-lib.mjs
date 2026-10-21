/**
 * scripts/geo-lib.mjs — shared validation for the sourced geo dataset
 * (apps/web/content/geo/sourced-facts.json). Used by geo-ingest.mjs (before it
 * writes), verify-geo-data.mjs (the guard) and the vitest suite.
 *
 * A fact is admissible only with value, unit, source name + https URL,
 * retrieval date (not in the future), table/series id, normalization method,
 * reference period and a market slug. Units come from a closed list. There is
 * no estimate flag.
 */
export const ALLOWED_UNITS = ['persons', 'dwellings', 'percent', 'CAD', 'CAD_per_dwelling', 'count', 'CAD_total'];

export function validateFacts(doc, today = new Date().toISOString().slice(0, 10)) {
  const errs = [];
  if (!doc || doc.schema !== 1 || !Array.isArray(doc.facts)) {
    return ['dataset must be { schema: 1, facts: [] }'];
  }
  const str = (v) => typeof v === 'string' && v.trim().length > 0;
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
