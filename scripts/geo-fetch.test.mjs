import test from 'node:test';
import assert from 'node:assert/strict';
import { explainCensusRedirect, checkResponse, checkCsvHeader, checkAcsJson, findCsvLinks, findCsvAnchors, pickCsdAnchor, isZip, MIN_ACS_ROWS } from './geo-fetch.mjs';
import { US_VARIABLES } from './geo-sources.mjs';

const res = (status, type) => ({ status, headers: new Headers({ 'content-type': type }) });

test('an error page or wrong content type is refused', () => {
  assert.throws(() => checkResponse(res(404, 'text/html'), 'u', ['zip']), /HTTP 404/);
  assert.throws(() => checkResponse(res(200, 'text/html; charset=utf-8'), 'u', ['zip', 'csv']), /content-type/);
  assert.equal(checkResponse(res(200, 'application/zip'), 'u', ['zip']), 'application/zip');
});

test('zip magic bytes', () => {
  assert.equal(isZip(Buffer.from([0x50, 0x4b, 3, 4, 0])), true);
  assert.equal(isZip(Buffer.from([0x50, 0x4b, 3, 4])), true, 'exactly the four signature bytes');
  assert.equal(isZip(Buffer.from('<html>')), false);
});

test('Census Profile header must carry every required column', () => {
  const ok = '﻿"CENSUS_YEAR","DGUID","ALT_GEO_CODE","GEO_LEVEL","GEO_NAME","CHARACTERISTIC_NAME","C1_COUNT_TOTAL"';
  assert.ok(checkCsvHeader(ok).includes('ALT_GEO_CODE'));
  assert.throws(() => checkCsvHeader('DGUID,GEO_NAME'), /missing column\(s\): .*ALT_GEO_CODE/);
});

test('ACS JSON must be well-formed, complete and non-trivial', () => {
  const head = ['NAME', ...US_VARIABLES, 'state', 'place'];
  const row = Array(head.length).fill('1');
  const good = [head, ...Array.from({ length: MIN_ACS_ROWS }, () => row)];
  assert.equal(checkAcsJson(good, 'x'), MIN_ACS_ROWS);
  assert.throws(() => checkAcsJson({ error: 'x' }, 'x'), /not an ACS/);
  assert.throws(() => checkAcsJson([head.slice(1), row], 'x'), /missing column/);
  assert.throws(() => checkAcsJson([head, row], 'x'), /only 1 row/);
});

test('catalogue links: only CSV downloads, absolute and de-duplicated', () => {
  const html = '<a href="/x/GetFile.cfm?Lang=E&amp;FILETYPE=CSV&amp;GEONO=005">csv</a><a href="/y.pdf">pdf</a><a href="/x/GetFile.cfm?Lang=E&amp;FILETYPE=CSV&amp;GEONO=005">dup</a>';
  const links = findCsvLinks(html, 'https://www150.statcan.gc.ca/n1/en/catalogue/98-401-X2021005');
  assert.deepEqual(links, ['https://www150.statcan.gc.ca/x/GetFile.cfm?Lang=E&FILETYPE=CSV&GEONO=005']);
});

test('the census-subdivision file is picked by its visible text, and only when unambiguous', () => {
  const html = '<a href="/a?FILETYPE=CSV&amp;GEONO=1">Canada, provinces and territories</a>' +
    '<a href="/b?FILETYPE=CSV&amp;GEONO=2"><span>Census subdivisions (CSD)</span></a>';
  const anchors = findCsvAnchors(html, 'https://example.org/x');
  assert.equal(pickCsdAnchor(anchors), 'https://example.org/b?FILETYPE=CSV&GEONO=2');
  assert.throws(() => pickCsdAnchor(anchors.slice(0, 1)), /found 0 of 1/);
  assert.throws(() => pickCsdAnchor([...anchors, { url: 'u', text: 'Census subdivisions again' }]), /found 2 of 3/);
});

test('a redirect to the Census "Missing Key" page is explained, anything else is not', () => {
  assert.match(explainCensusRedirect('https://api.census.gov/data/missing_key.html'), /CENSUS_API_KEY/);
  assert.equal(explainCensusRedirect('https://api.census.gov/data/2024/acs/acs5?get=NAME'), null);
});
