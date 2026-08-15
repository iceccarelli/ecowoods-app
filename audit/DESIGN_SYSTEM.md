# EcoWoods — Canonical Design System

**Base commit:** `fe85677bf4fd7af0f088dfa1cf78025bda149714`
**Status:** specification. Nothing in this document has been implemented — it is
the target that Phases 1-5 patch toward.

This is not a redesign. It is a written-down version of the system that already
exists in `globals.css`, with the gaps filled and the contradictions resolved.
Where the current stylesheet already does the right thing, this document records
that and the number of places that disagree with it.

**Explicitly out of bounds:** AWS's palette, density, typography, console-grey
chrome, and information architecture. What is taken from that reference is
discipline — exhaustive interaction states, one token system with no exceptions,
a fixed breakpoint scale, predictable focus treatment. EcoWoods sells
craftsmanship to Toronto homeowners in copper and cream. Any change that makes
this feel more like a billing dashboard is a regression regardless of its
technical merit.

---

## 1. Colour

### 1.1 Structure

Three layers. A rule may only reference the layer beneath it going down, never up.

```
  primitive   --walnut-*  --oak-*  --cream-*  --maple-*  --copper*  --forest  --moss
      |       raw pigment. Never referenced by a component rule.
      v
  semantic    --bg  --surface  --surface-1/2  --ink  --ink-soft  --muted  --muted-soft
      |       --line  --line-strong  --cta-*  --on-dark-*  --danger  --success  --warning
      |       The ONLY layer a component rule may reference.
      v
  component   --chrome  --chrome-scrolled  --rg-*  --header-h  --shell-*  --fab-inset*
              Derived per-surface. Defined next to the component that owns it.
```

**Enforced since patch 15.** `scripts/verify-tokens.mjs` runs inside
`pnpm verify` and fails the build when a component rule paints with
`--walnut-*`, `--oak-*`, `--cream-*` or `--maple-*`. It ships with a baseline of
the 50 uses that predate it — a ratchet, not a wall: the baseline may shrink and
can never silently grow.

This rule was written here from the start and went unenforced, so the identical
violation was found **four separate times** by four full measurement cycles —
F-05 (cream-on-copper, 10 components at 2.97:1), F-33 (`.tlx-*` text, 17
declarations, 1.11:1 in dark), F-36 (`.tlx-*` surfaces, where fixing the text had
made the blocks worse) and F-42 (`.tlx-card`, the surface the previous pass could
not see). Each pass fixed what it could see. A grep would have found all four at
once.

    node scripts/verify-tokens.mjs --list      every use, baselined or not
    node scripts/verify-tokens.mjs --update    shrink the baseline deliberately

**Historical violation count:** components referenced primitives directly in a
large number of rules — `color: var(--cream-50)` appears 36 times, `var(--walnut-700)`
6 times, `var(--oak-500)` 7 times. Phase 1 converts these to semantic tokens.
Each conversion must be checked against §1.3, because a primitive that does not
flip between themes silently becomes a dark-mode bug when a component starts
depending on it.

### 1.2 Tokens to add

| Token | Light | Dark | Why |
|---|---|---|---|
| `--copper-surface` | `#a56034` (`--cta-from`) | `#a56034` | The only copper safe as a background behind cream text. Fixes F-05 across 10 rules. |
| `--on-copper` | `#faf6ef` (`--cta-fg`) | `#faf6ef` | Its partner. 4.51:1. |
| `--radius` | `var(--radius-md)` | — | Fixes F-02 across 19 sites. Default alias, not a new value. |
| `--border` | `var(--line)` | — | Fixes 2 of the F-01 refs. |
| `--space-2xs` … `--space-2xl` | see §3 | — | Fixes 17 of the F-01 refs. |

### 1.3 Theme parity rule

**Every semantic colour token must be defined under both `:root` and
`html[data-theme='dark']`, or carry a comment saying why not.**

Current state: 47 of 62 colour tokens have a dark override. The 15 without:

| Token | Verdict |
|---|---|
| `--on-dark`, `--on-dark-muted`, `--on-dark-faint`, `--on-dark-line` | **correct** — documented at `globals.css:4041`; these name a surface that never flips |
| `--cream-50`, `--cream-100`, `--oak-300/400/500`, `--walnut-600/700` | primitives — acceptable *provided* no component rule references them (§1.1) |
| `--forest-deep` | **dead token — zero usages in the repo.** Earlier text here called it a section background; that was wrong. Leave it without a dark value. |
| `--success`, `--warning`, `--danger` | **need dark values.** `--warning` also fails contrast in light (2.00-2.28:1) |

