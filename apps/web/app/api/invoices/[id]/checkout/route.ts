/**
 * POST /api/invoices/[id]/checkout
 * Creates a Stripe Checkout session for an invoice and returns the URL.
 * 인보이스 결제를 위한 Stripe Checkout 세션 생성
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { project: { include: { user: true } } },
  });

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  // Verify the logged-in user owns this invoice
  if (invoice.project.userId !== session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (invoice.status === 'PAID') {
    return NextResponse.json({ error: 'Invoice already paid' }, { status: 400 });
  }

  const origin = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Amount in cents (CAD)
      line_items: [
        {
          price_data: {
            currency: 'cad',
            product_data: {
              name: `Invoice #${invoice.number}`,
              description: invoice.description ?? `${invoice.project.title} — ${invoice.stage} payment`,
              metadata: { invoiceId: invoice.id },
            },
            unit_amount: Math.round(invoice.total * 100), // Stripe requires cents
          },
          quantity: 1,
        },
      ],
      customer_email: invoice.project.user.email,
      metadata: {
        invoiceId: invoice.id,
        projectId: invoice.projectId,
        userId: session.user.id,
      },
      // Redirect URLs — back to MyPage after payment
      success_url: `${origin}/mypage/invoices?payment=success&invoice=${invoice.number}`,
      cancel_url: `${origin}/mypage/invoices/${invoice.id}/pay`,
      // Enable Apple Pay / Google Pay automatically
      payment_method_types: ['card'],
      // Stripe's automatic tax is optional — we manage tax on our side
    });

    // Save the Stripe session ID to the invoice
    await db.invoice.update({
      where: { id: invoice.id },
      data: { stripeCheckoutSessionId: checkoutSession.id },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error('[stripe] checkout session creation failed:', err);
    return NextResponse.json(
      { error: 'Payment initialization failed. Please try again.' },
      { status: 500 }
    );
  }
}
