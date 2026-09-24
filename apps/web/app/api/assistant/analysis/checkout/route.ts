/**
 * POST /api/assistant/analysis/checkout — buy Renovation Credits.
 *
 * Auth required (this is not a guest checkout like listing-floor-report's —
 * a homeowner must already be able to return to this purchase). Follows the
 * SAME shape as every other one-time-purchase checkout on this site
 * (app/api/listing-floor-report/checkout, app/api/well-installed-review/checkout):
 * a PENDING Order + OrderItem, a real Stripe Checkout Session with
 * metadata.orderId, and the EXISTING /api/webhooks/stripe route marks it
 * PAID — no second Stripe client, no second webhook, no second Order model.
 * `metadata.kind = 'renovation-credits'` is the one addition that tells that
 * unmodified webhook to also grant credits (see its `renovation-credits`
 * branch).
 *
 * Price and credit amount are read from CREDIT_PACK on the SERVER — the
 * client never supplies a price or a credit count, and nothing here trusts
 * one if it did.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { checkRateLimit, getClientIp, isTrustedBrowserOrigin, LEAD_POST_LIMIT } from '@/lib/rate-limit';
import { CREDIT_PACK } from '@/lib/assistant-workspace/credits-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  // Where to return the homeowner to once Checkout completes — always
  // /assistant itself; accepted from the client only so a future entry
  // point (e.g. a saved-analysis page) can send someone back to itself.
  returnPath: z.string().max(200).startsWith('/').optional(),
});

export async function POST(req: Request) {
  if (!isTrustedBrowserOrigin(req)) {
    return NextResponse.json({ error: 'Origin not allowed.' }, { status: 403 });
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Sign in to buy Renovation Credits.' }, { status: 401 });
  }

  const rl = checkRateLimit(getClientIp(req), LEAD_POST_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Please wait a moment before trying again.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const returnPath = parsed.data.returnPath ?? '/assistant';

  const settings = await db.settings.findFirst();
  const taxRate = Number(settings?.defaultTaxRate ?? 13);
  const subtotal = CREDIT_PACK.priceCad;
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  const order = await db.order.create({
    data: {
      userId,
      status: 'PENDING',
      subtotal,
      taxRate,
      total,
      notes: `Renovation Credits (${CREDIT_PACK.id})`,
      items: {
        create: [
          {
            productName: `${CREDIT_PACK.label} — ${CREDIT_PACK.credits} credits`,
            unit: 'EACH',
            quantity: 1,
            unitPrice: subtotal,
            lineTotal: subtotal,
          },
        ],
      },
    },
  });

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'cad',
            product_data: {
              name: `${CREDIT_PACK.credits} Renovation Credits`,
              description: 'Spend on a Renovation Decision Analysis inside Ask Francisco.',
            },
            unit_amount: Math.round(subtotal * 100),
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: 'cad',
            product_data: { name: `Ontario HST (${taxRate}%)` },
            unit_amount: Math.round(taxAmount * 100),
          },
          quantity: 1,
        },
      ],
      customer_email: session.user.email ?? undefined,
      metadata: {
        orderId: order.id,
        userId,
        kind: 'renovation-credits',
        pack: CREDIT_PACK.id,
        credits: String(CREDIT_PACK.credits),
      },
      success_url: `${origin}${returnPath}?credits_purchase=success&order=${order.id}`,
      cancel_url: `${origin}${returnPath}?credits_purchase=cancelled`,
      payment_method_types: ['card'],
    });

    await db.order.update({ where: { id: order.id }, data: { stripeCheckoutSessionId: checkoutSession.id } });

    console.log(
      JSON.stringify({ event: 'renovation_credits.checkout_created', orderId: order.id, userId, pack: CREDIT_PACK.id }),
    );
    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error('[renovation-credits checkout] Stripe session creation failed:', err);
    return NextResponse.json({ error: 'Payment initialization failed. Please try again.' }, { status: 500 });
  }
}
