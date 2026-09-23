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
