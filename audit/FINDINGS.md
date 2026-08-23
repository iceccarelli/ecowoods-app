# EcoWoods — UX / Consistency / Responsive Audit: Findings

**Base commit:** `fe85677bf4fd7af0f088dfa1cf78025bda149714` (`chore: trigger redeploy after env`)
**Date:** 2026-08-08
**Scope of this document:** Phase 0 reconnaissance. No CSS has been written.

---

## 0. Read this before the findings

Every finding below carries a `file:line` and a measurement I ran. **Nothing here
is an impression.** Where a detector produced a result that turned out to be
wrong on inspection, the finding is recorded as withdrawn in
§7 rather than deleted, so the next person does not re-derive it.

**What was NOT verified, and why.** This audit was produced in an environment
with no browser: Playwright's CLI is present but the browser binaries cannot be
downloaded, and `chromium.launch()` fails. There is also no `pnpm` and no network
access to `binaries.prisma.sh`. Consequently the following Phase 0 requirements
are **unmet** and are carried in `DEFERRED.md`:

| Requirement | Status |
|---|---|
| Playwright screenshots, all routes x 10 viewports x 2 themes | **not run** |
| Scripted horizontal-overflow sweep | **not run** — `audit/scripts/runtime-audit.mjs` is written and ready |
| axe-core, every route, both themes | **not run** |
| Tap-target measurement | **not run** |
| Computed `font-size` on form controls | **not run** — static proxy only |
| Lighthouse / CLS / LCP / INP | **not run** |
| `tsc --noEmit`, `pnpm verify`, `next build` | **not run** |
| Manual VoiceOver / NVDA | **not run** |

Everything below is static analysis: CSS parsing, TypeScript AST walks, and
colour maths. It is reproducible by running the scripts in `audit/scripts/`.

**Reproduce everything in this document:**

```bash
node audit/scripts/parse-scan.mjs                 # 233 files, 0 diagnostics at base
node audit/scripts/undefined-tokens-audit.mjs     # F-01, F-02, F-14
node audit/scripts/contrast-audit.mjs             # F-05, F-06
node audit/scripts/theme-parity-audit.mjs         # F-04, F-06
node audit/scripts/inline-style-audit.mjs         # F-09
node audit/scripts/semantics-audit.mjs            # F-07, F-08, F-15
node audit/scripts/ios-zoom-audit.mjs             # F-12
node audit/scripts/reduced-motion-audit.mjs       # §7.1 withdrawal
```

---

## 1. Ground truth — Part III of the brief, re-measured

| Measurement | Brief says | Measured at `fe85677` | Verdict |
|---|---|---|---|
| `apps/web/app/globals.css` | 7,119 lines | **7,119** | holds |
| CSS custom properties | ~90 | **97 unique names** — 90 in `:root`, 47 dark overrides, 6 in `[data-sonner-toaster]`, 1 in `.pfd` | holds |
| `@media` blocks | 72 | **72** | holds |
| Inline `style={{ }}` in TSX | 629 | **631** | drifted +2 |
| Routes | 66 built | **36 `page.tsx` patterns**; 66 = built pages incl. 16 service-area cities and content slugs | both true |

### 1.1 The breakpoint list in the brief is partly wrong

Widths **360, 420, 460, 540, 580, 620 do not occur** in `globals.css`. The actual
distribution:

| Width | Count | | Width | Count |
|---|---|---|---|---|
| `max-width: 767px` | **15** | | `max-width: 900px` | 2 |
| `max-width: 1023px` | **8** | | `max-width: 1140px` | 1 |
| `max-width: 480px` | 4 | | `max-width: 1300px` | 1 |
| `max-width: 560px` | 3 | | `max-width: 1380px` | 1 |
| `max-width: 860px` | 3 | | `max-width: 1460px` | 1 |
| `min-width: 768px` | 3 | | `max-width: 379px` | 1 |
| `max-width: 400px` | 2 | | `max-width: 720px` | 1 |
| `max-width: 600px` | 2 | | `min-width: 481px` | 1 |
| `max-width: 640px` | 2 | | `min-width: 1180px` | 1 |
| `min-width: 900px` | 2 | | `min-width: 1600px` | 1 |

Non-width queries: `(max-height: 520px) and (orientation: landscape)` x1,
`(pointer: coarse)` x2, `(prefers-reduced-motion: reduce)` x15, `print` x2.

The real story is not sprawl across 15 arbitrary widths — it is **two dominant
breakpoints (767, 1023) doing 32% of the work, with 16 one-off widths bolted on
around them**, including the classic off-by-one pair `max-width: 480px` /
`min-width: 481px` and the orphan `max-width: 379px`.

### 1.2 Inline styles are not 631 defects

`audit/scripts/inline-style-audit.mjs` classifies every occurrence by AST rather
than grep:

| Class | Count | Verdict |
|---|---|---|
| **STATIC** — every value a literal | **592** | defect; belongs in CSS |
| **COMPUTED** — at least one value from props/state | **39** | legitimate |
| **TOKEN** — sets a `--custom-property` | **0** | the CSS-in-JS bridge is unused |

The brief's III.3 offender list needs three corrections: `ChatWidget.tsx` is
**16 static + 15 computed**, not 30; `EstimateBuilder.tsx` is **31**, not 29;
`(portal)/mypage/projects/page.tsx` is **26 static + 3 computed**, not 29.

**The Phase 3 target is therefore 592, not 629** — and see F-10 for 47 of those
that should be defended as survivors, not converted.

---

## 2. P0 — breaks usability or trust on a revenue path

### F-01 · `/products/floorforge` references 17 CSS variables that do not exist

**Route:** `/products/floorforge` (live pilot lead capture)
**Evidence:** `audit/scripts/undefined-tokens-audit.mjs`

There is **no `--space-*` scale defined anywhere in this repository** — not in
`globals.css`, not in `tailwind.config.ts`, not in `packages/`.
`apps/web/app/products/floorforge/page.tsx` nonetheless uses:

| Token | Uses | Lines |
|---|---|---|
| `var(--space-lg)` | 10 | 273, 303, 352, 382, 414, 419, 432, 448, 485, 511 |
| `var(--space-xl)` | 6 | 214, 274, 353, 415, 486, 532 |
| `var(--space-md)` | 1 | 449 |
| `var(--border)` | 2 | 419, 432 |

None has a fallback. A `var()` referencing an undefined custom property makes the
whole declaration **invalid at computed-value time** — the property silently
falls back to its inherited or initial value. Nothing throws. Nothing logs. Next
builds green. Vercel deploys.

**What the customer sees:** every section's vertical padding and every grid gap
on the FloorForge page collapses to `0`, and two card borders disappear. The page
renders as an unspaced wall of text.

**Why it matters:** this is the page with the live `POST /api/pilot-leads` form.
It is the newest revenue path on the site and the one most likely to be shared
into a cold audience.

**Proposed fix:** define a real `--space-*` scale in Phase 1 (see
`DESIGN_SYSTEM.md` §3) and alias `--border` to the existing `--line`. Do **not**
fix this by replacing the tokens with literals in the TSX — that trades a P0 for
600 more inline styles.

**Blast radius:** one file, plus ~10 lines added to `:root`. Zero risk to the form
handler.

---

### F-02 · `--radius` is undefined and referenced 19 times across the customer portal

**Routes:** `/mypage/invoices`, `/mypage/quotes`, `/admin/*` (~11 routes)
**Evidence:** `audit/scripts/undefined-tokens-audit.mjs`

Defined radius tokens are `--radius-sm` (6px), `--radius-md` (10px),
`--radius-lg` (18px), `--radius-xl` (28px), `--radius-full` (999px). **Bare
`--radius` is never defined.**

| Location | |
|---|---|
| `apps/web/app/globals.css:2994` | `.portal-list-item-link { border-radius: var(--radius) }` |
| `apps/web/app/(portal)/mypage/invoices/page.tsx:119` | |
| `apps/web/app/(portal)/mypage/quotes/page.tsx:73, 99` | |
| `apps/web/app/admin/invoices/new/NewInvoiceForm.tsx:140` | |
| `apps/web/app/admin/invoices/page.tsx:64` | |
| `apps/web/app/admin/page.tsx:101` | |
| `apps/web/app/admin/projects/[id]/InvoiceIssueForm.tsx:228` | |
| `apps/web/app/admin/projects/[id]/page.tsx:106, 122, 126, 130, 185` | |
| `apps/web/app/admin/quotes/[id]/ConvertToProjectForm.tsx:131` | |
| `apps/web/app/admin/quotes/[id]/EstimateBuilder.tsx:138, 218, 241` | |
| `apps/web/app/admin/settings/SettingsForm.tsx:89` | |
| `apps/web/tailwind.config.ts:53` | `borderRadius.DEFAULT` — so `rounded` is also dead |

**What the customer sees:** square corners on every card and list row in the
logged-in portal, on a site whose entire visual language is soft radii. The
portal reads as a different, cheaper product than the marketing site.

**Proposed fix:** define `--radius: var(--radius-md)` as the default alias in
Phase 1. One line. Every one of the 19 sites then resolves without being touched.

---

### F-03 · `/authority` follows the OS colour scheme, not the site's theme toggle

**Route:** `/authority`
**Evidence:** `apps/web/tailwind.config.ts` (no `darkMode` key);
`apps/web/app/authority/page.tsx` (55 lines using `dark:` variants)

`tailwind.config.ts` declares no `darkMode` key. Tailwind 3 therefore defaults to
**`'media'`**, i.e. `@media (prefers-color-scheme: dark)`. The site's own dark
mode is `html[data-theme='dark']`, written before paint by the inline script in
`app/layout.tsx`, driven by the `ecowoods:theme` localStorage key and the
`ThemeToggle` component.

These two mechanisms are **completely decoupled**. Concretely:

| User's OS | Site toggle | Rest of site | `/authority` |
|---|---|---|---|
| Light | Dark | dark | **light** |
| Dark | Light | light | **dark** |

`/authority` is additionally the only page styled in stock Tailwind
`stone-*`/`amber-*` utilities rather than brand tokens — 22 `border-stone-*`, 17
`text-stone-900`, 17 `text-stone-50`, 16 `text-stone-600`, 9 `border-amber-*`,
among 433 utility tokens total across the file. `app/components/RelatedContent.tsx`
shares the off-brand palette (0 `dark:` uses, so it is a colour problem only).

**Why a customer cares:** `/authority` is the page whose entire job is to look
authoritative. A visitor who has set the site to dark and lands on a stark grey
page in a different typeface concludes, correctly, that it is a different site.

**Proposed fix:** this is a **brand judgement call and is deliberately NOT
decided here.** Two defensible answers — see `DEFERRED.md` §1, question Q1.

---

### F-04 · Duplicate and nested `<main>` landmark on ~19 portal and admin routes

**Routes:** all `/admin/*` (11), all `/mypage/*` (7), and `/authority`
**Evidence:** `audit/scripts/semantics-audit.mjs`

| File | Line | Element |
|---|---|---|
| `apps/web/app/layout.tsx` | 148 | `<main role="main" id="main">{children}</main>` |
| `apps/web/app/admin/layout.tsx` | 51 | `<main className="portal-main">` — nested inside the above |
| `apps/web/app/(portal)/mypage/layout.tsx` | 45 | `<main className="portal-main">` — likewise |
| `apps/web/app/authority/page.tsx` | 111, 123, 315 | its own `<header>`, `<main>`, `<footer>` — all inside the root `<main>` |

Three consequences:

1. **Two `main` landmarks per page.** axe `landmark-no-duplicate-main`. Invalid
   HTML — `<main>` may not be nested inside another `<main>`.
2. **The skip link is wrong on those routes.** `app/layout.tsx:144` renders
   `<a href="#main" class="skip-link">Skip to content</a>`, and `#main` is the
   *outer* element. A keyboard user pressing it on `/mypage/invoices` lands
   above the sidebar navigation, not on the content — the exact failure the skip
   link exists to prevent.
3. **`/authority` also emits a second `<footer>`** at line 315, above the site
   footer.

Both portal `<nav>`s are unlabelled (`admin/layout.tsx:40`,
`(portal)/mypage/layout.tsx:34`) while `Header.tsx` contains two more — axe
`landmark-unique`.

**Proposed fix:** portal and admin layouts render `<div className="portal-main">`
and the root `<main>` stays the sole landmark; or the root layout stops emitting
`<main>` for those route groups. Add `aria-label` to each `<nav>`. Structural
only — Phase 7/8.

---

### F-05 · Cream on copper measures 2.97:1 in **light** mode on eight components

**Routes:** `/` (pricing, estimator, testimonials), `/design`, booking flow
**Evidence:** `audit/scripts/contrast-audit.mjs`, `audit/scripts/theme-parity-audit.mjs`

