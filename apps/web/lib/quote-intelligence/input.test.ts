import { describe, expect, it } from 'vitest';
import { parseComposeBody } from './input';
import { compose } from './compose';

const ORDER = '00000000-0000-4000-8000-000000000001';

describe('parseComposeBody', () => {
  it('accepts a workbench body and drops nothing the estimator typed', () => {
    const r = parseComposeBody({
      orderId: ORDER,
      quotes: [{ label: 'Quote A', statedTotal: 8400, statedAreaSqFt: '700', criteria: { '1.1': { status: 'verified', evidence: { page: 2, excerpt: 'Moisture read on site' } } }, scope: {} }],
      present: 'p',
      missing: 'm',
      riskNotes: 'r',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.body.orderId).toBe(ORDER);
    expect(r.body.fields.quotes[0]).toMatchObject({ label: 'Quote A', statedTotal: 8400, statedAreaSqFt: 700 });
    expect(r.body.fields.quotes[0].criteria['1.1']).toEqual({ status: 'verified', evidence: { page: 2, excerpt: 'Moisture read on site' } });
    expect(r.body.fields.riskNotes).toBe('r');
  });

  it('never takes tier from the body', () => {
    const r = parseComposeBody({ orderId: ORDER, tier: 'Rush', quotes: [] });
    expect(r.ok && 'tier' in r.body.fields).toBe(false);
  });

  it('treats blank numeric inputs as not entered', () => {
    const r = parseComposeBody({ orderId: ORDER, quotes: [{ label: 'A', statedTotal: '', statedAreaSqFt: null }] });
    expect(r.ok && r.body.fields.quotes[0].statedTotal).toBeUndefined();
  });

  it.each([
    ['missing orderId', { quotes: [] }],
    ['non-uuid orderId', { orderId: 'abc' }],
    ['non-string label', { orderId: ORDER, quotes: [{ label: 7 }] }],
    ['non-array quotes', { orderId: ORDER, quotes: 'Quote A' }],
    ['object evidence excerpt', { orderId: ORDER, quotes: [{ label: 'A', scope: { x: { status: 'verified', evidence: { excerpt: {} } } } }] }],
    ['not an object', 'hello'],
    ['null', null],
  ])('rejects %s with a 400-able message instead of throwing later', (_name, body) => {
    const r = parseComposeBody(body);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/^Malformed request/);
  });

  it('leaves the rules to compose(): an unknown status parses, then compose() rejects it in words', () => {
    const r = parseComposeBody({ orderId: ORDER, quotes: [{ label: 'A', criteria: { '1.1': { status: 'probably' } } }], present: 'p', missing: 'm' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const c = compose({ ...r.body.fields, orderId: ORDER, tier: 'Standard' });
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.errors.join(' ')).toMatch(/not assessed/);
  });
});
