/**
 * The paid-product price gate, seen from the customer and from the source.
 *
 * tests/paid-product-price-gate.test.ts proves the three checkout ROUTES refuse
 * before touching an Order or Stripe. This file covers the two things it cannot:
 *
 *   1. What a customer SEES while the gate is closed: an honest message, a phone
 *      number, no price, no checkout form, nothing that looks purchasable.
 *   2. That the gate cannot be bypassed by a route nobody remembered. Every
 *      place that can open a Stripe Checkout Session is listed here. A new one
 *      fails this test until it is either gated on a `priceConfirmed` flag or
 *      added to the allow-list below by a person who has read why.
 *
 * Nothing here enables a gate or reads a price as a decision: the flags stay
 * false in the source and the tests assert it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/lib/stripe', () => ({ stripe: {} }));

const WEB = process.cwd().endsWith('apps/web') ? process.cwd() : join(process.cwd(), 'apps/web');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe('the gate is closed in the source', () => {
  it('keeps every owner-confirmation flag false', async () => {
    const { WELL_INSTALLED_REVIEW_PRODUCT } = await import('@/content/constants/paid-review-product');
    const { LISTING_FLOOR_REPORT_PRODUCT } = await import('@/content/constants/listing-floor-report-product');
    const { FLOOR_PLAN_PRODUCT } = await import('@/content/constants/floor-plan-product');
    expect([
      WELL_INSTALLED_REVIEW_PRODUCT.priceConfirmed,
      LISTING_FLOOR_REPORT_PRODUCT.priceConfirmed,
      FLOOR_PLAN_PRODUCT.priceConfirmed,
    ]).toEqual([false, false, false]);
  });
});

describe('no unlisted route can open a Stripe Checkout Session', () => {
  /* Gated: must read its product's flag BEFORE the first database or Stripe call. */
  const GATED: Record<string, string> = {
    'app/api/well-installed-review/checkout/route.ts': 'WELL_INSTALLED_REVIEW_PRODUCT.priceConfirmed',
    'app/api/listing-floor-report/checkout/route.ts': 'LISTING_FLOOR_REPORT_PRODUCT.priceConfirmed',
    'app/api/floor-plan/checkout/route.ts': 'FLOOR_PLAN_PRODUCT.priceConfirmed',
  };
  /* Not gated by a product flag, deliberately. Each takes its amount from the
     server, never from the client; each is its own decision, not this test's:
       - invoices/[id]/checkout   an invoice the business issued to a customer
       - shop/checkout            catalogue Product rows the admin priced
       - assistant/analysis/checkout   Renovation Credits (CREDIT_PACK) — see the
                                  hand-off report: this one has NO owner-confirmation flag. */
  const UNGATED = new Set([
    'app/api/invoices/[id]/checkout/route.ts',
    'app/api/shop/checkout/route.ts',
    'app/api/assistant/analysis/checkout/route.ts',
  ]);

  const callers = walk(join(WEB, 'app'))
    .concat(walk(join(WEB, 'lib')))
    .filter((f) => /checkout\.sessions\.create\(|paymentIntents\.create\(|paymentLinks\.create\(|subscriptions\.create\(/.test(readFileSync(f, 'utf8')))
    .map((f) => relative(WEB, f).split('\\').join('/'));

  it('finds exactly the known call sites', () => {
    expect(callers.sort()).toEqual([...Object.keys(GATED), ...UNGATED].sort());
  });

  it.each(Object.entries(GATED))('%s checks %s before any database or Stripe call', (file, flag) => {
    const src = readFileSync(join(WEB, file), 'utf8');
    const post = src.slice(src.indexOf('export async function POST'));
    const gate = post.indexOf(flag);
    expect(gate, 'the gate is read inside POST').toBeGreaterThan(-1);
    for (const first of ['db.', 'stripe.', 'await req.json', 'await request.json']) {
      const at = post.indexOf(first);
      if (at !== -1) expect(gate, `${flag} precedes ${first}`).toBeLessThan(at);
    }
    // And it refuses: the closed branch returns before falling through.
    const closed = post.slice(Math.max(0, gate - 4), gate + 260);
    expect(closed).toMatch(/!\s*[A-Z_]+\.priceConfirmed/);
    expect(closed).toContain('503');
  });
});

describe('what a customer sees while the gate is closed', () => {
  const PRICE_RE = /\$\s?\d/;
  const pages: Array<[string, () => Promise<{ default: () => unknown }>]> = [
    ['/floor-plan', () => import('@/app/floor-plan/page') as never],
    ['/well-installed-review', () => import('@/app/well-installed-review/page') as never],
    ['/listing-floor-report', () => import('@/app/listing-floor-report/page') as never],
  ];

  it.each(pages)('%s says checkout is paused, gives the phone number, and shows no price or form', async (_route, load) => {
    const { BUSINESS_NAP } = await import('@ecowoods/shared/constants');
    const mod = await load();
    const html = renderToStaticMarkup(createElement(mod.default as never));
    expect(html).toMatch(/paused|awaiting owner confirmation|availability/i);
    expect(html).toContain(BUSINESS_NAP.phoneDisplay);
    expect(html).not.toMatch(/<form[\s>]/);
    expect(html).not.toMatch(/type="email"/);
    // No dollar figure anywhere on a page whose price is unconfirmed.
    expect(html).not.toMatch(PRICE_RE);
  });

  it('none of the three is in the search index', async () => {
    for (const [, load] of pages) {
      const mod = (await load()) as unknown as { metadata: { robots?: { index?: boolean } } };
      expect(mod.metadata.robots?.index).toBe(false);
    }
  });
});
