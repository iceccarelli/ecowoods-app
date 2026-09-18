import { describe, expect, it } from 'vitest';
import { appendReportMarker, extractReportUrl, extractTierId, isWellInstalledReviewOrder } from './notes';

describe('appendReportMarker / extractReportUrl', () => {
  it('appends the marker without disturbing the existing tier line', () => {
    const notes = appendReportMarker('Well-Installed Quote Review (Rush)', 'https://blob/report.pdf');
    expect(notes).toContain('Well-Installed Quote Review (Rush)');
    expect(extractReportUrl(notes)).toBe('https://blob/report.pdf');
  });

  it('returns null when no report has been published yet', () => {
    expect(extractReportUrl('Well-Installed Quote Review (Standard)')).toBeNull();
    expect(extractReportUrl(null)).toBeNull();
  });
});

describe('extractTierId', () => {
  it('reads rush from the tier line', () => {
    expect(extractTierId('Well-Installed Quote Review (Rush)')).toBe('rush');
  });

  it('defaults to standard for anything else, including no notes', () => {
    expect(extractTierId('Well-Installed Quote Review (Standard)')).toBe('standard');
    expect(extractTierId(null)).toBe('standard');
    expect(extractTierId('unrelated note')).toBe('standard');
  });
});

describe('isWellInstalledReviewOrder', () => {
  it('recognizes the checkout-written note', () => {
    expect(isWellInstalledReviewOrder('Well-Installed Quote Review (Standard)')).toBe(true);
  });

  it('rejects null or unrelated notes, so this desk never operates on the wrong Order', () => {
    expect(isWellInstalledReviewOrder(null)).toBe(false);
    expect(isWellInstalledReviewOrder('Shop order — hardwood samples')).toBe(false);
  });
});
