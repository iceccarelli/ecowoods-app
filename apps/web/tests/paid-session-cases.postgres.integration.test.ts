/**
 * A paid Checkout Session that cannot be applied must never be only a log line.
 * Real PostgreSQL: the three outcomes the previous cycle left silent
 * (unknown credit pack, undecodable floor-plan design, a session that names no
 * order or invoice) each open exactly one durable PaymentCase, whatever the
 * delivery pattern (replay, concurrency, the reconcile sweeps), and nothing is
 * granted, delivered, refunded or adjusted automatically. Stripe's network edge
 * and the mail/PDF transports are faked. Runs only with RUN_POSTGRES_INTEGRATION=1.
 */
import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === '1';

const edge = vi.hoisted(() => ({ listed: [] as unknown[], mail: [] as { to: string; idempotencyKey?: string }[] }));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: {
      sessions: {
        list: () => ({
          async *[Symbol.asyncIterator]() {
            for (const s of edge.listed) yield s;
          },
        }),
      },
    },
  },
}));
vi.mock('@/lib/email', () => ({
  sendEmail: async (m: { to: string; idempotencyKey?: string }) => {
    edge.mail.push(m);
  },
}));
vi.mock('@/lib/floor-plan/store', () => ({ storeFloorPlanSpec: async () => 'https://blob.test/fp.pdf' }));

