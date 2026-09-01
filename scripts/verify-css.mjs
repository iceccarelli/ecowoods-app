#!/usr/bin/env node
/**
 * scripts/verify-css.mjs — does the stylesheet actually parse?
 *
 * WHY THIS EXISTS
 *
 * A stray `}` was left behind when a media query was unwrapped: the edit
 * removed the rule inside it and the query's own closing brace survived. All
 * 47 guards passed. `tsc` passed. `pnpm verify` was green. The production
 * build then failed with
 *
 *     Syntax error: globals.css Unexpected } (10408:1)
 *
 * because not one check in this repository had ever asked whether the CSS was
 * valid CSS. Every guard here reads globals.css as TEXT — regexes over selectors
 * and declarations — and text with an extra brace in it reads exactly like text
 * without one. The only thing that would have caught it was `next build`, which
 * takes minutes, needs several gigabytes, and had been dropped from the local
 * command precisely because it kept being killed for memory.
 *
 * So: postcss, which Next already uses to compile this file, is asked to parse
 * it. It is the same parser that failed in production, it runs in about fifty
 * milliseconds, and it needs no memory to speak of. A syntax error is now a
 * failed guard on a laptop instead of a failed deployment.
 *
 * It also reports the brace depth, because "unexpected }" is what an unclosed
 * block LOOKS like hundreds of lines later, and knowing whether the file ends
 * open or closed says which end to look at.
 *
 *   node scripts/verify-css.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = process.cwd();
const require_ = createRequire(path.join(ROOT, 'apps/web/package.json'));

let postcss;
try {
  postcss = require_('postcss');
} catch {
  console.error('verify-css: postcss is not resolvable. It is a Next dependency — run pnpm install.');
  console.error('  Refusing to report a pass, because a guard that cannot run has not checked anything.');
  process.exit(2);
}

/** Every stylesheet the app actually ships. */
const FILES = [];
(function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.next', '.turbo'].includes(e.name)) continue;
      walk(p);
    } else if (/\.css$/.test(e.name)) FILES.push(p);
  }
})(path.join(ROOT, 'apps/web'));

if (!FILES.length) {
  console.error('verify-css: found no .css under apps/web — the walker is blind, fix it rather than deleting the check.');
  process.exit(2);
}

const fail = [];
for (const file of FILES) {
  const css = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);
  try {
    postcss.parse(css, { from: file });
  } catch (e) {
    fail.push(`${rel}: ${e.reason ?? e.message} (line ${e.line}:${e.column})`);
    continue;
  }
  /* Depth is not a syntax check — postcss above is. It is a hint about WHICH
     end of the file to read when one does go wrong. */
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0;
  for (const ch of stripped) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
  }
  if (depth !== 0) fail.push(`${rel}: ends at brace depth ${depth} — ${depth > 0 ? 'a block is never closed' : 'there is an extra closing brace'}`);
}

if (fail.length) {
  console.error(`✗ css: ${fail.length} stylesheet problem(s)\n`);
  for (const f of fail) console.error(`  · ${f}`);
  console.error('\n  This is what breaks the production build while every text-based guard stays green.\n');
  process.exit(1);
}
console.log(`✓ css verified — ${FILES.length} stylesheet(s) parse with the same postcss that compiles them, braces balanced`);
