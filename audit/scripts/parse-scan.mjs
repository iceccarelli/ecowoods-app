#!/usr/bin/env node
/**
 * audit/scripts/parse-scan.mjs
 *
 * MANDATORY GATE. Run this after any automated edit to a .ts/.tsx/.js/.mjs file
 * and before generating any patch.
 *
 * This repository has taken two production outages from source files written
 * with literal `\n` sequences instead of newlines, and from a blind `\n` ->
 * newline replacement that destroyed intentional escapes inside string and
 * regex literals. grep cannot see either failure. The TypeScript compiler can.
 *
 * Three checks, in order of how badly each has burned this codebase:
 *
 *   1. PARSE     — every file parses with zero syntactic diagnostics.
 *   2. STRANDED  — no `${...}` sits inside a plain quoted string. A
 *                  `${BUSINESS_NAP.phoneDisplay}` inside single quotes renders
 *                  that text verbatim to a customer.
 *   3. LITERAL_N — no source line contains a literal backslash-n OUTSIDE a
 *                  string or regex literal, and no file is a single enormous
 *                  line (the shape corruption takes).
 *
 * Usage:
 *   node audit/scripts/parse-scan.mjs                 # whole repo
 *   node audit/scripts/parse-scan.mjs apps/web        # one subtree
 *   node audit/scripts/parse-scan.mjs a.tsx b.tsx     # specific files
 *
 * Exit 0 = clean. Exit 1 = defects found. Exit 2 = tooling unavailable.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
let ts = null;
const candidates = [
  'typescript',
  path.resolve('node_modules/typescript'),
  path.resolve('apps/web/node_modules/typescript'),
  path.resolve('apps/mobile/node_modules/typescript'),
];
for (const c of candidates) {
  try { ts = require_(c); break; } catch { /* try next */ }
}
if (!ts) {
  console.error('parse-scan: typescript is not resolvable from', process.cwd());
  console.error('            run `pnpm install` first, or run from the repo root.');
  process.exit(2);
}

const EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const SKIP = new Set(['node_modules', '.next', '.turbo', 'dist', 'build', '.git', 'coverage']);

const args = process.argv.slice(2);
const roots = args.length ? args : ['.'];
const files = [];
for (const r of roots) {
  const abs = path.resolve(r);
  if (!fs.existsSync(abs)) { console.error(`parse-scan: no such path: ${r}`); process.exit(2); }
  if (fs.statSync(abs).isFile()) { if (EXT.test(abs)) files.push(abs); continue; }
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (SKIP.has(e.name) || e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (EXT.test(e.name)) files.push(p);
    }
  })(abs);
}

const kindFor = (f) => (/\.tsx$/.test(f) ? ts.ScriptKind.TSX
  : /\.jsx$/.test(f) ? ts.ScriptKind.JSX
  : /\.ts$/.test(f) ? ts.ScriptKind.TS
  : ts.ScriptKind.JS);

const problems = [];
let scanned = 0;

for (const file of files) {
  const rel = path.relative(process.cwd(), file);
  let src;
  try { src = fs.readFileSync(file, 'utf8'); }
  catch (e) { problems.push({ rel, line: 0, kind: 'READ', msg: e.message }); continue; }
  scanned++;

  /* ---- 3a. the single-enormous-line shape corruption takes ----
     A long line is only suspicious if it is NOT a data URI. lib/brand.ts is
     legitimately one 14 KB line because it holds a base64 monogram; flagging it
     every run would train everyone to ignore this script. */
  const lines = src.split('\n');
  const isDataUri = (l) => /data:[a-z]+\/[a-z+.-]+;base64,/i.test(l);
  let longest = 0, longestIdx = 0;
  lines.forEach((l, i) => { if (!isDataUri(l) && l.length > longest) { longest = l.length; longestIdx = i; } });
  if (lines.length <= 3 && src.length > 1500 && !lines.some(isDataUri)) {
    problems.push({ rel, line: 1, kind: 'LITERAL_N', msg: `file is ${lines.length} line(s) / ${src.length} bytes — likely written with literal \\n` });
  } else if (longest > 4000) {
    problems.push({ rel, line: longestIdx + 1, kind: 'LITERAL_N', msg: `single line of ${longest} chars — inspect for literal \\n` });
  }

  /* ---- 1. parse ---- */
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, kindFor(file));
  const diags = sf.parseDiagnostics || [];
  for (const d of diags) {
    const { line } = sf.getLineAndCharacterOfPosition(d.start ?? 0);
    problems.push({ rel, line: line + 1, kind: 'PARSE', msg: ts.flattenDiagnosticMessageText(d.messageText, ' ') });
  }
  if (diags.length) continue;   // a broken parse makes the AST walks meaningless

  /* ---- 2 + 3b. AST walks ---- */
  (function visit(node) {
    /* stranded interpolation: ${...} inside a plain string literal */
    if (ts.isStringLiteral(node) && /\$\{[^}]+\}/.test(node.text)) {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
      problems.push({
        rel, line: line + 1, kind: 'STRANDED',
        msg: `\${...} inside a plain string — renders verbatim: ${node.getText().slice(0, 70)}`,
      });
    }
    /* literal backslash-n that survived as two characters in JSX attribute text */
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const raw = node.initializer.getText();
      if (/\\n|\\"|\\\s*$/.test(raw.slice(1, -1))) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
        problems.push({
          rel, line: line + 1, kind: 'LITERAL_N',
          msg: `JSX attributes do not process backslash escapes — ${raw.slice(0, 60)} ships the backslash`,
        });
      }
    }
    ts.forEachChild(node, visit);
  })(sf);
}

const byKind = problems.reduce((a, p) => { (a[p.kind] ||= []).push(p); return a; }, {});
console.log(`parse-scan: ${scanned} file(s) scanned under ${roots.join(', ')}`);
for (const kind of ['PARSE', 'STRANDED', 'LITERAL_N', 'READ']) {
  const list = byKind[kind];
  if (!list) continue;
  console.log(`\n${kind} (${list.length})`);
  for (const p of list) console.log(`  ${p.rel}:${p.line}  ${p.msg}`);
}
if (!problems.length) console.log('\nOK — zero diagnostics.');
else console.log(`\n${problems.length} problem(s). Do not generate a patch from this tree.`);

process.exit(problems.length ? 1 : 0);
