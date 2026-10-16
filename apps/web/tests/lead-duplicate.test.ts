import { describe, it, expect, vi, beforeEach } from 'vitest';

const { create, findFirst, admin, customer, alert } = vi.hoisted(() => ({
  create: vi.fn(async () => ({ id: 'q_new' })),
  findFirst: vi.fn(async (_args: unknown): Promise<{ id: string } | null> => null),
  admin: vi.fn(async () => undefined),
  customer: vi.fn(async () => undefined),
  alert: vi.fn(async () => undefined),
}));

vi.mock('@/lib/db', () => ({
  db: {
    quoteRequest: { create, findFirst },
    quoteRecovery: { updateMany: vi.fn(async () => ({ count: 0 })) },
  },
}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => null) }));
vi.mock('@/lib/email', () => ({ sendAdminNewQuoteEmail: admin, sendQuoteReceivedEmail: customer }));
vi.mock('@/lib/lead-alert', () => ({ sendLeadAlert: alert }));
vi.mock('@/lib/funnel-ledger', () => ({ recordFunnelEvent: vi.fn(async () => undefined) }));

import { POST } from '@/app/api/leads/route';
import { DUPLICATE_WINDOW_MS, findRecentDuplicate } from '@/lib/lead-dedupe';

let n = 0;
const post = () =>
  POST(
    new Request('https://ecowoods.ca/api/leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.8.0.${++n}` },
      body: JSON.stringify({
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '(416) 555-0142',
        postal: 'M5V 3A8',
        service: 'refinishing',
        source: 'home',
      }),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  findFirst.mockResolvedValue(null);
});

describe('POST /api/leads — repeated submission', () => {
  it('first submission is stored, emailed and alerted once', async () => {
    const res = await post();
    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledTimes(1);
    expect(admin).toHaveBeenCalledTimes(1);
    expect(customer).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it('a repeat inside the window acknowledges the original and creates nothing new', async () => {
    findFirst.mockResolvedValue({ id: 'q_original' });
    const res = await post();
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.quoteId).toBe('q_original');
    expect(create).not.toHaveBeenCalled();
    expect(admin).not.toHaveBeenCalled();
    expect(customer).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });

  it('a failing duplicate lookup never blocks capture', async () => {
    findFirst.mockRejectedValue(new Error('db down'));
    const res = await post();
    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe('findRecentDuplicate', () => {
  it('looks back exactly the window for the same email, phone and service', async () => {
    const now = new Date('2026-10-16T12:00:00Z');
    await findRecentDuplicate({ quoteRequest: { findFirst } }, { email: 'a@b.ca', phone: '1', service: 's' }, now);
    const arg = findFirst.mock.calls[0]![0] as { where: { createdAt: { gte: Date }; email: string } };
    expect(arg.where.email).toBe('a@b.ca');
    expect(arg.where.createdAt.gte.getTime()).toBe(now.getTime() - DUPLICATE_WINDOW_MS);
  });
});
