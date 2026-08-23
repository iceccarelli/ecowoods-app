#!/usr/bin/env node
/**
 * scripts/verify-outreach.mjs — the twenty-fifth guard.
 *
 * WHAT IT PROTECTS
 *
 * /r is the page a customer reaches from the QR code on the card handed over at
 * the end of every job. It is one product decision away from being the thing
 * that destroys everything else on this site.
 *
 * That decision is REVIEW GATING: a "how did we do?" step that sends the happy
 * customers to Google and routes the unhappy ones to a private complaints form.
 * It is trivially easy to build, it reliably raises a star average, and it is:
 *
 *   1. Prohibited. Google's Maps user-contributed-content policy lists among
 *      prohibited practices "Discourage or prohibit negative reviews, or
 *      selectively solicit positive reviews from customers."
 *   2. Self-defeating. A profile with a few four-star reviews answered well
 *      reads as a real business. An unbroken wall of fives reads as a wall —
 *      which is precisely the pattern an AI assistant flags as unreliable.
 *   3. The same defect as a fabricated rating, arriving by a politer route.
 *      This project has refused that four times in writing. It should not lose
 *      on the fifth because the mechanism looked like a UX flow.
 *
 * So the rule is mechanical: every visitor to /r sees every live destination.
 * The page may not branch on how the visitor answers anything, because it may
 * not ask.
 *
 * It also checks the things that make the card work at all: the printed asset
 * exists, it is served from a location this deployment actually serves (F-131),
 * and the URL encoded in it is the route that exists.
 *
 *   node scripts/verify-outreach.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PAGE = 'apps/web/app/r/page.tsx';
const CARD = 'public/review-card.svg';
const CARD_URL = 'https://ecowoods.ca/r';
const problems = [];
const fail = (m) => problems.push(m);

/* ── the page exists and is not indexed ──────────────────────────────────── */
const pagePath = path.join(ROOT, PAGE);
if (!fs.existsSync(pagePath)) {
  fail(`${PAGE} is missing — the QR on the printed card points at a 404.`);
} else {
  const src = fs.readFileSync(pagePath, 'utf8');
  /* Comments discuss gating at length by design. Strip them before matching, or
     the guard flags its own explanation — F-58 / F-106 / F-163 / F-175. */
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  if (!/robots:\s*\{[^}]*index:\s*false/.test(code)) {
    fail(
      `${PAGE} does not declare robots index:false.\n` +
        `      /r is a tool handed to a finished customer, not a search surface. Indexed, it\n` +
        `      competes with /reviews for the query that actually matters.`,
    );
  }

  /* ── THE LINE: no sentiment gate ─────────────────────────────────────── */
  const GATE_WORDS =
    /\b(how did we do|were you (happy|satisfied)|rate (your|us)|star rating|satisfied\?|thumbs ?(up|down)|feedback form|would you recommend)\b/i;
  if (GATE_WORDS.test(code)) {
    fail(
      `${PAGE} contains sentiment-gating language.\n` +
        `      Asking how it went before deciding which link to show is review gating. Google's\n` +
        `      UGC policy prohibits selectively soliciting positive reviews, and a filtered 5.0\n` +
        `      is worth less than an honest 4.6. Show everyone every destination.`,
    );
  }
  /* Interactivity is the mechanism a gate needs. A static list cannot filter. */
  if (/\buseState\b|\buse client\b|onClick=/.test(code)) {
    fail(
      `${PAGE} has become interactive (useState / 'use client' / onClick).\n` +
        `      This page must render one list of destinations to every visitor. State is how a\n` +
        `      gate gets built, so it is not allowed here — put interactive work elsewhere.`,
    );
  }
  /* Every live destination must reach the markup. */
  if (!/LIVE_REVIEW_DESTINATIONS/.test(code)) {
    fail(
      `${PAGE} does not render LIVE_REVIEW_DESTINATIONS.\n` +
        `      Hand-listing destinations lets one quietly go missing. Map the constant.`,
    );
  }
  if (/\.filter\(|\.slice\(|\.find\(/.test(code)) {
    fail(
      `${PAGE} filters or slices its destination list.\n` +
        `      Whatever the intent, a filter here is how a subset of platforms ends up shown to\n` +
        `      a subset of people. The constant is already filtered to verified URLs.`,
    );
  }
}

/* ── the printed card ────────────────────────────────────────────────────── */
const cardPath = path.join(ROOT, CARD);
if (!fs.existsSync(cardPath)) {
  fail(`${CARD} is missing — there is nothing to print.`);
} else {
  const svg = fs.readFileSync(cardPath, 'utf8');
  if (!svg.includes(CARD_URL)) {
    fail(`${CARD} does not document the URL it encodes (${CARD_URL}).`);
  }
  if (!/<desc>/.test(svg)) {
    fail(
      `${CARD} has no <desc>.\n` +
        `      A QR code is opaque: nothing in this repository can read it back. The <desc> is\n` +
        `      the only record of what it encodes and how that was verified.`,
    );
  }
  /* F-131: apps/web/public is not served on this deployment. Repo-root public/ is. */
  if (fs.existsSync(path.join(ROOT, 'apps/web/public/review-card.svg'))) {
    fail(
      `review-card.svg is in apps/web/public, which this deployment does not serve (F-131).\n` +
        `      It belongs in the repo-root public/ directory.`,
    );
  }
}

/* ── the destination constant ────────────────────────────────────────────── */
{
  const CONST = 'packages/shared/constants/index.ts';
  const src = fs.readFileSync(path.join(ROOT, CONST), 'utf8');
  const block = src.match(/export const REVIEW_DESTINATIONS: ReviewDestination\[\] = \[([\s\S]*?)\n\];/);
  if (!block) {
    fail(`${CONST} does not export REVIEW_DESTINATIONS in the expected shape.`);
  } else {
    const entries = block[1].split(/\n  \{/).slice(1);
    if (!entries.length) fail('REVIEW_DESTINATIONS is empty.');
    for (const e of entries) {
      const platform = (e.match(/platform: '([^']*)'/) || [])[1] ?? '(unnamed)';
      if (!/note: '/.test(e)) fail(`REVIEW_DESTINATIONS "${platform}" has no note for the customer.`);
      const href = (e.match(/href: '([^']*)'/) || [])[1];
      if (href && !/^https:\/\//.test(href)) {
        fail(`REVIEW_DESTINATIONS "${platform}": href is not https.`);
      }
    }
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} outreach problem(s):\n`);
  for (const p of problems) console.error(`  · ${p}`);
  console.error('');
  process.exit(1);
}
console.log(
  '✓ outreach verified — /r is noindex, ungated and renders every verified destination; ' +
    'the printed card exists in a served location and documents what its QR encodes',
);
