# Ask Francisco — monetization spec (2026-09-23)

Directive rule 35: *"Until real pricing infrastructure exists: architecture
first, configuration second, payment implementation third. Do not invent
final commercial numbers."* This document is the architecture step. No
Prisma migration, no Stripe wiring, no price shipped to a real user in this
pass — and a specific reason for each.

## The wedge: Renovation Decision Analysis (rule 26)

**The real capability exists and runs for free, every time.**
`renovation-analysis.ts`'s `computeRenovationSequence` is not a stub — it's
a genuine, tested, deterministic engine that already answers "what should I
do first" with real reasoning grounded in stated facts (see
`ASSISTANT_ACTION_ENGINE_SPEC.md`). That's rule 26's *"must be a real
capability, not a paywalled paragraph"* requirement, already satisfied,
already shipping, already free.

**The gate for the deeper, written/paid version is real and already
computed.** `deepAnalysisEligible` — true once 2+ projects and 4+
independent signals are known (sell horizon, floor condition, square
footage, neighbourhood each count as one) — is exactly the "worth paying
for" moment the directive describes (rule 25: "the assistant has demonstrated
useful understanding" before the paywall appears). When eligible, a
`paid_analysis_proposed` card renders today, honestly labeled: *"Pricing for
this is not configured yet — this offer is not chargeable"* (`cta`: "Not
available for purchase yet," no `href`, not clickable). This is the
"configuration second" boundary made visible in the product rather than
hidden — a homeowner who reaches the gate sees that Francisco recognized the
moment, without being shown a number nobody has actually set.

## Why payment wiring stops here, specifically

1. **No verified price exists to configure.** "Renovation Credits" is a
   wholly new internal currency for this product — there is no external
   market comparable to "verify... source, date, currency, geography,
   billing model" against (rule 35's own sourcing checklist), because
   nothing like it is sold today. The number is a business decision (what
   does Ecowoods want to charge, what's the target margin against the
   compute/API cost — see `ASSISTANT_UNIT_ECONOMICS.md`), not an engineering
   one. Inventing "15 Renovation Credits" (the directive's own example
   number) to ship something would be exactly rule 35's "do not invent
   final commercial numbers," applied to the one thing in this feature that
   actually is a commercial number.
2. **A schema migration against a real database is a hard-to-reverse, shared
   change.** `CreditWallet`/`CreditTransaction`/`UsageLedger` tables (rule 29)
   would need `prisma migrate` run against whatever database this deploys
   to — this session has no confirmed target database, and applying a
   migration blind is exactly the class of action (affects shared state,
   hard to reverse) that needs a human in the loop, not a same-pass
   automated decision. The schema shape below is specified so implementing
   it is a scoped, reviewable follow-up, not a design exercise done twice.
3. **A real Order/OrderItem/Stripe checkout precedent already exists and
   should be checked first, not bypassed.** `well-installed-review`'s
   checkout route (see `ASSISTANT_PHASE2_AUDIT.md`) is a working,
   guest-checkout, server-priced paid-intelligence product on this exact
   stack. The credit-ledger design below should be evaluated against "does
   `Order`/`OrderItem` already cover this" before a new ledger schema is
   built — rule 29's own instruction ("ONLY create tables that do not
   already exist") applies here directly, and answering that question
   properly means reading how `Order.status`/`paidAt` model a one-shot
   purchase and deciding whether recurring, deductible "credits" need more
   than that. That evaluation is real design work for whoever picks this
   up next, not a rubber stamp.

## Configuration step — what needs a human decision before code

- **Price per analysis**, in Renovation Credits and in the CAD-equivalent a
  homeowner would actually purchase credits in (a credit pack, e.g. "50
  credits for $X" — the directive never wants the raw model-cost unit
  exposed, rule 28).
- **What "Renovation Credits" purchase itself looks like** — a fixed pack
  size (simpler, matches `well-installed-review`'s single-tier-or-two
  precedent) vs. a top-up balance (needs the ledger). Recommend starting
  with the fixed-pack, single-purchase-per-analysis model — it reuses
  `Order`/`OrderItem` directly with no new tables, and is the smallest step
  that satisfies rule 26-27 without prematurely building rule 29's ledger
  before there's a second paid product that would actually need a running
  balance.
