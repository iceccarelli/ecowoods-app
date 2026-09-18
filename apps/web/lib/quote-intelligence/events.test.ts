import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildEventLine, recordQuoteReviewEvent } from './events';

const AT = new Date('2026-09-17T10:00:00.000Z');

describe('buildEventLine', () => {
  it('is one JSON line with the event, a timestamp and the allowed fields', () => {
    const line = buildEventLine('well_installed_review.report_published', { orderId: 'o1', tier: 'rush', quoteCount: 3, highRiskFlags: 2, comparisonVerdict: 'not-comparable', alreadyPublished: false }, AT);
    expect(JSON.parse(line)).toEqual({
      event: 'well_installed_review.report_published',
      at: '2026-09-17T10:00:00.000Z',
      orderId: 'o1',
      tier: 'rush',
      quoteCount: 3,
      highRiskFlags: 2,
      comparisonVerdict: 'not-comparable',
      alreadyPublished: false,
    });
  });

  it('drops anything that could carry customer or document content, even if a caller passes it', () => {
    const smuggled = { orderId: 'o1', email: 'jane@example.com', name: 'Jane', excerpt: 'Acme Flooring Inc. $8,400', filename: 'quote.pdf' };
    const line = buildEventLine('well_installed_review.documents_received', smuggled as never, AT);
    expect(line).not.toMatch(/jane|Acme|8,400|quote\.pdf/);
    expect(Object.keys(JSON.parse(line)).sort()).toEqual(['at', 'event', 'orderId']);
  });

  it('drops undefined and non-finite numbers', () => {
    const parsed = JSON.parse(buildEventLine('well_installed_review.checkout_created', { orderId: 'o1', subtotalCad: Number.NaN, tier: undefined }, AT));
    expect(parsed).toEqual({ event: 'well_installed_review.checkout_created', at: AT.toISOString(), orderId: 'o1' });
  });
});

describe('recordQuoteReviewEvent', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs the line', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    recordQuoteReviewEvent('well_installed_review.report_viewed', { orderId: 'o1' });
    expect(JSON.parse(spy.mock.calls[0][0] as string)).toMatchObject({ event: 'well_installed_review.report_viewed', orderId: 'o1' });
  });

  it('never throws, even when logging does', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {
      throw new Error('drain down');
    });
    expect(() => recordQuoteReviewEvent('well_installed_review.report_viewed', { orderId: 'o1' })).not.toThrow();
  });
});
