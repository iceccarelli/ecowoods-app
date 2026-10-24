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
    'network-requests': { details: { items: [{ url: 'https://x.test/a.js', transferSize: 1024 }, { url: 'https://x.test/b.jpg', transferSize: 900000 }, { url: 'https://x.test/missing.png', transferSize: 300000, statusCode: 404 }] } },
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
  assert.deepEqual(s.failed_requests, ['404  /missing.png']);
});

test('the median run by performance score is chosen', () => {
  assert.equal(pickMedian([lhr(0.9, 1), lhr(0.4, 2), lhr(0.5, 3)]).categories.performance.score, 0.5);
});

test('a report with no audits does not throw', () => {
  assert.equal(summarise({ requestedUrl: 'u' }).lcp_element, null);
});

test('LCP element, phases and failing audits are found in the newer insight layout', () => {
  const r = lhr(0.5, 4000);
  delete r.audits['largest-contentful-paint-element'];
  r.audits['lcp-breakdown-insight'] = {
    details: { items: [{ type: 'table', items: [{ label: 'Time to first byte', duration: 120.4 }, { label: 'Element render delay', duration: 2400 }] }, { type: 'list', items: [{ type: 'node', nodeLabel: 'Hero', snippet: '<h1>' }] }] },
  };
  r.audits['render-blocking-insight'] = { score: 0.2, scoreDisplayMode: 'metricSavings', displayValue: 'Est savings of 300 ms', metricSavings: { LCP: 300 } };
  r.categories.performance.auditRefs = [{ id: 'render-blocking-insight' }];
  const s = summarise(r);
  assert.match(s.lcp_element, /hero/i);
  assert.deepEqual(s.lcp_phases, ['Time to first byte: 120 ms', 'Element render delay: 2400 ms']);
  assert.match(s.failing_audits[0], /render-blocking-insight.*LCP -300/);
});
