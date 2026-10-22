import { describe, expect, it } from 'vitest';
import { renderOrderConfirmation } from './order-confirmation';

const money = (n: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n);

const base = {
  orderId: '12345678-aaaa-bbbb-cccc-1234567890ab',
  notes: null,
  items: [{ productName: 'Floor <script>alert(1)</script> & oil', quantity: 2, lineTotal: 40 }],
  total: 45.2,
  paidAt: new Date('2026-10-22T15:00:00Z'),
  customerName: '"><img src=x>',
};

describe('renderOrderConfirmation', () => {
  it('states the reference, items, amount, currency, date and the canonical order link, and escapes every typed value', () => {
    const { subject, html, text } = renderOrderConfirmation(base);
    expect(subject).toBe('Payment received - order #12345678');
    expect(text).toContain('Order reference: #12345678');
    expect(text).toContain(money(45.2));
    expect(text).toContain('CAD');
    expect(text).toContain('October 22, 2026');
    expect(text).toMatch(/https?:\/\/[^\s/]+\/mypage\/orders/);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&times; 2');
  });

  it('names the product when an order has no line items', () => {
    expect(renderOrderConfirmation({ ...base, items: [], notes: 'Well-Installed Quote Review (Rush)' }).text).toContain(`Well-Installed Quote Review: ${money(45.2)}`);
    expect(renderOrderConfirmation({ ...base, items: [], notes: 'Listing Floor Report (photo)' }).text).toContain('Pre-List Floor Condition Report');
  });
});
