import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  ordersCreated: 0,
  sessionsCreated: 0,
  settingsRead: 0,
  usersWritten: 0,
}));

vi.mock('@/lib/db', () => ({
  db: {
    settings: { findFirst: async () => { state.settingsRead++; return { defaultTaxRate: 13 }; } },
    user: { upsert: async () => { state.usersWritten++; return { id: 'user-test' }; } },
    order: {
      create: async () => { state.ordersCreated++; return { id: 'order-test' }; },
      update: async () => undefined,
    },
  },
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: {
      sessions: {
        create: async () => { state.sessionsCreated++; return { id: 'cs_test', url: 'https://checkout.example.test/cs_test' }; },
      },
    },
  },
}));

const wellInstalled = await import('@/app/api/well-installed-review/checkout/route');
const listingReport = await import('@/app/api/listing-floor-report/checkout/route');
const floorPlan = await import('@/app/api/floor-plan/checkout/route');
const { WELL_INSTALLED_REVIEW_PRODUCT } = await import('@/content/constants/paid-review-product');
const { LISTING_FLOOR_REPORT_PRODUCT } = await import('@/content/constants/listing-floor-report-product');
const { FLOOR_PLAN_PRODUCT } = await import('@/content/constants/floor-plan-product');

function request(url: string, body: unknown = {}): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  state.ordersCreated = 0;
  state.sessionsCreated = 0;
  state.settingsRead = 0;
  state.usersWritten = 0;
});

describe('unconfirmed paid-product prices are not saleable', () => {
  it('keeps all three owner-confirmation flags explicitly off', () => {
    expect(WELL_INSTALLED_REVIEW_PRODUCT.priceConfirmed).toBe(false);
    expect(LISTING_FLOOR_REPORT_PRODUCT.priceConfirmed).toBe(false);
    expect(FLOOR_PLAN_PRODUCT.priceConfirmed).toBe(false);
  });

  it.each([
    ['Well-Installed Quote Review', wellInstalled, 'http://localhost/api/well-installed-review/checkout'],
    ['Pre-List Floor Condition Report', listingReport, 'http://localhost/api/listing-floor-report/checkout'],
    ['Personal Floor Plan', floorPlan, 'http://localhost/api/floor-plan/checkout'],
  ])('%s refuses direct checkout before touching the Order or Stripe', async (_name, handler, url) => {
    const response = await handler.POST(request(url, { name: 'Jane Customer', email: 'jane@example.test', tier: 'rush', sku: 'onsite', code: 'anything' }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'Checkout is unavailable while product pricing awaits owner confirmation.',
    });
    expect(state).toEqual({ ordersCreated: 0, sessionsCreated: 0, settingsRead: 0, usersWritten: 0 });
  });
});
