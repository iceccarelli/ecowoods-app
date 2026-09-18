/**
 * POST /api/floor-plan/checkout
 *
 * Guest checkout for the Personal Floor Plan spec PDF (EW-0004). Unlike
 * EW-0001/EW-0003, the share code IS the whole product input and is
 * collected at checkout rather than deferred to a post-payment intake step
 * — there is nothing else to ask for, and deferring one field would only add
 * a round trip.
 *
 * The code is decoded and validated BEFORE a Stripe session is created:
 * decodeStudioDesign() already refuses anything not isLayable (see
 * lib/floor-studio/catalog.ts's header), so charging $99 for a floor this
 * company cannot lay is structurally impossible, not just a copy promise.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { round2 } from '@/lib/shop';
import { buildFloorPlanOrderItem } from '@/lib/floor-plan';
import { buildCheckoutNotes } from '@/lib/floor-plan/notes';
import { parseShareCode } from '@/lib/floor-plan/share-code';
import { decodeStudioDesign } from '@/lib/floor-studio/studio-config';
import { checkRateLimit, getClientIp, isTrustedBrowserOrigin, LEAD_POST_LIMIT } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const checkoutSchema = z.object({
  name: z.string().min(2, 'Please enter your name').max(200),
  email: z.string().email('Please enter a valid email'),
  code: z.string().min(1, 'Paste your Floor Studio share code.').max(500),
  company: z.string().optional(), // honeypot
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
    return NextResponse.json({ error: 'Please check the name, email and share code.' }, { status: 400 });
  }

  if (parsed.data.company?.trim()) {
    console.log(JSON.stringify({ event: 'floor_plan.honeypot', at: new Date().toISOString() }));
    return NextResponse.json({ url: '/floor-plan' }, { status: 201 });
  }

  const { name, email, code: rawCode } = parsed.data;
  const code = parseShareCode(rawCode);
  const design = decodeStudioDesign(code);
  if (!design) {
    return NextResponse.json(
      { error: 'That code did not resolve to a floor Ecowoods can lay. Copy the share link from Floor Studio and try again.' },
      { status: 400 },
    );
  }

  const item = buildFloorPlanOrderItem();
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
      notes: buildCheckoutNotes(code),
      items: { create: [item] },
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
            product_data: { name: item.productName, description: 'One-time specification PDF' },
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
        kind: 'floor-plan',
      },
      success_url: `${origin}/floor-plan/${order.id}?email=${encodeURIComponent(email)}`,
      cancel_url: `${origin}/floor-plan?checkout=cancelled`,
      payment_method_types: ['card'],
    });

    await db.order.update({
      where: { id: order.id },
      data: { stripeCheckoutSessionId: checkoutSession.id },
    });

    console.log(JSON.stringify({ event: 'floor_plan.checkout_created', orderId: order.id }));
    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error('[floor-plan checkout] Stripe session creation failed:', err);
    return NextResponse.json(
      { error: 'Payment initialization failed. Please try again.' },
      { status: 500 },
    );
  }
}
