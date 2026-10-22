/**
 * A booking made through /api/appointments creates its own QuoteRequest, so it
 * must record BOTH funnel stages (as the assistant's book_measure already does)
 * or the report would show more bookings than leads. Recording is best-effort:
 * a failing ledger write must not fail the booking.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeAvailability } from '@/lib/booking/availability';

const state = vi.hoisted(() => ({
  events: [] as Array<Record<string, unknown>>,
  rejectLedger: false,
}));

vi.mock('@/lib/auth', () => ({ auth: async () => null }));
vi.mock('@/lib/lead-alert', () => ({ sendLeadAlert: async () => undefined }));
vi.mock('@/lib/funnel-ledger', () => ({
  recordFunnelEvent: async (e: Record<string, unknown>) => {
    state.events.push(e);
    if (state.rejectLedger) throw new Error('ledger down');
  },
  sanitiseSource: (s?: string) => s ?? null,
}));
vi.mock('@/lib/email', () => ({ sendAppointmentConfirmationEmail: async () => undefined, sendAdminNewQuoteEmail: async () => undefined }));
vi.mock('@/lib/background', () => ({ runAfterResponse: (p: Promise<unknown>) => void p.catch(() => undefined) }));
vi.mock('@/lib/db', () => {
  const tx = {
    appointment: {
      findMany: async () => [],
      create: async ({ data }: { data: { startsAt: Date } }) => ({ id: 'appt-1', startsAt: data.startsAt }),
    },
    quoteRequest: { create: async () => ({ id: 'quote-1' }) },
  };
  return { db: { $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) } };
});

const route = await import('@/app/api/appointments/route');
const slot = computeAvailability({ now: new Date(), bookingCounts: new Map() }).days.flatMap((d) => d.slots).find((s) => s.available)!.start;

const book = (extra: Record<string, unknown> = {}) =>
  route.POST(
    new Request('http://localhost/api/appointments', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.77' },
      body: JSON.stringify({ startsAt: slot, name: 'Jane Homeowner', email: 'jane@example.com', phone: '416-555-0100', postal: 'M5V 2T6', service: 'new-install', ...extra }),
    }),
  );

beforeEach(() => {
  state.events.length = 0;
  state.rejectLedger = false;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/appointments funnel events', () => {
  it('records LEAD_CAPTURED and APPOINTMENT_BOOKED against the new quote, with no personal data', async () => {
    expect((await book({ source: 'web_scheduler' })).status).toBe(201);
    expect(state.events.map((e) => e.stage)).toEqual(['LEAD_CAPTURED', 'APPOINTMENT_BOOKED']);
    for (const e of state.events) {
      expect(e).toMatchObject({ quoteId: 'quote-1', source: 'web_scheduler' });
      expect(JSON.stringify(e)).not.toMatch(/jane|example\.com|416-555|M5V/i);
    }
  });

  it('a failing ledger write never fails the booking', async () => {
    state.rejectLedger = true;
    expect((await book()).status).toBe(201);
  });
});