describe.skipIf(!enabled)('paid sessions that cannot be applied open a case (real PostgreSQL)', () => {
  const userIds: string[] = [];
  const piIds: string[] = [];

  beforeEach(() => {
    edge.listed = [];
    edge.mail = [];
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    if (!enabled) return;
    const { db } = await import('@/lib/db');
    await db.paymentCase.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { stripePaymentIntentId: { in: piIds } }] } }).catch(() => undefined);
    for (const id of userIds) {
      await db.creditTransaction.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await db.creditWallet.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await db.order.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await db.user.delete({ where: { id } }).catch(() => undefined);
    }
  });

  async function setup(opts: { notes: string; total?: number; createdMsAgo?: number }) {
    const { db } = await import('@/lib/db');
    const user = await db.user.create({ data: { email: `psc-${randomUUID()}@example.test` } });
    userIds.push(user.id);
    const total = opts.total ?? 19;
    const sessionId = `cs_test_${randomUUID()}`;
    const pi = `pi_${randomUUID()}`;
    piIds.push(pi);
    const order = await db.order.create({
      data: { userId: user.id, subtotal: total, total, notes: opts.notes, stripeCheckoutSessionId: sessionId },
    });
    const session = (patch: Partial<Stripe.Checkout.Session> = {}) =>
      ({
        id: sessionId,
        object: 'checkout.session',
        payment_status: 'paid',
        status: 'complete',
        currency: 'cad',
        amount_total: Math.round(total * 100),
        payment_intent: pi,
        created: Math.floor((Date.now() - (opts.createdMsAgo ?? 3_600_000)) / 1000),
        metadata: { orderId: order.id, userId: user.id },
        ...patch,
      }) as unknown as Stripe.Checkout.Session;
    return { db, user, order, session, pi, sessionId };
  }

  const casesFor = async (pi: string) => (await import('@/lib/db')).db.paymentCase.findMany({ where: { stripePaymentIntentId: pi } });

  describe('unknown_credit_pack', () => {
    const NOTES = 'Renovation Credits (retired-pack-99)';

    it('opens one UNAPPLIED_PAYMENT case linked to the order and user; nothing is granted', async () => {
      const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
      const { db, user, order, session, pi } = await setup({ notes: NOTES });
      expect(await fulfilCheckoutSession(session())).toEqual({ status: 'rejected', reason: 'unknown_credit_pack' });
      const cases = await casesFor(pi);
      expect(cases).toHaveLength(1);
      expect(cases[0]).toMatchObject({ kind: 'UNAPPLIED_PAYMENT', status: 'OPEN', orderId: order.id, userId: user.id, stripePaymentIntentId: pi });
      expect(cases[0]!.amount.toNumber()).toBe(19);
      expect(cases[0]!.idempotencyKey).toBe(`unapplied:unknown_credit_pack:${pi}`);
      expect(cases[0]!.details).toMatchObject({ reason: 'unknown_credit_pack' });
      expect(await db.creditTransaction.count({ where: { userId: user.id } })).toBe(0);
      expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAID');
    });

    it('replay, concurrent delivery and both sweeps open exactly one case', async () => {
      const { fulfilCheckoutSession, reconcilePendingFulfillments } = await import('@/lib/stripe-fulfillment');
      const { db, order, session, pi } = await setup({ notes: NOTES });
      const ev = session();
      const settled = await Promise.allSettled(Array.from({ length: 8 }, () => fulfilCheckoutSession(ev)));
      expect(settled.filter((s) => s.status === 'rejected')).toHaveLength(0);
      await fulfilCheckoutSession(ev);
      await db.order.update({ where: { id: order.id }, data: { paidAt: new Date(Date.now() - 3_600_000) } });
      edge.listed = [ev];
      await reconcilePendingFulfillments({ olderThanMs: 60_000 });
      await reconcilePendingFulfillments({ olderThanMs: 60_000 });
      expect(await casesFor(pi)).toHaveLength(1);
    });

    it('the credits sweep alone (webhook lost after the claim) still opens the case, once', async () => {
      const { reconcilePendingFulfillments } = await import('@/lib/stripe-fulfillment');
      const { db, order, pi } = await setup({ notes: NOTES });
      await db.order.update({ where: { id: order.id }, data: { status: 'PAID', paidAt: new Date(Date.now() - 3_600_000), stripePaymentIntentId: pi } });
      await reconcilePendingFulfillments({ olderThanMs: 60_000 });
      await reconcilePendingFulfillments({ olderThanMs: 60_000 });
      const cases = await casesFor(pi);
      expect(cases).toHaveLength(1);
      expect(cases[0]).toMatchObject({ kind: 'UNAPPLIED_PAYMENT', orderId: order.id });
    });

    it('is counted in the open-case badge, and resolving it changes nothing else', async () => {
      const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
      const { countOpenPaymentCases, recordCaseResolution } = await import('@/lib/payment-reconciliation');
      const { db, user, order, session, pi } = await setup({ notes: NOTES });
      const before = (await countOpenPaymentCases())!;
      await fulfilCheckoutSession(session());
      expect(await countOpenPaymentCases()).toBe(before + 1);
      const [c] = await casesFor(pi);
      await recordCaseResolution({ caseId: c!.id, adminId: user.id, resolution: 'REFUNDED_MANUALLY', note: 'refunded in the Stripe dashboard' });
      expect(await countOpenPaymentCases()).toBe(before);
      expect(await db.creditTransaction.count({ where: { userId: user.id } })).toBe(0);
      expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAID');
      await fulfilCheckoutSession(session()); // a later replay does not reopen a resolved case
      expect(await casesFor(pi)).toHaveLength(1);
      expect((await casesFor(pi))[0]!.status).toBe('RESOLVED');
    });

    it('when the pack is restored the sweep fulfils the order once; the open case then resolves without a second grant', async () => {
      const { fulfilCheckoutSession, reconcilePendingFulfillments } = await import('@/lib/stripe-fulfillment');
      const { recordCaseResolution } = await import('@/lib/payment-reconciliation');
      const { CREDIT_PACK } = await import('@/lib/assistant-workspace/credits-config');
      const { db, user, order, session, pi } = await setup({ notes: NOTES });
      await fulfilCheckoutSession(session());
      expect(await db.creditTransaction.count({ where: { userId: user.id } })).toBe(0);
      // Fix: the order's pack now exists in the catalogue (modelled by correcting the order's pack id).
      await db.order.update({ where: { id: order.id }, data: { notes: `Renovation Credits (${CREDIT_PACK.id})`, paidAt: new Date(Date.now() - 3_600_000) } });
      await reconcilePendingFulfillments({ olderThanMs: 60_000 });
      await reconcilePendingFulfillments({ olderThanMs: 60_000 });
      expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('FULFILLED');
      expect((await db.creditWallet.findUniqueOrThrow({ where: { userId: user.id } })).balance).toBe(CREDIT_PACK.credits);
      const [c] = await casesFor(pi);
      expect(c!.status).toBe('OPEN');
      await recordCaseResolution({ caseId: c!.id, adminId: user.id, resolution: 'NO_ACTION_REQUIRED', note: 'pack restored; fulfilled by sweep' });
      await fulfilCheckoutSession(session());
      expect(await db.creditTransaction.count({ where: { userId: user.id, type: 'GRANT' } })).toBe(1);
      expect((await db.creditWallet.findUniqueOrThrow({ where: { userId: user.id } })).balance).toBe(CREDIT_PACK.credits);
      expect(await casesFor(pi)).toHaveLength(1);
    });
  });

  describe('bad_design (paid floor plan)', () => {
    const BAD = 'Personal Floor Plan\nFP_DESIGN:not-a-valid-design-code';

    it('opens one case linked to the order and user; nothing is delivered', async () => {
      const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
      const { user, order, session, pi } = await setup({ notes: BAD, total: 111.87 });
      expect(await fulfilCheckoutSession(session())).toEqual({ status: 'rejected', reason: 'bad_design' });
      const cases = await casesFor(pi);
      expect(cases).toHaveLength(1);
      expect(cases[0]).toMatchObject({ kind: 'UNAPPLIED_PAYMENT', status: 'OPEN', orderId: order.id, userId: user.id });
      expect(cases[0]!.amount.toNumber()).toBe(111.87);
      expect(cases[0]!.idempotencyKey).toBe(`unapplied:bad_design:${pi}`);
      expect(edge.mail).toHaveLength(0);
    });

    it('replay, concurrent delivery and the sweeps open exactly one case', async () => {
      const { fulfilCheckoutSession, reconcilePendingFulfillments } = await import('@/lib/stripe-fulfillment');
      const { db, order, session, pi } = await setup({ notes: BAD, total: 111.87 });
      const ev = session();
      const settled = await Promise.allSettled(Array.from({ length: 8 }, () => fulfilCheckoutSession(ev)));
      expect(settled.filter((s) => s.status === 'rejected')).toHaveLength(0);
      await db.order.update({ where: { id: order.id }, data: { paidAt: new Date(Date.now() - 3_600_000) } });
      edge.listed = [ev];
      await reconcilePendingFulfillments({ olderThanMs: 60_000 });
      await reconcilePendingFulfillments({ olderThanMs: 60_000 });
      expect(await casesFor(pi)).toHaveLength(1);
      expect(edge.mail).toHaveLength(0);
    });

    it('the floor-plan sweep alone (webhook lost after the claim) still opens the case, once', async () => {
      const { reconcilePendingFulfillments } = await import('@/lib/stripe-fulfillment');
      const { db, order, pi } = await setup({ notes: BAD, total: 111.87 });
      await db.order.update({ where: { id: order.id }, data: { status: 'PAID', paidAt: new Date(Date.now() - 3_600_000), stripePaymentIntentId: pi } });
      await reconcilePendingFulfillments({ olderThanMs: 60_000 });
      await reconcilePendingFulfillments({ olderThanMs: 60_000 });
      expect(await casesFor(pi)).toHaveLength(1);
    });
  });

  describe('bad_design repaired later', () => {
    it('once the design is repaired the sweep delivers exactly once; the open case stays for a person and resolving it does nothing further', async () => {
      const { reconcilePendingFulfillments } = await import('@/lib/stripe-fulfillment');
      const { recordCaseResolution } = await import('@/lib/payment-reconciliation');
      const { DEFAULT_CONFIGURATION } = await import('@/lib/floor-studio/catalog');
      const { encodeStudioDesign } = await import('@/lib/floor-studio/studio-config');
      const { db, user, order, pi } = await setup({ notes: 'Personal Floor Plan\nFP_DESIGN:not-a-valid-design-code', total: 111.87 });
      await db.order.update({ where: { id: order.id }, data: { status: 'PAID', paidAt: new Date(Date.now() - 3_600_000), stripePaymentIntentId: pi } });
      await reconcilePendingFulfillments({ olderThanMs: 60_000 });
      expect(await casesFor(pi)).toHaveLength(1);
      const good = encodeStudioDesign({ config: DEFAULT_CONFIGURATION, squareFeet: 900, feels: [], country: 'CA', savedAt: new Date().toISOString() });
      await db.order.update({ where: { id: order.id }, data: { notes: `Personal Floor Plan\nFP_DESIGN:${good}` } });
      await reconcilePendingFulfillments({ olderThanMs: 60_000 });
      await reconcilePendingFulfillments({ olderThanMs: 60_000 });
      expect(edge.mail).toHaveLength(1);
      expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).notes).toContain('FP_NOTIFIED:');
      const [c] = await casesFor(pi);
      expect(c!.status).toBe('OPEN');
      await recordCaseResolution({ caseId: c!.id, adminId: user.id, resolution: 'NO_ACTION_REQUIRED', note: 'design repaired; delivered by sweep' });
      await reconcilePendingFulfillments({ olderThanMs: 60_000 });
      expect(edge.mail).toHaveLength(1);
      expect(await casesFor(pi)).toHaveLength(1);
    });
  });

  describe('no_reference', () => {
    it('a paid session that names no order/invoice but is marked as one of our products opens one unlinked case', async () => {
      const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
      const { db } = await import('@/lib/db');
      const pi = `pi_${randomUUID()}`;
      piIds.push(pi);
      const ev = { id: `cs_test_${randomUUID()}`, payment_status: 'paid', currency: 'cad', amount_total: 11187, payment_intent: pi, metadata: { kind: 'floor-plan' } } as unknown as Stripe.Checkout.Session;
      const settled = await Promise.allSettled(Array.from({ length: 5 }, () => fulfilCheckoutSession(ev)));
      expect(settled.map((s) => (s.status === 'fulfilled' ? s.value : s.reason))).toEqual(Array(5).fill({ status: 'rejected', reason: 'no_reference' }));
      const cases = await db.paymentCase.findMany({ where: { stripePaymentIntentId: pi } });
      expect(cases).toHaveLength(1);
      expect(cases[0]).toMatchObject({ kind: 'UNAPPLIED_PAYMENT', status: 'OPEN', orderId: null, invoiceId: null, userId: null });
      expect(cases[0]!.idempotencyKey).toBe(`unapplied:no_reference:${pi}`);
    });

    it('a paid session with no reference and no marker of ours stays a log line (could be another product on the account)', async () => {
      const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
      const { db } = await import('@/lib/db');
      const pi = `pi_${randomUUID()}`;
      piIds.push(pi);
      for (const metadata of [{}, { kind: 'someone-elses-product' }, { userId: randomUUID() }]) {
        const ev = { id: `cs_test_${randomUUID()}`, payment_status: 'paid', currency: 'cad', amount_total: 5000, payment_intent: pi, metadata } as unknown as Stripe.Checkout.Session;
        expect(await fulfilCheckoutSession(ev)).toEqual({ status: 'rejected', reason: 'no_reference' });
      }
      expect(await db.paymentCase.count({ where: { stripePaymentIntentId: pi } })).toBe(0);
    });

    it('an unpaid session never opens a case, and a non-uuid userId in the metadata cannot break case creation', async () => {
      const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
      const { db } = await import('@/lib/db');
      const pi = `pi_${randomUUID()}`;
      piIds.push(pi);
      const base = { id: `cs_test_${randomUUID()}`, currency: 'cad', amount_total: 5000, payment_intent: pi, metadata: { kind: 'floor-plan', userId: 'not-a-uuid' } };
      expect(await fulfilCheckoutSession({ ...base, payment_status: 'unpaid' } as unknown as Stripe.Checkout.Session)).toEqual({ status: 'ignored', reason: 'not_paid' });
      expect(await db.paymentCase.count({ where: { stripePaymentIntentId: pi } })).toBe(0);
      expect(await fulfilCheckoutSession({ ...base, payment_status: 'paid' } as unknown as Stripe.Checkout.Session)).toEqual({ status: 'rejected', reason: 'no_reference' });
      expect(await db.paymentCase.count({ where: { stripePaymentIntentId: pi } })).toBe(1);
    });
  });
});
