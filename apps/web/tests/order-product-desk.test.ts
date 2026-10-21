/**
 * Admin order screens link each paid product to the desk where a person works on it.
 * Those desks are per-order pages with no nav entry, so without this the only way
 * in was to type the order id into the URL.
 */
import { describe, expect, it } from 'vitest';
import { describeOrderProduct } from '@/lib/order-product';

describe('describeOrderProduct', () => {
  const id = '11111111-1111-4111-8111-111111111111';

  it('maps every product marker to a label and, where one exists, the desk page', () => {
    expect(describeOrderProduct(id, 'Well-Installed Quote Review (Standard)')).toMatchObject({
      label: 'Well-Installed Quote Review',
      deskHref: `/admin/quote-intelligence/${id}`,
    });
    expect(describeOrderProduct(id, 'Listing Floor Report (photo)')).toMatchObject({
      label: 'Pre-List Floor Condition Report',
      deskHref: `/admin/listing-floor-report/${id}`,
    });
    expect(describeOrderProduct(id, 'Personal Floor Plan\nFP_DESIGN:abc')).toMatchObject({ label: 'Personal Floor Plan', deskHref: null });
    expect(describeOrderProduct(id, 'Renovation Credits (pack)')).toMatchObject({ label: 'Renovation Credits', deskHref: null });
    expect(describeOrderProduct(id, null)).toMatchObject({ label: 'Shop order', deskHref: null });
  });
});
