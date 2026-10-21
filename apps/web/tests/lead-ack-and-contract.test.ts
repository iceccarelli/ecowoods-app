import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeAvailability } from '@/lib/booking/availability';

const h = vi.hoisted(() => ({
  rl: vi.fn(async (_i: { routeKey: string; identity: string }) => ({ allowed: true, remaining: 1, retryAfterSeconds: 0, degraded: false })),
  ack: vi.fn(async (_a: unknown) => undefined),
  quoteCreate: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 'q1', ...a.data })),
  updateMany: vi.fn(async (_a: unknown) => ({ count: 1 })),
}));

vi.mock('@/lib/auth', () => ({ auth: async () => null }));
vi.mock('@/lib/lead-alert', () => ({ sendLeadAlert: async () => undefined }));
vi.mock('@/lib/funnel-ledger', () => ({ recordFunnelEvent: async () => undefined, sanitiseSource: (s?: string) => s ?? null }));
vi.mock('@/lib/rate-limit-durable', () => ({ enforceRateLimit: h.rl }));
vi.mock('@/lib/background', () => ({ runAfterResponse: (p: Promise<unknown>) => void p.catch(() => undefined) }));
vi.mock('@/lib/email', () => ({
  sendAdminNewQuoteEmail: async () => undefined,
  sendQuoteReceivedEmail: h.ack,
  sendAppointmentConfirmationEmail: async () => undefined,
}));
vi.mock('@/lib/db', () => {
  const tx = {
    appointment: { findMany: async () => [], create: async () => ({ id: 'a1', startsAt: new Date() }) },
    quoteRequest: { create: h.quoteCreate },
  };
  return {
    db: {
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
      quoteRequest: { create: h.quoteCreate, findFirst: async () => null },
      quoteRecovery: { updateMany: h.updateMany },
    },
  };
});

const leads = await import('@/app/api/leads/route');
const appts = await import('@/app/api/appointments/route');

let ip = 0;
const headers = () => ({ 'content-type': 'application/json', 'x-forwarded-for': `198.18.0.${++ip}` });
const flush = () => new Promise((r) => setTimeout(r, 20));

beforeEach(() => {
  vi.clearAllMocks();
  h.rl.mockResolvedValue({ allowed: true, remaining: 1, retryAfterSeconds: 0, degraded: false });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

const lead = () =>
  leads.POST(
    new Request('https://ecowoods.ca/api/leads', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ name: 'Jane Doe', email: 'Jane@Example.com', phone: '(416) 555-0142', postal: 'M5V 3A8', service: 'refinishing', source: 'home' }),
    }),
  );

describe('POST /api/leads acknowledgement email limits', () => {
  it('uses durable per-email and per-IP limits and sends when allowed', async () => {
    expect((await lead()).status).toBe(201);
    await flush();
    expect(h.rl.mock.calls.map((c) => c[0].routeKey).sort()).toEqual(['lead-ack-email', 'lead-ack-ip']);
    expect(h.rl.mock.calls.find((c) => c[0].routeKey === 'lead-ack-email')![0].identity).toBe('jane@example.com');
    expect(h.ack).toHaveBeenCalledTimes(1);
  });

  it('still captures the lead but skips the acknowledgement when over the per-email limit', async () => {
    h.rl.mockImplementation(async (i) => ({ allowed: i.routeKey !== 'lead-ack-email', remaining: 0, retryAfterSeconds: 60, degraded: false }));
    expect((await lead()).status).toBe(201);
    await flush();
    expect(h.quoteCreate).toHaveBeenCalledTimes(1);
    expect(h.ack).not.toHaveBeenCalled();
  });

  it('skips the acknowledgement when over the per-IP limit', async () => {
    h.rl.mockImplementation(async (i) => ({ allowed: i.routeKey !== 'lead-ack-ip', remaining: 0, retryAfterSeconds: 60, degraded: false }));
    await lead();
    await flush();
    expect(h.ack).not.toHaveBeenCalled();
  });
});

describe('postal code contract: postal -> address, city separate', () => {
  it('/api/leads stores postal in address', async () => {
    await lead();
    expect(h.quoteCreate.mock.calls[0]![0].data).toMatchObject({ address: 'M5V 3A8', city: null });
  });

  it('/api/appointments stores postal in address (not city) and cancels the recovery reminder (lowercased)', async () => {
    const slot = computeAvailability({ now: new Date(), bookingCounts: new Map() }).days.flatMap((d) => d.slots).find((s) => s.available)!.start;
    const res = await appts.POST(
      new Request('http://localhost/api/appointments', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ startsAt: slot, name: 'Jane Homeowner', email: 'Jane@Example.com', phone: '416-555-0100', postal: 'M5V 2T6', service: 'new-install' }),
      }),
    );
    expect(res.status).toBe(201);
    await flush();
    expect(h.quoteCreate.mock.calls[0]![0].data).toMatchObject({ address: 'M5V 2T6', city: null });
    const arg = h.updateMany.mock.calls[0]![0] as { where: { email: unknown }; data: { convertedAt: unknown } };
    expect(arg.where.email).toEqual({ equals: 'jane@example.com', mode: 'insensitive' });
    expect(arg.data.convertedAt).toBeInstanceOf(Date);
  });
});