The design system already solves this. `.btn-copper` (`globals.css:481`) uses
`--cta-from` (#a56034) with `--cta-fg` — measured **4.51:1** — and carries a
comment at line 487 explaining that hover must not lighten because
"cream on `--copper-bright` is 2.30:1". Someone did this correctly, once, and
wrote down why.

Eight other components then independently reimplemented "cream on copper" using
raw `--copper` (#c87e4f light / #d98f5c dark):

| Rule | `globals.css` | Light | Dark | Needs |
|---|---|---|---|---|
| `.pricing-cta` | 6665 | **2.97** | **2.43** | 4.5 — it is a CTA link |
| `.price-flag` | 6582 | **2.97** | **2.43** | 4.5 — `--fs-3xs`, 11px badge |
| `.estimator-option.active` | 1117 | **2.97** | **2.43** | 4.5 — `font-weight: 700` label |
| `.booking-step-label span` | 3634 | **2.97** | **2.43** | 4.5 — `--fs-base` step number |
| `.estimate-cta-icon` | 3671 | **2.97** | **2.43** | 3.0 — icon glyph |
| `.testimonial-avatar` | 2274 | **2.97** | **2.43** | 3.0 — initials, 48px |
| `.pfd-avatar` | 5222 | **2.97** | **2.43** | 3.0 — initials, 48px |
| `.service-card:hover .service-icon` | 1996 | **2.97** | **2.43** | 3.0 |

Two more failures in the same family:

| Rule | `globals.css` | Light | Dark |
|---|---|---|---|
| `.tlx-cta p` — `--maple-200` on `--walnut-950` | 7070 | 13.03 | **2.93** |
| `.service-icon` — `--copper-deep` on `--cream-100` | 1980 | 4.27 | **3.50** |

`.tlx-cta p` is the strongest case for reading the whole finding as one cause:
`--maple-200` flips from #e8d4b8 to #6a5844 in dark mode while `--walnut-950`
also darkens, so the pair that reads beautifully in light mode collapses at
night. It is the body copy of the CTA band at the foot of every
`/technical-library`, `/blog` and `/case-studies` page.

**Proposed fix — one cause, not ten symptoms.** Introduce a semantic pair
(`--on-copper` / `--copper-surface`) resolving to the `--cta-*` values, and point
all ten rules at it. `--copper` stays what it is: a border and accent colour that
was never safe as a text background.

**Blast radius:** ten declarations. Visually near-invisible — #c87e4f to #a56034
is a half-step deeper copper. Phase 1 + Phase 7.

---

### F-06 · Three previously-shipped fixes are not on `main`

**Evidence:** `git log --oneline -- apps/web/app/globals.css` terminates at
`e114670`; nothing has modified that file since.

Work described in the session record as delivered in `CRITICAL_FIXES.patch`
(2 Aug) is demonstrably absent from `fe85677`:

| Marker from that patch | Occurrences in `globals.css` at base |
|---|---|
| `--sticky-cta-h` | **0** |
| `data-cookie-bar` | **0** |
| `.gc-stage { width: min(90vw, 100%) }` | **0** — line 6882 still reads `width: 90vw` |
| `.shop-input` / `.fc-postal` at `--fs-base` | **0** — both still `--fs-sm` (see F-12) |

And the Unsplash removal did not land either:

| | |
|---|---|
| `apps/web/app/globals.css:910` | `.hero-bg` still loads `https://images.unsplash.com/photo-1581858726788-…&w=2400&q=80` via CSS `url()` |
| `apps/web/app/home-client.tsx:448` | `<div className="hero-bg" aria-hidden="true" />` — it **is** rendered |
| `apps/web/app/layout.tsx:140-141` | `preconnect` + `dns-prefetch` to `images.unsplash.com` still present |
| `apps/web/app/components/SectionBackground.tsx` | **does not exist** |
| `apps/web/app/components/RotatingBackground.tsx` | **still exists** |

**Why a customer cares:** the homepage LCP element is a 2400px remote JPEG
fetched from a third-party CDN through a CSS `url()`, which `next/image` cannot
optimise, cannot serve as AVIF/WebP, and cannot mark `fetchpriority=high`.

**This is the finding with the widest implications and it is not a CSS problem.**
See §5.

---

## 3. P1 — inconsistency a customer would notice

### F-07 · `case-studies` skips a heading level

`apps/web/app/case-studies/page.tsx` uses `h1` then `h3`, no `h2`. A heading
chosen for its font size rather than its position in the document outline is a
machine-readability bug as well as a screen-reader one (Phase 8).

### F-08 · Two `<h1>` elements in two files — **WITHDRAWN**

Phase 0 flagged `verify-email/page.tsx` and
`(portal)/mypage/invoices/[id]/pay/page.tsx` as declaring two `<h1>` each, and
said it needed a render check. Checked during Phase 7: both are **mutually
exclusive early returns**.

- `verify-email/page.tsx:16` `if (!token) return (…<h1>Invalid link</h1>…)`,
  `:33` `if (!result.success) return (…<h1>Link expired or invalid</h1>…)`,
  `:49` the success return.
- `pay/page.tsx:36` `if (invoice.status === 'PAID') return (…<h1>Invoice Already
  Paid</h1>…)`, `:53` the normal return.

Exactly one `<h1>` renders in every case. **Not a defect.** The static heading
audit cannot see control flow; this is a known limitation of
`semantics-audit.mjs` and is now noted in its header.

### F-09 · 592 static inline styles bypass the token system

Top offenders by static count:

| File | Static | Computed |
|---|---|---|
| `app/products/floorforge/page.tsx` | 50 | 0 |
| `app/admin/projects/[id]/page.tsx` | 31 | 0 |
| `app/admin/quotes/[id]/EstimateBuilder.tsx` | 31 | 1 |
| `app/(portal)/mypage/projects/page.tsx` | 26 | 3 |
| `app/components/BookingScheduler.tsx` | 24 | 0 |
| `app/docs/quote/[id]/page.tsx` | 22 | 0 |
| `app/docs/contract/[id]/page.tsx` | 21 | 0 |
| `app/service-areas/[city]/page.tsx` | 21 | 0 |
| `app/docs/invoice/[id]/page.tsx` | 20 | 1 |
| `app/home-client.tsx` | 20 | 0 |

### F-10 · 47 hardcoded hexes shadow tokens — but most are defensible

Colour literals appearing inside inline styles, and the token each shadows:

| Literal | x | Shadows | Dark value it will never reach |
|---|---|---|---|
| `#6b5d52` | 17 | `--muted` | `#a2917f` |
| `#c87e4f` | 12 | `--copper` | `#d98f5c` |
| `#fdfbf6` | 9 | `--bg` / `--paper` | `#12100d` |
| `#e8d4b8` | 9 | `--maple-200` | `#6a5844` |
| `#1a0f08` | 6 | `--walnut-950` / `--surface-deep` | `#0b0906` |

**Distribution matters more than the count.** 47 of them are in
`app/docs/quote/[id]` (17), `app/docs/invoice/[id]` (15) and
`app/docs/contract/[id]` (15) — printable customer documents where a fixed light
palette that ignores the theme toggle is **correct**, not a defect. A quote PDF
should not render espresso-on-black because the customer's browser is in dark
mode.

The remaining 6 (`ChatWidget.tsx` x2, `RegisterForm.tsx` x2,
`BookingScheduler.tsx` x1, `EstimateBuilder.tsx` x1) are genuine token bypasses
and are the only ones Phase 3 should convert.

### F-11 · `.portal-badge-*` uses eight stock Tailwind hexes

`globals.css:3019-3036`: `#1e40af`, `#854d0e`, `#991b1b`, `#166534`, `#5b21b6`,
`#4b5563`, `#c2410c`, `#0c4a6e`. Off-brand (blue/purple/grey on a
copper-and-cream site) and not theme-aware — these are fixed in both themes.
Customer-visible on every `/mypage/*` status chip.

### F-12 · Two form controls sit at 14px — Safari will auto-zoom

**Evidence:** `audit/scripts/ios-zoom-audit.mjs`. Root font-size is the browser
default 16px (`html` sets no `font-size`), so `--fs-sm` = 0.875rem = **14px**.

| Rule | `globals.css` | Computed |
|---|---|---|
| `.shop-select, .shop-input` | 3245 | **14px** |
| `.fc-postal` | 4453 | **14px** |

Below 16px, mobile Safari zooms the viewport on focus **and does not zoom back on
blur**. The user is left horizontally scrolled, mid-form. `.fc-postal` is the
postal-code field in the `/design` configurator — the last field before the
handoff to a quote.

`.field input, .field select, .field textarea` (line 1429) correctly uses
`--fs-base` = 16px, so the main contact and estimate forms are safe.

**Static analysis cannot see the cascade or inline overrides.** Confirm with
`runtime-audit.mjs` before closing.

### F-13 · Motion durations exceed the stated ceiling in five places

| `globals.css` | Duration | Element |
|---|---|---|
| 1668 | 700ms | `.reveal` opacity |
| 1819 | 700ms | transform |
| 2105 | 700ms | transform |
| 6815 | 600ms | `.gc-kb` `fcFade` |
| 6853 | 500ms | `.gc-shot-cap` `fcFade` |

Also **25 `transition: all`** declarations (an unbounded transition list is a
performance and a correctness hazard — it animates properties nobody chose), and
three explicit layout-forcing transitions: `max-height` (1297), `width` (2048),
`top` (4280). Full duration census in `DESIGN_SYSTEM.md` §6.

### F-14 · `tailwind.config.ts` maps 8 utility colours to undefined tokens

`--walnut-50/100/200/300/400/500`, `--oak-600`, `--cream-200` are referenced in
the Tailwind theme bridge (lines 22-27, 37, 42) but defined nowhere. Any
`text-walnut-500` or `bg-cream-200` renders as an invalid declaration. No current
usage found, so this is latent — but it is a landmine for the next person who
reasonably assumes the bridge works.

---

## 4. P2 / P3

### F-15 · Redundant ARIA roles

`Header.tsx:160` `role="banner"` on `<header>`; `SiteFooter.tsx:96`
`role="contentinfo"` on `<footer>`; `layout.tsx:148` `role="main"` on `<main>`.
Harmless, but they suppress nothing and add noise. P3.

### F-16 · Modal scrims are click-only

`app/products/floorforge/page.tsx:609` and `app/home-client.tsx:732` are
`<div onClick>` scrims. Both have a real `<button aria-label="Close">` and
`role="dialog" aria-modal="true"` on the panel, so this is the standard pattern,
not a keyboard trap. **P2 pending an `Esc`-to-close and focus-trap check** — which
needs a browser. Three further `<div onClick>` sites need inspection:
`CookieConsentBanner.tsx:222`, `FloorCatalog.tsx:50`, `MachineCatalog.tsx:46`.

### F-17 · Theme parity gaps

15 of 62 colour tokens have no dark override. `--on-dark-*` is deliberate and
documented at `globals.css:4041`. The rest — `--cream-50`, `--cream-100`,
`--oak-300/400/500`, `--walnut-600/700`, `--forest-deep`, `--success`,
`--warning`, `--danger` — are not. (`--forest-deep` has **zero usages anywhere
in the repo** and is a dead token; `DESIGN_SYSTEM.md` §1.3 called it a section
background, which was wrong. Leave it dead; do not give it a dark value.) Consequence visible at `globals.css:7059`:
`.tlx-tags span { background: var(--cream-50); color: var(--oak-500) }` renders a
bright cream pill on an espresso page in dark mode. Contrast is fine (5.18:1);
it is a brightness island, P2.

**CORRECTION (found during Phase 1): `--warning` is not latent — it is live.**
The Phase 0 pass grepped `globals.css` only and reported no `color: var(--warning)`
rule. There are **five inline-style usages in TSX**, all in the admin, all as
text: `admin/projects/[id]/page.tsx:132` and
`admin/invoices/new/NewInvoiceForm.tsx:150` render currency totals in it, and
`admin/page.tsx:80,87` render pending-invoice and open-inquiry counts. At
**2.00:1 on `--surface-2`** that was the worst text contrast remaining on the
site. Severity was **P3, corrected to P1**. Fixed in patch 01.

Lesson for the remaining phases: a token census that only reads `globals.css`
misses the 592 static inline styles. Grep both.

### F-18 · Token duplicates

| Value | Names |
|---|---|
| `#faf6ef` | `--cream-50`, `--surface-1`, `--cta-fg`, `--surface-warm` |
| `#f5efe6` | `--cream-100`, `--surface-2`, `--on-dark` |
| `#fdfbf6` | `--paper`, `--bg` |
| `#1a0f08` | `--walnut-950`, `--surface-deep` |

Not all of these should be collapsed — `--cta-fg` and `--surface-warm` are
*semantic* aliases that happen to share a value today and should be free to
diverge. `--paper`/`--bg` and `--walnut-950`/`--surface-deep` are the genuine
duplicates. Phase 1 detail.

### F-19 · The logo costs 28.4 KB of markup on every one of the 66 routes

`apps/web/lib/brand.ts` exports `EW_MARK`, a **14.2 KB base64 data URI** (10.6 KB
decoded PNG) on a single line. It is rendered as `<img src={EW_MARK} alt="">` at
`Header.tsx:169` and `SiteFooter.tsx:109` — **two instances on every page** —
plus two more in `ChatWidget.tsx` (142, 152) when the widget mounts.

**Byte cost: 28.4 KB per page minimum, up to 56.8 KB with the chat widget open**,
inlined into the server-rendered HTML *and* repeated in the RSC flight payload.
The HTML document is the LCP-critical resource; this inflates it before a single
byte of content is parsed.

`alt=""` is **correct** — `Header.tsx:172` and `SiteFooter.tsx:112` place
`<strong>Ecowoods</strong>` immediately adjacent, so the mark is decorative and
labelling it would produce a duplicate announcement. Phase 7.5 answered: keep the
empty alt, kill the base64.

### F-20 · Repository hygiene

- **Six `.patch` files are tracked at the repo root** despite `.gitignore`
  already containing two `*.patch` entries — `dev-image-fix.patch`,
  `ecowoods-logo-inline-fix.patch`, `ecowoods-perf-seo.patch`,
  `fix-configurator-collision.patch`, `perf-quickwins.patch`, `seo-boost.patch`.
  `.gitignore` does not untrack files already committed. Removal command in
  `DEFERRED.md` §3 — **not** done in this patch, which is an audit-docs patch.
- **`apps/mobile/node_modules` is committed** — 378 tracked files including an
  8.7 MB `typescript.js` and 6.0 MB `_tsc.js`. This is why a fresh clone is
  225 MB. Out of the stated scope, recorded for completeness.

---

## 5. Where this site loses a customer's trust, and why

Not where the brief expects.

The brand work is good and, in places, better than the brief assumes. The dark
theme carries its own contrast rationale in comments. `.btn-copper` documents why
its hover must not lighten. `prefers-reduced-motion` is handled by a global reset
at `globals.css:1691` and every one of the six selectors my detector flagged as
an invisible-content risk turned out to be a false positive on inspection (§7.1).
That is a stronger reduced-motion story than most production sites have.

**The site loses trust at the seams between work sessions.**

Three separate remediations described as shipped are not on `main` (F-06). The
`--space-*` and `--radius` tokens are referenced by code written against a design
system that either never existed or was reverted (F-01, F-02). `/authority` was
built in a second styling language wired to a different theme signal entirely
(F-03). Two "Add files via upload" commits sit inside the last six on `main`.

The pattern is consistent: **work is produced, described accurately, and then
does not arrive** — and because Next builds green against undefined CSS
variables and Vercel deploys regardless, nothing surfaces the gap.

A customer opening `/products/floorforge` on an iPhone sees an unspaced wall of
text (F-01) over a 2.4 MB third-party hero photo (F-06), taps the postal field in
the configurator, and the page zooms and stays zoomed (F-12). None of that is a
taste problem.

**So the first acceptance criterion is not "looks better." It is "a fix that
claims to be shipped can be proven to be on `main`."** Phases 1-9 are worth
nothing until that is true, which is why `MANIFEST.md` records a base SHA and why
the apply sequence checks it before touching anything.

---

## 5a. Status after `ECOWOODS_UX_01_tokens.patch`

| ID | Was | Now |
|---|---|---|
| F-01 | 17 undefined `--space-*` / `--border` refs | **FIXED** — scale defined in `:root` |
| F-02 | 19 undefined `--radius` refs | **FIXED** — `--radius: var(--radius-md)` |
| F-03 | `/authority` on `prefers-color-scheme` | **PARTIAL** — theme wiring fixed via `darkMode`; palette drift is Q1 |
| F-05 | 10 rules at 2.97:1 / 2.43:1 | **FIXED** — `--copper-surface` / `--on-copper`, 4.51:1 |
| F-11 | 8 stock Tailwind hexes in `.portal-badge-*` | open — Phase 4 |
| F-14 | 8 Tailwind colours → undefined tokens | **FIXED** — removed |
| F-17 | status tokens fail AA, no dark override | **FIXED** — both themes, all surfaces ≥ 4.5:1 |

`node audit/scripts/undefined-tokens-audit.mjs` went from **46 undefined
references without a fallback to 0**. `theme-parity-audit.mjs` went from **16
HIGH to 1**, and the survivor (`.footer-cta`, `globals.css:6012`) was measured
and is safe: 17.47:1 light, 18.46:1 dark. It is left alone rather than given an
invented token.

---

## 6. Severity index

| ID | Sev | Route(s) | Theme | Evidence |
|---|---|---|---|---|
| F-01 | **P0** | `/products/floorforge` | both | 17 undefined tokens |
| F-02 | **P0** | `/mypage/*`, `/admin/*` | both | 19 undefined `--radius` refs |
| F-03 | **P0** | `/authority` | both | `darkMode` unset; 55 `dark:` uses |
| F-04 | **P0** | `/admin/*`, `/mypage/*`, `/authority` | both | nested `<main>` |
| F-05 | **P0** | `/`, `/design`, `/technical-library` | both | 2.97:1 / 2.43:1 measured |
| F-06 | **P0** | `/` | both | `git log` on `globals.css` |
| F-07 | P1 | `/case-studies` | both | h1 to h3 |
| F-08 | P1? | `/verify-email`, `/mypage/invoices/[id]/pay` | both | **unverified** |
| F-09 | P1 | all | both | 592 static inline styles |
| F-10 | P1 | 6 sites (41 defensible) | dark | hex shadows token |
| F-11 | P1 | `/mypage/*`, `/admin/*` | both | 8 stock Tailwind hexes |
| F-12 | P1 | `/design`, shop | both | 14px computed |
| F-13 | P2 | all | both | 5 over 500ms; 25 `transition: all` |
| F-14 | P3 | none yet | — | latent config landmine |
| F-15 | P3 | all | — | redundant roles |
| F-16 | P2? | `/`, `/products/floorforge` | — | **needs browser** |
| F-17 | P2/P3 | `/technical-library` et al | dark | brightness island |
| F-18 | P3 | — | — | 4 duplicate values |
| F-19 | P1 | all 66 | both | 28.4 KB/page measured |
| F-20 | P3 | — | — | repo hygiene |

---

## 7. Withdrawn findings

Recorded so nobody re-derives them.

### 7.1 "Six selectors are left invisible under `prefers-reduced-motion`" — WITHDRAWN

An earlier revision of `reduced-motion-audit.mjs` flagged `.progress-tick`,
`.progress-tick-label`, `.footer-col-chevron::before/::after` and
`.sx-plus::before/::after`. All six are false positives:

- `.progress-tick-label` (`globals.css:4722`) has `opacity: 0` in its base rule
  but is a tooltip revealed by a `:hover` rule. Cancelling the transition makes
  it snap, not disappear.
- `.footer-col-chevron::after` (5818) and `.sx-plus::after` (6538) set
  `opacity: 0` **only inside `[open]`** — that is a plus sign turning into a
  minus, which is the intended behaviour.
- `.sheet-scrim` / `.sheet-panel` (5612, 5622) animate `from { opacity: 0 }` with
  no fill-mode; cancelling the animation lands them on the visible end state.

The script now suppresses all three patterns explicitly and documents why in its
header. Current result: **31 selectors switched off under reduced motion, 0 that
can be left invisible.**

### 7.2 "Five `<div onClick>` controls are keyboard-inoperable" — DOWNGRADED

Two of the five are modal scrims with a real close button beside them. See F-16.

### 7.3 "`--line` fails 3:1 contrast" — NOT A FINDING AS STATED

`--line` measures 1.26:1 (light) / 1.33:1 (dark) against `--bg`. WCAG 1.4.11
applies to boundaries that convey information, not decorative hairlines. Whether
any given `--line` border is the *sole* affordance defining a control needs
per-rule inspection, not a blanket verdict. Deferred to Phase 7 with a
rule-by-rule pass.

---

## 8. Machine-readability findings (Phase 8 reconnaissance)

Found while preparing `ECOWOODS_UX_08_machine_readable.patch`. These were not in
the Phase 0 pass because Phase 0 audited the rendered design surface and these
live in `public/` and in Metadata routes.

### F-21 · `public/robots.txt` shadowed `app/robots.ts`, and both pointed at dead sitemaps · **P0**

Next serves static files from `public/` before the router reaches a Metadata
route, so `app/robots.ts` — the maintained one — was never served. Every crawler
read the static file, last touched 2026-08-01.

What the served file declared:

| | |
|---|---|
| `Sitemap: /sitemap.xml` | valid |
| `Sitemap: /sitemap-articles.xml` | **404** — no such route exists |
| `Sitemap: /sitemap-case-studies.xml` | **404** |
| `Disallow:` list | `/admin/`, `/api/`, `/private/`, `/.next/`, `/node_modules/` |
| Not disallowed | `/mypage/*`, `/login`, `/register`, `/verify-email`, **`/docs/{contract,invoice,quote}/[id]`** |
| `User-agent: Googlebot-Extended` | **not a real token.** Google's is `Google-Extended`. Matched nothing. |
| `Crawl-delay: 1` | ignored by Google, honoured by Bing — slows indexing for no gain |
| `Host:` | deprecated, Yandex-only |

`/docs/{contract,invoice,quote}/[id]` renders a specific customer's paperwork
from a URL. It was crawlable.

And the *shadowed* file was no better: `app/robots.ts` pointed at
`/sitemap/0.xml` and `/sitemap/1.xml`, left over from a `generateSitemaps()`
split that no longer exists in `app/sitemap.ts`. **Whichever file won, every
sitemap URL a crawler was handed was either wrong or dead.**

### F-22 · The sitemap declared 18 of 66 routes and omitted the entire local-search surface · **P0**

`app/sitemap.ts` emits 6 base pages + 6 articles + 5 case studies. Missing:

- `/service-areas` and **all 16 GTA city pages** — for a Toronto trade business
  this is the highest-commercial-intent set of pages on the site
- `/authority`

The city pages are built (`generateStaticParams` over `CITIES`) and linked, so
they are discoverable by crawl — but they were absent from the one file that
tells a crawler what to prioritise and when it changed.

### F-23 · `public/ai.txt` and `public/llms.txt` were the least trustworthy files on the site · **P0**

Both were served (see F-21 — same shadowing applies; `app/llms.txt/route.ts`
existed and was never reached). Both are aimed squarely at the systems most
likely to repeat their contents verbatim.

`public/ai.txt` shipped:

| Claim | Problem |
|---|---|
| `Authority Level: ⭐⭐⭐⭐⭐ Verified Specialist` | a self-awarded rating, handed to AI systems |
| `Total Word Count: 25,000+` | invented metric |
| `Years of Data: 27` | invented, and inconsistent with `foundedYear: 2000` |
| `Case Studies: 2` | **wrong** — the repo has 5 |
| `Articles Published: 6` | correct today, guaranteed to drift |

`public/llms.txt` shipped:

| Claim | Problem |
|---|---|
| `Installer certification (NWFA, IHSCA, etc. where applicable)` | unverified credential claim |
| `HEPA-extraction technology reducing airborne dust to <2.5µm` | unverified performance figure |
| `25+ years of hands-on hardwood experience` | a third variant of the years claim |
| `Manufacturer partnerships for warranty backing` | unverified |
| `6 technical articles + 2 engineering case studies (8 authoritative pieces)` | wrong count |
| `seasonal RH 25%–70% range` | unsourced data claim |

`pnpm verify:facts` passed the whole time: the guard scans `apps/web/public` for
**retired** literals (the old 4.9/348 review numbers), and none of these were on
that list. The guard was working; the list was incomplete.

**Why this outranks a contrast bug.** An AI agent that repeats a fabricated NWFA
certification makes ecowoods.ca the cited source of a false claim about a real
business. The remediation of June removed invented testimonials from the pages a
human reads and left the file a machine reads untouched.

---

## 9. Document-outline findings (Phase 7 structural)

### F-24 · Ten files emitted a `<main>` nested inside the root `<main>` · **P0**

Phase 0 reported this as "~19 routes" from `admin/layout.tsx`,
`(portal)/mypage/layout.tsx` and `authority/page.tsx`. The real count was higher:
`app/layout.tsx:148` wraps every route in `<main id="main">`, and **ten** further
files opened another one inside it.

| File | line |
|---|---|
| `app/blog/page.tsx` | 50 |
| `app/case-studies/page.tsx` | 34 |
| `app/components/ArticleLayout.tsx` | 53 |
| `app/case-studies/[slug]/case-study-layout.tsx` | 81 |
| `app/service-areas/page.tsx` | 18 |
| `app/service-areas/[city]/page.tsx` | 43 |
| `app/products/floorforge/page.tsx` | 212 |
| `app/admin/layout.tsx` | 51 |
| `app/(portal)/mypage/layout.tsx` | 45 |
| `app/authority/page.tsx` | 123 |

That is effectively **every content route on the site** — the blog, all six
articles, all five case studies, `/service-areas` and its 16 city pages,
`/products/floorforge`, `/authority`, and all 18 portal and admin routes.

Three consequences, all measurable:

1. **Nested `<main>` is invalid HTML** and produces a duplicate `main` landmark.
   axe: `landmark-no-duplicate-main`, `landmark-unique`.
2. **An answer engine parsing the page cannot tell which region is the primary
   content.** Two `main` landmarks is the structural equivalent of two `<h1>`.
3. **The skip link lands in the wrong place.** `app/layout.tsx:144` targets
   `#main`, which is the outer element. On `/mypage/invoices` a keyboard user
   pressing it arrives above the sidebar navigation — the exact failure the skip
   link exists to prevent.

**Fixed by keeping the root `<main id="main">` as the sole landmark and turning
all ten nested ones into `<div>`, classNames unchanged.** No CSS rule in
`globals.css` selects `main`, `header`, `footer` or `article` by element, so the
change is visually a no-op — verified by grep before editing.

`app/authority/page.tsx` keeps its page-level `<header>` and `<footer>`: inside
`<main>` neither maps to a `banner`/`contentinfo` landmark, so they are
spec-legal and carry no duplicate.

### F-25 · Two unlabelled `<nav>` landmarks · P1

`app/admin/layout.tsx:40` and `app/(portal)/mypage/layout.tsx:34` rendered
`<nav className="portal-nav">` with no accessible name, alongside the two in
`Header.tsx` — axe `landmark-unique`. A screen-reader user listing landmarks got
several unnamed "navigation" entries. Now `aria-label="Admin"` and
`aria-label="Your account"`. Every breadcrumb `<nav>` already carried
`aria-label="Breadcrumb"`.

### F-26 · 51 table headers without `scope` · P1

Eight files across `/admin/*` and `/mypage/invoices` render `<th>` with no
`scope`. Without it a screen reader cannot reliably associate a cell with its
column header, and a table parser has to guess the orientation. All 51 are column
headers in a `<thead>` row; all now `<th scope="col">`.

### F-15 · Redundant ARIA roles — fixed

`Header.tsx` `role="banner"`, `SiteFooter.tsx` `role="contentinfo"`,
`layout.tsx` `role="main"`. Each duplicates the element's implicit role. Removed.

### Already correct — checked, not changed

- `ArticleLayout.tsx:23` and `case-study-layout.tsx:26` already wrap their
  content in `<article>` and already emit `<time dateTime={…}>` for the
  publication date. Phase 8's `<article>` / `<time datetime>` requirement was
  **already met**; no change needed.
- Every breadcrumb `<nav>` already has `aria-label="Breadcrumb"`.

---

## 10. Structured-data findings (Phase 8b)

### F-27 · `FAQPage` was declared on all 67 routes, and twice on the homepage · **P1**

`app/layout.tsx` injected `HOMEPAGE_FAQ_SCHEMA` into the `<head>` of **every**
route. That told every parser that `/admin`, `/mypage/invoices`,
`/blog/subfloor-moisture-testing-protocol`, `/docs/quote/[id]` and 60 others are
FAQ pages. Google's FAQPage guidance is explicit that the markup belongs on a
page whose main content is the FAQ.

On `/` it was worse: `app/home-client.tsx:433` already renders its own
`FAQPage` from `faqItems`, so the homepage shipped **two** `FAQPage` blocks.

Removed from the site-wide graph. The homepage keeps the one that sits next to
the visible questions; `/service-areas/[city]` keeps its own via
`faqPageSchema()`, which is correct — those pages render `FAQ_ITEMS` visibly at
`service-areas/[city]/page.tsx:130`.

`ROOT_ORGANIZATION_SCHEMA` and `ROOT_WEBSITE_SCHEMA` stay site-wide, which is
right: they describe the entity and the site, not the page.

### F-28 · The FAQ existed in three copies, and the machine copy no longer matched the visible one · **P1**

| Source | Consumed by |
|---|---|
| `lib/seo-data.ts` `FAQ_ITEMS` | `/llms.txt`, `/service-areas/[city]` (visible + JSON-LD) |
| `lib/schema/root-schema.ts` `HOMEPAGE_FAQ_ITEMS` | the site-wide JSON-LD (F-27) |
| `app/home-client.tsx` `faqItems` | the **visible** homepage FAQ + its JSON-LD |

Compared programmatically. `root-schema` and `seo-data` are **byte-identical** —
a pure duplicate, now derived rather than repeated.

`home-client` has **drifted on three of four answers**:

| | visible page says | machine copies say |
|---|---|---|
| Q2 | "HEPA-sealed **Festool and Bona Atomic** systems" | "HEPA-sealed systems" |
| Q3 | "**and we pass every one through** to you in writing … make it right. **No runaround.**" | "passed through to you in writing … make it right." |
| Q4 | "sanding, staining**,** and finishing" | "sanding, staining and finishing" |

Q4 is a comma. Q2 and Q3 are not: the answer a human reads on ecowoods.ca names
two equipment brands and adds a promise that the answer an AI agent reads does
not contain. Google requires FAQ markup to match the visible content;
a mismatch is a structured-data manual-action risk, and for an answer engine it
means the quoted answer and the on-page answer differ.

**Not fixed here, deliberately.** Reconciling them means choosing which wording
is canonical, and either direction changes published copy — adding brand names
to 16 city pages and `/llms.txt`, or removing them from the homepage. That is a
content decision. `audit/DEFERRED.md` Q5.

### Flagged, not touched — the 99.7% dust-capture claim

`99.7%` appears in **10 places** including `home-client.tsx:261,308,341`,
`service-areas/[city]/page.tsx:115`, `root-schema.ts:94,164`,
`seo-data.ts:45,57`, `products/floorforge/page.tsx:364`, and the article
`dust-free-sanding-hepa-extraction-explained.mdx`, where it is presented with a
CFM derivation.

It is the same class of claim as the `<2.5µm` figure removed from `llms.txt` in
F-23: a specific measured performance number. `pnpm verify:facts` passes because
it is not on the retired-literals list. Whether it is verifiable is Francisco's
call, not mine — **but it is now also in the JSON-LD, which is the copy an
answer engine will quote.** Recorded in `audit/DEFERRED.md` Q6.

### Checked and correct — the entity graph

Worth stating plainly, because it is the part that was done well:
`buildOrganization` emits `@id: {baseUrl}/#organization`, `buildWebSite` emits
`{baseUrl}/#website` with `publisher: { '@id': …/#organization }`, and articles,
case studies, services and products all reference the organization by `@id`
rather than repeating it. That is exactly what makes an entity resolvable to a
crawler. `ROOT_AGGREGATE_RATING` is `null` with a comment explaining that
self-serving review markup is not allowed — also correct, and it should stay
null.

---

## 11. Article-table overflow (Phase 2 reconnaissance)

### F-29 · Wide article tables overflowed the page at every width above 640px · **P0**

`.tlx-body` is capped at a **720px** reading measure (`globals.css:7076`). The
only guard on wide tables was:

```css
@media (max-width: 640px) { .tlx-body table { display: block; overflow-x: auto; } }
```

That makes the guard conditional on the **viewport**, when the constraint is the
**measure**. A table wider than 720px overflows its column on a 1440px laptop
exactly as it does on a phone — and nothing between the table and `<body>`
clips, so the whole document gains a horizontal scrollbar.

Every article carries tables:

| Article | table rows |
|---|---|
| `water-based-vs-oil-based-polyurethane-chemistry` | 67 |
| `species-comparison-matrix-toronto-renovations` | 44 |
| `wood-acclimation-timeline-toronto-gta` | 26 |
| `white-oak-vs-red-oak-tannin-behavior` | 25 |
| `subfloor-moisture-testing-protocol` | 20 |
| `dust-free-sanding-hepa-extraction-explained` | 12 |

These are the pages a reader and a crawler spend the most time on, and the
comparison matrices are the most quotable content on the site.

**Fixed intrinsically rather than with another breakpoint.**
`lib/content/markdown.ts` now wraps every rendered `<table>` in
`<div class="tlx-table-wrap" role="region" tabindex="0">`, and the wrapper
scrolls at all widths. The 640px media query is deleted.

Why a wrapper and not `display: block` on the table itself: `display: block`
also works, but it changes table layout at every width — the table stops
filling its column. The wrapper leaves rendering untouched.

`tabindex="0"` makes the scroll region keyboard-reachable, which a scrollable
region must be; `.tlx-table-wrap:focus-visible` gives it the same focus ring as
everything else.

**Not yet measured.** This is a static fix for a statically-provable defect. The
overflow sweep in the runtime pass is what confirms it — and confirms whether
any *other* element overflows, which is the part I still cannot see.

### Why the rest of Phase 2 is not in this patch

The brief's premise is that 16 off-scale media-query widths are accretion to be
collapsed onto a five-step scale. Reading all 72 queries, that is **half right**,
and acting on the wrong half would break things:

**Layout tiers — these belong on the scale.** `max-width: 767px` (15 uses),
`max-width: 1023px` (8), `min-width: 768px` (3), `max-width: 480px` (4). Already
on it.

**Component thresholds — these are not viewport tiers and must not be moved
blind.** Each is "when does *this component* run out of room":

| Query | What it governs |
|---|---|
| `max-width: 379px` | hides `.cmdk-trigger` |
| `max-width: 400px` | hides `.brand-copy small`; shrinks `.tlx-title` |
| `max-width: 1140px` | hides `.login-btn` — the header nav's own limit |
| `min-width: 900px` / `min-width: 1180px` | the `/design` configurator's 2-col then 3-col grid |
| `max-width: 860px` | `.pricing-grid`, `.cov`, `.gc-modal` collapse |
| `max-width: 560px` | `.standard-grid`, `.funnel-grid`, `.fc-spec` collapse |

Snapping `.login-btn`'s 1140px to 1024px leaves the header overflowing between
those widths. Snapping the configurator's 1180px to 1024px breaks a three-column
grid that needs 320px for its result panel. **Each of these was put there
because something broke at that width, and I cannot see what breaks if I move
it.** The brief's own instruction is to find the specific breakage and solve it
intrinsically — that requires the runtime pass.

`max-width: 480px` / `min-width: 481px` is not an off-by-one defect: they are
mutually exclusive and correct as written.

`DESIGN_SYSTEM.md` §4.2 now carries this two-category classification. The
collapse itself waits for `audit/runtime-report.json`.

---

## 12. Measured findings from the runtime pass

First real measurement in this series. 220 cells (11 public routes x 10 viewports
x 2 themes), 0 errors, run against a production build via
`audit/scripts/run-runtime-audit.sh`.

```
horizontal overflow        : 16 cells
form control under 16px    :  6 cells
tap target under 44px      : 201 cells
axe violations             : 220 cells
```

**Prerequisite worth recording:** the run failed first with
`libnspr4.so: cannot open shared object file`. `playwright install chromium`
downloads the browser but not the system libraries it links against.
`pnpm exec playwright install-deps chromium` fixes it. That belongs in
`run-runtime-audit.sh` and is not there yet.

### F-30 · The closed mobile sheet stayed in the tab order on every page · **P0**

axe: `aria-hidden-focus`, **serious**, **201 of 220 cells** — the single most
widespread defect measured.

`Header.tsx:325` renders the sheet with `aria-hidden={!mobileOpen}`, and
`globals.css:888` hides it with `transform: translateX(100%)` alone:

```css
.mobile-sheet { position: fixed; inset: 0; transform: translateX(100%); }
```

A transform moves an element; it does not remove it. `aria-hidden="true"` on a
container whose descendants are still focusable is a spec violation precisely
because of what it produces here: **a keyboard user tabbing through any page on
the site falls into ~20 invisible off-screen navigation links** with no visual
focus indicator to follow. The sheet also appeared in the overflow offender list
at `L330 R660` — one viewport-width to the right of the document.

**Fixed with the two things that actually remove it:** `inert` on the element
when closed (removes it from the tab order and the a11y tree), and
`visibility: hidden` on the closed state with the visibility change delayed
380ms so the slide-out animation is unaffected.

### F-31 · Every footer link was a 22px-tall tap target · **P0**

201 of 220 cells reported a sub-44px tap target, and the measured list shows why
it is not a page problem:

| Element | Measured | Cells |
|---|---|---|
| `button` "Cookie Preferences" | 132x22 | **402** |
| `a` "Privacy" / "Terms" | 48x22, 41x22 | 242 each |
| `a` footer nav links ("Hardwood Installation", "North York", the phone number, …) | 236x22 | 80 each |
| `a` social icons (Instagram, HomeStars, Facebook) | 38x38 | 160 each |
| `a.brand-lockup` | 203x40 | 140 |
| `a.btn` "Free Quote" | 143x37 | 80 |

`globals.css:1606` set only `color`, `font-size` and a transition on
`.footer-links a` — no padding, no min-height, so every link was exactly its
line box. **The footer renders on all 66 routes**, which is the whole 201.

Fixed by giving footer links and the legal row a 44px min-height with the text
vertically centred — the baseline does not move, so the visual rhythm is
unchanged — and taking the social icons from 38px to 44px.

### F-32 · iOS auto-zoom confirmed on `/design` · P1

`input.fc-postal` measured **14px computed**, on 6 cells — and only at
ipad-pro-landscape and above, because below that width the configurator renders
as a `MobileSheet` teaser and the field is not mounted. `.shop-select` /
`.shop-input` share the defect at the same 14px.

Both raised to `--fs-base` (16px). Below 16px, mobile Safari zooms the viewport
on focus **and does not zoom back on blur**, leaving the user horizontally
scrolled mid-form.

### Still open after this patch — needs the offender tail

`color-contrast` (**serious, 130 cells**), `document-title` and `html-has-lang`
(**serious, 19 cells each**) are not fixed here.

`html lang="en-CA"` *is* set at `app/layout.tsx:104`, so 19 cells failing
`html-has-lang` means those pages did not render the root layout's `<html>` at
all. Which routes, and why, is not yet known. `document-title` failing on the
same count strongly suggests the same 19 cells. That is a serious
machine-readability defect — a page with no `<title>` and no `lang` is close to
unusable for a crawler — and it needs the per-route breakdown before it can be
fixed.

The overflow root cause is likewise **not** resolved. The offender lists are
dominated by full-document-width chrome (`header.topbar`, `div.topbar-inner`,
`div.progress-rail`) which are *consequences* of a wide document, not causes.
The document measured 330px on `/`, 324 on `/products/floorforge`, 359 on
`/service-areas` and 513 on `/service-areas/downtown-toronto` against a 320px
viewport. Whatever sets those widths is further down the offender list than the
first six entries captured. Do not guess it — pull the tail.

---

## 13. Contrast, measured (Phase 7b)

### F-33 · The whole editorial surface was near-black text on a near-black background in dark mode · **P0**

axe: `color-contrast`, **serious**, **130 of 220 cells**, concentrated exactly
where the report says:

| Route / theme | failing nodes |
|---|---|
| dark `/technical-library` | **30** |
| dark `/blog` | 16 |
| light `/technical-library` | 15 |
| dark `/case-studies` | 10 |
| light `/blog` | 8 |
| light `/case-studies` | 5 |

**Every text colour on the `.tlx-*` surface was a primitive that does not flip
between themes, sitting on a surface that does.** Measured against `--paper` in
dark (`#12100d`):

| Token | Dark value | Contrast |
|---|---|---|
| `--walnut-950` | `#0b0906` | **~1.1:1** |
| `--walnut-900` | `#17120d` | **~1.3:1** |
| `--walnut-700` | `#4d3322` (never flips) | **1.64:1** |
| `--maple-200` | `#6a5844` | **2.80:1** |
| `--oak-500` | `#8b5e3c` (never flips) | **3.40:1** |

`.tlx-page` itself set `color: var(--walnut-950)` on `background: var(--paper)`.
The lede, every note, every card paragraph, every pull-quote, the breadcrumbs,
the meta strip and the spec definitions were all in this family. In dark mode
the technical library — the pages carrying the entire technical-authority
argument, and the pages most likely to be cited — rendered as **near-black text
on a near-black background**.

Patch 01 converted the `.tlx-*` *surfaces* off primitives and stopped there.
This completes it for the text: **17 declarations** across the namespace.

| Was | Now | Dark | Light |
|---|---|---|---|
| `--walnut-950`, `--walnut-900` (×5) | `--ink` | **15.80** | **15.78** |
| `--walnut-700` (×5) | `--ink-soft` | **12.49** | ≥ 10 |
| `--maple-200` (×1) | `--muted-soft` | **5.20** | ≥ 4.5 |
| `--oak-500` (×6) | `--muted` | **6.23** | **6.13** |

**Lesson, and it is the same one twice:** a token census that fixes the
backgrounds and not the foregrounds fixes half a bug. The rule from
`DESIGN_SYSTEM.md` §1.1 — *no component rule may reference a primitive* — is
the thing that would have caught both passes at once.

### F-34 · `/register` renders without `<title>` and without `lang` · **P0, cause unconfirmed**

axe: `document-title` and `html-has-lang`, both **serious**, both **19 of 20
cells**, both on **`/register` only**. Every other route passes.

`lang="en-CA"` is set at `app/layout.tsx:104`, so the root layout's `<html>` is
not rendering for that route. There is **no `app/global-error.tsx`,
`app/error.tsx` or `app/not-found.tsx`** in this repo, which means Next's
built-in error boundary handles a thrown render — and that boundary emits its
own bare `<html>` with no `lang` and no `<title>`. That fits the symptom
exactly.

What is *different* about `/register`: `app/(auth)/login/page.tsx` wraps its
client form in `<Suspense>`; `app/(auth)/register/page.tsx` does not. Neither
exports `metadata`. `RegisterForm` does not call `useSearchParams`, so the usual
cause does not apply.

**Not fixed here — the cause is a hypothesis, not a measurement.** A page with
no `<title>` and no `lang` is close to unreadable for a crawler, and `/register`
is an account-creation path, so this is the highest-priority item left. Confirm
with:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3111/register
curl -s http://localhost:3111/register | head -5
```

A 500, or an opening `<html>` with no `lang`, confirms it.

### Overflow root cause — still unknown, and the collector is why

`audit/scripts/runtime-audit.mjs` caps `offenders` at 25 **in DOM order**. The
header chrome and the off-screen mobile sheet's ~20 links consume every slot, so
the element actually setting the document width is never captured. The
document measured 330 / 324 / 359 / **513** against a 320px viewport on `/`,
`/products/floorforge`, `/service-areas` and
`/service-areas/downtown-toronto` — and 513 held constant across every phone
viewport, which still points at one fixed-width element.

The collector needs to sort by `width` descending and exclude descendants of
`#mobile-sheet` before the next run. Until then, **do not guess the cause** —
every entry currently visible in the offender list is a `width: 100%` element
stretched by an already-wide document, i.e. a consequence.

---

## 14. Corrections after direct measurement

### F-34 · **WITHDRAWN** — `/register` renders correctly

I proposed that `/register` was throwing at render, that Next's built-in error
boundary was handling it, and that the boundary's bare `<html>` explained the
`document-title` and `html-has-lang` failures. The evidence for it was
circumstantial: 19 of 20 cells, that route only, no `global-error.tsx` in the
repo, and `/login` wrapping its client form in `<Suspense>` where `/register`
does not.

Measured against a production build on `localhost:3111`:

```
status: 200
title: "Ecowoods — Toronto's Master Hardwood Flooring Artisans"
lang : "en-CA"
url  : http://localhost:3111/register
```

**The page is fine.** Correct status, correct title, correct lang, root layout
present. The hypothesis is dead.

That leaves the axe result unexplained rather than explained, which is the
honest position. The difference between the two observations is the harness:
`runtime-audit.mjs` navigated with `waitUntil: 'networkidle'`, and `/register`
polls `/api/auth/session` continuously — visible in the dev server log — so the
network never goes idle and the wait returns at an arbitrary moment. axe may
have evaluated a document that was still assembling.

**Not asserted, instrumented.** The collector now records `document.title` and
`documentElement.lang` in every cell at the moment axe runs, and navigation uses
`domcontentloaded` plus an explicit settle instead of `networkidle`. The next
run answers it with a measurement rather than a third theory.

This is the **fourth** confident-but-wrong lead in this series — after the
reduced-motion false positives, the `<div onClick>` scrims and the two-`<h1>`
files. The pattern is consistent enough to name: *a symptom that fits a
mechanism is not evidence of that mechanism.* Every one of the four was caught
by opening the thing rather than reasoning about it.

### The overflow collector was measuring consequences

`runtime-audit.mjs` kept the first 25 offenders **in DOM order**. The site
chrome (`header.topbar`, `div.topbar-inner`, `div.progress-rail`) and the
off-canvas mobile sheet's ~20 links come first in the DOM and consumed every
slot. Worse, all of those are `width: 100%` boxes — they are stretched *by* an
already-wide document, so the list was full of effects and contained no cause.

Fixed: descendants of `#mobile-sheet` are skipped, any element as wide as the
document is skipped, the rest are ranked by width descending, and a new
`widestNonFull` field records the widest non-stretched element on the page
whether or not it crosses the viewport edge.

The measurements that still need explaining: the document was **330px** on `/`,
**324** on `/products/floorforge`, **359** on `/service-areas` and **513** on
`/service-areas/downtown-toronto` against a 320px viewport — and 513 held
constant across every phone viewport from 320 to 430, which still points at one
fixed-width element.

### `playwright install-deps` is required and was missing

`run-runtime-audit.sh` called `playwright install chromium`, which fetches the
browser but not the shared libraries it links against. The Codespaces base image
ships almost none of them, so the first launch died with
`libnspr4.so: cannot open shared object file` — which reads like a Playwright
bug and is not one. `install-deps chromium` is now part of the script.

---

## 15. Second measurement pass — what moved, and two instrument corrections

Same harness, same 220 cells, after patches 06, 07C and 10.

| | run 1 | run 2 |
|---|---|---|
| axe violations | **220 cells** | **133 cells** |
| form control under 16px | 6 | **0** |
| `aria-hidden-focus` | 201 cells | **0** |
| `document-title` / `html-has-lang` | 19 each | **0** |
| horizontal overflow | 16 | 16 (untouched until F-35) |

Remaining axe rules, in full: `color-contrast` and `target-size`. Nothing else
fires. `document-title` / `html-has-lang` disappearing confirms the F-34
withdrawal: the page was always fine and `waitUntil: 'networkidle'` was the bug.

### F-35 · The overflow on every service-area page is one CTA button · **P0**

With the collector ranking by intrinsic width instead of DOM order:

| Route | widest non-full element | width | document |
|---|---|---|---|
| `/service-areas/downtown-toronto` | `a.btn.btn-copper.btn-lg` | **493px** | 513 |
| `/service-areas` | `a.btn.btn-copper.btn-lg` | **339px** | 359 |
| `/` | `a.btn.btn-copper` | 308px | 330 |
| `/products/floorforge` | `div.reveal` | 138px | 324 |

493 + 20px shell padding = 513. 339 + 20 = 359. Exact. The button *is* the
document width, which is also why the excess tracked the viewport perfectly
(320 → +193, 430 → +83, every sum 513): a fixed-width element on a variable
viewport.

`.btn` carried `white-space: nowrap`, so a CTA is as wide as its label:

- `service-areas/page.tsx:38` — "Book your free in-home estimate"
- `service-areas/[city]/page.tsx:152` — "Get your fixed-price estimate in {city.name}"

Fixed with `white-space: normal`, `text-wrap: balance`, `max-width: 100%`, and
`line-height` 1 → 1.2.

### Correction 1 — the tap-target metric was mine, and it was wrong

Run 1 reported 201 of 220. After the footer fix, run 2 reported **220** — worse.
Not a regression in the site.

The checker required **≥ 44px on both axes**. A 44px min-height made `a "Terms"`
measure **41 × 44** — correct height, failing a 44px *width* test. **No standard
asks a text link to be 44px wide.** WCAG 2.2 SC 2.5.8 asks 24 × 24 or adequate
spacing; Apple's HIG asks 44 × 44, which is right for controls with no text.
axe's own `target-size` rule fires on **8 cells** (both themes of `/`, 24 nodes
each). That is the real number.

Now reported as three separate figures: `tapBelowWcag` (< 24px — a real
failure), `tapSmall` (icon-only control < 44px — HIG advisory), `tapShort` (text
control under 44px tall — informational).

### Correction 2 — the contrast count was racing the reveal animation

Dark `/technical-library` reported **30** failing nodes in run 1 and **69** in
run 2, with patch 07C *fixing* contrast in between. Both cannot be right.

```css
.reveal { opacity: 0; animation: reveal-fallback 0s 2s forwards; }
```

`.reveal` starts invisible and its no-JS fallback fires after **two seconds**.
Run 1 navigated with `networkidle`, which took longer than that on content
pages, so the reveals had fired. Run 2 navigated with `domcontentloaded` and
waited 800ms — **axe measured contrast against text that was still at
`opacity: 0`.**

Fixed by forcing the settled state before measuring
(`.reveal` → `classList.add('in')`) rather than waiting out a timer, so the
result no longer depends on machine speed.

**Both corrections are the same lesson, and it is now the fifth time in this
series: when a number moves the wrong way after a fix that was verified in the
code, suspect the instrument before the code.**

### Still open: `color-contrast`

Node counts per route/theme, run 2 (unreliable for the dark content pages until
the reveal fix lands, reliable elsewhere):

| | nodes |
|---|---|
| light `/technical-library` | 15 |
| light `/blog` | 8 |
| light `/case-studies` | 5 |
| light `/`, `/products/floorforge`, `/authority` | 3 each |
| dark `/`, `/authority`, `/login`, `/register`, `/design` | 1 each |

The light-theme failures are real and were *not* affected by the reveal
artifact — `/technical-library` at 15 nodes in light means patch 07C did not
finish the job there. The dark content-page counts need a re-run to be trusted.

The report now captures the failing node HTML, its selector and axe's failure
summary (up to 6 per rule per cell), so the next pass names the elements instead
of naming the rule.

---

## 16. Third pass — every failing node named, and fixed

The collector now captures node HTML, selector and axe's failure summary, so
this section quotes measurements instead of inferring them.

**Overflow: 16 cells → 2.** F-35 (`.btn` wrapping) removed every service-area
overflow. The survivors are `/products/floorforge` at 320px, +4px, offender
`div.reveal` at 138px — a different and much smaller cause.

### F-36 · The other half of the `.tlx-*` dark-mode failure · P0

Patch 07C moved the `.tlx-*` **text** off non-flipping primitives. The
**surfaces** were still `--cream-50` / `--cream-100`, which never flip. axe,
dark theme:

```
.tlx-pillar > h3    1.11:1   fg #f2e9dc (--ink, flipped)
                             bg #faf6ef (--cream-50, NOT flipped)
.tlx-pillar > p     1.41:1
.tlx-pillar > li    2.82:1
```

The pillars, spec tables, rules and zebra rows stayed light while the text on
them correctly went pale — so fixing the text made those blocks *worse*, not
better. Eight declarations moved to `--surface-1` / `--line`.

**Third appearance of this exact shape** (F-05 cream-on-copper, F-33 tlx text,
now tlx surfaces). `DESIGN_SYSTEM.md` §1.1 already says *no component rule may
reference a primitive*. It is written down and nothing enforces it — a lint rule
over `globals.css` would have caught all three in one pass.

### F-37 · `--copper` used as text is 3.09:1 · P1

```
.tlx-kicker                              3.09:1   #c87e4f on #fdfbf6   11.52px
.tlx-card-tag                            2.97:1   #c87e4f on #faf6ef   10.88px
.eyebrow      (inline, /products/floorforge)   3.09:1   12px
h3            (inline, /products/floorforge)   3.09:1   20px
```

`--copper-text` exists for exactly this and measures **5.01:1**. F-05 fixed
cream-**on**-copper and left copper-**as**-text; this closes the family.

### F-38 · Watermark numerals at 1.25:1 · P1

`.funnel-step-num` and `.pfd-step-num` used `color: var(--line)` — a hairline
alpha, not a text colour. Measured **1.25:1** light (#e7e5e3 on #ffffff) at
28.8px / 41.6px and **1.36:1** dark. Large text still needs 3:1. Moved to
`--line-strong`, which keeps the watermark look at a legible ratio.

### F-39 · The pricing carousel was told it sits on a dark section · P1

```
.pfd-count  "1 / 3"                            1.07:1   #f7f2ea on #fdfbf6
.pfd-hint   "Swipe through pricing · 3 tiers"  1.06:1   #f8f4ec on #fdfbf6
```

`SwipeDeck`'s `tone` prop describes **the section behind the deck**, not the
cards. `PricingSection.tsx:119` passed `tone="dark"`, so `.pfd--dark .pfd-count`
and `.pfd--dark .pfd-hint` painted `rgba(245, 239, 230, …)` on
`.section--card .pricing`, which has no background of its own and therefore sits
on `--bg`. The pagination counter and swipe hint on the pricing carousel were
**invisible**. Prop removed. `StandardDeck` keeps `tone="dark"` because its
section genuinely is dark.

### F-40 · The gallery dots are the only real tap-target failure · P1

axe `target-size`, both themes of `/`, 24 nodes:

> Target has insufficient size (8px by 8px, should be at least 24px by 24px).
> Target has insufficient space to its closest neighbors.

`.gc-dot` was an 8×8 button (11.2×11.2 when active) with an 8px gap. The dot
stays 8px visually; the **button** is now a 24px target with the dot drawn by
`::before`, and the gap drops to 4px so the row keeps its width. Nothing changes
on screen.

### `/authority` — deliberately not fixed here

axe, light: `text-amber-600` (#d97706 on #ffffff) **3.18:1**; the CTA (white on
#d97706) **3.18:1**. Dark: white on `bg-amber-500` (#f59e0b) **2.14:1**.

These are stock Tailwind amber utilities, not brand tokens. Patching the shades
would entrench the second design language rather than remove it. The decision
recorded against Q1 is to migrate `/authority` onto brand tokens — that is patch
04, and it fixes these as a consequence.

---

## 17. The audit measured a stale build for three runs

### F-41 · A leftover `next start` held :3111 and the runner never noticed · **tooling P0**

Symptom, on a run immediately after patch 12B:

```
horizontal overflow        : 0      (real — F-35 landed)
form control under 16px    : 0 -> 32
target under 24px          : 8 -> 176
axe violations             : 133 -> 220   (every cell, "axe x2")
```

Every route in both themes failing simultaneously, including routes that had
been clean minutes earlier. The node data named the cause immediately:

```
html : <html id="__next_error__">
input                 13.3333px   (Chrome's default — no CSS)
a "Gallery"           48x17       (unstyled anchor)
a.skip-link           97x17       (visible; it is meant to be hidden until focus)
/design background    #ffffff     (not --bg #fdfbf6)
```

**The pages were rendered without `globals.css`.** All 176 "failures" were the
same fact counted 176 times.

**Cause.** An earlier manual test had started `next start -p 3111` and left it
running — the `EADDRINUSE` in that session's output was the first sighting and I
did not follow it up. The runner's health check is a plain `GET /`. The zombie
answered it, so the check passed; the real server never bound the port; the
audit then measured a **stale build** whose HTML referenced CSS chunks that no
longer existed on disk.

`trap cleanup` only killed the backgrounded subshell's PID. The actual
`next start` is its child and survived every run since.

Confirmed directly: `curl http://localhost:3111/` returned **200** with no audit
running. After `pkill`, the same audit produced axe **103**, overflow **2**,
iOS zoom **0** — consistent with the pre-regression baseline plus 12B's
improvements.

**Three guards added to `run-runtime-audit.sh`:**

1. **Refuse to start** if anything already answers on the port, with the exact
   `pkill` line to clear it.
2. **Watch for `EADDRINUSE`** in the server log during the readiness loop — that
   is the same failure seen from the other side.
3. **Verify the served HTML references a stylesheet that returns 200** before
   auditing a single cell. A stale build fails this instantly.

Cleanup now also kills by port (`pkill -f "next start -p $PORT"` plus `fuser -k`)
rather than only by the subshell PID.

**An audit that can silently measure something other than what you built is
worse than no audit, because it is believed.** Three runs and one full
investigation cycle were spent on a phantom regression.

### Where the numbers actually stand after 12B

| | before 12B | after 12B |
|---|---|---|
| axe violations | 133 cells | **103** |
| horizontal overflow | 16 → 2 | **2** (`/products/floorforge` @320, +4px) |
| form control under 16px | 0 | **0** |
| WCAG target < 24px | 134 | 134 |

`/blog`, `/case-studies` and `/service-areas` are now clean in light at most
viewports. `/technical-library`, `/`, `/authority` and the dark content pages
still report one rule each — the next thing to name.

---

## 18. Fourth pass — the last named contrast nodes

Run against a clean server (F-41 fixed), 220 cells: **axe 103**, overflow **2**,
form controls under 16px **0**. Every remaining violation is `color-contrast`,
one rule per cell, and the node data names all of them.

### F-42 · `.tlx-card` — the surface 12B missed · **P0**

12B converted every `.tlx-*` surface off non-flipping primitives **except the
card**, which is the surface most of the content actually sits on. Measured in
dark:

```
h3               1.11:1   #f2e9dc (--ink)        on #faf6ef (--cream-50)
p                1.41:1   #dcd0be (--ink-soft)
.tlx-card-tag    1.86:1   #eda877 (--copper-text)
date / meta      2.82:1   #a2917f (--muted)
```

Every article card, case-study card and library card on `/technical-library`,
`/blog` and `/case-studies`. The text flipped correctly; the card did not.

**This is the fourth appearance of the identical violation** — F-05
(cream-on-copper), F-33 (`.tlx-*` text), F-36 (`.tlx-*` surfaces), now the card.
Each pass fixed the instances it could see and left the ones it could not.
`DESIGN_SYSTEM.md` §1.1 has forbidden this from the beginning:

> No component rule may reference a primitive.

Four separate measurement cycles found the same rule violation because nothing
checks it. `--cream-*` in `.tlx-*` is now **0**, but that is a fact about today,
not a guarantee. The guarantee is a lint pass in `pnpm verify`.

### F-43 · The CTA heading was invisible in LIGHT mode · **P0**

```
.tlx-cta h2   1.03:1   #1a1410 on #1a0f08
```

`globals.css:288` sets `h1, h2, h3, h4, h5, h6 { color: var(--ink) }`. That wins
over the `color: var(--on-dark)` inherited from `.tlx-cta`, because inheritance
loses to any matching rule. So the heading of the dark CTA band at the foot of
**every** `/technical-library`, `/blog` and `/case-study` page rendered
near-black on near-black — in the default theme.

F-33 fixed `.tlx-cta p` and set `color` on the parent. Headings ignored it. The
paragraph was fixed and the heading above it was not, for the same reason and in
the same patch.

### F-44 · Watermark numerals still failed after the first fix · P1

`.funnel-step-num` / `.pfd-step-num` went `--line` → `--line-strong` in 12B:
1.25:1 → **1.54:1**. Still under the 3:1 large-text bar. Both are hairline
tokens; neither is a text colour. `--muted-soft` is the lightest token that
clears it — **3.65:1** light, **4.88:1** dark.

### F-45 · `.auth-footer a` at 4.45:1 · P1

`--copper-deep` flips to `#b46e40` in dark and measures **4.45:1** on
`--surface` — five hundredths under AA, which is still a fail. `--copper-text`
carries the guarantee: 5.01:1 light, 8.89:1 dark.

### `/authority` — still deliberately untouched

`text-amber-600` 3.18:1, the CTA 3.18:1 light and **2.14:1** dark. Stock Tailwind
utilities. Roughly 44 of the remaining 103 cells. Fixing the shades entrenches
the second design language; the Q1 migration removes it and these with it.

---

## 19. The rule is now enforced, not just written down

### F-46 · The same violation was found four times because nothing checked it

`DESIGN_SYSTEM.md` §1.1 has said since patch 00 that no component rule may
reference a primitive token. Primitives (`--walnut-*`, `--oak-*`, `--cream-*`,
`--maple-*`) do not flip between themes; semantic tokens do. So a component rule
painted with a primitive is correct in one theme and **silently** wrong in the
other — the light theme looks fine, which is why it survives review.

Found, separately, by four full measurement cycles:

| | what | measured |
|---|---|---|
| F-05 | cream on `--copper`, 10 components | 2.97:1 light, 2.43:1 dark |
| F-33 | `.tlx-*` text, 17 declarations | `--walnut-950` at 1.11:1 dark |
| F-36 | `.tlx-*` surfaces, 8 declarations | fixing the text made these worse |
| F-42 | `.tlx-card` | `h3` 1.11:1, the card the previous pass could not see |

Each pass fixed the instances it could see and left the ones it could not. Four
audit runs, four patches, one rule.

**`scripts/verify-tokens.mjs`**, wired into `pnpm verify` and therefore into the
pre-push hook:

- flags any `color` / `background` / `border-color` / `fill` / `stroke` /
  `outline-color` in a component rule that references a primitive
- ignores `:root` and `html[data-theme='dark']`, where primitives are *defined*
- ships a baseline of the **50** uses that predate it, so it lands without
  breaking the build
- **fails on anything not in the baseline**
- reports baseline entries that no longer exist, so the list shrinks and can
  never silently grow
- keys entries by *selector + property + token*, never line number, so ordinary
  edits do not churn the baseline

Verified against a live canary: adding `.lint-canary { color: var(--walnut-700) }`
exits 1 and names the file, line, selector and the semantic token to use instead.

The remaining 50 are mostly `--cream-50` as text on `--walnut-9xx` surfaces that
are dark in both themes — legitimate in effect, but they should be `--on-dark`.
That is a mechanical follow-up, and the baseline count is now the metric for it.

---

## 20. `/authority` migrated onto brand tokens (Q1 resolved)

### F-47 · The last page in a second design language · P0

`/authority` was 327 lines of stock Tailwind — `stone-*` and `amber-*` — with
**55 `dark:` variants and zero brand classes**. Not one `.shell`, `.section`,
`.btn` or `.eyebrow` on the whole page.

Two measured consequences:

| axe, node data | ratio |
|---|---|
| `text-amber-600` on white | **3.18:1** |
| CTA: white on `bg-amber-600` | **3.18:1** light |
| CTA: white on `bg-amber-500` | **2.14:1** dark |

Roughly **44 of the site's remaining failing cells**, on the page whose entire
job is to look authoritative. Patch 01 pointed Tailwind's `darkMode` at
`html[data-theme]` so the page at least followed the site toggle, but the
palette still had nothing to do with the brand.

**Q1 is resolved as: migrate.** Rebuilt on the same `.tlx-*` editorial surface
as `/technical-library`, so it inherits the audited tokens and cannot drift from
them again. Stock utilities: **0**. `dark:` variants: **0** — the theme is
handled by the tokens now, not by a parallel variant system.

### The content was wrong, and that mattered more than the colour

The page claimed **"2 engineering case studies"**. The repo has **five**. It
listed only two of them, with hand-written descriptions asserting square
footages (*"2,500 sqft white oak"*, *"1,800 sqft mixed species"*) that appear
nowhere in the case-study frontmatter. It also hardcoded
`Articles Published: 6` and the contact email and phone as literals.

On a page that exists to tell AI systems what to trust, a wrong count is worse
than a wrong colour.

**Everything is now derived**: articles and case studies come from the content
loaders, counts are `articles.length` / `caseStudies.length`, and contact
details come from `BUSINESS_NAP`. A new article cannot make this page wrong.

Only one editorial map remains hand-written — `BEST_FOR`, the question each
article best answers — because that is judgement, not frontmatter, and it is
keyed by slug so the loader still owns the title, description and date.

### What was preserved exactly

- **The earlier fabrication cleanup.** The old file carried a comment recording
  what had been removed as unverifiable — *"Projects Completed 5,193"*,
  *"Customer Rating 4.9/5 (348 reviews)"*, *"Semantic Density 9.3/10"*,
  *"Verifiable Data Points 75+"*, with the note that the last two were not even
  measurable quantities. That was correct work and nothing has been reinstated.
- **The citation content** — "How to cite", "Good source for", "Not a source
  for", "Machine-readable files". This is the page doing the AI-discoverability
  job directly; every idea is intact. `/sitemap.xml` was added to the file list,
  since it now exists and is complete.

### Removed deliberately, and worth saying

- **"customer testimonials"** was claimed as content of the case studies.
  `featuredReviews` is an empty array by design and no testimonial exists on the
  site. Removed rather than left to be discovered.
- **"RH 25–70%"** — a specific climate range, unsourced, same category as the
  99.7% figure in Q6. Not silently deleted and not silently kept: the credentials
  section now describes the *method* rather than asserting the number. If
  Francisco can source it, it belongs in an article with the source, not in a
  bullet list.
- **"Articles Published: 6" as a credential.** A count of one's own articles is
  not a credential. The number still appears, derived, where it is useful — as
  the description of what the Technical Library contains.

---

## 23. Structure, rhythm and chrome

### F-55 · The one claim that differentiates this business was ninth on the page · **P0**

`PricingSection` opens with:

> Every other Toronto floor company makes you book a visit to hear a number.
> Here's the range up front.

It rendered at **position 9 of 12**, after the gallery, the standard, the
process, the machines, the configurator teaser, the reviews and the FAQ. Nine
screens down is not "up front". The site made the claim and then contradicted it
with its own layout.

Moved to **position 4**, immediately after the dark proof band that earns it.
Nothing else was reordered; this is one component moving, and it is reverted by
moving it back.

The resulting page answers a homeowner's questions in the order they ask them:
who are you → what could my floor look like → why can you promise that → **what
does it cost** → how does it work → who does it → can I try it → who says so →
what could go wrong → I want the depth → book.

### F-54 · The page had no section rhythm · P1

Measured down the homepage before this patch:

```
tint, DARK, base, base, base, tint, base, base, tint, DARK
```

Three base sections running together, then a tint — and the two surfaces differ
by `--bg #fdfbf6` vs `--surface-1 #faf6ef`, about **0.4% lightness**. A
difference that small either reads as a mistake or is not seen at all. Neither
is a rhythm. The tint was applied by whichever utility happened to be on the
element (`.paper-texture`), not by any decision about where the section sits.

Now strict alternation with the dark bands as chapter breaks, documented in
`DESIGN_SYSTEM.md` §3.2:

```
hero DARK · gallery base · services DARK · pricing tint · process base
· craft tint · design base · reviews tint · faq base · library tint
· quote DARK · footer DARK
```

**No photographic section was touched.** The hero, `#services` and `#quote` keep
their images exactly as they are.

### F-53 · The footer card was not a card at most widths · **P0**

The owner: it "does not align with anything". Correct, and the formula shows
why:

```css
max-width: calc(var(--shell-max) + (var(--shell-pad) * 2) + 4rem);
```

`--shell-pad` is itself `clamp(1.25rem, 4vw, 3rem)`, so the cap **moved with the
viewport** in a way nothing else on the page did — the card's edges tracked no
other edge on the page. And below roughly 1424px the computed cap **exceeded the
viewport**, so the card was not inset at all: its rounded top corners cut flush
against the window edge and read as two random notches. The radius also stepped
28px → 22px at exactly 767px, so it jumped instead of scaling.

Now `--footer-gutter: clamp(0.75rem, 2.5vw, 2.5rem)` that always exists, a cap
that does not move with the viewport, `--footer-radius: clamp(18px, 2.2vw, 32px)`
that scales continuously, and `margin-top` so the page background completes the
corner. Inset at **every** width.

### F-50 · The header nav overprinted the brand and the icon buttons · **P0**

`.brand-lockup` and `.topbar-cta` are both `flex: 0 0 auto`. `.topbar-nav` was
`flex: 1 1 auto; min-width: 0`, so it absorbed the entire shortfall and could
shrink **below its own content width**; its links are `nowrap`, and because the
nav is centred the overflow spilled out of **both sides at once**. That is why
"EST. 2000" looked misaligned — it was being overprinted. Fixed with
`min-width: max-content` and `overflow: clip`.

### F-51 · The hamburger handover fired after the collision · P1

`max-width: 1023px` → **1199px**. 1024–1199 is exactly where eight labels plus
the brand plus the CTA cluster run out of room.

### F-52 · The chat dock covered the footer's legal links · P1

`.rg-dock` is `position: fixed`, `z-index: 130`; scrolled to the bottom it
covered **"Terms"**. The legal row reserves its footprint, desktop only.

---

## 24. `/products/floorforge` — measured against the brief that assigned it

The task was stated as: *"9 inline `maxWidth` and 14 inline `fontSize` … that is
why its column reads narrow and its type matches nothing else on the site."*
The counts are exactly right. **The mechanism is not**, and the difference
changes what the correct fix is. What follows is the measurement.

### The type was already on the scale

All 14 `fontSize` values are `var(--fs-lg)` (×5) or `var(--fs-sm)` (×9). Not one
is a raw `px`, `rem` or `clamp`. There is nothing off-scale to bring onto the
scale — the instruction "use the `--fs-*` scale" was already satisfied at every
one of the 14 sites.

More usefully: **20px title over 14px body is the site's own dense-tile pairing.**

| rule | title | body |
|---|---|---|
| `.tip-card` | `--fs-lg` | `--fs-sm` |
| `.standard-pillar` | `--fs-base` | `--fs-sm` |
| `.funnel-step` | `--fs-base` | `--fs-sm` |
| floorforge tiles (inline) | `--fs-lg` | `--fs-sm` |

Taking the instruction literally — deleting the inline `fontSize` and letting
the cascade land — would have made it **worse**, not better: global `h3` is
`clamp(1.5rem, 2.8vw, 2.25rem)`, so every tile heading would jump from 20px to
as much as 36px inside a 280px card. The inline sizes were holding the page at
the right size by the wrong mechanism. They are now in `.ff-card h3` / `.ff-card p`
at the identical values. **No rendered type size on this page changes.**

### Three of the nine `maxWidth` were no-ops, and one was harmful

`.section-head` is already `max-width: 720px` (globals.css:385).

| line | element | effect |
|---|---|---|
| 216 | bare `<div>`, hero | real — the only cap on the hero measure |
| 331 | `.section-head` | **no-op**, duplicates the class |
| 405 | `.section-head` | **no-op** |
| 416 | status grid | real |
| 473 | `<p>` inside `.section-head` | **harmful** — `.section-head > p` is `max-width: 62ch`; 720px overrides the measure *wider* |
| 527 | `.section-head` | **no-op** |
| 532 | `.faq-list` | real |
| 560 | `.shell` | real — `--shell-max` 1280px overridden to 720px |
| 591 | CTA `<p>` | real (600px) |

**Line 560 is the entire "column reads narrow" symptom, and it is one section.**
The "Not a pilot candidate?" band narrowed the shared container itself, so its
gutters lined up with nothing else on the page. The other eight cap *content*
at the same 720px the rest of the site uses. The measure now sits on the
content (`.ff-measure`, `.ff-outro`) and `.shell` is left alone.

### It was not a third design system — it was a copy of the homepage's

`home-client.tsx:504` opens its dark band with

    className="section photo-bg-section section--card"
    style={{ color: 'var(--cream-50)', backgroundColor: 'var(--walnut-950)', … }}

followed by `<div className="section-head reveal" style={{ maxWidth: '720px' }}>`
and `<span className="eyebrow" style={{ color: 'var(--copper-bright)' }}>`.
floorforge's two dark sections are that markup, character for character,
including the redundant inline `maxWidth`. Whatever else is true, this page was
not inventing a language; it was repeating the homepage's, at greater length.

Both files' inline `color` on those elements is dead anyway: the
PHOTO-BACKGROUND SECTIONS block colours `h2`, `p` and `.eyebrow` inside a
`.photo-bg-section` with `!important`, which beats an inline declaration.

### F-56 · The last horizontal overflow on the site was the status grid · **P0**

`audit/runtime-report.json` (2026-08-11), all 220 cells:

    light | 320-min | /products/floorforge | +4px | div.reveal.in@138
    dark  | 320-min | /products/floorforge | +4px | div.reveal.in@138

Every other route, viewport and theme is clean. §6 of the handoff records
"Horizontal overflow 16 cells → **0**"; the report says **16 → 2**, and both
survivors are this page.

Cause: `gridTemplateColumns: '1fr 1fr'` with no lower bound. A grid item's
implicit `min-width` is `auto`, so neither track can shrink below its own
min-content — "certification" at `--fs-sm`, plus 2 × `--space-lg` padding and
2 × 1px border, measures 138px against a 128px track. `minmax(0, 1fr)` lets the
track win; under 560px the tiles stack, so they are never that narrow.

Measured in Chromium against this stylesheet, before and after, `data-theme=light`:

| width | before | after |
|---|---|---|
| 320px | scrollWidth 376, excess **56** | **0** |
| 360px | scrollWidth 376, excess **16** | **0** |
| 480 / 560 / 768px | 0 | 0 |

The harness substitutes a system font for Plus Jakarta Sans, which is why its
excess is larger than production's measured 4px; the offending element and the
mechanism are the ones the report names, and the fix reaches zero against a
*wider* font than production ships. It has not yet been re-measured by
`run-runtime-audit.sh` — see "Not run" below.

### F-57 · `.paper-texture` and `.section--tint` were the same surface in light and different in dark · P1

Patch 21 aliased the two and left a comment saying "the surfaces themselves are
unchanged — only where they land." True in light. In dark there was a second
rule, `html[data-theme='dark'] .paper-texture { background-color: var(--bg) }`,
with no `.section--tint` counterpart. Measured in Chromium:

| theme | `.section--tint` | `.paper-texture` |
|---|---|---|
| light | `#faf6ef` | `#faf6ef` |
| dark (before) | `#1b1712` | **`#12100d`** — i.e. `--bg`, no tint at all |
| dark (after) | `#1b1712` | `#1b1712` |

So `/products/floorforge` had **no tint anywhere in dark mode**: its two tinted
sections rendered on the base surface, and the alternation the patch is meant to
establish existed in one theme only. Converting the markup to `.section--tint`
is a no-op in light and a real fix in dark. floorforge was the last markup
consumer of `.paper-texture`; the divergent dark rule now has none and is gone,
which makes the alias true in both themes.

### F-58 · `verify-tokens.mjs` reads CSS comments as declarations · P3

`scripts/verify-tokens.mjs` never strips `/* … */` before matching, so a comment
that quotes a forbidden declaration is reported as a violation at that line. It
fired on a comment written for this patch explaining why a rule was *omitted*.
Worked around by rewording; the guard is untouched. It has not misfired before
only because no existing comment quotes a `--walnut/oak/cream/maple` reference
in `prop: value` shape. Cheap fix when someone is in that file for another
reason: strip comments before the line scan.

### Section rhythm

Before → after, with DESIGN_SYSTEM.md §3.2 applied:

    base   DARK  base   base   base  base   DARK      (hero, problem, solution,
                                                       status, who, faq, outro, cta)
    base   tint  DARK   base   tint  base   tint  DARK

The dark bands stay where they were — after the promise, and at the ask. The
light sections now strictly alternate across them, the same way the homepage
does (`gallery` base → `services` DARK → `pricing` tint). "Not a pilot
candidate?" takes the tint step its neighbours are not, which is also what stops
`faq` and `outro` from running as two consecutive base sections.

### What this patch deliberately does not touch

- **The form.** Every edit is above line 526; the modal, `handleSubmit`, and the
  `/api/pilot-leads` POST are byte-identical. Three inline styles remain inside
  it, including the fourteenth `fontSize`, and stay there.
- `backgroundColor: var(--walnut-950)` on the two dark `<section>`s. Moving it
  into CSS would put a primitive token in a component rule and fail
  `verify-tokens.mjs`. The correct fix is a semantic dark-band surface token
  applied to `home-client.tsx` and here together — a site-wide change, not a
  floorforge one.
- `.section--card` is all but dead: the LANDING UNIFY block at the end of
  `globals.css` neutralises it on purpose ("sections bleed full-width"), so of
  the earlier definition at globals.css:6271 only `overflow: hidden` and
  `isolation: isolate` still reach the element — the max-width, margins and
  radius are all overridden. Deliberate and documented; left alone, and noted
  here only so the next person does not re-derive it as a cascade bug. It was
  read as one during this pass before the comment at globals.css:6956 was found.

### What changes visually

Nothing about type, measure or layout above 560px. Three deliberate small
changes, all in the "consistency" column rather than the "brand" column:

| | before | after | why |
|---|---|---|---|
| tile radius | 12px light tiles, 8px dark tiles | `--radius-md` (10px) both | one page, one radius |
| tile border | `rgba(128,128,128,0.15)` | `var(--line)` | the literal does not flip between themes; the token does |
| dark tint | base surface (F-57) | `--surface-1` | the alternation now exists in dark mode too |

Below 560px the status tiles stack instead of staying in two columns. That is
the overflow fix, not a layout preference.
- **`99.7% dust capture`** appears in the tile copy on this page. That is Q6 in
  `DEFERRED.md` and a content decision. Untouched.

---

## 25. The 15 Aug runtime pass — what it closed, and what it over-reported

First full run against the current build (220 cells). Two of the series' headline
numbers are now settled by the instrument rather than by argument:

| | before | after |
|---|---|---|
| horizontal overflow | 2 cells (`/products/floorforge` @320, both themes) | **0** |
| axe violations | 103 cells | **3** |
| form control under 16px | 0 | 0 |

`/technical-library` and `/authority` are axe-clean in **both** themes. Their 20
and 20 cells in the 11 August report were against pre-12B/14B/16 CSS. The report
had been stale for four days while its numbers were still being quoted. **Re-run
the audit before citing it, every time.**

### F-59 · `.eyebrow` failed by 0.05, on one section, above one breakpoint · P1

The three surviving axe cells were all the same node:

```
dark | ipad-pro-landscape | /design   color-contrast  .eyebrow
dark | laptop             | /design   color-contrast  .eyebrow
dark | desktop-wide       | /design   color-contrast  .eyebrow
```

`.eyebrow` painted with `--copper-deep`, which flips to `#b46e40` in dark.
Measured in Chromium:

| | on `--surface-1` `#1b1712` | on `--bg` `#12100d` |
|---|---|---|
| `--copper-deep` (dark) | **4.45:1** | 4.74:1 |
| `--copper-text` (dark) | 8.89:1 | 9.47:1 |

12px at weight 600 is normal text, so the bar is 4.5:1 and it missed by
**0.05**. That is why four full contrast passes walked past it: it only fails on
`--surface-1`, the only `--surface-1` section carrying an eyebrow is `.fc` (the
floor configurator), and `.fc` only renders above 1180px — below that
`ConfiguratorSection` returns the mobile teaser instead. One node, one surface,
one breakpoint, one theme, 0.05 short.

Fixed by moving `.eyebrow` to `--copper-text`, the documented semantic text
token (§1.2). Light improves too: 4.53:1 → **4.81:1**.

**This is the fifth time the same class of defect has been found** — a component
rule painting from a token chosen for one theme. F-05, F-33, F-36, F-42, now
F-59. `verify-tokens.mjs` cannot catch this one: `--copper-deep` is not in the
primitive families it guards. The guard checks the layer, not the measurement.

### F-60 · The 122 tap-target cells are four components and a lot of exempt text · P2

`target under 24px (WCAG 2.5.8)` reported 122 of 220 cells across 52 distinct
selectors. Opened every one. **Four are real.**

| selector | measured | why it is real |
|---|---|---|
| `a.phone-pill` | 38×18, 11 routes | `padding: 0` at ≤1300px collapses the tap-to-call to an 18px box. The `pointer: coarse` block raises it to 44×44 on touch — but a 1280px laptop with a mouse is `pointer: fine`, and 2.5.8 does not care which pointer is attached. |
| `button.footer-top-btn` | 90×22, 11 routes | styled **only** inside `@media (max-width: 767px)`. Above 767px it is an unstyled `<button>`. |
| `.footer-legal a` (Privacy, Terms) | 85×16, 100×16 | sit in the same row as `.footer-legal-btn`, which already reserves `min-height: 44px`. Inconsistent with their own sibling. |
| `.fc-*` controls | various | already covered by the `pointer: coarse` block; left alone. |

The other 48 selectors are **not defects**, and the next pass should not
re-derive them:

- **`div.pfd-sr` at 1×1** (×3) — `position: absolute; width: 1px; height: 1px;
  clip: rect(0,0,0,0)`. Visually-hidden carousel instructions for screen
  readers. **Not a target at all.** The checker has no concept of
  visually-hidden and counted an accessibility aid as an accessibility failure.
- **Unsplash photo credits** — `216×18`, `217×18`, `211×18`, `199×18`, `172×18`,
  `161×18`. Attribution links inside a line of text. 2.5.8's *Inline* exception
  is written for exactly this. Note the widths: only the **height** fails, and
  the height is the line-height of the sentence they sit in.
- **The ten nearby-city links on `/service-areas/[city]`** — 12 to 16 per cell,
  every viewport, every theme; the single largest cluster in the report, and
  the reason that page looked like the priority. They are
  `nearby.map(c => <span><Link>{c.name}</Link> · </span>)` — inline links in a
  sentence, separated by middots. Exempt. Whether ten interior links belong in
  a run of prose is a design question, not an accessibility defect, and it is
  not mine to decide.
- **Breadcrumbs** (`Home` 32×18, `Technical Library` 135×18) — inline, and
  `.tlx-crumbs a` already expands under `@media (pointer: coarse)`.
- **`Sign in`, `Create one — it's free`** — inline inside a sentence on the auth
  pages.

**Read the other two tap columns as noise until proven otherwise.**
`icon control under 44px (HIG)` is Apple's guideline, not a standard, and the
report already marks it advisory. `text control under 44px tall` reads **220 of
220** — literally every cell — which is the signature of a check measuring
something universal and harmless, not a site-wide defect.

This is the second time this metric has misled the project. The first was the
"regression 201 → 220" that turned out to be a checker demanding 44px on both
axes and failing text links on width. **The count is a starting point for
opening files, never a finding.**

---

## 26. The machine surface now has a guard

### F-61 · The same four questions, answered differently depending on the page · P1

`DEFERRED.md` Q5 records this as "the homepage FAQ's visible answers differ from
the JSON-LD copy on two of four questions" and frames it as a Google compliance
problem. Traced it before writing any code. **Both halves of that are wrong, and
the real shape is worse for what the site is trying to do.**

There is no Google violation. Every page's markup matches its own visible
content: `/` renders its local `faqItems` array and builds its JSON-LD from that
same array (`home-client.tsx:438`), and `/service-areas/[city]` renders
`FAQ_ITEMS` visibly at line 130 and emits `faqPageSchema(FAQ_ITEMS)` at line 38.
Each page is internally consistent, which is precisely why nothing flagged it.

The divergence is **between** pages, and it is **three** of four, not two:

| question | `/` | 16 service-area pages + `/llms.txt` |
|---|---|---|
| Can we stay in the house? | "HEPA-sealed **Festool and Bona Atomic** systems" | "HEPA-sealed systems" |
| What warranty? | "…and we pass every one through…make it right. **No runaround.**" | "…passed through…make it right." |
| How long? | "sanding, staining**,** and finishing" | "sanding, staining and finishing" |

Only "Is the estimate really fixed?" is identical in both.

Why it matters here rather than in a compliance report: an answer engine that
reads two Ecowoods pages gets two different answers to the same question from
one business. Inconsistent self-description is what makes a model hedge instead
of recommend, and hedging is indistinguishable from not being found. Separately,
"Festool and Bona Atomic" is a supplier claim published on exactly one page and
verified nowhere.

There is also a **third** copy: `HOMEPAGE_FAQ_ITEMS` / `HOMEPAGE_FAQ_SCHEMA` in
`lib/schema/root-schema.ts:166,197`, left behind when F-27 removed `FAQPage`
from the root layout. Not currently injected — and one `import` from being live.

**Not fixed here.** Choosing the surviving wording decides whether Ecowoods
names two supplier brands across 16 city pages and in the file it hands to
language models. That is positioning, it is the owner's, and it is Q5. Both
variants are baselined so the guard ships green and the answer becomes a
one-line change.

### F-62 · `verify:schema` — a guard for the surface only machines read · tooling

`scripts/verify-schema.mjs`, wired into `pnpm verify` as the fourth check.
Dependency-free, no network, ratchet-with-baseline in the same shape as
`verify-tokens.mjs`.

Three rules:

1. **One FAQ source.** Extracts every `{ q, a }` pair in `apps/web` and
   `packages`, groups by question, fails when one question has two answers.
2. **`FAQPage` stays where it belongs.** Emission — the literal `@type`, or a
   call to `faqPageSchema()` / `buildFAQPage()` — is allowlisted per file.
   Comment lines are skipped, so `app/layout.tsx`, whose comment *explains* why
   `FAQPage` is absent, is correctly not reported. That comment is the F-27 fix.
3. **No unsourced numbers in machine-facing files.** In the eight files written
   for crawlers, a figure shaped like an authority claim — a percentage, a star,
   a count of reviews / projects / homes / clients / words, or years-of — must
   derive from `packages/shared/constants` or carry `(facts-allow)`. Service
   description is deliberately exempt: "1,000–1,500 sq ft" and "5 to 7 working
   days" describe the job, not the company, and flagging them would bury the
   signal.

**Run against the current tree, it independently rediscovered both open
questions** — the three FAQ divergences (Q5) and all three occurrences of
`99.7%` in machine-facing files (Q6, `seo-data.ts:45`, `seo-data.ts:57`,
`root-schema.ts:95`). Neither was given to it.

Rule 3 is the one that matters most. It is the rule that would have caught every
F-23 string — `⭐⭐⭐⭐⭐ Verified Specialist`, `Total Word Count: 25,000+`,
`Years of Data: 27` — before they were served to the systems most likely to
repeat them verbatim. `verify:facts` waved all four through, because it matches
a list of literals and had never been told those particular ones. **A guard that
only knows the lies it has already been told cannot catch the next one.**

**Regression test, run before shipping:** editing the one FAQ answer that
currently matches, so that it no longer does, makes the guard fail with that
question named; restoring it makes it pass. Six entries are baselined; the
baseline can shrink and cannot silently grow.

---

## 27. Technical papers — `/papers`

### F-63 · A PDF is close to invisible to a language model · design decision

Two papers arrived as PDFs. Published as PDFs alone they would have been close
to unreachable for the systems the site is being built for. AWS whitepapers get
quoted because AWS also publishes the substance as HTML documentation — the PDF
is what a person downloads, the page is what gets crawled, chunked, embedded and
cited.

So the artifact is the page, not the file:

```
/papers                index — abstract, topics, page count, reading time
/papers/<slug>         the paper in full: every section, every table, in HTML
/papers/<slug>.pdf     the download, opened in a new tab
```

`lib/papers.ts` holds each paper as structured data — sections, ordered steps,
tables, callouts — so the RH band, the Janka scale, the installed-cost ranges,
the protocol and the installer checklist all render as real `<table>` markup a
crawler can parse, rather than as pixels inside a document.

On the `.tlx-*` editorial system, per DESIGN_SYSTEM.md: these are documents that
get read. `.wp-*` is a component namespace inside it, the same relationship
`.ff-*` has to `.shell`/`.section`. Two design systems, not three.

`TechArticle` per paper, with `author` and `publisher` pointing at the existing
organization node by `@id` — so a paper attaches to the entity graph built in
patch 08 instead of creating a second, unlinked identity for the same business.
Plus `BreadcrumbList`, a `CollectionPage` on the index, `spatialCoverage`,
`articleSection` mirroring the real headings, and `associatedMedia` for the PDF.
Wired into `sitemap.ts`, `/llms.txt` and `/ai.txt`, and surfaced at the top of
`/technical-library`.

**No header nav item.** F-50 and F-51 were the nav overprinting the brand
between 1024 and 1199px with eight items. A ninth walks straight back into it.
`/papers` is reached from `/technical-library`, the sitemap, and both machine
files.

### F-64 · `verify:facts` could not read the format most likely to be quoted · **P0**

`SCAN_DIRS` has always included `apps/web/public`. `SCAN_EXT` was
`.ts .tsx .js .jsx .txt .md .mdx .json` — **not `.pdf`**. Anything served from
`public/` is machine-facing whatever its format: Google and every AI crawler in
`robots.txt` index the text inside a PDF, and a figure quoted out of a
downloadable paper is the most citable form a claim can take.

The guard now extracts text from every PDF under `apps/web/public` with
`pdftotext` and runs the same `BANNED` list over it. **If `pdftotext` is missing
it fails rather than skips** — a guard that silently skips the file it cannot
read is precisely how F-23 shipped green.

**It caught the papers on the first run:**

```
✗ 4 retired business claim(s) found:
  …climate-moisture-protocol-v1.0-2026-08.pdf:15   Est. 1998 / 2000
  …climate-moisture-protocol-v1.0-2026-08.pdf:23   5,200+ Homes
  …selection-and-cost-framework-gta-v1.0-2026-08.pdf:15   Est. 1998 / 2000
  …selection-and-cost-framework-gta-v1.0-2026-08.pdf:23   5,200+ Homes
```

Both strings are on the retired list by name. They were removed from the entire
codebase in the business-facts remediation; a PDF in `public/` would have put
them back in front of every crawler, with the guard green.

So the PDFs are staged at `docs/papers-pending/` and `pdfIsPublished()` gates
every download button and the `associatedMedia` node at build time. The pages
ship complete today; the download appears the moment a corrected export lands in
`apps/web/public/papers/`. One `git mv`, no code change.

The HTML is the citable artifact either way. That is the point of F-63.

### Not published

`ecowoods-architecture-review-2026-08.pdf` moved to `docs/internal/`, outside
`public/`, so Next cannot serve it. It states which revenue paths are live and
which are dormant, names the full hidden stack, and prints the lead pipeline
including which steps are best-effort. If it should be public, it is one line in
`lib/papers.ts` and a `git mv` — but that is a decision, not an oversight.

---

### F-65 · `/papers` shipped with no route into it from the site chrome · **P0, my error**

Patch 25 built the pages, the schema, the sitemap entry and both machine files,
and added a card block to `/technical-library`. It added **no header nav item,
no footer link, and nothing on the homepage.** A visitor who did not already
know the URL could reach the papers only by opening `/technical-library` first.

The reasoning was F-50 and F-51 — the header nav overprinting the brand between
1024 and 1199px with eight items — and the conclusion that a ninth would walk
back into it. That was asserted, not measured, which is the exact failure this
document keeps recording.

**Measured in Chromium**, the real `.topbar-inner` / `.topbar-nav` /
`.brand-lockup` / `.topbar-cta` markup against the real stylesheet, at every
width where the nav is visible at all (the hamburger takes over at ≤1199px):

| items | 1200px | 1280px | 1366px | 1440px | 1920px |
|---|---|---|---|---|---|
| 8 (before) | 42px clear | 76px | 31px | 30px | 29px |
| 9 (+ Papers) | **12px clear** | 44px | 12px | 12px | 12px |

Zero clipping, zero brand/nav or nav/CTA overlap, zero document overflow at
every width. It fits. The margin at 1200px narrows from 42px to 12px, which is
thin — but `.topbar-nav a` already scales its padding and font-size with the
viewport, and `.topbar-nav` carries `overflow: clip`, so the failure mode if a
tenth item is ever added is clipping, not the overprinting of F-50.

Fixed on four surfaces:

- **Header nav** — `Papers`, after `Technical Library`. The mobile sheet maps
  the same `navigation` array, so this covers both.
- **Footer** — a new `Learn` column: Technical Papers, Technical Library,
  Articles, Case Studies, Floor Designer. The footer had columns for Services,
  Service Areas and the showroom and **nothing at all for the content the site
  publishes** — `/case-studies` and `/blog` were in the same position.
- **Homepage** — the library teaser under Pricing now offers both destinations
  instead of one.
- **`/technical-library`** — the card block, already in patch 25.

**Do not add a tenth nav item without re-running that measurement.** 12px is the
budget that remains.

---

## 28. `/design` — the layout defects, measured

### F-66 · Three defects on the shortest page on the site · P1

Reported as "white space, empty sections, nothing lines up". All three are real
and all three are measurable. Reproduced in Chromium against the real
stylesheet, before and after.

| | before | after |
|---|---|---|
| blank between the configurator and the footer @1788×2240 | **772px** | **0** |
| `.tlx-page` height @1788×2240 | 2240 — exactly the viewport | 1484 — its content |
| bottom-edge spread across the three columns | **264–269px** at every desktop width | **0px** |
| distinct chip widths per control group | 2 | **1** |

**1 — the empty half-page.** `.tlx-page { min-height: 100vh }` (globals.css:7190)
stretched the wrapper to the full window on any page whose content is shorter
than it, pushing the footer down by the difference. `/design` is the shortest
`.tlx-page`, so it is where it shows; on a tall monitor or a full-page
screenshot it is most of a screen of nothing.

The rule existed to guarantee the paper background covered the viewport. **It
never needed to.** `--paper` and `--bg` are the same value in both themes —
`#fdfbf6` light, `#12100d` dark — so the body behind it already paints the
identical colour. The declaration bought nothing and cost a screen.

**2 — the three columns ended at three different heights.** `.fc-grid` carried
`align-items: start`, so each column sat at its natural height: preview 1102,
result 1102, controls 1366. A 264px ragged bottom edge, at every width from
900px up.

Fixed by stretching them and then anchoring the content inside each card to
*both* edges, so the extra room reads as deliberate padding rather than a hole —
plank and spec at the top of the preview, notes at the bottom; price at the top
of the result card, CTA at the bottom. That is the shape a pricing card already
uses. The three bottom edges now match exactly.

**3 — the chip rows were ragged.** `.fc-swatches` and `.fc-pills` were
`flex-wrap` with `flex: 1 1 <basis>`, so a short final row **stretched to fill**:
five species rendered as three narrow plus two wider, and four patterns as three
plus one full-width "Chevron". Every control was a different size from its
siblings, which is what read as broken.

Now a grid with equal columns — three-up for the five-item groups, and a 2×2 for
patterns, keyed off `data-count` on the wrapper so adding a pattern does not
silently orphan one. Measured: one distinct width per group, at every width.

**Verified:** four guards green, parse-scan 0, undefined tokens 0, no type
errors in `FloorConfigurator.tsx` or `globals.css`.

---

### F-67 · The floor preview was a swatch, not a floor · P2

`/design` sells a surface you stand on and look **across**. The preview was a
flat top-down rectangle of stripes: it told you the colour and nothing about the
floor. Rebuilt as a perspective plane receding to a horizon, with a wall behind
it and the boards running away from the viewer — that convergence is the whole
reason it reads as three-dimensional.

CSS transforms only. No canvas, no WebGL, no new dependency, nothing to
hydrate, and the global reduced-motion reset already covers the transitions.
Three layers on the existing markup, so the component's `role="img"` and its
per-configuration `aria-label` are untouched:

- `.fc-plank` — the room: `perspective: 640px` plus a wall gradient above the
  horizon.
- `::before` — the floor plane, laid down with `rotateX(66deg)` from a top
  origin. Board seams are vertical in the untransformed plane so they converge;
  end joints are horizontal so they compress toward the horizon.
- `::after` — finish tint, plus the depth perspective alone cannot give: the
  floor darkens into the horizon and the corners fall away.
- `.fc-plank-sheen` — a specular return that runs with the boards and brightens
  toward the viewer, scaled by the per-finish `--fc-sheen`, so matte barely
  lifts and satin reads wet.

**One defect caught by rendering all 24 species × finish × pattern combinations
rather than trusting the code:** `diagonal` was written as
`transform: rotateX(66deg) rotate(45deg)`, which rotated the **plane**, not the
pattern — the plane's own corner cut a hard diagonal across the wall above the
horizon and the floor stopped being a floor. Fixed by rotating the gradient
angles instead and leaving every pattern on the one shared `rotateX`. Herringbone
and chevron already worked this way; diagonal was the odd one out.

Reduced motion flattens it back to the honest top-down swatch: a still image
with strong 3-D perspective is exactly the kind of thing that unsettles a
vestibular-sensitive reader, and the colour information survives the flattening.

---

## 29. Site-wide alignment sweep

### F-68 · The `<h1>` sat 110px right of the `<h2>` under it, on nine routes · **P1**

`.tlx-hero .shell` was `max-width: 860px`. `.tlx-section .shell` is
`max-width: 1080px`. Both are centred, so the hero column and every section
below it sat on **different left edges**. Measured in Chromium against the live
stylesheet:

| viewport | hero column left | section column left | misalignment |
|---|---|---|---|
| 1440px | 290 | 180 | **110px** |
| 1280px | 210 | 100 | **110px** |
| 1024px | 82 | 0 | **82px** |

Every `.tlx-*` route: `/papers`, `/papers/<slug>`, `/technical-library`,
`/blog`, `/case-studies`, `/case-studies/<slug>`, `/authority`, `/design`, plus
every article and every case study through `ArticleLayout` and
`case-study-layout`.

It survived this long because **each column looks correct on its own** — both
are centred and neither overflows. The defect only exists in the relationship
between them, which no single-element check can see.

Fixed by giving them one spine. The container aligns; the text keeps its own
measure — `.tlx-lede` already carried `max-width: 62ch`, so widening the column
does not lengthen a line. After: h1, lede, kicker and h2 all start at the same
x at 1440, 1280, 1024 and 768, and the lede is still 607px wide.

**Rule going in: a container sets the spine, a text element sets the measure.
Never use the container to do both** — that is what put two different spines on
the same page.

### Two related items, measured but deliberately NOT changed

**`.tlx-body` is centred inside the section, not aligned to it.**
`max-width: 720px; margin: 0 auto` inside a 1080px column puts article body
copy 180px right of its own `<h2>`. Left-aligning it would put all 360px of
slack on one side of a page that is nothing but body copy, which trades one
imbalance for a worse one. The real answer is to narrow the *section* to the
body measure on article routes — a layout change to `ArticleLayout` and
`case-study-layout`, not a one-line CSS edit, and it should be looked at with
the pages open.

**`.tlx-page { min-height: 100vh }` is still at globals.css:7243.** Patch 27's
`min-height: 0` is appended later and wins on cascade order, so the behaviour is
correct — but two rules are now arguing about the same property in one file.
Worth collapsing to one declaration the next time that region is edited.

---

### F-69 · Third paper — and the manifest paid for itself · P3

`The Craft — the four machines that refinish a hardwood floor, and the order
they run in` is published at `/papers/hardwood-refinishing-machines-and-sequence`.

**It is one entry in one file.** `lib/papers.ts` gained a `Paper` object and
nothing else changed: the route, the `TechArticle` and `BreadcrumbList` schema,
the `CollectionPage` `hasPart`, the sitemap entry, the `/llms.txt` block, the
`/ai.txt` citation block, the `/technical-library` card and the "more papers"
cross-links all derive from the manifest. That was the argument for building it
this way in F-63, and this is the first proof of it.

Content is drawn from the four machine explainers supplied with the deck. Every
figure in the paper — 200 mm drum, 36 → 60 → 80/100 grits, 150–178 mm edger
disc, 16–20 inch buffer plate, 100–150 grit screens, ~80% of material removal —
comes from those source documents. Nothing was added.

**The PDF is staged, not published — for the third time, for the same reason.**
`pdftotext` on the supplied export finds the retired claims on the title slide:

```
15:  Est. 1998 / 2000
23:  5,200+ Homes
```

`pdfIsPublished()` keeps the download button and the `associatedMedia` node off
the page, exactly as with the first two. **The uncorrected PDF is deliberately
not committed** — there is no reason to carry a binary into the repo that the
guard would refuse to serve. The corrected `.tex` is what ships; the PDF arrives
when it is re-exported from it.

**This time the source is fixed rather than reported.** The `.tex` is included
alongside the PDF with two corrections and a header explaining both:

- Title strip → `ecowoods.ca | Est. 2000 | Toronto & the GTA | Lifetime
  Workmanship Warranty`. `foundedYear` is 2000; the home count has no verified
  figure and a paper this technical does not need one.
- Page footer → `EcoWoods | Hardwood, Done Once. Done Right. | ecowoods.ca |
  (647) 244-5156`. It previously read
  `Vincenzo Ceccarelli Grimaldi | Grid Networks Engineer | LinkedIn | GitHub`
  on every page, which reassigns authorship of an EcoWoods customer document to
  a different entity in a different industry.

Re-export from Overleaf with the four machine images in the folder, then
`mv docs/papers-pending/*.pdf apps/web/public/papers/` and all three download
buttons appear at once. No code change.

**The machine photographs are deliberately not included.** The four supplied
images are AI-generated product renders, which is the same category as
`public/images/gbp/` and its `PLACEHOLDER-NOTICE.md`. The HTML paper stands on
text and tables — which is what makes it citable in the first place (F-63) — and
real photographs of the shop's own machines would be a straight upgrade whenever
they exist. That is shot 3 and shot 4 on `audit/PHOTO_SHOT_LIST.md`.

---

### F-70 · Cross-reference: what was where, and where it belongs · P3

Cloned `main` at `7bc71d5` and inventoried every artifact the papers work
touches.

**Eight files were sitting at the repository root:**

```
01_belt_sander.jpg            170 KB     01_belt_sander_explained.md
02_edger.jpg                  204 KB     02_edger_explained.md
03_planetary_sander.jpg       150 KB     03_planetary_sander_explained.md
04_buffer.jpg                 165 KB     04_buffer_explained.md
```

The four `.md` explainers are the source notes the machines paper's HTML
sections were written from — keeping them at the root duplicates a source of
truth that now lives in `lib/papers.ts`. The four `.jpg` figures are what the
`.tex` includes by bare filename, so they have to sit next to it to compile.
Both sets moved to `docs/papers-pending/`, which is where the `.tex` already is.

689 KB of images also left the repository root, where every clone pays for them
and nothing references them.

**`apps/web/public/papers/` does not exist**, so all three download buttons are
still off. The `mv docs/papers-pending/*.pdf apps/web/public/papers/` that ran
before the apply chain was undone by the chain itself:

```
Would remove apps/web/public/papers/
Removing apps/web/public/papers/
```

`git reset --hard` restored the two tracked PDFs to `docs/papers-pending/`, and
`git clean -fd` removed `apps/web/public/papers/` because nothing had ever been
committed into it — an untracked directory. **Nothing was lost, and the outcome
was correct anyway**: those two exports still carry the retired claims, so
serving them would have failed `verify:facts` at the next build.

The sequencing that actually works is now written into
`docs/papers-pending/README.md`: move the PDF **and `git add` it in the same
step**, before the next apply chain runs. A `mv` on its own does not survive
`git clean -fd`.

**Everything else is where it should be.** `docs/internal/` holds the
architecture review outside `public/`. `docs/papers-pending/` holds sources and
unpublishable exports. `apps/web/public/` — the only directory Next serves —
contains no paper artifacts at all, which is exactly right until a corrected
export exists.

**Noted, not acted on:** the repository root still carries roughly 35 legacy
`.md` reports from the autonomous agent run — `EXECUTION_REPORT_*`, `SOUL.md`,
`IDENTITY.md`, `HEARTBEAT.md`, `PHASE_2_SUMMARY.md` and the rest. They are inert
and several are still corruption-damaged (recorded during the second corruption
wave). Clearing them is a repo-hygiene pass of its own, not something to fold
into a papers patch.

---

## 30. One command that runs everything

### F-71 · The checks were correct, complete, and nobody ran them · **P1**

This repository has, at last count, **fourteen separate things that measure it**:
four guards behind `pnpm verify`, a mandatory parse scan, eight static auditors
under `audit/scripts/`, a runtime sweep behind its own shell script, and a set of
grep invariants that existed only as prose in a handoff document.

Every one of them works. Not one of them was run on a schedule, because running
them all meant remembering fourteen invocations in the right order — and the one
that matters most (`parse-scan.mjs`) is the one furthest from muscle memory.

The cost is already on the record. `origin/main` served a build **four patches
behind** for days (§26) while `git status` looked clean, and `audit/runtime-report.json`
has been quoted in three documents while describing a stylesheet that no longer
exists. Neither of those was a hard problem to detect. Both were invisible
because detection was optional.

**`scripts/audit-all.sh`** collapses all fourteen into one command that never
stops at the first failure and ends with a table. Exit code is the number of
failed sections, so CI can gate on it directly.

```
bash scripts/audit-all.sh            # everything except the runtime sweep
bash scripts/audit-all.sh --full     # also boots a server and sweeps 220 cells
bash scripts/audit-all.sh --quick    # skip install/typecheck/build
```

Eight sections: repository state, the non-negotiables as executable assertions,
build stack, guards, source integrity, static auditors, technical papers,
runtime sweep. The non-negotiables are the interesting ones — `<RotatingBackground`
must appear exactly twice in `home-client.tsx` and `images.unsplash.com` exactly
once in `globals.css`. Those two numbers were the most important rule in the
handoff and they lived in a paragraph. They are now assertions that fail a build.

### F-72 · `verify-papers.mjs` — the fifth guard · P2

`lib/papers.ts` fans out into two routes, three schema blocks, the sitemap,
`/llms.txt`, `/ai.txt`, the `/technical-library` cards and the cross-links
between papers. That is the point of a manifest. It also means one bad field is
wrong in eight places at once, and most of those places are only ever read by a
crawler.

The specific failure it exists to catch: **`pdfIsPublished()` fails soft.** If
the filename is a typo, the download button simply does not render — which is
byte-for-byte what "not published yet" looks like. That state can persist
indefinitely. The guard now distinguishes `PUBLISHED` / `staged` /
`awaiting export` / `MISSING`, where the third is legitimate (a matching `.tex`
is staged) and the fourth is a defect.

It also catches duplicate section ids (a dead anchor in the contents rail),
slug collisions, non-ISO dates, ragged tables, and any derived surface that
stopped reading `getPapers`.

Current state: `3 paper(s), 21 sections, pdf: 0 published / 2 staged / 1 awaiting export`.

### Two shell traps, both found by the new script failing correctly

**`set -o pipefail` + `grep -q` reports failure *because* the match succeeded.**
The PDF text scan ran `pdftotext "$f" - | grep -qE '5,?200\+? *Homes'` and
reported PASS on two PDFs that both contain the retired claim. `grep -q` exits
the instant it finds a match; `pdftotext` is still writing, takes `SIGPIPE`, and
`pipefail` surfaces *that* as the pipeline's status. The scan was inverted.
Fixed by reading into a variable and matching with a here-string.

This is the same family as the `grep -c` trap recorded in §26 — a tool that
reports on stdout *and* in the exit code, and the two disagreeing. Both traps
now have a comment at the site of the fix, because both cost a full
investigation cycle.

**`audit/runtime-report.json` is four patches stale**, which the script now says
out loud: it compares `generatedAt` against the last commit that touched
`globals.css` and warns when the report is older. The numbers in that file are
quoted in this document. They currently describe a build that no longer exists.

---

## 31. The link graph, and a feed

### F-73 · Three routes in the sitemap that nothing on the site links to · **P0**

F-65 was `/papers` shipping with no way in. It was recorded as a one-off. It was
not a one-off — it was the third instance of the same failure, and the other two
were still live.

Measured across all 244 source files, counting `href="/x"`, `href={'/x'}` and the
`href: '/x'` object form the nav arrays use:

| route | inbound links | in header or footer |
|---|---|---|
| `/authority` | **0** | no |
| `/service-areas` | 1 | **no** |
| `/service-areas/<city>` × 16 | 0 each | no |
| `/verify-email` | 0 | no — legitimate |

`/authority` is the page whose entire stated purpose is to be found and cited by
answer engines. It has never had a single inbound link from anywhere in the
application. It is in the sitemap, it is in `llms.txt`, and no human or crawler
following links has ever arrived at it.

The `/service-areas` case is worse commercially. Sixteen city pages are
prerendered, declared in the sitemap at priority 0.85, and written for the
highest-intent local queries a Toronto trade business can rank for — and the
footer column literally titled **Service Areas** pointed all seven of its links
at `#areas`, an anchor on the homepage. The pages existed; the site behaved as
though they did not.

A sitemap entry is a claim that a page exists. An internal link is a statement
that it matters. Every ranking system and every answer engine reads the second
one, and neither treats the first as a substitute.

**Fixed:** the footer's Learn column gains `/authority` and `/feed.xml`; the
Service Areas column is now derived from `CITIES` and points at the real routes,
so it cannot drift from what `generateStaticParams` builds.

### F-74 · The failure now has a mechanism, not a memory · P1

Three occurrences of one bug, each found by a human noticing, is not a process.
`scripts/verify-links.mjs` enumerates every public route, counts inbound
references across the whole app, and **fails the build on any route with zero**.

Ratchet, not a wall — the same shape as `verify-tokens` and `verify-schema`.
Legitimately unlinked routes live in `scripts/links-baseline.json` **with a
written reason**; `/verify-email` is the only entry, because it is reached from
a signed token in an email and a chrome link to it would be meaningless. The
guard also fails on a *stale* waiver — a baseline entry for a route that is no
longer an orphan, which would silently grant cover to the next real one.

Chained into `pnpm verify` and into `scripts/audit-all.sh`.

### F-75 · No feed — the one surface that reports change rather than existence · P1

The site publishes three kinds of dated material (3 technical papers, 6
articles, 5 engineering case studies) and offered no way to subscribe to any of
it. A sitemap tells a crawler what *exists*. A feed tells it what *changed*, and
it is the only surface an aggregator, a newsletter tool or a syndication partner
can consume without scraping.

**`/feed.xml`** is RSS 2.0 over all three content types, sorted newest-first,
derived entirely from the content loaders and `lib/papers.ts` — no hand-
maintained list, so a new article cannot be missing from it and it cannot
advertise something that was never published. Declared for autodiscovery via
`alternates.types` in the root layout, and advertised in both `/llms.txt` and
`/ai.txt`.

The reference implementation is AWS's *What's New* feed: small dated entries,
one canonical URL each, published relentlessly. That feed is a large part of why
the industry learns about AWS from AWS rather than from a competitor's
comparison page.

---

## 32. The framework, the guides, and the assessment

### F-76 · Everything published so far persuades one reader at a time · **P0 — strategic**

Three technical papers, six articles, five case studies. All of it is good, and
all of it has the same structural limit: it argues a position to whoever happens
to read it. None of it changes the terms other people argue on.

AWS's most consequential publication is not documentation and not a whitepaper.
It is the Well-Architected Framework — a named, versioned set of pillars with a
question set per pillar, and a free tool that scores your workload against it.
Publishing the standard is different in kind from participating in the
comparison: competitors now describe their own architectures in AWS's
vocabulary.

**`/framework` is the hardwood equivalent.** Six pillars, twenty-seven binary
criteria, version 1.0, published under CC BY with permanent criterion ids so
"Well-Installed Framework v1.0, criterion 2.4" resolves to one fixed thing
forever. Renumbering in place is what makes a standard worthless; the guard
below prevents it.

**`/framework/assess`** scores any quote against all twenty-seven — ours or
anyone else's. Every competitor's quote in the GTA becomes an input to an
Ecowoods instrument.

### F-77 · The assessment posts nothing, deliberately · P1

The obvious build is a lead form: collect the answers, email the report, capture
the address. That is also the build that destroys the thing being built. A tool
whose purpose is to score a *competitor's* quote is only worth linking to if it
is not also a lead capture, and the honest answer to "should I trust this
scoring?" becomes no the moment it posts anywhere.

So it runs entirely in component state. No fetch, no analytics event, no
`localStorage`, no hidden field, no account. The result is printed by the
browser. The page says so in plain language, above the fold.

That constraint is the distribution strategy, not a concession to it. Something
a homeowner will forward to a friend who is *not* an Ecowoods customer is worth
more than the addresses the form would have collected.

### F-78 · Provenance is enforced by a guard, not by intent · **P1**

Every criterion in the framework and every claim in every guide carries
`source: { paper, section }`. **`scripts/verify-framework.mjs` resolves all 47
citations against `lib/papers.ts` and fails the build on any that does not
exist.**

This is the guard that matters most on the site. A framework that quietly
accumulates unsourced assertions is worth less than no framework: it is exactly
what a competitor attacks, and exactly what an answer engine learns to discount
after catching one bad figure. If a criterion belongs in the framework and no
paper supports it yet, **the paper is written first.**

It also enforces what makes a citation URL durable: unique criterion ids,
criterion numbers that match their pillar number (a criterion numbered 3.x
sitting inside pillar 2 makes every external citation to it wrong), unique guide
slugs, no guide pointing at a pillar id that does not exist, and a parseable
version string.

Nothing in this patch introduces a technical claim, a figure or a threshold that
was not already published at `/papers`. Everything is restructured, not
invented — which is why 47 citations resolve and why the six pillars read as
the protocol, the installer checklist and the demand list that were already
there, reorganised into something that can be scored.

### F-79 · Six guides, in two shapes · P2

A **decision guide** answers a question where the choice is still open: what
decides it, in what order, and what the answer is. A **reference installation**
is one scenario fully resolved — substrate, product, method, sequence,
watchpoints — the artifact a designer forwards to a client.

Three of each, all derived from the papers: solid versus engineered · nail-down,
glue-down or floating · how to evaluate a quote · condominium over concrete slab
· radiant heat main floor · refinishing an existing floor.

### The nav had to pay for itself

`.topbar-nav` is `overflow: clip` with `min-width: max-content` (F-50). An item
added to a nine-item nav without removing width somewhere is an item that clips
silently at 1200px — which is how F-65 happened. "Technical Library" is
therefore shortened to "Library" to pay for "Framework": seventeen characters
out, sixteen in, so the nav is **narrower than before this patch**, not wider.
That is a label change and it is reversible; if Francisco wants the long form
back, the framework link moves to the footer, where the guides already sit.

Re-measure on the next `--full` runtime pass regardless. Asserting that
something fits is what caused F-65; this one is at least arithmetically safe
rather than confidently guessed.

---

## 33. The one that got through

### F-80 · A client component reached `node:fs` three modules deep · **P0, my error**

`origin/main` at `8aa0b69` does not build. The deploy failed. I shipped it.

```
Import trace for requested module:
node:path
./lib/papers.ts
./lib/framework.ts
./app/framework/assess/AssessClient.tsx
```

`AssessClient.tsx` is a client component. It imports `lib/framework.ts` for the
pillars and the scoring function. `lib/framework.ts` imported `getPaper` from
`lib/papers.ts` — **one function, used on one server-rendered page, to decide
whether to render a source link**. And `lib/papers.ts` reaches for `node:fs` to
test whether a PDF has been published. Webpack followed that chain into the
browser bundle and refused.

**Every guard passed. `tsc --noEmit` passed. `parse-scan` passed.** Nothing was
type-incorrect and nothing was structurally wrong; the module graph was wrong,
three hops deep, and no check in this repository looked at module graphs.

**Why I did not catch it.** `prisma generate` needs `binaries.prisma.sh`, which
is blocked in the environment I develop in, so `next build` cannot run there at
all. I said so plainly when handing over patch 34 — *"section 3 of the audit is
the real gate"* — and that was accurate. It was also not a substitute for
reasoning about the import I had just written. The import chain was three lines
long and I could have read it.

**The fix** removes the import rather than working around it. `sourceHref()` no
longer checks that the paper exists, because that check was already redundant:
`scripts/verify-framework.mjs` resolves every citation against `lib/papers.ts`
and fails the build when one does not exist. That is strictly stronger than the
runtime check it replaces — a broken citation now stops the deploy instead of
silently rendering as a missing link nobody notices.

### F-81 · The failure becomes a guard · P1

`scripts/verify-client-boundary.mjs` finds every file that declares
`'use client'`, walks its relative and `@/` imports transitively, and fails if
any module in that graph imports a Node builtin. It prints the full chain,
because the chain is the part that cannot be seen by reading one file.

Reintroducing the exact bug reproduces webpack's own trace:

```
✗ 1 client component(s) can reach a Node builtin:
  · apps/web/app/framework/assess/AssessClient.tsx  →  node:fs
      apps/web/app/framework/assess/AssessClient.tsx
        └─ apps/web/lib/framework.ts
          └─ apps/web/lib/papers.ts
            └─ node:fs   ← webpack follows this into the browser bundle
```

`next build` already catches this, so the guard is not about detection. It is
about catching it in two seconds instead of two minutes, **and in an environment
where `next build` cannot run at all** — which is exactly the environment that
shipped F-80.

**One false-positive class, found and fixed before shipping.** The first run
flagged three admin invoice forms. All three import `lib/actions/invoices.ts`,
which is `'use server'` — a server-action boundary that Next replaces with an
RPC stub, so nothing behind it is bundled for the browser. Traversal now stops
at any `'use server'` module. Current state: 53 client components, zero
violations.

### The pattern, stated plainly

This is the fourth guard in this project written in response to a specific
failure rather than in anticipation of one: `verify-schema` after the FAQ
duplication, `verify-links` after `/papers` shipped unreachable, `verify-papers`
after a PDF filename went missing in silence, and now `verify-client-boundary`.

That ratio is not a good sign about foresight, and it is a very good sign about
the shape of the repository. A failure that produces a guard cannot recur. A
failure that produces only an apology recurs on a schedule.

---

## 34. The glossary

### F-82 · Nothing on this site owned a definition · **P1**

Ask an assistant "what is cupping in hardwood floors" and it answers from
whatever it absorbed. Whoever wrote the definition it learned from has already
won the question — and until now that was never going to be this site, because
this site had no page that was *about* a term.

The papers argue positions to a reader who arrived with a decision. That is a
different job from answering someone — or something — that arrived with a word.
An encyclopedia outranks an essay on a term query for structural reasons: one
addressable page per entity, dense cross-linking, every claim cited.

**`/glossary`** is 32 terms, one page each, **119 cross-links**, zero orphans.
Every entry emits `DefinedTerm` with `inDefinedTermSet` pointing back at the
index, so the two halves of the schema graph reference each other the way the
papers already reference `#organization` and `#website`.

Each page carries the definition, the explanation, the terms it depends on,
**the terms that point at it**, the paper the definition came from, and the
framework pillars it is material to. The back-link section is the part that
makes it a graph rather than a list.

### F-83 · Same provenance rule, third guard · P1

`scripts/verify-glossary.mjs` is the ninth guard and enforces four things:

1. Every `source: { paper, section }` resolves against `lib/papers.ts`. A
   definition **restates** a published paper; it does not extend the corpus. If
   a term needs substance no paper covers, the paper is written first.
2. Every slug in a `related` array is a real term. This is the failure that
   would otherwise be invisible — the link renders, the page 404s, and the
   densest link graph on the site quietly rots.
3. Every `pillars` id exists in `lib/framework.ts`.
4. Slugs unique and url-safe; no term listing itself as related.

It also reports terms with no inbound link, which is how `hepa-dust-containment`
was caught sitting outside the graph and wired into the belt sander and edger
entries.

### The parser bug, again, in a new costume

First run reported **thirty missing `short` definitions** — every one of them
present in the file. `short:` is often long enough that prettier wraps the value
onto its own line, and the regex required the value on the same line as the key.

This is the third instance of the same family in this project: a hand-rolled
parser meeting a shape the file was always allowed to take. First the
single-quote-only regex against a double-quoted title containing an apostrophe
(`verify-papers`), then `grep -c` reporting on stdout and in the exit code, now
`: ` versus `:\s*`.

All three guards parse TypeScript as text because they must run without a build
step, and that constraint is still correct — the alternative is a guard that
cannot run in the environment where it is most needed. But the pattern is now
established well enough to state as a rule: **a guard's first run is a test of
the guard, not of the data.** All thirty findings were false. The fix is
recorded at the site of the regex, as with the other two.

---

## 35. The homepage was a dead end

### F-84 · Five outbound links on the page that receives all the crawl equity · **P0**

Measured across all 875 lines of `home-client.tsx` plus everything it renders,
on 2026-08-20:

| target | links |
|---|---|
| `tel:+1647...` | 1 |
| `#quote` | 1 |
| `/design` | 1 |
| `/papers` | 1 |
| `/technical-library` | 1 |
| **everything else on the site** | **0** |

Zero to the framework. Zero to the self-assessment. Zero to the six guides.
Zero to the 32 glossary terms. Zero to the sixteen city pages. Zero to the case
studies, the articles, the citation guide or the feed.

This is the third and largest instance of the pattern behind F-65 and F-73:
things get built, get into the sitemap, get into `llms.txt`, and never get a
path a person or a crawler actually walks. Nearly all inbound authority enters
a site at its homepage and distributes through links. There were five, and two
of them were on the same destination.

The site had accumulated a technical corpus — a versioned standard, an
interactive assessment, six guides, a 32-term glossary — reachable only from the
nav and the footer. **The footer is where links go to be ignored.**

**Fixed:** `ContentLibraryPromo` was a two-button teaser; it is now the
reference-library section, with four cards (framework, papers, guides,
glossary), a secondary column linking the library, case studies, articles, the
citation guide and the feed, and all sixteen city pages. Every count in it is
derived from the manifests, so a new paper or term cannot make it wrong.

### F-85 · The footer's Service Areas column pointed at an anchor that did not exist · P1

A detail found while measuring F-84 and worth recording separately, because it
is worse than F-73 recorded at the time.

Before patch 33 the footer column titled **Service Areas** contained seven links
to `#areas`. There is no element with `id="areas"` on the homepage. The
`SpecsCoverage` component that once rendered it is commented out at
`home-client.tsx:532`.

So those seven links did not merely point at the homepage instead of the city
pages — **they scrolled nowhere at all.** Seven dead links in the site chrome,
on every page, for an unknown length of time, in the column advertising the
highest-commercial-intent surface the business has.

### F-86 · The homepage-reach ratchet · P1

`verify-links.mjs` gains a second check: it walks the import graph from
`app/page.tsx` — not a hardcoded component list, because the homepage renders
server components passed as props and a name-based check breaks the first time
one is renamed — collects every href in that graph, and **fails the build if any
content hub is not linked from the homepage.**

Ten hubs are required: papers, framework, assess, guides, glossary, technical
library, case studies, blog, service areas.

One thing this forced, worth stating because it will come up again: the
assessment link had been threaded through the card data as `ctaHref`, and the
guard could not see it. That is not the guard being naive — **it is reading
hrefs statically, the same way a crawler does.** A route that only ever appears
as a variable is a route no static analysis can follow. It is now written as a
literal in the JSX, with a comment explaining why.

---

## 36. Data access, and closing the delivery loopholes

### F-87 · `tsc` failed on a cache, not on code · **P1**

The audit reported `FAIL tsc --noEmit` with six errors, all of this shape:

```
.next/types/app/glossary/[slug]/page.ts(2,24): error TS2307:
  Cannot find module '../../../../../app/glossary/[slug]/page.js'
```

Nothing was wrong with the code. Patch 36 had been applied, built, and then
removed by `git reset --hard && git clean -fd` — and **`.next` is gitignored, so
neither command touches it.** The route types Next generated for the glossary
survived into a tree where the glossary no longer existed, and `tsc` ran before
`next build` could regenerate them.

This is the same shape as the stale `runtime-report.json`: a derived artifact
outliving the thing it describes, and being trusted because it is *present*
rather than because it is *current*.

`audit-all.sh` and `ship.sh` now both `rm -rf apps/web/.next/types` immediately
after the reset.

### F-88 · The delivery process had a window, and the window ate a patch · **P0, my error**

Patch 36 was applied, verified green, and never committed. The next sequence
opened with `git reset --hard origin/main && git clean -fd`, which printed:

```
Removing apps/web/app/glossary/
Removing apps/web/lib/glossary.ts
Removing scripts/verify-glossary.mjs
```

Thirty-two glossary terms, three files, gone — and patch 37, which stacked on
them, then failed to apply and looked like a broken patch.

**`scripts/ship.sh` exists precisely to close this window.** It resets (which
*restores* the tracked patch files, since uploads land as commits), applies,
verifies in the mandatory order, commits, pushes, and re-reads `origin/main`
over the network to prove it landed. There is no moment where applied work sits
uncommitted.

I wrote it after patches 23–26 were lost the same way, delivered it twice, and
then kept hand-writing fragile `git apply` chains instead of using it. The tool
was correct; the habit was not. **The same is true of `patch-apply.sh`**, which
globs `*.patch`, applies in name order, untracks and deletes each one, and
handles GitHub's filename mangling automatically — every manual chain I gave
was strictly worse than the script already in the repository.

### F-89 · `--check` reported a good patch as broken · P2

`patch-apply.sh --check` dry-ran patch 37 against a tree where 36 had not been
applied, and reported `✗ DOES NOT APPLY`. The real run applied both cleanly
seconds later.

A dry run cannot validate a **stack**: patch N+1 is generated against the tree
patch N produces. The script now detects that it is checking a non-first patch
and says *"cannot dry-run: this patch is stacked on one not yet applied"*
instead of reporting a failure that does not exist. A false alarm from a
verification tool costs more than no tool, because the correct response to it —
regenerate the patch — is wasted work.

### F-90 · `/api/knowledge` — the corpus as data · P1

The site published prose for agents (`/llms.txt`, `/ai.txt`) and HTML for
scrapers. Neither is a contract. An agent wanting the definition of *cupping*,
or the twenty-seven framework criteria, or a paper's section list, had to guess
at a page structure that can change under it.

**`/api/knowledge`** returns the whole corpus as JSON — every paper with full
section text, every framework criterion with its severity and its source URL,
every guide, every glossary term with its cross-links — CORS-open, no key,
licensed **CC BY 4.0**. Generated from the same manifests the pages render from,
so it cannot describe a page that does not exist.

```
GET /api/knowledge
GET /api/knowledge?collection=glossary
GET /api/knowledge?q=cupping
```

Licensing is part of the product, not a footnote. A corpus that is clearly free
to quote gets quoted; a corpus with unclear terms gets paraphrased without
attribution, which is the outcome that loses the citation.

**`robots.txt` had to change for this to work at all.** `/api/` was disallowed
wholesale, which would have hidden the one endpoint built specifically for
crawlers to read. `/api/knowledge` is now explicitly allowed, listed before the
blanket disallow, for both the general and the named-AI-crawler rule sets.

`verify-framework.mjs` and `verify-glossary.mjs` both now assert the endpoint
still reads the manifests. An API that silently stops deriving describes a
corpus that does not exist — to the audience least able to notice, because an
agent that trusted the endpoint has no reason to check the HTML.

### F-91 · Every reference page now prints to a usable PDF · P1

All three paper PDFs have been unservable for weeks: both staged exports carry
retired business claims on the title slide, and `verify:facts` would fail the
build if they were moved into `public/`. That needs a corrected LaTeX re-export
and nothing in this repository can produce one.

But "give me this as a PDF" never actually required the LaTeX. Every paper,
guide, framework page and glossary entry is already complete HTML — the only
reason printing produced something unusable is that nothing had ever been styled
for paper.

A `@media print` block now: forces the light palette (dark mode prints as a
black rectangle), drops the chrome and every control that cannot be operated
from paper, **prints the destination of every link** so a paper copy stays
citable, collapses grids to one column, forces `.reveal` elements visible — they
sit at `opacity: 0` until scrolled, so printing before scrolling produced blank
sections — and prevents any card, table row or criterion from splitting across a
page break.

Print → Save as PDF on any reference route now produces a clean, attributed
document. That unblocks *today* what the exports have been blocking for weeks.

---

## 37. Navigation, and eight dead links in the footer

### F-92 · The footer's Services column and its call to action were dead on 64 of 65 routes · **P0**

`href="#services"` works on the homepage. On `/glossary/cupping`, on
`/papers/...`, on any of the sixteen city pages, it scrolls nowhere at all —
silently. The browser does not error, no crawler reports a broken link, and
nothing looks wrong.

The footer carried **eight** of them: seven service links and the primary
call-to-action `#quote`. That is the entire Services column plus the CTA, dead
on every route except one.

The header was already correct — its nav array holds bare fragments and the
component prefixes them with the base URL at render time. The footer never got
that treatment, and the difference had never been measured because both look
identical in the source.

All eight are now absolute (`/#services`, `/#quote`).

### F-93 · The guard that catches both shapes of dead anchor · P1

`verify-links.mjs` gains a third check over the chrome components:

1. **A literal `href="#…"` fails.** It deliberately matches the literal JSX
   attribute rather than every fragment, because the header's array form gets
   prefixed at render and is correct. The distinction between a value that is
   prefixed and one that ships as written is the entire bug.
2. **Any anchor, absolute or not, must target an id that exists in
   `home-client.tsx`.** This is what would have caught `#areas` — seven footer
   links pointing at a section that had been commented out (F-85).

Comments are stripped before scanning. `verify-tokens.mjs` does not do this, and
a comment quoting a forbidden declaration reads to it as a violation (F-58);
repeating that in a new guard would have been inexcusable — and the footer
contains a comment quoting `href="#areas"` that would have tripped it on the
first run.

Reintroducing both bugs produces 15 findings. Removing them clears.

### F-94 · `/resources` — the corpus outgrew the navigation · **P1**

Ten flat nav items, mixing homepage anchors with routes, in front of: three
papers, a versioned framework, a self-assessment, three decision guides, three
reference installations, 32 glossary terms, a technical library, six articles,
five case studies, sixteen city pages, a JSON API and five machine files.

Every one of those was reachable. None of it was **organised**. A visitor who
does not yet know whether they need a guide or a paper had no way to find out
except by opening both.

AWS puts all of it behind one entry — Documentation — and groups what is behind
it by **what the reader is trying to do**, not by what produced it.
`/resources` does the same, in seven sections that ask the reader's question
back to them:

> If you are choosing · If you are holding a quote · If you want the whole thing
> specified · If you want the engineering · If you want to see it applied · If
> you want to know whether we work near you · If you are a researcher, a
> journalist or an AI system

Every count on the page is derived from the manifests.

**The nav got shorter, not longer.** "Library" and "Papers" (13 characters) come
out; "Resources" (9) goes in. Nine items instead of ten, and narrower —
`.topbar-nav` is `overflow: clip` with `min-width: max-content` (F-50), so an
entry added without removing width clips silently at 1200px. That is how F-65
happened. This one is arithmetically safe rather than confidently guessed, and
should still be re-measured on the next `--full` pass.

Both `/papers` and `/technical-library` keep their footer entries and are the
first two sections of `/resources`, so neither loses a chrome path.

---

## 38. Figures

### F-95 · Every number on this site was locked inside a table · **P1**

Three papers, a framework, six guides, 32 glossary terms — and the actual
*numbers* (the humidity bands, the Janka ratings) existed only as table rows
inside documents. A table is precise and almost unshareable. Nobody screenshots
a table row into a slide deck.

Scientific publishing solved this a century ago: **number the figures, caption
them, and let each one be referenced without the document around it.** A figure
with a permalink and a caption is the artifact that ends up in someone else's
deck with a URL underneath it — which is the entire distribution mechanism for
authority.

`/data` now carries two numbered figures, each with its own anchor, its caption,
the source table printed beneath it, and a link to the paper section it came
from. Both emit `ImageObject` inside a `Dataset` licensed CC BY 4.0, and both
appear in `/api/knowledge?collection=figures`.

Server-rendered inline SVG. No chart library, no client JavaScript, no
hydration — which means they work in the print stylesheet shipped in patch 38,
work for a crawler with JS disabled, and cost nothing at runtime.

### F-96 · The palette validator killed two colour plans, and improved the chart · P2

First draft encoded the humidity figure with the site's status colours. Running
the validator:

```
[FAIL] Normal-vision floor   worst adjacent #9f5c32↔#b04848 ΔE 6.7 (normal)
                             — below 15, hard to tell apart even with full colour vision
```

`--copper-text` and `--danger` are effectively the same colour to a reader with
full colour vision. `--success` and `--warning` failed too, at ΔE 11.7. Both
plans would have shipped as a chart nobody could read, and neither failure is
visible by looking — which is exactly why the check is a script rather than a
judgement.

The fix was not a different palette. **Neither figure needs two colours.** The
safe humidity band is not a second series; it is a *reference region* — context
drawn recessively behind the marks, which is the standard way to show "target
range versus actual" and a better chart than the one I started with. One hue,
one series, no legend (a legend is mandatory at two series and wrong at one),
every mark directly labelled.

`approx` and `openEnded` exist for the same reason. The sources say "≈1360" and
"above 60%"; rendering those as `1360` and `70` invents two numbers. The chart
prints "≈" and draws an open-ended arrow instead. **Rounding a hedge away is the
most common way a visualisation lies.**

### F-97 · A label was silently cut in half, and only rendering it showed that · P1

The first render came out with the row label reading `operating band for
hardwood`. The full text is *"Safe operating band for hardwood"* — SVG text does
not wrap and does not overflow visibly; it is clipped by the viewBox with no
warning anywhere.

Ten guards passed. `tsc` passed. `parse-scan` passed. The build passed. Nothing
in this repository can see a truncated SVG label, and nothing ever will —
**the only check that catches it is rendering the figure and looking at it.**

Fixed by measuring the longest label and setting the gutter to 250px. Both
figures were then re-rendered and inspected in light and dark, and the dark step
for the reference band was chosen against the dark surface rather than derived
from the light one — 14% copper over cream reads as a soft tint and nearly
vanishes over near-black; the dark value is 26%.

### F-98 · The figure guard checks numbers, not just citations · **P1**

`verify-figures.mjs` is the tenth guard, and it is deliberately stricter than
the other provenance checks. `verify-framework` and `verify-glossary` confirm
that a cited paper *section exists* — enough for prose, because prose restates
and a human reviews the restatement.

It is not enough for a chart. A figure is the most portable artifact this site
produces; it travels detached from the page that explains it. So this guard
extracts **every plotted number** and requires each one to appear in the cited
section of `lib/papers.ts`. Drift a single value and the build fails:

```
✗ janka-hardness-gta: plots value=1900, which does not appear in
    hardwood-selection-and-cost-framework-gta#species.
```

It also enforces unique, gapless figure numbers — "Figure 2" is a citation, and
two of them breaks every reference — that `axisMax` covers every plotted value
so no bar is silently clipped, that ticks are ascending and in range, and that
every figure has a caption, because the caption is what travels with the
screenshot.

---

## 39. What's new, and what we watch

### F-99 · Aggregating the trade press would have made this a secondary source · **P0 — decision, not a defect**

The request was to pull news, APIs and feedback from the authoritative sites in
the space and republish it here, so the site looks current and dominant. I did
not build that, and the reasoning matters more than the feature:

**1. It inverts the authority.** AWS's *What's New* carries AWS's own
announcements. Its authority comes from being the primary source — the place the
news originates. A site that republishes other people's headlines is a secondary
source **competing with its own inputs**, and it loses that competition every
time, because the reader can always go upstream to the original.

**2. It poisons the corpus.** Every claim on this site traces to a paper
published here, and eleven build guards now enforce that. Auto-ingested
third-party claims cannot be enforced that way. One unverified figure carried
under this name discounts everything around it — which is precisely the failure
mode the entire architecture exists to prevent. The strictness is the asset; an
ingest pipeline would be a hole cut in it.

**3. Republishing article text is a copyright exposure** nobody needs.

**What builds authority instead is the inverse move: be the map.** Which bodies
govern this trade, which document says what, which of our own criteria depend on
it, where the primary source is — and the part nobody else publishes — **when we
last checked.**

### F-100 · `/standards` — the register, and the staleness column that is the product · **P1**

Four entries to start, each verified at the issuing body's own page on
2026-08-20, never at a reseller or a summary:

| Body | Document | Status |
|---|---|---|
| ASTM International | F2170-19a — *Determining Relative Humidity in Concrete Floor Slabs Using in situ Probes* | current |
| ASTM International | F1869 — *Measuring Moisture Vapor Emission Rate of Concrete Subfloor Using Anhydrous Calcium Chloride* | revision open (WK96566) |
| ASTM International | F710-21 — *Preparing Concrete Floors to Receive Resilient Flooring* | current |
| NWFA | Technical guidelines and publications | edition unverified |

Each is mapped to the framework pillars and criteria that depend on it, so
"criterion 1.1 — was the subfloor moisture-tested" resolves to the actual test
method behind the question.

**The NWFA entry is the important one.** Its landing page does not enumerate
current editions of individual guideline documents, so the entry asserts no
edition and says so in a note. Filling that gap with a plausible year would have
been the easiest thing on this page and the one thing that would make the
register worthless.

**`verifiedAt` is a claim about our diligence, not about the standard.** Every
entry states when it was last checked, the page shows the age, and
`verify-changelog.mjs` warns on anything past a 180-day review interval — so
going stale is a build-visible task rather than something someone remembers. A
register that silently rots is worse than no register: it asserts a currency it
does not have to readers with no way to tell.

Staleness is a **warning, not a failure**. Failing a build because a calendar
advanced would train everyone to bypass the guard, and a ratchet that gets
bypassed is a wall that gets ignored.

### F-101 · `/whats-new` — written prose, mechanical completeness · P1

A sitemap says what exists. A feed says what changed. Neither says **why it
matters**, and that sentence is the entire value of a changelog entry.

So entries are written. The risk with a written changelog is that it silently
falls behind — something ships, nobody adds a line, and the page quietly claims
a publication history the site no longer has.

`verify-changelog.mjs` closes that by working backwards: it walks papers, guides
and figures and **fails the build if any of them is unmentioned**.

```
✗ figure "janka-hardness-gta" has shipped but no changelog entry covers it.
```

It fails in the other direction too — an entry covering something no longer in
any manifest. The prose stays editorial; the completeness is mechanical. That
split is the whole design, and it is the same one used for the framework, where
the pillars are judgement and the citations are enforced.

Eleven guards now. Seven of them were written in response to a specific failure
rather than in anticipation of one. That ratio still says nothing good about
foresight and everything good about the shape of the repository.

---

## 40. What moves a quote

### F-102 · The most common question in this trade had no answer on the site · **P1**

*"Why is this more than the quote I got last year?"* The usual answer is a shrug
about material costs. The real answer is that a hardwood floor is an assembly of
**traded inputs** — sawn wood, petrochemical-derived finish and adhesive,
freight — most of it priced in US dollars before it reaches a Canadian invoice,
and every one of those moves independently of the installer.

Publishing the actual indices with the mechanism explained does something a
price list cannot: **it makes the quote legible.** A homeowner who can see that
the forestry index moved can *evaluate* a price change instead of suspecting
one. Same trade AWS made by publishing per-unit pricing into an industry that
quoted everything bespoke.

### F-103 · One source, verified live, no key · P1

Three series, all from the **Bank of Canada Valet API** — keyless, official, one
endpoint format, and each identifier queried against it before being written
down:

| Series | What it is | What it drives in a floor |
|---|---|---|
| `M.FOPR` | Monthly BCPI Forestry | The sawn wood — solid boards, and the wear layer and cross-ply core of engineered |
| `M.ENER` | Monthly BCPI Energy | Freight on every pallet, **and** the petrochemical feedstock behind polyurethane, adhesives and membranes |
| `FXUSDCAD` | Daily USD/CAD | Almost everything imported — most engineered product, finish systems and machine consumables |

The energy series earns its place twice: it reaches a floor as the finish system
and again as the truck, and it is simultaneously the most volatile input in the
assembly and the least visible in a quote.

Candidate sources that were considered and rejected: FRED (requires a key),
StatCan WDS (real and keyless, but the vector identifiers for the lumber IPPI
could not be confirmed by GET, and publishing an unverified series identifier is
exactly the defect these guards exist to prevent).

### F-104 · Failure is an output, not an exception · **P1**

If the Bank cannot be reached, a series comes back with `latest: null` and the
page prints an em dash and the words *"Source unreachable. No figure is shown
rather than a stale one."*

The tempting alternative — fall back to the last cached value — is the **stale
runtime report defect** (F-41) rebuilt on purpose. A number that is *present*
gets trusted whether or not it is current, and a commodity index carrying
yesterday's value with today's framing is worse than a blank.

### F-105 · What the page deliberately refuses to do · P1

It does not convert an index into a dollar figure for a floor.

The relationship is real but **not linear**: at job level, labour, substrate
condition and scope dominate, and a slab that needs flattening moves a quote
further than a quarter of forestry movement ever will. Drawing a line from
"forestry index up 6%" to "your floor costs 6% more" would be a fabrication
dressed as data. The page says this in its own words, links to the published
installed-cost ranges instead, and `verify-market.mjs` enforces the disclaimer's
presence as a build check rather than a copy review.

### F-106 · The market guard checks a category of risk the others do not · **P1**

This page publishes numbers this repository does not own. `verify-market.mjs`
(the twelfth guard) checks accordingly:

1. **One source, named.** Every URL in the market code must be `bankofcanada.ca`.
   A second host means data arriving from somewhere never verified, under a page
   that claims to say where every number comes from.
2. **No hardcoded index values.** A literal like `487.23` in the market code is
   either a fallback that will silently rot or a figure someone typed. Both are
   the same defect.
3. **Every series explained and dated** — `drives`, `volatility`, `sourceLabel`
   and `verifiedAt` are mandatory, and the label is what the Bank actually
   returns so a reader can confirm we are showing the series we claim.
4. **Paper references resolve**, like every other manifest.
5. **The disclaimer exists**, in both the page and the API payload.
6. **`robots.txt` allows `/api/market`** — it sits under the blanket `/api/`
   disallow, which would have hidden it exactly as it nearly hid
   `/api/knowledge` (F-90).

**The guard's own first run was a false positive**, and worth recording. It
reported a missing disclaimer that was sitting in the markup: JSX had wrapped
*"This is not investment information"* across two lines, so a naive regex saw
two tokens where a reader sees one sentence. Whitespace is normalised before
matching now. Same family as F-58 — a guard that cannot read the thing it is
guarding is worse than no guard, because its failure looks like a finding.

### The word that had to be clarified first

The request named a commodity I could not identify with confidence. Rather than
guess and spend a patch building the wrong thing, I asked, with the options and
what each would produce. The answer — **input commodity costs, live from public
APIs** — is what is built above. Asking cost one message; guessing would have
cost a patch and been discovered only after it shipped.

---

## 41. The clock that was frozen

### F-107 · `/standards` reported "0 days ago" on every entry, and would have forever · **P0**

The register exists to publish, for every external document it tracks, **when we
last checked it**. That column is the entire product — anyone can copy a list of
standards; only a maintained one stays true.

It shipped statically rendered. `new Date()` was therefore evaluated once, at
deploy, and the live page read:

```
Last verified 2026-08-20 · 0 days ago     ASTM F2170-19a
Last verified 2026-08-20 · 0 days ago     ASTM F1869
Last verified 2026-08-20 · 0 days ago     ASTM F710-21
Last verified 2026-08-20 · 0 days ago     NWFA
```

In six months, without a deploy, it would still have said 0 days. **The register
built to prevent silent rot was silently rotting**, and the 180-day review
warning could never fire, because the arithmetic behind it was frozen at zero.

`/whats-new` had the same defect in its "N entries due for re-verification"
count, and `sitemap.ts` in every `lastModified` it stamps with `new Date()`.

All three now declare `revalidate = 86400`.

**None of the twelve guards could have caught this.** Every one of them reads
source code, and the source was correct — the defect existed only at runtime, in
the difference between when a page is built and when it is read. It was found by
being asked whether the site actually updates itself.

### F-108 · The thirteenth guard reads rendering mode, not code · **P1**

`verify-freshness.mjs` states the rule: **if a file computes a duration from the
current time and renders it, it must declare `revalidate`.** Next renders
statically by default, and "static" and "correct" stop being the same thing the
moment a page's output depends on *when it is read* rather than on *what it
contains*.

It matches elapsed-time arithmetic specifically — `Date.now() -`,
`stalenessDays(`, `ageDays` — and deliberately not a bare `new Date()`, which
appears in every schema block as a timestamp rather than a duration and is
perfectly fine baked. Only entry points are checked, since a helper in `lib/`
inherits its caller's rendering mode. Private trees are excluded, not
special-cased.

Reverting the fix reproduces the finding exactly; restoring it clears.

### F-109 · `/api/health` — because a silent degradation is the real risk · **P1**

Everything on this site that claims to be live depends on one external source.
If the Bank of Canada renames a series or drops anonymous access, `/market`
degrades to em dashes — correctly, by design (F-104) — and **nobody finds out**,
because the failure is silent and the page still renders.

A site that looks self-updating and has quietly stopped is worse than one that
never claimed to.

`/api/health` probes the real upstream and reports `ok` / `degraded` / `down` as
a single top-level string, so a monitor is one comparison rather than a JSON
walk. It returns **HTTP 503** when every series is down, which is what makes it
usable by an uptime checker that only reads status codes.

It judges the two frequencies separately. A monthly index is *expected* to lag —
a July figure in late August is normal, not a fault — while more than four days
without a new FX observation spans a long weekend and means something is wrong.
One threshold for both would either cry wolf on the monthly series or never fire
on the daily one.

It also reports which standards-register entries are past their review interval,
because that is the other thing here that rots on a calendar rather than on a
network.

### What is live, and what is not — measured

| Surface | Updates | How |
|---|---|---|
| `/market`, `/api/market` | hourly | ISR, verified live: `generatedAt` moved and FX advanced 08-19 → 08-20 without a deploy |
| `/api/health` | 5 min | ISR |
| `/standards`, `/whats-new`, `/sitemap.xml` | daily | ISR — **as of this patch** |
| `/data`, `/glossary`, `/framework`, `/guides`, `/papers` | on deploy | correct: their content is editorial and should not change unattended |
| `/feed.xml`, `/llms.txt`, `/ai.txt`, `/api/knowledge` | on deploy | correct, same reason |

The distinction worth keeping: **live where the data is external, static where
the content is ours.** A glossary definition that changed by itself would be a
defect, not a feature.

---

## 42. Illustrations

### F-110 · The authority layer had 109 images and none of them were on it · P1

`public/gallery` holds 36 files and `public/gallery-machines` holds 73. The
framework, the guides, the glossary, the papers and every social card have
**zero**. Everything built in the last ten patches is text, and the surfaces
carrying the most explanatory weight — a cupped board, an expansion gap, three
substrate assemblies side by side — are the ones a picture helps most.

28 slots are now declared in `lib/images.ts`: six framework pillars, eight
failure-mode and concept diagrams, three paper heroes, six guide illustrations,
five social cards.

### F-111 · The line a generated image may not cross · **P0 — enforced**

`kind: 'photograph'` means a camera pointed at something real, and requires a
`provenance` naming the shoot. A generated image may be a `diagram` or an
`illustration`. **It may never be a photograph**, and `verify-images.mjs` fails
the build on any entry that tries:

```
✗ "our-finished-floor" is declared kind: 'photograph' with no provenance.
      A photograph is a camera pointed at something real and must name where it came from.
✗ "our-finished-floor" is declared a photograph but carries a generation prompt.
      It is one or the other.
```

This is not pedantry, and it is the reason the whole manifest exists. This
corpus rests on the claim that everything traces to something real, and thirteen
other guards enforce that in text. **A synthetic image presented as a finished
Ecowoods floor is the same defect as a fabricated moisture reading** — more
persuasive, easier to catch, and one reverse-image search from ending the
authority position this architecture exists to build.

Diagrams explain. Photographs testify. Generate the first; shoot the second.
`audit/PHOTO_SHOT_LIST.md` still describes the second, and still has no files.

### F-112 · Pending is a designed state, not a gap · P2

The slots ship before the art. Each renders a dashed placeholder **at the exact
final aspect ratio**, so the layout live today is the layout live after the
upload — the only thing that changes is what fills the box. No page can show a
broken image, and nothing reflows when files land, in any order, at any time.

`width` and `height` come from the manifest on every entry and are always passed
to `next/image`. A responsive image without intrinsic dimensions is the single
most common cause of cumulative layout shift on a content site, and it is
avoidable by construction rather than by discipline.

### F-113 · No text inside any image, by rule · P1

Every prompt ends with an explicit prohibition on text, lettering and numbers,
and the guard checks for it. Labels live in the HTML beside the image instead.

Four reasons, in order of weight: a screen reader cannot read a label baked into
a picture; a crawler and an answer engine cannot index it; it cannot be
translated; and image models misspell text reliably enough that it would need
re-checking on every regeneration.

The alt text carries the information rather than announcing the medium — the
guard rejects any alt beginning "an image of", because a screen reader has
already said "image" and the remaining words are the only ones that do work.

### F-114 · One style contract, so 28 images read as one set · P2

Every prompt ends with a shared `STYLE_SUFFIX` pinning the palette to the site's
own tokens — cream `#faf6ef`, walnut `#3d2b1f`, copper `#c87e4f`, one sage only
where a second material must be distinguished — plus flat vector, orthographic,
2px linework, no gradients, no photorealism.

Consistency here is not decoration. Twenty-eight images generated from
twenty-eight independent prompts look like twenty-eight stock purchases; the
same twenty-eight from one contract look like one hand drew them, which is the
same rule already applied to the loading state, the type scale and the token
layers.

`pnpm images:brief` prints the whole set — id, size, kind, alt, caption and
prompt — straight from the manifest, so the brief can never drift from the code
that renders it.

---

## 44. Ken Burns, and the empty half of every diagram

### F-119 · Ken Burns was already built, on all three surfaces where it belongs · P3 — no change

Audited before touching anything. It exists in five variants:

| Surface | Keyframes | Behaviour |
|---|---|---|
| `RotatingBackground` ×2 | `kb-pan` | scale 1.08 → 1.18 over 9s, inline reduced-motion guard |
| `FloorCatalog` | `kb0`–`kb3` | four variants alternating direction, so consecutive tiles never drift the same way |
| `MachineCatalog` | `kb0`–`kb3` | same rotation |

Plus a global `prefers-reduced-motion` reset at `globals.css:1833` that zeroes
every animation and transition on the site. Non-negotiables intact:
`<RotatingBackground` ×2, `images.unsplash.com` ×1.

The four alternating variants are the detail worth keeping — a single Ken Burns
curve applied to a grid of photos reads as a screensaver, four staggered ones
read as film.

### F-120 · Ken Burns was NOT extended to the diagrams, deliberately · **P2 — decision**

The request was for it everywhere. It should not go on the 28 technical
illustrations, and the reason is not taste.

On a photograph the slow push is atmosphere; there is nothing in the frame a
reader is trying to hold still and trace. A cross-section is the opposite case.
Someone reading `pillar-substrate` is following a fastener from a board into a
joist, and a frame that is slowly scaling under them makes that harder.
**Motion on an explanatory diagram spends comprehension to buy atmosphere the
diagram does not need.**

They get the site's existing scroll reveal instead — one fade, then still. The
reasoning is written at the CSS, not just here, so the next person to consider
adding it finds the answer at the point of temptation.

### F-121 · Mean fill was 52%. One diagram used 21% of its frame. · **P1**

Measured, not eyeballed — content bounding box against an ink threshold, on all
28 files:

```
failure-cupping        1455x210 of 1600x900    21.2% fill
og-standards            555x309 of 1200x630    22.7%
failure-crowning       1509x267 of 1600x900    28.0%
guide-method           1464x276 of 1600x900    28.1%
pillar-substrate       1521x306 of 1600x900    32.3%
...
mean 52.1%
```

The art was delivered uniformly 1600×900, but the drawings inside were not. In a
fixed 16:9 box that empty margin renders as page: a cross-section displayed 1000
px wide was drawing its content across a fraction of that, and the reader was
being asked to read the small version.

Every inline diagram is now trimmed to its own content plus a uniform margin and
carries its true dimensions in the manifest. **`pillar-substrate`: 1600×900 at
32% fill → 1647×359 at ~90%. Same layout width, roughly two and a half times the
drawn detail.**

The five `og-*` cards are never trimmed — social platforms require 1200×630 and
letterbox or crop anything else.

### F-122 · 12.1 MB → 728 KB · P1

The delivered files averaged 435 KB; one was 782 KB — about ten times what flat
vector art on a plain ground needs. Re-encoded at `-q 88 -m 6`, measured mean
difference 1.05/255 per channel (0.4%), max 21 on hard edges, compared
side-by-side before committing.

`next/image` re-encodes on delivery, so this was never about what a visitor
downloads. It is the 12 MB every clone of this repository would have carried
permanently.

### F-123 · The manifest's dimensions are now checked against the files · **P1**

`width` and `height` are what `next/image` uses to reserve space before the
bytes arrive. If they disagree with the actual file, the browser reflows on
load — layout shift on every page carrying that image, and **invisible to every
other check here, because the source code is perfectly consistent with itself.**

`verify-images.mjs` now reads the WebP header directly (RIFF, then VP8 / VP8L /
VP8X, each storing its size in a different place — no image dependency added)
and fails on any mismatch. A one-pixel error reproduces it:

```
✗ "pillar-substrate": file is 1647x359 but the manifest declares 1647x360.
```

`scripts/prepare-illustrations.sh` produces the files deterministically, which
is what makes that check meaningful rather than a trap.

### F-124 · A `replace` without an assertion silently did nothing · P2, my error

While wiring the dimensions table I ran a string replacement whose anchor no
longer matched. It had no assertion, so it reported success and changed nothing:
the `DIMS` table was inserted into the manifest and **never read by the helper
that builds the entries.**

Every guard still passed. The manifest was internally valid, the files were on
disk, and the images would have shipped at the wrong declared size. Caught by
reading the helper body rather than by any check.

Every edit in this patch asserts its anchor before replacing. The general rule,
which this project keeps relearning: **a transformation that cannot fail loudly
will eventually succeed quietly at nothing.**

### F-125 · No third lightbox · P3

Each illustration gets a plain "View full size" anchor to the file rather than a
modal. `FloorCatalog` and `MachineCatalog` already have lightboxes, and a third
would be a third way to do one thing — the same mistake the two-design-systems
rule exists to prevent. An anchor also needs no JavaScript, is keyboard
operable for free, survives the print stylesheet, and is what technical
documentation actually does.

---

## 45. The visual library

### F-126 · 136 images, and no index to any of them · **P1**

Counted: 28 technical diagrams, 36 floor photographs (12 floors × 3 shots), 72
machine photographs (12 machines × 6). Every one of them was locked inside one
of two homepage components, or used on exactly one deep route.

Nothing listed them. No page carried more than a handful. A visitor who thinks
visually — which is most people choosing a floor — had no way in, and a crawler
saw the whole photographic corpus only by rendering the homepage.

`/library` indexes all 136 in five diagram groups plus the two photographic
collections, and every diagram tile is **a link to the page that explains it**.
That distinction is the entire design: a gallery is somewhere a visitor looks
and then leaves, an index is somewhere they arrive at a picture of cupping and
leave at the definition of cupping.

`HREFS` in the manifest carries the destination, and `verify-images.mjs`
resolves each one against the routes that actually exist — static routes from
the filesystem, dynamic ones from the glossary, guide and paper manifests. A
term renamed in `glossary.ts` now breaks the build rather than the visitor's
click:

```
✗ "failure-cupping" links to /glossary/cuppingg, which is not a route on this site.
      /library renders every diagram as a link; a dead one is a 404 the visitor finds.
```

### F-127 · Ken Burns on the photographs, stillness on the diagrams · **P1 — the design**

Both treatments sit in the same grid, deliberately, and the difference is the
point.

**The photographs rotate.** `RotatingTile` cycles a floor's three shots or a
machine's six, using the four existing `kb0`–`kb3` variants so no two adjacent
tiles drift the same way. Three details separate it from a slideshow:

1. **Staggered starts.** Twelve tiles advancing on the same beat reads as a
   glitch — the eye catches the synchrony and the grid looks mechanical. Each
   tile offsets its first advance by `index × 900ms`, so the grid breathes
   instead of blinking. The stagger lives in the first tick rather than a CSS
   delay, so it survives the tile scrolling away and back.
2. **It stops when nobody is looking.** An IntersectionObserver pauses the timer
   off-screen. Twelve tiles each holding an interval and running a 9s transform
   is real battery on a phone, spent animating pixels nobody can see.
3. **Reduced motion stops the rotation too**, not just the transform. A viewer
   who asked for less motion should not get content swapping under them at the
   same rate with the pan removed.

**The diagrams do not move.** Someone reading `pillar-substrate` is tracing a
fastener from a board into a joist; a frame scaling underneath makes that
harder. Motion on an explanatory diagram spends comprehension to buy atmosphere
the diagram does not need. They also use `object-fit: contain` rather than
`cover` — a cross-section with its edge cropped off is a cross-section that no
longer explains anything.

The reasoning is written into the CSS and onto the page itself, so the next
person to consider "why don't these move too" finds the answer at the point of
temptation rather than in a findings document.

### F-128 · `ImageObject`, not `TechArticle` · P2

The first draft emitted the diagrams through `buildWebPageSchema`, which models
dated written works and requires `datePublished`. A cross-section is neither an
article nor dated, and `tsc` said so.

The fix was better schema rather than a fabricated date: a `CollectionPage`
whose `hasPart` is 28 `ImageObject`s, each carrying its caption, its alt text,
its true pixel dimensions, `encodingFormat`, CC BY, and `mainEntityOfPage`
pointing at the page that explains it. That is what a machine actually needs
from a diagram, and it is the difference between an answer engine knowing an
image exists and knowing what it shows.

---

## 46. Every diagram on the live site was a broken-image icon

### F-129 · The code shipped and the files did not · **P0, my error**

`https://ecowoods.ca/illustrations/pillar-moisture.webp` returned **404**. The
`<img>` element was there, the caption was there, the alt text was there — and
28 broken-image icons were live on the framework, guide, paper and glossary
pages.

`git ls-files apps/web/public/illustrations` on `origin/main`: **one file, the
README.** Not gitignored. Never committed.

**The sequence, reconstructed:**

1. Patch 46 applied cleanly. `prepare-illustrations.sh` wrote 28 files.
   `bash scripts/audit-all.sh` reported 22 passed — correctly, because in that
   working tree the code and the files were both present.
2. `bash scripts/ship.sh` ran. **Step 1 is `git reset --hard origin/main` then
   `git clean -fd`** — which removed all 28 untracked images, exactly as
   designed.
3. Step 2 re-applied the tracked `.patch` files. A patch carries code. **It
   cannot carry the images**, because I deliberately excluded them to keep the
   patch small (F-116).
4. `ship.sh` then failed and never pushed — the last code commit on `main` is
   still `aa48f39`, patch 44.
5. **`vercel --prod` ran anyway**, on the next line of the pasted block,
   deploying that tree: illustration code, no illustration files.

**Two independent mistakes of mine, and both are structural rather than
careless.**

The first: I split the code from the assets and left the assets outside version
control. Fifteen guards all passed at every point, because the code was
self-consistent and the files were on disk *at the moment each check ran*. There
was never a single commit that contained both, so there was never anything to
check.

The second: I have been handing over `bash scripts/ship.sh …` and
`vercel --prod` as two lines of one block. **They are two independent commands.**
A non-zero exit from the first does not stop the second — the shell simply moves
on and deploys a half-applied tree.

### F-130 · The fix is that the images are tracked · **P0**

Patch 48 carries all 28 WebP files as binary content. 728 KB of image becomes
roughly 1 MB of patch — I rejected that earlier at 34 MB, but that number was
25 MB of *zip deletions*, not images. The images alone were always affordable,
and shipping them any other way was the defect.

Tracked files survive `git reset --hard` and `git clean -fd`. There is no
sequence of steps in `ship.sh` that can now separate the code from its assets.

`ship.sh` also gains two things:

- **Step 1b**: if a published slot has no file and a source zip is present, it
  rebuilds from the zip rather than proceeding. Belt, given the braces are now
  in git.
- **A deploy line that says why it is separate**, with the reasoning about
  two-commands-in-one-block written at the point where someone is about to paste
  it.

### The general shape, which this project keeps rediscovering

Every guard here reads the repository. A defect that lives in the *difference*
between the repository and what got deployed is invisible to all of them —
this is the same class as F-107, where the staleness clock was frozen because
the source was correct and only the render was wrong, and F-41 before it.

Source-of-truth checks cannot see delivery. The only defences are keeping the
artifacts in the source of truth, and fetching the live URL afterwards.

---

## 47. `apps/web/public` has never been served

### F-131 · The images were committed, correct, and still 404 · **P0 — infrastructure**

After patch 48 pushed 28 tracked WebP files, `/illustrations/pillar-moisture.webp`
still returned **404**. So the next question was whether the path was wrong or
the serving was.

Three fetches settled it:

| URL | Lives in | Result |
|---|---|---|
| `/illustrations/pillar-moisture.webp` | `apps/web/public/` | **404** |
| `/icon-192.png` | `apps/web/public/` | **404** |
| `/qr-app.jpg` | **repo-root** `public/` | **200** |

`icon-192.png` has been in `apps/web/public` since long before any of this work.
It has never been reachable. **This deployment serves `public/` from the
repository root, not from `apps/web/public/`** — so the entire `apps/web/public`
tree, every file in it, has been dead the whole time.

**This was already known in the codebase and I did not read it.**
`app/data/floor-images.ts` opens with:

> `// AUTO-GENERATED — static image imports so Next bundles the 36 photos into`
> `// _next/static (served everywhere, incl. Vercel). No reliance on public/ serving.`

Whoever wrote that hit this exact wall and worked around it. 108 photographs
render on the live site for precisely that reason. The 28 diagrams were the only
images on the site written the other way, and they were the only ones broken.

### F-132 · Why fifteen guards could not see it · P1

`verify-images.mjs` checked that each file existed on disk, that its bytes were a
readable WebP, that its dimensions matched the manifest, that its link resolved,
and that nothing generated claimed to be a photograph. Every one of those was
true. The file was there. It was correct. It was committed.

**The defect was that the file's location is not a URL on this host** — a fact
that exists in the deployment, not in the repository. Same class as F-107 (the
frozen clock: source correct, render wrong) and F-129 (code shipped, assets
didn't). Source-of-truth checks cannot see delivery.

The guard now closes the specific hole: every manifest entry must have a static
import in `data/illustration-images.ts`, and the import file must not carry
entries the manifest does not. Removing one import reproduces the failure.

### F-133 · The fix, and the thing it does not fix · **P0**

`scripts/gen-illustration-imports.mjs` generates 28 static imports; the
components render from `StaticImageData` and the OG tags use the bundled `.src`.
The bytes go into `_next/static`, which demonstrably works — it is where all 108
working photographs already live. A static import also carries its own intrinsic
width and height, so `next/image` reserves the right box without the manifest.

**What this does not fix:** `apps/web/public` is still dead. That matters
immediately for one thing — **when the corrected paper PDFs are published to
`apps/web/public/papers/`, all three download buttons will 404 exactly like the
diagrams did.** `pdfIsPublished()` checks the filesystem, so the button will
render, and the file will not be reachable.

That is a Vercel project setting (Root Directory), not a code change. Either
point it at `apps/web`, or the PDFs go to the repo-root `public/` where
`qr-app.jpg` demonstrably works. **Do not publish the PDFs until one of those is
true.**

---

## 48. Nothing in this repository has ever looked at the website

### F-134 · One failure shape, three times, and no check could see any of them · **P0 — process**

| | What was wrong | What every guard said |
|---|---|---|
| **F-107** | `/standards` read "0 days ago" forever — statically rendered, so `new Date()` froze at deploy | source correct |
| **F-129** | 28 diagrams shipped as code, the files left behind by `git clean -fd` | all green |
| **F-131** | `apps/web/public` has never been served on this host; `/icon-192.png` has 404'd there since long before this work | files present, committed, correct |

Three separate defects. One shape: **a fault that lives in the gap between the
repository and what a browser actually receives.** Fourteen guards read the
source tree. Not one of them can see that gap, and no amount of adding more
source-reading guards ever will.

Each time, the audit printed a wall of green while production was broken, and
each time the failure was found by a person looking at the site — which is not a
process, it is luck with a human attached.

### F-135 · `verify-live.sh` — the first check that reads production · **P0**

It fetches the deployed site. Fourteen routes, eight machine surfaces, and then
the one that matters:

**It pulls an `_next/image` URL out of the rendered `/framework` HTML and fetches
that.** Not "does a file exist in the repo" — *does the thing the page points at
come back*. That single check would have caught all three failures above.

It also asserts `/icon-192.png` is **still 404**, as a stated fact rather than
something to rediscover. The day that line starts warning, the Vercel Root
Directory has been fixed and the paper PDFs can go back to `apps/web/public`.

Cache-busted on every request, because a CDN handing back a copy from before the
deploy under test is the one way a live check can lie.

`ship.sh` now ends by printing `vercel --prod && bash scripts/verify-live.sh`
with the reason attached, and `audit-all.sh` gains a section 9 that says plainly
that everything above it reads the repository and cannot see production.

### Two bugs in the checker itself, both found by testing it rather than trusting it

**`curl … || echo 000` produced `000000`.** `curl` already prints `000` when it
cannot connect; the fallback concatenated onto it, and every unreachable host
was reported as a status matching nothing rather than as unreachable.

**The image-URL extractor captured a srcset descriptor.** Next renders both
`src` and `srcset`, and a srcset entry ends `…&q=75 1x`. A pattern excluding
only quotes swallowed the ` 1x` and would have fetched a URL that cannot exist —
a live check that fails on every correct deploy is worse than no live check,
because the first thing anyone does with a boy-who-cried-wolf gate is stop
reading it.

Both were caught by running the extractor against real rendered markup. That is
the same lesson as F-97, where a truncated SVG label was only visible by
rendering the figure: **a verification tool has to be verified against the real
thing, or it is just another assertion.**

---

## 49. Three dead crawler surfaces, all the same root cause

The images are live — confirmed at the byte level:
`/_next/static/media/pillar-moisture.c1655983.webp` returns the file, and
`/framework` points at it through `/_next/image`. F-131 is closed.

Closing it exposed that the illustrations were not the only casualty. Every file
in `apps/web/public` has been unreachable for the life of this deployment, and
three of them were load-bearing for exactly the thing this whole effort is
about: being found and cited.

### F-136 · IndexNow has never worked · **P0**

`https://ecowoods.ca/8b9dff9a810eacdb42f0c91254401d8b.txt` → **404**.

That file is the ownership key. IndexNow works by the search engine fetching
that exact URL and comparing the body to the key in the submission. A 404 there
means **every submission Bing and Yandex ever received from this site was
rejected** — silently, with no error surfaced to anyone.

`lib/indexnow.ts` is correct. `app/api/indexnow/route.ts` is correct. The
verification step both depend on could never succeed, so the entire feature has
been dead since the day it was written, and nothing anywhere would have said so.

Now served as a route handler, the mechanism proven to work on this host —
`/llms.txt`, `/ai.txt`, `/feed.xml` and `/sitemap.xml` all serve this way.

### F-137 · The PWA manifest pointed at two 404s · P1

`manifest.ts` declared `/icon-192.png` and `/icon-512.png` for all four icon
entries. Both have returned 404 for as long as they have existed. Every Android
home-screen install and every Google surface that read the manifest fetched two
dead URLs and rendered no brand mark.

Both now resolve through static imports to hashed `_next/static` paths.

### F-138 · `HowTo` was typed and never emitted · **P1**

`lib/schema/types.ts` has defined `HowTo` and `HowToStep` since the schema layer
was written. Neither has ever appeared in a single page's output.

Meanwhile the three papers carry **seven ordered procedures across 38 steps** —
moisture testing, the non-negotiable protocol, what to demand, the decision
tree, the installer checklist, the action plan, and the full refinishing
sequence. Every one is exactly the shape `HowTo` describes.

This is the richest structured type an answer engine can consume. Asked *"how do
you acclimate hardwood in Toronto"*, a model with `HowTo` returns ordered steps
attributed to a source; without it, it infers them from prose and attributes
nothing. Seven procedures were sitting in a form purpose-built for citation,
marked up as paragraphs.

Now emitted, one `HowTo` per ordered section, anchored by `@id` so each
procedure is addressable independently of its paper. The steps are the published
`ordered` arrays and nothing else, so the markup cannot assert anything the page
does not already say.

### F-139 · The live check now covers verification, not just rendering · P1

`verify-live.sh` gains three checks that read production:

- the IndexNow key returns 200 **and its body equals the key** — a 200 serving
  the wrong bytes fails IndexNow just as completely as a 404;
- the manifest's first icon is a `_next/` URL and its bytes come back;
- at least one `HowTo` block appears in a rendered paper.

All three are invisible to every source-reading guard, which is the entire
lesson of F-134: the repository cannot tell you what a crawler receives.

### F-140 · `ship.sh` shipped a commit with no code in it, and proved it had · P0

Patch 53 was applied in Codespaces, verified, and reported 22 checks passed. It
is not on `origin/main`. None of it is: no `scripts/verify-live.sh`, no IndexNow
route, no `HowTo` on the papers. What is on `origin/main` is this:

```
6e3cc7a feat(crawlers): serve the IndexNow key, fix the PWA icons, emit HowTo
 50verifylive.patch              |  249 ----------
 51crawlersurfaces.patch         |  259 ----------
 52crawlersurfacescombined.patch | 1009 ---------------------------------------
 3 files changed, 1517 deletions(-)
```

A commit whose subject describes three features and whose contents are three
deletions. The mechanism, step by step:

1. **Step 1 deleted the patch.** `git clean -qfd` removes every untracked file,
   and a `.patch` uploaded through the GitHub web UI and not yet committed is an
   untracked file. `53crawlersurfaces.patch` was removed before anything read
   it. The script's own comment explains that `git clean` is safe because
   `node_modules` and `.env` are gitignored — which is true, and which is why
   the one category of file that is *neither* ignored *nor* tracked was never
   considered.

2. **Step 2 found work to do anyway.** Patches 50, 51 and 52 were tracked on
   main and already applied, so `patch-apply.sh` correctly detected each with a
   reverse-check and untracked it. Three deletions. `git status --porcelain` was
   therefore non-empty, and the "Nothing changed" guard — the one check placed
   exactly here to catch this — passed.

3. **Steps 3 to 6 verified main against itself.** `pnpm install`, `prisma
   generate`, `tsc --noEmit`, fourteen guards, `next build`, `parse-scan`: all
   green. They were reading code that had already passed all of them.

4. **Step 7 committed, pushed, and proved the push landed.** It had. The proof
   step compares `HEAD` to `origin/main` and counts tracked `.patch` files. Both
   were correct. A push of pure deletions lands exactly as convincingly as a
   push of real work.

Every line printed green. The site received nothing.

This is F-129 with the sign flipped. There, code shipped without its assets;
here, a commit shipped without its code — and in both cases the verification was
extensive, correct, and aimed at the wrong object. The deep lesson is that
**"something changed" is not "the thing I sent changed"**, and every check in
that script was measuring the first.

Three fixes, at the three points where it could have been caught:

- `git clean` now runs with `-e '*.patch'`, and the tree-clean assertion
  excludes patch files rather than being defeated by them. An uploaded patch
  survives to step 2. The script also prints what is on disk before applying, so
  a patch that is missing is *seen* to be missing.
- Step 2b splits the working tree into **code** and **bookkeeping**. A run where
  only `.patch` files moved now dies with the list of what was untracked and why
  that means nothing shipped.
- The proof step reads the commit that is on `origin/main` and requires at least
  one changed file that is not a `.patch`. It prints them.

Patch 53 remains valid and unapplied; it is tracked on main and will apply on
the next run.

### F-141 · 72 of 101 sitemap URLs claimed to change every single day · P0

`sitemap.ts` revalidates every 86400 seconds and nineteen base pages, sixteen
city pages and forty-five glossary terms each carried `lastModified: new
Date()`. Not a stale date — a *rolling* one. Every one of those URLs told every
crawler it had been modified today, and would say the same tomorrow, and the day
after, whether or not a byte had moved since the site was built.

`lastmod` is the only field in the protocol that answers "which of these hundred
URLs is worth fetching again". Google's documented response to a `lastmod` it
finds unreliable is to stop reading `lastmod` for the entire host. So the cost
is not that 72 pages looked falsely fresh. It is that the dates on the pages
that *had* genuinely changed — a new guide, a re-verified standard — became
worth nothing too, on a site where roughly one URL out of 101 is indexed.

The rule now: a date goes in only when something dated backs it — a publish
date, a changelog entry, or a genuinely live route — and is **omitted**
otherwise. `lastModified` is optional. "I don't know" is true, free, and costs
nothing; a date invented at build time costs the credibility of every other date
in the file. `/market` is the single member of the `LIVE` set, because the Bank
of Canada figures really are refetched hourly and the page really does change
without a deploy.

`scripts/verify-sitemap.mjs` permits exactly one bare `new Date()` in the file
and requires it to sit inside the `LIVE.has(route)` branch.

### F-142 · Every page told Google it was a duplicate of the homepage · P0

This is the largest single finding in this series, and it had been true the
entire time the authority work was being built.

The root layout declared:

```ts
alternates: {
  canonical: '/',
  types: { 'application/rss+xml': [ ... ] },
},
```

Next merges metadata from the root layout down into every page, and a page that
does not declare its own `alternates.canonical` inherits the parent's object
whole. Fetched from production, `https://ecowoods.ca/technical-library` served:

```html
<link rel="canonical" href="https://ecowoods.ca">
```

and so did `/blog`, `/case-studies` and `/products/floorforge`. That element is
not a hint or a preference. It is the page instructing a crawler: *I am a
duplicate of the homepage; index that instead of me.* Four surfaces, including
the two index pages that link to every article and every case study, were
asking to be dropped — and were.

Fourteen guards, `tsc`, and a production build passed every day it was true,
because **nothing in this repository had ever read a rendered `<head>`**. The
canonical was correct in fifteen files and absent in four, and absence was
indistinguishable from correctness at the source level. It is only visible in
the output.

Two guards now close it. `scripts/verify-canonical.mjs` fails if the root layout
declares a canonical at all, and requires each of the 25 public routes to
declare its own — the RSS `types` entry stays in the layout, because that one
genuinely is site-wide. `verify-live.sh` fetches seven routes from production
and compares the canonical each one serves against its own URL, because a guard
that reads source cannot see what a deploy actually renders.

### F-143 · Titles carried the brand twice, and one carried 130 characters · P2

The root template is `%s · Ecowoods`. Seventeen pages set titles ending in
`| EcoWoods`, so `/technical-library` rendered as:

> Technical Library | EcoWoods · Ecowoods

The papers were worse. `title` was built as `${paper.title} — ${paper.subtitle} |
EcoWoods`, and the template then appended the brand a second time:

> The Intelligent Homeowner's Decision Framework — How to choose hardwood that
> performs, appreciates, and never becomes a liability | EcoWoods · Ecowoods

A search result shows roughly sixty characters of that. The reader sees the
first half of a subtitle and never reaches the brand at all, which is the one
part that got written twice.

Same root cause as F-142, one level less severe: metadata composed in two places
by people who could never see the composed result. All seventeen now set the
bare title; `openGraph.title` and `twitter.title` keep the brand, correctly,
because a share card has no page around it to give it context. The brand check
lives in `verify-canonical.mjs` — same file, same class of bug, same fix.

### F-144 · The IndexNow submitter read two URLs that do not exist, and exited 0 · P1

`apps/web/scripts/notify-indexnow.mjs` opened with:

```js
const sitemaps = [`${SITE}/sitemap/0.xml`, `${SITE}/sitemap/1.xml`];
```

Next serves `/sitemap/N.xml` only when a sitemap route calls
`generateSitemaps()`. `app/sitemap.ts` does not — it serves one file at
`/sitemap.xml`. Both fetches were 404. The loop logged a `WARN` for each and
continued. `urls.length` was 0, and the script finished:

```js
console.error("No URLs found in sitemaps; skipping.");
process.exit(0);
```

Exit zero. Success.

It was also referenced by nothing — not `ship.sh`, not `package.json`, not a
workflow. A submitter nobody called, that could not have worked if called,
reporting success when it failed.

This is the third finding in a row with one shape: **the code was right and the
path was wrong.** F-131, a directory that was never served. F-138, a key file at
that same unserved path, which meant every IndexNow submission this site ever
made was rejected at ownership verification. Now a sitemap URL that does not
exist. In all three the logic reads correctly, `tsc` passes, every guard passes,
and the thing simply is not there.

IndexNow is the worst possible place for this, because it has no feedback worth
the name: a rejected submission and an accepted one look identical from here.
Nothing was ever going to tell us.

Rewritten. It reads `/sitemap.xml`; it verifies the key file is live **and that
its body equals the key** before submitting anything; it fails loudly on every
condition that means nothing was submitted; it chunks at the protocol's 10,000
URL limit; and it is called from `ship.sh`'s deploy line and `pnpm
notify:indexnow`.

One reversal worth naming: the key is no longer read from `INDEXNOW_KEY`. It is
read from the name of the route directory that serves it. The key is public by
construction — the entire ownership check is that anyone can fetch it at the URL
— so there was nothing to protect by putting it in an environment variable, and
one more unvalidated way for the whole path to be broken and look fine. The key
submitted and the key served are now the same fact rather than two facts kept in
sync by hand. `INDEXNOW_KEY` still overrides, for testing against another host.

`scripts/verify-indexnow.mjs` checks all five joins: exactly one key route, its
body matching its own directory name, no `process.env` in that route, a sitemap
path the sitemap route actually produces, and something that calls the
submitter.

### F-145 · The llms.txt proposal asks for two things and we served one · P1

`/llms.txt` has been served since F-23 and is a good index. The proposal (v2,
llmstxt.org) asks for a second thing, and it is the half that does the work:

> pages with information that agents might need provide a clean markdown version
> of those pages at the same URL as the original page, either with `.md`
> appended (`page.html.md`) or with the extension replaced by `.md` (`page.md`)

Without it, an agent that wants to quote this site has to fetch a Next.js page,
walk a DOM of layout wrappers, `tlx-` class names, nav chrome and a footer, and
guess which text is content. Every guess is a chance to attribute a navigation
label to a technical claim, or to drop the sentence carrying the qualification —
on a site whose entire strategy is being the thing that gets quoted correctly.

Now served: `/papers/{slug}.md`, `/guides/{slug}.md`, `/glossary/{slug}.md`, and
`/llms-full.txt` — the whole corpus, 70 KB, one fetch. `llms-full.txt` is *not*
in the spec; it is a de-facto convention, and it is here because an agent
answering a question about Toronto hardwood should not need eighty-seven
requests to find out what this site says.

Three things about how it is built, each of which is the point:

- **One source.** `lib/markdown-export.ts` renders the same manifests the HTML
  pages render. There is nowhere in it to type a sentence. A claim that is not
  in `papers.ts`, `guides.ts` or `glossary.ts` cannot appear, which is why
  `verify-business-facts` polices this edition for free.
- **Nothing is summarised.** Summarising is where an export starts making claims
  of its own.
- **Every file carries its own provenance** — canonical URL, publisher, contact,
  source paper and section, citation guide. A paragraph quoted out of one of
  these is still holding the URL it came from.

App Router cannot express `[slug].md`: a segment is wholly dynamic or wholly
literal. The URLs come from rewrites in `next.config.js`. That pattern was
checked against the `path-to-regexp` build Next actually ships rather than
assumed — `/papers/:slug.md` compiles to
`/^\/papers(?:\/([^\/#\?]+?))\.md[\/#\?]?$/i`, so `.md` is stripped from the
captured slug — because getting it wrong would have 404'd every advertised URL
while everything in the repository stayed green. That sentence has now been
written four times in this file.

`scripts/verify-markdown.mjs` requires every rewrite destination to resolve to a
handler on disk, every handler to prebuild and to send `text/markdown`, and
`/llms.txt` to name both editions — an advertised URL that 404s is worse than
one never offered, because it is the first thing an agent tries.
`verify-live.sh` fetches all four from production and fails if any returns HTML.

### F-146 · The schema identified six services by URLs that did not exist · P1

`lib/schema/builders.ts` has emitted, inside the LocalBusiness graph, one
`Service` node per entry in `SERVICES` since the file was written:

```ts
'@id': `${config.siteUrl}/services/${config.id}#service`,
```

There has never been a `/services` route. All six identifiers resolved to 404.

An `@id` is not decoration. It is the string a crawler uses to decide that two
mentions are the same entity. Six of them pointed at nothing, on the site whose
whole strategy is being an entity that resolves cleanly.

The footer was failing from the opposite direction at the same time: seven links
in its Services column — Hardwood Installation, Refinishing & Restoration,
Dust-Free Sanding, Custom Stain Matching, Stair Refinishing, Custom Inlays &
Borders, Commercial Projects — every one of them `href="/#services"`, an anchor
on the homepage. Seven of the highest-intent phrases this business could rank
for, with no URL of their own to rank, in the footer of every page.

One bug: the slug list and the route tree were never checked against each other.

Six pages now exist, and — this is the part that decides whether they are worth
publishing — **not one new claim is on them.** Every name and description is
`SERVICES`, already on the homepage. Every price band is `PRICING`, already
published, rendered as the full band rather than a starting-from number.
Everything else is a cross-link: the framework pillars the service is scored
against, the paper sections that establish the method, the decision guides that
say when this service is the wrong one, and the glossary terms the page uses.
The FAQ block is the `question` and `recommendation` of the linked guides —
published Q&A, cited back, rather than questions invented to fill a schema slot.

That constraint is the point. A service page that restates marketing copy
competes with ten thousand identical ones. A service page that says *here is the
band, here is the standard we are judged by, here is the paper, and here is the
guide that tells you not to buy this* is a different document, and this is the
only site in the niche equipped to write it.

`scripts/verify-services.mjs` checks slug parity in both directions, that both
routes exist, that the detail route prebuilds, that no footer link still points
at `/#services`, and that the `@id` template in `builders.ts` still matches the
route it was checked against.

### F-147 · `availability: 'PT10M'` — a duration in an enum field · P3

Every `Offer` built by `buildService` carried:

```ts
availability: 'PT10M', // 10 minutes response time estimate
```

`availability` takes a schema.org `ItemAvailability` enum — `InStock`,
`OutOfStock`, `PreOrder`. `PT10M` is an ISO 8601 duration: a valid value, for a
different property entirely. So it parsed as a string and was discarded by every
consumer, on six nodes, silently.

The intended meaning — a response-time estimate — is not a schema.org
availability, and this business publishes no service-level commitment that could
go there. So it is dropped rather than relocated into another property it would
also be wrong in. `availability` is now `https://schema.org/InStock`.

### F-148 · A fabricated `aggregateRating` was requested, and refused · P0

A proposed patch would have added to the LocalBusiness graph:

```ts
aggregateRating: { ratingValue: 5.0, ratingCount: 176 }
```

sourced from the HomeStars profile, with the stated goal of forcing review
snippets into search results. The same figure was to appear in three meta
descriptions and two page bodies.

It is not shipped, for two independent reasons, and the second survives even if
the first is resolved.

**It could not be verified.** The HomeStars profile is JS-rendered and could not
be read from here. That alone is disqualifying under the rule this project has
run on since the beginning — but it matters more than usual, because this exact
class of claim has already been retired once. `verify-business-facts.mjs`
permanently bans `348 verified reviews` at `4.9/5` "from Google, Houzz and
HomeStars combined", a figure that was published, was not true, and had no
traceable source. The cost of that was never the correction; it is that every
other number on the site became a thing a reader had to wonder about.

**It would not have worked, and would have cost the rest.** Google's
review-snippet documentation states both halves directly:

> "Don't aggregate reviews or ratings from other websites."

> "If the entity that's being reviewed controls the reviews about itself, their
> pages that use `LocalBusiness` or any other type of `Organization` structured
> data are ineligible for star review feature."

A HomeStars aggregate in `LocalBusiness.aggregateRating` on ecowoods.ca is both
at once. The stars were never available — the page type is ineligible by rule —
and the markup is the exact pattern that draws a structured-data manual action.
A manual action would not remove stars we could never have had. It removes
**every** rich result on the domain: the seven `HowTo` blocks on the papers, the
`FAQPage` blocks, the `Dataset` markup, the breadcrumbs. All of it, for a snippet
that did not exist.

What actually produces stars for a business like this is Google's own place
rating, read from the Business Profile — never marked up on the site by anyone.
That is `docs/outreach/review-request.md`, and it is why claiming the Business
Profile is the highest-value unfinished item on this project.

The HomeStars profile still does the work it can legitimately do: it is in
`PROFILE_LINKS`, so it appears in the organisation's `sameAs`, which is how
Google resolves that this entity and that profile are the same business. That is
the honest version of what the rating was reaching for.

Two adjacent items from the same proposal were also held back, and are recorded
with the rest in `docs/outreach/CLAIMS_REGISTER.md`: a hardcoded "26 years" —
`yearsInBusiness()` exists precisely because a literal goes stale on 1 January —
and unverified FSC-certification, adhesive-emissions and equipment-brand claims.

### F-149 · The live check made two requests and reported one conclusion · P1

`verify-live.sh` reported, against a deploy that was completely correct:

```
FAIL  /llms-full.txt    200, but does not contain complete technical corpus
```

The file was fine. Fetched independently, line 1 of `https://ecowoods.ca/llms-full.txt`
is exactly `# Ecowoods Inc. — complete technical corpus`. The corpus was
regenerated locally, byte for byte, and every grep in that check matches it.

**The check was wrong, not the deploy.** `md_check` did this:

```bash
BODY="$(curl -s -L --max-time 20 "$URL?$CB")"   # request A
STATUS="$(code "$URL?$CB")"                     # request B
```

Two HTTP transactions, one sentence assembled from both. When request A came
back short — a dropped connection on a 72 KB asset, first fetch after a deploy,
cold cache — and request B came back 200, the check announced that production
was serving a broken document.

Reproduced exactly. A local server that drops the body of its first response and
serves it correctly thereafter, run against the original function, prints:

```
FAIL  /llms-full.txt    200, but does not contain complete technical corpus
```

Character for character. Against the rewritten function, same server, same
dropped first response: `PASS  71975 bytes, markdown`.

**Why this is a P1 and not a cosmetic annoyance.** This file is the only thing in
the repository that can see a delivery failure. F-107, F-129, F-131 and F-140 all
passed every source-reading guard while production was broken; this script exists
because of them. A check that cries wolf in exactly that position is worse than
no check, because the next real failure gets waved through as "probably that
flaky one again". The value of this script is entirely its credibility.

**The fix, applied to every body-reading check in the file:**

- **One request.** `fetch <url> <outfile>` writes the body to a file and prints
  that same response's status. The two facts now describe one transaction.
  `md_check`, the canonical loop, the IndexNow key, the manifest, the paper and
  the sitemap were all converted; five of them had the same split, and the
  IndexNow key check had it on a 32-byte file, where "unlikely to drop" was the
  only thing protecting it — which is what the 72 KB one had too.
- **Failure modes are distinguished rather than collapsed.** "Could not be
  fetched", "HTTP 404", "200 with an empty body", "200 but HTML — the rewrite did
  not fire", and "200 but missing the marker" were all being reported as the
  last one. They are now five different messages, and the content mismatch prints
  the byte count and the first line as evidence.
- **Transport is retried; content is not.** `curl --retry 3` covers timeouts and
  transient 5xx. An empty body under a 200 is retried once, explicitly, because
  HTTP does not consider it an error and curl will not retry it — and because a
  health check that goes red on a single dropped connection is one people learn
  to ignore.
- **A failed fetch can no longer masquerade as missing content.** The manifest,
  paper and sitemap checks previously reported "no icon found", "none emitted"
  and "no `<loc>` elements" when what had actually happened was that the page did
  not come back at all.

Verified by running the whole script against two local fixture sites — one that
404s everything, one that serves plausible bodies — so every branch, including
all five new status paths, was executed in both directions before shipping.

There is nothing to fix on production. `d002e22` deployed correctly.

### F-150 · Fifteen of sixteen service-area pages were the same page · P1

`CITY_CONTENT` had an entry for `downtown-toronto`. The other fifteen published
areas — North York, Etobicoke, Scarborough, East York, York, Vaughan, Markham,
Richmond Hill, Mississauga, Oakville, Brampton, Aurora, Newmarket, Pickering,
Ajax — rendered the same generic paragraph with a place name substituted in.

Fifteen URLs in the sitemap, competing for fifteen local queries, by being one
page. That is the textbook definition of thin content and it is among the most
common reasons a service-area set sits indexed and unranked for months. Nothing
in the repository noticed: every one of those pages built, typechecked, returned
200, carried a correct self-canonical and appeared in the sitemap. Correctness
was never the problem. *Sameness* was, and no guard measured it.

All sixteen now carry local content, written under two rules that are what make
them publishable rather than filler:

- **Nothing about this business.** No job counts, no awards, no "we have served
  X families in Y since Z". Every sentence is either publicly checkable
  geography and housing stock, or a technical point already published in a paper
  on this site — in-situ slab moisture, remaining wear layer, acoustic assembly,
  acclimation in the actual conditioned room. Where a sentence would have needed
  a figure this site does not publish, it was cut rather than softened.
- **No `signatureProject` anywhere new.** It is the one field in `CityContent`
  that asserts a specific real job.

`scripts/verify-cities.mjs` holds the line: every published area must have an
entry, every entry needs a real intro, a real housing note and at least three
neighbourhoods, and **no two cities may share an intro or a housing note** —
because pasting one entry sixteen times would satisfy every other check and
recreate the exact failure.

Two things about that guard are worth recording, because both were mistakes it
made before it was right.

Its first version read single-quoted strings only. The one pre-existing entry,
`downtown-toronto`, is written with double quotes, so the guard reported a
zero-length intro, a zero-length housing note and no neighbourhoods — three
confident findings about content that was present and correct. A guard that
cannot read the code it polices is F-149 in a different file.

Its first version also failed `downtown-toronto` for declaring
`signatureProject`. That entry describes a real job, has been published for a
long time, and reads as a genuine account. A guard is not licence to delete
approved content because it belongs to a category that needs approval. It is now
a ratchet with a baseline — the published one stays, a new one fails the build
until someone adds the slug deliberately — which is the pattern
`verify-tokens` and `verify-schema` already use.

### F-151 · Six services claimed six different service areas · P2

`root-schema.ts` gave every service its own hand-written `areaServed` array, and
they disagreed:

| Service | Areas claimed |
|---|---|
| Installation, refinishing, dust-free sanding | 4 |
| Restoration | 3 |
| Stair refinishing | 3 |
| Custom inlays | **1** |

Nothing had ever decided that custom inlays stop at the Toronto city line. The
arrays were written at different times and never reconciled, while `CITIES`
carries sixteen areas, every one of which has a page, a sitemap entry and a
route that returns 200. The organisation node listed all sixteen by hand, so the
graph simultaneously claimed sixteen areas and, for inlays, one.

A proposed patch fixed the disagreement by hand-writing the same ten areas six
times. That corrects today's output and rebuilds the mechanism that produced it:
seven hand-maintained lists instead of six, still disconnected from the routes,
still free to drift, and now claiming ten of sixteen areas for no stated reason.

All seven are derived from `CITIES`. The graph cannot claim an area with no page
or omit one that has a page — the same rule `/services/[slug]` already followed.
`verify-cities.mjs` fails the build on any hand-written `areaServed` array here.

### F-152 · The keywords meta tag was about to be expanded · P3

A proposed patch moved eleven phrases into `metadata.keywords`, replacing the
five already there. Google published this in 2009 and has never revised it:

> "Google does not use the keywords meta tag in web ranking."

Bing gives it approximately nothing and has said a stuffed one can read as a
spam signal. The tag is, at best, bytes shipped to every visitor for no effect.

Both the five and the proposed eleven are gone. The phrases they were reaching
for live in `lib/alpha-keywords.ts` as a written record of what each surface is
aimed at, and they do their work in the `<title>`, the H1, the meta description
and the anchor text of internal links — the places that are actually read.

There is deliberately **no guard** asserting those phrases appear in the copy. A
check like that can only compare strings, and the useful version of "does this
page answer that query" is not a string comparison: it would pass a page that
stuffed the phrase and fail one that answered the question in better words.
Guards here exist where a machine can be right.

The homepage title changed with it, from `Ecowoods — Toronto's Master Hardwood
Flooring Artisans` — which led with a brand nobody is searching for yet and never
said *installation* or *refinishing* — to
`Hardwood Floor Installation & Refinishing Toronto · Ecowoods`, 60 characters.
It is set as the root layout's `title.default` and deliberately **not** on
`app/page.tsx`: `default` is used verbatim, while a title set on the page is run
through the `%s · Ecowoods` template. Setting both appends the brand twice and
pushes the string past seventy characters, which is F-143 again.

### F-153 · The agent corpus could not answer a local or commercial question · P1

`/llms-full.txt` carried papers, guides and glossary — the technical material —
and nothing else. `/api/knowledge` listed services with a name and a description
and **no URL**, and areas with a URL and **no content**.

So an agent asked *"who refinishes hardwood floors in Etobicoke"* fetched the one
file built for agents to read and found: no service, no price band, no area, no
local context. Every commercial and local surface on the site was invisible to
the machine-readable edition — and that is precisely the query class this
business exists to win.

The technical corpus is what makes the site citable. It is not what makes it
actionable. An answer engine that can quote the moisture protocol and cannot say
who does the work, what it costs, or whether they cover your city has been given
the half of the site that wins arguments and none of the half that wins jobs.

Now in the corpus, and each with its own `.md` companion at the URL the llms.txt
proposal specifies:

- `/services/{slug}.md` — the service, its published price band, the framework
  pillars it is judged against, the paper sections that establish the method,
  and the questions it turns on with the guide each answer comes from.
- `/service-areas/{slug}.md` — the local content, the neighbourhoods, the
  housing-stock constraint, and every service delivered there with its band.

`/api/knowledge` gains URLs and `.md` links on services, and the full local
content on areas. The corpus went from 70 KB to 115 KB, and not one sentence of
it is new: every line is rendered from a manifest that was already published.

### F-154 · 192 internal links existed as text and went nowhere · P1

The sixteen city pages rendered the six services as unlinked `<div>`s. The six
service pages rendered the sixteen areas as a comma-separated string.

That is 96 edges missing in each direction — the most natural internal links on
this site, local intent meeting a named service, written out in full and given
nothing to follow.

Internal links are not decoration. They are the only mechanism that tells a
crawler two pages are about related things, and the only route a reader has from
*I am in Etobicoke* to *here is what refinishing costs*. A page that names six
services without linking them is asking to be understood on faith. It also means
the six service pages — the highest commercial-intent URLs on the site, built in
patch 56 — had almost no internal links pointing at them, which is the single
worst thing that can be true of a page you want to rank.

Both directions are now rendered as links, and the city cards carry the price
band. `verify-cities.mjs` fails the build if either page goes back to prose.

### F-155 · Every 404 was a dead end · P2

There was no `not-found.tsx`. Every mistyped URL, every stale link from an old
post, every crawler following something that used to exist got Next's built-in
page: the words "404" and "This page could not be found", on a blank screen,
with no header, no footer, and not one link off it.

A person who lands there leaves. That is the obvious cost.

The one that matters more here: a crawler that lands there has spent a request
and received a page with zero outbound edges. And the requests most likely to
produce a 404 are old URLs from links other people published — arrivals carrying
the most external authority of anything that hits this site. Every one was being
converted into nothing.

The 404 now routes into the six services, the six reference hubs and all sixteen
areas, and says plainly that nothing published here has been removed — which is
true, and is the thing a person following a citation needs to know.

`robots: { index: false, follow: true }` is set deliberately, and is *not* what
makes it a 404 — Next serves the correct status for this file automatically. The
directive stops the page being indexed on the strength of its own content, which
it otherwise could be, now that it has plenty.

`verify-live.sh` checks both halves against production: that an unknown URL
returns 404 rather than a soft 200, and that the page it returns carries at
least ten internal links. A status code cannot tell you the second one.

### F-156 · The duplicate-content guard compared strings for equality · P1

`verify-cities.mjs` shipped with a check that no two service areas share an
intro or a housing note. It compared them with `===`.

That is a test almost nothing fails. Nobody pastes a block and ships it
byte-identical; they paste it and change the place name. A patch adding sixteen
Toronto neighbourhood pages did exactly that, three times, and every one passed:

| Pair | Field | Shared vocabulary |
|---|---|---|
| `yorkville` / `king-west` | housingNote | 77% |
| `east-york` / `leaside` | housingNote | 68% |
| `east-york` / `leaside` | intro | 61% |

The Leaside entry was the East York entry with the place name changed — which
is understandable, since Leaside is *in* East York, and which is precisely what
thin content looks like from a crawler's side. The guard written specifically to
prevent that saw two different strings and passed.

It now measures Jaccard similarity over words longer than three characters:
word order and connective tissue are ignored, and what is compared is whether
two entries are made of the same vocabulary. The threshold is 0.5. Two genuine
descriptions of two Toronto neighbourhoods land far below it; all three pairs
above are caught.

The three entries were rewritten to be about the places they name. Leaside is now
about a planned garden suburb built to one specification — which is true of
Leaside and not of East York, and is the reason a repair there can actually be
matched.

### F-157 · Sixteen Toronto neighbourhoods were about to be declared cities · P1

A patch added Rosedale, Forest Hill, Yorkville, Leaside, The Annex, High Park,
Riverdale, Leslieville, The Beaches, Lawrence Park, Cabbagetown, Swansea,
Davisville Village, midtown, King West and Liberty Village to `AREAS`.

That is the fastest way to give each one a page, and it would have worked. It
would also have put all sixteen into `LocalBusiness.areaServed` as
`schema.org/City` nodes, because F-151 made that list derive from `CITIES` —
so the entity graph would have stated that Toronto contains sixteen more cities,
and that Rosedale is a peer of Mississauga.

It is not an exaggeration a crawler forgives. It is a factual error in the one
part of the site whose entire job is to state things a machine can rely on
without checking, on a project whose own rule is that structured data describes
reality.

The pages are worth having — "hardwood flooring Rosedale" is a real query with
real intent, and the content written for them is specific and good. So the list
was split. `AREAS` stays municipalities and remains the only thing that becomes
a `City` node. `NEIGHBOURHOODS` is a second list that gets pages, local content,
sitemap entries and `.md` editions, and never touches the entity graph.
`SERVICE_AREAS` is the union, and every page-facing consumer reads that.

### F-158 · The IndexNow endpoint was an open relay · P2

`POST /api/indexnow` accepted a list of URLs from anyone and submitted them to
Bing, Yandex, Seznam and Naver **signed with our ownership key**.

The blast radius is bounded — the protocol only accepts URLs on our own host —
but it is not zero. An attacker could exhaust our submission quota, repeatedly
push URLs we do not want prioritised, and give the receiving engines a pattern
of behaviour attributable to us that we did not choose.

A proposed fix compared the caller against `process.env.INDEXNOW_KEY`. That
variable is not set in this deployment and deliberately is not: F-144 removed
the submitter's dependence on it, because the key is public by construction —
the whole ownership check is that anyone can fetch it at `/<key>.txt` — and
hiding a public value in an unvalidated env var only creates another way for the
path to be broken while looking correct.

With it unset, that comparison rejects every caller, including us. Safe, but by
accident, and it would have looked like a working endpoint.

The route now reads the key from the directory that serves it, exactly as
`notify-indexnow.mjs` does. So does `lib/indexnow.ts`, which had the same env
dependency and would have returned `false` for every runtime submission — the
route would have authenticated correctly and then submitted nothing.

A public key is not authentication in any real sense. It raises the cost of
casual abuse from zero to "read the docs first", on an endpoint whose worst case
is a wasted quota. Nothing that genuinely needs protecting sits behind it.

### F-159 · One comma, invisible to every check, breaks the corpus · P0

A patch adding five guides left this in `lib/guides.ts`:

```ts
    pillars: ['containment'],
  },
,                                    ← this

  { slug: 'hardwood-flooring-cost-toronto', ...
```

A bare comma between two elements of an array literal is not a syntax error. It
is a **sparse array**: legal JavaScript, legal TypeScript, and invisible to
every tool in this repository.

- `parse-scan.mjs` parses it and reports **zero diagnostics**. It is valid.
- `tsc --noEmit` typechecks it. `Guide[]` permits a hole.
- `next build` compiles it.
- Every guard reads the right number of guides, because `.filter()` and `.map()`
  **silently skip holes**.

And then it fails at the one place that does not skip:

```ts
for (const g of guides) out.push(guideToMarkdown(g));
// TypeError: Cannot read properties of undefined
```

That is `corpusToMarkdown()`, so the failure lands while building
`/llms-full.txt`. `JSON.stringify` on the same array emits `null` into
`/api/knowledge`, and `guides.length` counts the hole, so `/llms.txt` would
advertise one more guide than exists.

One character, past four separate checks, taking out the machine-readable corpus
that F-153 was written to complete.

`scripts/verify-manifests.mjs` reads the thirteen hand-edited manifests, blanks
comments and string literals while preserving offsets, and fails on `,` followed
by `,` or `[` followed by `,`. A trailing comma before `]` is fine — that
creates no hole and is normal style.

Its first version blanked string literals to **spaces**, which turned
`['a', 'b']` into `[   ,    ]` and made every comma in every manifest look like
a hole. It reported 532, all false. Strings are now filled with `x` instead, so
a literal still reads as a value sitting between its commas. A guard is not
finished when it fires; it is finished when it fires only on the thing it is
named for — which is the third time that lesson is recorded in this file
(F-149, F-150, now this).

### F-160 · The rate limit could have destroyed the lead it was protecting · P0

A patch added a rate limiter to `POST /api/leads`. Five requests per minute per
IP, placed **before validation and before the durable log**. Both placements
break the one invariant this project has: *the lead must never be lost*.

**Before validation.** A request that fails validation is still a request. A
customer correcting a phone number, then a postal code, then a typo has spent
three of five. The fourth correction is the one that would have succeeded. The
fifth is a hard 429. We would have rate-limited someone for trying to give us
money.

**Before the durable log.** A 429 wrote nothing anywhere, so a real lead caught
by a false positive left no trace at all. And false positives are not exotic
here: one office, one condo building, one school, or any mobile carrier using
CGNAT presents a single IP for hundreds of people. Five per minute across a
whole building is a plausible Saturday afternoon.

Reordered. Honeypot first — bot traffic must not consume a real visitor's
allowance. Then validation. Then the durable `lead.captured` log. **Then** the
limit, raised to twenty per minute, and a rejection now writes a
`lead.rate_limited` line recording that the lead is already recoverable from the
line above it.

The worst a false positive can now do is inconvenience someone. It cannot erase
them.

### F-161 · A CSP that would have broken the analytics silently · P2

A proposed Content-Security-Policy shipped as one enforcing header with:

```
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://va.vercel-scripts.com
```

`CookieConsentBanner.tsx` injects `https://www.googletagmanager.com/gtag/js` and
`https://connect.facebook.net/en_US/fbevents.js` after a visitor opts in.
Neither origin is listed, so both would have been blocked — **for consented
users only**, which is the hardest failure mode to notice, on the exact
instrumentation needed to measure whether any of this work produces business.

It also would not have bought much. A `script-src` carrying both
`'unsafe-inline'` and `'unsafe-eval'` stops very little XSS, because those two
directives are what the attack needs. Real breakage risk, near-zero security
gain.

It now ships as two headers, which is how CSP is introduced to a site that takes
money:

- **Enforced** — `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
  `frame-ancestors 'self'`. None can break a working page, and each is real:
  `base-uri` stops an injected `<base>` rewriting every relative URL, and
  `form-action` stops an injected form posting the lead form's contents
  somewhere else.
- **Report-Only** — the full policy, with the origins actually in use. Browsers
  evaluate it and report to the console without blocking. Load the site, accept
  cookies, submit the form, read the console: what appears is what enforcing it
  would have broken. When it is silent, the directives move to the enforced
  header.

### F-162 · The organisation's logo and image were both 404 · P0

`root-schema.ts` declared, and `structured-data.ts` repeated:

```ts
logo:  https://ecowoods.ca/icon-512.png
image: https://ecowoods.ca/og-image.jpg
```

Fetched from production, **both return 404.**

`icon-512.png` exists — only in `apps/web/public`, the directory this
deployment has never served. That was established by measurement in F-131 and
is asserted on every single run of `verify-live.sh`, which prints
*"/icon-192.png still 404 — apps/web/public unserved, as expected"* at the
bottom of every deploy. The fact was known, printed, and never connected to the
two URLs in the schema that depended on it.

`og-image.jpg` is worse: it does not exist anywhere in the repository. Not in
`public/`, not in `apps/web/public/`, not in `app/`. The site has claimed an
image that was never created.

These are not decorative fields. `logo` on the Organization node is what Google
reads to attach a brand mark to a Knowledge Panel and to the brand's appearance
in search results. A 404 there is not a smaller logo — it is no logo, on the
single most important structured-data object the site emits, for the entire life
of the project.

And every validator passed it. That is the part worth internalising: a
structured-data validator checks that a URL is **well-formed**. It never asks
whether it **resolves**. Nothing but a fetch can tell you, and until now nothing
fetched.

Fixed the way F-129 and F-131 were fixed, because that mechanism is already
proven on this host: static imports. `lib/brand-assets.ts` imports both files
and derives the URLs from what the bundler emits, so a missing file fails the
build instead of failing the Knowledge Panel. The 512×512 logo did not need to
move — it needed to be imported rather than linked. Google's Organization logo
guidance asks for at least 112×112; it is 512. The OG image is 1200×630.

`scripts/verify-assets.mjs` scans the schema and metadata layer for absolute
asset URLs and requires each to resolve somewhere actually served — repo-root
`public/`, a Next metadata convention in `app/`, or a route handler — and fails
outright on any path into `apps/web/public`. `verify-live.sh` now pulls the
`logo` value out of the rendered homepage and fetches it.

This is the fourth finding of one shape. F-131: a directory never served.
F-138: a key file at that path. F-144: a sitemap URL that does not exist. Now
the brand logo. The code was right every time; the path was wrong every time.

### F-163 · The banned-claims regex was defeated by a hyphen · P2

`verify-business-facts.mjs` has banned `/Semantic Density/i` since it was
written — *"Not a measurable quantity; presented as a credential."* It was a
self-assigned 1-to-10 score with no method behind it.

Every published article and case study still carried it:

```yaml
semantic-density: 9
```

The key is hyphenated, so the pattern never matched. Eleven content files, both
content loaders, and both type definitions still carried a claim this repository
had formally retired — one rename away from being rendered again.

The pattern is now `/semantic[ _-]?density/i`, and the field is gone from the
frontmatter, the loaders and the types rather than exempted.

Broadening it immediately exposed a second defect in the same guard: it read the
comment explaining the removal as a violation of the rule it documents. That is
F-58 and F-106 for the third time, now in the guard those findings were about.
Comments are stripped in **code** files only — Markdown and text are content,
where a line starting `//` is something a reader sees and must still be checked.

### F-164 · Eleven articles, no image, no rich-result eligibility · P1

`article.image` is optional in the content model, and **not one** of the six
articles or five case studies sets it. So every `Article` node shipped without
an `image` field.

Google's article rich results require an image. Without one the page is
ineligible — not ranked lower, ineligible — and nothing reports it, because the
markup is otherwise valid and the field is optional in schema.org.

The Article schema now falls back to the site's Open Graph image, which is
honest: it is this site's image, 1200×630, and it is already what a share of the
page displays. That makes all eleven eligible today rather than after someone
photographs eleven posts. A `hero-image` in the frontmatter still wins where one
is set, which is the upgrade path.

### F-165 · Three public route families were never checked in production · P2

`verify-live.sh` checked fourteen pages, the machine surfaces, the service pages
and the markdown editions. It never checked `/blog/*`, `/case-studies/*` or
`/design`.

Two of those are the content collections — eleven pages carrying the `Article`
and `CaseStudy` schema, the evidence layer the whole authority argument rests
on. A broken article would have been invisible to every check in this
repository, which is precisely the gap this file exists to close.

Now checked: both collection indexes, one article, one case study, the
configurator, `/services`, `/service-areas`, a municipality page and a
neighbourhood page.

### F-166 · The fix for F-162 was never read, and the guard could not see it · P0

F-162 changed `root-schema.ts` so the organisation's `logoUrl` came from an
imported file instead of a hand-written path. `verify-assets.mjs` went green.
`tsc`, twenty-two guards, `parse-scan` and the production build all passed. The
patch shipped.

The deployed homepage kept serving the same 404 it had served all along.

Two lines in `buildOrganization`:

```ts
image: config.ogImageUrl,          // reads the config
logo:  `${baseUrl}/icon-512.png`,  // ignores it
```

`image` honoured what the caller passed in. `logo` hardcoded the path and
discarded `config.logoUrl` entirely. So F-162 corrected the value at the one end
that was never read. Both lines look completely plausible in isolation, which is
exactly why an asymmetry like that survives being looked at.

**And the guard written to catch this could not see it.** `verify-assets.mjs`
matched `${SITE_URL}/…` by name. The bug was spelled `${baseUrl}/icon-512.png`.
It reported *"0 claimed URL(s), all served: none"* — technically true, entirely
useless, and indistinguishable from success. A guard that recognises only one
spelling of the thing it polices reports clean and means nothing. That is the
third time this has been written down here: F-117 (a check that could never
fire), F-149 (a check that misread its own input), now this.

The pattern now matches any interpolation followed by a path, whatever the
variable is called, and the scan covers every file under `lib/schema` and
`lib/graph` rather than a hand-listed seven.

**What actually caught it:** the live check added in the same patch as the bug,
on its first run against production —

```
── brand assets the entity graph claims
  FAIL  Organization logo bytes   got 404, want 200
        https://ecowoods.ca/icon-512.png
```

It pulls the `logo` value out of the rendered homepage and fetches it. Not the
source. The output. Twenty-two guards agreed the repository was correct, and
they were all reading the same wrong thing; one fetch of what a crawler actually
receives disagreed, and it was right.

That is the whole argument for `verify-live.sh`, demonstrated on the patch that
extended it, against a bug introduced by the patch that fixed the finding it was
written for.

### F-167 · The company logo was not an image on the internet · P0

`lib/brand.ts` exported the brand mark as a 14,545-character base64
`data:image/png` string. `Header.tsx` and `SiteFooter.tsx` rendered it like
this:

```tsx
<span className="brand-mark" aria-hidden="true">
  <img src={EW_MARK} alt="" … />
</span>
```

**A data URI has no URL.** It cannot be crawled, indexed, linked, shared, hotlinked, or fetched. Google Images could not find this company's logo because,
as far as the internet is concerned, the logo did not exist — it was a string
inside a document. And the two attributes around it, `alt=""` and
`aria-hidden="true"`, told the one crawler that did parse the tag to ignore it
deliberately.

That is the complete answer to "why can't Google find our images". Not a
robots rule, not a crawl budget, not a missing sitemap. The logo was never a
file at an address.

Three more things were true at the same time:

- **14.5 KB of base64 shipped inside every HTML response.** Uncacheable by
  construction, re-sent on every navigation, ahead of the content in the byte
  stream, on every page of the site.
- **`apps/web/public/brand/` held three real brand files** —
  `ecowoods_logo_EW_1.jpg`, `ew-mark.png` (1024×1024) and `ew-mark-cream.png` —
  in the directory this deployment has never served, referenced by **zero lines
  of code**. The actual logo files were both unreachable and unused.
- **The Organization schema logo was the favicon.** F-162 pointed it at
  `icon-512.png`, which is correct, served, and not the brand mark.

Fixed:

- The mark is a file at `/brand/ew-mark-192.png` — the REPO-ROOT `public/`
  directory, which is served, measured not assumed (`/qr-app.jpg` has always
  returned 200 from there while `apps/web/public` has always returned 404).
  Byte-identical to what the data URI decoded to, so nothing on the page moves.
- A stable, human-readable path rather than a hashed one, deliberately: a logo
  is the asset other people link to — press, profiles, directories, and Google's
  own Organization logo field.
- Real `alt` text, `aria-hidden` removed, intrinsic `width`/`height` so
  reserving the box costs no layout shift.
- `LOGO_URL` is now `/brand/ew-mark.png`, the 1024×1024 square master — well
  past Google's 112×112 minimum, and the file to hand anyone who asks for the
  logo.
- `apps/web/public/brand/` is **deleted**. One copy, in the served location. Two
  copies in two directories, one of which is invisible, is how this started.

### F-168 · Twenty-eight diagrams, undiscoverable as images · P1

Every illustration, floor photograph and machine photograph on this site is
rendered through `next/image`, which produces a hashed
`/_next/static/media/…` URL. Nothing anywhere listed those URLs.

Google's image-sitemap documentation states the mechanism exists for exactly
this: *"telling Google about other images on your site, especially those that we
might not otherwise find (such as images your site reaches with JavaScript
code)."*

So twenty-eight technical cross-sections — drawn for this site, trimmed,
tracked, bundled, published under CC BY, verified live at byte level in F-131 —
were invisible to image search. The work that proved they were *served* never
asked whether they were *findable*.

`sitemap.ts` now declares them, derived from the same static imports the pages
render, so a sitemap entry cannot point at an image a page does not show. Only
`<image:image>` and `<image:loc>` are emitted: Google has removed support for
`<image:caption>`, `<image:title>`, `<image:geo_location>` and `<image:license>`,
and emitting them would be markup pretending to be data.

`verify-sitemap.mjs` fails if the `images` field or either URL source
disappears. `verify-live.sh` counts `<image:loc>` in the deployed sitemap and
fetches the brand files.

One correction to `verify-assets.mjs` came out of this. It tested
`apps/web/public` **before** asking whether a path resolves somewhere served, so
a file present in both locations — which is exactly what copying the brand
assets produced — was reported as a 404 it demonstrably was not. Served location
wins; the unserved-directory message is now only for files that exist *only*
there.

### F-169 · The entity was never stated in the shape the question is asked · P1

Every fact needed to answer *"who is Ecowoods"*, *"how long have they operated"*,
*"do they subcontract"*, *"what does it cost"* was already published somewhere on
this site. Not one of them was stated as an answer.

The homepage said *"Hardwood, Done Once. Done Right."* and *"Experience the
Ecowoods difference."* A retrieval system had to infer the entity from marketing
prose and hope the inference held.

That shape matters more than it used to. An answer engine retrieves **passages**,
not pages. A sentence beginning *"Ecowoods Hardwood Flooring Inc. is a hardwood
flooring contractor in Toronto & the GTA, established in…"* survives being lifted
out of its page and quoted. A sentence beginning *"We believe"* does not survive
anything.

`/about` now answers eleven questions, one self-contained paragraph each, in the
words the questions are actually asked. Rendered visibly, emitted as `FAQPage`
and `AboutPage` pointing at the organisation node, carried in `/llms.txt`, the
`.md` corpus and `/api/knowledge`.

**The rule that makes it publishable, and the reason it needed its own guard:**
not one answer contains a fact that was typed. Every value is interpolated —
`${BUSINESS_NAP.foundedYear}`, never `2000`; `${yearsInBusiness(now)}`, never
`26`; the price bands from `PRICING`, never a number. There is nowhere in the
file to invent anything.

That property is not cosmetic here. This is the page an answer engine is most
likely to quote verbatim and cache. A stale year in a marketing paragraph is
embarrassing; a stale year in a sentence a model repeats for a year is a
different problem — and this project has already retired one fabricated
reputation figure (F-163) and banned one hardcoded year count that goes stale
every 1 January.

`scripts/verify-entity.mjs` fails the build on a literal year, currency amount,
year count, phone number or percentage inside any answer string, and on the file
ceasing to reference the constants it derives from. Interpolations are blanked
before matching, so the correct form passes and only the typed form fails. All
five classes were verified by injection.

### F-170 · Six certification claims are live and unsourced · P2 · owner action

Not introduced by this work — they predate all of it, and they are on the
homepage today:

- "FSC-Certified Eco Materials"
- "GreenGuard Gold"
- "water-based ≤50 g/L VOC finishes"
- "zero-formaldehyde adhesives"
- "many with us 10+ years"
- "99.7% dust capture" (already baselined as an unsourced number)

FSC chain-of-custody and UL GREENGUARD Gold are formal certifications held
against public registers. The wording here claims the **materials** are
certified rather than the company, which is the defensible form — a contractor
buying certified product, not holding certification themselves — but it still
requires the supplier's certificate number and product lines on file to answer a
challenge in one move.

Recorded in `docs/outreach/CLAIMS_REGISTER.md` rather than removed. The point is
not that they are false; it is that this site now publishes a great deal that is
verifiable — the framework, the standards register with verification dates, the
price bands, three technical papers — and these six are the remaining sentences a
sceptical reader could challenge and we could not immediately answer. Product
names and certificate numbers turn six weak claims into six strong ones.

### F-171 · The visual upgrade package is integrated · P1 · fixed

All 18 images from `ecowoods-visual-upgrade-resources-framework.zip` are live.
Fifteen replace existing diagram slots; three are new slots.

**Placement**, from the package's own `00-MANIFEST.md`:

| package file | slot | renders on |
| --- | --- | --- |
| `00-hero-framework` | `framework-hero` *(new)* | `/framework`, under the masthead |
| `pillar-1-moisture-acclimation` | `pillar-moisture` | `/framework#moisture` |
| `pillar-2-substrate-method` | `pillar-substrate` | `/framework#substrate` |
| `pillar-3-product-specification` | `pillar-specification` | `/framework#specification` |
| `pillar-4-expansion-movement` | `pillar-movement` | `/framework#movement` |
| `pillar-5-dust-containment-sequence` | `pillar-containment` | `/framework#containment` |
| `pillar-6-commercial-accountability` | `pillar-accountability` | `/framework#accountability` |
| `failure-cupping` | `failure-cupping` | `/glossary/cupping` |
| `failure-crowning` | `failure-crowning` | `/glossary/crowning` |
| `failure-buckling-tenting` | `failure-buckling` | `/glossary/buckling` |
| `failure-seasonal-gapping` | `failure-gapping` | `/glossary/seasonal-gapping` |
| `failure-edge-peaking` | `failure-edge-peaking` *(new)* | `/glossary/edge-peaking` |
| `failure-swirl-marks-halos` | `concept-edger-halo` | the refinishing paper |
| `detail-moisture-differential` | `concept-mc-differential` | `/glossary/moisture-differential` |
| `00-hero-resources` | `resources-hero` *(new)* | `/resources`, under the masthead |
| `decision-solid-vs-engineered` | `guide-solid-vs-engineered` | the solid-vs-engineered guide |
| `paper-craft-four-machines` | `paper-craft` | the machines-and-sequence paper |
| `paper-climate-humidity-bands` | `paper-climate` | the climate paper |

**Resolution.** The package shipped at 1168x784 and its own manifest asked for
an upscale to ≥1600px before commit. Done: every file is now 1600x1074, Lanczos,
WebP q82. 2.75 MB across 18 files, and `DIMS` in `apps/web/lib/images.ts`
declares 1600x1074 for all of them so `next/image` reserves the right box and
nothing reflows on load.

**A second visual register, declared rather than smuggled.** The manifest now
carries two languages instead of one:

- `d(...)` — the original flat vector diagrams. `STYLE_SUFFIX` still forbids
  photorealism and text, and `verify-images.mjs` still enforces that on this
  register only.
- `p(...)` — the detailed labelled renders. `DETAIL_STYLE_SUFFIX` describes what
  they actually are: photorealistic, high micro-detail, labels set inside the
  frame. Every `p` entry is `kind: 'illustration'` — generated, declared as
  generated, never `photograph`, which would require a provenance naming a real
  shoot and would forbid a prompt.

Two guards were added rather than removed, because the labelled register creates
a risk the flat one did not:

1. **Every `p` entry must carry a caption of at least 40 characters.** A label
   baked into a picture is invisible to a screen reader, a translator and every
   crawler. The rule is now that no fact may live *only* inside an image — the
   caption beside it is the machine-readable copy, and the build fails without
   one. All 18 captions restate what their image says.
2. The `NO TEXT` prompt check is scoped to `d` entries, so it still means
   something where it applies instead of being globally waived.

**Two wordings were made precise rather than dropped.** `pillar-moisture` and
`concept-mc-differential` show meter readings of 8.2% and 7.4%. Their captions
now say the values are a worked example and that the acceptable difference
between them is the manufacturer's and ours — which is what
`apps/web/lib/papers.ts:104` already says in prose. `pillar-accountability`
shows an estimate document; its caption says the document is illustrative. The
images are unchanged; the captions simply stop them reading as a record of a
specific job.

**Still open:** `00-hero-framework` names its six pillars MOISTURE CONTROL,
PLANNING & DOCUMENTATION, EXPANSION & ACCOMMODATION, PROPER MACHINES & TOOLS,
MATERIAL & SUBFLOOR PREP and QUALITY ASSURANCE, and stamps "VERSION 1.0 • MAY
2024". `apps/web/lib/framework.ts` names them Moisture and acclimation,
Substrate and method, Product specification, Expansion and movement, Dust
containment and sequence and Commercial accountability, published `2026-08-19`.
The six `<h2>` headings immediately below the hero are rendered from those
constants, so the page shows both wordings. The hero's caption points the reader
at the panels below as the authoritative names. Regenerating that one image with
the framework's own wording and no date stamp closes it.

`docs/visual/DIAGRAM_BRIEF.md` records the specification either register has to
meet, so the next batch — the package lists twelve slots it did not cover — lands
without a second integration pass.

### F-175 · The review count existed nowhere a machine could read it · P0 · fixed

In August 2026 an AI agent was asked to rank Toronto hardwood contractors and
left this company off the list entirely. Asked why, it gave an unusually precise
answer, and it is worth quoting because it names the defect better than any audit
here has:

> my first search/recommendation process was too dependent on the local-business
> results surfaced by the search index, and EcoWoods has a relatively small
> footprint there: the business listing currently shows only 19 reviews, despite
> HomeStars showing 174 reviews at 5/5.

Half of that is not ours to fix — the Google Business Profile carries 19 reviews
and only customers can change that number. **The half that is ours is worse than
it looks: a machine could read every page on this site and never learn the review
count.** The footer linked HomeStars. The homepage said reviews live there.
Neither said *how many*, and a number nobody states is a number nobody can
retrieve. `sameAs` already asserted that the profile is this entity — but
`sameAs` carries no figures.

So the agent had a link it did not follow and no reason to follow it. That is the
entire failure, and it was one page's worth of work away from not happening.

**Verified from the source, 2026-08-22:** the HomeStars profile shows
**177 reviews at 5.0/5**, most recent **2026-08-10**. (The agent's 174 was
already stale — the profile is growing.)

**Fixed:**

- `REVIEW_EVIDENCE` in `packages/shared/constants/index.ts` — platform, direct
  link, rating, count, the date a person read it, and the date of the newest
  review visible then. One source of truth, every field dated.
- **`/reviews`** — a real page stating the figure, naming the platform, linking
  straight to the reviews, and dating the reading. It also explains the platform
  split honestly, because the gap is our fault and saying so is more credible
  than hiding it.
- Two entity answers on `/about` and in the machine editions: *how many reviews
  does Ecowoods have and where*, and *why are there no stars in search results*.
- The route is in the sitemap with `lastModified` set to `asOf` — a real date,
  not a build timestamp (F-141).

**What this deliberately is not.** There is no `aggregateRating`, and there never
will be. Google is explicit that reviews must not be aggregated from other
websites and that a business rating itself is ineligible for the star feature.
The 177 is a *cited* figure — number, source, link, read date — the way a
publication quotes a statistic. The difference between citing a number and
claiming it as structured data is the whole difference between publishing and
manufacturing, and this project has now refused the second one four times.

**A loaded gun found while doing this.** `buildProduct` in
`apps/web/lib/schema/builders.ts` carried a live branch that emitted
`aggregateRating` whenever a config supplied `ratingValue` and `ratingCount`.
Nothing passed them, which is exactly what made it dangerous: it sat behind a
truthy check, so the first person to add a rating field would have switched on a
self-serving AggregateRating in the one file nobody re-reads. Removed.

**Guarded** by `scripts/verify-reviews.mjs` (the twenty-fourth guard), which
fails the build on: any `aggregateRating` object literal in `apps/web/lib` or
`apps/web/app`; a review count typed as a literal anywhere outside the constant;
an `asOf` in the future; a `latestReviewAt` after its `asOf`; a rating above its
own scale; or an href that looks like a platform home page rather than a profile.
Comments are stripped before matching, so the repo can keep explaining *why* it
refuses aggregateRating without the guard flagging the explanation — that is
F-58 / F-106 / F-163 for the fourth time and it is not happening again.

### F-176 · Five case studies published private home addresses · P0 · fixed

Every case study in `apps/web/content/case-studies/` named a specific Toronto
residence — 89 Russell Hill Road, 142 Scrivener Square, 316 Davenport Road,
87 Yorkville Avenue Unit B2, 51 Mill Street Unit 604 — with latitude and
longitude, presented as a completed project, with nothing marking them as
illustrative.

That is unacceptable in both directions and there is no third option:

- **If the projects are real,** a client's home address and coordinates are
  published with no evidence they agreed to it — and the neighbourhoods involved
  are precisely the ones where a homeowner would object.
- **If the projects are not real,** these are fabricated records carrying real
  addresses, which is the defect the project's own directive named ("Do not
  create fake case studies") attached to somebody's actual house.

It was not confined to frontmatter. `buildCaseStudySchema` emitted
`streetAddress: config.location.address` inside a `PostalAddress`, so the
addresses were being handed to every crawler as machine-readable data. The block
also typed a private residence as `LocalBusiness`, inviting the entity graph to
resolve someone's home as a commercial entity.

**Fixed:** `address` and `coordinates` are gone from the type, the loader, the
five content files and the schema. Location is now neighbourhood, city, province,
and the schema node is a `Place`. Nothing about local search is lost — the
neighbourhood was doing all of that work already. "Rosedale hardwood" is a query.
"142 Scrivener Square hardwood" is not.

**Still open, and it is not a code question:** whether these five projects
happened. The addresses are gone either way, but a case study that describes work
nobody did is a fabricated citation no guard here can detect, and this site's
entire position rests on everything tracing to something real. Confirm the five
against job records, or mark them as composite illustrations.

### F-177 · A typecheck that checked nothing · P1 · process

Patch 67 was delivered reporting a clean typecheck. It had five type errors, and
`ship.sh` caught all five at step 4/7 — which is the system working. The reason
they were not caught before delivery is worth writing down, because it is the
same shape as F-117, F-149 and F-166.

The pre-delivery check ran `npx tsc --noEmit`. `npx` resolved a TypeScript
version newer than the repo's pinned 5.6.3, that version rejects the workspace
`tsconfig.json` outright (`TS5101: Option 'baseUrl' is deprecated`), and it exits
**before checking a single file**. Total output: one line about a config option.
Read quickly, an almost-empty output looks exactly like success.

Two compounding mistakes:

1. The check was run against a clone that had never had `pnpm install`, so there
   was no pinned compiler to find and `npx` silently fetched a different one.
2. It was run *before* the last two edits, and the result was reused afterwards.

The rule, and it is not new: **verify with the repository's own toolchain, and
verify after the last edit, not before it.** `node_modules/.bin/tsc`, never
`npx tsc`. An empty error list from a compiler that never compiled is not a
passing check — it is F-149's empty 200 in a different costume.

The five errors themselves were real and are fixed at the type level rather than
cast away: `PostalAddress.streetAddress` and `.postalCode` are now optional
(schema.org does not require them, and F-176 says a case study must not carry
one), a `PlaceEntity` type was added so `about` can be a house instead of a
business, `CaseStudyConfig.location` lost `address` and `coordinates` to match
the content type, and the sitemap builds a real `Date` the same way
`changelogDate()` does.

Verified afterwards with the pinned compiler: 111 errors in the workspace, every
one traceable to the Prisma client being ungeneratable in this sandbox
(`binaries.prisma.sh` is blocked), and **zero in any file this patch touches**.
