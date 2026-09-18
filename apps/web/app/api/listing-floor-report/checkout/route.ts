/**
 * POST /api/listing-floor-report/checkout
 *
 * Guest checkout for the Pre-List Floor Condition Report (EW-0003). Same
 * shape as EW-0001's /api/well-installed-review/checkout — guest User
 * found-or-created by email, PENDING Order, Stripe session with
 * metadata.orderId so the EXISTING webhook marks it PAID unmodified — a NEW
 * module, not a shared one, per this spec's instruction not to touch any
 * well-installed-review or quote-intelligence file.
 *
 * DELIBERATE DEVIATION FROM THE BRIEF'S STEP-1 FIELD LIST: the brief lists
 * phone/role/brokerage/address/city/photography-date/go-live-date as
 * landing-page fields. Collecting all of that before a card is even offered
 * adds checkout friction for no payment-critical reason, and every other
 * paid flow on this branch (EW-0001) collects only name/email/tier here and
 * defers the rest to the post-payment intake step. This route follows that
 * proven shape: name, email, sku, honeypot only. Listing details and the
 * photography date are collected in /api/listing-floor-report/submit,
 * matching where EW-0001 collects its scope details.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { round2 } from '@/lib/shop';
import { buildListingReportOrderItem, resolveListingReportSku } from '@/lib/listing-floor-report';
import { checkRateLimit, getClientIp, isTrustedBrowserOrigin, LEAD_POST_LIMIT } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const checkoutSchema = z.object({
  name: z.string().min(2, 'Please enter your name').max(200),
  email: z.string().email('Please enter a valid email'),
  sku: z.enum(['photo', 'onsite']).optional(),
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
    return NextResponse.json({ error: 'Please check the name and email.' }, { status: 400 });
  }

  if (parsed.data.company?.trim()) {
    console.log(JSON.stringify({ event: 'listing_floor_report.honeypot', at: new Date().toISOString() }));
    return NextResponse.json({ url: '/listing-floor-report' }, { status: 201 });
  }

  const { name, email, sku: requestedSku } = parsed.data;
  const sku = resolveListingReportSku(requestedSku);
  const item = buildListingReportOrderItem(sku);

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
      notes: `Listing Floor Report (${sku.id})`,
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
            product_data: { name: item.productName, description: sku.sla },
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
        kind: 'listing-floor-report',
        sku: sku.id,
      },
      success_url: `${origin}/listing-floor-report/success?order=${order.id}`,
      cancel_url: `${origin}/listing-floor-report?checkout=cancelled`,
      payment_method_types: ['card'],
    });

    await db.order.update({
      where: { id: order.id },
      data: { stripeCheckoutSessionId: checkoutSession.id },
    });

    console.log(JSON.stringify({ event: 'listing_floor_report.checkout_created', orderId: order.id, sku: sku.id }));
    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error('[listing-floor-report checkout] Stripe session creation failed:', err);
    return NextResponse.json(
      { error: 'Payment initialization failed. Please try again.' },
      { status: 500 },
    );
  }
}
