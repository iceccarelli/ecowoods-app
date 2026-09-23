/**
 * POST /api/assistant/credits/checkout — buy the Renovation Credits starter
 * pack (content/constants/renovation-analysis-product.ts's CREDIT_PACKS).
 *
 * Requires a signed-in session (directive rule 11 — a purchase is exactly
 * the moment an anonymous visitor needs an account; free conversation stays
 * anonymous). Follows well-installed-review's checkout pattern: price is
 * ALWAYS resolved server-side from CREDIT_PACKS, never trusted from the
 * client; an Order/OrderItem row is created PENDING; the EXISTING Stripe
 * webhook (app/api/webhooks/stripe/route.ts) marks it PAID from
 * `metadata.orderId` — extended (not duplicated) to also grant credits when
 * `metadata.kind === 'renovation_credits'`. No second webhook handler.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { round2 } from '@/lib/shop';
import { resolveCreditPack } from '@/content/constants/renovation-analysis-product';
import { checkRateLimit, getClientIp, isTrustedBrowserOrigin, LEAD_POST_LIMIT } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const checkoutSchema = z.object({
  packId: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  if (!isTrustedBrowserOrigin(req)) {
    return NextResponse.json({ error: 'Origin not allowed.' }, { status: 403 });
  }

  const rl = checkRateLimit(getClientIp(req), LEAD_POST_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Please wait a moment before trying again.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  const session = await auth().catch(() => null);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in to buy Renovation Credits.', code: 'auth_required' }, { status: 401 });
  }
  const userId = session.user.id;

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Payments are not configured yet.', code: 'pending_key' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  // Server-resolved, never client-trusted (directive rule 40).
  const pack = resolveCreditPack(parsed.data.packId);

  const settings = await db.settings.findFirst();
  const taxRate = Number(settings?.defaultTaxRate ?? 13);
  const subtotal = round2(pack.priceCad);
  const taxAmount = round2(subtotal * (taxRate / 100));
  const total = round2(subtotal + taxAmount);

  const order = await db.order.create({
    data: {
      userId,
      status: 'PENDING',
      subtotal,
      taxRate,
      total,
      notes: `Renovation Credits — ${pack.name} (${pack.credits} credits)`,
      items: {
        create: [
          {
            productName: pack.name,
            unit: 'EACH',
            quantity: 1,
            unitPrice: pack.priceCad,
            selectedOptions: [{ name: 'Credits', choice: String(pack.credits), priceDelta: 0 }],
            lineTotal: pack.priceCad,
          },
        ],
      },
    },
  });

  const origin = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'cad',
            product_data: { name: pack.name, description: `${pack.credits} Renovation Credits` },
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
        kind: 'renovation_credits',
        packId: pack.id,
        credits: String(pack.credits),
      },
      success_url: `${origin}/assistant?credits=purchased&order=${order.id}`,
      cancel_url: `${origin}/assistant?credits=cancelled`,
      payment_method_types: ['card'],
    });

    await db.order.update({ where: { id: order.id }, data: { stripeCheckoutSessionId: checkoutSession.id } });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error('[assistant credits checkout] Stripe session creation failed:', err);
    return NextResponse.json({ error: 'Payment initialization failed. Please try again.' }, { status: 500 });
  }
}
