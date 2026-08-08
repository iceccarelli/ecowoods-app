#!/usr/bin/env node
/**
 * audit/scripts/undefined-tokens-audit.mjs
 *
 * Finds every `var(--x)` in CSS and TSX whose token is never defined anywhere.
 * An undefined custom property with no fallback makes the whole declaration
 * invalid at computed-value time: the property silently falls back to its
 * inherited or initial value. Nothing errors, nothing logs — the layout just
 * quietly loses its padding.
 *
 * Usage: node audit/scripts/undefined-tokens-audit.mjs
 * Exit 1 if any undefined token without a fallback is referenced.
 */
import fs from 'node:fs';
import path from 'node:path';

const roots = ['apps/web', 'packages'];
const files = [];
for (const r of roots) {
  if (!fs.existsSync(r)) continue;
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(css|tsx|ts)$/.test(e.name)) files.push(p);
    }
  })(r);
}

const defined = new Set();
const refs = [];               // {token, file, line, hasFallback}
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  lines.forEach((l, i) => {
    for (const m of l.matchAll(/(--[a-zA-Z][\w-]*)\s*:/g)) defined.add(m[1]);
    for (const m of l.matchAll(/var\(\s*(--[a-zA-Z][\w-]*)\s*(,)?/g)) refs.push({ token: m[1], file: f, line: i + 1, hasFallback: !!m[2] });
  });
}
/* tokens set from JS (element.style.setProperty / style objects) also count */
for (const f of files.filter(f => /\.tsx?$/.test(f))) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/setProperty\(\s*['"`](--[\w-]+)/g)) defined.add(m[1]);
  for (const m of src.matchAll(/['"`](--[\w-]+)['"`]\s*:/g)) defined.add(m[1]);
}

const bad = refs.filter(r => !defined.has(r.token));
const noFallback = bad.filter(r => !r.hasFallback);
const grouped = {};
for (const r of bad) (grouped[r.token] ||= []).push(r);

console.log(`tokens defined: ${defined.size}   var() references: ${refs.length}   undefined: ${bad.length}\n`);
for (const [tok, rs] of Object.entries(grouped).sort((a, b) => b[1].length - a[1].length)) {
  const fb = rs.every(r => r.hasFallback) ? ' (all have a fallback — harmless)' : '';
  console.log(`${tok}  x${rs.length}${fb}`);
  for (const r of rs.slice(0, 20)) console.log(`    ${r.file}:${r.line}${r.hasFallback ? '  [fallback]' : ''}`);
  if (rs.length > 20) console.log(`    ... ${rs.length - 20} more`);
}
console.log(`\n${noFallback.length} reference(s) to an undefined token WITHOUT a fallback — these silently drop the declaration.`);
process.exit(noFallback.length ? 1 : 0);
