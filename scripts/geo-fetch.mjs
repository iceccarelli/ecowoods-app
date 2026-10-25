#!/usr/bin/env node
/**
 * scripts/geo-fetch.mjs — download the two official datasets and refuse
 * anything that is not exactly what it should be. Runs on a GitHub-hosted
 * runner (geo-ingest workflow); the production build never calls it.
 *
 *   node scripts/geo-fetch.mjs --out DIR [--ca-url URL]
 *
 * Writes DIR/census-profile.csv, DIR/acs-place.json, DIR/acs-cousub.json and
 * DIR/fetch-manifest.json (url, status, content-type, bytes, sha256, rows).
 * Exits non-zero on any error page, wrong content type, missing column, empty
 * result or truncated file; nothing downstream runs on a partial download.
 */
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { US_VARIABLES } from './geo-sources.mjs';

export const CATALOGUE_URL = 'https://www150.statcan.gc.ca/n1/en/catalogue/98-401-X2021005';
export const ACS_BASE = 'https://api.census.gov/data/2024/acs/acs5';
export const CA_REQUIRED_COLUMNS = ['DGUID', 'ALT_GEO_CODE', 'GEO_LEVEL', 'GEO_NAME', 'CHARACTERISTIC_NAME', 'C1_COUNT_TOTAL'];
export const MIN_CA_BYTES = 50 * 1024 * 1024; // the CSD-level profile is hundreds of MB; an error page is not
export const MIN_ACS_ROWS = 100;

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** Throw unless the response is a 200 with an acceptable content type. */
export function checkResponse(res, url, allowedTypes) {
  const type = (res.headers.get('content-type') ?? '').toLowerCase();
  if (res.status !== 200) throw new Error(`${url}: HTTP ${res.status}`);
  if (!allowedTypes.some((t) => type.includes(t))) throw new Error(`${url}: content-type "${type}" is not one of ${allowedTypes.join(', ')}`);
  return type;
}

export const isZip = (buf) => buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;

/** First line of a Census Profile CSV must carry every column the reader needs. */
export function checkCsvHeader(line) {
  const head = line.replace(/^﻿/, '').split(',').map((h) => h.replace(/"/g, '').trim());
  const missing = CA_REQUIRED_COLUMNS.filter((c) => !head.includes(c));
  if (missing.length) throw new Error(`Census Profile CSV is missing column(s): ${missing.join(', ')}`);
  return head;
}

/** ACS API JSON: array of arrays, header first, every variable present, enough rows. */
export function checkAcsJson(json, url) {
  if (!Array.isArray(json) || !Array.isArray(json[0])) throw new Error(`${url}: not an ACS array-of-arrays response`);
  const head = json[0];
  const missing = ['NAME', 'state', ...US_VARIABLES].filter((c) => !head.includes(c));
  if (missing.length) throw new Error(`${url}: missing column(s) ${missing.join(', ')}`);
  if (json.length - 1 < MIN_ACS_ROWS) throw new Error(`${url}: only ${json.length - 1} row(s), expected at least ${MIN_ACS_ROWS}`);
  return json.length - 1;
}

/** Pull candidate CSV download links out of the catalogue page, absolute, de-duplicated. */
export function findCsvLinks(html, base = CATALOGUE_URL) {
  const out = new Set();
  for (const m of html.matchAll(/href="([^"]+)"/gi)) {
    const href = m[1].replace(/&amp;/g, '&');
    if (/(FILETYPE=CSV|_CSV\.zip|csv.*\.zip)/i.test(href)) out.add(new URL(href, base).toString());
  }
  return [...out];
}

async function get(url, types, opts = {}) {
  const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'ecowoods-geo-ingest (+https://ecowoods.ca)' } });
  const type = checkResponse(res, url, types);
  return { buf: Buffer.from(await res.arrayBuffer()), type, finalUrl: res.url, ...opts };
}

async function main() {
  const a = process.argv.slice(2);
  const out = a[a.indexOf('--out') + 1];
  if (!out || out.startsWith('--')) { console.error('--out DIR required'); process.exit(1); }
  mkdirSync(out, { recursive: true });
  const manifest = { fetchedAt: new Date().toISOString(), files: [] };

  let caUrl = a.includes('--ca-url') ? a[a.indexOf('--ca-url') + 1] : '';
  if (!caUrl) {
    const page = await get(CATALOGUE_URL, ['text/html']);
    const links = findCsvLinks(page.buf.toString('utf8'));
    console.log(`catalogue page lists ${links.length} CSV link(s):\n${links.join('\n')}`);
    if (links.length !== 1) throw new Error(`expected exactly one CSV download link on the catalogue page, found ${links.length}; pass --ca-url`);
    caUrl = links[0];
  }
  const zip = await get(caUrl, ['zip', 'octet-stream', 'csv']);
  let csv;
  if (isZip(zip.buf)) {
    const tmp = join(out, 'census-profile.zip');
    writeFileSync(tmp, zip.buf);
    const names = execFileSync('unzip', ['-Z1', tmp], { encoding: 'utf8' }).split('\n').filter((n) => /\.csv$/i.test(n) && !/ReadMe|meta/i.test(n));
    if (names.length !== 1) throw new Error(`zip holds ${names.length} data CSV(s) (${names.join(', ')}); expected one`);
    csv = execFileSync('unzip', ['-p', tmp, names[0]], { maxBuffer: 1 << 30 });
  } else csv = zip.buf;
  if (csv.length < MIN_CA_BYTES) throw new Error(`Census Profile CSV is only ${csv.length} bytes; an error page or a partial file`);
  const header = csv.subarray(0, csv.indexOf(10)).toString('latin1');
  checkCsvHeader(header);
  writeFileSync(join(out, 'census-profile.csv'), csv);
  manifest.files.push({ name: 'census-profile.csv', url: zip.finalUrl, bytes: csv.length, sha256: sha256(csv), contentType: zip.type });

  for (const [name, geo] of [['acs-place.json', 'place:*&in=state:36'], ['acs-cousub.json', 'county%20subdivision:*&in=state:36&in=county:*']]) {
    const url = `${ACS_BASE}?get=NAME,${US_VARIABLES.join(',')}&for=${geo}`;
    const r = await get(url, ['json']);
    const json = JSON.parse(r.buf.toString('utf8'));
    const rows = checkAcsJson(json, name);
    writeFileSync(join(out, name), r.buf);
    manifest.files.push({ name, url, bytes: r.buf.length, sha256: sha256(r.buf), contentType: r.type, rows });
  }
  writeFileSync(join(out, 'fetch-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify(manifest, null, 2));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });
