#!/usr/bin/env node
/**
 * scripts/audit-rendered.mjs — what the site does in a browser, at phone width.
 *
 *   node scripts/audit-rendered.mjs
 *   node scripts/audit-rendered.mjs --base http://localhost:3000
 *   node scripts/audit-rendered.mjs --strict     (findings exit non-zero)
 *   node scripts/audit-rendered.mjs --routes /,/commercial,/refer
 *
 * WRITES: audit/rendered.json and audit/rendered.md
 *
 * WHY THIS EXISTS
 *
 * Every other guard in this repository reads source. Source is where most of
 * the bugs are, and it is not where THESE bugs are. A page whose source is
 * impeccable can still, in a 390px-wide browser:
 *
 *   · scroll sideways, because one table or one long word is wider than the
 *     phone. The visitor sees a page that "jumps" and cannot read a line of it
 *     without dragging. Nothing in the source says "I am 412 pixels wide".
 *   · put a 28px tap target next to a thumb. It is a link that works when a
 *     mouse points at it and misses one press in four on a phone.
 *   · scroll an anchor to a heading that then sits UNDER the sticky header.
 *     The link "works" — verify-destinations proves the id exists — and the
 *     visitor still lands looking at the wrong paragraph.
 *   · put a horizontally-scrolling rail on the page that a keyboard cannot
 *     scroll, because the container has no tabindex. WCAG 2.1.1. Real people
 *     with real hands hit this, and no static check can see it.
 *
 * These are measurements, not opinions, and a browser is the only instrument
 * that can take them.
 *
 * THE CONTROL PROBE, AND WHY IT IS NOT OPTIONAL
 *
 * The same rule as crawl-site.mjs, for the same reason. A sandboxed CI box
 * answers every non-allowlisted host with a connection error, so this script
 * run in one reports a completely broken site with total confidence — and the
 * natural response is to go and "fix" a site that was never broken. A false
 * FAIL on a migration is worse than no check at all. So the first request is
 * to a URL that MUST work. If it does not, this script says the environment is
 * blind and exits 0 without reporting a single finding.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const BASE = (arg('--base', process.env.AUDIT_BASE_URL ?? 'https://ecowoods.ca')).replace(/\/+$/, '');
const STRICT = args.includes('--strict');
const OUT = path.join(process.cwd(), 'audit');

/**
 * The routes that carry the money and the ones with the most layout risk.
 * Not all 289 — this is a browser, each page costs seconds, and a rail that
 * overflows overflows on the first city page as surely as on the thirty-second.
 */
const DEFAULT_ROUTES = [
  '/',
  '/commercial',
  '/realtors',
  '/refer',
  '/resources',
  '/services',
  '/services/dust-free-sanding',
  '/hardwood-flooring-toronto',
  '/hardwood-floor-refinishing-toronto',
  '/hardwood-stairs-toronto',
  '/hardwood-floor-problems-toronto',
  '/guides/hardwood-flooring-cost-toronto',
  '/papers/hardwood-selection-and-cost-framework-gta',
  '/case-studies',
  '/service-areas',
  '/service-areas/rosedale',
  '/framework',
  '/reviews',
  '/about',
  '/market',
];
const ROUTES = arg('--routes', '').trim()
  ? arg('--routes', '').split(',').map((r) => r.trim()).filter(Boolean)
  : DEFAULT_ROUTES;

/** Phone, small phone, tablet, laptop. 320 is the narrowest width still in use. */
const VIEWPORTS = [
  { name: 'phone-320', width: 320, height: 720, mobile: true },
  { name: 'phone-390', width: 390, height: 844, mobile: true },
  { name: 'tablet-768', width: 768, height: 1024, mobile: true },
  { name: 'laptop-1280', width: 1280, height: 800, mobile: false },
];

/**
 * TWO THRESHOLDS, AND ONLY ONE OF THEM IS A FINDING.
 *
 * The first run of this script reported 565 tap targets on 20 pages, because it
 * used 44×44 — Apple's HIG number and WCAG 2.5.5, which is AAA — as a failure
 * line. At that threshold a 42px button fails, and so does every link in a
 * footer list. A report with 565 entries is not a report; it is a wall, and the
 * three real problems in it are invisible.
 *
 * WCAG 2.5.8 (AA, the level this site is held to) is 24×24. Below that is a
 * defect: a person with an ordinary thumb cannot reliably hit it. Between 24
 * and 44 is worth knowing and is not worth interrupting anyone about, so it is
 * counted per page and never itemised.
 */
const TAP_FAIL = 24;      // WCAG 2.5.8 AA — below this is a defect
const TAP_ADVISORY = 44;  // WCAG 2.5.5 AAA / Apple HIG — counted, not itemised

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.log('audit-rendered: playwright is not installed here — skipping (this is not a failure).');
  console.log('  pnpm install, then re-run.');
  process.exit(0);
}

/**
 * Some defects belong to the page, not to the viewport: a dead anchor is dead
 * at every width, and reporting it four times turns a five-line report into a
 * twenty-line one that nobody finishes reading. Width-dependent findings —
 * overflow, tap targets, whether a rail actually scrolls — are reported per
 * viewport, because that is the only place the answer can differ.
 */
const VIEWPORT_INDEPENDENT = new Set(['dead-anchor', 'widget-not-focusable', 'aria-controls-dangling', 'anchor-under-header']);

const findings = [];
const advisory = [];          // 24–43px targets: counted, never itemised
const seenFinding = new Set();
const add = (route, viewport, kind, detail) => {
  const key = VIEWPORT_INDEPENDENT.has(kind) ? `${route}|${kind}|${detail}` : `${route}|${viewport}|${kind}|${detail}`;
  if (seenFinding.has(key)) return;
  seenFinding.add(key);
  findings.push({ route, viewport: VIEWPORT_INDEPENDENT.has(kind) ? 'all' : viewport, kind, detail });
};

/**
 * A missing browser binary is the same class of fact as an unreachable site:
 * this environment cannot take the measurement. It is not a finding about the
 * site, so it must not be reported as one, and it must not fail a build.
 * PLAYWRIGHT_CHROMIUM_PATH covers the case where a chromium is present but not
 * the exact build this playwright version pins.
 */
let browser;
try {
  browser = await chromium.launch({
    // /dev/shm is 64 MB in most containers, and Chromium puts its renderer
    // shared memory there. Overrunning it kills the tab with "Target crashed",
    // which is what a Codespace does on the first run of this script.
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}),
  });
} catch (e) {
  console.log('audit-rendered: no usable browser here — skipping (this is not a failure).');
  console.log(`  ${String(e.message).split('\n')[0]}`);
  console.log('  Fix with: npx playwright install chromium');
  console.log('  Or point at an existing binary: PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome');
  process.exit(0);
}
const ctx = await browser.newContext();

/* ── control probe ───────────────────────────────────────────────────────── */
{
  const page = await ctx.newPage();
  let ok = false;
  try {
    const r = await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    ok = !!r && r.status() < 400;
  } catch { /* handled below */ }
  await page.close();
  if (!ok) {
    await browser.close();
    console.log(`audit-rendered: ${BASE}/ did not answer.`);
    console.log('  This environment cannot reach the site, so every finding below would be an');
    console.log('  artefact of the sandbox rather than a fact about the site. Reporting nothing.');
    process.exit(0);
  }
}

/* ── the measurements ────────────────────────────────────────────────────── */
for (const vp of VIEWPORTS) {
  let page;
  try {
    page = await ctx.newPage();
  } catch {
    // One retry: a crashed tab is a memory blip, not a fact about the site.
    await new Promise((r) => setTimeout(r, 2000));
    page = await ctx.newPage();
  }
  await page.setViewportSize({ width: vp.width, height: vp.height });

  for (const route of ROUTES) {
    let res;
    try {
      res = await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45_000 });
    } catch (e) {
      add(route, vp.name, 'unreachable', `${String(e.message).split('\n')[0]} (this may be a login redirect, not a broken page — check the status by hand)`);
      continue;
    }
    if (!res || res.status() >= 400) {
      add(route, vp.name, 'status', `HTTP ${res ? res.status() : 'none'} at ${res ? res.url() : BASE + route}`);
      continue;
    }

    const report = await page.evaluate(
      ({ TAP_FAIL, TAP_ADVISORY, isMobile }) => {
        const out = { overflow: [], overflowPx: 0, tap: [], tapAdvisory: 0, scrollers: [], anchors: [], tabs: [] };

        /* 1. sideways scroll, and WHAT is actually causing it
         *
         * THE MISTAKE THIS CORRECTS. The first version walked every element and
         * blamed anything whose box stuck out past the viewport. On this site
         * that reported three culprits per page, and two of them were not
         * culprits at all:
         *
         *   .mobile-sheet   the nav drawer. position:fixed, translateX(100%),
         *                   visibility:hidden — parked off-canvas until it is
         *                   opened. It is supposed to be at x=320.
         *   .svt-track      a marquee, sitting inside .svt-viewport, which is
         *                   overflow:hidden. Wider than the screen by design
         *                   and clipped by its own parent.
         *
         * An element can only widen the DOCUMENT if nothing between it and the
         * root clips it. Any ancestor with overflow-x other than `visible`
         * establishes a clipping or scrolling container and stops the
         * propagation right there — hidden, clip, auto and scroll all do it.
         * So: measure the real overflow first, then attribute it only to
         * elements that survive that walk, and say so honestly when nothing
         * does rather than naming the nearest wide thing. */
        const doc = document.documentElement;
        const overflowPx = doc.scrollWidth - doc.clientWidth;
        if (overflowPx > 1) {
          out.overflowPx = overflowPx;
          const limit = doc.clientWidth;
          const blamed = new Set();
          for (const el of document.querySelectorAll('body *')) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            if (r.right <= limit + 1 && r.left >= -1) continue;

            const cs = getComputedStyle(el);
            if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;

            let clipped = false, hiddenAncestor = false, alreadyBlamed = false;
            for (let a = el.parentElement; a && a !== doc; a = a.parentElement) {
              if (blamed.has(a)) { alreadyBlamed = true; break; }
              const acs = getComputedStyle(a);
              if (acs.visibility === 'hidden' || acs.display === 'none') { hiddenAncestor = true; break; }
              if (acs.overflowX !== 'visible') { clipped = true; break; }
            }
            if (alreadyBlamed || clipped || hiddenAncestor) continue;

            blamed.add(el);
            /* One cause, one line. A nowrap row pushes every one of its
             * children past the edge; listing four spans that share a parent
             * describes one bug four times, and the parent is the thing anyone
             * would actually edit. So the row is named, with how many of its
             * children overran and how far the worst one got. */
            const parent = el.parentElement;
            const existing = out.overflow.find((o) => o._p === parent);
            if (existing) {
              existing.children++;
              existing.right = Math.max(existing.right, Math.round(r.right));
              continue;
            }
            const host = parent && parent !== document.body ? parent : el;
            out.overflow.push({
              _p: parent,
              tag: host.tagName.toLowerCase(),
              cls: (host.className && String(host.className).trim().slice(0, 50)) || '',
              right: Math.round(r.right),
              viewport: limit,
              children: 1,
              text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 48),
            });
            if (out.overflow.length >= 6) break;
          }
        }

        /* 2. tap targets, phones only, at the AA line */
        if (isMobile) {
          const seen = new Set();
          for (const el of document.querySelectorAll('a[href], button, [role="button"], input:not([type=hidden]), select')) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            const cs = getComputedStyle(el);
            if (cs.visibility === 'hidden' || cs.display === 'none') continue;
            // A link inside running text is text, and text is not a tap target.
            if (el.tagName === 'A' && cs.display === 'inline') continue;
            const min = Math.min(r.width, r.height);
            if (min >= TAP_ADVISORY) continue;
            if (min >= TAP_FAIL) { out.tapAdvisory++; continue; }
            const key = `${el.tagName}:${(el.textContent || '').trim().slice(0, 24)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.tap.push({
              tag: el.tagName.toLowerCase(),
              label: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
              w: Math.round(r.width),
              h: Math.round(r.height),
            });
            if (out.tap.length >= 10) break;
          }
        }

        /* 3. horizontal scrollers a keyboard cannot move (WCAG 2.1.1) */
        for (const el of document.querySelectorAll('*')) {
          const cs = getComputedStyle(el);
          if (cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') continue;
          if (el.scrollWidth <= el.clientWidth + 1) continue;   // nothing to scroll
          const focusable =
            el.hasAttribute('tabindex') ||
            el.matches('a[href], button, input, select, textarea') ||
            !!el.querySelector('a[href], button, input, select, textarea');
          out.scrollers.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className && String(el.className).slice(0, 60)) || '',
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
            keyboardReachable: focusable,
          });
          if (out.scrollers.length >= 10) break;
        }

        /* 4. tab and disclosure widgets: operable, and labelled */
        for (const el of document.querySelectorAll('[role="tab"], [aria-expanded], [role="tablist"]')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const native = el.matches('a[href], button, input, select, textarea, summary');
          const ti = el.getAttribute('tabindex');
          out.tabs.push({
            tag: el.tagName.toLowerCase(),
            role: el.getAttribute('role') || '',
            label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
            focusable: native || (ti !== null && ti !== '-1'),
            controls: el.getAttribute('aria-controls') || null,
            controlsExists: el.getAttribute('aria-controls')
              ? !!document.getElementById(el.getAttribute('aria-controls'))
              : null,
          });
          if (out.tabs.length >= 20) break;
        }

        /* 5. every in-page anchor target, and where it would land */
        const headerH = (() => {
          const v = getComputedStyle(document.documentElement).getPropertyValue('--header-h').trim();
          const n = parseFloat(v);
          return Number.isFinite(n) ? n : 0;
        })();
        const padTop = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
        const ids = new Set(
          [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href').slice(1)).filter(Boolean),
        );
        for (const id of ids) {
          const t = document.getElementById(id);
          out.anchors.push({ id, exists: !!t, headerH, scrollPaddingTop: padTop });
        }
        for (const o of out.overflow) delete o._p;   // not serialisable
        return out;
      },
      { TAP_FAIL, TAP_ADVISORY, isMobile: vp.mobile },
    );

    if (report.overflowPx > 1) {
      if (report.overflow.length) {
        for (const o of report.overflow) {
          add(route, vp.name, 'horizontal-overflow',
            `page scrolls ${report.overflowPx}px sideways — <${o.tag} class="${o.cls}"> pushes ${o.children} child element(s) out to ${o.right}px in a ${o.viewport}px viewport (first: "${o.text}")`);
        }
      } else {
        // Honest about the limit of the instrument: the page does overflow and
        // nothing survived the clipping walk. Naming a clipped element to have
        // something to name is how the first version produced 62 findings.
        add(route, vp.name, 'horizontal-overflow-unattributed',
          `page scrolls ${report.overflowPx}px sideways and no unclipped element accounts for it — open devtools at ${vp.width}px`);
      }
    }
    for (const t of report.tap) {
      add(route, vp.name, 'tap-target', `<${t.tag}> "${t.label}" is ${t.w}×${t.h}px — below the WCAG 2.5.8 AA floor of ${TAP_FAIL}×${TAP_FAIL}`);
    }
    if (report.tapAdvisory) advisory.push({ route, viewport: vp.name, n: report.tapAdvisory });
    for (const s of report.scrollers) {
      if (!s.keyboardReachable) {
        add(route, vp.name, 'scroller-not-keyboardable',
          `<${s.tag} class="${s.cls}"> scrolls ${s.clientWidth}→${s.scrollWidth}px and holds nothing focusable — give it tabindex="0" and an accessible name`);
      }
    }
    for (const t of report.tabs) {
      if (!t.focusable) add(route, vp.name, 'widget-not-focusable', `<${t.tag} role="${t.role}"> "${t.label}" cannot be reached by keyboard`);
      if (t.controlsExists === false) add(route, vp.name, 'aria-controls-dangling', `<${t.tag}> aria-controls="${t.controls}" points at no element`);
    }
    for (const a of report.anchors) {
      if (!a.exists) add(route, vp.name, 'dead-anchor', `#${a.id} is linked on this page and no element has that id`);
      else if (a.scrollPaddingTop < a.headerH) {
        add(route, vp.name, 'anchor-under-header',
          `scroll-padding-top is ${a.scrollPaddingTop}px but the sticky header is ${a.headerH}px — #${a.id} lands behind it`);
      }
    }
  }
  await page.close();
}

await browser.close();

/* ── report ──────────────────────────────────────────────────────────────── */
fs.mkdirSync(OUT, { recursive: true });
const byKind = findings.reduce((a, f) => ((a[f.kind] = (a[f.kind] ?? 0) + 1), a), {});
fs.writeFileSync(path.join(OUT, 'rendered.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), routes: ROUTES.length, viewports: VIEWPORTS.map((v) => v.name), byKind, advisoryTotal: advisory.reduce((a, x) => a + x.n, 0), advisory, findings }, null, 2));

const md = [
  `# Rendered audit — ${BASE}`,
  '',
  `${new Date().toISOString()} · ${ROUTES.length} route(s) × ${VIEWPORTS.length} viewport(s)`,
  '',
  findings.length ? `## ${findings.length} finding(s)` : '## No findings',
  '',
  ...Object.entries(byKind).map(([k, n]) => `- **${k}** — ${n}`),
  '',
  ...findings.map((f) => `- \`${f.route}\` @ ${f.viewport} — **${f.kind}** — ${f.detail}`),
  '',
].join('\n');
fs.writeFileSync(path.join(OUT, 'rendered.md'), md);

console.log(`\naudit-rendered — ${BASE}`);
console.log(`  ${ROUTES.length} route(s) × ${VIEWPORTS.length} viewport(s)`);
const advisoryTotal = advisory.reduce((a, x) => a + x.n, 0);
if (advisoryTotal) {
  const worst = [...advisory].sort((a, b) => b.n - a.n)[0];
  console.log(`  ${String(advisoryTotal).padStart(4)}  tap targets between ${TAP_FAIL}px and ${TAP_ADVISORY}px (advisory — WCAG AAA, not AA)`);
  console.log(`        worst page: ${worst.route} @ ${worst.viewport} with ${worst.n}`);
}
if (!findings.length) {
  console.log('  ✓ no horizontal overflow, no tap target under the AA floor, no unreachable');
  console.log('    scroller, no dead anchor, no anchor landing behind the header.');
} else {
  for (const [k, n] of Object.entries(byKind)) console.log(`  ${String(n).padStart(4)}  ${k}`);
  console.log('\n  Detail: audit/rendered.md');
  for (const f of findings.slice(0, 25)) console.log(`    ${f.route} @ ${f.viewport} — ${f.kind}: ${f.detail}`);
  if (findings.length > 25) console.log(`    … +${findings.length - 25} more`);
}
console.log('');
if (STRICT && findings.length) process.exit(1);
