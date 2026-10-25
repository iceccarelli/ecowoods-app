/**
 * lib/funnel-report.ts — the read side of the conversion measurement.
 *
 * Everything on /admin/funnel and /api/admin/funnel is computed here, and the
 * arithmetic is PURE: `buildFunnelReport` takes plain query results and returns
 * the report, so every figure is unit-testable without a database.
 * `loadFunnelReport` is the thin I/O layer that gathers those results.
 *
 * RULES THIS FILE LIVES BY
 *
 *   - Nothing is invented. Every number is a count of rows that exist. A stage
 *     with no data source reports `null` ("not recorded"), never 0 — 0 would
 *     read as "measured, and nobody got here".
 *   - No customer PII. Queries select stage / source label / foreign-key ids /
 *     timestamps and use COUNT() only. Names, emails and phones are never read.
 *     `source` is a free-text label from a form field, so it is folded into a
 *     closed set of channels before it leaves this module.
 *   - A rate with an empty denominator is `null`, not 0%.
 *   - Windows are whole America/Toronto calendar days, today included.
 */
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { CRON_EMAIL_MAX_ATTEMPTS } from '@/lib/email/cron-email-policy';
import { BUSINESS_TIMEZONE, addDaysToKey, localDateKey } from '@/lib/booking/availability';
import { FUNNEL_ORDER, type FunnelStage } from '@/lib/funnel-ledger';
import { acquisitionByQuote } from '@/lib/lead-acquisition';
import { ACQUISITION_CHANNELS, ACQUISITION_LABEL, isAcquisitionChannel, type AcquisitionChannel } from '@/lib/acquisition';

/* ── window ───────────────────────────────────────────────────────────────── */

export const WINDOW_OPTIONS = [7, 30, 90] as const;
export type WindowDays = (typeof WINDOW_OPTIONS)[number];
export const DEFAULT_WINDOW_DAYS: WindowDays = 30;

export function parseWindowDays(value: unknown): WindowDays {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return (WINDOW_OPTIONS as readonly number[]).includes(n) ? (n as WindowDays) : DEFAULT_WINDOW_DAYS;
}

/** Offset (ms) of America/Toronto from UTC at the given instant. */
function zoneOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(at);
  const m: Record<string, number> = {};
  for (const p of parts) if (p.type !== 'literal') m[p.type] = Number(p.value);
  const asUtc = Date.UTC(m.year!, m.month! - 1, m.day!, m.hour === 24 ? 0 : m.hour!, m.minute!, m.second!);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The UTC instant at which the Toronto calendar day `dateKey` (YYYY-MM-DD) begins. */
export function torontoMidnightUtc(dateKey: string): Date {
  const [y, mo, d] = dateKey.split('-').map(Number) as [number, number, number];
  const naive = Date.UTC(y, mo - 1, d, 0, 0, 0);
  // Two passes settle DST transitions (the offset at the guess may differ from the offset at the answer).
  let guess = naive - zoneOffsetMs(new Date(naive));
  guess = naive - zoneOffsetMs(new Date(guess));
  return new Date(guess);
}

/** Start of the window: Toronto midnight, `days - 1` calendar days before today (today counts as day 1). */
export function windowStart(now: Date, days: number): Date {
  return torontoMidnightUtc(addDaysToKey(localDateKey(now), -(days - 1)));
}

/* ── channels ─────────────────────────────────────────────────────────────── */

export const CHANNELS = [
  'ESTIMATE_FORM',
  'ASSISTANT',
  'PHOTO_TRIAGE',
  'FLOOR_STUDIO',
  'REFERRAL',
  'BOOKING_PAGE',
  'UNKNOWN',
] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABEL: Record<Channel, string> = {
  ESTIMATE_FORM: 'Estimate form (site pages)',
  ASSISTANT: 'Assistant',
  PHOTO_TRIAGE: 'Photo triage',
  FLOOR_STUDIO: 'Floor Studio',
  REFERRAL: 'Referral / realtor',
  BOOKING_PAGE: 'Booking page',
  UNKNOWN: 'No source recorded',
};

/**
 * Fold a free-text `source` label (plus design attachment) into one channel.
 * Never returns the raw label, so arbitrary form text cannot reach the report.
 * Order matters: the most specific surface wins.
 */
