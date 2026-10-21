/**
 * Stripe Webhook Handler
 * POST /api/webhooks/stripe
 *
 * Handles:
 *   · checkout.session.completed — see lib/stripe-fulfillment.ts (verify, mark PAID, fulfil)
 *   · payment_intent.payment_failed — (logged for debugging)
 *   · charge.refunded, refund.updated, charge.dispute.created — see
 *     lib/payment-reconciliation.ts (recorded durably; credits never touched)
 *   · anything else — acknowledged (200) and logged as unhandled
 *
 * IMPORTANT: This route must NOT use body parsing — Stripe requires the raw
 * request body to verify the webhook signature.
 *
 * 웹훅: Stripe 결제 완료 시 인보이스 상태를 자동으로 PAID로 업데이트
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';
import { fulfilCheckoutSession } from '@/lib/stripe-fulfillment';
import { handleChargeRefunded, handleDisputeCreated, handleRefundUpdated } from '@/lib/payment-reconciliation';

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
  // Acknowledge (2xx) only when the event was handled to a terminal state:
  // fulfilled, deliberately ignored, or permanently rejected (logged loudly by
  // lib/stripe-fulfillment.ts — redelivery cannot change those). Any thrown
  // error is transient (database, ledger) and answers 5xx so Stripe redelivers;
  // that is safe because every step of fulfilment is idempotent.
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        await fulfilCheckoutSession(event.data.object as Stripe.Checkout.Session);
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        console.warn(`[stripe webhook] payment failed: ${pi.id}`, pi.last_payment_error?.message);
        break;
      }

      case 'charge.refunded':
        await handleChargeRefunded(event);
        break;

      case 'refund.updated':
        await handleRefundUpdated(event);
        break;

      case 'charge.dispute.created':
        await handleDisputeCreated(event);
        break;

      default:
        // Unknown types are acknowledged (redelivery cannot help) but never silent.
        console.warn(JSON.stringify({ event: 'stripe_webhook.unhandled_event', stripeEventId: event.id, type: event.type }));
        break;
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        event: 'stripe_webhook.retry_requested',
        stripeEventId: event.id,
        type: event.type,
        error: err instanceof Error ? err.message : 'unknown',
      }),
    );
    return NextResponse.json({ error: 'Temporary failure — please redeliver.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
