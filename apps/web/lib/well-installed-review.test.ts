import { describe, expect, it } from 'vitest';
import { buildReviewOrderItem, checkSubmissionEligibility, resolveReviewTier } from './well-installed-review';
import { REVIEW_TIERS } from '@/content/constants/paid-review-product';

describe('resolveReviewTier', () => {
  it('resolves a known tier id', () => {
    expect(resolveReviewTier('rush').id).toBe('rush');
  });

  it('falls back to the standard tier for anything unrecognized — this is what a customer is actually charged', () => {
    expect(resolveReviewTier('deluxe').id).toBe('standard');
    expect(resolveReviewTier(undefined).id).toBe('standard');
    expect(resolveReviewTier(null).id).toBe('standard');
  });
});

describe('buildReviewOrderItem', () => {
  it('prices the line item from the tier config, never from caller input', () => {
    const item = buildReviewOrderItem(REVIEW_TIERS[1]);
    expect(item.unitPrice).toBe(249);
    expect(item.lineTotal).toBe(249);
    expect(item.productName).toContain('Rush');
  });
});

describe('checkSubmissionEligibility', () => {
  const base = { status: 'PAID' as const, userEmail: 'Jane@Example.com', notes: 'Well-Installed Quote Review (Standard)' };

  it('rejects a missing order', () => {
    expect(checkSubmissionEligibility(null, 'jane@example.com')).toEqual({ ok: false, reason: 'not_found' });
  });

  it.each([
    ['listing report', 'Listing Floor Report (photo)'],
    ['floor plan', 'Personal Floor Plan\nFP_DESIGN:abc'],
    ['renovation credits', 'Renovation Credits (starter-40)'],
    ['shop order', 'Shop order'],
    ['product name only mentioned later', 'Listing Floor Report (photo)\nWell-Installed Quote Review (Standard)'],
    ['unknown tier', 'Well-Installed Quote Review (Platinum)'],
    ['no notes', null],
  ])('rejects a PAID %s order as the wrong product, before status or email', (_n, notes) => {
    expect(checkSubmissionEligibility({ ...base, notes }, 'jane@example.com')).toEqual({ ok: false, reason: 'wrong_product' });
  });

  it('accepts both real tiers', () => {
    for (const notes of ['Well-Installed Quote Review (Standard)', 'Well-Installed Quote Review (Rush)']) {
      expect(checkSubmissionEligibility({ ...base, notes }, 'jane@example.com')).toEqual({ ok: true });
    }
  });

  it('rejects an unpaid order', () => {
    expect(checkSubmissionEligibility({ ...base, status: 'PENDING' }, 'jane@example.com')).toEqual({
      ok: false,
      reason: 'unpaid',
    });
  });

  it('rejects a second submission against an already-fulfilled order', () => {
    expect(checkSubmissionEligibility({ ...base, status: 'FULFILLED' }, 'jane@example.com')).toEqual({
      ok: false,
      reason: 'already_submitted',
    });
  });

  it('rejects an email that does not match the paying customer, case-insensitively', () => {
    expect(checkSubmissionEligibility(base, 'someone-else@example.com')).toEqual({
      ok: false,
      reason: 'email_mismatch',
    });
  });

  it('accepts a matching email regardless of case or surrounding whitespace', () => {
    expect(checkSubmissionEligibility(base, '  jane@example.com  ')).toEqual({ ok: true });
  });
});
