#!/usr/bin/env node
/**
 * audit/scripts/theme-parity-audit.mjs
 *
 * Finds the single most dangerous class of dark-mode bug in this codebase:
 * a rule whose BACKGROUND token flips between themes while its TEXT token does
 * not (or vice versa). The light theme looks fine, so it never gets caught by
 * eye; in dark mode the text lands on a surface it was never designed for.
 *
 * Also reports rules that paint a fixed literal colour (hex / rgb) with no
 * theme awareness at all.
 *
 * Usage: node audit/scripts/theme-parity-audit.mjs
 * Exit 1 if any HIGH-risk rule is found.
 */
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.cwd(), 'apps/web/app/globals.css');
const css = fs.readFileSync(file, 'utf8');
const lines = css.split('\n');

function blocksFor(re) {
  const out = [];
  for (const m of css.matchAll(re)) {
    let i = css.indexOf('{', m.index), d = 0; const s = i;
    for (; i < css.length; i++) { if (css[i] === '{') d++; else if (css[i] === '}') { d--; if (d === 0) break; } }
    out.push(css.slice(s + 1, i));
  }
  return out;
}
const light = {}; const darkOnly = {};
for (const t of blocksFor(/(^|\n):root\s*\{/g)) for (const m of t.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) light[m[1]] = m[2].trim();
for (const t of blocksFor(/html\[data-theme='dark'\]\s*\{/g)) for (const m of t.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) darkOnly[m[1]] = m[2].trim();
const flips = k => k in darkOnly;

/* Walk top-level rules, tracking the selector and its declarations. */
const rules = [];
{
  let i = 0, selStart = 0, depth = 0, sel = '';
  while (i < css.length) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') { const e = css.indexOf('*/', i); i = e < 0 ? css.length : e + 2; continue; }
    if (c === '{') {
      if (depth === 0) { sel = css.slice(selStart, i).trim(); var bodyStart = i + 1; }
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) {
        const body = css.slice(bodyStart, i);
        if (!/^@/.test(sel)) rules.push({ sel, body, line: css.slice(0, bodyStart).split('\n').length });
        selStart = i + 1;
      }
    }
    i++;
  }
}
/* @media / @supports bodies contain nested rules — recurse one level. */
const nested = [];
for (const m of css.matchAll(/@(media|supports|container)[^{]*\{/g)) {
  let i = css.indexOf('{', m.index), d = 0; const s = i;
  for (; i < css.length; i++) { if (css[i] === '{') d++; else if (css[i] === '}') { d--; if (d === 0) break; } }
  const inner = css.slice(s + 1, i);
  const base = css.slice(0, s).split('\n').length;
  for (const r of inner.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    nested.push({ sel: r[1].trim().replace(/\s+/g, ' '), body: r[2], line: base + inner.slice(0, r.index).split('\n').length - 1, media: m[0].replace(/\s*\{$/, '') });
  }
}
const all = [...rules, ...nested];

const findings = { HIGH: [], MED: [], LITERAL: [] };
const tokenOf = v => { const m = String(v).match(/var\(\s*(--[\w-]+)/); return m ? m[1] : null; };

/* Tokens that are theme-fixed ON PURPOSE. --on-dark-* names a surface that is
   dark in both themes (hero, footer, wood-grain sections); --on-copper and the
   --cta-* pair name a filled copper control that keeps the same value at night
   so cream stays at 4.5:1. Pairing one of these with a flipping background is
   the intended pattern, not a split — flagging them buries the real ones. */
const INTENTIONALLY_FIXED = /^--(on-dark|on-copper|cta-fg)/;

for (const r of all) {
  if (/^html\[data-theme/.test(r.sel)) continue;          // explicit dark rules are fine
  const decl = Object.create(null);
  for (const m of r.body.matchAll(/(^|[;{\s])(background|background-color|color|border-color|border)\s*:\s*([^;}]+)/g)) decl[m[2]] = m[3].trim();
  const bgRaw = decl['background'] ?? decl['background-color'];
  const fgRaw = decl['color'];
  if (!fgRaw && !bgRaw) continue;
  const bgTok = bgRaw ? tokenOf(bgRaw) : null;
  const fgTok = fgRaw ? tokenOf(fgRaw) : null;

  if (bgTok && fgTok && flips(bgTok) !== flips(fgTok)
      && !INTENTIONALLY_FIXED.test(fgTok) && !INTENTIONALLY_FIXED.test(bgTok)) {
    findings.HIGH.push({ ...r, fg: fgTok, bg: bgTok, why: `background ${flips(bgTok) ? 'flips' : 'is fixed'} but text ${flips(fgTok) ? 'flips' : 'is fixed'}` });
  } else if (fgRaw && !fgTok && /#[0-9a-f]{3,8}|rgba?\(|\b(white|black)\b/i.test(fgRaw)) {
    findings.LITERAL.push({ ...r, prop: 'color', value: fgRaw });
  } else if (bgRaw && !bgTok && /#[0-9a-f]{3,8}|rgba?\(/i.test(bgRaw) && !/gradient|url\(/.test(bgRaw)) {
    findings.LITERAL.push({ ...r, prop: 'background', value: bgRaw });
  } else if (fgTok && !bgTok && !flips(fgTok) && /^--(walnut|oak|cream|maple|paper|ink)/.test(fgTok) === false && /^--(on-dark)/.test(fgTok) === false) {
    // text token that never flips, inherited background — worth an eye
    findings.MED.push({ ...r, fg: fgTok });
  }
}

const show = (title, arr, fmt) => {
  console.log(`\n=== ${title} (${arr.length}) ===`);
  for (const f of arr.slice(0, 60)) console.log(`  globals.css:${String(f.line).padStart(4)}  ${f.sel.slice(0, 60).padEnd(60)} ${fmt(f)}`);
  if (arr.length > 60) console.log(`  ... and ${arr.length - 60} more`);
};
show('HIGH — theme-split rules (light OK, dark unverified)', findings.HIGH, f => `${f.fg} on ${f.bg} — ${f.why}`);
show('LITERAL — hardcoded colour, no theme awareness', findings.LITERAL, f => `${f.prop}: ${f.value}`);
console.log(`\nHIGH=${findings.HIGH.length} LITERAL=${findings.LITERAL.length} MED=${findings.MED.length}`);
process.exit(findings.HIGH.length ? 1 : 0);
