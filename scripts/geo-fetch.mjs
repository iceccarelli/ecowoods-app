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
import { mkdirSync, writeFileSync, createWriteStream, openSync, readSync, closeSync, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { US_VARIABLES, parseCsvLine } from './geo-sources.mjs';
import { WDS_TABLES } from './geo-wds.mjs';

export const CATALOGUE_URL = 'https://www150.statcan.gc.ca/n1/en/catalogue/98-401-X2021005';
export const ACS_BASE = 'https://api.census.gov/data/2024/acs/acs5';
export const CA_REQUIRED_COLUMNS = ['DGUID', 'ALT_GEO_CODE', 'GEO_LEVEL', 'GEO_NAME', 'CHARACTERISTIC_NAME', 'C1_COUNT_TOTAL'];
export const MIN_CA_BYTES = 50 * 1024 * 1024; // the CSD-level profile is hundreds of MB; an error page is not
export const MIN_ACS_ROWS = 100;
export const WDS = 'https://www150.statcan.gc.ca/t1/wds/rest';
export const WDS_REQUIRED_COLUMNS = ['REF_DATE', 'GEO', 'DGUID', 'Coordinate'];
/** The Census API answers keyless data queries with a redirect to its "Missing Key" page. */
export function explainCensusRedirect(finalUrl) {
  return /api\.census\.gov\/data\/missing_key/.test(finalUrl)
    ? 'the Census API requires an API key: request one free at https://api.census.gov/data/key_signup.html and add it as the repository secret CENSUS_API_KEY'
    : null;
}
export const MIN_WDS_BYTES = 5 * 1024 * 1024;

/** The WDS answer to getFullTableDownloadCSV: SUCCESS and an https statcan.gc.ca URL, nothing else. */
export function checkWdsDownloadReply(body, pid) {
  if (!body || body.status !== 'SUCCESS' || typeof body.object !== 'string') throw new Error(`WDS ${pid}: unexpected reply ${JSON.stringify(body).slice(0, 160)}`);
  const u = new URL(body.object);
  if (u.protocol !== 'https:' || !/(^|\.)statcan\.gc\.ca$/.test(u.hostname)) throw new Error(`WDS ${pid}: download URL ${u.origin} is not an https statcan.gc.ca host`);
  return u.toString();
}

export function checkWdsHeader(line, pid) {
  const head = parseCsvLine(line.replace(/^\uFEFF/, '').replace(/\r$/, '')).map((h) => h.trim());
  const missing = WDS_REQUIRED_COLUMNS.filter((c) => !head.includes(c));
  if (missing.length) throw new Error(`${pid}: CSV is missing column(s): ${missing.join(', ')}; header is ${JSON.stringify(head).slice(0, 700)}`);
  if (!head.some((h) => /:.*\[\d+\]$/.test(h))) throw new Error(`${pid}: CSV has no "<dimension>:<member>[n]" value columns`);
  return head;
}

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** Throw unless the response is a 200 with an acceptable content type. */
export function checkResponse(res, url, allowedTypes) {
  const type = (res.headers.get('content-type') ?? '').toLowerCase();
  if (res.status !== 200) throw new Error(`${url}: HTTP ${res.status}`);
  if (!allowedTypes.some((t) => type.includes(t))) throw new Error(`${url}: content-type "${type}" is not one of ${allowedTypes.join(', ')}`);
  return type;
}

export const isZip = (buf) => buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;

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

/** Every link that could plausibly lead to the data, for diagnosing a page whose layout changed. */
export function findDataLinks(html, base = CATALOGUE_URL, cap = 60) {
  const out = new Set();
  for (const m of html.matchAll(/href="([^"]+)"/gi)) {
    const href = m[1].replace(/&amp;/g, '&');
    if (/(download|telecharger|\.csv|\.zip|csv|98-401|census-recensement|prof)/i.test(href)) {
      try { out.add(new URL(href, base).toString()); } catch { /* not a URL */ }
    }
  }
  return [...out].slice(0, cap);
}

/** CSV download anchors with their visible text, absolute and de-duplicated by URL. */
export function findCsvAnchors(html, base = CATALOGUE_URL) {
  const out = new Map();
  for (const m of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1].replace(/&amp;/g, '&');
    if (!/(FILETYPE=CSV|_CSV\.zip|csv.*\.zip)/i.test(href)) continue;
    const text = m[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    try { out.set(new URL(href, base).toString(), text); } catch { /* not a URL */ }
  }
  return [...out].map(([url, text]) => ({ url, text }));
}
export const findCsvLinks = (html, base = CATALOGUE_URL) => findCsvAnchors(html, base).map((a) => a.url);

/** The one anchor that is the census-subdivision profile, or an error naming every candidate. */
export function pickCsdAnchor(anchors) {
  const hits = anchors.filter((a) => /census subdivisions?|\bCSDs?\b/i.test(a.text));
  if (hits.length !== 1) {
    throw new Error(`expected exactly one census-subdivision CSV link, found ${hits.length} of ${anchors.length}:\n` +
      anchors.map((a) => `  ${a.text} -> ${a.url}`).join('\n'));
  }
  return hits[0].url;
}

async function getWithRetry(url, types, tries = 3) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try { return await get(url, types); } catch (e) {
      last = e;
      console.warn(`attempt ${i}/${tries} failed: ${e.message}`);
      if (/requires an API key/.test(e.message)) throw e;
      if (i < tries) await new Promise((r) => setTimeout(r, 5000 * i));
    }
  }
  throw last;
}