export function channelOf(source: string | null | undefined, hasDesign: boolean): Channel {
  const s = (source ?? '').trim().toLowerCase();
  if (s === 'assistant' || s === 'chat' || s.startsWith('assistant')) return 'ASSISTANT';
  /* `photo-triage:<page>` — /api/photo-triage records the surface first and the
     page it was submitted from after it. */
  if (s === 'photo-triage' || s === 'photo_triage' || s.startsWith('photo-triage:')) return 'PHOTO_TRIAGE';
  if (s.startsWith('configurator') || s.includes('floor-studio') || s.includes('floorstudio') || hasDesign) return 'FLOOR_STUDIO';
  if (s.includes('referral') || s.includes('realtor')) return 'REFERRAL';
  if (s === 'booking' || s === 'web_scheduler') return 'BOOKING_PAGE';
  if (s) return 'ESTIMATE_FORM';
  return 'UNKNOWN';
}

/* ── pure computation ─────────────────────────────────────────────────────── */

/** One ledger row as the report reads it. No PII fields exist on this type. */
export type LedgerRow = {
  stage: FunnelStage;
  source: string | null;
  /** Acquisition channel slug on LEAD_CAPTURED rows; null/absent = not captured. */
  acquisition?: string | null;
  hasDesign: boolean;
  quoteId: string | null;
  projectId: string | null;
};

export type ReportInput = {
  ledger: LedgerRow[];
  /** False when the acquisition table could not be read at all (migration not applied yet). Defaults to true. */
  acquisitionAvailable?: boolean;
  quoteRequestsCreated: number;
  appointmentsCreated: number;
  recovery: {
    requested: number;
    confirmed: number;
    sent: number;
    converted: number;
    /** Reminders that failed 5 times and were never sent (need attention). Aggregate only. */
    couldNotBeSent: number;
    /** Post-job review requests that failed 5 times and were never sent (need attention). Aggregate only. */
    reviewRequestsCouldNotBeSent: number;
  };
  assistant: { conversationsCreated: number; withLeadHandoff: number };
};

/** Percent with one decimal; null when the denominator is empty (no rate exists, not 0%). */
export function rate(to: number, from: number): number | null {
  if (from === 0) return null;
  return Math.round((to / from) * 1000) / 10;
}

export const STAGE_LABEL: Record<FunnelStage, string> = {
  LEAD_CAPTURED: 'Lead captured',
  APPOINTMENT_BOOKED: 'Measure booked',
  QUOTE_ISSUED: 'Price issued in writing',
  QUOTE_ACCEPTED: 'Quote accepted',
  DEPOSIT_PAID: 'Deposit paid',
  JOB_COMPLETED: 'Job complete',
};

/** Cohort steps, "reached this stage or later". Same order as FUNNEL_ORDER. */
export type CohortCounts = Record<FunnelStage, number>;

export type CohortRow = {
  channel: Channel | 'ALL';
  label: string;
  counts: CohortCounts;
  /** Step conversion to each stage from the one before it (LEAD_CAPTURED has none). */
  stepRates: Record<FunnelStage, number | null>;
  /** Leads whose ledger row carries no quote id, so they cannot be followed to later stages. */
  unlinkedLeads: number;
};

export type AcquisitionKey = AcquisitionChannel | 'NOT_CAPTURED';

export type AcquisitionRow = {
  key: AcquisitionKey;
  label: string;
  counts: CohortCounts;
  stepRates: Record<FunnelStage, number | null>;
  /** Leads whose ledger row carries no quote id, so they cannot be followed to later stages. */
  unlinkedLeads: number;
};

export const ACQUISITION_UNAVAILABLE_NOTE =
  'Acquisition could not be read, so no split is shown. This is expected until the lead-acquisition database migration has been applied; leads are unaffected.';

export const ACQUISITION_NOTE =
  'Leads by how the visit began. "Not captured" is a lead with no recorded acquisition (no JavaScript, a call, an assistant handoff, or before this was recorded). ' +
  '"No referrer" is not confirmed direct traffic, and an AI assistant that sends no referrer cannot be told apart from it, so AI rows understate AI-driven visits.';

