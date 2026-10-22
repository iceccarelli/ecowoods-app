/**
 * Real PostgreSQL audit of lib/booking/book-measure.ts, called directly (the
 * route-level suites in appointments-capacity / chat-booking drive it through
 * the handlers). Enabled only with RUN_POSTGRES_INTEGRATION=1.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { computeAvailability, SLOTS_PER_WINDOW } from '@/lib/booking/availability';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === '1';

describe.skipIf(!enabled)('bookMeasure against real PostgreSQL', () => {
  const prefix = `bm-${randomUUID()}`;
  let n = 0;
  const email = (tag = 'c') => `${prefix}-${tag}${++n}@example.test`;

  const slots = () =>
    computeAvailability({ now: new Date(), bookingCounts: new Map() }).days
      .flatMap((d) => d.slots)
      .filter((s) => s.available && new Date(s.start).getTime() > Date.now() + 36 * 3600_000);

  /** One slot per distinct local day, from the far end of the window backwards. */
  const distinctDaySlots = (count: number) => {
    const byDay = new Map<string, string>();
    for (const s of slots().reverse()) {
      const day = s.start.slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, s.start);
    }
    return [...byDay.values()].slice(0, count);
  };

  const input = (startsAtIso: string, over: Record<string, unknown> = {}) => ({
    startsAtIso,
    name: 'Audit Booker',
    email: email(),
    phone: '416-555-0100',
    address: 'M5V 2T6',
    city: null,
    service: 'new-install',
    squareFeet: null,
    quoteNotes: null,
    appointmentNotes: null,
    userId: null,
    designId: null,
    designCode: null,
    ...over,
  });

  afterAll(async () => {
    const { db } = await import('@/lib/db');
    try {
      await db.appointment.deleteMany({ where: { customerEmail: { startsWith: prefix } } });
      await db.quoteRequest.deleteMany({ where: { email: { startsWith: prefix } } });
    } finally {
      await db.$disconnect();
    }
  });

  it('does not tell a customer a FREE slot was "taken" because other, unrelated bookings arrived at once', async () => {
    const { bookMeasure } = await import('@/lib/booking/book-measure');
    const picks = distinctDaySlots(12);
    expect(picks.length).toBe(12);
    // Twelve different people, twelve different days: nobody competes for anything.
    const results = await Promise.all(picks.map((s) => bookMeasure(input(s))));
    expect(results.map((r) => r.kind)).toEqual(picks.map(() => 'booked'));
  });

  it('seats a second property of the same household that asks for the same hour (same email, different address)', async () => {
    const { bookMeasure } = await import('@/lib/booking/book-measure');
    const { db } = await import('@/lib/db');
    const slot = distinctDaySlots(20).at(-1)!;
    const shared = email('hh');
    const a = await bookMeasure(input(slot, { email: shared, address: 'M5V 2T6' }));
    const b = await bookMeasure(input(slot, { email: shared, address: 'L4C 9X9' }));
    expect(a.kind).toBe('booked');
    expect(b.kind).toBe('booked');
    expect(await db.appointment.count({ where: { customerEmail: shared } })).toBe(2);
  });

  it('still treats the same address, same hour, differently typed as the same booking', async () => {
    const { bookMeasure } = await import('@/lib/booking/book-measure');
    const slot = distinctDaySlots(21).at(-1)!;
    const shared = email('same');
    const a = await bookMeasure(input(slot, { email: shared, address: 'M5V 2T6' }));
    const b = await bookMeasure(input(slot, { email: shared.toUpperCase(), address: ' m5v2t6 ' }));
    expect(a.kind).toBe('booked');
    expect(b.kind).toBe('already');
  });

  it('frees the seat when an appointment is cancelled', async () => {
    const { bookMeasure } = await import('@/lib/booking/book-measure');
    const { db } = await import('@/lib/db');
    const slot = distinctDaySlots(22).at(-1)!;
    const first = await Promise.all(Array.from({ length: SLOTS_PER_WINDOW }, () => bookMeasure(input(slot))));
    expect(first.every((r) => r.kind === 'booked')).toBe(true);
    expect((await bookMeasure(input(slot))).kind).toBe('taken');
    const held = first[0] as { kind: 'booked'; appointmentId: string };
    await db.appointment.update({ where: { id: held.appointmentId }, data: { status: 'CANCELLED' } });
    expect((await bookMeasure(input(slot))).kind).toBe('booked');
  });
});
