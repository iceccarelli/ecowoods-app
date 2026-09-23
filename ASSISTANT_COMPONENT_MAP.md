# Ask Francisco (/assistant) — Component Map

Every component below is a real file in this repo. Nothing in the spec's
"ChatV2 / AssistantV2 / NewComposer" category was created — this pass only
extended the files that already existed.

```
apps/web/app/assistant/page.tsx
  Server component. Loads case-study evidence (fs-backed), renders the
  breadcrumb/SEO header, then <WorkspaceShell>.
  Changed: header markup — added back a small secondary-links row
  (measure / pricing) beside the breadcrumb, hidden ≤480px.

apps/web/app/assistant/components/
├── WorkspaceShell.tsx
│     Wraps everything in <WorkspaceStateProvider>. Owns the drawer's
│     open/tab state and the compact "Ask Francisco" + Project-capsule bar.
│     Changed: added a `document.body.classList` effect toggling
│     `aha-active` for the lifetime of the mount (footer/topbar de-emphasis).
│
├── WorkspaceStateProvider.tsx   (untouched)
│     React context for the canonical WorkspaceState — the single source of
│     truth every zone reads/patches. Not read for changes beyond its existing
│     public hook (`useWorkspaceState`).
│
├── ConversationPane.tsx
│     THE component this task mostly changed. Owns:
│       - the start screen (avatar + greeting + starter chips)
│       - the message list (avatar, author label, body text, retry/stop)
│       - the composer (auto-growing textarea, circular send button)
│       - the "earned" catalogue cards + <ConversionPanel> mount point
│     Changed: avatar rendering, auto-grow textarea + keyboard handling,
│     circular send button, typing-dot loading state + Stop button (real
│     AbortController on the existing fetch — no new endpoint), honest
│     failed-message state + Try again (retries the same fetch), mobile
│     placeholder via matchMedia, auto-scroll-to-latest.
│     Untouched: the fetch target (`/api/assistant/chat`), the request/response
│     shape, `interpretMessage`/`coercePatch` (business logic), and the earned-
│     catalogue / conversion mount logic.
│
├── WorkspaceContextDrawer.tsx   (untouched)
│     The one contextual slide-over for Project / Economics / Sources /
│     Documents (PR #130's replacement for permanent side rails). Read for
│     context; no changes.
│
├── ProjectRail.tsx / EconomicsRail.tsx   (untouched)
│     Rendered both `embedded` (inside the drawer) and, structurally, still
│     capable of standalone rendering — not touched by this pass, no visual
│     changes.
│
├── MobileProjectBar.tsx   (untouched)
│     Mobile bottom-sheet equivalent of the drawer trigger.
│
├── ConversionPanel.tsx   (untouched)
│     PLAN → REVIEW → CONFIRM → RECEIPT booking/lead flow. Already had its own
│     honest error state ("Could not confirm that — call ⟨phone⟩") — used as
│     the reference pattern for the new chat-level error state, not modified.
│
├── ProductCard.tsx / ServiceCard.tsx   (untouched)
│     Generic recommendation cards — render whatever `recommendProducts` /
│     `recommendServices` return. No changes.
│
├── ScenarioCompare.tsx / ValueScenarioCard.tsx   (untouched)
│     Value-scenario presentation. No changes.
```

## Supporting library files touched

```
apps/web/lib/assistant-workspace/identity.ts
  Changed ONE constant: WORKSPACE_COMPOSER_PLACEHOLDER,
  'Ask anything about this house…' → 'Ask Francisco about this house…'
  (pure UI copy — matches the spec's exact desktop placeholder string; the
  mobile variant, 'Ask Francisco…', lives as a local constant in
  ConversationPane.tsx since it's presentation-only and never sent anywhere).
  Nothing else in this file — the whole-home-renovation narrative, the
  Francisco Oller voicing, the chip copy — was left exactly as written.

apps/web/lib/brand.ts   (read only, not modified)
  Source of EW_MARK / EW_MARK_ALT, reused for the new message avatar — the
  same asset apps/web/app/components/Header.tsx already renders as the site's
  logo mark. No new image asset was added.
```

