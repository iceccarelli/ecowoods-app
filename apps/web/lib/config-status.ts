/**
 * lib/config-status.ts — which settings the deployed code reads are configured.
 *
 * Read-only and pure: every function takes an env object, nothing here touches
 * process.env, the network or the database. The output model carries, for each
 * setting, the key NAME, a fixed sentence written here about what breaks, a
 * severity, a group and ONE boolean: configured (set and non-empty after
 * trimming). It never carries a value, a length, a prefix, a hash or any other
 * fragment derived from a value, so the model can be serialised, rendered and
 * logged without a secret being able to ride along. The only strings taken
 * from env at all are the non-secret deploy facts in `deployFacts`, which are
 * already public at /api/deploy-info.
 *
 * Keeping the registry honest is tests/config-status.test.ts: every key here
 * must be read somewhere in the source, and every process.env read in app/ and
 * lib/ must be registered here (or in the explicit ignore list in that test).
 */

export type Severity = 'critical' | 'important' | 'optional';

export type ConfigGroup =
  | 'Scheduled jobs'
  | 'Payments'
  | 'Database'
  | 'Sign-in'
  | 'Email'
  | 'Site'
  | 'Alerts and monitoring'
  | 'Storage'
  | 'Integrations';

export type ConfigSpec = {
  key: string;
  group: ConfigGroup;
  severity: Severity;
  /** One plain factual sentence: what is not working while this is missing. */
  breaks: string;
};

export const SEVERITY_ORDER: readonly Severity[] = ['critical', 'important', 'optional'];

export const GROUP_ORDER: readonly ConfigGroup[] = [
  'Scheduled jobs',
  'Payments',
  'Database',
  'Sign-in',
  'Email',
  'Site',
  'Alerts and monitoring',
  'Storage',
  'Integrations',
];

