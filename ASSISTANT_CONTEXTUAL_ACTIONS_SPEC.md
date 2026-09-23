# Ask Francisco — contextual actions spec (2026-09-23)

This documents the action/card system as it exists after this pass, and
scopes the directive's larger action-taxonomy / action-selection-layer /
monetization asks as follow-up work rather than pretending they shipped.
See `ASSISTANT_RUTHLESS_PRODUCT_AUDIT.md` for the verification and reasoning
behind what did and didn't ship in this pass.

## Current model: one tool-calling pass, four card types

```
user message + conversation history + workspace snapshot
        ↓
generateText({ system: ASK_FRANCISCO_SYSTEM_PROMPT + catalog hints + state, tools })
        ↓                                              (one pass, stopWhen: stepCountIs(8))
reply text  +  patch (WorkspacePatch)  +  cards (AssistantChatCard[])  +  providers
        ↓
ConversationPane renders: reply, then 0–2 cards from THIS turn only,
                            then the earned-catalog block IF this turn's
                            patch touched a floor-relevant field
```

This already satisfies the directive's core architectural requirement (rule
15): cards are produced in the same pass as the reply, from tool calls the
model actually made about this specific message — not fetched afterward from
a static recommender keyed on whatever `state.objective` happens to be.
`earned-catalog.ts`'s turn-scoping (PR #133) is the same discipline applied
to the older "Worth considering" product/service block.

`AssistantChatCard.type` today (`chat-schema.ts`):

| type | produced by | meaning | href? |
|---|---|---|---|
| `ecowoods_band` | `get_ecowoods_band` | Real published Ecowoods CAD range for floor/stair work | no |
| `pending_provider` | `get_house_profile`, `get_market_cost` (non-floor trade), `get_want_vs_value` | Honest "no licensed adapter yet" — never a fabricated number | no |
| `site_link` | `find_on_site` | A real page on ecowoods.ca | yes |
| `conversion_proposed` | `propose_conversion` | Measure/estimate/quote proposed this turn, pending confirmation in `ConversionPanel` | no |

Zero cards is a normal, exercised outcome (a turn that only calls
`attach_to_project`, or calls nothing). Cards cap at 2 per turn
(`ConversationPane.tsx`: `data.cards.slice(0, 2)`).

## Gap vs. the directive's taxonomy, and why it's a separate change

The directive describes a wider vocabulary — `explanation | analysis |
estimate | comparison | report | ecowoods_service | ecowoods_product |
measure | quote | document_review | other_trade | site_resource` — plus a
standalone action-selection layer that takes shown/clicked/rejected history
as input and a card lifecycle (`proposed → viewed → selected → executing →
completed → dismissed`).

The current four types already map cleanly onto four of those concepts
(`ecowoods_band` ≈ `estimate`, `pending_provider` ≈ an honest `analysis`
gap, `site_link` ≈ `site_resource`, `conversion_proposed` ≈ `measure`/
`quote`). Widening the union to the full list is real, multi-file work with
no shortcut:

1. **`chat-schema.ts`** — extend `AssistantChatCard.type`, and decide what
   new structured fields (`reason`, `confidence`, `resultType`, `metadata`)
   actually need to exist vs. what's already inferable from `type` + `body`.
   Directive rule 10 explicitly says "extend, don't duplicate" — most of
   those fields (price, provider, category) already live on the real
   catalog objects (`FLOOR_PRODUCTS`, `SERVICES`, `bandForWork`'s output);
   the card should reference them, not re-carry a shadow copy.
2. **`chat-tools.ts`** — every existing executor's card-building branch, plus
   new tool(s) for the taxonomy entries with no executor yet
   (`comparison`/`report`/`document_review` have no data source at all
   today — building the tool means deciding what real data backs them,
   which is a product decision, not a refactor).
3. **`system-prompt.ts`** — the model needs to be told when each new type
   applies, or it will default to the four it already knows.
4. **Card renderer** (`ConversationPane.tsx` + CSS) — each new type needs its
   own visual treatment per directive rule 34, not just a new
   `data-card-type` value falling back to the generic style.
5. **Rejection/completion memory** — nothing today tracks "the visitor
   already dismissed this" across turns; `WorkspaceState` would need a new
   field, `earned-catalog.ts` and the tool layer would both need to read and
   respect it. This is the one piece of directive rule 31/32 with zero
   existing scaffolding to extend.

None of the above shipped in this pass, on purpose: it's a schema +
tool-calling + prompt + UI change with product decisions embedded in it
(what does "report" actually deliver? what backs "comparison" beyond what
the model can already say in prose?), and shipping it unverified alongside
a verified layout fix would risk both. It's the next PR, not a same-pass
addition.

## Monetization — explicitly not attempted, and what would be needed

Directive rules 23–26 and 42–46 describe an in-conversation paywall: a
free-preview moment, an exact credit cost shown before execution, a
server-side credit ledger, and "never silently deduct, never charge an
action that never executes." None of the server-side pieces this depends on
exist yet — no credit balance model, no pricing config, no payment-gate
route. `get_house_profile` / `get_market_cost` / `get_want_vs_value` all
correctly return `pending_key` today rather than a half-built paid flow.
Building this is its own feature with real billing-safety surface area
(the directive's own rule 44 is a hard constraint, not a nice-to-have) and
should be scoped and reviewed as such — not bolted onto a layout/card-styling
pass.

## What's safe to build next, in order

1. **Rejection memory** — smallest, self-contained, no schema migration to
   the response contract (`WorkspaceState` gets a `rejectedActionIds`-style
   field; `earned-catalog.ts` and the tool executors read it). Directly
   fixes directive rule 31 ("don't repeatedly offer what was ignored").
2. **Extend `AssistantChatCard.type`** for the entries that already have a
   real data source today (`ecowoods_service`/`ecowoods_product` as
   distinct types instead of both being folded into `ecowoods_band`'s
   sibling recommendation cards; `site_resource` as the renamed, clearer
   `site_link`). This is a rename/split of existing, tested behavior, not
   new data.
3. **`document_review` / `comparison` / `report`** — only once there's an
   actual capability behind them (a real comparison engine, a real
   generated report) — building the card type before the capability exists
   would be exactly the "invented action" the directive prohibits.
4. **Monetization** — after 1–3, as its own reviewed feature with a real
   credit ledger and payment-gate design.
