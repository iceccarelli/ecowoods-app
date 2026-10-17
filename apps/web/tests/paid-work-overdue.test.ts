import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findOverdueOrders, type OverdueOrderRow } from '@/lib/paid-work-overdue';

const state = vi.hoisted(() => ({ rows: [] as unknown[], emails: [] as Array<{ to: string; subject: string; text: string }>, failEmail: false, failQuery: false }));
vi.mock('@/lib/db', () => ({
  db: { order: { findMany: async () => { if (state.failQuery) throw new Error('db down'); return state.rows; } } },
}));
vi.mock('@/lib/email', () => ({
  sendEmail: async (m: { to: string; subject: string; text: string }) => {
    if (state.failEmail) throw new Error('smtp down');
    state.emails.push(m);
  },
}));
const route = await import('@/app/api/cron/paid-work-overdue/route');

const NOW = new Date('2026-10-17T12:00:00Z');
const ago = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const row = (o: Partial<OverdueOrderRow> & { id: string }): OverdueOrderRow => ({ status: 'FULFILLED', notes: 'Well-Installed Quote Review (Standard)', updatedAt: ago(30), ...o });

describe('findOverdueOrders', () => {
  it('flags a documents-received review with no report once its tier threshold passes', () => {
    const items = findOverdueOrders(
      [row({ id: 'std-late', updatedAt: ago(25) }), row({ id: 'std-ok', updatedAt: ago(23) }), row({ id: 'rush-late', notes: 'Well-Installed Quote Review (Rush)', updatedAt: ago(9) }), row({ id: 'rush-ok', notes: 'Well-Installed Quote Review (Rush)', updatedAt: ago(7) })],
      NOW,
    );
    expect(items.map((i) => i.orderId)).toEqual(['std-late', 'rush-late']); // oldest wait first
  });
  it('ignores published reviews, unpaid or not-yet-submitted ones, other products, and anything older than 30 days', () => {
    const items = findOverdueOrders(
      [
        row({ id: 'published', notes: 'Well-Installed Quote Review (Standard)\nQI_REPORT:https://x.test/a.pdf\nREPORT_NOTIFIED:1792238400000' }),
        row({ id: 'no-docs-yet', status: 'PAID', updatedAt: ago(47) }),
        row({ id: 'pending', status: 'PENDING' }),
        row({ id: 'shop', notes: 'Shop order' }),
        row({ id: 'ancient', updatedAt: ago(31 * 24) }),
        row({ id: 'future', updatedAt: ago(-5) }),
      ],
      NOW,
    );
    expect(items).toEqual([]);
  });
  it('flags stored reports with an unconfirmed customer email after four hours, until notification is recorded', () => {
    const items = findOverdueOrders(
      [
        row({ id: 'qi-notify-late', notes: 'Well-Installed Quote Review (Standard)\nQI_REPORT:https://x.test/qi.pdf', updatedAt: ago(5) }),
        row({ id: 'qi-notify-early', notes: 'Well-Installed Quote Review (Standard)\nQI_REPORT:https://x.test/qi-early.pdf', updatedAt: ago(3) }),
        row({ id: 'qi-notified', notes: 'Well-Installed Quote Review (Standard)\nQI_REPORT:https://x.test/qi-sent.pdf\nREPORT_NOTIFIED:1792238400000', updatedAt: ago(5) }),
        row({ id: 'lfr-notify-late', status: 'FULFILLED', notes: 'Listing Floor Report (photo)\nLFR_INTAKE:received\nLFR_REPORT:https://x.test/lfr.pdf', updatedAt: ago(5) }),
        row({ id: 'lfr-notified', status: 'FULFILLED', notes: 'Listing Floor Report (photo)\nLFR_INTAKE:received\nLFR_REPORT:https://x.test/lfr-sent.pdf\nREPORT_NOTIFIED:1792238400000', updatedAt: ago(5) }),
      ],
      NOW,
    );
    expect(items.map((i) => i.orderId).sort()).toEqual(['lfr-notify-late', 'qi-notify-late']);
    expect(items.every((item) => item.detail.includes('notification not confirmed'))).toBe(true);
  });
  it('flags a photo listing report with intake and no report after 48 h, not onsite, not published, not without intake', () => {
    const lfr = (extra: string) => `Listing Floor Report (${extra})`;
    const items = findOverdueOrders(
      [
        row({ id: 'photo-late', status: 'PAID', notes: `${lfr('photo')}\nLFR_INTAKE:received`, updatedAt: ago(49) }),
        row({ id: 'photo-early', status: 'PAID', notes: `${lfr('photo')}\nLFR_INTAKE:received`, updatedAt: ago(47) }),
        row({ id: 'onsite', status: 'PAID', notes: `${lfr('onsite')}\nLFR_INTAKE:received`, updatedAt: ago(90) }),
        row({ id: 'published', status: 'FULFILLED', notes: `${lfr('photo')}\nLFR_INTAKE:received\nLFR_REPORT:https://x.test/a.pdf\nREPORT_NOTIFIED:1792238400000`, updatedAt: ago(90) }),
      ],
      NOW,
    );
    expect(items.map((i) => i.orderId)).toEqual(['photo-late']);
  });
});

