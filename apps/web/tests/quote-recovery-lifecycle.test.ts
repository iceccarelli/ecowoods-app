import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  rows: [] as Array<Record<string, any>>,
  quotes: [] as Array<Record<string, any>>,
  sent: [] as Array<{ to: string; confirmUrl: string }>,
  recoverySent: [] as string[],
  rl: vi.fn(async (_i: { routeKey: string; identity: string }) => ({ allowed: true, remaining: 1, retryAfterSeconds: 0, degraded: false })),
  updateMany: vi.fn(async (_a: any) => ({ count: 0 })),
}));

const matches = (r: Record<string, any>, where: Record<string, any>) =>
  Object.entries(where).every(([k, v]) => {
    const val = r[k];
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('equals' in v) return String(val).toLowerCase() === String(v.equals).toLowerCase();
      if ('not' in v) return val !== v.not;
      if ('lte' in v || 'gte' in v) return (!v.lte || val <= v.lte) && (!v.gte || val >= v.gte);
    }
    return v === null ? val == null : val === v;
  });

vi.mock('@/lib/db', () => ({
  db: {
    quoteRecovery: {
      findFirst: async ({ where }: any) => h.rows.find((r) => matches(r, where)) ?? null,
      findMany: async ({ where }: any) => h.rows.filter((r) => matches(r, where)),
      create: async ({ data }: any) => {
        const row = { id: `r${h.rows.length + 1}`, sentAt: null, convertedAt: null, confirmedAt: null, confirmTokenHash: null, confirmSentAt: null, createdAt: new Date(Date.now() - 3 * 3600_000), ...data };
        h.rows.push(row);
        return row;
      },
      update: async ({ where, data }: any) => Object.assign(h.rows.find((r) => r.id === where.id)!, data),
      updateMany: h.updateMany,
    },
    quoteRequest: { findFirst: async ({ where }: any) => h.quotes.find((q) => matches(q, where)) ?? null },
  },
}));
vi.mock('@/lib/rate-limit-durable', () => ({ enforceRateLimit: h.rl }));
vi.mock('@/lib/email', () => ({
  sendQuoteRecoveryConfirmEmail: async (a: { to: string; confirmUrl: string }) => void h.sent.push(a),
  sendEmail: async ({ to }: { to: string }) => void h.recoverySent.push(to),
}));

const recovery = await import('@/app/api/quote-recovery/route');
const confirm = await import('@/app/api/quote-recovery/confirm/route');
const cron = await import('@/app/api/cron/quote-recovery/route');
const lib = await import('@/lib/quote-recovery');

let ip = 0;
const post = (email: string) =>
  recovery.POST(
    new Request('https://ecowoods.ca/api/quote-recovery', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `203.0.113.${++ip}` },
      body: JSON.stringify({ email, name: 'Eve', consent: true }),
    }),
  );
const runCron = () =>
  cron.GET(new Request('https://ecowoods.ca/api/cron/quote-recovery', { headers: { authorization: 'Bearer s3cret' } }));
const confirmPost = (token: string) => {
  const fd = new FormData();
  fd.set('token', token);
  return confirm.POST(new Request('https://ecowoods.ca/api/quote-recovery/confirm', { method: 'POST', body: fd }));
};

beforeEach(() => {
  h.rows.length = 0;
  h.quotes.length = 0;
  h.sent.length = 0;
  h.recoverySent.length = 0;
  h.rl.mockClear();
  h.rl.mockResolvedValue({ allowed: true, remaining: 1, retryAfterSeconds: 0, degraded: false });
  process.env.CRON_SECRET = 's3cret';
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('quote-recovery double opt-in', () => {
  it('stores an unconfirmed lowercased row, emails only a confirmation link, and the cron does not send', async () => {
    expect((await post('Victim@Example.com')).status).toBe(201);
    expect(h.rows).toHaveLength(1);
    expect(h.rows[0]!.email).toBe('victim@example.com');
    expect(h.rows[0]!.confirmedAt).toBeNull();
    expect(h.rows[0]!.confirmTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]!.to).toBe('victim@example.com');

    await runCron();
    expect(h.recoverySent).toHaveLength(0);
    expect(h.rows[0]!.sentAt).toBeNull();
  });

  it('the emailed token confirms once; then the cron sends the single reminder', async () => {
    await post('a@example.com');
    const token = new URL(h.sent[0]!.confirmUrl).searchParams.get('token')!;
    expect(token).not.toBe(h.rows[0]!.confirmTokenHash); // only the hash is stored

    const bad = await confirm.GET(new Request(h.sent[0]!.confirmUrl));
    expect(await bad.text()).toContain('<form'); // GET never confirms
    expect(h.rows[0]!.confirmedAt).toBeNull();

    await confirmPost('wrong');
    expect(h.rows[0]!.confirmedAt).toBeNull();

    await confirmPost(token);
    expect(h.rows[0]!.confirmedAt).toBeInstanceOf(Date);
    expect(h.rows[0]!.confirmTokenHash).toBeNull(); // single use

    await runCron();
    expect(h.recoverySent).toEqual(['a@example.com']);
  });

  it('suppresses the confirmation email when the per-email or per-IP limit is hit, keeping the row unsendable', async () => {
    h.rl.mockImplementation(async (i) => ({ allowed: i.routeKey !== 'quote-recovery-confirm-email', remaining: 0, retryAfterSeconds: 60, degraded: false }));
    await post('limited@example.com');
    expect(h.sent).toHaveLength(0);
    expect(h.rl.mock.calls.map((c) => c[0].routeKey).sort()).toEqual(['quote-recovery-confirm-email', 'quote-recovery-confirm-ip']);
    await runCron();
    expect(h.recoverySent).toHaveLength(0);
  });
});

describe('quote-recovery conversion', () => {
  const confirmed = (email: string) =>
    h.rows.push({ id: 'c1', email, name: null, sentAt: null, convertedAt: null, confirmedAt: new Date(), consentedAt: new Date(), createdAt: new Date(Date.now() - 3 * 3600_000) });

  it('cron skips and marks converted an address with a later QuoteRequest, case-insensitively', async () => {
    confirmed('Mixed@Example.com');
    h.quotes.push({ email: 'mixed@example.com', createdAt: new Date() });
    await runCron();
    expect(h.recoverySent).toHaveLength(0);
    expect(h.rows[0]!.convertedAt).toBeInstanceOf(Date);
  });

  it('cron still sends when nothing was submitted afterwards', async () => {
    confirmed('quiet@example.com');
    await runCron();
    expect(h.recoverySent).toEqual(['quiet@example.com']);
  });

  it('markRecoveryConverted lowercases and matches insensitively', async () => {
    await lib.markRecoveryConverted('  Jane@Example.COM ');
    const arg = h.updateMany.mock.calls[0]![0];
    expect(arg.where.email).toEqual({ equals: 'jane@example.com', mode: 'insensitive' });
    expect(arg.data.convertedAt).toBeInstanceOf(Date);
  });
});