### 1.4 Contrast floor

| Content | Ratio | Applies to |
|---|---|---|
| Body text | **4.5:1** | anything below 18.66px bold / 24px regular |
| Large text | **3:1** | headings at or above that size |
| UI boundary, icon, focus ring | **3:1** | only where the boundary *is* the affordance |
| Decorative hairline | none | `--line` used as visual separation, not as a control edge |

Verify with `node audit/scripts/contrast-audit.mjs`. It composites alpha
foregrounds over their background before measuring, which a hex-eyeball check
does not.

---

## 2. Type

### 2.1 The scale as it exists

| Token | rem | px | Ratio to previous |
|---|---|---|---|
| `--fs-3xs` | 0.6875 | 11 | — |
| `--fs-2xs` | 0.75 | 12 | 1.091 |
| `--fs-xs` | 0.8125 | 13 | 1.083 |
| `--fs-sm` | 0.875 | 14 | 1.077 |
| `--fs-base` | 1 | 16 | 1.143 |
| `--fs-md` | 1.125 | 18 | 1.125 |
| `--fs-lg` | 1.25 | 20 | 1.111 |
| `--fs-xl` | 1.5 | 24 | 1.200 |

**This is not a ratio — it is eight hand-picked pixel values.** Steps range from
1.077 to 1.200. It works, because someone chose each value for a real use, and
the brief's Phase 1.4 asks for "a deliberate ratio." Two honest options:

- **Keep it and document it as a hand-tuned scale.** Small type needs tighter
  steps than large type; a strict 1.125 would give 11.4 / 12.8 / 14.4 and lose
  the crispness of whole-pixel small text.
- **Regularise to a modular scale** above `--fs-base` only, leaving the 11-14px
  region hand-tuned.

**Recommendation: keep it, document it, and stop there.** Regularising a working
scale is churn with a visual blast radius and no customer benefit. What is
actually missing is the top of the scale (§2.2).

### 2.2 The gap

There is **no token above `--fs-xl` (24px)**. Every display heading therefore
uses a raw `clamp()` or `rem` value inline. Phase 1 should add:

| Token | Suggested | Used by |
|---|---|---|
| `--fs-2xl` | `clamp(1.75rem, 3vw, 2.25rem)` | h2, section headings |
| `--fs-3xl` | `clamp(2.25rem, 4.5vw, 3rem)` | h1 on interior pages |
| `--fs-display` | `clamp(2.75rem, 7vw, 4.5rem)` | hero h1 only |

### 2.3 Family assignment

| Token | Font | Used for |
|---|---|---|
| `--font-display` | Fraunces (variable) | `h1`-`h3`, pull quotes, price figures |
| `--font-body` | Plus Jakarta Sans | everything else, all UI |
| `--font-mono` | JetBrains Mono | measurements, spec tables, postal input, eyebrows |

**Rule:** no page uses a family, weight or size outside this table.
**Verify:** Phase 4 must confirm all three families are actually used —
`--font-mono` in particular, since an unused `next/font` family is a wasted
preload on every route (Phase 9).

### 2.4 Heading level to size

| Element | Token |
|---|---|
| `h1` (hero) | `--fs-display` |
| `h1` (interior) | `--fs-3xl` |
| `h2` | `--fs-2xl` |
| `h3` | `--fs-xl` |
| `h4` | `--fs-lg` |
| `h5`/`h6` | `--fs-md` |

**Heading level is chosen by document structure, never by desired size.** If a
heading needs to look smaller than its level implies, that is a CSS class, not a
different tag (F-07).

---

## 3. Space

**There is currently no `--space-*` scale.** This is not "the scale needs
tidying" — the tokens are referenced 17 times and defined zero times (F-01).

Proposed, on a 4px base with a 1.5x-ish progression matching the spacing already
in use across `globals.css`:

| Token | Value | px | Typical use |
|---|---|---|---|
| `--space-2xs` | 0.25rem | 4 | icon-to-label gap |
| `--space-xs` | 0.5rem | 8 | tight inline gaps, chip padding |
| `--space-sm` | 0.75rem | 12 | form field internal padding |
| `--space-md` | 1rem | 16 | default gap, card padding (compact) |
| `--space-lg` | 1.5rem | 24 | card padding, grid gap |
| `--space-xl` | 2.5rem | 40 | between blocks inside a section |
| `--space-2xl` | 4rem | 64 | between subsections |

