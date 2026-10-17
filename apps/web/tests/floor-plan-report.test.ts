/**
 * Personal Floor Plan generation and lookup: concurrent first views converge on
 * one stored report, a storage failure is reported (not thrown), and the public
 * report lookups are rate limited. Faked edges: Prisma (one in-memory order) and
 * PDF storage; the design decode, spec build and routes are real.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIGURATION } from '@/lib/floor-studio/catalog';
import { encodeStudioDesign } from '@/lib/floor-studio/studio-config';

type Order = { id: string; status: string; notes: string | null; user: { email: string } };
const state = vi.hoisted(() => ({
  order: null as null | { id: string; status: string; notes: string | null; user: { email: string } },
  stored: 0,
  failStore: false,
  gate: null as null | Promise<void>,
}));

vi.mock('@/lib/db', () => ({
  db: {
    order: {
      findUnique: async () => (state.order ? { ...state.order } : null),
      updateMany: async ({ where, data }: { where: { notes?: string | null }; data: Partial<Order> }) => {
        const o = state.order;
        if (!o || (where.notes !== undefined && o.notes !== where.notes)) return { count: 0 };
        Object.assign(o, data);
        return { count: 1 };
      },
    },
  },
}));
vi.mock('@/lib/floor-plan/store', () => ({
  storeFloorPlanSpec: async () => {
    if (state.gate) await state.gate;
    if (state.failStore) throw new Error('blob down');
    return `https://blob.test/fp-${++state.stored}.pdf`;
  },
}));

const { ensureFloorPlanReport } = await import('@/lib/floor-plan/generate');
const fpReport = await import('@/app/api/floor-plan/report/route');
const lfrReport = await import('@/app/api/listing-floor-report/report/route');

const ID = '22222222-2222-4222-8222-222222222222';
const code = encodeStudioDesign({ config: DEFAULT_CONFIGURATION, squareFeet: 900, feels: [], country: 'CA', savedAt: new Date().toISOString() });

beforeEach(() => {
  state.order = { id: ID, status: 'PAID', notes: `Personal Floor Plan\nFP_DESIGN:${code}`, user: { email: 'jane@example.com' } };
  state.stored = 0;
  state.failStore = false;
  state.gate = null;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ensureFloorPlanReport', () => {
  it('generates once for a paid order, marks it FULFILLED, and reuses the URL', async () => {
    expect(await ensureFloorPlanReport(ID)).toEqual({ ok: true, url: 'https://blob.test/fp-1.pdf' });
    expect(state.order!.status).toBe('FULFILLED');
    expect(await ensureFloorPlanReport(ID)).toEqual({ ok: true, url: 'https://blob.test/fp-1.pdf' });
    expect(state.stored).toBe(1);
  });

  it('simultaneous first views all receive the one URL that was persisted', async () => {
    let open!: () => void;
    state.gate = new Promise<void>((r) => (open = r));
    const runs = Promise.all(Array.from({ length: 5 }, () => ensureFloorPlanReport(ID)));
    await new Promise((r) => setTimeout(r, 20));
    open();
    const results = await runs;
    const urls = new Set(results.map((r) => (r.ok ? r.url : 'fail')));
    expect(urls.size).toBe(1);
    expect(state.order!.notes).toContain(`FP_REPORT:${[...urls][0]}`);
    expect(state.order!.notes!.match(/FP_REPORT:/g)).toHaveLength(1);
    expect(await ensureFloorPlanReport(ID)).toEqual({ ok: true, url: [...urls][0] });
  });

  it('reports a storage failure instead of throwing, leaves the order retryable, and succeeds on retry', async () => {
    state.failStore = true;
    expect(await ensureFloorPlanReport(ID)).toEqual({ ok: false, reason: 'storage_failed' });
    expect(state.order!.status).toBe('PAID');
    expect(state.order!.notes).not.toContain('FP_REPORT:');
    state.failStore = false;
    expect((await ensureFloorPlanReport(ID)).ok).toBe(true);
  });

  it('refuses an unpaid order and a corrupt design without storing anything', async () => {
    state.order!.status = 'PENDING';
    expect(await ensureFloorPlanReport(ID)).toEqual({ ok: false, reason: 'not_paid' });
    state.order!.status = 'PAID';
    state.order!.notes = 'Personal Floor Plan\\nFP_DESIGN:garbage';
    expect(await ensureFloorPlanReport(ID)).toEqual({ ok: false, reason: 'bad_design' });
    state.order!.notes = 'Shop order\\nPersonal Floor Plan\\nFP_DESIGN:' + code;
    expect(await ensureFloorPlanReport(ID)).toEqual({ ok: false, reason: 'not_found' });
    expect(state.stored).toBe(0);
  });
});

describe('public report lookups', () => {
  const get = (route: { GET: (r: Request) => Promise<Response> }, path: string, ip: string, email = 'jane@example.com') =>
    route.GET(new Request(`http://localhost${path}?order=${ID}&email=${encodeURIComponent(email)}`, { headers: { 'x-forwarded-for': ip } }));

  it('floor-plan: wrong email is 403, storage failure is 503, and the 21st request in a minute is 429', async () => {
    expect((await get(fpReport, '/api/floor-plan/report', '203.0.113.50', 'x@else.com')).status).toBe(403);
    state.failStore = true;
    expect((await get(fpReport, '/api/floor-plan/report', '203.0.113.50')).status).toBe(503);
    state.failStore = false;
    expect(await (await get(fpReport, '/api/floor-plan/report', '203.0.113.50')).json()).toEqual({ published: true, url: 'https://blob.test/fp-1.pdf' });
    let last = 200;
    for (let i = 0; i < 25; i++) last = (await get(fpReport, '/api/floor-plan/report', '203.0.113.50')).status;
    expect(last).toBe(429);
    expect((await get(fpReport, '/api/floor-plan/report', '203.0.113.51')).status).toBe(200);
  });

  it('listing-floor-report: guessing is bounded per IP too', async () => {
    state.order!.notes = 'Listing Floor Report (photo)';
    expect((await get(lfrReport, '/api/listing-floor-report/report', '203.0.113.60', 'x@else.com')).status).toBe(403);
    let last = 0;
    for (let i = 0; i < 25; i++) last = (await get(lfrReport, '/api/listing-floor-report/report', '203.0.113.60', 'x@else.com')).status;
    expect(last).toBe(429);
  });
});
