import test from 'node:test';
import assert from 'node:assert/strict';
import { summarise, pickMedian } from './lhci-summary.mjs';

const lhr = (score, lcp) => ({
  requestedUrl: 'http://localhost:3000/',
  categories: { performance: { score } },
  audits: {
    'largest-contentful-paint': { numericValue: lcp },
    'largest-contentful-paint-element': { details: { items: [{ items: [{ node: { nodeLabel: 'Hero', snippet: '<img class="hero">' } }] }] } },
    'total-byte-weight': { numericValue: 2048 * 1024 },
    'network-requests': { details: { items: [{ url: 'https://x.test/a.js', transferSize: 1024 }, { url: 'https://x.test/b.jpg', transferSize: 900000 }] } },
    'bootup-time': { details: { items: [{ url: 'https://x.test/a.js', total: 812.4, scripting: 700 }] } },
  },
});

test('summary names the LCP element, heaviest request first, and script time', () => {
  const s = summarise(lhr(0.44, 7091));
  assert.equal(s.lcp_ms, 7091);
  assert.match(s.lcp_element, /hero/i);
  assert.match(s.heaviest_requests[0], /b\.jpg/);
  assert.match(s.script_time[0], /812 ms/);
  assert.equal(s.total_transfer, '2048 kB');
});

test('the median run by performance score is chosen', () => {
  assert.equal(pickMedian([lhr(0.9, 1), lhr(0.4, 2), lhr(0.5, 3)]).categories.performance.score, 0.5);
});

test('a report with no audits does not throw', () => {
  assert.equal(summarise({ requestedUrl: 'u' }).lcp_element, null);
});
