/**
 * Stripe Webhook Handler
 * POST /api/webhooks/stripe
 *
 * Handles:
 *   · checkout.session.completed — marks invoice as PAID, creates Payment record
 *   · payment_intent.payment_failed — (logged for debugging)
 *
 * IMPORTANT: This route must NOT use body parsing — Stripe requires the raw
 * request body to verify the webhook signature.
 *
 * 웹훅: Stripe 결제 완료 시 인보이스 상태를 자동으로 PAID로 업데이트
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/db';
import Stripe from 'stripe';
import { recordFunnelEvent } from '@/lib/funnel-ledger';
import { grantCredits } from '@/lib/assistant-workspace/credit-ledger';

export const runtime = 'nodejs';

// Stripe requires the raw body — disable Next.js body parsing
export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[stripe webhook] STRIPE_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe webhook] signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  // ── Handle events ──────────────────────────────────────────────────────────
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const invoiceId = session.metadata?.invoiceId;
        const orderId = session.metadata?.orderId;
        const userId = session.metadata?.userId;

        if (orderId) {
          const order = await db.order.findUnique({ where: { id: orderId } });
          if (!order) {
            console.warn(`[stripe webhook] order ${orderId} not found`);
            break;
          }

          if (order.status === 'PAID' || order.status === 'FULFILLED') {
            console.log(`[stripe webhook] order ${orderId} already paid — skipping`);
            break;
          }

          await db.order.update({
            where: { id: orderId },
            data: {
              status: 'PAID',
              paidAt: new Date(),
              stripePaymentIntentId:
                typeof session.payment_intent === 'string'
                  ? session.payment_intent
                  : (session.payment_intent?.id ?? null),
            },
          });

          console.log(`[stripe webhook] order ${orderId} marked PAID`);

          /*
           * Renovation Credits purchase (Ask Francisco Phase 3 —
           * app/api/assistant/credits/checkout/route.ts). Stripe is the
           * source of truth for whether money actually moved; the browser
           * redirect back to /assistant is never trusted for that (directive
           * rule 16). Idempotency here is TWO layers deep on purpose: the
           * `order.status === 'PAID'` guard above already short-circuits a
           * webhook retry for this exact order, and grantCredits' own
           * idempotencyKey (derived from orderId, not a random value) means
           * even a code path that reached this block twice — a race between
           * two webhook deliveries neither of which had yet flipped
           * order.status when the other read it — still can't double-grant,
           * because the credit ledger's unique constraint is the actual
           * enforcement, not this guard.
           */
          if (session.metadata?.kind === 'renovation_credits' && userId) {
            const credits = Number(session.metadata.credits ?? 0);
            if (credits > 0) {
              const grant = await grantCredits({
                userId,
                amount: credits,
                type: 'PURCHASE',
                reason: 'credit_pack_purchase',
                orderId,
                idempotencyKey: `order:${orderId}:grant`,
              });
              if (grant.ok) {
                console.log(
                  `[stripe webhook] order ${orderId} granted ${credits} renovation credits${grant.duplicate ? ' (duplicate delivery, no-op)' : ''}`,
                );
              } else {
                console.error(`[stripe webhook] order ${orderId} credit grant failed`, grant.error);
              }
            }
          }
          break;
        }

        if (!invoiceId) {
          console.warn('[stripe webhook] checkout.session.completed missing invoiceId/orderId');
          break;
        }

        const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice) {
          console.warn(`[stripe webhook] invoice ${invoiceId} not found`);
          break;
        }

        if (invoice.status === 'PAID') {
          console.log(`[stripe webhook] invoice ${invoiceId} already paid — skipping`);
          break;
        }

        // Mark invoice as PAID
        await db.invoice.update({
          where: { id: invoiceId },
          data: {
            status: 'PAID',
            paidAt: new Date(),
          },
        });

        // Create Payment record
        await db.payment.create({
          data: {
            invoiceId,
            userId: userId ?? null,
            amount: (session.amount_total ?? 0) / 100, // cents → CAD
            method: 'STRIPE',
            status: 'COMPLETED',
            stripeCharged: true,
            stripePaymentIntentId: typeof session.payment_intent === 'string'
              ? session.payment_intent
              : (session.payment_intent?.id ?? null),
          },
        });

        /* MEAS-02 — the brief's `deposit` event, and the one the success test
           is built on.

           Only the DEPOSIT stage counts here. A progress or final invoice is
           real revenue but it is not the moment a customer committed, and
           counting all three would report a conversion rate above 100% for
           every job that invoices in thirds.

           The `already paid` guard above is what makes this idempotent:
           Stripe retries webhooks, and without that early break a single
           deposit would land in this ledger once per retry. Not awaited — a
           throw here would return non-2xx to Stripe and trigger exactly those
           retries, against an invoice this handler has already marked PAID.

           The design id is read from the project rather than carried in the
           Stripe payload, because Stripe metadata is not a place to keep a
           field whose correctness this business depends on. */
        if (invoice.stage === 'DEPOSIT') {
          const project = invoice.projectId
            ? await db.project.findUnique({
                where: { id: invoice.projectId },
                select: { designId: true },
              })
            : null;
          void recordFunnelEvent({
            stage: 'DEPOSIT_PAID',
            designId: project?.designId ?? null,
            projectId: invoice.projectId ?? null,
            amountCad: (session.amount_total ?? 0) / 100,
          });
        }

        console.log(`[stripe webhook] invoice ${invoiceId} marked PAID`);
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        console.warn(`[stripe webhook] payment failed: ${pi.id}`, pi.last_payment_error?.message);
        break;
      }

      default:
        // Unhandled events are safe to ignore
        break;
    }
  } catch (err) {
    console.error('[stripe webhook] handler error:', err);
    // Return 200 anyway — Stripe will retry on non-2xx responses
    // and we don't want infinite retries for bugs in our code
  }

  return NextResponse.json({ received: true });
}
