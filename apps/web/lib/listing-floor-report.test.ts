import { describe, expect, it } from 'vitest';
import { buildListingReportOrderItem, checkListingReportSubmissionEligibility, resolveListingReportSku } from './listing-floor-report';
import { LISTING_REPORT_SKUS } from '@/content/constants/listing-floor-report-product';

describe('resolveListingReportSku', () => {
  it('resolves a known sku id', () => {
    expect(resolveListingReportSku('onsite').id).toBe('onsite');
  });

  it('falls back to the photo sku for anything unrecognized — this is what a customer is actually charged', () => {
    expect(resolveListingReportSku('deluxe').id).toBe('photo');
    expect(resolveListingReportSku(undefined).id).toBe('photo');
    expect(resolveListingReportSku(null).id).toBe('photo');
  });
});

describe('buildListingReportOrderItem', () => {
  it('prices the line item from the sku config, never from caller input', () => {
    const item = buildListingReportOrderItem(LISTING_REPORT_SKUS[1]);
    expect(item.unitPrice).toBe(799);
    expect(item.lineTotal).toBe(799);
    expect(item.productName).toContain('Onsite');
  });
});

describe('checkListingReportSubmissionEligibility', () => {
  const base = { status: 'PAID', userEmail: 'Agent@Example.com', alreadySubmitted: false };

  it('rejects a missing order', () => {
    expect(checkListingReportSubmissionEligibility(null, 'agent@example.com')).toEqual({ ok: false, reason: 'not_found' });
  });

  it('rejects an unpaid order', () => {
    expect(checkListingReportSubmissionEligibility({ ...base, status: 'PENDING' }, 'agent@example.com')).toEqual({
      ok: false,
      reason: 'unpaid',
    });
  });

  it('rejects a second submission against an order already marked FULFILLED (report published)', () => {
    expect(checkListingReportSubmissionEligibility({ ...base, status: 'FULFILLED' }, 'agent@example.com')).toEqual({
      ok: false,
      reason: 'already_submitted',
    });
  });

  it('rejects a second submission even while the order still sits at PAID, once the intake marker is set', () => {
    expect(
      checkListingReportSubmissionEligibility({ ...base, status: 'PAID', alreadySubmitted: true }, 'agent@example.com'),
    ).toEqual({ ok: false, reason: 'already_submitted' });
  });

  it('rejects an email that does not match the paying customer, case-insensitively', () => {
    expect(checkListingReportSubmissionEligibility(base, 'someone-else@example.com')).toEqual({
      ok: false,
      reason: 'email_mismatch',
    });
  });

  it('accepts a matching email regardless of case', () => {
    expect(checkListingReportSubmissionEligibility(base, 'agent@example.com')).toEqual({ ok: true });
  });
});
