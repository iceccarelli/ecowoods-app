# Ask Francisco — Phase 2 audit (2026-09-23)

Scope: `/assistant` on `main` as of `c5b4fe1` (PR #134, merged — composer
viewport fix + card visual taxonomy). This audits the real system before
Phase 2 changes, answering the directive's audit questions against the code,
not against the product description.

## What does Francisco know?

Before this pass, `WorkspaceState` (`types.ts`) held: `objective`,
`sellHorizon`, `stairs`, `rooms` (label + optional sq ft), `currentFloor` /
`targetFloor` (catalog ids only), `selectedServiceSlugs`, `pendingQuestions`,
`nextAction`. All catalog-id-validated, all visitor-stated, none inferred —
this discipline was already correct and is unchanged.

**Gap found:** no field existed for the location ("I'm in Rexdale"), the
current floor's stated condition ("scratched and dull"), or a non-floor trade
the visitor mentioned wanting done ("the roof is old"). The model could see
these in the raw conversation history each turn, but `attach_to_project` had
no schema slot to persist them — so nothing stopped the model from asking
again next turn, and nothing let a deterministic engine reason over them
later in the same conversation.

## What does Francisco remember, and what does he forget?

Within one conversation: the message history is sent whole on every
`POST /api/assistant/chat` call (`ConversationPane.tsx`'s `history`), so nothing
is literally forgotten mid-conversation — but nothing was *structured* either.
`attach_to_project`'s coverage stopped at floor/service facts, so the model's
only way to "remember" a mentioned trade or a location was to re-read raw
prior turns and hope it noticed — not a memory guarantee, a re-comprehension
hope. Across conversations (a reload): `persistence.ts` saves the whole
`WorkspaceState` to localStorage keyed by `designId`, so structured fields
survive a reload; anything that only ever lived in prose never did.

**Rejected/completed actions:** no memory existed at all. A card the visitor
ignored or explicitly didn't want could be proposed again on a later turn —
directive rule 20/31 was unimplemented, not partially implemented.

## What actions can Francisco currently generate?

Four `AssistantChatCard` types, each backed by a real tool/data source
(`chat-tools.ts`): `ecowoods_band` (published price range),
`pending_provider` (an honest "not available yet" gap), `site_link` (a real
page), `conversion_proposed` (measure/estimate/quote, user-confirmed).
`earned-catalog.ts` separately renders `ProductCard`/`ServiceCard` grids,
turn-scoped since PR #133.

**Which cards are generated from the actual conversation, vs. deterministic
catalog output?** The four `AssistantChatCard` types are genuinely
conversation-generated — they come out of tool calls the model made about
the specific message, in the same `generateText` pass as the reply (verified
in the prior audit, `ASSISTANT_RUTHLESS_PRODUCT_AUDIT.md`). The
`ProductCard`/`ServiceCard` "earned catalogue" is a hybrid: turn-scoped (only
appears when this turn's patch touched a floor field) but its *contents* are
still `recommendProducts(state)` / `recommendServices(state)` — a
deterministic function of accumulated state, not of what this specific turn
said. That's a legitimate design (it answers "given everything I now know,
what's relevant"), not a bug, but it is a different mechanism from the four
tool-driven card types, worth naming precisely rather than lumping together.

## Which actions can actually execute, vs. exist only as prose?

Execute: `attach_to_project` (writes to state), `propose_conversion` →
`ConversionPanel` → real `Appointment`/`QuoteRequest` write (existing,
untouched). Prose-only, by design and honestly labeled: `get_house_profile`,
`get_market_cost` (non-floor trades), `get_want_vs_value` — all correctly
`pending_key`, no fabrication. **Bug found and fixed in this pass:** the
`pending_key` status word itself, and the word "adapter," were leaking
straight into `card.body` — text rendered verbatim to the homeowner. Rule 24
of the directive names this exact failure ("never say pending_key to a
homeowner"). Fixed — see `ASSISTANT_PERSONALIZATION_SPEC.md`.

## Which valuable actions exist only as prose that Phase 2 should make real?

Renovation sequencing ("kitchen vs floor vs roof, what first?") was entirely
the model's own reasoning in free text — no deterministic engine backed it,
so two conversations with identical stated facts could get different
sequencing logic from the model, and there was nothing a homeowner could
audit ("why this order?"). Built in this pass: `renovation-analysis.ts`, a
pure, testable, rule-based sequencing function — see
`ASSISTANT_ACTION_ENGINE_SPEC.md`.

## Which expensive capabilities could become paid products?

The directive's wedge (rule 26, "Renovation Decision Analysis") maps
directly onto `renovation-analysis.ts`'s `deepAnalysisEligible` gate: once
enough independent signals are known (2+ projects, 4+ total signals), a
richer written version is a real, definable deliverable — priority order,
sequencing rationale, what's still unknown, next actions per project. What
Phase 2 does NOT do is wire it to real money — see `ASSISTANT_MONETIZATION_SPEC.md`
for why, and what "architecture first, configuration second, payment
implementation third" (directive rule 35) means concretely here.

## Payment infrastructure already in the repo (do not duplicate)

- `lib/stripe.ts` — the Stripe client singleton, live-usable.
- `lib/auth.ts`, `app/api/auth/[...nextauth]/route.ts` — Auth.js, sessions.
- Prisma: `User`, `Order`, `OrderItem`, `Product`, `Payment`, `Invoice`,
  `Settings` (has `defaultTaxRate`) — a real commerce schema already exists.
- **Precedent for a paid-intelligence product**: `app/api/well-installed-review/checkout/route.ts`
  + `lib/well-installed-review.ts` (`REVIEW_TIERS`, `resolveReviewTier`,
  `buildReviewOrderItem`) is *exactly* the shape rule 26 asks for — a guest
  (no-login-required) checkout, server-resolved price from a tier config
  (never client-sent), an `Order`/`OrderItem` row, the existing Stripe
  webhook (`app/api/webhooks/stripe/route.ts`) marking it `PAID` from
  `metadata.orderId` with no second webhook handler needed. **Any future
  paid-analysis checkout should extend this pattern, not invent a second
  commerce path or a `CreditWallet`/`CreditTransaction` table before
  checking whether `Order`/`OrderItem` already covers it** — see
  `ASSISTANT_MONETIZATION_SPEC.md`.

No `CreditWallet`, `CreditTransaction`, or credit-ledger table exists yet.
Nothing in this pass adds one to `prisma/schema.prisma` — a schema migration
against a real database is exactly the kind of hard-to-reverse, shared-state
change that needs human review and a confirmed target database, neither of
which this sandboxed pass has. It's scoped, not built — see
`ASSISTANT_MONETIZATION_SPEC.md`.

## What Phase 2 actually built (see the other specs for detail)

1. `WorkspacePersonalization` (`neighbourhood`, `floorCondition`,
   `otherTrades`) on `WorkspaceState` — `ASSISTANT_PERSONALIZATION_SPEC.md`.
2. `WorkspaceActionMemory` (`dismissed`, `completed`) + a "Not now" dismiss
   affordance, enforced server-side (`filterDismissedCards`) — same doc.
3. `renovation-analysis.ts` — the real sequencing engine — `ASSISTANT_ACTION_ENGINE_SPEC.md`.
4. `analyze_renovation_priorities` tool + `analysis_available` /
   `paid_analysis_proposed` card types — same doc.
5. `pending_key`/"adapter" language removed from every homeowner-facing card
   body; system prompt shortened and given the minimum-question /
   never-re-ask rules — `ASSISTANT_PERSONALIZATION_SPEC.md`.
6. Monetization: architecture and sourcing requirements only, no live price,
   no new Prisma model — `ASSISTANT_MONETIZATION_SPEC.md`.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm exec vitest run` — 80 files / 1247 tests pass (19 assistant-workspace
  tests new since the pre-Phase-2 baseline of 1228: `renovation-analysis.test.ts`,
  a new file, 5 tests; `chat-tools.test.ts` +8; `state.test.ts` +6).
- `node scripts/verify-assistant.mjs` — passes.