describe('paid but never submitted intake', () => {
  const lfr = (sku: string, extra = '') => `Listing Floor Report (${sku})${extra}`;
  it('flags a PAID order with no intake after 48 h for both products, whatever the tier or SKU', () => {
    const items = findOverdueOrders(
      [
        row({ id: 'wir-std', status: 'PAID', updatedAt: ago(49) }),
        row({ id: 'wir-rush', status: 'PAID', notes: 'Well-Installed Quote Review (Rush)', updatedAt: ago(72) }),
        row({ id: 'lfr-photo', status: 'PAID', notes: lfr('photo'), updatedAt: ago(60) }),
        row({ id: 'lfr-onsite', status: 'PAID', notes: lfr('onsite'), updatedAt: ago(50) }),
      ],
      NOW,
    );
    expect(items.map((i) => i.orderId)).toEqual(['wir-rush', 'lfr-photo', 'lfr-onsite', 'wir-std']);
    expect(items.every((i) => /contact the customer/.test(i.detail))).toBe(true);
  });
  it('does not flag them early, unpaid, once intake exists, or past the 30-day horizon', () => {
    const items = findOverdueOrders(
      [
        row({ id: 'early', status: 'PAID', updatedAt: ago(47) }),
        row({ id: 'unpaid', status: 'PENDING', updatedAt: ago(90) }),
        row({ id: 'lfr-intake-onsite', status: 'PAID', notes: lfr('onsite', '\nLFR_INTAKE:received'), updatedAt: ago(90) }),
        row({ id: 'wir-submitted', status: 'FULFILLED', notes: 'Well-Installed Quote Review (Standard)', updatedAt: ago(20) }),
        row({ id: 'ancient', status: 'PAID', updatedAt: ago(31 * 24) }),
      ],
      NOW,
    );
    expect(items).toEqual([]);
  });
  it('the cron emails the digest for an order whose customer never submitted', async () => {
    state.rows = [{ id: 'never-sent', status: 'PAID', notes: 'Well-Installed Quote Review (Standard)', updatedAt: new Date(Date.now() - 60 * 3_600_000) }];
    process.env.CRON_SECRET = 's3cret';
    const res = await route.GET(new Request('http://localhost/api/cron/paid-work-overdue', { headers: { authorization: 'Bearer s3cret' } }));
    expect(await res.json()).toMatchObject({ ok: true, overdue: 1 });
    expect(state.emails[0]!.text).toContain('order never-sent');
    state.rows = [];
  });
});

describe('GET /api/cron/paid-work-overdue', () => {
  const call = (auth?: string) => route.GET(new Request('http://localhost/api/cron/paid-work-overdue', { headers: auth ? { authorization: auth } : {} }));
  beforeEach(() => {
    state.rows = [];
    state.emails.length = 0;
    state.failEmail = state.failQuery = false;
    process.env.CRON_SECRET = 's3cret';
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('401 without the secret, and never reads the database', async () => {
    expect((await call()).status).toBe(401);
    expect((await call('Bearer wrong')).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await call('Bearer undefined')).status).toBe(401);
  });
  it('sends nothing when nothing is overdue', async () => {
    expect(await (await call('Bearer s3cret')).json()).toEqual({ ok: true, scanned: 0, overdue: 0 });
    expect(state.emails).toHaveLength(0);
  });
  it('emails one internal digest listing the overdue orders', async () => {
    state.rows = [{ id: 'o1', status: 'FULFILLED', notes: 'Well-Installed Quote Review (Rush)', updatedAt: new Date(Date.now() - 20 * 3_600_000) }];
    const res = await call('Bearer s3cret');
    expect(await res.json()).toMatchObject({ ok: true, overdue: 1 });
    expect(state.emails).toHaveLength(1);
    expect(state.emails[0]!.text).toContain('order o1');
  });
  it('a failed alert is a 500 (visible in cron history), as is a failed query', async () => {
    state.rows = [{ id: 'o1', status: 'FULFILLED', notes: 'Well-Installed Quote Review (Rush)', updatedAt: new Date(Date.now() - 20 * 3_600_000) }];
    state.failEmail = true;
    expect((await call('Bearer s3cret')).status).toBe(500);
    state.failQuery = true;
    expect((await call('Bearer s3cret')).status).toBe(500);
  });
});
