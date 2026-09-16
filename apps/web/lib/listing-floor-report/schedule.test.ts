import { describe, expect, it } from 'vitest';
import { computeRecoatSchedule } from './schedule';

// A known week for stable fixtures: 2026-09-14 (Mon) .. 2026-09-20 (Sun).
const FAR_PAST = new Date('2026-01-01T00:00:00Z');

describe('computeRecoatSchedule', () => {
  it('lays out day1/day2/day3 on consecutive weekdays when the whole window sits inside one work week', () => {
    const result = computeRecoatSchedule('2026-09-16', FAR_PAST, 'recoat_ok'); // Wed
    expect(result).toEqual({ feasible: true, day1: '2026-09-14', day2: '2026-09-15', day3: '2026-09-16' });
  });

  it('spans a weekend when the two-working-day lookback crosses one', () => {
    const result = computeRecoatSchedule('2026-09-15', FAR_PAST, 'recoat_ok'); // Tue
    // day2 = Mon 09-14, day1 = Fri 09-11 (skips Sat 09-12 / Sun 09-13)
    expect(result).toEqual({ feasible: true, day1: '2026-09-11', day2: '2026-09-14', day3: '2026-09-15' });
  });

  it('reports the window closed when day1 already passed relative to asOf, without a wishful past schedule', () => {
    const asOf = new Date('2026-09-15T00:00:00Z'); // Tue, after the computed day1 (Mon 09-14)
    const result = computeRecoatSchedule('2026-09-16', asOf, 'recoat_ok');
    expect(result.feasible).toBe(false);
    if (!result.feasible && result.reason === 'window_closed') {
      expect(result.nextWindowStart).toBe('2026-09-15');
    } else {
      throw new Error('expected window_closed');
    }
  });

  it('rolls a closed window forward past a weekend to the next working day', () => {
    const asOf = new Date('2026-09-19T00:00:00Z'); // Sat
    const result = computeRecoatSchedule('2026-09-20', asOf, 'recoat_ok');
    expect(result.feasible).toBe(false);
    if (!result.feasible && result.reason === 'window_closed') {
      expect(result.nextWindowStart).toBe('2026-09-21'); // Mon
    } else {
      throw new Error('expected window_closed');
    }
  });

  it('emits no recoat calendar when the recommendation is sand_required', () => {
    expect(computeRecoatSchedule('2026-09-16', FAR_PAST, 'sand_required')).toEqual({
      feasible: false,
      reason: 'sand_required',
    });
  });

  it('emits no recoat calendar when the recommendation is leave_it or cannot_determine_from_photos', () => {
    expect(computeRecoatSchedule('2026-09-16', FAR_PAST, 'leave_it')).toEqual({ feasible: false, reason: 'leave_it' });
    expect(computeRecoatSchedule('2026-09-16', FAR_PAST, 'cannot_determine_from_photos')).toEqual({
      feasible: false,
      reason: 'cannot_determine_from_photos',
    });
  });
});
