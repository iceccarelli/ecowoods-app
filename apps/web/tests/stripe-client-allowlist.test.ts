/**
 * Who may talk to Stripe at all.
 *
 * tests/paid-product-gate-closed.test.ts lists every file containing a literal
 * `stripe.checkout.sessions.create(` under app/ and lib/. A literal search is
 * easy to walk around without meaning to: a call split over two lines, an alias
 * (`const { create } = stripe.checkout.sessions`), a helper in components/ or
 * another package, a dynamic `import('@/lib/stripe')`, or a raw fetch to
 * api.stripe.com. None of those contain the string it looks for.
 *
 * This file closes that from the other side: it does not look for the call, it
 * looks for the CAPABILITY. Any source file in apps/ or packages/ that can
 * obtain a Stripe client (imports the SDK or lib/stripe, `new Stripe(`, or
 * names api.stripe.com) must be on the list below. A new file fails until a
 * person adds it here, having read what the gate test says about paid products.
 *
 * Nothing here changes a gate, a price or a checkout.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO = join(__dirname, '..', '..', '..');

/** Does this source text obtain, or could it obtain, a Stripe client? */
export function reachesStripe(src: string): boolean {
  const spec = String.raw`['"\`](?:stripe|(?:@\/|(?:\.{1,2}\/)+|\/)?(?:[\w.-]+\/)*stripe(?:\.[jt]sx?)?)['"\`]`;
  return (
    new RegExp(String.raw`\bfrom\s*${spec}`).test(src) ||
    new RegExp(String.raw`\bimport\s*${spec}`).test(src) ||
    new RegExp(String.raw`\b(?:import|require)\s*\(\s*${spec}\s*\)`).test(src) ||
    /\bnew\s+Stripe\s*\(/.test(src) ||
    /api\.stripe\.com/.test(src)
  );
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dist' || name === '.turbo') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'tests' || name === '__tests__') continue;
      walk(p, out);
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name) && !/\.(test|spec)\.[jt]sx?$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/* Every file that may reach Stripe, and why. */
const ALLOWED = new Set([
  'apps/web/lib/stripe.ts', // the one client
  'apps/web/lib/stripe-fulfillment.ts', // webhook fulfilment
  'apps/web/lib/payment-reconciliation.ts', // reconciliation of Stripe events
  'apps/web/app/api/webhooks/stripe/route.ts',
  // the six checkout routes; the gate test says which are gated and why the rest are not
  'apps/web/app/api/floor-plan/checkout/route.ts',
  'apps/web/app/api/well-installed-review/checkout/route.ts',
  'apps/web/app/api/listing-floor-report/checkout/route.ts',
  'apps/web/app/api/invoices/[id]/checkout/route.ts',
  'apps/web/app/api/shop/checkout/route.ts',
  'apps/web/app/api/assistant/analysis/checkout/route.ts',
]);

describe('the Stripe detector sees the ways a literal search misses', () => {
  const evasions: Record<string, string> = {
    'two-line call': "import { stripe } from '@/lib/stripe';\nawait stripe.checkout\n  .sessions\n  .create({});",
    'aliased helper module': "import { stripe as s } from '../../lib/stripe';\nconst { create } = s.checkout.sessions;",
    'relative import': "import { stripe } from './stripe';",
    'dynamic import': "const { stripe } = await import('@/lib/stripe');",
    'require': "const Stripe = require('stripe');",
    'sdk import': "import Stripe from 'stripe';",
    'constructed directly': 'const c = new Stripe(key);',
    'raw REST': "await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST' });",
  };
  it.each(Object.entries(evasions))('flags: %s', (_name, src) => {
    expect(reachesStripe(src)).toBe(true);
  });

  it('does not flag unrelated modules whose names merely contain "stripe"', () => {
    expect(reachesStripe("import { x } from '@/lib/stripe-fulfillment-notes-not-a-module-but-has-dash';")).toBe(false);
    expect(reachesStripe("import { stripeColors } from '@/content/stripes';")).toBe(false);
    expect(reachesStripe('// mentions Stripe in a comment only')).toBe(false);
  });
});

describe('only the listed files can reach Stripe', () => {
  const found = [...walk(join(REPO, 'apps')), ...walk(join(REPO, 'packages'))]
    .filter((f) => reachesStripe(readFileSync(f, 'utf8')))
    .map((f) => relative(REPO, f).split(sep).join('/'))
    .sort();

  it('no source file outside the allow-list imports the SDK, lib/stripe, or api.stripe.com', () => {
    expect(found.filter((f) => !ALLOWED.has(f))).toEqual([]);
  });

  it('every allow-listed file still exists and still reaches Stripe (the list cannot rot)', () => {
    expect(found).toEqual([...ALLOWED].sort());
  });
});