## New CSS, same file

All new rules live in the existing `apps/web/app/globals.css`, inside the
already-established `/* === ASSISTANT-0N ... === */`-style `aha-*` section
(~line 12600 onward). No new stylesheet, no CSS Modules file, no inline
`style=` blocks beyond what already existed. New/changed rule groups:

- `.aha-hero-compact-row` / `.aha-hero-compact-links` — the header's secondary
  links row.
- `body.aha-active .topbar` / `body.aha-active .site-footer` — de-emphasis
  hooks (spacing/shadow only).
- `.aha-avatar`, `.aha-avatar--start` — the identity marker.
- `.aha-start` (reworked to center + avatar), `.aha-start-lede` (type scale).
- `.aha-chips` mobile scroll behavior (`@media (max-width: 480px)`).
- `.aha-message`, `.aha-message-body`, `.aha-message-retry`, `.aha-message-stop`,
  `.aha-message--failed` — message layout + the new retry/stop affordances.
- `.aha-typing`, `.aha-typing-dots`, `@keyframes aha-dot-pulse` — the loading
  indicator.
- `.aha-composer-bar` (renamed from `.aha-composer--premium`, now the outer
  chrome only) / `.aha-composer` (now the pill itself, no longer double-booked
  with the outer bar's padding) / `.aha-composer-input` / `.aha-composer-send`
  — the full composer rebuild.

## 2026-09-23 (Phase 2) — personalization memory + action engine + action memory

New files:

```
apps/web/lib/assistant-workspace/renovation-analysis.ts   (+ .test.ts)
  Pure, deterministic renovation-sequencing engine — the real capability
  behind analyze_renovation_priorities. See ASSISTANT_ACTION_ENGINE_SPEC.md.
```

Changed files (all extensions of existing structures, no parallel state
object, no second card system — per NO_DUPLICATION_GUARANTEE.md discipline):

```
lib/assistant-workspace/types.ts
  + WorkspacePersonalization (neighbourhood, floorCondition, otherTrades)
  + WorkspaceActionMemory (dismissed, completed) on WorkspaceState.

lib/assistant-workspace/state.ts
  + sanitizePersonalization / sanitizeActionMemory, wired into
    defaultWorkspaceState / applyPatch / hydrateWorkspaceState.
  + recordActionDismissed / recordActionCompleted — append-only mutators,
    not part of the generic patch (dismissal must never be silently erased
    by a stale client patch).

lib/assistant-workspace/chat-schema.ts
  + personalization / actionMemory on workspaceSnapshotSchema.
  + AssistantChatCard: id / reason / cta (optional, additive).
  + AssistantChatCardType: + 'analysis_available', 'paid_analysis_proposed'.

lib/assistant-workspace/chat-tools.ts
  + executeAnalyzeRenovationPriorities, filterDismissedCards.
  + executeAttachToProject: neighbourhood / floorCondition / trade /
    tradeStatus inputs.
  + every card builder now sets a stable `id`.
  + pending_provider card BODIES rewritten to plain homeowner language
    (no more literal "pending_key" / "adapter" rendered to a visitor) —
    the internal `note`/`provider.note` fields keep the precise engineering
    language, since those are tool output for the model, never rendered.
  + catalogHintsBlock: + non-floor trade list.
  + workspaceSnapshotBlock: + "already known, don't ask again" framing +
    dismissed-ids callout.

lib/assistant-workspace/system-prompt.ts
  Answer-length rule tightened (20-80 words typical, ~150 max), minimum-
  question principle, never-re-ask rule, never-say-pending_key rule,
  analyze_renovation_priorities documented in TOOLS/FLOW.

app/api/assistant/chat/route.ts
  + analyze_renovation_priorities tool registration (reconstructs a working
    WorkspaceState from the client snapshot via applyPatch, for the pure
    engine to read).
  + attach_to_project schema: neighbourhood / floorCondition / trade /
    tradeStatus.
  + filterDismissedCards applied to every turn's cards before the response
    is built — the server-enforced half of action memory.

app/assistant/components/WorkspaceStateProvider.tsx
  + dismissAction(actionId) on the context value (-> recordActionDismissed).

app/assistant/components/ConversationPane.tsx
  + snapshotFromState sends personalization + actionMemory.
  + cardLinkLabel now type AssistantChatCardType | uses card.cta.
  + card render: shows card.reason as a secondary line, a "Not now" dismiss
    button per card (removes it locally + records the dismissal), a disabled
    (non-clickable) CTA span for paid_analysis_proposed instead of a link.

app/globals.css
  + .aha-inline-card[data-card-type='analysis_available' | 'paid_analysis_proposed']
    accents, .aha-inline-card-reason, .aha-inline-card-actions,
    .aha-inline-card-dismiss, .aha-inline-card-link--disabled.
```

Not touched, and why (see ASSISTANT_ACTION_ENGINE_SPEC.md's "what's still
open" and ASSISTANT_MONETIZATION_SPEC.md): `earned-catalog.ts` /
`ProductCard.tsx` / `ServiceCard.tsx` (no dismiss affordance there yet),
`prisma/schema.prisma` (no credit-ledger migration this pass), `lib/stripe.ts`
/ any checkout route (no payment wiring this pass), `lib/analytics.ts` (no
new tracked events this pass — see ASSISTANT_UNIT_ECONOMICS.md).

## 2026-09-23 — composer/viewport root-cause fix + card taxonomy styling

See `ASSISTANT_RUTHLESS_PRODUCT_AUDIT.md` for the full root-cause writeup.
Changed files, both already in the map above (no new components):

- `apps/web/app/globals.css` — `.aha-page` is now a real fixed-height flex
  shell (`height: calc(100dvh - --header-h - --ub-h); overflow: hidden`)
  instead of inheriting `.tlx-page`'s ordinary document-flow sizing.
  `.aha-shell--conversation-first`, `.aha-conversation--canvas` changed from
  `min-height` calcs to `flex: 1; min-height: 0`. `body.aha-active
  .site-footer` changed from a padding nudge to `display: none`. New
  `.aha-inline-card[data-card-type='...']` rules give each card type its own
  left-accent instead of one shared style.
- `apps/web/app/assistant/components/ConversationPane.tsx` — inline cards now
  render `data-card-type={c.type}`; new `cardLinkLabel()` module function
  maps `AssistantChatCard['type']` to a goal-phrased CTA instead of the
  hardcoded "Open". No change to the fetch target, request/response shape,
  or any business logic.

Not touched, and why (scope note, not an oversight — see the audit doc's
"what was NOT attempted" section): `chat-schema.ts`'s `AssistantChatCard.type`
union, `chat-tools.ts`'s tool executors, `system-prompt.ts`, and
`ProductCard.tsx`/`ServiceCard.tsx` — the directive's extended action
taxonomy and action-selection-layer work is scoped separately in
`ASSISTANT_CONTEXTUAL_ACTIONS_SPEC.md`.

## What "extend, don't duplicate" meant in practice here

- No `ChatV2`, `AssistantV2`, `MessageV2`, or `ComposerV2` files were created.
- The one structural JSX change beyond in-place edits was splitting the
  composer's single `<form className="aha-composer aha-composer--premium">`
  into an outer `<div className="aha-composer-bar"><form className="aha-composer">`
  pair — because the same DOM node had been asked to be both "the outer bar"
  and "the pill" under the old two-class approach, which made the pill's
  28px-radius/58px-min-height spec impossible to satisfy without either
  breaking the outer safe-area padding or the inner pill shape. This is a
  wrapper-element split, not a new component file.
- Every other change is either a new CSS rule in the existing stylesheet, a
  new prop/state/effect inside an existing component, or copy edits inside
  files that already existed for exactly that purpose (`identity.ts`).