- **Refund/failure policy specifics** (rule 32) — the engineering pattern
  (idempotency key, no charge before result, settle-on-success) is
  specifiable now (below); the exact policy text (how long a failed
  analysis holds a pending charge before auto-refund, what "partial
  execution" even means for a deterministic function that either runs or
  doesn't) is a support/business decision.

## Architecture, specified now for the next pass to implement

### Preferred: extend `Order`/`OrderItem`, not a new ledger, for v1

```
Order (existing)         status PENDING -> PAID (existing webhook flow)
  OrderItem (existing)   productName: "Renovation Decision Analysis"
                         unitPrice: server-resolved from a new
                                    RENOVATION_ANALYSIS_TIERS config
                                    (content/constants, same pattern as
                                    REVIEW_TIERS in well-installed-review.ts)
```

A new `POST /api/assistant/analysis/checkout` route, modeled directly on
`app/api/well-installed-review/checkout/route.ts`: guest-or-signed-in
`User` upsert by email, `Order` + `OrderItem` created `PENDING`, Stripe
Checkout session created, existing webhook (`app/api/webhooks/stripe/route.ts`)
marks it `PAID` from `metadata.orderId` — no second webhook handler.

**Idempotency (rule 30):** the checkout route generates the `Order` keyed by
a client-supplied idempotency token (conversation turn id + visitor
designId), the same defensive pattern Stripe's own `idempotency_key` header
supports natively on `checkout.sessions.create` — a double-click or retry
resolves to the same `Order`, not two.

**Pre-authorization flow (rule 31), mapped onto what already exists:**

```
propose_paid_analysis (new tool, model-callable once deepAnalysisEligible)
  -> paid_analysis_proposed card (ALREADY BUILT — see above)
  -> visitor clicks "Analyze my house" (blocked until pricing is configured)
  -> POST /api/assistant/analysis/checkout -> Stripe Checkout
  -> webhook marks Order PAID
  -> a delivery route re-runs computeRenovationSequence (deterministic,
     free to re-run) + a written-report expansion, saves it against the
     Order, renders as a `result` card type (not yet designed — see below)
```

No step here executes the expensive work before payment settles (rule 31);
the underlying analysis function is cheap and deterministic, so re-running
it post-payment costs nothing extra and avoids ever charging for a run that
didn't happen (rule 32).

### If a real running balance becomes necessary later (v2, not now)

Only once a second paid product exists that benefits from a shared balance
(rather than a one-shot purchase) does a ledger earn its complexity:

```prisma
model CreditWallet {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @unique @db.Uuid
  user      User     @relation(fields: [userId], references: [id])
  balance   Int      @default(0)   // whole credits, never fractional
  updatedAt DateTime @updatedAt @db.Timestamptz
  @@schema("ecowoods")
}

model CreditTransaction {
  id            String   @id @default(uuid()) @db.Uuid
  walletId      String   @db.Uuid
  wallet        CreditWallet @relation(fields: [walletId], references: [id])
  delta         Int          // negative = spend, positive = purchase/refund
  reason        String       // "renovation_decision_analysis" | "purchase" | "refund"
  orderId       String?  @db.Uuid   // ties a spend to the Order that paid for it
  idempotencyKey String  @unique
  createdAt     DateTime @default(now()) @db.Timestamptz
  @@index([walletId])
  @@schema("ecowoods")
}
```

This is NOT added to `prisma/schema.prisma` in this pass — see reason 2
above. It's specified here so the decision to build it is deliberate, made
once there's a second product that needs it, not built speculatively now.

## What must never happen, regardless of implementation order

- Client-sent price or credit cost is never trusted — same discipline
  `well-installed-review`'s checkout already has (`resolveReviewTier`
  resolves server-side from a tier id, never a client-sent number).
- No `card.type === 'paid_analysis_proposed'` ever renders a clickable CTA
  until a real price is configured — enforced today by simply never setting
  `href` on that card type, and by the UI rendering a disabled span instead
  of a link when `href` is absent (`ConversationPane.tsx`).
- No expensive external-API work (a licensed data adapter, a document-review
  pass) runs before a payment settles, once one of those becomes a paid
  product — the wedge product avoids this entirely by being deterministic
  and re-runnable, but future paid products (rule 49's document review) will
  need to design around a "hold the request, don't execute" pattern
  explicitly.
