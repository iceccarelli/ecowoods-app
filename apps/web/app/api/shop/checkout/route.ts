/**
 * POST /api/shop/checkout
 * Creates a PENDING Order from the customer's cart, then a Stripe Checkout
 * session for it and returns the URL.
 *
 * Prices are ALWAYS recomputed here from the Product records — the client
 * only sends productId + quantity + chosen option labels, never a price.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { parseProductOptions, resolveSelectedOptions, round2 } from '@/lib/shop';

type CartItemInput = {
  productId: string;
  quantity: number;
  selectedOptions?: Record<string, string>;
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as { items?: CartItemInput[] };
  const rawItems = body.items ?? [];

  if (rawItems.length === 0) {
    return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
  }

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
    const quantity = Math.max(minQuantity, Number(raw.quantity) || 0);

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
