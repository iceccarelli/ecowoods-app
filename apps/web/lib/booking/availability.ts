// lib/booking/availability.ts
// Pure, dependency-free availability engine. No I/O: it takes "now" and existing
// booking counts and computes open slots. Purity = testable + trustworthy.
// Times render in America/Toronto via Intl (Node 18+ / all modern browsers).

export const BUSINESS_TIMEZONE = 'America/Toronto';
export const SLOT_DURATION_MINUTES = 60;        // 45–60 min consult, rounded to 60
export const SLOTS_PER_WINDOW = 2;              // estimators out at once
export const MIN_LEAD_TIME_HOURS = 24;          // earliest bookable, from "now"
export const BOOKING_WINDOW_DAYS = 42;          // six weeks

// Business hours by weekday (0=Sun..6=Sat), 24h local. null = closed.
// From the site footer: Mon–Sat 8–7, Sun 10–4.
export const BUSINESS_HOURS: Record<number, { open: number; close: number } | null> = {
  0: { open: 10, close: 16 },
  1: { open: 8, close: 19 },
  2: { open: 8, close: 19 },
  3: { open: 8, close: 19 },
  4: { open: 8, close: 19 },
  5: { open: 8, close: 19 },
  6: { open: 8, close: 19 },
};

export const BLACKOUT_DATES: ReadonlySet<string> = new Set<string>([
  // '2026-12-25', '2026-01-01',
]);

export interface Slot {
  start: string;            // ISO 8601 w/ offset, e.g. 2026-06-18T14:00:00-04:00
  durationMinutes: number;
  remaining: number;
  available: boolean;
}
export interface DayAvailability { date: string; slots: Slot[]; }
export interface ComputeOptions { now: Date; bookingCounts: Map<string, number>; }

const WEEKDAY_INDEX: Record<string, number> = { Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6 };

function partsInTz(date: Date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', hour12:false, weekday:'short',
  });
  const m: Record<string,string> = {};
  for (const p of fmt.formatToParts(date)) m[p.type] = p.value;
  return {
    year:+m.year, month:+m.month, day:+m.day,
    hour:+(m.hour === '24' ? '0' : m.hour), minute:+m.minute, weekdayShort:m.weekday,
  };
}

export function localDateKey(date: Date): string {
  const p = partsInTz(date);
  return `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;
}

function offsetForDate(dateKey: string): string {
  const probe = new Date(`${dateKey}T12:00:00Z`);
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TIMEZONE, timeZoneName:'longOffset' });
  const raw = fmt.formatToParts(probe).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+00:00';
  const mm = raw.match(/GMT([+-]\d{2}:\d{2})/);
  return mm ? mm[1] : '+00:00';
}

function isoForLocalTime(dateKey: string, hour: number, minute: number): string {
  return `${dateKey}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00${offsetForDate(dateKey)}`;
}

export function addDaysToKey(dateKey: string, days: number): string {
  const [y,m,d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m-1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`;
}

export function weekdayForKey(dateKey: string): number {
  return WEEKDAY_INDEX[partsInTz(new Date(`${dateKey}T12:00:00Z`)).weekdayShort] ?? 0;
}

function candidateSlots(dateKey: string): { hour: number; minute: number }[] {
  const hours = BUSINESS_HOURS[weekdayForKey(dateKey)];
  if (!hours || BLACKOUT_DATES.has(dateKey)) return [];
  const out: { hour: number; minute: number }[] = [];
  for (let t = hours.open*60; t + SLOT_DURATION_MINUTES <= hours.close*60; t += SLOT_DURATION_MINUTES) {
    out.push({ hour: Math.floor(t/60), minute: t%60 });
  }
  return out;
}

export function computeDayAvailability(dateKey: string, opts: ComputeOptions): DayAvailability {
  const earliest = new Date(opts.now.getTime() + MIN_LEAD_TIME_HOURS*3600_000).getTime();
  const slots: Slot[] = candidateSlots(dateKey)
    .map(({ hour, minute }) => {
      const start = isoForLocalTime(dateKey, hour, minute);
      const startMs = new Date(start).getTime();
      const remaining = Math.max(0, SLOTS_PER_WINDOW - (opts.bookingCounts.get(start) ?? 0));
      return { start, startMs, durationMinutes: SLOT_DURATION_MINUTES, remaining };
    })
    .filter((s) => s.startMs >= earliest)
    .map(({ startMs, ...rest }) => ({ ...rest, available: rest.remaining > 0 }));
  return { date: dateKey, slots };
}

export function computeAvailability(opts: ComputeOptions, fromKey?: string, toKey?: string) {
  const todayKey = localDateKey(opts.now);
  const hardEnd = addDaysToKey(todayKey, BOOKING_WINDOW_DAYS);
  const startKey = fromKey && fromKey > todayKey ? fromKey : todayKey;
  const endKey = toKey && toKey < hardEnd ? toKey : hardEnd;
  const days: DayAvailability[] = [];
  let cursor = startKey;
  for (let i = 0; i <= BOOKING_WINDOW_DAYS && cursor <= endKey; i++) {
    days.push(computeDayAvailability(cursor, opts));
    cursor = addDaysToKey(cursor, 1);
  }
  return { timezone: BUSINESS_TIMEZONE, days };
}

export function isBookableSlot(startsAt: string, opts: ComputeOptions): boolean {
  const day = computeDayAvailability(localDateKey(new Date(startsAt)), opts);
  const slot = day.slots.find((s) => s.start === startsAt);
  return Boolean(slot && slot.available);
}