Section-level rhythm stays where it already is and is **not** folded into this
scale — those are fluid and correct as they stand:

| Token | Value |
|---|---|
| `--section-y` | `clamp(3.5rem, 5.5vw, 5.5rem)` |
| `--section-y-tight` | `clamp(2.25rem, 3.5vw, 3.5rem)` |
| `--section-head-gap` | `clamp(2rem, 3vw, 3rem)` |

### 3.2 Page structure and section rhythm

**Order answers the buyer's questions in the order they ask them.** Not the
order the sections were built in.

| # | section | surface | the question it answers |
|---|---|---|---|
| 1 | hero | **DARK** | who are you |
| 2 | #gallery | base | what could my floor look like |
| 3 | #services | **DARK** | why can you promise that |
| 4 | pricing | tint | **what does it cost** |
| 5 | #process | base | how does it work |
| 6 | #craft | tint | who actually does it |
| 7 | #design | base | can I try it |
| 8 | #reviews | tint | who says so |
| 9 | #faq | base | what could go wrong |
| 10 | library | tint | I want the depth |
| 11 | #quote | **DARK** | book |
| 12 | footer | **DARK** | — |

Two rules, and they are the whole system:

1. **Light sections strictly alternate** base → tint → base → tint. A new
   section takes whichever step its neighbour is not. If it cannot say which
   step it is, it is in the wrong place.
2. **Dark bands are chapter breaks**, never decoration. Four of them, at the
   open, after desire, at the ask, and the footer.

| step | class | surface |
|---|---|---|
| base | `.section` | `--bg` |
| tint | `.section--tint` | `--surface-1` + paper texture |
| break | `.photo-bg-section`, `.wood-grain-dark` | full-bleed dark |

### 3.1 Containment

| Token | Value |
|---|---|
| `--shell-max` | `1280px` |
| `--shell-pad` | `clamp(1.25rem, 4vw, 3rem)` |

Every page's max width and horizontal padding come from these. Phase 4 finds the
opt-outs — there are at least 76 fixed `width`/`min-width` declarations of 3+
digits in `globals.css` to triage.

**Hard-won rule:** an overflow guard must be written as
`max-width: min(<existing cap>, 100%)`. A blanket `.shell { max-width: 100% }`
appended at the end of the file silently kills the 1280px cap — same specificity,
later in the cascade.

---

## 4. Breakpoints

### 4.1 The scale

Five widths. Everything maps onto these.

| Name | Width | Rationale |
|---|---|---|
| `xs` | ≤ 479px | phones; the 320px floor must not overflow |
| `sm` | 480-767px | large phones, phone landscape |
| `md` | 768-1023px | tablet portrait — the awkward middle |
| `lg` | 1024-1439px | tablet landscape, small laptop |
| `xl` | ≥ 1440px | laptop and desktop |

Mobile-first `min-width` is preferred for new work. The existing file is
overwhelmingly `max-width`; Phase 2 does **not** invert it — that is a rewrite,
not a normalisation.

### 4.2 Mapping the existing 72

| Current | x | Maps to | Note |
|---|---|---|---|
| `max-width: 767px` | 15 | `xs`+`sm` | already on-scale |
| `max-width: 1023px` | 8 | `xs`→`md` | already on-scale |
| `max-width: 480px` | 4 | `xs` | on-scale (479 boundary) |
| `min-width: 768px` | 3 | `md`+ | on-scale |
| `max-width: 560px` | 3 | `sm` | **off-scale** |
| `max-width: 860px` | 3 | `md` | **off-scale** |
| `max-width: 400px` | 2 | `xs` | **off-scale** |
| `max-width: 600px` | 2 | `sm` | **off-scale** |
| `max-width: 640px` | 2 | `sm` | **off-scale** |
| `min-width: 900px` / `max-width: 900px` | 4 | `md`/`lg` | **off-scale** |
| `max-width: 379px` | 1 | `xs` | **off-scale orphan** |
| `min-width: 481px` | 1 | `sm` | off-by-one pair with 480 |
| `max-width: 720px` | 1 | `sm` | **off-scale** |
| `min-width: 1180px` | 1 | `lg` | **off-scale** |
| `max-width: 1140/1300/1380/1460px` | 4 | `lg`/`xl` | **off-scale** |
| `min-width: 1600px` | 1 | `xl`+ | **off-scale** |

