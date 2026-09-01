#!/usr/bin/env node
/**
 * scripts/verify-chrome.mjs
 *
 * The header is on every page, so a mistake in it is a mistake everywhere. Four
 * shipped at once, and each was a single CSS declaration:
 *
 *  1. `.topbar { position: fixed }` — out of flow, so it reserved no height and
 *     painted straight over the UtilityBar underneath it. Measured at 1474px:
 *     the strip occupied y 0–39, the header y 0–65. The hours and phone number
 *     were invisible and the first 26px of every page was under the bar. When
 *     the hide-on-scroll class fired, the strip appeared from nowhere — the
 *     "double header in the wrong place".
 *
 *  2. `.topbar-nav { min-width: max-content }` — cancels the `flex: 0 1 auto`
 *     on the same element, so the nav could not give up a pixel and the row
 *     overflowed right. Because .topbar was fixed, that overflow never touched
 *     the document's scrollWidth, so NO overflow check could see it. The Free
 *     Quote button was simply 114px off the right of the screen.
 *
 *  3. `.topbar-nav { overflow: clip }` — hid the evidence of (2) and, being an
 *     ancestor of the mega-menu, clipped the menu. The nav box is 40px tall;
 *     the panel opens 61px down. 100% of it was clipped. That was the whole of
 *     "the dropdown does not work".
 *
 *  4. `.mm-panel { left: 50%; transform: translateX(-50%) }` on a 1120px panel
 *     centred on a trigger near the left of the bar: measured left edge -282px
 *     at 1280px. Fixing (3) alone would have shipped a menu that opens a
 *     quarter off-screen, which reads as broken rather than as absent.
 *
 * And one that was never shipped but nearly was: a transform on .site-chrome.
 * .mobile-sheet is a sibling of <header>, so it lives inside that wrapper and
 * is `position: fixed; inset: 0`. A transform on an ancestor becomes the
 * containing block for fixed descendants and would collapse the whole-screen
 * drawer to a 104px bar.
 *
 * All five are single declarations that look harmless in review. This guard is
 * cheaper than finding them again.
 *
 *   node scripts/verify-chrome.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CSS = path.join(ROOT, 'apps/web/app/globals.css');
const LAYOUT = path.join(ROOT, 'apps/web/app/layout.tsx');

if (!fs.existsSync(CSS)) {
  console.error('verify-chrome: apps/web/app/globals.css not found — run from the repo root.');
  process.exit(2);
}
/**
 * COMMENTS ARE NOT CSS.
 *
 * The first run of this guard reported five failures and every one was false:
 * the comments in globals.css QUOTE the broken declarations they replaced —
 * "this was `left: 50%; transform: translateX(-50%)`" — and a parser reading
 * raw text finds them, blames them, and prints half a paragraph of prose as a
 * property value. verify-destinations.mjs learned the identical lesson from
 * SiteFooter's comment about the href it used to have. A guard that cries wolf
 * gets switched off, so the comments go first.
 */
const css = fs.readFileSync(CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const fail = [];

/** Every declaration block whose selector list mentions `sel` as a whole class. */
function blocks(sel) {
  const out = [];
  const re = new RegExp(`(^|[,{}\\s])\\${sel}(?![\\w-])[^{}]*\\{([^{}]*)\\}`, 'g');
  for (const m of css.matchAll(re)) out.push(m[2]);
  return out;
}
/** Last value wins in the cascade, so read the last declaration of a property. */
function lastValue(sel, prop) {
  let v = null;
  for (const b of blocks(sel)) {
    const m = [...b.matchAll(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'g'))];
    if (m.length) v = m[m.length - 1][1].trim();
  }
  return v;
}

/* ── 1. the bars stay in flow ────────────────────────────────────────────── */
const topbarPos = lastValue('.topbar', 'position');
if (topbarPos === 'fixed' || topbarPos === 'absolute') {
  fail.push(
    `.topbar has position: ${topbarPos}. Out of flow it reserves no height and paints over the ` +
      'UtilityBar and the top of every page. The chrome sticks via .site-chrome; .topbar stays static.',
  );
}
const chromePos = lastValue('.site-chrome', 'position');
if (chromePos !== 'sticky') {
  fail.push(`.site-chrome has position: ${chromePos ?? '(unset)'} — it must be sticky so the chrome reserves its own height and still pins on scroll.`);
}

/* ── 2. nothing that creates a containing block on the chrome wrapper ───── */
for (const prop of ['transform', 'filter', 'perspective', 'backdrop-filter', 'contain']) {
  const v = lastValue('.site-chrome', prop);
  if (v && v !== 'none') {
    fail.push(
      `.site-chrome sets ${prop}: ${v}. That makes it the containing block for fixed descendants, and ` +
        '.mobile-sheet (position: fixed; inset: 0) is inside it — the full-screen drawer would collapse to the bar.',
    );
  }
}

/* ── 3. the nav must shrink, and must not clip its own menu ──────────────── */
const navMin = lastValue('.topbar-nav', 'min-width');
if (navMin && navMin !== '0' && !/^0[a-z%]*$/.test(navMin)) {
  fail.push(`.topbar-nav has min-width: ${navMin}, which cancels its flex-shrink. The row then overflows right, invisibly.`);
}
for (const prop of ['overflow', 'overflow-x', 'overflow-y']) {
  const v = lastValue('.topbar-nav', prop);
  if (v && v !== 'visible') {
    fail.push(`.topbar-nav has ${prop}: ${v}. It is an ancestor of .mm-panel, so this clips the mega-menu out of existence.`);
  }
}

/* ── 4. the panel is anchored to the shell, not to its trigger ──────────── */
if (lastValue('.mm', 'position') === 'relative') {
  fail.push('.mm is position: relative, so it becomes the containing block for .mm-panel and the panel centres on one word — measured at -282px off the left edge.');
}
if (lastValue('.topbar-inner', 'position') !== 'relative') {
  fail.push('.topbar-inner must be position: relative — it is the containing block .mm-panel is measured against.');
}
const panelTransform = lastValue('.mm-panel', 'transform');
if (panelTransform && panelTransform !== 'none') {
  fail.push(`.mm-panel has transform: ${panelTransform}. It is anchored with left/right against the shell; a translate puts it back off-screen.`);
}

/* ── 5. the layout actually renders the wrapper ──────────────────────────── */
if (fs.existsSync(LAYOUT)) {
  const layout = fs.readFileSync(LAYOUT, 'utf8');
  if (!/className=["']site-chrome["']/.test(layout)) {
    fail.push('layout.tsx does not render <div className="site-chrome">. The CSS above has nothing to apply to.');
  } else {
    const i = layout.indexOf('site-chrome');
    const after = layout.slice(i, i + 600);
    for (const c of ['UtilityBar', 'Header']) {
      if (!after.includes(`<${c}`)) fail.push(`<${c} /> is not inside .site-chrome — the two bars must share one sticky block or they overlap again.`);
    }
  }
}

if (fail.length) {
  console.error(`✗ chrome: ${fail.length} problem(s)\n`);
  for (const f of fail) console.error(`  · ${f}\n`);
  process.exit(1);
}
console.log(
  '✓ chrome verified — the bars stay in flow and reserve their height, the nav can shrink and cannot clip ' +
    'its menu, the panel is anchored to the shell, and nothing on the wrapper can collapse the mobile drawer',
);
