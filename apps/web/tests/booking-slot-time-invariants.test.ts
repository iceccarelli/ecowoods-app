/**
 * Invariants lib/booking/book-measure.ts silently depends on, checked across
 * every day of the booking calendar including both daylight-saving changes:
 *
 *   - a slot's instant, read back in Toronto time, is the hour it was generated
 *     for (an offset computed for the wrong side of a clock change would shift
 *     a measure by an hour);
 *   - a slot's UTC calendar date is its local calendar date, because the
 *     capacity check loads "the day" as T00:00:00Z..T23:59:59Z of the local
 *     date key. If business hours ever run late enough to cross UTC midnight,
 *     this fails and the day window must be widened before hours are changed.
 */
import { describe, expect, it } from 'vitest';
import { addDaysToKey, computeDayAvailability, BUSINESS_TIMEZONE } from '@/lib/booking/availability';

const hourInToronto = (iso: string) =>
  Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIMEZONE, hour: '2-digit', hour12: false }).format(new Date(iso)).replace('24', '0'),
  );

describe('booking slots across a whole year', () => {
  const longAgo = new Date('2020-01-01T00:00:00Z');
  const days: string[] = [];
  for (let k = '2026-01-01'; k < '2028-01-01'; k = addDaysToKey(k, 1)) days.push(k);

  it('every slot keeps its intended local hour on every day, including the DST changes', () => {
    const bad: string[] = [];
    for (const day of days) {
      for (const s of computeDayAvailability(day, { now: longAgo, bookingCounts: new Map() }).slots) {
        const intended = Number(s.start.slice(11, 13));
        if (hourInToronto(s.start) !== intended) bad.push(`${s.start} reads ${hourInToronto(s.start)}h in Toronto`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('every slot instant falls on the UTC date of its local date key (the capacity day-window assumption)', () => {
    const bad: string[] = [];
    let seen = 0;
    for (const day of days) {
      for (const s of computeDayAvailability(day, { now: longAgo, bookingCounts: new Map() }).slots) {
        seen++;
        if (new Date(s.start).toISOString().slice(0, 10) !== day) bad.push(`${s.start} is ${new Date(s.start).toISOString()}`);
      }
    }
    expect(seen).toBeGreaterThan(2000);
    expect(bad).toEqual([]);
  });
});
