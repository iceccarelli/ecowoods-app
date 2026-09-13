/**
 * lib/lead-queue.ts — DESK-01. The enquiries nobody has answered.
 *
 * WHAT THE PRODUCTION DATABASE SAYS
 *
 * Queried read-only on 2026-09-13, before a line of this was written:
 *
 *     status      count   priced   issued   converted   oldest       newest
 *     PENDING       14       0        0         0       2026-06-20   2026-09-11
 *     ACCEPTED       2       0        0         2       2026-06-20   2026-06-20
 *
 * Sixteen quote requests. Four are June seed rows; twelve are real enquiries
 * that arrived one at a time between June and two days ago. Fourteen are still
 * PENDING. Not one has ever been priced. Not one has ever had a quote issued.
 * The oldest unanswered enquiry is eighty-five days old.
 *
 * The quote → price → issue → convert → invoice → payment pipeline is real and
 * wired, and it has never been run on a single genuine web lead.
 *
 * WHY THE DASHBOARD DID NOT SHOW THIS
 *
 * The admin dashboard already has a "New Leads Requiring Review" panel. It
 * takes SIX rows ordered `createdAt: 'desc'` — newest first. That is the right
 * order for a feed and exactly wrong for a queue of unanswered work: the
 * eighty-five-day-old enquiry is the last thing in the list or off the bottom
 * of it, and the panel shows a date rather than an age, so "20 Jun" reads as a
 * fact rather than as a problem.
 *
 * This module inverts it. Oldest first, age in days, and a count that does not
 * stop at six.
 *
 * IT DOES NOT INVENT A PRICE
 *
 * Where a lead states its square footage, the indicative range is computed from
 * the SAME published bands the visitor was shown, through the same function
 * every other surface uses. Where it does not, nothing is shown. This is the
 * published band applied to a stated area — it is not a quote, and the
 * dashboard says so.
 *
 * Pure functions over plain rows: no Prisma import, so the arithmetic and the
 * banding are testable without a database.
 */
import { bandForWork } from '@/content/constants/pricing';
import { estimateInstalledRangeCad } from '@ecowoods/shared/ai';

/** How long a lead has waited, in the terms a desk actually uses. */
export type AgeBand = 'today' | 'due' | 'overdue' | 'cold';

export type LeadRow = {
  id: string;
  name: string;
  city: string | null;
  service: string | null;
  squareFeet: number | null;
  createdAt: Date;
};

export type QueuedLead = LeadRow & {
  ageDays: number;
  band: AgeBand;
  /** Published band × stated area, or null when the area is unstated. */
  indicative: { low: number; high: number; currency: string } | null;
};

/**
 * The bands.
 *
 * A home-services enquiry goes cold fast — the homeowner is collecting quotes
 * and the second caller is usually too late. One business day is the promise
 * this site makes on its own estimate form ("a senior estimator replies within
 * one business day"), so anything past that is already late by the site's own
 * published standard, not by an invented target.
 */
export function ageBandFor(ageDays: number): AgeBand {
  if (ageDays < 1) return 'today';
  if (ageDays <= 3) return 'due';
  if (ageDays <= 30) return 'overdue';
  return 'cold';
}

export const AGE_BAND_LABEL: Record<AgeBand, string> = {
  today: 'Today',
  due: 'Due',
  overdue: 'Overdue',
  cold: 'Cold',
};

/** Whole days elapsed, floored. Never negative, even against a clock skew. */
export const ageInDays = (createdAt: Date, now: Date): number =>
  Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 86_400_000));

/**
 * The queue: OLDEST FIRST.
 *
 * That ordering is the entire point. The existing panel sorts newest first,
 * which buries the enquiry that has been waiting longest under the one that
 * arrived this morning.
 */
export function buildQueue(rows: LeadRow[], now: Date = new Date()): QueuedLead[] {
  return rows
    .map((r) => {
      const ageDays = ageInDays(r.createdAt, now);
      let indicative: QueuedLead['indicative'] = null;
      /* Only with a stated area, and only through the published bands. */
      if (typeof r.squareFeet === 'number' && r.squareFeet > 0) {
        try {
          const work = r.service ?? 'installation';
          const e = estimateInstalledRangeCad(
            { species: 'white oak', squareFeet: r.squareFeet, finish: 'satin', pattern: 'straight' },
            bandForWork(work),
          );
          indicative = { low: e.estimatedLowCad, high: e.estimatedHighCad, currency: e.currency };
        } catch {
          /* An unknown service must not break the queue. The lead still shows,
             without a figure — which is the honest output anyway. */
          indicative = null;
        }
      }
      return { ...r, ageDays, band: ageBandFor(ageDays), indicative };
    })
    .sort((a, b) => b.ageDays - a.ageDays);
}

export type QueueSummary = {
  waiting: number;
  oldestDays: number;
  /** Past the one-business-day promise this site publishes. */
  late: number;
};

export function summarise(queue: QueuedLead[]): QueueSummary {
  return {
    waiting: queue.length,
    oldestDays: queue.length ? queue[0]!.ageDays : 0,
    late: queue.filter((q) => q.band === 'overdue' || q.band === 'cold').length,
  };
}
