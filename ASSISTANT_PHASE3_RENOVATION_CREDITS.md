# Phase 3 — Renovation Credits: the first paid product

Status codes used below: **VERIFIED** (ran, and I inspected the result),
**PARTIALLY VERIFIED** (ran under a substitute for one dependency, documented),
**BLOCKED** (a real external dependency was unavailable in this environment),
**NOT IMPLEMENTED**. Never "complete."

Branch: `claude/phase-4-customer-journey-jmy9ky`, built from `main` at
`c5b4fe1` (the actual state, verified before writing any code — see the prior
message in this session for that audit; the previously claimed Phase 3
infrastructure did not exist in this repository).

## IMPLEMENTED

One commercial loop, one paid operation: **Renovation Decision Analysis**,
priced in **Renovation Credits**.

**Reused, not rebuilt:**
- Auth — `lib/auth.ts`'s existing `auth()` / session, no second auth system.
- Stripe — the existing `lib/stripe.ts` singleton and the existing
  `app/api/webhooks/stripe/route.ts` webhook. No second Stripe client, no
  second webhook route. The webhook's pre-existing `Order`-paid path is
  untouched; one new branch was added after it (`metadata.kind ===
  'renovation-credits'`) that grants credits — independently idempotent, does
  not change behaviour for any existing Order/Invoice flow.
- Purchase record — the existing `Order` / `OrderItem` models, same pattern
  `listing-floor-report`/`well-installed-review` already use (a PENDING
  Order, a Stripe Checkout Session with `metadata.orderId`, the unmodified
  webhook marks it PAID).
- Pricing bands — `lib/assistant-workspace/economics.ts`'s
  `calculateProjectRange` / `bandForCountry`. The paid analysis's cost view
  never computes a dollar figure any other way.
- Project Decision State — `lib/assistant-workspace/state.ts`'s
  `hydrateWorkspaceState` normalizes the submitted snapshot; no second
  normalizer.
- Analytics — extended the existing `AnalyticsEvent` union in `lib/analytics.ts`
  (same `track()` call site), not a new analytics system.

**New:**
- `prisma/schema.prisma` — `CreditWallet`, `CreditTransaction`,
  `RenovationAnalysisStatus`/`RenovationAnalysis`, plus a hand-authored,
  purely-additive migration (`prisma/migrations/20260924000000_add_renovation_credits/`).
- `lib/credit-ledger.ts` — the one place credits move: `grantCreditsForOrder`
  (idempotent per Order via a `@unique` idempotency key) and
  `chargeForAnalysis` (idempotent per request; the analysis engine runs
  before any DB write, and the balance check + charge happen atomically in
  one transaction).
- `lib/assistant-workspace/renovation-analysis.ts` — the paid engine. Pure,
  synchronous, deterministic: no LLM call in this path, every dollar traced
  to a published Ecowoods band, every fact tagged known/estimated/assumption/
  inspection-needed/external-data-unavailable.
- `lib/assistant-workspace/credits-config.ts` — the two tunable numbers
  (`ANALYSIS_CREDIT_COST = 15`, `CREDIT_PACK = 40 credits / $19 CAD`),
  documented as a starting point, not market-tested.
- Four API routes: `POST /api/assistant/analysis/checkout`,
  `POST /api/assistant/analysis/run`, `GET /api/assistant/analysis/[id]`
  (owner-only, 404s uniformly — never enumerable), `GET
  /api/assistant/credits/wallet`.
- One new chat tool, `propose_renovation_analysis`, gated by
  `isEligibleForAnalysis` (objective + at least one of sell horizon / sqft /
  a selected service) — re-checked server-side in both the checkout and run
  routes, never trusted from the model or the client.
- UI: `RenovationAnalysisOffer` (buy/run, wallet-aware) and
  `RenovationAnalysisResultView`, rendered inline in `ConversationPane` as a
  new `renovation_analysis_offer` card type — same card family as every
  other card on this page, not a separate pricing surface.

