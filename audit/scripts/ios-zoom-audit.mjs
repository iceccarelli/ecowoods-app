#!/usr/bin/env node
/**
 * audit/scripts/ios-zoom-audit.mjs
 *
 * Mobile Safari auto-zooms the viewport when a focused input/select/textarea has
 * a computed font-size below 16px. The zoom is not reversed on blur, so the user
 * is left on a horizontally-scrolled page mid-form. This is the single most
 * common "the form is broken on my iPhone" report.
 *
 * Static pass: every CSS rule whose selector targets a form control, with the
 * font-size it sets resolved through the --fs-* scale.
 * Also lists form controls that set NO font-size (they inherit — usually fine,
 * but 1rem must actually be 16px at the root).
 *
 * Usage: node audit/scripts/ios-zoom-audit.mjs
 * Exit 1 if any control resolves below 16px.
 */
import fs from 'node:fs';
import path from 'node:path';
const css = fs.readFileSync(path.resolve('apps/web/app/globals.css'), 'utf8');

const scale = {};
for (const m of css.matchAll(/(--fs-[\w-]+)\s*:\s*([^;]+);/g)) scale[m[1]] = m[2].trim();
const rootFont = (css.match(/html\s*\{[^}]*font-size\s*:\s*([^;]+);/) || [])[1] || '16px (browser default — no html font-size set)';

/* Only real form controls. An earlier revision matched `.fc-*` wholesale and
   reported .fc-spec dt and .fc-step as iOS-zoom risks — they are a <dt> and a
   caption, not inputs. Over-reporting here trains people to ignore the script. */
const CONTROL = /(^|[\s,>+~])(input|select|textarea)\b|\[type=|\.field\s+(input|select|textarea)|\.shop-input\b|\.shop-select\b|\.fc-postal\b|\.cmdk-search\s+input/i;
const rules = [];
{
  const re = /([^{}]+)\{([^{}]*)\}/g; let m;
  while ((m = re.exec(css))) {
    const sel = m[1].trim().replace(/\s+/g, ' ');
    if (sel.startsWith('@') || !CONTROL.test(sel)) continue;
    const fs_ = m[2].match(/font-size\s*:\s*([^;]+)/);
    rules.push({ sel, line: css.slice(0, m.index).split('\n').length, fontSize: fs_ ? fs_[1].trim() : null });
  }
}
const px = v => {
  if (!v) return null;
  const tok = v.match(/var\(\s*(--fs-[\w-]+)/);
  if (tok) v = scale[tok[1]] ?? v;
  let m;
  if ((m = v.match(/([\d.]+)rem/))) return +m[1] * 16;
  if ((m = v.match(/([\d.]+)px/))) return +m[1];
  if ((m = v.match(/([\d.]+)em/))) return +m[1] * 16;
  return null;
};

console.log('root font-size:', rootFont, '\n');
console.log('px    font-size          line  selector');
let fails = 0;
for (const r of rules.sort((a, b) => (px(a.fontSize) ?? 99) - (px(b.fontSize) ?? 99))) {
  const p = px(r.fontSize);
  const bad = p !== null && p < 16;
  if (bad) fails++;
  console.log(`${String(p ?? '—').padEnd(5)} ${String(r.fontSize ?? '(inherits)').padEnd(18)} ${String(r.line).padEnd(5)} ${r.sel.slice(0, 70)}${bad ? '   <== iOS ZOOM' : ''}`);
}
console.log(`\n--fs-* scale: ${Object.entries(scale).map(([k, v]) => `${k}=${v}`).join('  ')}`);
console.log(`\n${fails} form-control rule(s) below 16px.`);
console.log('NOTE: static analysis cannot resolve cascade or inline styles. Confirm with the');
console.log('      runtime pass in audit/scripts/runtime-audit.mjs before closing this item.');
process.exit(fails ? 1 : 0);
