#!/usr/bin/env node
/**
 * scripts/verify-geo-data.mjs — guard for apps/web/content/geo/sourced-facts.json.
 * Fails on any fact missing provenance, a future retrieval date, wrong units or
 * a duplicate; and fails if the internal dataset is referenced from app/ or
 * components/ (public surfaces carry only plain cited statements).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { validateFacts } from './geo-lib.mjs';

const WEB = join(process.cwd(), 'apps/web');
const fail = [];
let doc;
try {
  doc = JSON.parse(readFileSync(join(WEB, 'content/geo/sourced-facts.json'), 'utf8'));
  fail.push(...validateFacts(doc));
} catch (e) {
  fail.push(`cannot read sourced-facts.json: ${e.message}`);
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
console.log(`✓ geo data: ${doc.facts.length} sourced fact(s), all with complete provenance`);
