# Ask Francisco — ruthless product audit (2026-09-23)

Scope: `/assistant` on `main` as of `24437b3` (PR #133, merged — the prior
pass that made the earned catalogue turn-scoped). This audit verifies the two
concrete failures named in the follow-up directive against the live code —
not against the product description — traces each to its root cause, fixes
the one that is a real architecture bug, and is honest about the size of the
work still open on the second.

## 1. The composer — verified, root-caused, fixed at the layout root

**Verification method.** Read the actual render tree
(`app/layout.tsx` → `app/assistant/page.tsx` → `WorkspaceShell.tsx` →
`ConversationPane.tsx`) and the CSS actually applied
(`app/globals.css`, the `.aha-*` rules), then measured it: `next dev`'s CSP
blocks the `unsafe-eval` webpack's dev runtime needs (documented already in
`lib/scroll-state.ts` — a pre-existing, unrelated constraint of this repo),
so — as that file's own note says — hydration verification has to run
against a production build. `next build && next start`, driven headlessly
with Playwright at 1440×900 and 390×844, both before and after the fix.

**Root cause.** Every layout rule that was supposed to pin the composer near
the bottom of the viewport was a **`min-height` guess**, not a height
ceiling:

```
.aha-conversation--canvas { min-height: calc(100dvh - var(--header-h, 72px) - 140px); }
```

`min-height` is a floor. It has no effect once content is taller than it. The
page itself had no outer height constraint either — `.aha-page` inherited
`.tlx-page`'s ordinary document-flow sizing (a marketing-page class, correct
for every other route on this site). So the actual layout was: sticky site
header → breadcrumb hero → workspace bar → a conversation column that grows
with its own content → the global `<SiteFooter />`, all in normal document
flow. With zero or one message, the `min-height` calc happened to leave the
composer near the fold, which is why this looked fixed in earlier passes.
The moment a conversation had more than a couple of turns, the flex column's
*content* height exceeded the `min-height` floor, the whole page grew to fit
it (`.aha-conversation` had `overflow: hidden` on itself, but nothing above
it in the ancestor chain had a bounded height for that clipping to matter
against), and the composer — plus the full marketing footer sitting directly
beneath it in the DOM — drifted below the fold exactly as reported. This is
not a few-pixels-off cosmetic issue; it is a box with no height ceiling.

**The fix (`apps/web/app/globals.css`, `apps/web/app/assistant/components/*`
untouched — CSS-only).** `.aha-page` is now the actual application shell:

```
.aha-page {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - var(--header-h, 72px) - var(--ub-h, 39px));
  min-height: 0;
  overflow: hidden;
}
```

`--header-h` / `--ub-h` are the same custom properties the sticky
`.site-chrome` (utility bar + nav) already publishes elsewhere in this
stylesheet — reused, not reinvented. Every child in the chain down to the
composer is now `flex: 1; min-height: 0` instead of a `min-height` calc:
`.aha-shell--conversation-first`, `.aha-conversation--canvas`. Because the
ancestor chain now has a **definite** height, `flex: 1; min-height: 0` is the
actual CSS mechanism for "this box gets exactly what's left, no more" — the
textbook fix for a flex child that needs to scroll internally instead of
growing its parent. Only `.aha-conversation-scroll` (already
`overflow-y: auto`) scrolls; the composer bar is a fixed-size flex sibling
that never moves, in a 5-turn conversation or a 50-turn one.

`body.aha-active .site-footer` changed from a spacing nudge
(`padding-top: var(--space-xl)`) to `display: none` — scoped to the
`aha-active` class `WorkspaceShell` already toggles only for the lifetime of
its own mount (see that component's existing effect), so every other route's
footer is untouched. With `.aha-page` now clipped to the viewport, the
footer was already unreachable by scroll; this additionally keeps it out of
the painted layout so it can never visually intrude between the conversation
and the composer, matching the directive's requirement 4 exactly (footer
not deleted globally, only de-emphasized while the workspace is mounted —
same mechanism this route already used for the topbar shadow).

**Verified (production build, Playwright, both viewports).**

| | 1440×900 | 390×844 |
|---|---|---|
| Composer bottom edge from viewport bottom | 40px (safe-area + composer-bar padding) | 25px (`env(safe-area-inset-bottom)` + padding) |
| Requires scrolling the page to reach the composer | No — composer is a fixed flex child, page never scrolls | No |
| Site footer visible/reachable while `/assistant` is mounted | No (`display: none` under `body.aha-active`) | No |
| Behavior across a 4+ turn conversation | Composer position unchanged; only the message list scrolls internally | Same |
| Horizontal overflow | None | None |

No `margin-top: -Npx` / `position: relative; top: -Npx` hack anywhere in the
diff — the fix is entirely `height` + `flex: 1; min-height: 0` down the real
ancestor chain, which is the CSS mechanism the directive itself specifies
(item 3).

## 2. The cards — verified, and largely already correct; the real gap is narrower than assumed

