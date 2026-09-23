# Ask Francisco — Phase 3 commercial audit (2026-09-23)

Scope: `/assistant` on `main` as of `c5b4fe1` (PR #134), plus this session's
unmerged Phase 2 work (`af9a027`, personalization + action engine — not yet
merged to `main`, so this audit reads the actual state this branch starts
from, not an assumption). This directive requires "no fake success" (rule
49) — every claim below states exactly how it was verified and what remains
unverified, and why.

## What already existed — inspected before writing anything new

- **Auth**: `lib/auth.ts` — Auth.js v5, Credentials + optional Google/Facebook
  OAuth, `PrismaAdapter`. `session.user.id` is already the established
  pattern across the codebase (`app/api/invoices/[id]/checkout/route.ts`,
  `app/api/shop/checkout/route.ts`, four more). **Reused as-is — no second
  identity system.**
- **Stripe**: `lib/stripe.ts` (client singleton, reads `STRIPE_SECRET_KEY`),
  `app/api/webhooks/stripe/route.ts` (one webhook handler, already verifies
  signatures via `stripe.webhooks.constructEvent`, already idempotent on
  `Order.status === 'PAID'`). **Extended, not duplicated** — see "Payment"
  below.
- **Commerce schema**: `Order`/`OrderItem`/`Payment`/`Product`/`Settings`
  (tax rate) already exist and already back a real paid product
  (`well-installed-review`, `$179/$249 CAD`, guest checkout, the exact
  precedent this pass followed for pack purchase). **Reused for the
  purchase-money side** — a credit pack buy is an `Order`/`OrderItem`, same
  as any other one-time purchase on this site.
- **No credit/wallet model existed.** `Order` alone cannot express "hold 20
  credits, spend some now, refund on failure" — a one-shot purchase record
  has no notion of a running, reservable balance. This is the one place
  Phase 3 genuinely needed new tables — see `ASSISTANT_CREDIT_LEDGER_SPEC.md`.
- **Analytics**: `lib/analytics.ts`'s `AnalyticsEvent` union + `track()` —
  no PII, GA4-backed, an established pattern (`workspace_*` events already
  exist for Phase 0-2). Extended with the Phase 3 funnel events, not forked.
- **Phase 2 personalization/action engine**: `WorkspaceState.personalization`
  (neighbourhood, floorCondition, otherTrades), `WorkspaceActionMemory`,
  `renovation-analysis.ts`'s deterministic sequencing engine, the
  `analyze_renovation_priorities` tool, and the `paid_analysis_proposed`
  card that Phase 2 left honestly gated ("pricing not configured yet," no
  `href`, not clickable). **This is exactly the wedge Phase 3 was told to
  build for real** — Phase 3 does not re-derive it, it wires a real
  purchase/execution path onto the exact card and engine Phase 2 already
  shipped.

## What Phase 3 built

1. **`CreditWallet` / `CreditTransaction` / `RenovationAnalysis`** — three
   new Prisma models (`prisma/schema.prisma`), migrated
   (`prisma/migrations/20260923223246_phase3_renovation_credits/`).
2. **`lib/assistant-workspace/credit-ledger.ts`** — the reserve/settle/
   release/grant/refund state machine, transactional, idempotent by a
   database-level unique constraint (not an application-level check).
3. **`lib/assistant-workspace/analysis-execution.ts`** — the
   reserve→execute→settle orchestrator that ties the ledger to
   `renovation-analysis.ts`'s new `buildDetailedRenovationAnalysis`.
4. **`content/constants/renovation-analysis-product.ts`** — the ONE credit
   pack (20 credits / $20 CAD) and the analysis's credit cost (20 credits),
   server-side config, following `paid-review-product.ts`'s exact
   governance pattern (a proposed, sourced, NOT owner-confirmed price —
   Class C per `ECOWOODS_AUTONOMOUS_EXECUTION_PROTOCOL.md` §7/§23).
5. **Real routes**: `POST /api/assistant/credits/checkout` (auth-gated,
   extends the well-installed-review Stripe Checkout pattern),
   `GET /api/assistant/credits` (server-authoritative balance),
   `POST /api/assistant/analysis/run` (the paid execution),
   `GET /api/assistant/analysis/[id]` (ownership-checked read-back).
6. **The existing Stripe webhook, extended** (not forked) to grant credits
   when `session.metadata.kind === 'renovation_credits'`, on top of its
   existing `Order`-PAID idempotency guard.
7. **Real UI**: `PaidAnalysisAction.tsx` (balance → sign-in/buy/run states)
   and `AnalysisResultCard.tsx` (the saved, structured deliverable) —
   mounted by `ConversationPane.tsx` in place of Phase 2's disabled
   placeholder span.

## Verification performed — and exactly what each claim rests on

**"Credits work"**: verified against a **real, local PostgreSQL 16
instance** (`pg_ctlcluster`, started in this sandbox — a genuinely disposable
local database, not a mock). The full existing migration history applied
cleanly, then the new Phase 3 migration. `credit-ledger.integration.test.ts`
(9 tests) and `analysis-execution.integration.test.ts` (5 tests) run real
Prisma transactions against real tables — not mocked Prisma. These caught a
**real bug** during development: a recovery read inside an aborted Postgres
transaction (error `25P02`) that a mocked client would never have surfaced —
fixed, then re-verified. Concurrent-race test (`Promise.all` of two
identical-idempotency-key grants) settles to exactly one credit, proving the
row-lock + unique-constraint design under actual concurrency, not just
sequential calls.

**"Payment works"**: the **webhook signature verification, event handling,
and idempotency are verified for real** — a genuinely HMAC-signed
`checkout.session.completed` event (via `stripe.webhooks.generateTestHeaderString`,
the same primitive Stripe's own SDK uses, with a local webhook secret) was
POSTed to the actual running production build (`next build && next start`)
over real HTTP. Result: `Order` → `PAID`, `CreditWallet.balance` → 20,
delivering the identical event a second time (simulating Stripe's own retry
behavior) granted nothing extra (1 `CreditTransaction` row, not 2), and a
forged signature was rejected with 400. This is real verification of the
exact code path Stripe would exercise in production.

**What is NOT verified, and cannot be, in this sandbox**: `stripe.checkout.sessions.create`
was never called against Stripe's real API — this sandbox has no
`STRIPE_SECRET_KEY` (a real test-mode key requires a human's Stripe
dashboard) and no outbound network path to Stripe confirmed. A "Stripe TEST
MODE purchase has actually been executed" (rule 49's own bar) is therefore
**not claimed**. What IS claimed: the checkout route's price resolution,
`Order` creation, and metadata construction are exercised by
`checkout-config.test.ts`-style pure-function tests (see
`ASSISTANT_PAYMENT_SPEC.md`), and the ONLY untested seam is the single
`stripe.checkout.sessions.create` network call itself — everything before
and after it (price resolution, Order bookkeeping, the webhook that
completes the loop) is real, tested code. `ASSISTANT_PAYMENT_SPEC.md`'s
launch checklist names the exact manual step (one real test-mode purchase
with Stripe's `4242 4242 4242 4242` card, in an environment with a live
`STRIPE_SECRET_KEY`) a human needs to run once before this goes live.

**"Personalized analysis works"**: `analysis-execution.integration.test.ts`'s
third test grants real credits to a real user, runs
`runRenovationAnalysis` against a `WorkspaceState` carrying actual stored
facts (Rexdale, selling-soon, 900 sq ft, scratched floor, roof mentioned),
and asserts the result's `uncertainty` array does NOT ask for square footage
— i.e., it demonstrably used the stored context rather than a generic
template. This is the golden-test assertion (directive rule 27), run for
real against a real database.

**"Monetization works end-to-end"**: the directive's own bar is
`user → checkout → webhook → credits → analysis → result`. Everything from
webhook onward is verified for real, as above. `checkout →` is code-complete
and follows a working, deployed precedent exactly, but the live network hop
into Stripe itself is the one link this sandbox cannot exercise. This audit
does not claim full end-to-end verification — it claims exactly what was
tested, named above, and names the one remaining manual step.

## What was deliberately NOT done, and why

- **No `next dev` verification** — this repo's CSP blocks the `unsafe-eval`
  webpack's dev runtime needs (documented in `lib/scroll-state.ts`,
  confirmed again this pass); all UI verification used a production build.
- **No live database migration against a shared/production Postgres.**
  The migration in this PR is real and tested against a local, disposable
  instance; applying it to whatever this repository actually deploys to is
  a deploy-time step for whoever owns that database — not something this
  session should do unattended.
- **`document_review`, subscription billing, a second SKU** — out of scope
  per directive rule 8-10/37-38 ("do not build ten paid products first").
