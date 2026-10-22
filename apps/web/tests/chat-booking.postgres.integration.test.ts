/**
 * Real PostgreSQL test for the corner assistant's `book_measure` tool.
 *
 * The tool used to check capacity OUTSIDE its transaction and write at the
 * default isolation level, so simultaneous bookings (or one racing the booking
 * page) could both see a free window and both insert. This drives the REAL
 * /api/chat handler — only the language model, email and alerts are faked —
 * and calls the tool the way the model would, concurrently, against a
 * disposable PostgreSQL. Enabled only with RUN_POSTGRES_INTEGRATION=1.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { computeAvailability, SLOTS_PER_WINDOW } from '@/lib/booking/availability';

const captured = vi.hoisted(() => ({ tools: undefined as undefined | Record<string, { execute: (input: unknown) => Promise<unknown> }> }));
const sent = vi.hoisted(() => ({ confirmations: 0, admin: 0 }));

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    streamText: (opts: { tools: Record<string, { execute: (input: unknown) => Promise<unknown> }> }) => {
      captured.tools = opts.tools;
      return { textStream: (async function* () { /* the model says nothing; the test calls the tools */ })() };
    },
  };
});
vi.mock('@ai-sdk/anthropic', () => ({ anthropic: () => ({}) }));
vi.mock('@/lib/auth', () => ({ auth: async () => null }));
vi.mock('@/lib/lead-alert', () => ({ sendLeadAlert: async () => undefined }));
vi.mock('@/lib/funnel-ledger', () => ({ recordFunnelEvent: async () => undefined, sanitiseSource: (s?: string) => s ?? null }));
vi.mock('@/lib/email', () => ({
  sendAppointmentConfirmationEmail: async () => { sent.confirmations++; },
  sendAdminNewQuoteEmail: async () => { sent.admin++; },
  sendQuoteReceivedEmail: async () => undefined,
}));
vi.mock('@/lib/background', () => ({ runAfterResponse: (p: Promise<unknown>) => { void p.catch(() => undefined); } }));

const enabled = process.env.RUN_POSTGRES_INTEGRATION === '1';

describe.skipIf(!enabled)('assistant book_measure against real PostgreSQL', () => {
  let db: (typeof import('@/lib/db'))['db'] | undefined;
  let appointmentsRoute: typeof import('@/app/api/appointments/route') | undefined;
  const prefix = `chatpg-${randomUUID()}`;
  let n = 0;

  beforeAll(async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    db = (await import('@/lib/db')).db;
    appointmentsRoute = await import('@/app/api/appointments/route');
    const chat = await import('@/app/api/chat/route');
    const res = await chat.POST(new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
    }));
    await res.text();
    expect(captured.tools?.book_measure).toBeTruthy();
  });

  afterAll(async () => {
    if (!db) return;
    try {
      const appts = await db.appointment.findMany({ where: { customerEmail: { startsWith: prefix } }, select: { quoteRequestId: true } });
      await db.appointment.deleteMany({ where: { customerEmail: { startsWith: prefix } } });
      await db.quoteRequest.deleteMany({ where: { email: { startsWith: prefix } } });
      void appts;
    } finally {
      await db.$disconnect();
    }
  });

  const slotAt = (fromEnd: number) =>
    computeAvailability({ now: new Date(), bookingCounts: new Map() }).days
      .flatMap((d) => d.slots)
      .filter((s) => s.available && new Date(s.start).getTime() > Date.now() + 36 * 60 * 60 * 1000)
      .at(fromEnd)!.start;

  const chatBook = (startsAt: string, email?: string) => {
    n += 1;
    return captured.tools!.book_measure!.execute({
      name: 'Chat Booker',
      email: email ?? `${prefix}-chat${n}@example.test`,
      phone: '416-555-0100',
      startsAt,
      postal: 'M5V 2T6',
    }) as Promise<{ ok: boolean; appointmentId?: string; message?: string }>;
  };

  const seatsAt = async (startsAt: string) =>
    (await db!.appointment.findMany({ where: { customerEmail: { startsWith: prefix }, startsAt: new Date(startsAt), status: 'SCHEDULED' } })).length;

  it('never seats more than the window allows when bookings arrive together', async () => {
    const slot = slotAt(-3);
    const results = await Promise.all(Array.from({ length: 8 }, () => chatBook(slot)));
    expect(results.filter((r) => r.ok).length).toBeLessThanOrEqual(SLOTS_PER_WINDOW);
    expect(await seatsAt(slot)).toBeLessThanOrEqual(SLOTS_PER_WINDOW);
    expect(results.filter((r) => r.ok).length).toBeGreaterThan(0);
  });

  it('shares capacity with the booking page rather than keeping its own count', async () => {
    const slot = slotAt(-4);
    const viaPage = (i: number) => appointmentsRoute!.POST(new Request('http://localhost/api/appointments', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `198.51.100.${40 + i}` },
      body: JSON.stringify({
        startsAt: slot, name: 'Page Booker', email: `${prefix}-page${i}@example.test`,
        phone: '416-555-0100', postal: 'M5V 2T6', service: 'new-install',
      }),
    }));
    await Promise.all([chatBook(slot), chatBook(slot), viaPage(1), viaPage(2), chatBook(slot), viaPage(3)]);
    expect(await seatsAt(slot)).toBeLessThanOrEqual(SLOTS_PER_WINDOW);
  });

  it('answers a retried tool call with the booking already held', async () => {
    const slot = slotAt(-5);
    const email = `${prefix}-retry@example.test`;
    const first = await chatBook(slot, email);
    const second = await chatBook(slot, email);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.appointmentId).toBe(first.appointmentId);
    expect(await db!.appointment.count({ where: { customerEmail: email } })).toBe(1);
    expect(await db!.quoteRequest.count({ where: { email } })).toBe(1);
  });
});