export const CONFIG_REGISTRY: readonly ConfigSpec[] = [
  // ── Scheduled jobs ──
  {
    key: 'CRON_SECRET',
    group: 'Scheduled jobs',
    severity: 'critical',
    breaks:
      'Cron routes answer 401 and never run (quote recovery, review requests, Stripe lost-webhook sweep, rate-limit cleanup, paid-work alerts), and the bearer-protected internal routes (schema-status, market-intelligence, IndexNow bearer calls) refuse every caller.',
  },
  // ── Payments ──
  {
    key: 'STRIPE_WEBHOOK_SECRET',
    group: 'Payments',
    severity: 'critical',
    breaks:
      'The Stripe webhook answers 500 to every event, so payments are not recorded and checkouts are not fulfilled by the webhook (the Stripe-reconcile cron is the only backstop and itself needs CRON_SECRET).',
  },
  {
    key: 'STRIPE_SECRET_KEY',
    group: 'Payments',
    severity: 'critical',
    breaks: 'Stripe is created with an empty key, so creating checkout sessions and every other Stripe call fails and nobody can pay online.',
  },
  // ── Database ──
  {
    key: 'DATABASE_URL',
    group: 'Database',
    severity: 'critical',
    breaks: 'The app has no database connection: every page and route that reads or writes data fails.',
  },
  {
    key: 'DIRECT_URL',
    group: 'Database',
    severity: 'critical',
    breaks: 'The Prisma schema declares it as the direct connection, so Prisma commands (generate, migrate) cannot validate the schema and migrations cannot be applied.',
  },
  // ── Sign-in ──
  {
    key: 'NEXTAUTH_SECRET',
    group: 'Sign-in',
    severity: 'critical',
    breaks:
      'Auth.js has no secret to sign sessions with, so sign-in and the admin area fail, and rate-limit identifiers are hashed with a fixed development string instead of a private one.',
  },
  {
    key: 'NEXTAUTH_URL',
    group: 'Sign-in',
    severity: 'critical',
    breaks:
      'Checkout return links for invoices, the shop and the review product, and email-verification links, fall back to http://localhost:3000.',
  },
  { key: 'AUTH_GOOGLE_ID', group: 'Sign-in', severity: 'optional', breaks: 'The Google sign-in option is not offered.' },
  { key: 'AUTH_GOOGLE_SECRET', group: 'Sign-in', severity: 'optional', breaks: 'Google sign-in cannot complete even when AUTH_GOOGLE_ID is set.' },
  { key: 'AUTH_FACEBOOK_ID', group: 'Sign-in', severity: 'optional', breaks: 'The Facebook sign-in option is not offered.' },
  { key: 'AUTH_FACEBOOK_SECRET', group: 'Sign-in', severity: 'optional', breaks: 'Facebook sign-in cannot complete even when AUTH_FACEBOOK_ID is set.' },
  { key: 'AUTH_TWITTER_ID', group: 'Sign-in', severity: 'optional', breaks: 'The X (Twitter) sign-in option is not offered.' },
  { key: 'AUTH_TWITTER_SECRET', group: 'Sign-in', severity: 'optional', breaks: 'X (Twitter) sign-in cannot complete even when AUTH_TWITTER_ID is set.' },
  // ── Email ──
  {
    key: 'RESEND_API_KEY',
    group: 'Email',
    severity: 'critical',
    breaks:
      'Without it (and without SMTP_HOST) production email throws instead of sending: lead notifications, customer confirmations, quotes and invoices are not delivered.',
  },
  {
    key: 'RESEND_FROM_EMAIL',
    group: 'Email',
    severity: 'critical',
    breaks: 'Outgoing mail uses SMTP_FROM, or else the published business address, as the sender, which Resend may reject if that domain is not verified.',
  },
  {
    key: 'ADMIN_EMAIL',
    group: 'Email',
    severity: 'critical',
    breaks: 'Internal notifications go to the published business inbox instead of the address you intended.',
  },
  { key: 'SMTP_HOST', group: 'Email', severity: 'optional', breaks: 'The SMTP fallback transport is unavailable (it is only used when RESEND_API_KEY is not set).' },
  { key: 'SMTP_PORT', group: 'Email', severity: 'optional', breaks: 'SMTP connects on port 587 (only relevant when SMTP_HOST is set).' },
  { key: 'SMTP_USER', group: 'Email', severity: 'optional', breaks: 'SMTP connects without a username (only relevant when SMTP_HOST is set).' },
  { key: 'SMTP_PASS', group: 'Email', severity: 'optional', breaks: 'SMTP connects without a password (only relevant when SMTP_HOST is set).' },
  { key: 'SMTP_FROM', group: 'Email', severity: 'optional', breaks: 'The sender falls back to the published business address when RESEND_FROM_EMAIL is also unset.' },
  // ── Site ──
  {
    key: 'NEXT_PUBLIC_SITE_URL',
    group: 'Site',
    severity: 'important',
    breaks:
      'Links in emails and Stripe return links fall back to NEXTAUTH_URL or https://ecowoods.ca, and the canonical origin in the site config defaults to https://ecowoods.ca.',
  },
  {
    key: 'INDEXNOW_KEY',
    group: 'Site',
    severity: 'important',
    breaks:
      'IndexNow uses the key file found in the app folder instead; if there is not exactly one such file the key is empty and search-engine pings are not accepted.',
  },
  { key: 'NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION', group: 'Site', severity: 'optional', breaks: 'The Google Search Console verification tag is not added to the page head.' },
  { key: 'NEXT_PUBLIC_BING_SITE_VERIFICATION', group: 'Site', severity: 'optional', breaks: 'The Bing Webmaster verification tag is not added to the page head.' },
  // ── Alerts and monitoring ──
  {
    key: 'TWILIO_ACCOUNT_SID',
    group: 'Alerts and monitoring',
    severity: 'important',
    breaks: 'Lead text-message alerts are skipped (all of TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM and ALERT_SMS_TO are needed); the lead and its emails are unaffected.',
  },
  { key: 'TWILIO_AUTH_TOKEN', group: 'Alerts and monitoring', severity: 'important', breaks: 'Lead text-message alerts are skipped; the lead and its emails are unaffected.' },
  { key: 'TWILIO_FROM', group: 'Alerts and monitoring', severity: 'important', breaks: 'Lead text-message alerts are skipped because there is no sending number.' },
  {
    key: 'ALERT_SMS_TO',
    group: 'Alerts and monitoring',
    severity: 'important',
    breaks: 'Lead text-message alerts are skipped because no recipient number is set (numbers must be in +E.164 form).',
  },
  {
    key: 'ERROR_WEBHOOK_URL',
    group: 'Alerts and monitoring',
    severity: 'important',
    breaks: 'Server errors are written to the logs only and are not forwarded to a chat or alerting webhook.',
  },
  { key: 'ERROR_WEBHOOK_TIMEOUT_MS', group: 'Alerts and monitoring', severity: 'optional', breaks: 'The error webhook call uses the default 3000 ms timeout.' },
  { key: 'NEXT_PUBLIC_GA_MEASUREMENT_ID', group: 'Alerts and monitoring', severity: 'optional', breaks: 'Google Analytics is not loaded, even for visitors who consent.' },
  // ── Storage ──
  { key: 'BLOB_READ_WRITE_TOKEN', group: 'Storage', severity: 'optional', breaks: 'Generated PDFs are stored in Supabase Storage instead, or on local disk if that is not configured either.' },
  { key: 'NEXT_PUBLIC_SUPABASE_URL', group: 'Storage', severity: 'optional', breaks: 'Supabase Storage (PDF fallback, floor photos, assistant attachments) is unavailable.' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', group: 'Storage', severity: 'optional', breaks: 'Supabase Storage (PDF fallback, floor photos, assistant attachments) is unavailable.' },
  // ── Integrations ──
  { key: 'ANTHROPIC_API_KEY', group: 'Integrations', severity: 'optional', breaks: 'The website chat and the assistant answer 503 "not configured".' },
  { key: 'OPENAI_API_KEY', group: 'Integrations', severity: 'optional', breaks: 'AI-drafted replies to quotes and inquiries are not offered.' },
  { key: 'UNSPLASH_ACCESS_KEY', group: 'Integrations', severity: 'optional', breaks: 'Rotating background photos are not fetched; pages use their default imagery.' },
  { key: 'NEXT_PUBLIC_WHATSAPP_NUMBER', group: 'Integrations', severity: 'optional', breaks: 'The WhatsApp option in the exit-intent prompt is not shown.' },
  { key: 'NEXT_PUBLIC_BOOKING_URL', group: 'Integrations', severity: 'optional', breaks: 'The external calendar booking button is not shown; the built-in booking form still works.' },
  { key: 'NEXT_PUBLIC_YOUTUBE_PROCESS_ID', group: 'Integrations', severity: 'optional', breaks: 'The process video is not shown.' },
];

export type EnvLike = Record<string, string | undefined>;

/** Set and non-empty after trimming. The only fact derived from a value. */
export function isConfigured(env: EnvLike, key: string): boolean {
  const v = env[key];
  return typeof v === 'string' && v.trim().length > 0;
}

export type ConfigItem = ConfigSpec & { configured: boolean };
export type ConfigLevel = 'red' | 'amber' | 'green';

export type ConfigStatusModel = {
  level: ConfigLevel;
  headline: string;
  missing: { critical: number; important: number; optional: number };
  items: ConfigItem[];
};

const rank = (s: Severity) => SEVERITY_ORDER.indexOf(s);

/** Missing first, then critical before important before optional, then group, then key. */
export function evaluateConfig(env: EnvLike, registry: readonly ConfigSpec[] = CONFIG_REGISTRY): ConfigStatusModel {
  const items: ConfigItem[] = registry
    .map((spec) => ({ ...spec, configured: isConfigured(env, spec.key) }))
    .sort(
      (a, b) =>
        Number(a.configured) - Number(b.configured) ||
        rank(a.severity) - rank(b.severity) ||
        GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) ||
        a.key.localeCompare(b.key),
    );
  const count = (s: Severity) => items.filter((i) => !i.configured && i.severity === s).length;
  const missing = { critical: count('critical'), important: count('important'), optional: count('optional') };
  const phrase = (n: number, w: string) => `${n} ${w} setting${n === 1 ? '' : 's'} missing`;
  let level: ConfigLevel = 'green';
  let headline = 'All critical and important settings are configured';
  if (missing.critical > 0) {
    level = 'red';
    headline = phrase(missing.critical, 'critical');
  } else if (missing.important > 0) {
    level = 'amber';
    headline = phrase(missing.important, 'important');
  }
  return { level, headline, missing, items };
}

/** For the admin nav badge. Never throws. */
export function countMissingCritical(env: EnvLike): number {
  try {
    return evaluateConfig(env).missing.critical;
  } catch {
    return 0;
  }
}

/**
 * Non-secret deploy facts, already public at /api/deploy-info (which serves the
 * full SHA, ref and environment). Only the 7-character SHA and the environment
 * name are shown here.
 */
export function deployFacts(env: EnvLike): { commit: string | null; environment: string | null } {
  const sha = env.VERCEL_GIT_COMMIT_SHA?.trim();
  const vercelEnv = env.VERCEL_ENV?.trim();
  return { commit: sha ? sha.slice(0, 7) : null, environment: vercelEnv || null };
}
