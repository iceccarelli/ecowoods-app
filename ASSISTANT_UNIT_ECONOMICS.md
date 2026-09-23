# Ask Francisco — unit economics (2026-09-23)

Directive rule 44: for every potential paid action, know model cost,
external API cost, storage cost, processing cost, customer price, and
margin — before shipping it as paid. This pass ships the free tier of the
wedge product (`renovation-analysis.ts`) and specifies, but does not price,
the paid tier (`ASSISTANT_MONETIZATION_SPEC.md`). This document is the cost
side of that decision — what's actually measurable today, and what genuinely
requires a business call this pass can't make unilaterally.

## What's real and measurable right now

**Model cost per conversation turn** — every `/api/assistant/chat` call is
one `generateText` pass, `claude-sonnet-4-6`, capped at `stepCountIs(8)` tool
round-trips. The system prompt (`system-prompt.ts`) plus
`siteCapabilitiesBlock()` + `catalogHintsBlock()` + the workspace state JSON
dump is the fixed input-token floor per turn; conversation history grows
linearly with turn count (the full transcript is re-sent every turn — no
truncation or summarization exists today). This is the single largest,
most direct lever on cost per conversation, and it's already visible in the
code, not hidden behind an opaque provider bill — see "what to measure"
below.

**`renovation-analysis.ts`'s free tier costs nothing beyond the surrounding
model turn.** It's a pure function — no LLM call, no external API, no
storage write. Running it adds no marginal cost over the conversation turn
that already happened. This matters directly for pricing the paid tier: the
*computation* backing the deep analysis is already free to produce; what a
homeowner would actually be paying for is the written/formatted deliverable
and the fact that Francisco recognized the moment — not compute.

**External API cost today: $0**, because none of the pending_key adapters
(house profile, non-floor market cost, want-vs-value) are live. The moment
any of them ships with a real licensed provider, that provider's per-call
cost becomes a real, provider-quoted number to plug into this document —
not something to estimate now.

**Storage cost today: $0** beyond existing `WorkspaceState` localStorage (no
server storage cost) — no report, transcript, or generated document is
persisted server-side yet.

## What this pass cannot responsibly fill in, and why

- **Customer price per analysis.** This is the number `ASSISTANT_MONETIZATION_SPEC.md`
  explicitly declines to invent (directive rule 35) — it is a business
  decision about positioning and willingness-to-pay, not a cost-recovery
  calculation alone. A useful anchor once the business sets a candidate
  price: `well-installed-review`'s existing `REVIEW_TIERS` (already-live,
  already-priced human-reviewed product) is the closest comparable in this
  codebase for "what does a homeowner already pay for expert judgment on
  this site" — worth checking against before picking a number, not copying
  directly (a deterministic sequencing pass and a human-reviewed contractor
  quote review are different depths of work).
- **Actual $/1M-token rate for the model in production.** This document
  intentionally does not print a specific dollar figure per token, because
  that number moves independently of this codebase (provider pricing
  changes, and this repo's own `claude-api` skill is the source of truth for
  current rates, not a number hardcoded into a spec doc that will drift).
  Anyone pricing this feature should read current rates from that skill at
  decision time, not from a stale figure written here.
- **Contribution margin.** Directly requires the two numbers above; cannot
  be computed without them.

## What to actually measure once this ships (the instrumentation this pass
did NOT build, and should, before a price is set)

1. **Average input/output tokens per `/api/assistant/chat` call**, broken
   out by whether `analyze_renovation_priorities` was called that turn —
   the AI SDK's `generateText` result already carries `usage` (input/output
   token counts); nothing in `route.ts` logs it today. Cheapest first step:
   log `result.usage` alongside the existing
   `assistant.chat.failed`-style structured log on success too, not just on
   error.
2. **Conversation length distribution** — since the full transcript resends
   every turn, cost per conversation is closer to quadratic than linear in
   turn count. Knowing the real distribution (most conversations 3-5 turns?
   20+?) matters more for cost control than any single per-turn number.
3. **`deepAnalysisEligible` hit rate** — what fraction of real conversations
   actually reach the gate. This is the true top-of-funnel number for
   sizing the paid product; it requires the analytics event
   `paid_action_view`-equivalent (directive rule 43) to exist, which this
   pass did not add (see below).

## Analytics gap this pass leaves open

Directive rule 43 lists a specific event taxonomy (`intent`,
`project_context_added`, `action_generated`, `action_viewed`,
`action_clicked`, `action_dismissed`, `paid_action_view`, etc.). This pass
did not wire any of them into `lib/analytics.ts`'s existing
`AnalyticsEvent` union — the personalization/action-memory changes are real
and functional (verified by unit tests), but nothing observes them in
aggregate yet. Recommended next increment, small and mechanical: emit
`action_generated` (with `type`, no free text) when a card renders,
`action_dismissed` (with `id`'s type prefix only, e.g. `"conversion"`, never
the full id if it could ever encode anything sensitive) when `dismissAction`
fires, and `deep_analysis_eligible` when `deepAnalysisEligible` flips true
for a session — three events, using the existing `track()` call already
used elsewhere in `WorkspaceShell.tsx`, no new infrastructure.
