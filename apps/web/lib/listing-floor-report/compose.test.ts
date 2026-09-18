import { describe, expect, it } from 'vitest';
import { compose } from './compose';
import type { ComposeInput } from './types';

// Fixed "now" well before any fixture photography date, so the schedule
// feasibility check does not depend on when this test happens to run.
const FAR_PAST = new Date('2026-01-01T00:00:00Z');

function baseInput(overrides: Partial<ComposeInput> = {}): ComposeInput {
  return {
    orderId: 'order-1',
    sku: 'photo',
    photographyDate: '2026-09-16',
    asOf: FAR_PAST,
    recommendation: 'recoat_ok',
    findings: { finishWear: 'verified', woodDamage: 'not_specified', moisture: 'verified' },
    present: 'Even wear across the field, worn traffic lane by the entry, no visible board damage.',
    missing: 'Cannot tell from photos whether the finish is polyurethane or a hardwax-oil.',
    ...overrides,
  };
}

describe('compose', () => {
  it('produces a report with a Screen & Recoat band and a feasible schedule when photography is far enough out', () => {
    const result = compose(baseInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.report.band).toMatch(/\$2\.50.*\$4\.00/);
      expect(result.report.schedule.feasible).toBe(true);
    }
  });

  it('forces moisture to inspection_needed on the photo SKU regardless of what was submitted — a JPEG cannot measure moisture', () => {
    const result = compose(baseInput({ findings: { finishWear: 'verified', woodDamage: 'not_specified', moisture: 'verified' } }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.report.findings.moisture).toBe('inspection_needed');
  });

  it('respects the estimator-entered moisture finding on the onsite SKU, since that follows an actual visit', () => {
    const result = compose(baseInput({ sku: 'onsite', findings: { finishWear: 'verified', woodDamage: 'not_specified', moisture: 'unclear' } }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.report.findings.moisture).toBe('unclear');
  });

  it('prints the Full Sand & Finish band and no recoat calendar when sand is required', () => {
    const result = compose(baseInput({ recommendation: 'sand_required', missing: 'Board damage through the finish in two rooms.' }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.report.band).toMatch(/\$4\.75.*\$7\.50/);
      expect(result.report.schedule).toEqual({ feasible: false, reason: 'sand_required' });
    }
  });

  it('prints no band and no schedule for leave_it', () => {
    const result = compose(baseInput({ recommendation: 'leave_it', missing: 'No work indicated ahead of listing.' }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.report.band).toBeUndefined();
      expect(result.report.schedule).toEqual({ feasible: false, reason: 'leave_it' });
    }
  });

  it('rejects a dollar figure in free text rather than publishing it', () => {
    const result = compose(baseInput({ missing: 'A recoat here would run about $2,000 before listing.' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/dollar|percentage/i);
  });

  it('rejects a sale-price / market claim', () => {
    const result = compose(baseInput({ present: 'This recoat will add real value and beats any other offer on the street.' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/sale-price|market claim/i);
  });

  it('rejects a named brokerage or company', () => {
    const result = compose(baseInput({ missing: 'Referred by Maple Realty Inc. for a listing next month.' }));
    expect(result.ok).toBe(false);
  });

  it('rejects a bad photography date', () => {
    const result = compose(baseInput({ photographyDate: 'next Tuesday' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/ISO date/);
  });

  it('carries free-standing questions from askInWriting, one per line', () => {
    const result = compose(baseInput({ askInWriting: 'Was underlayment used?\nWhat finish system is on it now?' }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.report.askInWriting).toEqual(['Was underlayment used?', 'What finish system is on it now?']);
  });
});
