# Ask Francisco — payment spec (2026-09-23)

## Reused, not duplicated

`lib/stripe.ts` (existing client singleton), `app/api/webhooks/stripe/route.ts`
(existing webhook — extended, not forked), `Order`/`OrderItem`/`Settings.defaultTaxRate`
(existing schema), the `well-installed-review` checkout route (existing,
working precedent for "server-priced, guest/account checkout, Stripe
Checkout Session, existing webhook marks it PAID"). Nothing here is a
second payment system.

## The flow

```
POST /api/assistant/credits/checkout   (auth required)
  → resolveCreditPack() — SERVER resolves price, client never sends one
  → Order (PENDING) + OrderItem created
  → stripe.checkout.sessions.create({
      metadata: { orderId, userId, kind: 'renovation_credits', packId, credits }
    })
  → redirect the browser to Stripe's hosted Checkout page
                    ↓ (customer pays on Stripe's own page — this app never
                       collects a card number, directive rule 6)
  success_url: /assistant?credits=purchased&order=<id>
  cancel_url:  /assistant?credits=cancelled

Stripe → POST /api/webhooks/stripe   (signature-verified, source of truth)
  case 'checkout.session.completed':
    Order → PAID   (existing logic, existing idempotency guard)
    if metadata.kind === 'renovation_credits':
      grantCredits({ ..., idempotencyKey: `order:${orderId}:grant` })
```

**The browser redirect is never trusted for payment truth** (directive rule
16) — `success_url` only takes the visitor back to `/assistant`; it does
not itself grant anything. Credits are granted exclusively from the
webhook, which Stripe signs and this app verifies
(`stripe.webhooks.constructEvent`, existing code, unchanged).

## What's verified, and how (see `ASSISTANT_PHASE3_COMMERCIAL_AUDIT.md` for
the full breakdown)

- **Webhook signature verification, event routing, and idempotency**: real
  — a genuinely HMAC-signed event was POSTed over real HTTP to the running
  production build and produced the correct database state, including
  under simulated duplicate delivery and a forged signature. See the audit
  doc for the exact numbers.
- **`stripe.checkout.sessions.create` itself**: NOT exercised against
  Stripe's real API in this sandbox — no live `STRIPE_SECRET_KEY` was
  available. This is the one seam in the whole flow this session could not
  verify live.

## Server-side price resolution (directive rule 8, 40)

`content/constants/renovation-analysis-product.ts`'s `CREDIT_PACKS` /
`resolveCreditPack()` — same pattern as `paid-review-product.ts`'s
`REVIEW_TIERS`/`resolveReviewTier()`. The checkout route reads a `packId`
string from the client and resolves it against this list server-side; an
unrecognized or absent id falls back to the only pack rather than trusting
a client-sent price. **The $20 CAD / 20-credit figure is a PROPOSED
hypothesis, not an owner-confirmed price** — see that file's header for the
2026 market research it's based on (monday.com, GitHub Copilot, and 50
other AI-credit products' public pricing; the in-repo comparable,
`well-installed-review`'s $179/$249 human-reviewed product). Per
`ECOWOODS_AUTONOMOUS_EXECUTION_PROTOCOL.md`'s Class C gate, a new public
price claim needs human business confirmation before it reaches a paying
customer — this file is the patch asking for that confirmation, the same
convention `paid-review-product.ts` already established.

## No dark patterns (directive rule 19, 43)

No countdown, no "limited time," no pre-checked auto-renewal (there is no
recurring billing at all — one-time purchase only), no "you've reached
your limit" framing. The paywall card states what's received, then the
exact credit cost, then the button — the directive's own preferred phrasing.

## Failure safety (directive rule 39)

- **Stripe session creation fails** (network, bad key): the route returns
  a 500 with an honest message; the `Order` stays `PENDING` — no credits
  granted, nothing charged, safely re-triable (a fresh checkout call
  creates a fresh `Order`, so a stuck `PENDING` order is simply abandoned,
  never double-billed).
- **Payment fails on Stripe's side**: `checkout.session.completed` never
  fires; the existing `payment_intent.payment_failed` case is logged
  (existing code, unchanged) — no credits granted, matching "no fraudulent
  charge, no duplicate credits."
- **Webhook delivered twice**: verified idempotent (see above) — exactly
  one `CreditTransaction`, one balance movement.
- **`STRIPE_SECRET_KEY` unset**: the checkout route returns `503
  {"code":"pending_key"}` before attempting anything — same honest-gap
  pattern the rest of this codebase already uses for missing adapters,
  never a silent failure or a fabricated success.

## Launch checklist (what a human needs to do before this is truly live)

1. Review and confirm (or change) the proposed $20 CAD / 20-credit price in
   `content/constants/renovation-analysis-product.ts`.
2. Set a real `STRIPE_SECRET_KEY` (test, then live) and
   `STRIPE_WEBHOOK_SECRET` in the deploy environment — both already
   `lib/stripe.ts`-compatible, no code change needed.
3. Run ONE real Stripe test-mode purchase (card `4242 4242 4242 4242`)
   against a deployed preview with a real test key, and confirm the credit
   grant lands — the one verification step this sandbox could not perform.
4. Apply `prisma/migrations/20260923223246_phase3_renovation_credits/`
   against the real target database (`prisma migrate deploy`) — prepared
   and tested against a local instance in this pass, not yet applied to
   whatever this repo actually deploys against.