**Two categories, and only one of them should be collapsed.**

A *layout tier* answers "which device class is this". A *component threshold*
answers "when does this particular element run out of room". They look identical
in the stylesheet and are not the same thing.

| Category | Examples here | What to do |
|---|---|---|
| Layout tier | 767 (x15), 1023 (x8), 768, 480 | already on the scale — keep |
| Component threshold | 379 `.cmdk-trigger`, 400 `.brand-copy small`, 1140 `.login-btn`, 900/1180 `.fc-grid`, 860 `.pricing-grid`, 560 `.standard-grid` | do NOT snap to the scale; replace with intrinsic sizing (`minmax`, `flex-wrap`, `clamp`, container queries) once the breakage each was written for is observed |

Snapping `.login-btn`'s 1140px down to 1024px leaves the header nav overflowing
between 1024 and 1140. Snapping the configurator's 1180px down breaks a
three-column grid whose result panel needs 320px. The magic number is a symptom;
the container's real minimum is the cause, and finding it needs a rendered page.

**Phase 2 method, per off-scale query:** find the specific breakage that prompted
the magic number and solve it intrinsically — `min-width: 0` on a flex child,
`flex-wrap`, `grid-template-columns: repeat(auto-fit, minmax(min(100%, Npx), 1fr))`,
or `clamp()` — rather than moving the number to the nearest scale step and hoping.
A query that survives must be justified individually in the MANIFEST.

### 4.3 Non-width queries, all legitimate, all kept

`(max-height: 520px) and (orientation: landscape)` — landscape phone, where the
sticky header and the bottom CTA collide.
`(pointer: coarse)` x2 — touch affordances.
`(prefers-reduced-motion: reduce)` x15 — see §6.3.
`print` x2.

### 4.4 Test matrix

Every public route, both themes, every row:

| Device | Viewport |
|---|---|
| minimum | 320 x 640 |
| iPhone SE | 375 x 667 |
| iPhone 15 Pro | 393 x 852 |
| iPhone 15 Pro Max | 430 x 932 |
| Pixel 8 | 412 x 915 |
| phone landscape | 852 x 393 |
| iPad mini portrait | 744 x 1133 |
| iPad Pro landscape | 1194 x 834 |
| laptop | 1440 x 900 |
| desktop wide | 1920 x 1080 |

Plus 200% browser zoom. Encoded in `audit/scripts/runtime-audit.mjs`.

---

## 5. Interaction state matrix

**The empty cells are the deliverable.** `[?]` means the state has not been
verified — this column cannot be filled without a browser, and marking it `[ ]`
would be claiming a measurement that was not taken.

| Element | Rest | Hover | Active | Focus-visible | Disabled | Loading | Error/Success |
|---|---|---|---|---|---|---|---|
| `.btn` base | ✓ 426 | ✓ 449 | — | inherits `:focus-visible` 222 | **missing** | **missing** | n/a |
| `.btn-primary` | ✓ 463 | ✓ 468 | ✓ 475 | inherits | **missing** | **missing** | n/a |
| `.btn-copper` | ✓ 481 | ✓ 487 | ✓ 495 | inherits | **missing** | **missing** | n/a |
| `.btn-ghost` | ✓ 499 | ✓ 505 | **missing** | inherits | **missing** | **missing** | n/a |
| `.btn-ghost-light` | ✓ 507 | ✓ 515 | **missing** | inherits | **missing** | **missing** | n/a |
| `.btn-sm` / `.btn-lg` | ✓ 523/528 | inherits | inherits | inherits | **missing** | **missing** | n/a |
| Top nav link | ✓ | [?] | [?] | [?] | n/a | n/a | n/a |
| Sheet nav link | ✓ | [?] | [?] | [?] | n/a | n/a | n/a |
| Footer link | ✓ 1550 | [?] | [?] | [?] | n/a | n/a | n/a |
| Social icon | ✓ 1579 | [?] | [?] | [?] | n/a | n/a | n/a |
| Card (whole-card vs inner-link) | ✓ | **undecided** | — | [?] | n/a | n/a | n/a |
| `.field input/select/textarea` | ✓ 1429 | — | — | ✓ 1444 | **missing** | **missing** | ✓ 2373 `.field-error` |
| `.field-radio` | ✓ 1464 | ✓ 1478 | — | [?] | **missing** | n/a | n/a |
| Checkbox | [?] | [?] | [?] | [?] | [?] | n/a | [?] |
| `/design` configurator controls | ✓ | ✓ | ✓ 4419 | ✓ 4460 | **missing** | **missing** | **missing** |
| `.cmdk-trigger` | ✓ | [?] | [?] | [?] | n/a | n/a | n/a |
| Theme toggle | ✓ | [?] | [?] | [?] | n/a | n/a | n/a |
| `.hamburger` | ✓ | [?] | [?] | [?] | n/a | n/a | n/a |
| Pagination | [?] | [?] | [?] | [?] | [?] | n/a | n/a |
| Breadcrumb | ✓ 6945 | [?] | [?] | [?] | n/a | n/a | n/a |
| Tabs (`.shop-tab`) | ✓ 3125 | [?] | ✓ | [?] | [?] | n/a | n/a |
| FloorForge pilot form | ✓ | ✓ | ✓ | [?] | **missing** | **missing** | [?] |

