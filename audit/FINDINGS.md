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
