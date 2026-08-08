#!/usr/bin/env node
/**
 * audit/scripts/contrast-audit.mjs
 *
 * Computes WCAG 2.2 contrast ratios for every (foreground token x surface token)
 * pair in BOTH themes, straight from the token definitions in globals.css.
 * No browser, no network, no dependencies.
 *
 * Alpha foregrounds are composited over the surface before measuring, which is
 * what a browser does and what a naive "is the hex dark enough" check misses.
 *
 * Usage: node audit/scripts/contrast-audit.mjs [--json]
 * Exit code 1 if any pair marked REQUIRED falls below its threshold.
 */
import fs from 'node:fs';
import path from 'node:path';

const CSS = path.resolve(process.cwd(), 'apps/web/app/globals.css');
const css = fs.readFileSync(CSS, 'utf8');

/* ---------- token extraction ---------- */
function blocksFor(re) {
  const out = [];
  for (const m of css.matchAll(re)) {
    let i = css.indexOf('{', m.index), d = 0; const s = i;
    for (; i < css.length; i++) { if (css[i] === '{') d++; else if (css[i] === '}') { d--; if (d === 0) break; } }
    out.push(css.slice(s + 1, i));
  }
  return out;
}
function toks(text, acc) {
  for (const m of text.matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g)) acc[m[1]] = m[2].trim().replace(/\s+/g, ' ');
  return acc;
}
const light = {}; blocksFor(/(^|\n):root\s*\{/g).forEach(t => toks(t, light));
const dark = Object.assign({}, light); blocksFor(/html\[data-theme='dark'\]\s*\{/g).forEach(t => toks(t, dark));

/* ---------- colour parsing ---------- */
const clamp01 = x => Math.min(1, Math.max(0, x));
function oklchToSrgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lin = [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ].map(clamp01);
  const enc = u => (u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(u, 1 / 2.4) - 0.055);
  return lin.map(u => Math.round(clamp01(enc(u)) * 255));
}
/** Resolve a token value (following var() chains) to {r,g,b,a} or null. */
function parseColor(value, table, seen = 0) {
  if (!value || seen > 8) return null;
  let v = value.trim();
  const varm = v.match(/^var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,\s*(.+))?\)$/);
  if (varm) return parseColor(table[varm[1]] ?? varm[2], table, seen + 1);
  let m;
  if ((m = v.match(/^#([0-9a-fA-F]{3,8})$/))) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join('');
    const n = p => parseInt(h.slice(p, p + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  if ((m = v.match(/^rgba?\(([^)]+)\)$/))) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  if ((m = v.match(/^oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+))?\)$/))) {
    const L = v.includes('%') ? Number(m[1]) / 100 : Number(m[1]);
    const [r, g, b] = oklchToSrgb(L, Number(m[2]), Number(m[3]));
    return { r, g, b, a: m[4] ? Number(m[4]) : 1 };
  }
  return null;
}
const over = (fg, bg) => ({
  r: fg.r * fg.a + bg.r * (1 - fg.a),
  g: fg.g * fg.a + bg.g * (1 - fg.a),
  b: fg.b * fg.a + bg.b * (1 - fg.a),
  a: 1,
});
function lum({ r, g, b }) {
  const f = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

/* ---------- the pairs that actually occur in this design system ---------- */
const SURFACES = ['--bg', '--surface', '--surface-1', '--surface-2', '--surface-warm'];
const DARK_SURFACES = ['--walnut-900', '--walnut-950', '--surface-deep', '--forest-deep'];
const BODY_FG = ['--ink', '--ink-soft', '--muted', '--muted-soft', '--copper-text', '--copper', '--forest', '--success', '--warning', '--danger'];
const ON_DARK_FG = ['--on-dark', '--on-dark-muted', '--on-dark-faint', '--copper-bright', '--copper', '--maple-200'];
/* Non-text UI boundaries need 3:1, not 4.5:1 (WCAG 1.4.11). */
const UI_PAIRS = [['--line', '--bg'], ['--line-strong', '--bg'], ['--on-dark-line', '--walnut-900'], ['--copper', '--bg']];

const rows = [];
function measure(theme, table, fgList, bgList, kind) {
  for (const bgName of bgList) for (const fgName of fgList) {
    const bg = parseColor(table[bgName], table);
    let fg = parseColor(table[fgName], table);
    if (!bg || !fg) { rows.push({ theme, fg: fgName, bg: bgName, kind, ratio: null, note: 'unresolved' }); continue; }
    const composited = fg.a < 1 ? over(fg, bg) : fg;
    rows.push({ theme, fg: fgName, bg: bgName, kind, alpha: fg.a, ratio: +ratio(composited, bg).toFixed(2) });
  }
}
for (const [theme, table] of [['light', light], ['dark', dark]]) {
  measure(theme, table, BODY_FG, SURFACES, 'text');
  measure(theme, table, ON_DARK_FG, DARK_SURFACES, 'text');
  for (const [fgName, bgName] of UI_PAIRS) {
    const bg = parseColor(table[bgName], table); const fg = parseColor(table[fgName], table);
    if (!bg || !fg) continue;
    rows.push({ theme, fg: fgName, bg: bgName, kind: 'ui', alpha: fg.a, ratio: +ratio(fg.a < 1 ? over(fg, bg) : fg, bg).toFixed(2) });
  }
}

const threshold = r => (r.kind === 'ui' ? 3 : 4.5);
const fails = rows.filter(r => r.ratio !== null && r.ratio < threshold(r));

if (process.argv.includes('--json')) { console.log(JSON.stringify(rows, null, 2)); }
else {
  const w = [7, 18, 16, 6, 9, 6];
  const line = c => c.map((s, i) => String(s).padEnd(w[i])).join(' ');
  console.log(line(['theme', 'foreground', 'background', 'need', 'measured', 'verdict']));
  console.log('-'.repeat(70));
  for (const r of rows.sort((a, b) => (a.ratio ?? 99) - (b.ratio ?? 99))) {
    const need = threshold(r);
    const ok = r.ratio === null ? '?' : r.ratio >= need ? 'PASS' : (r.kind === 'text' && r.ratio >= 3 ? 'FAIL*' : 'FAIL');
    console.log(line([r.theme, r.fg, r.bg, need + ':1', r.ratio ?? r.note, ok]));
  }
  console.log('\n* FAIL* = passes only as "large text" (>=18.66px bold / >=24px). Verify the actual rule.');
  console.log(`\n${fails.length} of ${rows.length} pairs below threshold.`);
}
process.exit(fails.length ? 1 : 0);
