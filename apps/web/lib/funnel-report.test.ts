import { describe, expect, it } from 'vitest';
import {
  buildFunnelReport,
  channelOf,
  parseWindowDays,
  rate,
  torontoMidnightUtc,
  windowStart,
  type LedgerRow,
  type ReportInput,
} from './funnel-report';

const row = (p: Partial<LedgerRow> & Pick<LedgerRow, 'stage'>): LedgerRow => ({
  source: null, hasDesign: false, quoteId: null, projectId: null, ...p,
});
const base = (ledger: LedgerRow[], over: Partial<ReportInput> = {}): ReportInput => ({
  ledger,
  quoteRequestsCreated: 0,
  appointmentsCreated: 0,
  recovery: { requested: 0, confirmed: 0, sent: 0, converted: 0 },
  assistant: { conversationsCreated: 0, withLeadHandoff: 0 },
  ...over,
});

describe('window (America/Toronto)', () => {
  it('parses only 7/30/90, defaulting to 30', () => {
    expect([parseWindowDays('7'), parseWindowDays('90'), parseWindowDays('5'), parseWindowDays(null), parseWindowDays(['7'])]).toEqual([7, 90, 30, 30, 7]);
  });
  it('Toronto midnight is 04:00Z in summer (EDT) and 05:00Z in winter (EST)', () => {
    expect(torontoMidnightUtc('2026-07-15').toISOString()).toBe('2026-07-15T04:00:00.000Z');
    expect(torontoMidnightUtc('2026-01-15').toISOString()).toBe('2026-01-15T05:00:00.000Z');
  });
  it('handles the DST transitions', () => {
    expect(torontoMidnightUtc('2026-03-08').toISOString()).toBe('2026-03-08T05:00:00.000Z'); // still EST at 00:00
    expect(torontoMidnightUtc('2026-03-09').toISOString()).toBe('2026-03-09T04:00:00.000Z');
    expect(torontoMidnightUtc('2026-11-01').toISOString()).toBe('2026-11-01T04:00:00.000Z'); // still EDT at 00:00
    expect(torontoMidnightUtc('2026-11-02').toISOString()).toBe('2026-11-02T05:00:00.000Z');
  });
  it('a 7-day window starts 6 Toronto days back, using the Toronto date not the UTC date', () => {
    // 2026-07-15T02:30Z is still 14 July 22:30 in Toronto.
    expect(windowStart(new Date('2026-07-15T02:30:00Z'), 7).toISOString()).toBe('2026-07-08T04:00:00.000Z');
    expect(windowStart(new Date('2026-07-15T05:00:00Z'), 7).toISOString()).toBe('2026-07-09T04:00:00.000Z');
  });
});

describe('channelOf', () => {
  it('folds free-text labels into a closed set and never returns the raw label', () => {
    expect(channelOf('assistant', false)).toBe('ASSISTANT');
    expect(channelOf('PHOTO_TRIAGE', false)).toBe('PHOTO_TRIAGE');
    expect(channelOf('photo-triage', false)).toBe('PHOTO_TRIAGE');
    expect(channelOf('estimate-form', true)).toBe('FLOOR_STUDIO');
    expect(channelOf('configurator:book', false)).toBe('FLOOR_STUDIO');
    expect(channelOf('realtors', false)).toBe('REFERRAL');
    expect(channelOf('web_scheduler', false)).toBe('BOOKING_PAGE');
    expect(channelOf('hardwood-stairs-toronto', false)).toBe('ESTIMATE_FORM');
    expect(channelOf('jane@example.com', false)).toBe('ESTIMATE_FORM');
    expect(channelOf(null, false)).toBe('UNKNOWN');
    expect(channelOf('   ', false)).toBe('UNKNOWN');
  });
});

describe('rate', () => {
  it('is null (not 0) when the denominator is empty, one decimal otherwise', () => {
    expect(rate(0, 0)).toBeNull();
    expect(rate(0, 5)).toBe(0);
    expect(rate(1, 3)).toBe(33.3);
  });
});

