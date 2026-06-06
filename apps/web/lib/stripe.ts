/**
 * Stripe client singleton.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * GOING LIVE WITH STRIPE IN CANADA — Step-by-step guide
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. CREATE A STRIPE ACCOUNT
 *    → stripe.com/en-ca  ·  Choose "Business type: Canada"
 *    → Enter your HST number and Canadian business address
 *    → Connect your Canadian bank account (CAD payouts)
 *
 * 2. GET YOUR API KEYS
 *    Stripe Dashboard → Developers → API Keys
 *    Test keys:  STRIPE_SECRET_KEY=sk_test_...  STRIPE_PUBLISHABLE_KEY=pk_test_...
 *    Live keys:  STRIPE_SECRET_KEY=sk_live_...  STRIPE_PUBLISHABLE_KEY=pk_live_...
 *
 *    CRITICAL: Never commit live keys. Store in Vercel Environment Variables.
 *
 * 3. SET UP WEBHOOK
 *    Stripe Dashboard → Developers → Webhooks → Add Endpoint
 *    Endpoint URL: https://yourdomain.ca/api/webhooks/stripe
 *    Events to listen for:
 *      · checkout.session.completed
 *      · payment_intent.succeeded
 *      · payment_intent.payment_failed
 *    Copy the Webhook Signing Secret → STRIPE_WEBHOOK_SECRET in .env
 *
 *    For LOCAL testing:
 *      npm install -g stripe
 *      stripe login
 *      stripe listen --forward-to localhost:3000/api/webhooks/stripe
 *      (This gives you a local webhook secret)
 *
 * 4. CANADIAN PAYOUTS
 *    Stripe supports CAD payouts to Canadian bank accounts (EFT).
 *    Payouts settle in 2 business days for credit cards, instant for Interac.
 *    You can configure payout schedule in Dashboard → Settings → Payouts.
 *
 * 5. TAX
 *    Stripe Tax (optional): automatically calculates HST/GST based on billing
 *    address. Or use manual tax rates (which is what we do — taxRate field on Invoice).
 *
 * 6. APPLE PAY / GOOGLE PAY
 *    These activate automatically in Stripe Checkout — no extra config needed.
 *    Domain verification: Stripe Dashboard → Settings → Payment Methods → Apple Pay
 *    → verify your domain.
 *
 * 7. TEST CARDS
 *    4242 4242 4242 4242  — Visa, any future date, any CVV
 *    4000 0566 5566 5556  — Visa Debit
 *    4000 0000 0000 0002  — Declined
 *
 * ────────────────────────────────────────────────────────────────────────────
 */

import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('[stripe] STRIPE_SECRET_KEY not set — Stripe payments will not work');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2024-06-20',
  typescript: true,
});
