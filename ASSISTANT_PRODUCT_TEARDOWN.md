# Ask Francisco — product teardown (2026-09-23)

Scope: `/assistant` on `main` as of `50bce3f` (PR #132, merged). This is a
factual teardown against the live architecture, not a rewrite proposal — the
underlying system (Project Decision State, `recommendations.ts`,
`chat-schema.ts`, the tool-calling route) is already close to the target
described in the Ask Francisco directive. One concrete bug accounts for most
of the "still feels like a catalogue" complaint; everything else below is
smaller and lower priority.

## The bug: a persistent catalogue block, not a turn-scoped one

`ConversationPane.tsx` computed `products`/`services` from
`recommendProducts(state)` / `recommendServices(state)` — **current full
state**, not the current turn — and rendered a "Worth considering" +
"Services" block gated only on:

```ts
const showEarnedCatalog = Boolean(state.objective && messages.length > 0);
```

That condition has nothing to do with what the visitor's latest message was
about. Once `state.objective` was set by any earlier turn (e.g. "my oak
floor is scratched" → `objective: 'refinish'`), **every subsequent reply**
kept showing the same flooring ProductCard/ServiceCard grid underneath it —
including a reply to "kitchen vs roof vs floors, what should I do first?",
which has nothing to do with flooring species or Ecowoods services. This is
exactly the "Worth considering: White Oak / Red Oak" complaint: the catalogue
wasn't reacting to intent, it was reacting to state persistence.

Note this is a different code path from the model's own `cards` array
(`AssistantChatResponse.cards`, populated by actual tool calls the model made
that turn — `get_ecowoods_band`, `find_on_site`, etc.) — those were already
correctly turn-scoped and capped at 2. The bug was specifically the
second, independent catalogue block layered underneath.

**Fix applied:** extracted `computeEarnedCatalog(state, turnPatch)` into
`lib/assistant-workspace/earned-catalog.ts` — a pure function, same
discipline as `recommendations.ts`. It returns a catalogue only when *this
turn's patch* (from `attach_to_project` or the keyword fallback) actually
named a floor-relevant field (`objective`, `targetFloor`,
`selectedServiceSlugs`, `stairs`); everything else returns `undefined`. The
result is attached to the specific `DisplayMessage` it answers, not to a
floating block after the whole transcript — so it renders once, with the
answer that earned it, and does not resurface on a later, unrelated reply.
Covered by `earned-catalog.test.ts`, including the exact "objective already
set, this turn is unrelated" regression.

## What was already right (kept as-is)

- **Cards generated with the answer, not fetched after.** `route.ts` builds
  `cards`/`patch`/`providers` inside the same `generateText` tool-calling
  pass that produces `reply` — there is no separate "fetch generic products"
  step (directive rule 11/37).
- **No fabrication.** `get_house_profile` / `get_market_cost` /
  `get_want_vs_value` return `pending_key`/`unavailable` honestly when no
  licensed adapter exists; the system prompt explicitly forbids inventing
  AVMs, contractor identities, ratings, or a fourth price band. Every
  `ProductCard`/`ServiceCard` renders a real `FLOOR_PRODUCTS`/`SERVICES`
  entry — `recommendations.test.ts` already asserts no id ever escapes the
  live catalog.
- **Answer length discipline.** The system prompt already caps replies at
  ~120 words, in the directive's 60–180 word range.
- **Commercial scope guardrail.** The prompt hard-blocks claiming Ecowoods
  installs kitchens/roofs/HVAC/etc.; non-floor trades route through
  `get_market_cost`, which is honest about `pending_key` rather than
  fabricating a partner or a quote.
- **No forced conversion / no surprise writes.** `propose_conversion` only
  sets `nextAction`; the actual `Appointment`/`QuoteRequest` write happens
  only after the visitor confirms in `ConversionPanel` — verified by
  `assistant-conversion-flow.test.ts` against the real route handlers.

## Smaller gaps, not fixed in this pass (lower priority / larger scope)

These are real but are either much larger changes than the single bug above,
or need product decisions this pass shouldn't make unilaterally:

1. **No "rejected, stop resurfacing" memory.** `recommendations.ts`'s
   no-empty-shelf rule (return the full catalog when nothing is known) is
   intentional per its own doc comment, but there's no tracking of a product
   or service the visitor has already dismissed. Rule 23 of the directive
   ("if a user rejects a product/service, remember that") is not implemented.
2. **Card taxonomy is narrower than the directive's SERVICE/ANALYSIS/
   ESTIMATE/REPORT/MEASURE/QUOTE/PARTNER_TRADE/DOCUMENT_REVIEW set.**
   `AssistantChatCard.type` is currently `'ecowoods_band' | 'pending_provider'
   | 'site_link' | 'conversion_proposed'`. It already distinguishes intent by
   type; visually differentiating each type (rule 9) is a front-end styling
   task, not touched here to keep this change scoped to the actual bug.
3. **No paid-intelligence / credit funnel exists yet.** `get_house_profile`,
   `get_market_cost`, `get_want_vs_value` are all `pending_key` today — there
   is no credit balance, cost-before-execute confirmation, or paid analysis
   product to wire monetization rules 16–21 into. Building that is a
   standalone, much larger feature, not a UI bug fix.
4. **Mixed-trade cards (rule 7/26)** can't be built honestly yet — there are
   no verified external trade partners in the data layer, and the directive
   is explicit that a generic "Estimate roof replacement" action must not be
   invented as if it were a partner. This is correctly absent, not missing.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors.
- `pnpm exec vitest run` — 79 files / 1228 tests pass, incl. 9 new
  `earned-catalog.test.ts` cases.
- `node scripts/verify-assistant.mjs` — passes (also fixed a pre-existing,
  unrelated literal-string violation in the same file while it was open).
