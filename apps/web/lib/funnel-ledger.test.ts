/**
 * funnel-ledger.test.ts — MEAS-02.
 *
 * Two kinds of test here, and the second kind is the one that will matter in
 * six months.
 *
 * The first is ordinary unit work on the sanitisers and the arithmetic.
 *
 * The second reads the six source files that are supposed to record a stage
 * and asserts the call is still there. Instrumentation is the code most likely
 * to be deleted by accident during an unrelated refactor, and its absence is
 * invisible: nothing throws, nothing turns red, the funnel simply reports a
 * stage that stopped happening. A test that opens the file is the only thing
 * that catches that.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  conversionRate,
  FUNNEL_ORDER,
  sanitiseAmount,
  sanitiseSource,
  type FunnelStage,
  type StageCount,
} from './funnel-ledger';

const WEB = join(process.cwd(), process.cwd().endsWith('apps/web') ? '.' : 'apps/web');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const stage = (s: FunnelStage, total: number, attributed = 0, valueCad = 0): StageCount => ({
  stage: s,
  total,
  attributed,
  valueCad,
});

describe('the order is defined exactly once', () => {
  it('is the six commercial stages, in the order they happen', () => {
    expect(FUNNEL_ORDER).toEqual([
      'LEAD_CAPTURED',
      'APPOINTMENT_BOOKED',
      'QUOTE_ISSUED',
      'QUOTE_ACCEPTED',
      'DEPOSIT_PAID',
      'JOB_COMPLETED',
    ]);
  });

  it('has no duplicates — a repeated stage reports conversion against itself', () => {
    expect(new Set(FUNNEL_ORDER).size).toBe(FUNNEL_ORDER.length);
  });

  it('matches the enum in the Prisma schema', () => {
    const schema = read('prisma/schema.prisma');
    const block = schema.slice(schema.indexOf('enum FunnelStage'));
    for (const s of FUNNEL_ORDER) expect(block).toContain(s);
  });
});

describe('amounts — the silent poisoning case', () => {
  it('refuses NaN and Infinity rather than writing them to a Decimal column', () => {
    /* A single NaN row makes every SUM run over this table NaN afterwards, and
       it does it without an error. That is how a revenue figure goes wrong for
       a quarter before anybody checks it. */
    expect(sanitiseAmount(NaN)).toBeNull();
    expect(sanitiseAmount(Infinity)).toBeNull();
    expect(sanitiseAmount(-Infinity)).toBeNull();
    expect(sanitiseAmount(undefined)).toBeNull();
    expect(sanitiseAmount(null)).toBeNull();
    expect(sanitiseAmount('not a number')).toBeNull();
  });

  it('rounds to cents, because a Decimal(12,2) column will round anyway', () => {
    expect(sanitiseAmount(1234.567)).toBe(1234.57);
    expect(sanitiseAmount(0.005)).toBe(0.01);
    expect(sanitiseAmount('4200.5')).toBe(4200.5);
  });

  it('keeps a legitimate zero, which is not the same as absent', () => {
    expect(sanitiseAmount(0)).toBe(0);
  });

  it('keeps a negative, because a refund is a real event', () => {
    expect(sanitiseAmount(-500)).toBe(-500);
  });
});

describe('source labels', () => {
  it('trims, bounds to the column width, and treats blank as absent', () => {
    expect(sanitiseSource('  floor-studio  ')).toBe('floor-studio');
    expect(sanitiseSource('   ')).toBeNull();
    expect(sanitiseSource('')).toBeNull();
    expect(sanitiseSource('x'.repeat(500))).toHaveLength(120);
  });

  it('ignores non-strings rather than coercing them', () => {
    expect(sanitiseSource(42)).toBeNull();
    expect(sanitiseSource(null)).toBeNull();
    expect(sanitiseSource({})).toBeNull();
  });
});

describe('conversion between stages', () => {
  it('is null when the earlier stage is empty, never 0%', () => {
    /* "0%" reads as a business that is failing. An absent rate reads as a
       business that has not started. Somebody acts on the first one. */
    expect(conversionRate(stage('LEAD_CAPTURED', 0), stage('APPOINTMENT_BOOKED', 0))).toBeNull();
    expect(conversionRate(stage('LEAD_CAPTURED', 0), stage('APPOINTMENT_BOOKED', 5))).toBeNull();
  });

  it('is a percentage to one decimal place', () => {
    expect(conversionRate(stage('LEAD_CAPTURED', 200), stage('APPOINTMENT_BOOKED', 50))).toBe(25);
    expect(conversionRate(stage('LEAD_CAPTURED', 3), stage('APPOINTMENT_BOOKED', 1))).toBe(33.3);
  });

  it('does not clamp above 100 — a rate over 100 is a real signal, not a display bug', () => {
    expect(conversionRate(stage('QUOTE_ISSUED', 10), stage('QUOTE_ACCEPTED', 12))).toBe(120);
  });
});

describe('the six instrumentation points still exist', () => {
  const sites: [string, FunnelStage][] = [
    ['app/api/leads/route.ts', 'LEAD_CAPTURED'],
    ['app/api/appointments/route.ts', 'APPOINTMENT_BOOKED'],
    ['lib/actions/quotes.ts', 'QUOTE_ISSUED'],
    ['lib/actions/quotes.ts', 'QUOTE_ACCEPTED'],
    ['app/api/webhooks/stripe/route.ts', 'DEPOSIT_PAID'],
    ['lib/actions/projects.ts', 'JOB_COMPLETED'],
  ];

  it('each file records its stage', () => {
    for (const [file, want] of sites) {
      const src = read(file);
      expect(src, `${file} must import the ledger`).toContain('recordFunnelEvent');
      expect(src, `${file} must record ${want}`).toContain(`stage: '${want}'`);
    }
  });

  it('none of them awaits the ledger — recording must not block commerce', () => {
    /* `await recordFunnelEvent` in the Stripe handler would turn a failed
        analytics insert into a non-2xx response, which makes Stripe retry a
        webhook against an invoice already marked PAID. */
    for (const [file] of sites) {
      expect(read(file), `${file} must not await the ledger`).not.toContain(
        'await recordFunnelEvent',
      );
    }
  });

  it('the deposit stage is guarded to the DEPOSIT invoice only', () => {
    /* Counting progress and final invoices as deposits reports a conversion
       rate above 100% for every job that invoices in thirds. */
    const src = read('app/api/webhooks/stripe/route.ts');
    expect(src).toContain("invoice.stage === 'DEPOSIT'");
  });

  it('the ledger holds no personal data', () => {
    const schema = read('prisma/schema.prisma');
    const block = schema.slice(schema.indexOf('model FunnelEvent'));
    const table = block.slice(0, block.indexOf('\n}'));
    for (const forbidden of ['email', 'phone', 'name', 'address', 'ip']) {
      expect(table.toLowerCase(), `FunnelEvent must not carry ${forbidden}`).not.toContain(
        `${forbidden} `,
      );
    }
  });
});
