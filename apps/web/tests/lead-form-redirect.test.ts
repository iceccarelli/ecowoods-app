import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    quoteRequest: { create: vi.fn(async () => ({ id: 'q_1' })) },
    quoteRecovery: { updateMany: vi.fn(async () => ({ count: 0 })) },
  },
}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => null) }));
vi.mock('@/lib/email', () => ({
  sendAdminNewQuoteEmail: vi.fn(async () => undefined),
  sendQuoteReceivedEmail: vi.fn(async () => undefined),
}));
vi.mock('@/lib/lead-alert', () => ({ sendLeadAlert: vi.fn(async () => undefined) }));
vi.mock('@/lib/funnel-ledger', () => ({ recordFunnelEvent: vi.fn(async () => undefined) }));

import { POST } from '@/app/api/leads/route';
import { leadRedirectOutcome, safeLeadSource } from '@/lib/lead-redirect';

let n = 0;
const post = (fields: Record<string, string>) =>
  POST(
    new Request('https://ecowoods.ca/api/leads', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        referer: 'https://ecowoods.ca/hardwood-floor-refinishing-toronto',
        'x-forwarded-for': `10.7.0.${++n}`,
      },
      body: new URLSearchParams(fields).toString(),
    }),
  );

const valid = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '(416) 555-0142',
  postal: 'M5V 3A8',
  city: 'Toronto',
  service: 'refinishing',
  source: 'hardwood-floor-refinishing-toronto',
};

beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => undefined));

describe('no-JS lead POST redirect carries which form it answers', () => {
  it('accepted → 303 back with sent=1 and from=<source>, and the form reads it', async () => {
    const res = await post(valid);
    expect(res.status).toBe(303);
    const loc = new URL(res.headers.get('location')!, 'https://ecowoods.ca');
    expect(loc.pathname).toBe('/hardwood-floor-refinishing-toronto');
    expect(leadRedirectOutcome(loc.search, valid.source)).toBe('sent');
    expect(leadRedirectOutcome(loc.search, 'some-other-form')).toBeNull();
  });

  it('rejected → 303 back with error=1 and from=<source>', async () => {
    const res = await post({ ...valid, phone: '1' });
    expect(res.status).toBe(303);
    const loc = new URL(res.headers.get('location')!, 'https://ecowoods.ca');
    expect(leadRedirectOutcome(loc.search, valid.source)).toBe('error');
  });

  it('never echoes a source that is not a plain slug', () => {
    expect(safeLeadSource('<script>')).toBeNull();
    expect(safeLeadSource('a'.repeat(80))).toBeNull();
    expect(safeLeadSource('home-hero')).toBe('home-hero');
  });
});