Requirements per column:

| State | Requirement |
|---|---|
| Hover | perceptible but restrained; ≤ 150ms; **never shifts layout** |
| Active | distinct from hover; immediate; no delay |
| Focus-visible | high-contrast ring visible on **every** background; keyboard-only |
| Disabled | clearly inert; `cursor: not-allowed`; still ≥ 3:1 contrast |
| Loading | required on anything triggering async work — forms, filters, the configurator |
| Error/success | every form field and every submission; **never colour-only** |

Global focus treatment already exists and is good:
`globals.css:222` — `:focus-visible { outline: 3px solid var(--copper-bright); outline-offset: 3px; border-radius: 4px }`.
Phase 5 must verify it clears 3:1 on **dark section backgrounds**, where
`--copper-bright` sits on `--walnut-950`, not just on `--bg`.

### 5.1 Touch

Every `:hover` rule needs a touch equivalent or an explicit decision that the
affordance is desktop-only. Hover-only affordances are invisible on a phone.
Confirm no sticky-hover artifact persists after a tap.

---

## 6. Motion

### 6.1 Duration bands

| Band | Range | Use |
|---|---|---|
| micro | 120-200ms | hover, active, focus, colour changes |
| entrance | 250-400ms | reveals, sheets, modals |
| ceiling | **500ms** | nothing exceeds this except a deliberate ambient loop |
| ambient | 9s-35s | marquees and tickers only; must pause on hover and focus |

### 6.2 Current census

| ms | count | | ms | count |
|---|---|---|---|---|
| 150 | 25 | | 300 | 12 |
| 200 | **36** | | 400 | 5 |
| 180 | 16 | | 350 | 5 |
| 160 | 11 | | 320 | 4 |
| 220 | 7 | | 420 | 4 |
| 240 | 6 | | 250 | 4 |

**In band already: the overwhelming majority.** Out of band: 700ms x3 (1668,
1819, 2105), 600ms (6815), 500ms (6853). Ambient: 2000ms x6, 9000ms x4, 12000,
15000, 26000, 35000 — all marquee/ticker, all legitimate.

Durations must come from tokens. There are currently **no duration tokens at
all** — every value is a literal. Phase 1 should add `--dur-fast: 150ms`,
`--dur-base: 200ms`, `--dur-slow: 300ms`, `--dur-enter: 380ms`.

Easings exist and are good: `--ease-out-quart`, `--ease-out-expo`, `--ease-in-out`.

### 6.3 Property discipline

**Animate `transform` and `opacity` only.** A transition on `width`, `height`,
`top`, `left`, `margin` or `padding` forces layout and janks on mobile.

| Violation | `globals.css` |
|---|---|
| `transition: max-height` | 1297 |
| `transition: width` | 2048 |
| `transition: top` | 4280 |
| `transition: all` | **25 declarations** — unbounded; animates whatever happens to change |

### 6.4 Reduced motion — already correct, do not "improve" it

`globals.css:1691` carries a global reset:

```css
@media (prefers-reduced-motion: reduce) {
  .reveal { opacity: 1; transform: none; transition: none; }
  *, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }
}
```

