/**
 * /api/appointments enforces slot capacity. Real route handler and real
 * availability engine; Prisma is an in-memory table whose $transaction runs one
 * transaction at a time (the outcome Serializable guarantees), can raise a
 * serialization conflict (P2034), and records the isolation level requested.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeAvailability, SLOTS_PER_WINDOW } from '@/lib/booking/availability';

const state = vi.hoisted(() => ({
  rows: [] as Array<{ id: string; startsAt: Date; status: string; customerEmail: string | null }>,
  quotes: 0,
  isolation: [] as Array<string | undefined>,
  conflictsToThrow: 0,
  chain: Promise.resolve() as Promise<unknown>,
}));

vi.mock('@/lib/auth', () => ({ auth: async () => null }));
vi.mock('@/lib/lead-alert', () => ({ sendLeadAlert: async () => undefined }));
vi.mock('@/lib/funnel-ledger', () => ({ recordFunnelEvent: async () => undefined, sanitiseSource: (s?: string) => s ?? null }));
vi.mock('@/lib/email', () => ({ sendAppointmentConfirmationEmail: async () => undefined, sendAdminNewQuoteEmail: async () => undefined }));
vi.mock('@/lib/background', () => ({ runAfterResponse: (p: Promise<unknown>) => void p.catch(() => undefined) }));
vi.mock('@/lib/db', () => {
  const tx = {
    appointment: {
      findMany: async () => state.rows.filter((r) => r.status === 'SCHEDULED').map((r) => ({ id: r.id, startsAt: r.startsAt, customerEmail: r.customerEmail })),
      create: async ({ data }: { data: { startsAt: Date; customerEmail?: string | null } }) => {
        const id = `appt-${state.rows.length + 1}`;
        state.rows.push({ id, startsAt: data.startsAt, status: 'SCHEDULED', customerEmail: data.customerEmail ?? null });
        return { id, startsAt: data.startsAt };
      },
    },
    quoteRequest: { create: async () => ({ id: `quote-${++state.quotes}` }) },
  };
  return {
    db: {
      $transaction: (fn: (t: typeof tx) => Promise<unknown>, opts?: { isolationLevel?: string }) => {
        state.isolation.push(opts?.isolationLevel);
        const run = state.chain.then(async () => {
          if (state.conflictsToThrow > 0) {
            state.conflictsToThrow--;
            throw Object.assign(new Error('write conflict'), { code: 'P2034' });
          }
          await new Promise((r) => setTimeout(r, 5)); // widen the check-then-insert window
          return fn(tx);
        });
        state.chain = run.catch(() => undefined);
        return run;
      },
    },
  };
});

const route = await import('@/app/api/appointments/route');

const slot = computeAvailability({ now: new Date(), bookingCounts: new Map() }).days.flatMap((d) => d.slots).find((s) => s.available)!.start;
let ip = 0;
const book = (startsAt = slot, extra: Record<string, unknown> = {}) =>
  route.POST(
    new Request('http://localhost/api/appointments', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `198.51.100.${++ip}` },
      body: JSON.stringify({ startsAt, name: 'Jane Homeowner', email: `jane${ip}@example.com`, phone: '416-555-0100', postal: 'M5V 2T6', service: 'new-install', ...extra }),
    }),
  );

beforeEach(() => {
  state.rows.length = 0;
  state.quotes = 0;
  state.isolation.length = 0;
  state.conflictsToThrow = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('availability: bookings keyed by UTC instant are counted against local-offset slots', () => {
  it('a full slot is unavailable even when the count is keyed by toISOString()', () => {
    const counts = new Map([[new Date(slot).toISOString(), SLOTS_PER_WINDOW]]);
    const found = computeAvailability({ now: new Date(), bookingCounts: counts }).days.flatMap((d) => d.slots).find((s) => s.start === slot)!;
    expect(found.remaining).toBe(0);
    expect(found.available).toBe(false);
  });
});

describe('POST /api/appointments capacity', () => {
  it(`accepts exactly ${SLOTS_PER_WINDOW} bookings for a slot and rejects the next with 409`, async () => {
    const statuses: number[] = [];
    for (let i = 0; i < SLOTS_PER_WINDOW + 2; i++) statuses.push((await book()).status);
    expect(statuses).toEqual([...Array(SLOTS_PER_WINDOW).fill(201), 409, 409]);
    expect(state.rows).toHaveLength(SLOTS_PER_WINDOW);
    expect(state.quotes).toBe(SLOTS_PER_WINDOW); // no orphan lead for a rejected booking
  });

  it('simultaneous bookings of one slot never exceed capacity', async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => book()));
    expect(results.filter((r) => r.status === 201)).toHaveLength(SLOTS_PER_WINDOW);
    expect(results.filter((r) => r.status === 409)).toHaveLength(6 - SLOTS_PER_WINDOW);
    expect(state.rows).toHaveLength(SLOTS_PER_WINDOW);
  });

  it('runs the check and the writes in one Serializable transaction', async () => {
    await book();
    expect(state.isolation).toEqual(['Serializable']);
  });

  it('retries a serialization conflict and then books; if it stays contended it answers "just taken", not a 500', async () => {
    state.conflictsToThrow = 1;
    expect((await book()).status).toBe(201);
    state.conflictsToThrow = 5;
    expect((await book()).status).toBe(409);
    expect(state.rows).toHaveLength(1);
  });

  it('a double-submit by the same person for the same slot is one booking, not two', async () => {
    const first = await book(slot, { email: 'Jane@Example.com' });
    const again = await book(slot, { email: 'JANE@example.com' });
    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    expect((await again.json()).id).toBe((await first.json()).id);
    expect(state.rows).toHaveLength(1);
    expect(state.quotes).toBe(1);
    // the window still has its other seat for a different person
    expect((await book(slot)).status).toBe(201);
  });

  it('a different slot is unaffected by a full one', async () => {
    for (let i = 0; i < SLOTS_PER_WINDOW; i++) await book();
    const other = computeAvailability({ now: new Date(), bookingCounts: new Map() }).days.flatMap((d) => d.slots).find((s) => s.start !== slot && s.available)!.start;
    expect((await book(other)).status).toBe(201);
  });

  it('still rejects an off-grid time and a slot inside the 24 h lead time', async () => {
    expect((await book(slot.replace(/T(\d\d):00:00/, 'T$1:30:00'))).status).toBe(409);
    expect((await book(new Date(Date.now() + 3600_000).toISOString())).status).toBe(409);
    expect(state.rows).toHaveLength(0);
  });
});
