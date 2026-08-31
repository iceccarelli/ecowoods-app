/**
 * lib/business-hours.ts — "are we open right now", derived, on both sides.
 *
 * WHY THIS FILE EXISTS
 *
 * Two things were wrong before it.
 *
 * 1. lib/booking/availability.ts carried its own hardcoded weekday table with
 *    the comment "From the site footer: Mon–Sat 8–7, Sun 10–4". That is a
 *    second copy of a business fact whose single source is BUSINESS_HOURS in
 *    packages/shared/constants — the exact pattern this repository fails the
 *    build over everywhere else. It agreed with the source, which is the
 *    dangerous state rather than the safe one: a second copy that agrees looks
 *    like a single source of truth right up until the day somebody changes the
 *    hours in one place. The booking engine now derives from here.
 *
 * 2. Nothing on the site knew what time it was. The chat widget answered
 *    identically at 3am, and a visitor at 11pm on a Sunday got a launcher that
 *    implied somebody was there. The most valuable minute in this business is
 *    the one where a person is ready to act and nobody is available — that is
 *    the minute you capture asynchronously or lose entirely.
 *
 * PURE, TIMEZONE-CORRECT, AND USABLE IN A CLIENT COMPONENT. No `node:` imports
 * — the office weekday and hour are read through Intl in America/Toronto, so a
 * visitor in Vancouver or a serverless region in Virginia gets the same answer
 * as the shop.
 */

import { BUSINESS_HOURS, BUSINESS_TIMEZONE_NAME } from '@ecowoods/shared/constants';

const DAY_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const toHour = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) + (m ?? 0) / 60;
};

/**
 * Opening hours by weekday index (0 = Sunday), derived from BUSINESS_HOURS.
 * `null` means closed that day. This is the shape the booking engine wants.
 */
export const HOURS_BY_WEEKDAY: Record<number, { open: number; close: number } | null> = (() => {
  const out: Record<number, { open: number; close: number } | null> = {
    0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null,
  };
  for (const block of BUSINESS_HOURS) {
    for (const day of block.days) {
      const i = DAY_INDEX[day];
      if (i === undefined) continue;
      out[i] = { open: toHour(block.opens), close: toHour(block.closes) };
    }
  }
  return out;
})();

/** The office's own wall clock, wherever the caller happens to be. */
export function officeNow(now: Date = new Date()): { weekday: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE_NAME,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { weekday: map[wd] ?? 0, hour: hour + minute / 60 };
}

/** True when the phone is being answered right now, in Toronto. */
export function isOpenNow(now: Date = new Date()): boolean {
  const { weekday, hour } = officeNow(now);
  const window = HOURS_BY_WEEKDAY[weekday];
  if (!window) return false;
  return hour >= window.open && hour < window.close;
}

/**
 * "tomorrow at 8 AM" — when someone will next pick up. Used to tell an
 * after-hours visitor exactly how long a reply will take, instead of leaving
 * them to guess and go elsewhere.
 */
export function nextOpeningLabel(now: Date = new Date()): string {
  const { weekday, hour } = officeNow(now);
  const fmtHour = (h: number) => {
    const hh = Math.floor(h);
    const suffix = hh >= 12 ? 'PM' : 'AM';
    const display = hh % 12 === 0 ? 12 : hh % 12;
    return `${display} ${suffix}`;
  };

  const today = HOURS_BY_WEEKDAY[weekday];
  if (today && hour < today.open) return `today at ${fmtHour(today.open)}`;

  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (let step = 1; step <= 7; step += 1) {
    const d = (weekday + step) % 7;
    const w = HOURS_BY_WEEKDAY[d];
    if (w) return `${step === 1 ? 'tomorrow' : names[d]} at ${fmtHour(w.open)}`;
  }
  return 'the next business day';
}
