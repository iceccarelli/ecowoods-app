import { describe, expect, it } from 'vitest';
import { appendReportMarker, buildCheckoutNotes, extractDesignCode, extractReportUrl, isFloorPlanOrder } from './notes';

describe('buildCheckoutNotes / extractDesignCode / isFloorPlanOrder', () => {
  it('round-trips the design code checkout wrote', () => {
    const notes = buildCheckoutNotes('c=white-oak.satin.herringbone.5&a=900');
    expect(isFloorPlanOrder(notes)).toBe(true);
    expect(extractDesignCode(notes)).toBe('c=white-oak.satin.herringbone.5&a=900');
  });

  it('rejects null, unrelated, and other products\' notes, so this page never operates on the wrong Order', () => {
    expect(isFloorPlanOrder(null)).toBe(false);
    expect(isFloorPlanOrder('Well-Installed Quote Review (Standard)')).toBe(false);
    expect(isFloorPlanOrder('Listing Floor Report (photo)')).toBe(false);
    expect(extractDesignCode('Well-Installed Quote Review (Standard)')).toBeNull();
  });
});

describe('appendReportMarker / extractReportUrl', () => {
  it('appends the marker without disturbing the design-code line', () => {
    const base = buildCheckoutNotes('c=white-oak.satin.herringbone.5&a=900');
    const notes = appendReportMarker(base, 'https://blob/plan.pdf');
    expect(extractDesignCode(notes)).toBe('c=white-oak.satin.herringbone.5&a=900');
    expect(extractReportUrl(notes)).toBe('https://blob/plan.pdf');
  });

  it('is idempotent — a second append does not duplicate or overwrite the first URL', () => {
    const base = buildCheckoutNotes('c=white-oak.satin.herringbone.5&a=900');
    const once = appendReportMarker(base, 'https://blob/plan-v1.pdf');
    const twice = appendReportMarker(once, 'https://blob/plan-v2.pdf');
    expect(twice).toBe(once);
    expect(extractReportUrl(twice)).toBe('https://blob/plan-v1.pdf');
  });

  it('returns null when no report has been generated yet', () => {
    expect(extractReportUrl(buildCheckoutNotes('c=white-oak.satin.herringbone.5&a=900'))).toBeNull();
    expect(extractReportUrl(null)).toBeNull();
  });
});
