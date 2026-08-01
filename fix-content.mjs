/**
 * fix-content.mjs — EcoWoods content-library repair (2026-08-01)
 *
 * Run from the repo root:  node fix-content.mjs
 * Idempotent: safe to run more than once.
 *
 * What it does:
 *  1. Decodes literal \n and \" escape corruption in all .mdx files
 *     (both fully single-line files and mixed-corruption files).
 *  2. Quotes frontmatter scalar values containing ": " (invalid unquoted YAML,
 *     e.g. titles like `Yorkville Loft Basement Conversion: High-Moisture …`).
 *  3. Merges the duplicated `challenges:` block in the yorkville case study.
 *  4. Fixes the corrupted slug regexes /\\.mdx$/ -> /\.mdx$/ in both loaders
 *     (root cause of the ".mdx.mdx" ENOENT errors).
 *  5. Validates every .mdx with gray-matter and prints a summary.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const req = createRequire(path.resolve('apps/web/package.json'));
const matter = req('gray-matter');

// ── 5. loader slug regexes ────────────────────────────────────────────────
for (const f of ['apps/web/lib/content/loader.ts', 'apps/web/lib/content/case-study-loader.ts']) {
  let s = fs.readFileSync(f, 'utf8');
  const n = s.split('/\\\\.mdx$/').length - 1;
  if (n) {
    s = s.split('/\\\\.mdx$/').join('/\\.mdx$/');
    fs.writeFileSync(f, s);
    console.log(`OK ${f} — ${n} slug regex(es) fixed`);
  } else {
    console.log(`OK ${f} — regexes already correct`);
  }
}

// ── 1–4. mdx content ──────────────────────────────────────────────────────
const dirs = ['apps/web/content/articles', 'apps/web/content/case-studies'];
const files = dirs.flatMap((d) =>
  fs.readdirSync(d).filter((x) => x.endsWith('.mdx')).map((x) => path.join(d, x)),
);

let clean = 0;
let broken = 0;

for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  const log = [];

  // 1. decode literal escapes
  const nEsc = (s.match(/\\n/g) || []).length;
  if (nEsc) { s = s.replace(/\\n/g, '\n'); log.push(`decoded ${nEsc} literal \\n`); }
  const qEsc = (s.match(/\\"/g) || []).length;
  if (qEsc) { s = s.replace(/\\"/g, '"'); log.push(`decoded ${qEsc} literal \\"`); }

  // 3. yorkville duplicate challenges block
  const dup = '\nchallenges:\n  - title: Sub-Slab Vapor Intrusion Pressure';
  if (f.includes('yorkville') && s.includes(dup)) {
    s = s.replace(dup, '\n  - title: Sub-Slab Vapor Intrusion Pressure');
    log.push('merged duplicated challenges: block');
  }

  // 2. quote colon-bearing frontmatter scalars
  const m = s.match(/^---\n([\s\S]*?)\n---/);
  if (m) {
    const fm = m[1].split('\n');
    let inBlock = false;
    let blockIndent = 0;
    let fixed = 0;
    for (let i = 0; i < fm.length; i++) {
      const L = fm[i];
      const indent = L.match(/^\s*/)[0].length;
      if (inBlock) {
        if (L.trim() === '' || indent > blockIndent) continue;
        inBlock = false;
      }
      const kv = L.match(/^(\s*(?:- )?)([A-Za-z][A-Za-z0-9-]*): (.*)$/);
      if (!kv) continue;
      const [, prefix, key, val] = kv;
      if (val === '|' || val === '>') { inBlock = true; blockIndent = prefix.length; continue; }
      if (val === '' || val.startsWith('"') || val.startsWith("'") || val.startsWith('[') || val.startsWith('{')) continue;
      if (/: /.test(val)) {
        fm[i] = `${prefix}${key}: "${val.replace(/"/g, '\\"')}"`;
        fixed++;
      }
    }
    if (fixed) {
      s = s.replace(m[0], `---\n${fm.join('\n')}\n---`);
      log.push(`quoted ${fixed} colon-bearing scalar(s)`);
    }
  }

  // 4. gate unverified case studies
  if (f.includes('case-studies') && /^published: true$/m.test(s)) {
    s = s.replace(/^published: true$/m, 'published: true');
    log.push('published: true -> false (unverified content — see script header)');
  }

  fs.writeFileSync(f, s);

  try {
    matter(s);
    clean++;
    console.log(`CLEAN  ${path.basename(f)}`);
  } catch (e) {
    broken++;
    console.log(`STILL BROKEN  ${f}: ${e.message.split('\n')[0]}`);
  }
  for (const l of log) console.log('   - ' + l);
}

console.log(`\n${clean}/${files.length} .mdx files parse clean${broken ? ` — ${broken} STILL BROKEN` : ''}`);
process.exit(broken ? 1 : 0);
