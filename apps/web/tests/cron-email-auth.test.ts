/**
 * Route-level authorization of the two emailing crons, with the REAL route
 * handlers and a fake mailer. An unset CRON_SECRET authorises nobody
 * (lib/cron-auth.ts is fail-closed), a wrong secret is refused, and in both
 * cases nothing reaches the database or the provider.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  providerCalls: 0,
  dbCalls: 0,
}));

vi.mock('@/lib/email', () => ({
  sendEmail: async () => void (h.providerCalls += 1),
  sendReviewRequestEmail: async () => void (h.providerCalls += 1),
}));
vi.mock('@/lib/db', () => {
  const touch = () => {
    h.dbCalls += 1;
    return Promise.resolve([]);
  };
  return { db: { $queryRaw: touch, $executeRaw: touch, quoteRecovery: { findMany: touch }, project: { findMany: touch }, quoteRequest: { findFirst: touch } } };
});

const quoteRecovery = await import('@/app/api/cron/quote-recovery/route');
const reviewRequests = await import('@/app/api/cron/review-requests/route');

const crons = [
  ['quote-recovery', quoteRecovery.GET],
  ['review-requests', reviewRequests.GET],
] as const;

const call = (get: (r: Request) => Promise<Response>, name: string, authorization?: string) =>
  get(new Request(`https://ecowoods.ca/api/cron/${name}`, authorization ? { headers: { authorization } } : {}));

beforeEach(() => {
  h.providerCalls = 0;
  h.dbCalls = 0;
  delete process.env.CRON_SECRET;
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe.each(crons)('/api/cron/%s authorization', (name, get) => {
  it('no CRON_SECRET configured => 401, no database access, zero provider calls (even with a guessable header)', async () => {
    for (const header of [undefined, 'Bearer ', 'Bearer undefined', 'Bearer anything']) {
      const res = await call(get, name, header);
      expect(res.status).toBe(401);
    }
    expect(h.dbCalls).toBe(0);
    expect(h.providerCalls).toBe(0);
  });

  it('empty CRON_SECRET => 401 and zero provider calls', async () => {
    process.env.CRON_SECRET = '';
    expect((await call(get, name, 'Bearer ')).status).toBe(401);
    expect(h.providerCalls).toBe(0);
  });

  it('wrong or missing secret => 401, no database access, zero provider calls', async () => {
    process.env.CRON_SECRET = 'right-secret';
    expect((await call(get, name)).status).toBe(401);
    expect((await call(get, name, 'Bearer wrong-secret')).status).toBe(401);
    expect((await call(get, name, 'bearer right-secret')).status).toBe(401);
    expect((await call(get, name, 'right-secret')).status).toBe(401);
    expect(h.dbCalls).toBe(0);
    expect(h.providerCalls).toBe(0);
  });

  it('correct secret => 200 with counts only', async () => {
    process.env.CRON_SECRET = 'right-secret';
    const res = await call(get, name, 'Bearer right-secret');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true, due: 0, sent: 0, failed: 0, exhausted: 0 });
    for (const v of Object.values(body)) expect(['boolean', 'number']).toContain(typeof v);
    expect(h.providerCalls).toBe(0);
  });
});
