/**
 * lib/legal.ts — what the site actually does with data, as data.
 *
 * WHY THIS IS A MANIFEST AND NOT PROSE IN A PAGE
 *
 * A privacy policy goes stale the moment a dependency changes, and nobody
 * notices, because nothing checks it. Every processor below is one this
 * codebase demonstrably talks to — the import, the env var and the file are
 * named on each entry — so the page renders from the same list a reviewer can
 * grep. Add a processor to the app without adding it here and
 * `pnpm seo:legal` fails the build.
 *
 * THE GAP THIS CLOSES
 *
 * `/privacy` and `/terms` were linked from four places — the footer of every
 * page, the cookie consent banner's "learn more", and the registration form's
 * "I agree to the Privacy Policy and Terms of Service" — and neither route
 * existed. All four were 404s.
 *
 * The SEO cost of a dead link in the footer of 246 pages is real and it is the
 * least of it. A cookie banner whose policy link does not resolve cannot
 * produce informed consent, which is the entire point of the banner under
 * PIPEDA. And a registration form asking someone to agree to two documents
 * that do not exist is asking for agreement to nothing.
 *
 * WHAT THESE PAGES ARE AND ARE NOT
 *
 * They are an accurate description of what this application does, written from
 * the code. PIPEDA's openness principle asks for exactly that — information
 * about policies and practices, made readily available — and a truthful
 * description is worth more than borrowed boilerplate that describes a
 * different company.
 *
 * They are NOT a lawyer's work and this file does not pretend otherwise.
 * `REVIEW` below records who has reviewed them and when; both pages render that
 * status, and `content/claims.ts` carries it as an unsourced claim with a
 * deadline until a person with the standing to do so has signed off.
 */

/** ISO date the descriptions below were last checked against the code. */
export const LEGAL_LAST_REVIEWED = '2026-08-24';

/**
 * Owner/legal sign-off status. Rendered on both pages, because a policy whose
 * provenance is unclear is worse than one that says where it came from.
 */
export const REVIEW = {
  /** True once a person with the standing to bind the business has approved it. */
  approved: false,
  note:
    'This page describes how the site actually works, written from the application code and ' +
    'last checked against it on ' + LEGAL_LAST_REVIEWED + '. It has not yet been reviewed by ' +
    'a lawyer. If anything here does not match your experience, tell us and we will correct it.',
} as const;

export type Processor = {
  name: string;
  /** What it does, in the user's terms rather than ours. */
  purpose: string;
  /** What reaches it. Never more than the app actually sends. */
  data: string;
  /** Where in this repository it is wired, so the claim is checkable. */
  evidence: string;
  /** True where it runs only after the visitor opts in. */
  consentGated?: boolean;
};

/**
 * Every third party this application sends data to.
 *
 * Ordered by how much of it they see. A processor that is configured but has no
 * key set in production still appears — "we might" is the honest reading of a
 * code path that exists.
 */
export const PROCESSORS: Processor[] = [
  {
    name: 'Vercel',
    purpose: 'Serves this website and runs its server code.',
    data: 'Request logs, which include IP address and browser user-agent.',
    evidence: 'vercel.json, the deployment target for apps/web.',
  },
  {
    name: 'The application database (PostgreSQL)',
    purpose: 'Stores enquiries, accounts, quotes, projects and invoices.',
    data:
      'What you type into a form: name, email, phone, postal code, and anything you write in ' +
      'the message field. For account holders, the same plus a hashed password.',
    evidence: 'apps/web/prisma/schema.prisma — models User, Inquiry, Lead, Quote, Invoice.',
  },
  {
    name: 'Resend',
    purpose: 'Sends the email you get back — confirmations, quotes, appointment reminders.',
    data: 'Your name and email address, and the contents of the message being sent to you.',
    evidence: "apps/web/lib/email/index.ts — `new Resend(process.env.RESEND_API_KEY)`.",
  },
  {
    name: 'Stripe',
    purpose: 'Takes payment when you pay an invoice online.',
    data:
      'Card details go to Stripe directly and never reach this site or its database. We receive ' +
      'the amount, the outcome and a reference.',
    evidence: 'apps/web/lib/stripe.ts, apps/web/app/api/webhooks/stripe/route.ts.',
  },
  {
    name: 'Anthropic',
    purpose:
      'Runs RenoGuide, the assistant in the chat window — scoping a project, giving a rough ' +
      'range, and booking an in-home measure.',
    data:
      'What you type into the chat, and the square footage and species you give it. If you book ' +
      'through it, the name, email and phone you provide. Not your payment details, ever.',
    evidence: "apps/web/app/api/chat/route.ts — `@ai-sdk/anthropic`.",
  },
  {
    name: 'OpenAI',
    purpose:
      'Drafts replies to enquiries for a human to review, and powers the on-site assistant where ' +
      'it is enabled.',
    data: 'The text of your enquiry or chat message. Not your payment details, ever.',
    evidence: "apps/web/lib/ai.ts — `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })`.",
  },
  {
    name: 'Google Analytics',
    purpose: 'Tells us which pages are useful. Nothing else.',
    data: 'Pages viewed and a cookie identifying the browser, not the person.',
    evidence: 'apps/web/app/components/CookieConsentBanner.tsx — loadGoogleAnalytics().',
    consentGated: true,
  },
  {
    name: 'Meta (Facebook) pixel',
    purpose: 'Measures whether an advertisement led to an enquiry.',
    data: 'Pages viewed and a cookie identifying the browser.',
    evidence: 'apps/web/app/components/CookieConsentBanner.tsx — loadMetaPixel().',
    consentGated: true,
  },
];

/** The exact fields the public enquiry form sends. Kept in step with leadSchema. */
export const LEAD_FIELDS = [
  'name',
  'email',
  'phone',
  'postal code',
  'city (optional)',
  'service (optional)',
  'timeline (optional)',
  'approximate square footage (optional)',
  'your message (optional)',
] as const;

/**
 * Cookies and browser storage this site sets itself, as opposed to the ones its
 * processors set. Two, and one of them is the record of what you chose.
 */
export const OWN_STORAGE = [
  {
    key: 'cookie_consent',
    kind: 'localStorage',
    purpose:
      'Remembers whether you accepted analytics and marketing, so you are not asked again. ' +
      'It is the record of your choice; clearing it makes the banner reappear.',
  },
  {
    key: 'session',
    kind: 'cookie',
    purpose:
      'Keeps you signed in if you have an account. Essential — the site cannot show you your ' +
      'own quotes and invoices without it.',
  },
  {
    key: 'theme',
    kind: 'localStorage',
    purpose: 'Remembers whether you chose the light or dark appearance.',
  },
] as const;

export const consentGated = () => PROCESSORS.filter((p) => p.consentGated);
export const alwaysOn = () => PROCESSORS.filter((p) => !p.consentGated);
