#!/usr/bin/env node
/**
 * audit/scripts/inline-style-audit.mjs
 *
 * Classifies every JSX `style={{ ... }}` in apps/web by AST, not by grep:
 *
 *   STATIC    every property value is a literal — a defect, belongs in CSS
 *   TOKEN     sets a CSS custom property (--x) — legitimate CSS-in-JS bridge
 *   COMPUTED  at least one value derives from props / state / an expression
 *
 * Only STATIC is unambiguously a defect. Reporting the three separately keeps
 * the Phase 3 target honest: "629 inline styles" is not "629 defects".
 *
 * Usage: node audit/scripts/inline-style-audit.mjs [--list]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
let ts;
for (const p of ['typescript', path.resolve('apps/mobile/node_modules/typescript'), path.resolve('node_modules/typescript')]) {
  try { ts = require_(p); break; } catch { /* next */ }
}
if (!ts) { console.error('typescript not resolvable — run from the repo root after pnpm install'); process.exit(2); }

const ROOT = path.resolve('apps/web');
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx$/.test(e.name)) files.push(p);
  }
})(ROOT);

const byFile = new Map();
let totals = { STATIC: 0, TOKEN: 0, COMPUTED: 0 };
const listing = [];

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const counts = { STATIC: 0, TOKEN: 0, COMPUTED: 0 };
  (function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.getText() === 'style' &&
        node.initializer && ts.isJsxExpression(node.initializer) &&
        node.initializer.expression && ts.isObjectLiteralExpression(node.initializer.expression)) {
      const obj = node.initializer.expression;
      let kind = 'STATIC';
      for (const p of obj.properties) {
        if (ts.isSpreadAssignment(p)) { kind = 'COMPUTED'; break; }
        if (!ts.isPropertyAssignment(p)) { kind = 'COMPUTED'; break; }
        const name = p.name.getText().replace(/['"]/g, '');
        const init = p.initializer;
        const literal = ts.isStringLiteral(init) || ts.isNumericLiteral(init) ||
          (ts.isNoSubstitutionTemplateLiteral && ts.isNoSubstitutionTemplateLiteral(init));
        if (!literal) { kind = 'COMPUTED'; }
        else if (name.startsWith('--') && kind !== 'COMPUTED') kind = 'TOKEN';
      }
      counts[kind]++; totals[kind]++;
      listing.push({ file: path.relative(process.cwd(), file), line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, kind, text: obj.getText().replace(/\s+/g, ' ').slice(0, 90) });
    }
    ts.forEachChild(node, visit);
  })(sf);
  const sum = counts.STATIC + counts.TOKEN + counts.COMPUTED;
  if (sum) byFile.set(path.relative(process.cwd(), file), { ...counts, sum });
}

console.log('TOTAL style={{}} occurrences:', totals.STATIC + totals.TOKEN + totals.COMPUTED);
console.log(`  STATIC   (defect, move to CSS): ${totals.STATIC}`);
console.log(`  TOKEN    (sets --custom-prop)  : ${totals.TOKEN}`);
console.log(`  COMPUTED (from props/state)    : ${totals.COMPUTED}`);
console.log('\nTop files by STATIC count:');
console.log('static token computed  total  file');
for (const [f, c] of [...byFile].sort((a, b) => b[1].STATIC - a[1].STATIC).slice(0, 25)) {
  console.log(String(c.STATIC).padStart(6), String(c.TOKEN).padStart(5), String(c.COMPUTED).padStart(8), String(c.sum).padStart(6), ' ', f);
}
if (process.argv.includes('--list')) {
  console.log('\n--- every STATIC occurrence ---');
  for (const l of listing.filter(l => l.kind === 'STATIC')) console.log(`${l.file}:${l.line}  ${l.text}`);
}
