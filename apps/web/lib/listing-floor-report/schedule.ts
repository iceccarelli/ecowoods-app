/**
 * lib/listing-floor-report/schedule.ts — the three-day recoat calendar,
 * counted backwards from the photography date. Pure and unit-tested: no db,
 * no clock read internally (the caller supplies `asOf`) so a test can put
 * "today" anywhere it needs to.
 *
 * Working days are Monday–Friday. No statutory-holiday table is invented —
 * the spec is explicit that guessing at holidays is worse than a plain
 * weekend-only calendar a reader can verify themselves.
 */

export type ScheduleResult =
  | {
      feasible: true;
      day1: string; // ISO date, abrade
      day2: string; // ISO date, coat
      day3: string; // ISO date, cure / photography
    }
  | { feasible: false; reason: 'window_closed'; nextWindowStart: string }
  | { feasible: false; reason: 'sand_required' | 'leave_it' | 'cannot_determine_from_photos' };

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

/** The previous working day strictly before `d`. */
function previousWorkingDay(d: Date): Date {
  const prev = new Date(d);
  do {
    prev.setUTCDate(prev.getUTCDate() - 1);
  } while (isWeekend(prev));
  return prev;
}

/** The next working day on or after `d`. */
function nextWorkingDayOnOrAfter(d: Date): Date {
  const next = new Date(d);
  while (isWeekend(next)) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

export type Recommendation = 'recoat_ok' | 'sand_required' | 'leave_it' | 'cannot_determine_from_photos';

export function computeRecoatSchedule(
  photographyDateISO: string,
  asOf: Date,
  recommendation: Recommendation,
): ScheduleResult {
  if (recommendation !== 'recoat_ok') {
    return { feasible: false, reason: recommendation };
  }

  const day3 = parseISODate(photographyDateISO);
  const day2 = previousWorkingDay(day3);
  const day1 = previousWorkingDay(day2);

  if (day1.getTime() < asOf.getTime()) {
    return {
      feasible: false,
      reason: 'window_closed',
      nextWindowStart: toISODate(nextWorkingDayOnOrAfter(asOf)),
    };
  }

  return { feasible: true, day1: toISODate(day1), day2: toISODate(day2), day3: toISODate(day3) };
}
