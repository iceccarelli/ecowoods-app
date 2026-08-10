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
