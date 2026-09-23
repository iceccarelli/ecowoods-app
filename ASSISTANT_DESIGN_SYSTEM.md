# Ask Francisco (/assistant) — Design System

All tokens below already exist as CSS custom properties in
`apps/web/app/globals.css`'s `:root` (site-wide) or as `.aha-*` rules scoped to
`/assistant` in the same file. Nothing here is a parallel token system — the
point of this document is to record which of the site's existing tokens this
route uses and why, plus the handful of route-specific composites (composer
pill radius, avatar size, typing-dot timing) that sit on top of them. Extend
these; don't invent a second palette.

## Color

| Role | Token | Value | Spec target | Notes |
|---|---|---|---|---|
| Page background | `--paper` / `--bg` | `#fdfbf6` | `~#F7F6F2` | Warm off-white, same family; not changed — already the site's canonical background. |
| Surface (cards, composer, drawer) | `--surface` | derived from `--paper` family (see `:root`) | white/near-white surface | Used by `.aha-conversation`, `.aha-composer`, `.aha-drawer`. |
| Warm surface (chips, user bubble) | `--surface-warm` | warm cream | — | `.aha-chip`, `.aha-message--user .aha-message-text`. |
| Hairline border | `--line` | warm neutral, low contrast | `~#E4E0D7` | `.aha-conversation`, `.aha-message--user` bubble border. |
| Stronger border (inputs, chips) | `--line-strong` | warm neutral, higher contrast | — | `.aha-composer`, `.aha-chip`. |
| Text, primary | `--ink` | `#1a1410` | `~#1A1A18` | Same near-black family. |
| Text, secondary | `--muted` / `--muted-soft` | `#6b5d52` / `#796b5c` | `~#6E6B63` | Same warm-gray family. |
| Accent — glyphs/text | `--copper-text` | `#9f5c32` (4.53:1 on the darkest light surface) | `~#8A6847` | Author labels, chip text, link color. |
| Accent — filled surfaces | `--copper-surface` | `#a56034` | `~#62472F` | Send button fill, project capsule hover border, conversion CTA. |
| Text-on-accent | `--on-copper` | `#faf6ef` (4.51:1 on `--copper-surface`) | — | Send button glyph, primary CTA text. |
| Danger (failed message, incompatibility) | `--danger` / `--danger-bg` | existing site danger pair | — | `.aha-message--failed`, `.aha-incompatibility`. |

No neon, electric, cyber-blue, or glassmorphic color is used anywhere in this
route. Every accent is a copper/walnut derivative already in `:root`.

## Type scale

Font families are the site's existing three: `--font-display` (Fraunces —
reserved for the greeting only, not body copy), `--font-body` (the sans used
everywhere else — messages, buttons, form fields), `--font-mono` (labels:
author name, kicker text, drawer tab captions).

| Use | Family | Size (desktop) | Size (mobile) | Line-height |
|---|---|---|---|---|
| Greeting ("I'm Francisco…") | display | `clamp(1.5rem, 1.05rem + 1.8vw, 2.125rem)` → **24–34px** | same clamp, resolves ~24–28px at ≤480px viewport width | 1.3 |
| Message body (assistant + user) | body | `1rem` = **16px** | 16px | **1.65** |
| Message author / kicker labels | mono | `0.72rem` ≈ 11.5px, uppercase, `0.08em` tracking | same | 1.2 |
| Starter chip | body | `0.85rem` ≈ 13.6px | same | 1.2 |
| Workspace bar title ("Ask Francisco") | display | `1.45rem` ≈ 23px | `1.2rem` ≈ 19px (≤900px) | 1.2 |
| Drawer title | display | `1.25rem` ≈ 20px | same | 1.2 |

## Spacing scale

The site's existing 8-point-ish scale, reused as-is (no new spacing tokens
added):

```
--space-2xs: 4px   icon-to-label, dot gaps
--space-xs:  8px   chip padding, tight inline gaps
--space-sm:  12px  form field padding, message gap
--space-md:  16px  default gap, drawer body padding
--space-lg:  24px  card padding, conversation scroll padding (paired with --space-xl)
--space-xl:  40px  conversation scroll padding, start-screen top padding
--space-2xl: 64px  shell bottom padding
```

The spec's 4/8/12/16/20/24/32/40/48 scale maps onto this one at every value
except 20/32/48, which this route doesn't need (its layouts are simpler than a
dashboard) — using the site's existing scale rather than introducing three more
tokens that would only ever be used once.

## Radii