**Verified:** `node audit/scripts/reduced-motion-audit.mjs` reports 31 selectors
switched off under reduced motion and **0 that can be left invisible**. The
fourteen per-component reduced-motion blocks are redundant with the global reset
— harmless, and removing them is P3 hygiene, not a fix.

`.reveal` deserves specific note: it starts at `opacity: 0` with a
`reveal-fallback 0s 2s forwards` animation as a JS-failure safety net, **and** an
explicit `opacity: 1` restoration inside the reduced-motion block. That is the
correct construction and must survive Phase 5 intact.

`ServiceTicker` (`.svt`) must pause on hover **and on focus**, and be hidden from
assistive tech if decorative.

---

## 7. Component anatomy

One canonical implementation per element. Phase 4 censuses every recurring element
across all 66 routes, picks the canonical version, justifies the pick, migrates
every usage, and deletes the dead CSS.

Namespaces present, by rule count:

| | | | | | |
|---|---|---|---|---|---|
| `.tlx-` 103 | `.pfd-` 96 | `.gc-` 83 | `.portal-` 82 | `.fc-` 72 | `.shop-` 60 |
| `.footer-` 51 | `.sx-` 35 | `.cmdk-` 35 | `.cov-` 28 | `.svt-` 24 | `.service-` 24 |
| `.gallery-` 24 | `.species-` 22 | `.estimator-` 22 | `.contact-` 22 | `.progress-` 21 | `.photo-` 21 |
| `.price-` 20 | `.hero-` 20 | `.section-` 19 | `.quote-` 17 | `.compare-` 16 | `.auth-` 16 |

**Not all of these are a problem, and Phase 4 must not flatten them.** A
namespace is legitimate when it names a genuinely distinct surface with different
density requirements. `.portal-` is an authenticated console; it may justifiably
be denser than a marketing page. `.tlx-` is an editorial reading surface; it may
justifiably have a longer measure and a different rhythm.

**The shared foundation both must honour regardless:**

1. Tokens from §1 — no primitives in component rules, no literals.
2. Type scale from §2 — no family, weight or size outside the system.
3. Spacing scale from §3.
4. `--shell-max` / `--shell-pad` containment.
5. The same `:focus-visible` treatment.
6. The same breakpoint scale.
7. Identical header and footer, on all 66 routes: same height, same scroll
   behaviour, same active-nav treatment, no layout shift on scroll, no double
   border where the footer meets page content, consistent spacing above the
   footer regardless of what the last section is. `--chrome-scrolled` must
   transition smoothly and must not flash on theme change.

`/authority` currently honours **none** of the seven (F-03). That is the one to
resolve first, and it needs a brand decision before any code moves.

---

## 8. Machine readability

The same work that makes this site usable by a screen reader makes it quotable by
an LLM.

- Heading hierarchy reflects document structure, never visual size (§2.4).
- One `<main>` per page (F-04). Labelled `<nav>`s. `<article>` for blog and
  case-study content. `<time datetime>` for dates.
- DOM order matches reading order. Never reorder meaning with CSS.
- Tables use `<th scope>`. Figures use `<figure>`/`<figcaption>`.
- `public/llms.txt` and `public/ai.txt`: **structural accuracy only.** Both were
  recently cleaned of fabricated metrics. No numbers.
- JSON-LD: **shape only.** A malformed shape or wrong `@type` may be corrected.
  No factual claim may be added, altered or re-worded. `sameAs` derives from
  `PROFILE_LINKS` and stays that way.

---

## 9. Content rules that constrain design

These are not style preferences. They are guarded by `pnpm verify`.

- **No invented content.** No testimonials, ratings, review counts, statistics,
  awards, certifications, years-in-business figures or client names — not as
  placeholders, not as "example content," not "to be replaced later."
- `featuredReviews` in `apps/web/app/home-client.tsx` is **intentionally an empty
  array** behind a conditional render. Improve that empty state's *design*. Do
  not populate it. An empty state that looks deliberate and confident is the
  goal.
- Business facts come only from `BUSINESS_NAP` in
  `packages/shared/constants/index.ts`.
- Profile URLs come only from `PROFILE_LINKS`. An entry without an `href` is
  deliberately not rendered.
- Never bypass the pre-push hook with `--no-verify`.

If a design improvement genuinely requires real content that does not exist, it
goes in `DEFERRED.md` and the empty state stays well-designed.
