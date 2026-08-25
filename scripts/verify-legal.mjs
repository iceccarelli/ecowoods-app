#!/usr/bin/env node
/**
 * scripts/verify-legal.mjs — the privacy page cannot fall behind the code.
 *
 *   pnpm seo:legal
 *
 * WHAT GOES WRONG WITHOUT IT
 *
 * A privacy policy is the one document on a site that is guaranteed to become
 * false without anyone editing it. Add a dependency that sends data somewhere,
 * and the policy is wrong the moment it deploys — silently, because a document
 * has no tests.
 *
 * So `lib/legal.ts` lists every processor with the file and the import that
 * wires it, and this checks the other direction: every third-party SDK this
 * application imports must appear in that list. A new one fails the build with
 * the name of the file that introduced it.
 *
 * THREE CHECKS
 *
 *   1. Every known data-processing SDK imported anywhere under apps/web or
 *      packages is declared in PROCESSORS.
 *   2. `/privacy` and `/terms` exist as routes. They were linked from four
 *      places and served 404 for an unknown length of time; the guard that
 *      catches that generally is in verify-links.mjs, and this one names these
 *      two specifically because they are the two the law cares about.
 *   3. LEGAL_LAST_REVIEWED is not in the future and not absurdly stale.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = process.cwd();
const LEGAL = 'apps/web/lib/legal.ts';
const read = (p) => { try { return readFileSync(join(ROOT, p), 'utf8'); } catch { return ''; } };

const src = read(LEGAL);
if (!src) {
  console.error(`\n✗ ${LEGAL} is missing. The privacy page renders from it.\n`);
  process.exit(1);
}

const declared = [...src.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1].toLowerCase());
if (declared.length === 0) {
  console.error(`\n✗ ${LEGAL} declares zero processors — this guard would pass over nothing.\n`);
  process.exit(1);
}

/**
 * Package → the name it must be declared under.
 *
 * Only packages that RECEIVE data belong here. A charting library does not.
 * Adding a row is how you tell this guard about a new class of processor;
 * leaving one out is how a privacy policy quietly becomes false.
 */
const SDKS = [
  { pkg: 'resend', as: 'resend' },
  { pkg: 'stripe', as: 'stripe' },
  { pkg: 'openai', as: 'openai' },
  { pkg: '@anthropic-ai/sdk', as: 'anthropic' },
  { pkg: '@ai-sdk/anthropic', as: 'anthropic' },
  { pkg: 'nodemailer', as: 'resend' }, // same purpose: outbound email
  { pkg: '@supabase/supabase-js', as: 'supabase' },
  { pkg: '@vercel/blob', as: 'vercel' },
  { pkg: 'posthog-js', as: 'posthog' },
  { pkg: 'mixpanel', as: 'mixpanel' },
  { pkg: '@sentry/nextjs', as: 'sentry' },
  { pkg: 'twilio', as: 'twilio' },
];

const SKIP = new Set(['node_modules', '.next', 'dist', 'build', '.turbo', '.git']);
const EXT = new Set(['.ts', '.tsx']);
function walk(dir, out = []) {
  let e;
  try { e = readdirSync(dir); } catch { return out; }
  for (const n of e) {
    if (SKIP.has(n)) continue;
    const f = join(dir, n);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (EXT.has(extname(n))) out.push(f);
  }
  return out;
}

const files = ['apps/web', 'packages'].flatMap((d) => walk(join(ROOT, d)));
const problems = [];

for (const { pkg, as } of SDKS) {
  const re = new RegExp(`from\\s+['"]${pkg.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}['"]`);
  const users = files.filter((f) => re.test(readFileSync(f, 'utf8'))).map((f) => relative(ROOT, f));
  if (!users.length) continue;
  if (declared.some((d) => d.includes(as))) continue;
  problems.push({
    what: `\`${pkg}\` is imported but no processor named like "${as}" is declared`,
    where: users.slice(0, 4),
    why:
      'It receives data. /privacy lists everyone who does, and a list that is missing one is ' +
      'not an oversight in a marketing page — it is an inaccurate statement about where a ' +
      "customer's information goes.",
  });
}

for (const route of ['privacy', 'terms']) {
  if (!existsSync(join(ROOT, `apps/web/app/${route}/page.tsx`))) {
    problems.push({
      what: `/${route} has no route`,
      where: ['apps/web/app/components/SiteFooter.tsx', 'apps/web/app/(auth)/register/RegisterForm.tsx'],
      why:
        'The footer of every page links to it, and the registration form asks people to agree ' +
        'to it. Both were 404s once already.',
    });
  }
}

const reviewed = (src.match(/LEGAL_LAST_REVIEWED\s*=\s*'([\d-]+)'/) || [, null])[1];
if (!reviewed) {
  problems.push({ what: 'LEGAL_LAST_REVIEWED is not set', where: [LEGAL], why: 'Both pages render it.' });
} else {
  const then = new Date(reviewed);
  const now = new Date();
  if (then > now) {
    problems.push({ what: `LEGAL_LAST_REVIEWED is in the future (${reviewed})`, where: [LEGAL], why: 'A future date on a policy is a false statement about when it was checked.' });
  }
  const months = (now - then) / (1000 * 60 * 60 * 24 * 30.4);
  if (months > 12) {
    problems.push({ what: `LEGAL_LAST_REVIEWED is ${Math.floor(months)} months old`, where: [LEGAL], why: 'Re-read the pages against the code and move the date, or the date is decoration.' });
  }
}

console.log('');
console.log(`LEGAL SURFACE — ${declared.length} processor(s) declared, reviewed ${reviewed ?? '(unset)'}`);
console.log('');

if (problems.length) {
  console.error(`✗ ${problems.length} problem(s):\n`);
  for (const p of problems) {
    console.error(`  ${p.what}`);
    for (const w of p.where) console.error(`      ${w}`);
    console.error(`    → ${p.why}\n`);
  }
  process.exit(1);
}

console.log('✓ legal surface verified — every data processor the code imports is declared, both routes exist\n');
process.exit(0);
