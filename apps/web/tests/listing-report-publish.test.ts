/**
 * Pre-List Floor Condition Report publish: eligibility, claim, and recovery,
 * through the real route handler and the real compose()/state machine. Faked
 * edges: Prisma (one in-memory Order table), the email sender, auth(), and PDF
 * storage.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Order = { id: string; status: string; notes: string | null; user: { email: string } };

const state = vi.hoisted(() => ({
  order: null as null | { id: string; status: string; notes: string | null; user: { email: string } },
  emails: [] as Array<{ to: string; html: string; idempotencyKey?: string }>,
  stored: 0,
  role: 'ADMIN',
  failNextEmail: false,
  emailGate: null as null | Promise<void>,
  failNotifiedWrites: 0,
}));

vi.mock('@/lib/db', () => ({
  db: {
    order: {
      findUnique: async () => (state.order ? { ...state.order } : null),
      updateMany: async ({ where, data }: { where: { status?: string; notes?: string | null }; data: Partial<Order> }) => {
        const o = state.order;
        if (!o || (where.status !== undefined && o.status !== where.status) || (where.notes !== undefined && o.notes !== where.notes)) return { count: 0 };
        if (typeof data.notes === 'string' && data.notes.includes('REPORT_NOTIFIED:') && state.failNotifiedWrites > 0) {
          state.failNotifiedWrites--;
          throw new Error('db down');
        }
        Object.assign(o, data);
        return { count: 1 };
      },
    },
  },
}));
vi.mock('@/lib/email', () => ({
  sendEmail: async (m: { to: string; html: string; idempotencyKey?: string }) => {
    if (state.emailGate) await state.emailGate;
    if (state.failNextEmail) {
      state.failNextEmail = false;
      throw new Error('provider down');
    }
    state.emails.push(m);
  },
}));
vi.mock('@/lib/auth', () => ({ auth: async () => ({ user: { role: state.role } }) }));
vi.mock('@/lib/listing-floor-report/store', () => ({ storeListingFloorReport: async () => `https://blob.test/lfr-${++state.stored}.pdf` }));

const publish = await import('@/app/api/listing-floor-report/publish/route');
const { appendIntakeMarker, appendMetaMarker } = await import('@/lib/listing-floor-report/notes');
const { withPublishClaim, PUBLISH_LEASE_MS } = await import('@/lib/report-delivery');

const ID = '11111111-1111-4111-8111-111111111111';
const meta = { role: 'agent' as const, address: '12 Example Street', city: 'Toronto', photographyDate: '2026-11-01' };
const withIntake = () => appendIntakeMarker(appendMetaMarker('Listing Floor Report (photo)', meta));

const body = {
  orderId: ID,
  recommendation: 'cannot_determine_from_photos',
  findings: { finishWear: 'not_specified', woodDamage: 'not_specified', moisture: 'inspection_needed' },
  present: 'Photos show the main living area.',
  missing: 'Moisture cannot be read from photos.',
};
const post = (b: unknown = body) =>
  publish.POST(new Request('http://localhost/api/listing-floor-report/publish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }));

beforeEach(() => {
  state.order = { id: ID, status: 'PAID', notes: withIntake(), user: { email: 'agent@example.com' } };
  state.emails.length = 0;
  state.stored = 0;
  state.role = 'ADMIN';
  state.failNextEmail = false;
  state.emailGate = null;
  state.failNotifiedWrites = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('listing-floor-report/publish', () => {
  it('publishes a paid order with intake: PDF stored, FULFILLED, customer emailed with the delivery key', async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://blob.test/lfr-1.pdf', alreadyPublished: false, notified: true });
    expect(state.order!.status).toBe('FULFILLED');
    expect(state.order!.notes).toMatch(/^Listing Floor Report \(photo\)\nLFR_META:.*\nLFR_INTAKE:received\nLFR_REPORT:https:\/\/blob\.test\/lfr-1\.pdf\nREPORT_NOTIFIED:\d+$/);
    expect(state.emails).toHaveLength(1);
    expect(state.emails[0].idempotencyKey).toBe(`report-delivery/${ID}/v1`);
  });

  it.each(['PENDING', 'CANCELLED'])('refuses a %s order: nothing stored or sent', async (status) => {
    state.order!.status = status;
    expect((await post()).status).toBe(409);
    expect(state.stored).toBe(0);
    expect(state.emails).toHaveLength(0);
  });

  it('refuses a paid order with no intake, a non-admin, and another product', async () => {
    state.order!.notes = 'Listing Floor Report (photo)';
    expect((await post()).status).toBe(409);
    state.role = 'CUSTOMER';
    expect((await post()).status).toBe(401);
    state.role = 'ADMIN';
    state.order!.notes = 'Well-Installed Quote Review (Standard)';
    expect((await post()).status).toBe(404);
    expect(state.stored).toBe(0);
    expect(state.emails).toHaveLength(0);
  });

  it('two simultaneous publishes store one PDF and send one email', async () => {
    let open!: () => void;
    state.emailGate = new Promise<void>((r) => (open = r));
    const a = post();
    const b = post();
    await new Promise((r) => setTimeout(r, 30));
    open();
    expect((await Promise.all([a, b])).map((r) => r.status).sort()).toEqual([200, 409]);
    expect(state.stored).toBe(1);
    expect(state.emails).toHaveLength(1);
  });

  it('email failure leaves a visible, retryable state; the retry reuses the stored PDF', async () => {
    state.failNextEmail = true;
    const first = await (await post()).json();
    expect(first).toMatchObject({ url: 'https://blob.test/lfr-1.pdf', notified: false });
    expect(state.order!.status).toBe('FULFILLED');
    expect(state.order!.notes).not.toMatch(/REPORT_NOTIFIED|PUBLISH_CLAIM/);

    const retry = await (await post({ orderId: ID })).json();
    expect(retry).toEqual({ url: 'https://blob.test/lfr-1.pdf', alreadyPublished: true, notified: true });
    expect(state.stored).toBe(1);
    expect(state.emails).toHaveLength(1);
    expect((await (await post({ orderId: ID })).json()).notified).toBe(true);
    expect(state.emails).toHaveLength(1);
  });

  it('provider accepted but recording it failed: the retry re-sends the identical message once, then settles', async () => {
    state.failNotifiedWrites = 3;
    expect(await (await post()).json()).toMatchObject({ notified: true });
    await post({ orderId: ID });
    expect(state.emails).toHaveLength(2);
    expect(state.emails[1]).toEqual(state.emails[0]);
    await post({ orderId: ID });
    expect(state.emails).toHaveLength(2);
    expect(state.stored).toBe(1);
  });

  it('a live claim from a crashed publisher blocks until its lease expires', async () => {
    state.order!.notes = withPublishClaim(state.order!.notes, crypto.randomUUID(), Date.now());
    expect((await post()).status).toBe(409);
    state.order!.notes = withPublishClaim(state.order!.notes, crypto.randomUUID(), Date.now() - PUBLISH_LEASE_MS - 1);
    expect((await post()).status).toBe(200);
    expect(state.stored).toBe(1);
  });
});
