# Ask Francisco (/assistant) — UI Audit

Scope: presentation layer of `apps/web/app/assistant/**` only. No business logic,
pricing math, prompts, backend routes, or Floor Studio engine were read for the
purpose of changing them — only to understand what the UI renders and must not
misrepresent.

**Live-site access**: not available from this sandboxed environment (no outbound
browser to `https://ecowoods.ca`). This audit is entirely repo-based — the actual
`/assistant` route source, its component tree, `globals.css`'s `aha-*` rules, and
a locally built/run copy of the app (production build + a headless Chromium
screenshot pass at 1440×900, 768×1024 and 390×844). Where the live site might
differ from what ships in this branch, that would only be prior deploys of the
same code — there is no separate CMS or design tool driving this route.

## Starting point

This branch was created from `origin/main`, which — as of the same day this task
was assigned — already contained a substantial redesign commit:
`3e1fde9 feat(assistant): conversation-first shell (v8) + structured model wire`
(merged as PR #130). That commit had already:

- Removed the permanent three-column `ProjectRail | ConversationPane | EconomicsRail`
  layout in favour of a single conversation canvas plus one contextual slide-over
  drawer (`WorkspaceContextDrawer`) for Project / Economics / Sources / Documents.
- Cut the start screen down to a name + one-sentence greeting + 3–4 starter chips.
- Added a compact "Project" capsule in a slim workspace header instead of a
  dashboard-like sidebar.
- Shrunk the page-level marketing hero to a breadcrumb + `sr-only` `<h1>`.

That is a good, spec-aligned foundation, so this pass **builds on it** rather than
replacing it — extending existing components (`ConversationPane`, `WorkspaceShell`,
`WorkspaceContextDrawer`) and the existing `aha-*` CSS namespace in `globals.css`,
per the task's "extend, don't duplicate" instruction.

## What was already good (kept as-is)

- **Design tokens**: `globals.css`'s `:root` already defines a mature, warm,
  wood-toned palette (`--paper`, `--ink`, `--muted`, `--copper-*`, `--line`,
  `--space-*`, `--radius-*`, `--shadow-*`) that matches the spec's intent almost
  exactly. No neon, no glassmorphism, no cyan/blue accents anywhere in this route.
- **Conversation-first shell**: no permanent side rails; the drawer pattern for
  Project/Economics/Sources/Documents is the right shape for "world-class but not
  a CRM dashboard."
- **Honesty-kernel discipline already baked into the components**: `ConversionPanel`
  already says "not a quote," names the exact published band, and the whole file's
  comments show a lot of care about never inventing AVMs, MLS comps, or unsourced
  numbers (see its module comment and `WorkspaceContextDrawer`'s Sources tab text).
  This audit did not touch any of that copy.
- **Structural conversion flow** (`ConversionPanel`): choose → plan → review →
  confirm → receipt, with its own error state and a real availability fetch — this
  is already a solid, honest pattern and was left untouched.
- **Mobile bottom sheet** (`MobileProjectBar`) for the drawer's mobile equivalent,
  with safe-area padding already in place.

## Gaps found and fixed in this pass

1. **Composer was a single-line `<input>` + rectangular "Send" button.** Spec
   wants an auto-growing textarea, Enter=send / Shift+Enter=newline, and a
   circular icon button. Fixed in `ConversationPane.tsx` + the `.aha-composer*`
   rules in `globals.css`. The composer is now a floating pill (28px radius,
   58px+ min-height, 820px max-width) with a 42px circular send button, separated
   from the outer bar's chrome (new `.aha-composer-bar` wrapper) so the two don't
   fight over padding/background.
2. **No visible assistant identity marker** — messages carried only a small-caps
   text label ("ASK FRANCISCO"). Spec explicitly asks for "a small identity
   marker (EW monogram or existing Ecowoods mark, not a fake photo)." Added a
   24px circular avatar using the site's own `EW_MARK` asset (`lib/brand.ts`),
   the same asset `Header.tsx` already uses for the site's own logo mark — no new
   image, no fabricated photo.
3. **No honest failure state for the chat call itself.** A failed `/api/assistant/chat`
   request silently fell back to keyword extraction with a soft "the live advisor
   is briefly unavailable" message — never wrong, but not the explicit,
   billing-safe error affordance the spec asks for. Added a distinct failed-state
   message — "I couldn't complete that analysis. Nothing was charged." — with a
   **Try again** button that resends the same user turn. The soft keyword-fallback
   copy is kept for the case where the model path never even ran (network hiccup
   inside a `catch`) is now folded into the same honest state rather than
   pretending understanding happened.
4. **Loading state was a bare "Thinking…" line.** Replaced with a subtle
   three-dot pulse plus "Francisco is working through that" label, and a
   **Stop** button wired to a real `AbortController` on the in-flight `fetch` —
   presentation-only; the request is still the same `/api/assistant/chat` call,
   just cancellable.
5. **Draft could be lost mid-stream in theory** (not actually reproduced, but the
   composer had no explicit protection). Draft state is untouched by the new
   loading/avatar work; verified the textarea's `value` is still driven only by
   local component state, never cleared except on a successful/attempted send.
6. **Greeting type scale was a little small for a "hero" moment** (`clamp(1.35rem,
   2.4vw, 1.75rem)` ≈ 21.6–28px). Spec asks for 30–36px desktop / 24–28px mobile.
   Bumped to `clamp(1.5rem, 1.05rem + 1.8vw, 2.125rem)` ≈ 24–34px, and centered
   the empty state (name + greeting + avatar + chips) for a calmer, more
   deliberate first screen.
7. **Message body copy used the display serif** (`--font-display`, Fraunces) at
   every message, including long assistant replies. Spec calls for 16px/1.65
   sans body text, reserving the display serif for the greeting/headings. Switched
   `.aha-message-text` to `--font-body` at `1rem`/`1.65`, keeping the serif for
   `.aha-start-lede` only.
8. **Chips didn't scroll on mobile** — they wrapped into a tall stack instead.
   Spec explicitly asks for "horizontally scrollable on mobile." Added a
   `max-width: 480px` rule switching `.aha-chips` to a `nowrap` + `overflow-x:
   auto` row with scroll-snap and 44px-minimum touch targets.
9. **Composer placeholder didn't shorten on mobile.** Spec gives two exact
   strings ("Ask Francisco about this house…" desktop / "Ask Francisco…" mobile).
   Added a `matchMedia('(max-width: 480px)')` check in `ConversationPane` and
   updated `WORKSPACE_COMPOSER_PLACEHOLDER` in `identity.ts` to the desktop
   string (was "Ask anything about this house…" — no business-fact change, pure
   copy).
10. **The page-level hero, while already compact from PR #130, dropped the
    secondary navigation** (measure / guides / pricing) that used to sit under
    the old marketing hero. Spec says "keep site nav reachable but visually
    secondary" — added those two links back as a small, muted row beside the
    breadcrumb (hidden under 480px, where the same links live in the drawer's
    Sources tab instead of competing for space).
11. **No de-emphasis of the global topbar/footer while inside the workspace.**
    Spec item 12 asks for this explicitly. `WorkspaceShell` now toggles a
    `body.aha-active` class for the lifetime of its mount (cleaned up on
    unmount); `globals.css` uses it only for spacing/scale nudges — a slightly
    larger footer top-padding and a flat topbar shadow — **never** an opacity or
    contrast reduction on text, to stay clear of the WCAG requirement.

## What was deliberately left untouched

- `/api/assistant/chat/route.ts`, the AI SDK wiring, and every file under
  `lib/assistant-workspace/` except `identity.ts`'s placeholder string — all
  business logic, pricing, prompts, and the honesty-kernel guardrails they
  encode.
- `ConversionPanel.tsx`'s booking/lead flow, its own error/retry pattern, and its
  copy — already correct, already tested (`assistant-conversion-flow.test.ts`).
- `ProductCard`, `ServiceCard`, `ScenarioCompare`, `ValueScenarioCard` — read for
  context, not modified; they already render whatever recommendation data the
  app produces, generically.
- The `WorkspaceContextDrawer` tab structure, `ProjectRail`/`EconomicsRail`
  content, and the mobile bottom sheet's data rows.
- Anything under `lib/funnels`, `lib/analytics.ts`'s event shapes, and
  `docs/assistant-workspace/*`.

## Known gaps / follow-ups (need a live backend or a human call)

- No `ANTHROPIC_API_KEY` / `DATABASE_URL` in this sandbox, so `/api/assistant/chat`
  and `/api/appointments` were exercised only against their **failure** paths —
  which is exactly what surfaced and validated the new honest error+retry state,
  but the **success** path (a real model reply with `cards`) was not visually
  verified end-to-end. `ConversationPane`'s card rendering (`.aha-inline-cards`)
  is unchanged from the working baseline, so this is low risk, but worth a
  once-over on staging.
- `next dev`'s CSP report-only policy blocks `unsafe-eval`, which is how Next's
  dev-mode source maps work — this made the dev server briefly look
  non-interactive during this audit. It does **not** affect the production
  build (verified via `next build && next start`); noting it here so a future
  session doesn't lose time on the same false lead.
- Design-tightness of the drawer's "Sources" and "Documents" tabs (currently
  static explanatory text) is a content decision for ASSISTANT-08, not a UI
  redesign question — left alone.
