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
        row({ id: 'published', notes: 'Well-Installed Quote Review (Standard)\nQI_REPORT:https://x.test/a.pdf' }),
        row({ id: 'no-docs-yet', status: 'PAID' }),
        row({ id: 'pending', status: 'PENDING' }),
        row({ id: 'shop', notes: 'Shop order' }),
        row({ id: 'ancient', updatedAt: ago(31 * 24) }),
        row({ id: 'future', updatedAt: ago(-5) }),
      ],
      NOW,
    );
    expect(items).toEqual([]);
  });
  it('flags a photo listing report with intake and no report after 48 h, not onsite, not published, not without intake', () => {
    const lfr = (extra: string) => `Listing Floor Report (${extra})`;
    const items = findOverdueOrders(
      [
        row({ id: 'photo-late', status: 'PAID', notes: `${lfr('photo')}\nLFR_INTAKE:received`, updatedAt: ago(49) }),
        row({ id: 'photo-early', status: 'PAID', notes: `${lfr('photo')}\nLFR_INTAKE:received`, updatedAt: ago(47) }),
        row({ id: 'photo-no-intake', status: 'PAID', notes: lfr('photo'), updatedAt: ago(90) }),
        row({ id: 'onsite', status: 'PAID', notes: `${lfr('onsite')}\nLFR_INTAKE:received`, updatedAt: ago(90) }),
        row({ id: 'published', status: 'FULFILLED', notes: `${lfr('photo')}\nLFR_INTAKE:received\nLFR_REPORT:https://x.test/a.pdf`, updatedAt: ago(90) }),
      ],
      NOW,
    );
    expect(items.map((i) => i.orderId)).toEqual(['photo-late']);
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