**Verification method.** Re-ran the exact "kitchen vs floors vs roof" and
"white oak vs red oak" test cases against the *tool-calling* code path
(`app/api/assistant/chat/route.ts`, `lib/assistant-workspace/chat-tools.ts`,
`lib/assistant-workspace/earned-catalog.ts`), read against the unit tests
that already assert the negative cases
(`earned-catalog.test.ts`'s "objective already set, this turn is unrelated"
case; `recommendations.test.ts`'s catalog-id-only assertions).

**What is already true, verified against the code, not assumed:**

- **Cards are generated with the answer, in one pass.** `route.ts` runs a
  single `generateText` tool-calling pass; `reply`, `patch`, `cards`, and
  `providers` all come out of that one pass. There is no separate
  "finish answer → fetch catalog → append cards" step in the model-served
  path (directive rule 15) — this was already correct going into this pass.
- **Zero cards is already a real, exercised outcome.** A turn that calls no
  tool, or only `attach_to_project` (which pushes a patch, not a card),
  returns `cards: []`. `earned-catalog.ts`'s "unrelated turn" branch,
  separately, returns `undefined` — that is item 8's "roof vs kitchen vs
  floors must not show White Oak / Red Oak" case, and it is covered by
  `earned-catalog.test.ts`.
- **No fabrication.** Every tool that lacks a licensed adapter
  (`get_house_profile`, `get_market_cost` for non-floor trades,
  `get_want_vs_value`) returns `pending_key` honestly and says so in the
  card body — never an invented AVM, contractor, rating, or price. Every
  `ecowoods_band` card number comes from `bandForWork` +
  `estimateInstalledRangeCad`, the same published-band functions the rest of
  the site uses. This is directive rule 13 (model doesn't get to invent
  facts) — already true, verified by `chat-tools.test.ts` and
  `recommendations.test.ts`.
- **Non-floor trades don't get Ecowoods flooring cards.** `isNonFloorTrade` /
  `isFloorOrStairsTrade` in `chat-tools.ts` route "I need a roof
  replacement" to `get_market_cost` (→ honest `pending_key`, no card
  fabricating a partner), never to `get_ecowoods_band`. Verified live.

**What this pass fixed — visual card taxonomy, a real but narrower gap than
the directive assumed.** The one accurate complaint that survived
verification: every card type rendered identically —
`.aha-inline-card` had one visual treatment for an honest "no adapter yet"
gap, a published-band estimate, a site-resource link, and a proposed
measure/estimate/quote, with the link CTA hardcoded to the generic "Open"
regardless of type. Fixed with a `data-card-type` attribute
(`AssistantChatCard.type`, unchanged — no schema migration needed) driving
distinct left-accent styling per type (`ecowoods_band` → brand copper,
`pending_provider` → dashed/quiet, `site_link` → neutral, `conversion_proposed`
→ commerce accent), plus a `cardLinkLabel()` helper that reads the
homeowner's goal instead of the implementation ("See the published band" /
"Review in Next step" / "See this page" instead of "Open" — directive rule
22). Both changes are additive to the existing `AssistantChatCard` type
(`chat-schema.ts`) — no new card type was introduced, and no new data source
was touched.

**What was NOT attempted in this pass, and why — scope, not oversight:**

The directive's items 10–13 and 20–34 describe a materially larger system: an
extended action-type taxonomy (`estimate | comparison | report | measure |
quote | document_review | other_trade | site_resource`, vs. the current
four), a standalone action-selection layer taking rejection/completion memory
as input, and result-card lifecycle states (`proposed → viewed → selected →
executing → completed → dismissed`). The current four-type schema already
maps 1:1 onto real, distinct behaviors (an estimate, an honest gap, a site
resource, a proposed conversion) — extending it to the directive's full
vocabulary is a real schema + tool-calling + UI change across `chat-schema.ts`,
every tool executor in `chat-tools.ts`, the system prompt, and the card
renderer, and it has no test coverage yet. Doing that as a same-pass addition
to a CSS/layout fix would mean shipping a large, unverified surface change
next to a verified one. It is scoped as its own follow-up in
`ASSISTANT_CONTEXTUAL_ACTIONS_SPEC.md` rather than attempted here.

The monetization system (items 23–26, 42–46: paid analyses, credit pricing,
in-conversation paywall) has no server-side credit ledger, pricing config, or
payment-gate code to extend — building one is a standalone feature with real
billing-safety implications (directive rule 44: "never silently deduct,
never charge an action that never executes"), not a same-pass addition to a
layout/card-styling fix. It remains `pending_key`-honest (no fake pricing
surfaced) rather than attempted half-built.

Third-party trade cards (item 20) remain correctly absent — there is no
verified-provider data layer to source them from, and the directive is
explicit that inventing one would be worse than the current honest gap.

## Verification performed

- `pnpm exec tsc --noEmit` — 0 errors (after `pnpm install` + `prisma generate`;
  the workspace's `node_modules` was not fully installed at audit start).
- `pnpm exec vitest run lib/assistant-workspace app/assistant
  tests/assistant-conversion-flow.test.ts tests/assistant-funnel-analytics.test.ts`
  — 11 files / 118 tests pass, unchanged behavior.
- `node scripts/verify-assistant.mjs` — passes.
- `next build && next start`, driven with Playwright (production build,
  since `next dev` cannot hydrate under this site's CSP — see
  `lib/scroll-state.ts`) at 1440×900 and 390×844, composer position and
  footer visibility measured directly (see table above), not eyeballed.