export type FunnelReport = {
  /** Stage-by-stage totals for events that happened in the window. */
  period: {
    firstTouch: { count: null; note: 'not recorded' };
    stages: Array<{ stage: FunnelStage; label: string; count: number }>;
  };
  /** Leads captured in the window, followed to the stages they reached. */
  cohort: { rows: CohortRow[] };
  /** The same cohort, split by how the visit began (lib/acquisition.ts), not by which form was used. */
  acquisition: { rows: AcquisitionRow[]; note: string };
  /** Database rows against ledger rows, so a gap in instrumentation is visible rather than hidden. */
  reconciliation: {
    quoteRequests: { databaseRows: number; ledgerLeads: number };
    appointments: { databaseRows: number; ledgerAppointments: number };
  };
  quoteRecovery: {
    requested: number;
    confirmed: number;
    sent: number;
    converted: number;
    couldNotBeSent: number;
    reviewRequestsCouldNotBeSent: number;
    rates: { confirmed: number | null; sent: number | null; converted: number | null };
  };
  assistant: {
    conversationsCreated: number;
    withLeadHandoff: number;
    handoffRate: number | null;
  };
};

const emptyCounts = (): CohortCounts => ({
  LEAD_CAPTURED: 0, APPOINTMENT_BOOKED: 0, QUOTE_ISSUED: 0, QUOTE_ACCEPTED: 0, DEPOSIT_PAID: 0, JOB_COMPLETED: 0,
});

function stepRates(c: CohortCounts): Record<FunnelStage, number | null> {
  const out = {} as Record<FunnelStage, number | null>;
  FUNNEL_ORDER.forEach((stage, i) => {
    out[stage] = i === 0 ? null : rate(c[stage], c[FUNNEL_ORDER[i - 1]!]);
  });
  return out;
}

