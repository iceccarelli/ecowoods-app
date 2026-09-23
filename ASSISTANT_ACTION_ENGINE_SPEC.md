# Ask Francisco — action engine spec (2026-09-23)

What "the action engine" means concretely in this codebase, what Phase 2
added, and where the next increment goes. See `ASSISTANT_CONTEXTUAL_ACTIONS_SPEC.md`
(prior pass) for the card taxonomy this extends, and
`ASSISTANT_PHASE2_AUDIT.md` for why each piece was built this way.

## The model does not invent sequencing logic anymore

**Before:** "kitchen vs floor vs roof, what should I do first?" was answered
entirely by the model's own reasoning in free text. Two visitors with
identical stated facts could get different orderings, with no way to audit
why, and no way to test it — the logic lived only inside a prompt.

**Now:** `lib/assistant-workspace/renovation-analysis.ts`'s
`computeRenovationSequence(state)` is a pure, deterministic, unit-tested
function. It:

1. Reads only what the visitor actually said — `state.personalization.otherTrades`
   (set via `attach_to_project`'s new `trade`/`tradeStatus` args) and
   `state.objective`/`targetFloor`/`floorCondition` for the floor project.
   Never infers a project nobody mentioned.
2. Applies two general, defensible sequencing principles — envelope/structural
   work (roof, foundation, siding, windows) before interior finishes
   regardless of sell horizon; when selling within a year, floors (highest
   showing impact per dollar) rank ahead of a same-tier interior trade like
   a kitchen. These are stated as general contractor guidance in the
   `reason` string, never as a claim about THIS house's condition or
   urgency — it never says "your roof is failing."
3. Never assigns a dollar figure to anything (asserted by
   `renovation-analysis.test.ts`'s "never invents a dollar figure" test).
4. Returns `null` when fewer than two projects are known — zero cards is
   correct, not a missing feature.

`analyze_renovation_priorities` (new tool, `chat-tools.ts` +
`app/api/assistant/chat/route.ts`) is the model's only way to get a
sequencing answer — the system prompt tells it to call the tool rather than
reason about order itself, and to narrate `result.summary` rather than
inventing a competing one.

## Card selection: server-enforced, not just prompted

The four-type card taxonomy from the prior pass is now six:
`ecowoods_band`, `pending_provider`, `site_link`, `conversion_proposed`
(existing) plus `analysis_available` and `paid_analysis_proposed` (new,
backing `analyze_renovation_priorities`). Every type still maps to one real
tool/data source — nothing was added without a capability behind it.

`AssistantChatCard` gained three optional fields, additive to the existing
contract (directive rule 12: "extend, don't duplicate"):

- `id` — stable per action instance (e.g. `band:white-oak:900`,
  `analysis:kitchen,roof`, `conversion:measure`), not per render. Every card
  builder in `chat-tools.ts` now sets one.
- `reason` — why THIS card, grounded in stated project facts
  (`propose_conversion`'s caller-supplied reason, `analyze_renovation_priorities`'s
  per-item rationale). Distinct from `body` so the UI can render it as a
  visually quieter secondary line (directive rule 19).
- `cta` — an explicit override for the link/action label, falling back to a
  per-type default in `ConversationPane.tsx`'s `cardLinkLabel()`.

**Action memory is enforced server-side, not just requested of the model.**
`WorkspaceActionMemory` (`dismissed: string[]`, `completed: string[]`) lives
on `WorkspaceState`. The client sends it in every chat request (part of
`workspaceSnapshotSchema`); `route.ts` runs every turn's cards through
`filterDismissedCards(cards, dismissedIds)` before the response goes out —
so a dismissed card cannot reappear even if the model tries to re-propose it
(the system prompt also lists dismissed ids and tells the model not to
re-call the tool for them, but that's belt, not suspenders — the filter is
the actual guarantee). `ConversationPane.tsx` renders a "Not now" button on
every card that has an `id`; clicking it calls
`WorkspaceStateProvider`'s new `dismissAction(id)` (→
`state.ts`'s `recordActionDismissed`, append-only, idempotent) and removes
the card from the currently-displayed message immediately.

## What's still open (ordered, per directive rule 52)

- **`completed` tracking has a mutator (`recordActionCompleted`) but no
  caller yet.** The natural trigger is `ConversionPanel`'s confirm step
  (mark the `conversion:*` id completed once the real `Appointment`/
  `QuoteRequest` write succeeds) — small, but not done this pass; wiring it
  needs a look at `ConversionPanel.tsx`'s confirm handler this pass didn't
  touch to keep the change scoped.
- **`earned-catalog.ts`'s `ProductCard`/`ServiceCard` grid does not consult
  `actionMemory` yet.** It's a different mechanism (deterministic function
  of accumulated state, not a per-turn tool call — see the audit doc), and
  neither `ProductCard` nor `ServiceCard` has a dismiss affordance in the UI
  today. Adding one means touching those two components and
  `recommendations.ts`'s output shape — scoped as the next increment, not
  bundled into this pass to keep the diff reviewable.
- **The extended taxonomy the Phase 1 spec listed** (`comparison`, `report`,
  `document_review`, `measure`/`quote` as their own types rather than folded
  into `conversion_proposed`) is still future work — same reasoning as
  before: only add a type once there's a real capability behind it.