```
--radius-sm:   6px   (unused directly by /assistant; kept for reference)
--radius-md:  10px   inline cards, form fields, chip-adjacent buttons
--radius-lg:  18px   .aha-conversation, .aha-drawer edge, .aha-rail
--radius-xl:  28px   .aha-composer pill (matches spec's 24–30px composer radius)
--radius-full: 999px chips, project capsule, avatars (50% is used directly on
                      .aha-avatar rather than --radius-full, since an avatar's
                      radius must always be exactly half its own box, not a
                      fixed pixel value)
```

Composer: **28px** (`.aha-composer`) — inside the spec's 24–30px band.
Cards: **18px** (`--radius-lg`) — inside the spec's "~16px" card guidance (close
enough that a separate 16px token would be indistinguishable in practice at this
route's card sizes; not worth a second radius token).
Small controls (chips, retry/stop buttons): 10px (`--radius-md`) to full pill
(`--radius-full`) depending on shape — chips and the capsule are pills; the
retry/stop buttons are 6–10px rounded rectangles, matching "small controls."

## Shadows

```
--shadow-sm  0 1px 2px + 0 1px 3px, ~6-8% ink opacity   composer at rest, cards, rail
--shadow-md  0 4px 12px + 0 2px 4px, ~8% ink opacity     composer :focus-within, hover states
--shadow-lg  0 12px 32px + 0 4px 12px, ~12% ink opacity  drawer, mobile sheet
```

No glow, no colored shadow, no glassmorphic blur anywhere in `/assistant`.
Borders and whitespace do most of the separation work — shadows are a light
finish, not a structural device (per spec's "prefer borders/whitespace").

## Component sizing rules

- **Conversation column**: `max-width: 820px`, centered (`.aha-shell--conversation-first`).
  Within spec's 780–880px band.
- **App header**: breadcrumb-only compact bar (`.aha-hero--compact`, ~40–56px)
  + the workspace identity bar (`.aha-workspace-bar`, ~56–64px) = roughly the
  spec's "~64px" app header when the two are read as one header region, without
  merging them into a single DOM node (the breadcrumb bar carries the page's
  real, SEO-visible navigation; the workspace bar carries the product identity
  and the Project capsule).
- **Composer**: `min-height: 58px` (68px+ once the textarea has grown a couple of
  lines), `border-radius: 28px`, `max-width: 820px`. Send button: `42px` circle.
  Mobile: `min-height: 52px`, `border-radius: 24px`.
- **Avatar**: `24px` in the message stream, `40px` on the empty/start state —
  both exactly circular (`border-radius: 50%`), using the site's real `EW_MARK`
  asset, never a generated or fake photo.
- **Chips**: pill (`--radius-full`), `padding: var(--space-xs) var(--space-md)`
  desktop; on mobile, `min-height: 44px` to clear the touch-target floor, laid
  out in a horizontally-scrolling row with `scroll-snap-type: x proximity`.
- **User message bubble**: `max-width: 70%` desktop (`85%` on ≤900px screens,
  since 70% of a 375px screen is too narrow to read comfortably), right-aligned,
  `--radius-md` corners, `--surface-warm` fill, `--line` border. The only
  bubble-shaped element on the page — assistant messages carry no background,
  no border, just the avatar + label + text.
- **Breakpoints**: the site's existing ones — `900px` (rails/drawer collapse to
  mobile bottom-sheet pattern) and `480px` (chip scroll behavior, mobile
  composer placeholder, secondary hero links hidden). Verified at 1440, 1280
  (inherits the ≥900px desktop rules), 1024 (same), 768, 390 and 375px — no
  horizontal overflow at any of them (checked programmatically via
  `document.documentElement.scrollWidth - clientWidth === 0` in a headless
  Chromium pass).

## Motion

- **Typing indicator**: three 5px dots, `1.1s` ease-in-out pulse, staggered
  0.15s apart. `prefers-reduced-motion: reduce` freezes them at a fixed 0.6
  opacity instead of animating.
- **Drawer open**: existing 180ms `translateX` + opacity fade (unchanged from
  PR #130) — also respects `prefers-reduced-motion` at the site-wide level via
  the same media query already covering the mobile bottom-sheet chevron.
- **Send button hover**: `scale(1.05)`, 120ms — disabled entirely under
  `prefers-reduced-motion: reduce`.
- **Scroll-to-latest**: `scrollTo({ behavior: 'smooth' })` on the conversation
  region only, not the whole page — never fights the browser's own reduced-motion
  scroll behavior since `smooth` is itself suppressed by the OS-level setting in
  every modern browser.
