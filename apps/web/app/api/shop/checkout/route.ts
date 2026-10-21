/**
 * POST /api/shop/checkout
 * Creates a PENDING Order from the customer's cart, then a Stripe Checkout
 * session for it and returns the URL.
 *
 * Prices are ALWAYS recomputed here from the Product records — the client
 * only sends productId + quantity + chosen option labels, never a price.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { isTrustedBrowserOrigin } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit-durable';
import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { parseProductOptions, resolveSelectedOptions, round2 } from '@/lib/shop';

/** Upper bounds are abuse guards only; they do not alter any price or term. */
const MAX_CART_LINES = 50;
const MAX_LINE_QUANTITY = 100_000;

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(100),
        // finite, > 0 (rejects NaN/Infinity/negative/zero), bounded.
        quantity: z.number().finite().positive().max(MAX_LINE_QUANTITY),
        selectedOptions: z.record(z.string().max(100), z.string().max(200)).optional(),
      }),
    )
    .min(1, 'Cart is empty')
    .max(MAX_CART_LINES),
});

export async function POST(req: Request) {
  if (!isTrustedBrowserOrigin(req)) {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
  }
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Durable + fail-closed: this creates a PENDING Order and a Stripe session.
  const rl = await enforceRateLimit({
    routeKey: 'shop-checkout',
    identity: session.user.id,
    config: { windowMs: 60_000, maxRequests: 5 },
    failClosed: true,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Please wait a moment before trying again.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    );
  }

  const parsed = checkoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid cart' }, { status: 400 });
  }
  const rawItems = parsed.data.items;

  const productIds = [...new Set(rawItems.map((i) => i.productId))];
  const products = await db.product.findMany({
    where: { id: { in: productIds }, active: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  const settings = await db.settings.findFirst();
  const taxRate = Number(settings?.defaultTaxRate ?? 13);

  let subtotal = 0;
  const itemsToCreate: Array<{
    productId: string;
    productName: string;
    unit: 'SQFT' | 'EACH';
    quantity: number;
    unitPrice: number;
    selectedOptions: ReturnType<typeof resolveSelectedOptions>;
    lineTotal: number;
  }> = [];

  for (const raw of rawItems) {
    const product = productById.get(raw.productId);
    if (!product) {
      return NextResponse.json({ error: 'One or more items are no longer available' }, { status: 400 });
    }

    const minQuantity = Number(product.minQuantity);
    const quantity = round2(Math.max(minQuantity, raw.quantity));

    const optionGroups = parseProductOptions(product.options);
    const resolvedOptions = resolveSelectedOptions(optionGroups, raw.selectedOptions);
    const optionDelta = resolvedOptions.reduce((sum, o) => sum + o.priceDelta, 0);

    const unitPrice = round2(Number(product.basePrice) + optionDelta);
    const lineTotal = round2(unitPrice * quantity);

    subtotal += lineTotal;
    itemsToCreate.push({
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      quantity,
      unitPrice,
      selectedOptions: resolvedOptions,
      lineTotal,
    });
  }

  subtotal = round2(subtotal);
  const taxAmount = round2(subtotal * (taxRate / 100));
  const total = round2(subtotal + taxAmount);

  const order = await db.order.create({
    data: {
      userId: session.user.id,
      status: 'PENDING',
      subtotal,
      taxRate,
      total,
      items: { create: itemsToCreate },
    },
  });

  const origin = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        ...itemsToCreate.map((item) => ({
          price_data: {
            currency: 'cad',
            product_data: {
              name: item.productName,
              description: `${item.quantity} ${item.unit === 'SQFT' ? 'sq ft' : 'x'} @ $${item.unitPrice.toFixed(2)}${
                item.unit === 'SQFT' ? '/sq ft' : ' each'
              }`,
            },
            unit_amount: Math.round(item.lineTotal * 100),
          },
          quantity: 1,
        })),
        {
          price_data: {
            currency: 'cad',
            product_data: { name: `Ontario HST (${taxRate}%)` },
            unit_amount: Math.round(taxAmount * 100),
          },
          quantity: 1,
        },
      ],
      customer_email: session.user.email,
      metadata: {
        orderId: order.id,
        userId: session.user.id,
      },
      success_url: `${origin}/mypage?order=success`,
      cancel_url: `${origin}/mypage?order=cancelled`,
      payment_method_types: ['card'],
    });

    await db.order.update({
      where: { id: order.id },
      data: { stripeCheckoutSessionId: checkoutSession.id },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error('[shop checkout] Stripe session creation failed:', err);
    return NextResponse.json(
      { error: 'Payment initialization failed. Please try again.' },
      { status: 500 }
    );
  }
}
