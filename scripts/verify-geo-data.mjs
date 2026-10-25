#!/usr/bin/env node
/**
 * scripts/verify-geo-data.mjs — guard for apps/web/content/geo/sourced-facts.json.
 * Fails on any fact missing provenance, a future retrieval date, wrong units or
 * a duplicate; and fails if the internal dataset is referenced from app/ or
 * components/ (public surfaces carry only plain cited statements).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateFacts, validateCrosswalk, staleFacts } from './geo-lib.mjs';
import { buildGenerated, renderGenerated } from './geo-ingest.mjs';

const WEB = join(process.cwd(), 'apps/web');
const fail = [];
let doc;
try {
  doc = JSON.parse(readFileSync(join(WEB, 'content/geo/sourced-facts.json'), 'utf8'));
  fail.push(...validateFacts(doc));
} catch (e) {
  fail.push(`cannot read sourced-facts.json: ${e.message}`);
}

/* Crosswalk, and the generated inputs must be exactly what the facts produce. */
const ROOT = join(WEB, '../..');
const flags = ['--no-warnings', ...(process.features.typescript ? [] : ['--experimental-strip-types']), '--import', join(ROOT, 'scripts/lib/ts-register.mjs')];
const probe = `import { MARKETS } from ${JSON.stringify(join(WEB, 'content/geo/markets.ts'))};
console.log(JSON.stringify(MARKETS.map(({ slug, country, kind, partOf }) => ({ slug, country, kind, partOf }))));`;
const r = spawnSync(process.execPath, [...flags, '--input-type=module', '-e', probe], { encoding: 'utf8' });
let stale = [];
if (r.status !== 0) fail.push(`cannot load the market registry: ${(r.stderr || '').trim().split('\n').slice(-1)}`);
else if (doc) {
  const markets = JSON.parse(r.stdout.trim().split('\n').pop());
  try {
    const map = JSON.parse(readFileSync(join(WEB, 'content/geo/geography-map.json'), 'utf8'));
    fail.push(...validateCrosswalk(map, markets));
    for (const f of doc.facts) if (!markets.some((m) => m.slug === f.marketSlug)) fail.push(`fact ${f.id}: ${f.marketSlug} is not a market`);
    for (const f of doc.facts) {
      const g = map.markets[f.marketSlug]?.direct;
      if (!g || g.id !== f.geographyId) fail.push(`fact ${f.id}: geographyId ${f.geographyId} does not match the crosswalk for ${f.marketSlug}`);
    }
    const want = renderGenerated(buildGenerated(doc, map, markets).doc);
    const have = readFileSync(join(WEB, 'content/geo/market-inputs.generated.ts'), 'utf8');
    if (want !== have) fail.push('content/geo/market-inputs.generated.ts is out of date with sourced-facts.json — run `pnpm geo:ingest -- --regenerate --write`');
  } catch (e) {
    fail.push(`geography checks failed: ${e.message}`);
  }
  stale = staleFacts(doc);
}

const walk = (d, out = []) => {
  for (const n of readdirSync(d)) {
    if (n === 'node_modules' || n === '.next') continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(n)) out.push(p);
  }
  return out;
};
for (const dir of ['app', 'components', 'lib', 'content'].filter((d) => existsSync(join(WEB, d)))) {
  for (const f of walk(join(WEB, dir))) {
    // the geo + registry modules are the internal side of the line
    if (/\/(lib\/geo|lib\/registry|content\/geo)\//.test(f)) continue;
    if (/sourced-facts/.test(readFileSync(f, 'utf8'))) {
      fail.push(`${f.replace(WEB + '/', '')} references the internal sourced-facts dataset`);
    }
  }
}
if (fail.length) {
  console.error(`\n✗ geo data: ${fail.length} problem(s)`);
  for (const f of fail) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`✓ geo data: ${doc.facts.length} sourced fact(s), all with complete provenance; crosswalk complete; generated inputs in sync`);
if (stale.length) console.warn(`  ! ${stale.length} fact(s) were retrieved more than 3 years ago — refresh with pnpm geo:ingest`);