export function buildFunnelReport(input: ReportInput): FunnelReport {
  const { ledger } = input;

  /* Period totals: every ledger row in the window, by its own stage. */
  const periodCounts = emptyCounts();
  for (const r of ledger) periodCounts[r.stage] += 1;

  /* Cohort: leads captured in the window. A lead is a distinct quote id; the
     first LEAD_CAPTURED row seen for it fixes its channel. */
  const leadChannel = new Map<string, Channel>();
  const unlinked: Record<Channel, number> = Object.fromEntries(CHANNELS.map((c) => [c, 0])) as Record<Channel, number>;
  for (const r of ledger) {
    if (r.stage !== 'LEAD_CAPTURED') continue;
    const ch = channelOf(r.source, r.hasDesign);
    if (r.quoteId === null) unlinked[ch] += 1;
    else if (!leadChannel.has(r.quoteId)) leadChannel.set(r.quoteId, ch);
  }

  const byQuote = new Map<string, Set<FunnelStage>>();
  const projectsOfQuote = new Map<string, Set<string>>();
  const stagesOfProject = new Map<string, Set<FunnelStage>>();
  for (const r of ledger) {
    if (r.quoteId !== null) {
      if (!byQuote.has(r.quoteId)) byQuote.set(r.quoteId, new Set());
      byQuote.get(r.quoteId)!.add(r.stage);
      if (r.stage === 'QUOTE_ACCEPTED' && r.projectId !== null) {
        if (!projectsOfQuote.has(r.quoteId)) projectsOfQuote.set(r.quoteId, new Set());
        projectsOfQuote.get(r.quoteId)!.add(r.projectId);
      }
    }
    if (r.projectId !== null && (r.stage === 'DEPOSIT_PAID' || r.stage === 'JOB_COMPLETED')) {
      if (!stagesOfProject.has(r.projectId)) stagesOfProject.set(r.projectId, new Set());
      stagesOfProject.get(r.projectId)!.add(r.stage);
    }
  }

  const perChannel = Object.fromEntries(CHANNELS.map((c) => [c, emptyCounts()])) as Record<Channel, CohortCounts>;
  for (const [quoteId, ch] of leadChannel) {
    const seen = new Set<FunnelStage>(byQuote.get(quoteId) ?? []);
    for (const p of projectsOfQuote.get(quoteId) ?? []) for (const s of stagesOfProject.get(p) ?? []) seen.add(s);
    /* "Reached this stage or later": a lead with a deposit has plainly been
       accepted, whether or not an intermediate row was ever recorded. */
    let deepest = 0;
    FUNNEL_ORDER.forEach((s, i) => { if (seen.has(s)) deepest = Math.max(deepest, i); });
    perChannel[ch].LEAD_CAPTURED += 1;
    for (let i = 1; i <= deepest; i += 1) perChannel[ch][FUNNEL_ORDER[i]!] += 1;
  }
  for (const ch of CHANNELS) perChannel[ch].LEAD_CAPTURED += unlinked[ch];

  const total = emptyCounts();
  for (const ch of CHANNELS) for (const s of FUNNEL_ORDER) total[s] += perChannel[ch][s];
  const totalUnlinked = CHANNELS.reduce((n, c) => n + unlinked[c], 0);

  /* The same "reached this stage or later" cohort, keyed by acquisition. The
     first LEAD_CAPTURED row for a quote fixes its key, exactly as for channel. */
  const acqKey = new Map<string, AcquisitionKey>();
  const acqUnlinked = new Map<AcquisitionKey, number>();
  const asKey = (v: string | null | undefined): AcquisitionKey => (isAcquisitionChannel(v) ? v : 'NOT_CAPTURED');
  for (const r of ledger) {
    if (r.stage !== 'LEAD_CAPTURED') continue;
    const k = asKey(r.acquisition);
    if (r.quoteId === null) acqUnlinked.set(k, (acqUnlinked.get(k) ?? 0) + 1);
    else if (!acqKey.has(r.quoteId)) acqKey.set(r.quoteId, k);
  }
  const perAcq = new Map<AcquisitionKey, CohortCounts>();
  const countsFor = (k: AcquisitionKey): CohortCounts => {
    if (!perAcq.has(k)) perAcq.set(k, emptyCounts());
    return perAcq.get(k)!;
  };
  for (const [quoteId, k] of acqKey) {
    const seen = new Set<FunnelStage>(byQuote.get(quoteId) ?? []);
    for (const p of projectsOfQuote.get(quoteId) ?? []) for (const s of stagesOfProject.get(p) ?? []) seen.add(s);
    let deepest = 0;
    FUNNEL_ORDER.forEach((s, i) => { if (seen.has(s)) deepest = Math.max(deepest, i); });
    const c = countsFor(k);
    c.LEAD_CAPTURED += 1;
    for (let i = 1; i <= deepest; i += 1) c[FUNNEL_ORDER[i]!] += 1;
  }
  for (const [k, n] of acqUnlinked) countsFor(k).LEAD_CAPTURED += n;
  const ACQ_ORDER: AcquisitionKey[] = [...ACQUISITION_CHANNELS, 'NOT_CAPTURED'];
  const acquisitionRows: AcquisitionRow[] = ACQ_ORDER.filter((k) => (perAcq.get(k)?.LEAD_CAPTURED ?? 0) > 0).map((k) => ({
    key: k,
    label: k === 'NOT_CAPTURED' ? 'Not captured' : ACQUISITION_LABEL[k],
    counts: perAcq.get(k)!,
    stepRates: stepRates(perAcq.get(k)!),
    unlinkedLeads: acqUnlinked.get(k) ?? 0,
  }));
  const acquisitionAvailable = input.acquisitionAvailable !== false;

  const rows: CohortRow[] = [
    { channel: 'ALL', label: 'All channels', counts: total, stepRates: stepRates(total), unlinkedLeads: totalUnlinked },
    ...CHANNELS.filter((c) => perChannel[c].LEAD_CAPTURED > 0).map((c) => ({
      channel: c,
      label: CHANNEL_LABEL[c],
      counts: perChannel[c],
      stepRates: stepRates(perChannel[c]),
      unlinkedLeads: unlinked[c],
    })),
  ];

  const ledgerLeadQuotes = new Set<string>();
  let ledgerLeadsNoQuote = 0;
  for (const r of ledger) {
    if (r.stage !== 'LEAD_CAPTURED') continue;
    if (r.quoteId === null) ledgerLeadsNoQuote += 1;
    else ledgerLeadQuotes.add(r.quoteId);
  }

  const rec = input.recovery;
  return {
    period: {
      firstTouch: { count: null, note: 'not recorded' },
      stages: FUNNEL_ORDER.map((stage) => ({ stage, label: STAGE_LABEL[stage], count: periodCounts[stage] })),
    },
    cohort: { rows },
    acquisition: acquisitionAvailable
      ? { rows: acquisitionRows, note: ACQUISITION_NOTE }
      : { rows: [], note: ACQUISITION_UNAVAILABLE_NOTE },
    reconciliation: {
      quoteRequests: { databaseRows: input.quoteRequestsCreated, ledgerLeads: ledgerLeadQuotes.size + ledgerLeadsNoQuote },
      appointments: { databaseRows: input.appointmentsCreated, ledgerAppointments: periodCounts.APPOINTMENT_BOOKED },
    },
    quoteRecovery: {
      ...rec,
      rates: {
        confirmed: rate(rec.confirmed, rec.requested),
        sent: rate(rec.sent, rec.confirmed),
        converted: rate(rec.converted, rec.sent),
      },
    },
    assistant: {
      ...input.assistant,
      handoffRate: rate(input.assistant.withLeadHandoff, input.assistant.conversationsCreated),
    },
  };
}

