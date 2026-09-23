# Ask Francisco — paid product spec (2026-09-23)

## The one product (directive rule 3, 9, 51)

**Renovation Decision Analysis** — `content/constants/renovation-analysis-product.ts`.
20 Renovation Credits, one credit pack (20 credits / $20 CAD, exactly enough
for one analysis — no leftover balance to explain on a first purchase).

What the customer buys: **help deciding what to do with THIS house** — not
AI messages, not tokens, not generic content. The free tier
(`analyze_renovation_priorities` → `computeRenovationSequence`) already
gives a real priority order and one-line reasoning per item. The paid tier
(`buildDetailedRenovationAnalysis`) expands that into: per-item cost
context (a real published Ecowoods band where the floor project has enough
inputs; an honest "no verified cost data" for every non-floor trade — never
an invented number), explicit assumptions the order rests on, what's still
uncertain, and one concrete next step per item.

## Gate: when the offer appears (Phase 2, unchanged by Phase 3)

`RenovationSequenceResult.deepAnalysisEligible` — true once 2+ projects and
4+ independent signals are known. This is the "the assistant has
demonstrated useful understanding" moment (directive rule 5, 25) — the free
preview (the numbered sequence + one-line reasons) always renders first,
in the SAME turn, before the paywall card. Nobody sees a price before
seeing value.

## The purchase (real, Phase 3)

`PaidAnalysisAction.tsx`, mounted inline in the conversation where the
`paid_analysis_proposed` card is — never a separate pricing page (directive
rule 18). States:

1. Not signed in → "Sign in to run this" → `/login?callbackUrl=/assistant`.
2. Signed in, balance < 20 → "You have N credits — 20 required" + **Buy
   credits** → `POST /api/assistant/credits/checkout` → real Stripe
   Checkout redirect.
3. Signed in, balance ≥ 20 → **Analyze my house** → `POST /api/assistant/analysis/run`.

No dark patterns (directive rule 19): no countdown, no "limited time," no
auto-renewal (one-time purchase only — see `ASSISTANT_PAYMENT_SPEC.md`),
copy states exactly what's received before the price, per rule 43's
preferred phrasing ("I can do the deeper analysis now" / "This uses 20
Renovation Credits" / "You'll receive...").

## Account gating (directive rule 11-12)

Free conversation stays fully anonymous — `attach_to_project`,
`analyze_renovation_priorities`, and the free sequence card require no
account. An account is required at exactly the moment persistence/purchase
genuinely matters: buying credits, running the paid analysis, reading a
saved result back later. Reuses Auth.js — no second identity system.

**Continuity**: `WorkspaceState` (the project facts — location, sell
horizon, floor condition, mentioned trades) persists in localStorage keyed
by `designId` regardless of sign-in state, so a visitor who signs in and
returns to `/assistant` has their project intact and Francisco still never
re-asks what's already known. **Known gap**: the conversation TRANSCRIPT
(the message bubbles) is React state, not persisted — a round trip through
Stripe Checkout resets the visible transcript to one seeded "Payment
complete, picking up where we left off" message, even though the
underlying project facts are intact. See `ASSISTANT_CONVERSION_FUNNEL.md`'s
limitations section — this is a real, named gap, not silently accepted.

## Two commercial layers, kept separate (directive rule 31)

Paid intelligence (this product) and Ecowoods physical work (measure →
quote → job, via the existing `propose_conversion` → `ConversionPanel`
flow) are separate. The analysis result's floor item links to a real,
personalized Ecowoods action (published band + "book a measure") using the
SAME `ecowoods_band`/`propose_conversion` machinery already in the
conversation — never a second, competing conversion path, and never framed
as required to have paid for the analysis first.

## What was NOT built (directive rule 37-38)

- The Renovation Decision Report (PDF/shareable) — explicitly deferred
  until the analysis loop itself is proven (rule 37).
- Subscription billing — one-time purchase only, per rule 10/38.
- A pricing page — the offer lives entirely in-conversation.
