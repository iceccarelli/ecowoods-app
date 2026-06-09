import { describe, it, expect } from 'vitest';
import {
  computeDayAvailability, computeAvailability, isBookableSlot,
  SLOTS_PER_WINDOW, SLOT_DURATION_MINUTES,
} from './availability';

// Fixed "now": Mon 2026-06-08 09:00 Toronto (EDT -04:00).
const NOW = new Date('2026-06-08T09:00:00-04:00');
const none = new Map<string, number>();

describe('computeDayAvailability', () => {
  it('Sunday is open 10–4 (footer hours)', () => {
    const d = computeDayAvailability('2026-06-14', { now: NOW, bookingCounts: none });
    expect(d.slots.length).toBeGreaterThan(0);
    expect(d.slots[0].start).toContain('T10:00');
  });
  it('Wed 8–7 => 11 hourly slots, last starts 18:00', () => {
    const d = computeDayAvailability('2026-06-10', { now: NOW, bookingCounts: none });
    expect(d.slots[0].start).toContain('T08:00');
    expect(d.slots[d.slots.length - 1].start).toContain('T18:00');
    expect(d.slots).toHaveLength(11);
  });
  it('enforces 24h lead time (same day = no slots)', () => {
    expect(computeDayAvailability('2026-06-08', { now: NOW, bookingCounts: none }).slots).toHaveLength(0);
  });
  it('subtracts existing bookings from capacity', () => {
    const t = '2026-06-10T08:00:00-04:00';
    const d = computeDayAvailability('2026-06-10', { now: NOW, bookingCounts: new Map([[t, SLOTS_PER_WINDOW]]) });
    const s = d.slots.find((x) => x.start === t)!;
    expect(s.remaining).toBe(0);
    expect(s.available).toBe(false);
  });
  it('uses configured slot duration', () => {
    expect(computeDayAvailability('2026-06-10', { now: NOW, bookingCounts: none }).slots[0].durationMinutes)
      .toBe(SLOT_DURATION_MINUTES);
  });
});

describe('computeAvailability window', () => {
  it('never exceeds the booking window', () => {
    const { days } = computeAvailability({ now: NOW, bookingCounts: none });
    expect(days.length).toBeGreaterThan(0);
    expect(days.length).toBeLessThanOrEqual(43);
  });
  it('clamps a requested range', () => {
    const { days } = computeAvailability({ now: NOW, bookingCounts: none }, '2026-06-09', '2026-06-12');
    expect(days[0].date).toBe('2026-06-09');
    expect(days[days.length - 1].date).toBe('2026-06-12');
  });
});

describe('isBookableSlot (server guard)', () => {
  it('accepts a real open slot', () => {
    expect(isBookableSlot('2026-06-10T08:00:00-04:00', { now: NOW, bookingCounts: none })).toBe(true);
  });
  it('rejects inside lead-time', () => {
    expect(isBookableSlot('2026-06-08T08:00:00-04:00', { now: NOW, bookingCounts: none })).toBe(false);
  });
  it('rejects off-grid time', () => {
    expect(isBookableSlot('2026-06-10T08:30:00-04:00', { now: NOW, bookingCounts: none })).toBe(false);
  });
  it('rejects a full slot', () => {
    const t = '2026-06-10T08:00:00-04:00';
    expect(isBookableSlot(t, { now: NOW, bookingCounts: new Map([[t, SLOTS_PER_WINDOW]]) })).toBe(false);
  });
});
