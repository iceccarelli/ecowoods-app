import { describe, expect, it } from 'vitest';
import {
  appendIntakeMarker,
  appendListingReportMarker,
  appendMetaMarker,
  extractListingReportSku,
  extractListingReportUrl,
  extractMeta,
  hasIntakeMarker,
  isListingFloorReportOrder,
  type ListingMeta,
} from './notes';

describe('appendListingReportMarker / extractListingReportUrl', () => {
  it('appends the marker without disturbing the existing sku line', () => {
    const notes = appendListingReportMarker('Listing Floor Report (onsite)', 'https://blob/report.pdf');
    expect(notes).toContain('Listing Floor Report (onsite)');
    expect(extractListingReportUrl(notes)).toBe('https://blob/report.pdf');
  });

  it('never collides with the QI_REPORT marker used by EW-0002', () => {
    const notes = appendListingReportMarker('Listing Floor Report (photo)', 'https://blob/lfr.pdf');
    expect(notes).not.toContain('QI_REPORT:');
  });

  it('returns null when no report has been published yet', () => {
    expect(extractListingReportUrl('Listing Floor Report (photo)')).toBeNull();
    expect(extractListingReportUrl(null)).toBeNull();
  });
});

describe('extractListingReportSku', () => {
  it('reads onsite from the sku line', () => {
    expect(extractListingReportSku('Listing Floor Report (onsite)')).toBe('onsite');
  });

  it('defaults to photo for anything else, including no notes', () => {
    expect(extractListingReportSku('Listing Floor Report (photo)')).toBe('photo');
    expect(extractListingReportSku(null)).toBe('photo');
    expect(extractListingReportSku('unrelated note')).toBe('photo');
  });
});

describe('appendIntakeMarker / hasIntakeMarker', () => {
  it('marks an order as submitted independent of Order.status', () => {
    const notes = appendIntakeMarker('Listing Floor Report (photo)');
    expect(hasIntakeMarker(notes)).toBe(true);
    expect(hasIntakeMarker('Listing Floor Report (photo)')).toBe(false);
  });

  it('is idempotent — appending twice does not duplicate the marker', () => {
    const once = appendIntakeMarker('Listing Floor Report (photo)');
    const twice = appendIntakeMarker(once);
    expect(twice).toBe(once);
  });
});

describe('appendMetaMarker / extractMeta', () => {
  const meta: ListingMeta = {
    role: 'agent',
    address: '12 Main St',
    city: 'Toronto',
    photographyDate: '2026-10-01',
  };

  it('round-trips the listing details through Order.notes', () => {
    const notes = appendMetaMarker('Listing Floor Report (photo)', meta);
    expect(extractMeta(notes)).toEqual(meta);
  });

  it('returns null when no meta has been written yet', () => {
    expect(extractMeta('Listing Floor Report (photo)')).toBeNull();
    expect(extractMeta(null)).toBeNull();
  });
});

describe('isListingFloorReportOrder', () => {
  it('recognizes the checkout-written note', () => {
    expect(isListingFloorReportOrder('Listing Floor Report (photo)')).toBe(true);
  });

  it('rejects null, unrelated, and EW-0002 notes, so this desk never operates on the wrong Order', () => {
    expect(isListingFloorReportOrder(null)).toBe(false);
    expect(isListingFloorReportOrder('Well-Installed Quote Review (Standard)')).toBe(false);
  });
});
