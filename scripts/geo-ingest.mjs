#!/usr/bin/env node
/**
 * scripts/geo-ingest.mjs — re-runnable ingestion for apps/web/content/geo/sourced-facts.json.
 *
 *   node scripts/geo-ingest.mjs                 # dry run: fetch, validate, report
 *   node scripts/geo-ingest.mjs --write         # merge into the dataset (validated first)
 *   node scripts/geo-ingest.mjs --csv-dir DIR   # use pre-downloaded full-table CSVs (DIR/<productId>.csv)
 *
 * Source: Statistics Canada Web Data Service getFullTableDownloadCSV, which
 * returns JSON { status, object: <zip url> }. Targets live in
 * geo-ingest-targets.json. Values are copied exactly as published; nothing is
 * estimated. A target with no single matching row is reported and skipped.
 *
 * NOTE: written without live access (every StatCan host was blocked in the
 * build sandbox), so the network path is UNTESTED; the CSV path and the
 * validation are tested.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFacts } from './geo-lib.mjs';

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift().map((h) => h.replace(/^﻿/, ''));
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

export function factFromRow(t, r, today) {
  return {
    id: t.id, marketSlug: t.marketSlug, metric: t.metric, value: Number(r.VALUE), unit: t.unit,
    geography: r.GEO, referencePeriod: r.REF_DATE,
    source: { name: t.sourceName, url: `https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=${t.productId}` },
    retrievedAt: today, tableId: String(t.productId), normalization: t.normalization,
  };
}

async function loadCsv(pid, csvDir) {
  if (csvDir) return readFileSync(join(csvDir, `${pid}.csv`), 'utf8');
  const meta = await (await fetch(`https://www150.statcan.gc.ca/t1/wds/rest/getFullTableDownloadCSV/${pid}/en`)).json();
  if (meta.status !== 'SUCCESS') throw new Error(`WDS: ${JSON.stringify(meta)}`);
  const { execFileSync } = await import('node:child_process');
  const zip = Buffer.from(await (await fetch(meta.object)).arrayBuffer());
  const tmp = join(process.env.TMPDIR ?? '/tmp', `geo-${pid}.zip`);
  writeFileSync(tmp, zip);
  return execFileSync('unzip', ['-p', tmp, `${pid}.csv`], { maxBuffer: 1 << 28 }).toString('utf8');
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const csvDir = args.includes('--csv-dir') ? args[args.indexOf('--csv-dir') + 1] : null;
  const today = new Date().toISOString().slice(0, 10);
  const out = join(process.cwd(), 'apps/web/content/geo/sourced-facts.json');
  const { targets } = JSON.parse(readFileSync(join(process.cwd(), 'scripts/geo-ingest-targets.json'), 'utf8'));
  const doc = JSON.parse(readFileSync(out, 'utf8'));
  const byId = new Map(doc.facts.map((f) => [f.id, f]));
  for (const t of targets) {
    try {
      const rows = parseCsv(await loadCsv(t.productId, csvDir));
      const hit = rows.filter((r) => Object.entries(t.filters).every(([k, v]) => r[k] === v));
      if (hit.length !== 1) { console.warn(`SKIP ${t.id}: ${hit.length} matching rows (need exactly 1)`); continue; }
      byId.set(t.id, factFromRow(t, hit[0], today));
    } catch (e) {
      console.warn(`SKIP ${t.id}: ${e.message}`);
    }
  }
  const next = { ...doc, facts: [...byId.values()] };
  const errs = validateFacts(next);
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  console.log(`${next.facts.length} fact(s) valid${write ? '' : ' (dry run, nothing written)'}`);
  if (write) writeFileSync(out, JSON.stringify(next, null, 2) + '\n');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