## TESTED

```
pnpm --filter @ecowoods/web test
```
→ **81 test files, 1260 tests, all passing** (79 pre-existing test files with
1228 tests, unmodified, plus this phase's 2 new files: 19 tests in
`tests/renovation-credits-flow.test.ts` and 13 in
`lib/assistant-workspace/renovation-analysis.test.ts`).

`tests/renovation-credits-flow.test.ts` exercises the **real route
handlers** end to end (checkout → webhook → run → fetch), with only Prisma,
Stripe's `checkout.sessions.create`, and `auth()` faked — Stripe's
**`webhooks.constructEvent` signature verification is real**, not mocked:
the test signs an actual event with `Stripe.webhooks.generateTestHeaderString`
and the real `stripe` SDK verifies it. Specifically verified:
- a forged signature is rejected (400) and grants nothing;
- a genuinely signed `checkout.session.completed` grants exactly the
  configured credits (40) once;
- the same event delivered twice grants credits exactly once (one `GRANT`
  row, enforced by a real unique-constraint collision in the fake db, caught
  by `lib/credit-ledger.ts`'s own idempotency logic — not skipped by the test);
- a client-supplied price/credit count in the checkout request body is
  ignored — the Stripe line items always reflect `CREDIT_PACK` server-side;
- insufficient credits returns 402 and charges nothing;
- an ineligible workspace (no real context) is refused (422) before any charge;
- a duplicate analysis request under the same idempotency key returns the
  saved result and does not charge twice;
- the analysis actually uses the submitted context (asserted: the returned
  result's cost view cites "900" sq ft for the Rexdale scenario);
- a different signed-in user, and an anonymous request, both get 404 (not
  403) for someone else's analysis — never confirms the id exists;
- a malformed id is 404, not a 500 or a distinguishing 400.

`lib/assistant-workspace/renovation-analysis.test.ts` (13 tests) verifies the
engine directly: eligibility gating, that the sell-timing and square-footage
context change the sequence and cost view, that it never fabricates a number
for a trade Ecowoods doesn't execute (e.g. a kitchen), and that it is
deterministic for identical input.

```
pnpm exec tsc --noEmit   (apps/web, full project)   → 0 errors
pnpm run build           (apps/web)                  → succeeds; the 4 new
                                                         API routes appear in
                                                         the route manifest
node scripts/verify-assistant.mjs                    → passes (no naming leak)
pnpm exec eslint <every new/changed file>             → 0 problems
```

`pnpm exec prisma migrate diff --from-empty --to-schema-datamodel` was used
to generate Prisma's own expected DDL for the new models directly from the
schema (no live database needed for this) and diffed programmatically
against the hand-authored migration file — **identical** except that the
hand-authored version correctly omits `DEFAULT gen_random_uuid()` on `id`
columns, matching this repository's own established convention (verified
against the original `20260620000002_init_ecowoods_schema` migration, where
`id` columns also carry no DB-level default — Prisma generates `uuid()`
client-side in this codebase, not as a Postgres default).

## REAL PAYMENT VERIFICATION

**STRIPE PAYMENT NOT NETWORK-VERIFIED — CREDENTIALS/INFRASTRUCTURE
UNAVAILABLE.**

This environment has no `STRIPE_SECRET_KEY`/`STRIPE_PUBLISHABLE_KEY` test
credentials configured (only the `.env.example` template), and outbound
network access to Stripe's API was not attempted for a real test-mode
Checkout Session or payment. No claim of a completed Stripe test-mode
purchase is made.

What **was** genuinely exercised, with the real `stripe` SDK, no network
needed for either: (1) webhook signature construction and verification —
`Stripe.webhooks.constructEvent`/`generateTestHeaderString`, real HMAC, not
faked; (2) the full checkout → webhook → credit-grant → analysis → saved
result path, with only the Checkout Session **creation** call
(`stripe.checkout.sessions.create`, which does require the network) faked.

**Manual verification procedure for the owner** (requires real Stripe test
keys and, for the fastest loop, the Stripe CLI):
1. Set `STRIPE_SECRET_KEY=sk_test_...`, `STRIPE_PUBLISHABLE_KEY=pk_test_...`
   in `apps/web/.env`.
2. `stripe listen --forward-to localhost:3000/api/webhooks/stripe` — copy the
   printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.
3. Sign in, open `/assistant`, build enough context (e.g. the Rexdale
   scenario in this doc's companion test), and let Francisco offer the
   analysis.
4. Click "Buy Renovation Credits," complete Checkout with card
   `4242 4242 4242 4242`.
5. Confirm in the Stripe CLI log that `checkout.session.completed` was
   delivered and returned 200; confirm the `Order` row is `PAID` and a
   `CreditTransaction` (`type: GRANT`) exists for it in the database.
6. Back in `/assistant`, run the analysis; confirm the `CreditTransaction`
   (`type: SETTLE`, `-15`) and the `RenovationAnalysis` (`status: COMPLETED`)
   rows.
7. Re-deliver the same webhook event from the Stripe CLI (`stripe events
   resend <id>`) and confirm the wallet balance does not change a second
   time.

## PRODUCTION DATABASE MIGRATION SAFETY

- The migration is **purely additive**: 2 new enums, 3 new tables, 8 new
  indexes, 4 new foreign keys. It contains no `ALTER`/`DROP` of any existing
  table, column, or constraint, and no data-migrating statement — nothing in
  it can affect an existing `User`, `Order`, `Invoice`, or `Payment` row.
- Every existing table this migration references (`User`) is only the
  target of a new foreign key, never altered itself.
- **BLOCKED**: this environment has no reachable PostgreSQL instance (no
  Docker daemon available in this sandbox, confirmed by trying) and no
  `DATABASE_URL` pointed at a real database, so `prisma migrate deploy`
  against an actual Postgres — fresh or existing — was **not** run. What
  *was* verified without a live database: `prisma validate`, `prisma
  generate`, and the DDL-equivalence check described above under TESTED.
  Before deploying, run `prisma migrate deploy` against a staging copy of
  the production database first, per this repo's own existing practice.

## SECURITY

Verified by the test suite (see TESTED above) — ownership, signature
verification, idempotency, and injection resistance:
- **Ownership**: `GET /api/assistant/analysis/[id]` returns 404 (never 403)
  for another user's analysis or an anonymous request — the id space is not
  enumerable.
- **Signature verification**: forged webhook signatures are rejected before
  any database write; a signature valid for a different payload is rejected
  when presented with a tampered body.
- **Idempotency**: a Stripe webhook delivered twice grants credits exactly
  once (real unique-constraint collision, not a status-flag check alone); a
  duplicated analysis request under the same client-minted key never charges
  twice.
- **Price/amount tampering**: the checkout route ignores any client-supplied
  price or credit count — `CREDIT_PACK` (server constant) always wins. The
  analysis run route's request schema has no cost field at all; the server
  constant `ANALYSIS_CREDIT_COST` is the only source of truth.
- **Insufficient credits**: refused with 402 before any charge.
- **Auth boundary**: checkout, run, wallet, and analysis-fetch all require a
  session; all reject anonymous requests.
- **Not separately verified in this pass** (flagging honestly rather than
  silently skipping): concurrent-request race conditions on the SAME
  idempotency key beyond the unique-constraint fallback path exercised in
  the fake-db test; rate-limit behavior under sustained load; a real
  Postgres's actual transaction-isolation behavior under true concurrency
  (the in-memory fake db in tests is not a substitute for Postgres's own
  MVCC — the code path is written to rely only on the unique-constraint
  guarantee any correct database provides, but this was not proven against
  a real database in this environment for the reason stated above).

## COMMERCIAL FLOW

```
homeowner in /assistant
  -> free conversation, Project Decision State accumulates
     (objective, sell horizon, sqft, target floor, services)
  -> "give me the detailed analysis" (or the model judges context is rich
     enough) -> propose_renovation_analysis tool -> offer card:
     exact deliverable, exact cost (15 Renovation Credits), one CTA
  -> signed out -> /login?callbackUrl=/assistant (workspace state survives
     via existing localStorage persistence, untouched by this work)
  -> signed in, insufficient credits -> "Buy Renovation Credits"
     -> POST /api/assistant/analysis/checkout -> Stripe Checkout
     -> (Stripe test payment) -> checkout.session.completed webhook
     -> Order marked PAID (existing path, unmodified) -> credits granted
        (new path, idempotent) -> redirect back to /assistant
     -> client polls /api/assistant/credits/wallet (never trusts the
        redirect itself as proof of payment) -> narrates the real balance
  -> signed in, sufficient credits -> "Run the analysis"
     -> POST /api/assistant/analysis/run -> eligibility re-checked
        server-side -> atomic charge + deterministic engine run ->
        RenovationAnalysisResult persisted, owned by this user
  -> result rendered inline: decision, current context (tagged), sequence,
     cost view (real Ecowoods bands where they apply, explicit
     "unavailable" for out-of-scope trades), value/timing, risks, one
     concrete next step
  -> next step links back into the existing Next step / ConversionPanel
     (measure/estimate/quote) when floor work is in scope
```

## REMAINING GAPS

- **No real Stripe test-mode transaction was executed** — see REAL PAYMENT
  VERIFICATION above and the manual procedure there.
- **No live Postgres migration run** in this environment — see PRODUCTION
  DATABASE MIGRATION SAFETY above.
- **No live browser session against `/assistant`** (production or dev) was
  driven in this pass — this work was verified through the real route
  handlers and the real engine, not through a browser. A visual/UX pass
  (mobile paywall, desktop purchase flow at real viewport sizes) has not
  been done and should be, before calling the purchase experience itself
  proven.
- **Free chat transcript persistence** (as opposed to Project Decision
  State, which already survives via localStorage) does not survive a
  refresh — this is a pre-existing property of `/assistant`, not something
  this phase changed, but it means a homeowner who refreshes mid-conversation
  loses the visible conversation even though their underlying project
  context and any saved analysis do not disappear.
- **No RESERVE-based reservation for a future async engine** — today's
  engine is synchronous and the wrapping database transaction is the
  reservation; the `RESERVE`/`RELEASE` enum values exist in the schema for
  a future asynchronous engine but no code path writes them yet. Documented
  in the schema and in `lib/credit-ledger.ts`, not a silent gap.
- **Price is not experiment-tracked** — `CREDIT_PACK`/`ANALYSIS_CREDIT_COST`
  are two constants in one file, deliberately not a versioned pricing table
  (see that file's own comment on why). Changing the price today is a code
  change, not a config change; if this business wants to A/B price without a
  deploy, that is unbuilt.
- **Unit economics / actual provider cost tracking** was not built — the
  analysis engine makes no external API call today (no per-run "provider
  cost" exists to record), so ANALYSIS_CREDIT_COST vs. actual cost is,
  honestly, currently "cost ≈ $0, price = $19/40 credits ≈ $0.71/analysis" —
  not a meaningful unit-economics claim, just an accurate one for a
  deterministic, non-LLM engine. If a future version of this engine adds a
  model call, this is the first place that needs a real number.
- **Report generation** ("turn this into a saved PDF/report") was
  explicitly out of scope for this phase and not built.
- **Mobile/desktop QA at specific viewport sizes**, and a security-adversary
  pass beyond what the automated tests above cover, were not performed as
  separate exercises in this pass.

## COMMITS

See the branch `claude/phase-4-customer-journey-jmy9ky` for the commit(s)
implementing this document. Commit hash(es) and PR link (if a PR is opened)
to be added once pushed.
