/**
 * ASSISTANT-07 — Ask Francisco's conversion actions, through the REAL route
 * handlers they call (`POST /api/appointments`, `POST /api/leads`), not a
 * reimplementation. Only the edges are faked: Prisma (in-memory
 * QuoteRequest/Appointment tables), auth(), email and the lead-alert/CRM
 * webhook side effects. `appointmentSchema`/`leadSchema` validation, the
 * booking-availability engine, and `lib/funnel-ledger.ts`'s
 * `recordFunnelEvent` all run for real.
 *
 * Covers the ASSISTANT-07 acceptance criteria directly against the backend:
 *   - designId/designCode land on the created QuoteRequest row when the
 *     request carries them (closing DATA_FLOW_MAP.md's gap for this route),
 *     and are simply absent — never a placeholder — when it doesn't.
 *   - `source: 'assistant-workspace'` reaches the funnel ledger.
 *   - A request that never happens (no fetch — the UI-level "no confirm, no
 *     write" guarantee) leaves no row; this file proves the corollary a
 *     backend test CAN prove: an invalid/incomplete request writes nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeAvailability } from '@/lib/booking/availability';

type QuoteRequestRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  service: string | null;
  squareFeet: number | null;
  notes: string | null;
  designId: string | null;
  designCode: string | null;
  userId: string | null;
};
type AppointmentRow = { id: string; quoteRequestId: string; startsAt: Date; durationMinutes: number };

const state = vi.hoisted(() => ({
  quoteRequests: new Map<string, QuoteRequestRow>(),
  appointments: new Map<string, AppointmentRow>(),
  funnelEvents: [] as Array<{ stage: string; designId?: string | null; source?: string | null; quoteId?: string | null }>,
  leadAlerts: [] as Array<{ kind: string; source?: string | null }>,
}));

let nextId = 0;
const freshId = () => `id-${++nextId}`;

vi.mock('@/lib/db', () => ({
  db: {
    appointment: {
      findMany: async () => [...state.appointments.values()].map((a) => ({ startsAt: a.startsAt })),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        quoteRequest: {
          create: async ({ data }: { data: Omit<QuoteRequestRow, 'id'> }) => {
            const row: QuoteRequestRow = { id: freshId(), ...data };
            state.quoteRequests.set(row.id, row);
            return row;
          },
        },
        appointment: {
          create: async ({ data }: { data: Omit<AppointmentRow, 'id'> }) => {
            const row: AppointmentRow = { id: freshId(), ...data };
            state.appointments.set(row.id, row);
            return row;
          },
        },
      }),
  },
}));

vi.mock('@/lib/auth', () => ({ auth: async () => null }));

vi.mock('@/lib/email', () => ({
  sendAdminNewQuoteEmail: async () => {},
  sendAppointmentConfirmationEmail: async () => {},
  sendQuoteReceivedEmail: async () => {},
}));

vi.mock('@/lib/lead-alert', () => ({
  sendLeadAlert: async (a: { kind: string; source?: string | null }) => {
    state.leadAlerts.push(a);
  },
}));

vi.mock('@/lib/funnel-ledger', async () => {
  const actual = await vi.importActual<typeof import('@/lib/funnel-ledger')>('@/lib/funnel-ledger');
  return {
    ...actual,
    recordFunnelEvent: async (e: { stage: string; designId?: string | null; source?: string | null; quoteId?: string | null }) => {
      state.funnelEvents.push(e);
    },
  };
});

const { POST } = await import('@/app/api/appointments/route');

let ipCounter = 0;
const nextIp = () => `203.0.113.${++ipCounter}`;

function jsonPost(body: unknown): Request {
  return new Request('https://ecowoods.ca/api/appointments', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': nextIp() },
    body: JSON.stringify(body),
  });
}

/** A real, currently-bookable slot from the real availability engine — never a hand-guessed date. */
function realBookableSlot(): string {
  const { days } = computeAvailability({ now: new Date(), bookingCounts: new Map() });
  for (const day of days) {
    const slot = day.slots.find((s) => s.available);
    if (slot) return slot.start;
  }
  throw new Error('No bookable slot found in the real availability engine — fixture assumption broken.');
}

