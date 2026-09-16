/**
 * POST /api/well-installed-review/checkout
 *
 * Guest checkout for the Well-Installed Quote Review (EW-0001). Unlike
 * /api/shop/checkout this does not require a signed-in session — the buyer is
 * often a homeowner mid-decision, not someone with an Ecowoods account — so a
 * User row is found-or-created by email the same way an in-store guest
 * checkout would be, and the Order hangs off it.
 *
 * Price is ALWAYS resolved server-side from REVIEW_TIERS
 * (content/constants/paid-review-product.ts); the client sends a tier id,
 * never a price. The existing Stripe webhook
 * (app/api/webhooks/stripe/route.ts) already marks any Order PAID from
 * `metadata.orderId` — this route relies on that unmodified behavior instead
 * of adding a second webhook handler.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { round2 } from '@/lib/shop';
import { buildReviewOrderItem, resolveReviewTier } from '@/lib/well-installed-review';
import { checkRateLimit, getClientIp, isTrustedBrowserOrigin, LEAD_POST_LIMIT } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const checkoutSchema = z.object({
  name: z.string().min(2, 'Please enter your name').max(200),
  email: z.string().email('Please enter a valid email'),
  tier: z.enum(['standard', 'rush']).optional(),
});

export async function POST(req: Request) {
  if (!isTrustedBrowserOrigin(req)) {
    return NextResponse.json({ error: 'Origin not allowed.' }, { status: 403 });
  }

  const rl = checkRateLimit(getClientIp(req), LEAD_POST_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Please wait a moment before trying again.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please check the name and email.' }, { status: 400 });
  }

  const { name, email, tier: requestedTier } = parsed.data;
  const tier = resolveReviewTier(requestedTier);
  const item = buildReviewOrderItem(tier);

  const settings = await db.settings.findFirst();
  const taxRate = Number(settings?.defaultTaxRate ?? 13);
  const subtotal = round2(item.lineTotal);
  const taxAmount = round2(subtotal * (taxRate / 100));
  const total = round2(subtotal + taxAmount);

  const user = await db.user.upsert({
    where: { email: email.toLowerCase() },
    create: { email: email.toLowerCase(), name },
    update: {},
  });

  const order = await db.order.create({
    data: {
      userId: user.id,
      status: 'PENDING',
      subtotal,
      taxRate,
      total,
      notes: `Well-Installed Quote Review (${tier.name})`,
      items: { create: [item] },
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
            product_data: {
              name: item.productName,
              description: tier.turnaround,
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
      customer_email: email,
      metadata: {
        orderId: order.id,
        userId: user.id,
        kind: 'well-installed-review',
        tier: tier.id,
      },
      success_url: `${origin}/well-installed-review/success?order=${order.id}`,
      cancel_url: `${origin}/well-installed-review?checkout=cancelled`,
      payment_method_types: ['card'],
    });

    await db.order.update({
      where: { id: order.id },
      data: { stripeCheckoutSessionId: checkoutSession.id },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error('[well-installed-review checkout] Stripe session creation failed:', err);
    return NextResponse.json(
      { error: 'Payment initialization failed. Please try again.' },
      { status: 500 },
    );
  }
}