describe('buildFunnelReport', () => {
  it('empty data: zero counts, null rates, first touch not recorded', () => {
    const r = buildFunnelReport(base([]));
    expect(r.period.firstTouch).toEqual({ count: null, note: 'not recorded' });
    expect(r.period.stages.every((s) => s.count === 0)).toBe(true);
    expect(r.cohort.rows).toHaveLength(1);
    expect(Object.values(r.cohort.rows[0]!.stepRates).every((v) => v === null)).toBe(true);
    expect(r.quoteRecovery.rates).toEqual({ confirmed: null, sent: null, converted: null });
    expect(r.assistant.handoffRate).toBeNull();
  });

  it('follows leads through stages by quote id, then to deposit by project id, per channel', () => {
    const ledger: LedgerRow[] = [
      // A: estimate form -> appointment -> issued -> accepted -> deposit
      row({ stage: 'LEAD_CAPTURED', source: 'pricing', quoteId: 'A' }),
      row({ stage: 'APPOINTMENT_BOOKED', source: 'pricing', quoteId: 'A' }),
      row({ stage: 'QUOTE_ISSUED', quoteId: 'A' }),
      row({ stage: 'QUOTE_ACCEPTED', quoteId: 'A', projectId: 'P1' }),
      row({ stage: 'DEPOSIT_PAID', projectId: 'P1' }),
      // B: assistant lead + appointment only
      row({ stage: 'LEAD_CAPTURED', source: 'assistant', quoteId: 'B' }),
      row({ stage: 'APPOINTMENT_BOOKED', source: 'assistant', quoteId: 'B' }),
      // C: assistant lead, nothing else
      row({ stage: 'LEAD_CAPTURED', source: 'assistant', quoteId: 'C' }),
      // D: studio lead that was quoted by phone (no appointment)
      row({ stage: 'LEAD_CAPTURED', source: 'estimate-form', hasDesign: true, quoteId: 'D' }),
      row({ stage: 'QUOTE_ISSUED', quoteId: 'D' }),
      // E: duplicate lead row for A must not double count
      row({ stage: 'LEAD_CAPTURED', source: 'pricing', quoteId: 'A' }),
      // F: lead with no quote id cannot be followed
      row({ stage: 'LEAD_CAPTURED', source: 'photo-triage' }),
    ];
    const r = buildFunnelReport(base(ledger, { quoteRequestsCreated: 6, appointmentsCreated: 2 }));

    expect(r.period.stages.map((s) => s.count)).toEqual([6, 2, 2, 1, 1, 0]);

    const all = r.cohort.rows.find((x) => x.channel === 'ALL')!;
    expect(all.counts).toEqual({
      LEAD_CAPTURED: 5, APPOINTMENT_BOOKED: 3, QUOTE_ISSUED: 2, QUOTE_ACCEPTED: 1, DEPOSIT_PAID: 1, JOB_COMPLETED: 0,
    });
    // D reached "issued" without an appointment, so it counts as at-or-beyond appointment: 3 = A, B, D.
    expect(all.stepRates.APPOINTMENT_BOOKED).toBe(60);
    expect(all.stepRates.JOB_COMPLETED).toBe(0);
    expect(all.unlinkedLeads).toBe(1);

    const assistant = r.cohort.rows.find((x) => x.channel === 'ASSISTANT')!;
    expect(assistant.counts.LEAD_CAPTURED).toBe(2);
    expect(assistant.counts.APPOINTMENT_BOOKED).toBe(1);
    expect(assistant.stepRates.APPOINTMENT_BOOKED).toBe(50);
    expect(assistant.stepRates.QUOTE_ISSUED).toBe(0);
    expect(assistant.stepRates.QUOTE_ACCEPTED).toBeNull(); // nobody reached the previous stage

    expect(r.cohort.rows.find((x) => x.channel === 'FLOOR_STUDIO')!.counts.LEAD_CAPTURED).toBe(1);
    expect(r.cohort.rows.find((x) => x.channel === 'PHOTO_TRIAGE')!.unlinkedLeads).toBe(1);
    expect(r.cohort.rows.find((x) => x.channel === 'REFERRAL')).toBeUndefined();

    expect(r.reconciliation).toEqual({
      quoteRequests: { databaseRows: 6, ledgerLeads: 5 },
      appointments: { databaseRows: 2, ledgerAppointments: 2 },
    });
  });

  it('deposit without an accepted row in this window is not attributed to a lead', () => {
    const r = buildFunnelReport(base([
      row({ stage: 'LEAD_CAPTURED', source: 'x', quoteId: 'A' }),
      row({ stage: 'DEPOSIT_PAID', projectId: 'P9' }),
    ]));
    const all = r.cohort.rows[0]!;
    expect(all.counts.DEPOSIT_PAID).toBe(0);
    expect(r.period.stages.find((s) => s.stage === 'DEPOSIT_PAID')!.count).toBe(1);
  });

  it('quote recovery and assistant figures are counts with honest rates', () => {
    const r = buildFunnelReport(base([], {
      recovery: { requested: 10, confirmed: 4, sent: 2, converted: 1 },
      assistant: { conversationsCreated: 8, withLeadHandoff: 2 },
    }));
    expect(r.quoteRecovery.rates).toEqual({ confirmed: 40, sent: 50, converted: 50 });
    expect(r.assistant.handoffRate).toBe(25);
  });
});