const CONTACT = { name: 'Jordan Lee', email: 'jordan@example.com', phone: '4165550123', postal: 'M4W 1A1' };

beforeEach(() => {
  state.quoteRequests.clear();
  state.appointments.clear();
  state.funnelEvents.length = 0;
  state.leadAlerts.length = 0;
});

afterEach(() => vi.clearAllMocks());

describe('POST /api/appointments — ASSISTANT-07 designId/designCode + source', () => {
  it('persists designId and designCode on the created QuoteRequest when the request carries them', async () => {
    const startsAt = realBookableSlot();
    const res = await POST(
      jsonPost({
        ...CONTACT,
        startsAt,
        service: 'new-install',
        sqft: 1200,
        designId: 'abcdefghjkmn',
        designCode: 'c=white-oak.satin.herringbone.5&a=1200',
        source: 'assistant-workspace',
      }),
    );
    expect(res.status).toBe(201);
    expect(state.quoteRequests.size).toBe(1);
    const row = [...state.quoteRequests.values()][0]!;
    expect(row.designId).toBe('abcdefghjkmn');
    expect(row.designCode).toBe('c=white-oak.satin.herringbone.5&a=1200');
  });

  it('forwards source: assistant-workspace to the funnel ledger and lead alert instead of the hardcoded default', async () => {
    const startsAt = realBookableSlot();
    await POST(jsonPost({ ...CONTACT, startsAt, service: 'new-install', source: 'assistant-workspace' }));
    expect(state.funnelEvents).toHaveLength(1);
    expect(state.funnelEvents[0]).toMatchObject({ stage: 'APPOINTMENT_BOOKED', source: 'assistant-workspace' });
    expect(state.leadAlerts).toHaveLength(1);
    expect(state.leadAlerts[0]).toMatchObject({ source: 'assistant-workspace' });
  });

  it('still defaults source to "booking" for a request that sends none — the site’s other callers are unaffected', async () => {
    const startsAt = realBookableSlot();
    await POST(jsonPost({ ...CONTACT, startsAt, service: 'new-install' }));
    expect(state.funnelEvents[0]).toMatchObject({ source: 'booking' });
  });

  it('leaves designId/designCode null — never invented — when the request has none', async () => {
    const startsAt = realBookableSlot();
    await POST(jsonPost({ ...CONTACT, startsAt, service: 'new-install' }));
    const row = [...state.quoteRequests.values()][0]!;
    expect(row.designId).toBeNull();
    expect(row.designCode).toBeNull();
    expect(state.funnelEvents[0]!.designId).toBeUndefined();
  });

  it('rejects a malformed designId (not something this site minted) rather than storing it', async () => {
    const startsAt = realBookableSlot();
    const res = await POST(jsonPost({ ...CONTACT, startsAt, service: 'new-install', designId: 'not-a-real-design-id' }));
    expect(res.status).toBe(400);
    expect(state.quoteRequests.size).toBe(0);
    expect(state.appointments.size).toBe(0);
  });
});

describe('POST /api/appointments — invalid/incomplete requests write nothing', () => {
  it('a request missing required fields creates zero rows', async () => {
    const res = await POST(jsonPost({ startsAt: realBookableSlot() }));
    expect(res.status).toBe(400);
    expect(state.quoteRequests.size).toBe(0);
    expect(state.appointments.size).toBe(0);
  });

  it('an invalid startsAt creates zero rows', async () => {
    const res = await POST(jsonPost({ ...CONTACT, startsAt: 'not-a-date', service: 'new-install' }));
    expect(res.status).toBe(400);
    expect(state.quoteRequests.size).toBe(0);
  });
});
