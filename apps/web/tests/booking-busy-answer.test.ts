/**
 * When every serialization retry loses, the slot may still be free. The booking
 * page must say the calendar is busy and invite a retry; telling the customer
 * the time "was just taken" sends them away from a slot that is open.
 */
import { describe, expect, it, vi } from 'vitest';
import { computeAvailability } from '@/lib/booking/availability';

vi.mock('@/lib/auth', () => ({ auth: async () => null }));
vi.mock('@/lib/lead-alert', () => ({ sendLeadAlert: async () => undefined }));
vi.mock('@/lib/funnel-ledger', () => ({ recordFunnelEvent: async () => undefined, sanitiseSource: (s?: string) => s ?? null }));
vi.mock('@/lib/email', () => ({ sendAppointmentConfirmationEmail: async () => undefined, sendAdminNewQuoteEmail: async () => undefined }));
vi.mock('@/lib/background', () => ({ runAfterResponse: (p: Promise<unknown>) => void p.catch(() => undefined) }));
vi.mock('@/lib/booking/book-measure', () => ({ bookMeasure: async () => ({ kind: 'busy' }) }));

const route = await import('@/app/api/appointments/route');
const slot = computeAvailability({ now: new Date(), bookingCounts: new Map() }).days.flatMap((d) => d.slots).find((s) => s.available)!.start;

describe('POST /api/appointments when the calendar is contended', () => {
  it('answers 409 with a retry message that does not claim the slot was taken', async () => {
    const res = await route.POST(
      new Request('http://localhost/api/appointments', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.77' },
        body: JSON.stringify({ startsAt: slot, name: 'Jane Homeowner', email: 'jane@example.com', phone: '416-555-0100', postal: 'M5V 2T6', service: 'new-install' }),
      }),
    );
    expect(res.status).toBe(409);
    const { error } = (await res.json()) as { error: string };
    expect(error).not.toMatch(/taken|no longer available/i);
    expect(error).toMatch(/busy|try/i);
  });
});