async function get(url, types, opts = {}) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; ecowoods-geo-ingest/1.0; +https://ecowoods.ca)',
      accept: types.includes('json') && !types.includes('html') ? 'application/json' : 'text/html,application/xhtml+xml,application/zip,application/json;q=0.9,*/*;q=0.8',
      'accept-language': 'en-CA,en;q=0.9',
    },
  });
  const needKey = explainCensusRedirect(res.url);
  if (needKey) throw new Error(needKey);
  let type;
  try { type = checkResponse(res, url.replace(/([?&]key=)[^&]+/, '$1…'), types); } catch (e) {
    const body = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
    throw new Error(`${e.message}${body ? ` — body starts: ${JSON.stringify(body)}` : ''}`);
  }
  return { buf: Buffer.from(await res.arrayBuffer()), type, finalUrl: res.url, ...opts };
}

async function downloadWdsCube(pid, out, manifest) {
  const reply = await get(`${WDS}/getFullTableDownloadCSV/${pid}/en`, ['json']);
  const url = checkWdsDownloadReply(JSON.parse(reply.buf.toString('utf8')), pid);
  const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'ecowoods-geo-ingest/1.0 (+https://ecowoods.ca)' } });
  const type = checkResponse(res, url, ['zip', 'octet-stream']);
  const zip = join(out, `${pid}.zip`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(zip));
  const head = Buffer.alloc(4);
  const fd = openSync(zip, 'r'); readSync(fd, head, 0, 4, 0); closeSync(fd);
  if (!isZip(head)) {
    const peek = Buffer.alloc(200);
    const f = openSync(zip, 'r'); const got = readSync(f, peek, 0, 200, 0); closeSync(f);
    throw new Error(`WDS ${pid}: download is not a zip (url ${url}, content-type ${type}, ${statSync(zip).size} bytes, starts ${JSON.stringify(peek.subarray(0, got).toString('latin1'))})`);
  }
  execFileSync('unzip', ['-o', '-q', zip, `${pid}.csv`, '-d', out]);
  const csv = join(out, `${pid}.csv`);
  const size = statSync(csv).size;
  if (size < MIN_WDS_BYTES) throw new Error(`WDS ${pid}: CSV is only ${size} bytes`);
  const fd2 = openSync(csv, 'r'); const buf = Buffer.alloc(65536); const n = readSync(fd2, buf, 0, 65536, 0); closeSync(fd2);
  const firstLines = buf.subarray(0, n).toString('utf8').split('\n').slice(0, 4);
  try { checkWdsHeader(firstLines[0], pid); } catch (e) { throw new Error(`${e.message}\nfirst lines: ${JSON.stringify(firstLines).slice(0, 1500)}`); }
  manifest.files.push({ name: `${pid}.csv`, url, bytes: size });
}

async function main() {
  const a = process.argv.slice(2);
  const out = a[a.indexOf('--out') + 1];
  if (!out || out.startsWith('--')) { console.error('--out DIR required'); process.exit(1); }
  mkdirSync(out, { recursive: true });
  const manifest = { fetchedAt: new Date().toISOString(), files: [] };

  let caUrl = a.includes('--ca-url') ? a[a.indexOf('--ca-url') + 1] : '';
  if (!caUrl && !a.includes('--ca-profile')) {
    for (const t of WDS_TABLES) await downloadWdsCube(t.pid, out, manifest);
  } else if (!caUrl) {
    const page = await get(CATALOGUE_URL, ['text/html']);
    let html = page.buf.toString('utf8');
    let anchors = findCsvAnchors(html);
    if (anchors.length === 0) {
      /* The catalogue page points at the Census Profile download page, which lists the files. */
      const next = findDataLinks(html).find((u) => /download-telecharger\.cfm/i.test(u));
      console.log(`catalogue page has no CSV link; following ${next ?? '(no download page link)'}`);
      if (!next) throw new Error(`no download page link found; candidates:\n${findDataLinks(html).join('\n')}`);
      const dl = await get(next, ['text/html']);
      html = dl.buf.toString('utf8');
      anchors = findCsvAnchors(html, next);
      console.log(`download page (${dl.buf.length} bytes) lists ${anchors.length} CSV link(s):\n${anchors.map((x) => `  ${x.text} -> ${x.url}`).join('\n')}`);
      if (anchors.length === 0) console.log(`links on the download page:\n${findDataLinks(html, next).join('\n')}`);
    }
    caUrl = pickCsdAnchor(anchors);
  }
  if (caUrl || a.includes('--ca-profile')) await downloadProfile(caUrl, out, manifest);
  if (!a.includes('--no-us')) await downloadAcs(out, manifest);
  else manifest.files.push({ name: 'acs', skipped: true });
  writeFileSync(join(out, 'fetch-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify(manifest, null, 2));
}

async function downloadProfile(caUrl, out, manifest) {
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

}

async function downloadAcs(out, manifest) {
  for (const [name, geo] of [['acs-place.json', 'place:*&in=state:36'], ['acs-cousub.json', 'county%20subdivision:*&in=state:36&in=county:*']]) {
    const key = process.env.CENSUS_API_KEY ? `&key=${encodeURIComponent(process.env.CENSUS_API_KEY)}` : '';
    const url = `${ACS_BASE}?get=NAME,${US_VARIABLES.join(',')}&for=${geo}`;
    const r = await getWithRetry(url + key, ['json']);
    const json = JSON.parse(r.buf.toString('utf8'));
    const rows = checkAcsJson(json, name);
    writeFileSync(join(out, name), r.buf);
    manifest.files.push({ name, url, bytes: r.buf.length, sha256: sha256(r.buf), contentType: r.type, rows });
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });
