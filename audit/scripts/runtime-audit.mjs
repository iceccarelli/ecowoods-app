#!/usr/bin/env node
/**
 * audit/scripts/runtime-audit.mjs
 *
 * The half of the Phase 0 audit that static analysis cannot do. Everything in
 * here needs a real layout engine: computed styles, element boxes, scroll
 * widths, stacking-context collisions, axe-core.
 *
 * WHAT IT MEASURES, per route x viewport x theme:
 *   OVERFLOW   documentElement.scrollWidth > clientWidth, plus the specific
 *              elements whose right edge exceeds the viewport. Eyeballing a
 *              narrowed desktop window does not find these; this does.
 *   TAP        every interactive element under 44x44 CSS px, and pairs of
 *              interactive elements less than 8px apart.
 *   IOSZOOM    every input/select/textarea whose COMPUTED font-size < 16px.
 *              Mobile Safari auto-zooms on focus and does not zoom back.
 *   FIXEDLAYER pairwise intersection of position:fixed layers (.topbar,
 *              .sticky-cta-mobile, .progress-rail, ChatWidget dock, cookie bar),
 *              measured at the top of the page AND scrolled to the bottom.
 *   AXE        axe-core violations, both themes.
 *
 * SETUP
 *   pnpm dlx playwright install chromium
 *   pnpm --filter @ecowoods/web dev        # in another terminal
 *   node audit/scripts/runtime-audit.mjs   # writes audit/runtime-report.json
 *
 * OPTIONS
 *   --base=http://localhost:3000   target origin (default)
 *   --routes=/,/design             comma list; default is the public set below
 *   --shots                        also write screenshots to audit/shots/
 *   --skip-axe                     skip the axe pass (much faster)
 *
 * Exit 1 if any P0 (overflow, iOS zoom, axe violation) is found.
 */
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => {
  const m = process.argv.find(a => a.startsWith(`--${k}=`));
  return m ? m.split('=').slice(1).join('=') : d;
};
const flag = k => process.argv.includes(`--${k}`);

const BASE = arg('base', 'http://localhost:3000');
const SHOTS = flag('shots');
const SKIP_AXE = flag('skip-axe');

/* Public routes only. Portal and admin need auth — see audit/DEFERRED.md. */
const DEFAULT_ROUTES = [
  '/', '/design', '/products/floorforge', '/authority', '/technical-library',
  '/blog', '/case-studies', '/service-areas', '/service-areas/downtown-toronto',
  '/login', '/register',
];
const ROUTES = arg('routes', '').trim() ? arg('routes').split(',') : DEFAULT_ROUTES;

/* Phase 2 test matrix, verbatim. 320 and landscape phone are where sticky
   headers and bottom CTAs collide — do not drop them to save time. */
const VIEWPORTS = [
  { name: '320-min', width: 320, height: 640 },
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone-15-pro', width: 393, height: 852 },
  { name: 'iphone-15-pro-max', width: 430, height: 932 },
  { name: 'pixel-8', width: 412, height: 915 },
  { name: 'phone-landscape', width: 852, height: 393 },
  { name: 'ipad-mini-portrait', width: 744, height: 1133 },
  { name: 'ipad-pro-landscape', width: 1194, height: 834 },
  { name: 'laptop', width: 1440, height: 900 },
  { name: 'desktop-wide', width: 1920, height: 1080 },
];
const THEMES = ['light', 'dark'];

let chromium, AxeBuilder = null;
try { ({ chromium } = await import('playwright')); }
catch { console.error('playwright not installed. Run: pnpm dlx playwright install chromium'); process.exit(2); }
if (!SKIP_AXE) {
  try { ({ default: AxeBuilder } = await import('@axe-core/playwright')); }
  catch { console.error('NOTE: @axe-core/playwright not installed — axe pass skipped.'); }
}

const IN_PAGE = () => {
  const vw = document.documentElement.clientWidth;
  const out = { overflow: null, offenders: [], tapSmall: [], tapCrowded: [], iosZoom: [], fixedLayers: [] };

  /* --- horizontal overflow --- */
  const sw = document.documentElement.scrollWidth;
  if (sw > vw + 1) {
    out.overflow = { scrollWidth: sw, clientWidth: vw, excess: sw - vw };
    /* The first version of this collector kept the first 25 offenders in DOM
       ORDER. The site chrome (header, progress rail) and the off-canvas mobile
       sheet's ~20 links come first in the DOM and consumed every slot, so the
       element actually SETTING the document width was never captured — and
       every entry that was captured is a `width: 100%` box stretched by an
       already-wide document, i.e. a consequence, not a cause.
       Now: drop the consequences, drop the sheet's contents, rank by width. */
    const sheet = document.getElementById('mobile-sheet');
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (!(r.right > vw + 1 || r.left < -1)) continue;
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' && cs.visibility === 'hidden') continue;
      if (sheet && (el === sheet || sheet.contains(el))) continue;   // off-canvas menu
      if (Math.round(r.width) >= sw - 2) continue;                   // stretched to the document
      out.offenders.push({
        sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''),
        left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width),
        pos: cs.position, ov: cs.overflowX,
      });
    }
    out.offenders.sort((a, b) => b.width - a.width);
    out.offenders = out.offenders.slice(0, 25);

    /* Also record what the widest thing in the document actually is, whether or
       not it crosses the viewport edge — that is usually the real culprit. */
    let widest = null;
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (sheet && (el === sheet || sheet.contains(el))) continue;
      if (Math.round(r.width) >= sw - 2) continue;
      if (!widest || r.width > widest.w) {
        widest = { w: Math.round(r.width), sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '') };
      }
    }
    out.widestNonFull = widest;
  }

  /* --- tap targets --- */
  const INTERACTIVE = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [tabindex]:not([tabindex="-1"])';
  const boxes = [];
  for (const el of document.querySelectorAll(INTERACTIVE)) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || r.width === 0 || r.height === 0) continue;
    const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40);
    const desc = { sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''), label, w: Math.round(r.width), h: Math.round(r.height) };
    boxes.push({ r, desc });
    if (r.width < 44 || r.height < 44) out.tapSmall.push(desc);
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].r, b = boxes[j].r;
      if (a.right < b.left - 8 || b.right < a.left - 8 || a.bottom < b.top - 8 || b.bottom < a.top - 8) continue;
      const overlapping = !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
      if (overlapping) continue;                       /* nested/contained — not a crowding issue */
      const gapX = Math.max(b.left - a.right, a.left - b.right);
      const gapY = Math.max(b.top - a.bottom, a.top - b.bottom);
      const gap = Math.max(gapX, gapY);
      if (gap >= 0 && gap < 8) out.tapCrowded.push({ a: boxes[i].desc, b: boxes[j].desc, gap: Math.round(gap) });
    }
  }
  out.tapCrowded = out.tapCrowded.slice(0, 20);

  /* --- iOS auto-zoom --- */
  for (const el of document.querySelectorAll('input:not([type=hidden]):not([type=range]):not([type=checkbox]):not([type=radio]), select, textarea')) {
    const fsz = parseFloat(getComputedStyle(el).fontSize);
    if (fsz < 16) out.iosZoom.push({ sel: el.tagName.toLowerCase() + (el.name ? `[name=${el.name}]` : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''), fontSize: fsz });
  }

  /* --- fixed-layer collisions --- */
  const fixed = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (el.closest('[data-runtime-audit-ignore]')) continue;
    fixed.push({ el, r, z: cs.zIndex, sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') });
  }
  for (let i = 0; i < fixed.length; i++) {
    for (let j = i + 1; j < fixed.length; j++) {
      const a = fixed[i], b = fixed[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const o = !(a.r.right <= b.r.left || b.r.right <= a.r.left || a.r.bottom <= b.r.top || b.r.bottom <= a.r.top);
      if (o) out.fixedLayers.push({ a: a.sel, aZ: a.z, b: b.sel, bZ: b.z });
    }
  }
  /* Recorded per cell because axe reported document-title and html-has-lang
     failing on /register in 19 of 20 cells, while a direct request to the same
     route returns 200 with a correct <title> and lang="en-CA". One of those two
     observations is about the harness rather than the page; capturing the
     values at the moment axe runs is what tells them apart. */
  out.docTitle = document.title;
  out.docLang = document.documentElement.lang;
  return out;
};

const report = { base: BASE, generatedAt: new Date().toISOString(), routes: ROUTES, viewports: VIEWPORTS.map(v => v.name), results: [] };
const browser = await chromium.launch();
if (SHOTS) fs.mkdirSync('audit/shots', { recursive: true });

let p0 = 0;
for (const theme of THEMES) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      isMobile: vp.width < 768,
      hasTouch: vp.width < 768,
      colorScheme: theme,          /* also drives Tailwind's `dark:` on /authority */
    });
    /* The site reads localStorage['ecowoods:theme'] pre-paint. Set it before any
       navigation so the no-flash script picks it up on first load. */
    await ctx.addInitScript(t => { try { localStorage.setItem('ecowoods:theme', t); } catch {} }, theme);

    for (const route of ROUTES) {
      const page = await ctx.newPage();
      const key = `${theme}|${vp.name}|${route}`;
      try {
        /* NOT networkidle: /register and the other authenticated-shell routes
           poll /api/auth/session continuously, so the network never goes idle
           and the wait either times out or returns at an arbitrary moment. */
        await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForLoadState('load').catch(() => {});
        await page.waitForTimeout(800);            /* let fonts and .reveal settle */
        const top = await page.evaluate(IN_PAGE);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(400);
        const bottom = await page.evaluate(IN_PAGE);

        let axe = null;
        if (AxeBuilder) {
          const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
          axe = r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help }));
        }
        if (SHOTS) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({ path: `audit/shots/${theme}_${vp.name}_${route.replace(/\W+/g, '_') || 'root'}.png`, fullPage: true });
        }
        const bad = !!top.overflow || !!bottom.overflow || top.iosZoom.length || (axe && axe.length);
        if (bad) p0++;
        report.results.push({ theme, viewport: vp.name, route, top, bottom, axe });
        console.log(`${bad ? 'FAIL' : ' ok '}  ${key}${top.overflow ? `  overflow +${top.overflow.excess}px` : ''}${top.iosZoom.length ? `  iosZoom x${top.iosZoom.length}` : ''}${axe && axe.length ? `  axe x${axe.length}` : ''}`);
      } catch (e) {
        report.results.push({ theme, viewport: vp.name, route, error: String(e.message).slice(0, 200) });
        console.log(`ERR   ${key}  ${e.message.slice(0, 90)}`);
      }
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();

fs.mkdirSync('audit', { recursive: true });
fs.writeFileSync('audit/runtime-report.json', JSON.stringify(report, null, 2));
console.log(`\nwrote audit/runtime-report.json — ${report.results.length} cells, ${p0} with a P0.`);
process.exit(p0 ? 1 : 0);
