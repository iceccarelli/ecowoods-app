#!/usr/bin/env node
/**
 * audit/scripts/reduced-motion-audit.mjs
 *
 * Hunts the P0 that a careless reduced-motion fix creates: an element whose ONLY
 * route to visibility is a keyframe animation, sitting inside a
 * `prefers-reduced-motion: reduce` block that sets `animation: none`. The
 * animation is cancelled, the base rule still says opacity:0, and the content
 * never appears for the user who asked for less motion.
 *
 * FALSE POSITIVES THIS SCRIPT DELIBERATELY SUPPRESSES — every one of them was
 * produced by an earlier revision of this script against this stylesheet, and
 * every one was wrong on inspection:
 *
 *   1. opacity:0 declared only in a STATE rule (`[open]`, `.is-active`, `:hover`).
 *      `.sx-plus::after` and `.footer-col-chevron::after` fade out when the
 *      accordion opens — that is a plus turning into a minus, not hidden content.
 *   2. A base rule with opacity:0 that some OTHER rule restores to opacity:1
 *      (`:hover`, `:focus-visible`, `.in`, `[data-open]`). `.progress-tick-label`
 *      is a tooltip revealed on hover; cancelling its transition just makes it
 *      snap.
 *   3. `@keyframes X { from { opacity: 0 } }` with no fill-mode. Cancelling the
 *      animation lands the element on its normal, visible state. `.sheet-panel`
 *      and `.sheet-scrim` are correct as written.
 *
 * What remains after those three filters is worth looking at by hand.
 *
 * Usage: node audit/scripts/reduced-motion-audit.mjs [--verbose]
 * Exit 1 if any selector can be left invisible.
 */
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.resolve('apps/web/app/globals.css'), 'utf8');
const lineOf = i => css.slice(0, i).split('\n').length;
const VERBOSE = process.argv.includes('--verbose');

/* ---- flatten every rule, carrying its @media context ---- */
const rules = [];
(function walk(text, offset, media) {
  const re = /([^{}]+)\{/g; let m;
  while ((m = re.exec(text))) {
    const sel = m[1].trim().replace(/\s+/g, ' ');
    let i = m.index + m[0].length - 1, d = 0; const s = i;
    for (; i < text.length; i++) { if (text[i] === '{') d++; else if (text[i] === '}') { d--; if (d === 0) break; } }
    const body = text.slice(s + 1, i);
    if (/^@(media|supports|container|layer)/.test(sel)) walk(body, offset + s + 1, sel);
    else if (!/^@/.test(sel)) rules.push({ sel, body, line: lineOf(offset + m.index), media });
    re.lastIndex = i + 1;
  }
})(css, 0, null);

/* ---- keyframes, so we can tell a from-hidden animation from a to-visible one ---- */
const keyframes = {};
for (const m of css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
  let i = css.indexOf('{', m.index), d = 0; const s = i;
  for (; i < css.length; i++) { if (css[i] === '{') d++; else if (css[i] === '}') { d--; if (d === 0) break; } }
  keyframes[m[1]] = css.slice(s + 1, i);
}

const HIDDEN = /(^|[;\s])opacity\s*:\s*0(\.0+)?\s*(!important)?\s*(;|$)|visibility\s*:\s*hidden|transform\s*:[^;]*(translate[XY]?\(\s*-?(?:100|[6-9]\d)%|scale\(\s*0(\.\d+)?\s*\))/;
const VISIBLE = /(^|[;\s])opacity\s*:\s*(1|0\.[89])|transform\s*:\s*none|visibility\s*:\s*visible/;
/* a selector fragment that only applies in a particular interaction/open state */
const STATE = /:hover|:focus|:active|:checked|\[open\]|\[aria-expanded=|\[data-(open|active|passed|state)|\.is-|\.in\b|\.active\b|\.open\b|\.checked\b/;

const baseName = sel => sel.split(',').map(s => s.trim());
const allRules = sel => rules.filter(r => !r.media && baseName(r.sel).some(s => s === sel));
/* any rule anywhere whose selector CONTAINS this one and restores visibility */
const restoredElsewhere = sel => rules.some(r =>
  !/prefers-reduced-motion/.test(r.media || '') &&
  baseName(r.sel).some(s => s !== sel && s.includes(sel)) &&
  VISIBLE.test(r.body));

const rm = rules.filter(r => /prefers-reduced-motion/.test(r.media || ''));
const rows = [];

for (const r of rm) {
  const killsAnim = /animation(-name)?\s*:\s*none/.test(r.body);
  const killsTrans = /transition(-duration|-property)?\s*:\s*(none|0s)/.test(r.body);
  if (!killsAnim && !killsTrans) continue;
  const restoresHere = VISIBLE.test(r.body);

  for (const sel of baseName(r.sel)) {
    const bases = allRules(sel);
    /* filter 1 — opacity:0 that lives only in a state rule is not a base state */
    const hiddenInBase = bases.some(b => HIDDEN.test(b.body) && !STATE.test(b.sel));
    /* filter 3 — a from-hidden keyframe with no fill-mode is safe to cancel */
    let animOnlyPath = false;
    for (const b of bases) {
      const a = b.body.match(/animation\s*:\s*([^;]+)/);
      if (!a) continue;
      const name = (a[1].match(/\b([a-zA-Z][\w-]*)\b/g) || []).find(n => keyframes[n]);
      const fills = /\b(forwards|both)\b/.test(a[1]);
      if (name && fills && HIDDEN.test(b.body)) animOnlyPath = true;
    }
    /* filter 2 — some other rule restores it */
    const rescued = restoresHere || restoredElsewhere(sel);

    const risk = (hiddenInBase && !rescued) || animOnlyPath;
    rows.push({ sel, rmLine: r.line, baseLines: bases.map(b => b.line), hiddenInBase, animOnlyPath, rescued, risk, killsAnim, killsTrans });
  }
}

const bad = rows.filter(r => r.risk);
console.log('selector'.padEnd(30), 'rm@'.padEnd(6), 'base@'.padEnd(14), 'hidden'.padEnd(7), 'rescued'.padEnd(8), 'RISK');
console.log('-'.repeat(80));
for (const r of rows.sort((a, b) => Number(b.risk) - Number(a.risk))) {
  if (!VERBOSE && !r.risk && !r.hiddenInBase) continue;
  console.log(r.sel.slice(0, 29).padEnd(30), String(r.rmLine).padEnd(6), (r.baseLines.join(',') || '-').slice(0, 13).padEnd(14),
    String(r.hiddenInBase).padEnd(7), String(r.rescued).padEnd(8), r.risk ? 'P0 <==' : '');
}
console.log(`\n${rows.length} selector(s) switched off under reduced motion; ${bad.length} can be left invisible.`);
console.log('Run with --verbose to see the ones that were checked and cleared.');

/* the global sledgehammer — worth knowing it is there before adding more blocks */
const global = rules.find(r => /prefers-reduced-motion/.test(r.media || '') && /^\*/.test(r.sel));
if (global) console.log(`\nNOTE: a global reset exists at globals.css:${global.line} — "${global.sel}". Most per-component reduced-motion blocks in this file are redundant with it.`);

process.exit(bad.length ? 1 : 0);
