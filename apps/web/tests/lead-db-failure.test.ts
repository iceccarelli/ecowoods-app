import { describe, it, expect, vi, beforeEach } from 'vitest';

const { create, findFirst, admin, customer, alert } = vi.hoisted(() => ({
  create: vi.fn(async (): Promise<{ id: string }> => ({ id: 'q_new' })),
  findFirst: vi.fn(async (): Promise<{ id: string } | null> => null),
  admin: vi.fn(async (_a: unknown) => undefined),
  customer: vi.fn(async () => undefined),
  alert: vi.fn(async (_a: unknown) => undefined),
}));

vi.mock('@/lib/db', () => ({
  db: { quoteRequest: { create, findFirst }, quoteRecovery: { updateMany: vi.fn(async () => ({ count: 0 })) } },
}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => null) }));
vi.mock('@/lib/email', () => ({ sendAdminNewQuoteEmail: admin, sendQuoteReceivedEmail: customer }));
vi.mock('@/lib/lead-alert', () => ({ sendLeadAlert: alert }));
vi.mock('@/lib/funnel-ledger', () => ({ recordFunnelEvent: vi.fn(async () => undefined) }));

import { POST } from '@/app/api/leads/route';

let n = 0;
const post = () =>
  POST(
    new Request('https://ecowoods.ca/api/leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.9.0.${++n}` },
      body: JSON.stringify({ name: 'Jane Doe', email: 'jane2@example.com', phone: '(416) 555-0143', postal: 'M5V 3A8', service: 'refinishing', source: 'home' }),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  create.mockResolvedValue({ id: 'q_new' });
});

describe('POST /api/leads — database failure', () => {
  it('retries once and stores the lead when the second attempt succeeds', async () => {
    create.mockRejectedValueOnce(new Error('connection reset'));
    const res = await post();
    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledTimes(2);
    expect(alert.mock.calls[0]?.[0]).toMatchObject({ kind: 'lead' });
  });

  it('when the database stays down: still 201, desk alerted as NOT SAVED, email marked', async () => {
    create.mockRejectedValue(new Error('db down'));
    const res = await post();
    expect(res.status).toBe(201);
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0]?.[0]).toMatchObject({ kind: 'lead (NOT SAVED)', phone: '(416) 555-0143' });
    expect(String((admin.mock.calls[0]?.[0] as { notes?: string }).notes)).toContain('NOT SAVED TO DATABASE');
    expect(customer).toHaveBeenCalledTimes(1);
  });
});
