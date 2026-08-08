#!/usr/bin/env node
/**
 * audit/scripts/semantics-audit.mjs
 *
 * Static (AST) semantic audit of apps/web JSX. Catches the machine-readability
 * and screen-reader defects that survive a purely visual review:
 *
 *   - <main> / <nav> / <header> / <footer> landmark counts per layout+page
 *   - heading levels used per page and skipped levels
 *   - <div onClick> / <span onClick> used as a control
 *   - <img> without an alt attribute
 *   - <a> with no href, <a> used for an action
 *
 * Static analysis cannot see the rendered composition of layout + page, so
 * landmark counts are reported per FILE and must be summed along the layout
 * chain by hand. That limitation is stated rather than hidden.
 *
 * Usage: node audit/scripts/semantics-audit.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require_ = createRequire(import.meta.url);
let ts;
for (const p of ['typescript', path.resolve('apps/mobile/node_modules/typescript'), path.resolve('node_modules/typescript')]) {
  try { ts = require_(p); break; } catch {}
}
if (!ts) { console.error('typescript not resolvable'); process.exit(2); }

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (/\.tsx$/.test(e.name)) files.push(p);
  }
})(path.resolve('apps/web/app'));

const landmarks = [];
const headings = [];
const divClicks = [];
const imgNoAlt = [];
const badAnchors = [];

for (const file of files) {
  const rel = path.relative(process.cwd(), file);
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const at = n => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
  const counts = {}; const hs = new Set();
  (function visit(node) {
    const el = ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node) ? node : null;
    if (el) {
      const tag = el.tagName.getText();
      const attrs = {};
      for (const a of el.attributes.properties) {
        if (ts.isJsxAttribute(a)) attrs[a.name.getText()] = a.initializer ? a.initializer.getText() : 'true';
      }
      if (['main', 'nav', 'header', 'footer', 'aside'].includes(tag)) {
        counts[tag] = (counts[tag] || 0) + 1;
        if (tag === 'nav' && !attrs['aria-label'] && !attrs['aria-labelledby']) landmarks.push({ rel, line: at(el), issue: 'unlabelled <nav>' });
        if (attrs['role']) landmarks.push({ rel, line: at(el), issue: `redundant role=${attrs['role']} on <${tag}>` });
      }
      if (/^h[1-6]$/.test(tag)) { hs.add(Number(tag[1])); headings.push({ rel, line: at(el), level: Number(tag[1]) }); }
      if (['div', 'span', 'li'].includes(tag) && attrs['onClick'] && !attrs['role']) divClicks.push({ rel, line: at(el), tag });
      if (tag === 'img' && !('alt' in attrs)) imgNoAlt.push({ rel, line: at(el) });
      if (tag === 'a' && !attrs['href'] && attrs['onClick']) badAnchors.push({ rel, line: at(el) });
    }
    ts.forEachChild(node, visit);
  })(sf);
  if (Object.keys(counts).length) landmarks.push({ rel, counts });
}

console.log('=== LANDMARK COUNTS PER FILE (sum along the layout chain by hand) ===');
for (const l of landmarks.filter(l => l.counts)) console.log(' ', Object.entries(l.counts).map(([k, v]) => `${k}:${v}`).join(' ').padEnd(28), l.rel);
console.log('\n=== LANDMARK ISSUES ===');
for (const l of landmarks.filter(l => l.issue)) console.log(`  ${l.rel}:${l.line}  ${l.issue}`);

console.log('\n=== HEADING LEVELS PER page.tsx (own file only) ===');
const pages = [...new Set(headings.map(h => h.rel))].filter(r => /page\.tsx$/.test(r)).sort();
for (const p of pages) {
  const lv = headings.filter(h => h.rel === p).map(h => h.level);
  const uniq = [...new Set(lv)].sort();
  const h1 = lv.filter(x => x === 1).length;
  let skip = ''; for (let i = 1; i < uniq.length; i++) if (uniq[i] - uniq[i - 1] > 1) skip += ` skip h${uniq[i - 1]}->h${uniq[i]}`;
  const flag = (h1 !== 1 ? ` h1x${h1}` : '') + skip;
  console.log(`  ${('[' + uniq.join(',') + ']').padEnd(18)} ${p}${flag ? '   <==' + flag : ''}`);
}
console.log('\n=== <div|span|li onClick> without role (should be <button>) ===');
console.log(divClicks.length ? divClicks.map(d => `  ${d.rel}:${d.line}  <${d.tag} onClick>`).join('\n') : '  (none)');
console.log('\n=== <img> without alt ===');
console.log(imgNoAlt.length ? imgNoAlt.map(d => `  ${d.rel}:${d.line}`).join('\n') : '  (none)');
console.log('\n=== <a onClick> without href ===');
console.log(badAnchors.length ? badAnchors.map(d => `  ${d.rel}:${d.line}`).join('\n') : '  (none)');
