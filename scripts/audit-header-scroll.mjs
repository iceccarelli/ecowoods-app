#!/usr/bin/env node
/**
 * scripts/audit-header-scroll.mjs — proof, not assertion, that the header
 * does not blink.
 *
 *   node scripts/audit-header-scroll.mjs                  (all checks)
 *   node scripts/audit-header-scroll.mjs --base http://localhost:3000
 *   node scripts/audit-header-scroll.mjs --strict          (non-zero exit on any failure)
 *
 * WHY THIS EXISTS
 *
 * lib/scroll-state.test.ts proves the pure state machine is correct for
 * every gesture it is given. It cannot prove the browser never hands that
 * function a corrupted sample — which is exactly what was measured here:
 * `window.scrollY`, read from requestAnimationFrame during real Chromium
 * wheel-driven scrolling, occasionally reports a single-frame backward
 * excursion of 60-90+ px that the very next frame corrects. The pure
 * function's own follow-up note in lib/scroll-state.ts explains the fix
 * (a flip needs a second vote); this script is what actually drives a real
 * browser against a real build and checks the header does not visibly
 * flicker as a result.
 *
 * MUST RUN AGAINST A PRODUCTION BUILD. `next dev`'s webpack runtime needs
 * `unsafe-eval`, which this site's CSP does not grant (deliberately — see
 * next.config.js), so React never hydrates under `next dev` and every check
 * here would silently measure a dead page. `pnpm build && pnpm start` first.
 *
 * THREE CHECKS
 *   1. scroll  — a continuous scroll gesture (coarse and fine-grained) must
 *                not toggle the header's hidden/shown class more than the
 *                genuine threshold crossings a single-direction scroll
 *                actually contains.
 *   2. reversal — scroll down, pause, scroll back up: the header must hide
 *                once and show again once, no more.
 *   3. reload  — reloading a page that was scrolled part way down must not
 *                deliver the header hidden on arrival (BLINK-01's original
 *                concern, plus the scroll-restoration-animation follow-up).
 */
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const BASE = arg('--base', process.env.BASE_URL ?? 'http://localhost:3000');
const STRICT = args.includes('--strict');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const results = [];
const report = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

async function withPage(fn) {
  const browser = await chromium.launch({ executablePath: CHROME });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    return await fn(page);
  } finally {
    await browser.close();
  }
}

async function watchHeaderClass(page) {
  await page.evaluate(() => {
    const header = document.querySelector('header.topbar');
    window.__classLog = [];
    if (!header) return;
    let last = header.className;
    new MutationObserver(() => {
      if (header.className !== last) {
        window.__classLog.push({ t: performance.now(), cls: header.className });
        last = header.className;
      }
    }).observe(header, { attributes: true, attributeFilter: ['class'] });
  });
}

async function scrollGesture(page, { fine }) {
  if (fine) {
    for (let i = 0; i < 400; i++) {
      const t = i / 400;
      const delta = t < 0.7 ? 8 : Math.max(0.5, 8 * Math.exp(-(t - 0.7) * 12));
      await page.mouse.wheel(0, delta);
      await page.waitForTimeout(8);
    }
  } else {
    for (let i = 0; i < 120; i++) {
      await page.mouse.wheel(0, 25);
      await page.waitForTimeout(16);
    }
  }
  await page.waitForTimeout(300);
}

/* ── 1. scroll gestures never blink ──────────────────────────────────── */
for (const fine of [false, true]) {
  await withPage(async (page) => {
    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    await watchHeaderClass(page);
    await scrollGesture(page, { fine });
    const log = await page.evaluate(() => window.__classLog);
    // A single continuous scroll down should cross the "scrolled" dead band
    // once and the "hidden" threshold at most once. More than that is a
    // flicker, not a gesture — see lib/scroll-state.ts for the thresholds.
    const pass = log.length <= 2;
    report(
      `scroll (${fine ? 'fine-grained' : 'coarse'}): header class changes during a steady scroll`,
      pass,
      `${log.length} change(s): ${log.map((c) => c.cls.trim()).join(' -> ') || 'none'}`,
    );
  });
}

/* ── 2. a real reversal hides once and shows once ────────────────────── */
await withPage(async (page) => {
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await watchHeaderClass(page);
  for (let i = 0; i < 60; i++) { await page.mouse.wheel(0, 25); await page.waitForTimeout(16); }
  await page.waitForTimeout(300);
  for (let i = 0; i < 20; i++) { await page.mouse.wheel(0, -25); await page.waitForTimeout(16); }
  await page.waitForTimeout(300);
  const log = await page.evaluate(() => window.__classLog);
  const pass = log.length === 3; // scrolled-on, hidden, shown-again
  report('reversal: scroll down then up hides once and shows once', pass, `${log.length} change(s)`);
});

/* ── 3. reload mid-page does not hide the header on arrival ─────────── */
await withPage(async (page) => {
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.evaluate(() => window.scrollTo(0, 1800));
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(500);
  const cls = await page.evaluate(() => document.querySelector('header.topbar')?.className ?? '');
  const pass = !cls.includes('hidden');
  report('reload: header is shown on arrival after a mid-page reload', pass, `class="${cls.trim()}"`);
});

/* ── 4. the chat widget is deferred, not eager ───────────────────────── */
await withPage(async (page) => {
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  const early = await page.evaluate(() =>
    !!document.querySelector('[aria-label*="EcowoodsGuide" i], button[aria-label*="hat" i]'),
  );
  await page.waitForTimeout(4500);
  const late = await page.evaluate(() =>
    !!document.querySelector('[aria-label*="EcowoodsGuide" i], button[aria-label*="hat" i]'),
  );
  report('chat widget: not in the DOM immediately after load', !early);
  report('chat widget: mounts once idle/timeout fires', late);
});

const failed = results.filter((r) => !r.pass);
console.log('');
console.log(failed.length ? `✗ ${failed.length}/${results.length} check(s) failed` : `✓ all ${results.length} checks passed`);
if (failed.length && STRICT) process.exit(1);
