/**
 * /api/pilot-leads: the admin email and webhook run after the response (so a
 * serverless freeze cannot drop them) and a hung database cannot hold the
 * visitor's response open. Real route handler; Prisma, email and the
 * background scheduler are faked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  scheduled: [] as Promise<unknown>[],
  emails: [] as unknown[],
  createImpl: null as null | (() => Promise<{ id: string }>),
  failEmail: false,
}));

vi.mock('@/lib/background', () => ({ runAfterResponse: (p: Promise<unknown>) => void state.scheduled.push(p) }));
vi.mock('@/lib/db', () => ({ db: { pilotLead: { create: () => state.createImpl!() } } }));
vi.mock('@/lib/email', () => ({
  sendAdminNewPilotLeadEmail: async (m: unknown) => {
    if (state.failEmail) throw new Error('smtp down');
    state.emails.push(m);
  },
}));

const route = await import('@/app/api/pilot-leads/route');

let ip = 0;
const body = { name: 'Jane Builder', email: 'jane@example.com', phone: '416-555-0100', companyName: 'Jane Floors', role: 'contractor', program: 'floorforge-waitlist', consent: true };
const post = () =>
  route.POST(new Request('http://localhost/api/pilot-leads', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `198.51.100.${++ip}` }, body: JSON.stringify(body) }));

beforeEach(() => {
  state.scheduled.length = 0;
  state.emails.length = 0;
  state.failEmail = false;
  state.createImpl = async () => ({ id: 'pl_1' });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

describe('pilot-leads reliability', () => {
  it('hands the admin email to the background scheduler and acknowledges success', async () => {
    const res = await post();
    expect(res.status).toBe(201);
    expect((await res.json()).pilotLeadId).toBe('pl_1');
    expect(state.scheduled).toHaveLength(1);
    await Promise.all(state.scheduled);
    expect(state.emails).toHaveLength(1);
  });

  it('a failing email is scheduled, logged and never fails the lead', async () => {
    state.failEmail = true;
    const res = await post();
    expect(res.status).toBe(201);
    await expect(Promise.all(state.scheduled)).resolves.toBeDefined();
    expect(vi.mocked(console.error).mock.calls.some((c) => String(c[0]).includes('pilot.lead.email_failed'))).toBe(true);
  });

  it('a hung database is cut off after the budget; the lead is still acknowledged and the desk emailed with the log id', async () => {
    vi.useFakeTimers();
    state.createImpl = () => new Promise(() => {});
    const pending = post();
    await vi.advanceTimersByTimeAsync(8100);
    const res = await pending;
    expect(res.status).toBe(201);
    expect((await res.json()).pilotLeadId).toMatch(/^pilot_/);
    expect(vi.mocked(console.error).mock.calls.some((c) => String(c[0]).includes('pilot.lead.db_persist_failed'))).toBe(true);
    await Promise.all(state.scheduled);
    expect(state.emails).toHaveLength(1);
  });

  it('a database error is not a customer error', async () => {
    state.createImpl = async () => {
      throw new Error('db down');
    };
    expect((await post()).status).toBe(201);
  });
});
