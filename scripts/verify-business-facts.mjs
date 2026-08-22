#!/usr/bin/env node
/**
 * verify-business-facts.mjs — build-time guard on customer-facing claims.
 *
 * Two classes of bug keep coming back to this repo:
 *
 *   1. NAP drift. The site, the JSON-LD schema and the outbound email
 *      templates each drifted onto a different phone number. A pilot lead who
 *      converted was emailed a number that did not match the one on the page
 *      they converted from.
 *
 *   2. Invented figures. Review counts, project counts, square footage and
 *      "share of project mix" percentages were written to look like audited
 *      business data and shipped to production. In Canada, publishing invented
 *      testimonials or performance claims is a Competition Act exposure, not a
 *      tone problem.
 *
 * Both classes are cheap to reintroduce and expensive to notice. This script
 * makes them fail the build instead.
 *
 * Run:  pnpm verify:facts
 * CI:   .github/workflows/verify-facts.yml (every push + PR)
 *
 * To retire a rule, delete it here AND record the source for the new claim in
 * the code comment where the number lives.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative, extname } from 'node:path';

const ROOT = process.cwd();

const BANNED = [
  // ── NAP ────────────────────────────────────────────────────────────────
  { pattern: /\(416\)\s*(&nbsp;)?249-1276/, why: 'Retired phone number. Use BUSINESS_NAP.phoneDisplay from @ecowoods/shared/constants.' },
  { pattern: /14162491276/, why: 'Retired phone number in a tel:/wa.me link. Use BUSINESS_NAP.phoneE164 / phoneHref.' },
  { pattern: /\+1-416-555-9663/, why: 'Placeholder phone number.' },
  { pattern: /\(503\)\s*555-0192/, why: 'Placeholder phone number (wrong country code region entirely).' },

  // ── Fabricated volume and reputation figures ───────────────────────────
  { pattern: /348\s*(verified\s*)?reviews/i, why: 'Unverified review count. No platform reports this figure.' },
  { pattern: /4\.9\s*\/\s*5|4\.9\s*★/, why: 'Unverified aggregate rating.' },
  { pattern: /5,?193/, why: 'Invented project count.' },
  { pattern: /5,?200\+?\s*Homes|5,000\+\s*(verified\s*)?project/i, why: 'Invented project/home count.' },
  { pattern: /2\.5M\+?\s*Sq\s*Ft|Sq Ft Sanded & Finished/i, why: 'Square footage back-computed from another invented figure.' },
  // F-163. Was /Semantic Density/i, which a hyphen defeats. The content
  // frontmatter carries `semantic-density: 8.5` on every article — the retired
  // claim, still in the repository, one rename away from being rendered again.
  { pattern: /semantic[ _-]?density/i, why: 'Not a measurable quantity; presented as a credential.' },

  // ── Founding-year drift ────────────────────────────────────────────────
  { pattern: /Est\.?\s*1998|since 1998|Founded:\*{0,2}\s*1998|foundingDate:\s*'1998'|foundingYear:\s*1998/i,
    why: 'Founding year is BUSINESS_NAP.foundedYear. Do not hardcode it.' },
  { pattern: /27\+?\s*years|27-year/i, why: 'Hardcoded year count goes stale. Use yearsInBusiness().' },
  { pattern: /over 25 years|25\+\s*yrs/i, why: 'Hardcoded year count goes stale. Use yearsInBusiness().' },
];

// Where the retired values are still legitimately allowed to appear.
const ALLOWLIST = [
  'scripts/verify-business-facts.mjs',   // this file names every banned string
  'apps/web/prisma/seed.ts',             // local dev seed data, never customer-facing
  'apps/web/lib/content/types.ts',       // internal editorial QA field, not published copy
];

/**
 * A line carrying this marker is exempt. Reserved for documentation that has to
 * name a retired claim in order to explain why it was retired — the comments
 * above the emptied arrays, and this file's own rule table. Never use it to
 * silence a live customer-facing string.
 */
const OPT_OUT = 'facts-allow';

const SCAN_DIRS = ['apps/web/app', 'apps/web/lib', 'apps/web/public', 'packages'];
const SCAN_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.txt', '.md', '.mdx', '.json']);
const SKIP_DIR = new Set(['node_modules', '.next', 'dist', 'build', '.turbo', '.git']);

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (SKIP_DIR.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SCAN_EXT.has(extname(name))) out.push(full);
  }
  return out;
}