/* ── I/O ──────────────────────────────────────────────────────────────────── */

export type FunnelReportResponse = {
  windowDays: WindowDays;
  timezone: string;
  from: string;
  to: string;
  report: FunnelReport;
};

/** The subset of the Prisma client the loader uses (lets a test pass a query-logging client). */
type Client = Pick<
  typeof db,
  'funnelEvent' | 'quoteRequest' | 'appointment' | 'quoteRecovery' | 'project' | 'assistantConversation' | '$queryRaw'
>;

export async function loadFunnelReport(
  days: WindowDays,
  now: Date = new Date(),
  client: Client = db,
): Promise<FunnelReportResponse> {
  const from = windowStart(now, days);
  const range = { gte: from, lte: now };

  const [ledgerRows, quoteRequestsCreated, appointmentsCreated, requested, confirmed, sent, converted, couldNotBeSent, reviewRequestsCouldNotBeSent, conversations, handoffRows] =
    await Promise.all([
      client.funnelEvent.findMany({
        where: { occurredAt: range },
        orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
        select: { stage: true, source: true, designId: true, quoteId: true, projectId: true },
      }),
      client.quoteRequest.count({ where: { createdAt: range } }),
      client.appointment.count({ where: { createdAt: range } }),
      client.quoteRecovery.count({ where: { createdAt: range } }),
      client.quoteRecovery.count({ where: { createdAt: range, confirmedAt: { not: null } } }),
      client.quoteRecovery.count({ where: { createdAt: range, sentAt: { not: null } } }),
      client.quoteRecovery.count({ where: { createdAt: range, convertedAt: { not: null } } }),
      /* "Could not be sent": five failed provider attempts, never delivered. Counts only. */
      client.quoteRecovery.count({ where: { createdAt: range, sentAt: null, convertedAt: null, sendAttempts: { gte: CRON_EMAIL_MAX_ATTEMPTS } } }),
      client.project.count({
        where: { status: 'COMPLETED', reviewRequestedAt: null, reviewEmailAttempts: { gte: CRON_EMAIL_MAX_ATTEMPTS }, updatedAt: range },
      }),
      client.assistantConversation.count({ where: { createdAt: range } }),
      /* A conversation "handed off" when a lead was later captured against the
         same design id. Counts only: the join reads two ids and two timestamps. */
      client.$queryRaw<Array<{ n: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS n
        FROM "ecowoods"."AssistantConversation" c
        WHERE c."createdAt" >= ${from} AND c."createdAt" <= ${now}
          AND EXISTS (
            SELECT 1 FROM "ecowoods"."QuoteRequest" q
            WHERE q."designId" = c."designId" AND q."createdAt" >= c."createdAt"
          )`),
    ]);

  /* First touch lives in its own table (lib/lead-acquisition.ts); a failure to read it must never fail the report. */
  const acq = await acquisitionByQuote(
    [...new Set(ledgerRows.filter((r) => r.stage === 'LEAD_CAPTURED' && r.quoteId !== null).map((r) => r.quoteId as string))],
  );

  const report = buildFunnelReport({
    acquisitionAvailable: acq.available,
    ledger: ledgerRows.map((r) => ({
      stage: r.stage,
      source: r.source,
      acquisition: r.quoteId ? acq.byQuote.get(r.quoteId) ?? null : null,
      hasDesign: r.designId !== null,
      quoteId: r.quoteId,
      projectId: r.projectId,
    })),
    quoteRequestsCreated,
    appointmentsCreated,
    recovery: { requested, confirmed, sent, converted, couldNotBeSent, reviewRequestsCouldNotBeSent },
    assistant: { conversationsCreated: conversations, withLeadHandoff: Number(handoffRows[0]?.n ?? 0) },
  });

  return { windowDays: days, timezone: BUSINESS_TIMEZONE, from: from.toISOString(), to: now.toISOString(), report };
}
