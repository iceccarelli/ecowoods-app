/**
 * Pre-List Floor Condition Report intake: concurrent submissions and partial
 * failures. Real route handler; faked edges are Prisma (one in-memory order),
 * the email sender and the Floor Graph writes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Order = { id: string; status: string; notes: string | null; user: { email: string } };
const state = vi.hoisted(() => ({
  order: null as null | { id: string; status: string; notes: string | null; user: { email: string } },
  emails: [] as Array<{ html: string; attachments?: unknown[] }>,
  assessments: 0,
  failNextEmail: false,
  failIntakeWrites: 0,
  gate: null as null | Promise<void>,
}));

vi.mock('@/lib/db', () => ({
  db: {
    order: {
      findUnique: async () => (state.order ? { ...state.order } : null),
      updateMany: async ({ where, data }: { where: { status?: string; notes?: string | null }; data: Partial<Order> }) => {
        const o = state.order;
        if (!o || (where.status !== undefined && o.status !== where.status) || (where.notes !== undefined && o.notes !== where.notes)) return { count: 0 };
        if (typeof data.notes === 'string' && data.notes.includes('LFR_INTAKE:received') && state.failIntakeWrites > 0) {
          state.failIntakeWrites--;
          throw new Error('db down');
        }
        Object.assign(o, data);
        return { count: 1 };
      },
    },
  },
}));
vi.mock('@/lib/email', () => ({
  sendEmail: async (m: { html: string; attachments?: unknown[] }) => {
    if (state.gate) await state.gate;
    if (state.failNextEmail) {
      state.failNextEmail = false;
      throw new Error('smtp down');
    }
    state.emails.push(m);
  },
}));
vi.mock('@/lib/floor-graph', () => ({
  recordAssessment: async () => (state.assessments++, { ok: true, value: 'assessment-1' }),
  storeAssessmentPhotos: async (_a: string, _c: string, p: unknown[]) => ({ ok: true, value: p.length }),
}));

const submit = await import('@/app/api/listing-floor-report/submit/route');
const { hasIntakeMarker } = await import('@/lib/listing-floor-report/notes');
const { withIntakeClaim, INTAKE_LEASE_MS } = await import('@/lib/quote-intelligence/notes');

const ID = '11111111-1111-4111-8111-111111111111';
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, ...new Array(52).fill(0)]);
let ip = 0;

function send() {
  const f = new FormData();
  for (const [k, v] of Object.entries({ orderId: ID, email: 'jane@example.com', role: 'agent', address: '12 Example St', city: 'Toronto', photographyDate: '2026-11-01' })) f.set(k, v);
  for (let i = 0; i < 3; i++) f.append('photos', new File([JPEG], `p${i}.jpg`, { type: 'image/jpeg' }));
  return submit.POST(new Request('http://localhost/api/listing-floor-report/submit', { method: 'POST', body: f, headers: { 'x-forwarded-for': `198.51.100.${++ip}` } }));
}

beforeEach(() => {
  state.order = { id: ID, status: 'PAID', notes: 'Listing Floor Report (photo)', user: { email: 'jane@example.com' } };
  state.emails.length = 0;
  state.assessments = 0;
  state.failNextEmail = false;
  state.failIntakeWrites = 0;
  state.gate = null;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('listing-floor-report/submit — concurrency and recovery', () => {
  it('simultaneous valid submissions send one email and record one Floor Graph assessment', async () => {
    let open!: () => void;
    state.gate = new Promise<void>((r) => (open = r));
    const runs = Promise.all(Array.from({ length: 4 }, () => send()));
    await new Promise((r) => setTimeout(r, 30));
    open();
    const statuses = (await runs).map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409]);
    expect(state.emails).toHaveLength(1);
    expect(state.assessments).toBe(1);
    expect(hasIntakeMarker(state.order!.notes)).toBe(true);
    expect(state.order!.notes).not.toMatch(/QI_INTAKE_CLAIM/);
    expect(state.order!.notes).toMatch(/LFR_META:/);
  });

  it('a failed email releases the claim and the customer can resubmit', async () => {
    state.failNextEmail = true;
    expect((await send()).status).toBe(500);
    expect(state.order!.notes).toBe('Listing Floor Report (photo)');
    expect((await send()).status).toBe(201);
    expect(state.emails).toHaveLength(1);
  });

  it('email sent but recording the intake fails: customer is told received, no second email while the lease holds', async () => {
    state.failIntakeWrites = 3;
    expect((await send()).status).toBe(201);
    expect(state.emails).toHaveLength(1);
    expect(hasIntakeMarker(state.order!.notes)).toBe(false);
    expect((await send()).status).toBe(409);
    expect(state.emails).toHaveLength(1);
  });

  it('a crashed submitter frees the order only after its lease expires', async () => {
    state.order!.notes = withIntakeClaim(state.order!.notes, crypto.randomUUID(), Date.now());
    expect((await send()).status).toBe(409);
    expect(state.emails).toHaveLength(0);
    state.order!.notes = withIntakeClaim(state.order!.notes, crypto.randomUUID(), Date.now() - INTAKE_LEASE_MS - 1);
    expect((await send()).status).toBe(201);
  });

  it('the email carries a submission id so a duplicate is recognisable', async () => {
    await send();
    expect(state.emails[0]!.html).toMatch(/Submission<\/td><td[^>]*><strong>[0-9a-f-]{36}</);
  });
});