/** Same walk, filtered to one extension. Used for the PDF pass below. */
function walkExt(dir, ext, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (SKIP_DIR.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkExt(full, ext, out);
    else if (extname(name).toLowerCase() === ext) out.push(full);
  }
  return out;
}

const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));

/* ── PDFs served from public/ ──────────────────────────────────────────────
 *
 * A PDF under apps/web/public is machine-facing exactly like a .txt: Google
 * and every AI crawler in robots.txt index the text inside it, and a claim
 * quoted out of a downloadable paper is the most citable form a claim can
 * take. This scanner read eight text extensions and none of them was .pdf, so
 * a retired figure could return in the one format nothing here could see.
 *
 * If pdftotext is missing we FAIL rather than skip. A silent skip is exactly
 * how F-23 shipped: the guard was green and the file was not clean.
 */
const pdfs = SCAN_DIRS.flatMap((d) => walkExt(join(ROOT, d), '.pdf'));
let pdftotextOk = true;
if (pdfs.length) {
  try {
    execFileSync('pdftotext', ['-v'], { stdio: 'ignore' });
  } catch {
    pdftotextOk = false;
  }
}
if (pdfs.length && !pdftotextOk) {
  console.error(
    `\n✗ ${pdfs.length} PDF(s) are served from public/ and pdftotext is not installed,` +
      `\n  so their text cannot be checked for retired claims.\n` +
      `\n  Install it (Debian/Ubuntu/Codespaces):  sudo apt-get install -y poppler-utils` +
      `\n\n  This is deliberately a failure and not a skip. A guard that silently` +
      `\n  skips the file it cannot read is how F-23 shipped.\n`
  );
  process.exit(1);
}

const violations = [];

for (const pdf of pdfs) {
  const rel = relative(ROOT, pdf);
  if (ALLOWLIST.some((a) => rel === a || rel.startsWith(a))) continue;
  let text = '';
  try {
    text = execFileSync('pdftotext', ['-q', '-nopgbrk', pdf, '-'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    violations.push({ rel, line: 0, text: '(pdftotext could not read this file)', why: 'A PDF served from public/ must be readable so its text can be checked.' });
    continue;
  }
  text.split('\n').forEach((line, i) => {
    if (line.includes(OPT_OUT)) return;
    for (const rule of BANNED) {
      if (rule.pattern.test(line)) {
        violations.push({ rel, line: i + 1, text: line.trim().slice(0, 110), why: rule.why });
      }
    }
  });
}

for (const file of files) {
  const rel = relative(ROOT, file);
  if (ALLOWLIST.some((a) => rel === a || rel.startsWith(a))) continue;

  const lines = readFileSync(file, 'utf8').split('\n');

  /**
   * In SOURCE files, a `//` or `*` line is a comment. It ships to nobody, and a
   * comment that says "this claim was retired and why" is documentation, not a
   * violation — but this scanner read it as one, so writing down why a figure
   * was banned failed the build that banned it. That is F-58 and F-106 for the
   * third time, here in the guard those findings were about.
   *
   * Only code files are stripped. Markdown and text are content: a line
   * beginning `//` there is something a reader sees, and must still be checked.
   *
   * The cost is that a retired claim could hide in a comment and be uncommented
   * later. That is a real gap and a small one — uncommenting is a deliberate
   * act, and the line it produces fails this guard the moment it exists.
   */
  const isCode = /\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file);

  lines.forEach((line, i) => {
    if (line.includes(OPT_OUT)) return;
    if (isCode) {
      const t = line.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    }
    for (const rule of BANNED) {
      if (rule.pattern.test(line)) {
        violations.push({ rel, line: i + 1, text: line.trim().slice(0, 110), why: rule.why });
      }
    }
  });
}

if (violations.length === 0) {
  console.log(
    `✓ business facts verified — ${files.length} file(s) + ${pdfs.length} PDF(s), no retired claims found`
  );
  process.exit(0);
}

console.error(`\n✗ ${violations.length} retired business claim(s) found:\n`);
for (const v of violations) {
  console.error(`  ${v.rel}:${v.line}`);
  console.error(`    ${v.text}`);
  console.error(`    → ${v.why}\n`);
}
console.error('Fix the call site, or update scripts/verify-business-facts.mjs if a claim is now sourced.\n');
process.exit(1);
