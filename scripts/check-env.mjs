#!/usr/bin/env node
/**
 * scripts/check-env.mjs — which production integrations are wired.
 *
 * Reads the environment it is run in (locally: `vercel env pull .env.local`
 * first; in a Codespace: the secrets you exported) and prints one line per
 * integration. Values are never printed — only present / absent.
 *
 *   pnpm env:check
 */
import fs from 'node:fs';
import path from 'node:path';

/* Load apps/web/.env.local and .env if present, without overriding the shell. */
for (const f of ['apps/web/.env.local', 'apps/web/.env', '.env.local', '.env']) {
  const p = path.join(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const GROUPS = [
  ['Lead path (must be set)', [
    ['DATABASE_URL', 'Postgres — every lead, quote, project and review request'],
    ['DIRECT_URL', 'Postgres direct connection for migrations'],
    ['RESEND_API_KEY', 'Email transport — quotes, contracts, invoices, review requests'],
    ['RESEND_FROM_EMAIL', 'Sender address on every email'],
    ['ADMIN_EMAIL', 'Where new leads and inquiries are announced'],
    ['NEXTAUTH_SECRET', 'Session signing'],
    ['NEXTAUTH_URL', 'Must be https://ecowoods.ca in production'],
    ['CRON_SECRET', 'Authorises /api/cron/quote-recovery and /api/cron/review-requests'],
  ]],
  ['Measurement & error tracking', [
    ['NEXT_PUBLIC_GA_MEASUREMENT_ID', 'GA4 — loads only after consent (CookieConsentBanner)'],
    ['ERROR_WEBHOOK_URL', 'Where server and client errors are posted (Slack/Discord/any webhook); stderr always logs'],
  ]],
  ['Payments & AI (optional)', [
    ['STRIPE_SECRET_KEY', 'Invoice payments'],
    ['STRIPE_WEBHOOK_SECRET', 'Stripe webhook verification'],
    ['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'Checkout on the client'],
    ['ANTHROPIC_API_KEY', 'EcowoodsGuide assistant'],
    ['OPENAI_API_KEY', 'Assistant fallback'],
  ]],
];

let missingRequired = 0;
for (const [title, vars] of GROUPS) {
  console.log(`\n${title}`);
  for (const [name, why] of vars) {
    const set = Boolean(process.env[name] && process.env[name].trim());
    if (!set && title.includes('must')) missingRequired++;
    console.log(`  ${set ? '✓' : '·'} ${name.padEnd(36)} ${set ? 'set' : 'unset'} — ${why}`);
  }
}
if (process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL !== 'https://ecowoods.ca' && process.env.VERCEL_ENV === 'production') {
  console.log(`\n✗ NEXTAUTH_URL is ${process.env.NEXTAUTH_URL}; production must be https://ecowoods.ca`);
  process.exitCode = 1;
}
console.log(missingRequired ? `\n· ${missingRequired} required variable(s) unset in this environment.` : '\n✓ every required variable is set here.');
