# EcoWoods — Deferred

**Base commit:** `fe85677bf4fd7af0f088dfa1cf78025bda149714`

Three categories: questions that need a decision from the repository owner,
verification that could not be run in this environment, and work deliberately
placed outside this patch series.

---

## 1. Questions that need an answer before code moves

### Q1 — Is `/authority` a separate surface, or a broken page? (blocks Phase 4)

`/authority` is styled entirely in stock Tailwind `stone-*`/`amber-*` utilities
with 55 `dark:` variant uses, wired to `prefers-color-scheme` rather than the
site's `data-theme` toggle (F-03). Two defensible answers:

**(a) Migrate it onto brand tokens.** It becomes part of the marketing site,
honours the theme toggle, and reads as EcoWoods. Cost: a full rewrite of one
page's markup, ~350 lines, and it is the page whose whole purpose is to look
authoritative — so the rewrite must be good, not merely token-compliant.

**(b) Keep it visually distinct but fix the theme wiring.** Add
`darkMode: ['selector', "html[data-theme='dark']"]` to `tailwind.config.ts` so
`dark:` follows the site toggle. Cost: one line. Does not fix the palette drift,
and leaves two design languages on the marketing site.

**There is a third thing (b) does on its own that is worth knowing:** it is a
global config change, so it would also affect `RelatedContent.tsx` and any future
`dark:` usage. That is an argument for doing it regardless of the answer to (a).

I am not deciding what this brand looks like. **Rule 6 of the brief applies.**

### Q2 — Whole-card hover, or inner-link hover?

Cards appear in at least six namespaces (`.tlx-card`, `.pfd-card`, `.service-card`,
`.price-card`, `.gc-*`, `.portal-list-item`). Some lift the entire card on hover,
some highlight only the link inside. Both are valid; mixing them on one site is
not. Phase 5 needs one answer applied everywhere. This is a taste call, not a
technical one.

### Q3 — Keep the hand-tuned type scale, or regularise it?

`--fs-3xs` through `--fs-xl` are eight hand-picked pixel values with step ratios
from 1.077 to 1.200, not a modular scale. `DESIGN_SYSTEM.md` §2.1 recommends
keeping it and documenting it, on the grounds that regularising a working scale
is churn with a visual blast radius and no customer benefit. The brief's Phase
1.4 asks for "a deliberate ratio," which could be read either way. **Confirm
before Phase 1 touches type.**

### Q4 — What replaces the Unsplash hero photo?

F-06 establishes that `globals.css:910` loads a 2400px third-party stock photo as
the homepage LCP element. Removing it is straightforward; **replacing it is not a
design decision I can make** — it needs a real EcoWoods photograph. There are
images in `apps/web/public/images/gbp/` and `public/gallery/`. Which one leads
the homepage is a brand call.

Until that is answered, Phase 9 cannot close its LCP item.

---

## 2. Could not be verified in this environment

Everything here is unmet Phase 0 scope, not a judgement that it does not matter.

### 2.1 No browser

Playwright's CLI is installed in the audit environment but the browser binaries
cannot be downloaded (host not in the egress allowlist); `chromium.launch()`
fails with `ERR_MODULE_NOT_FOUND`. Consequently:

| Not run | Blocks | Ready to run |
|---|---|---|
| Screenshots — every route x 10 viewports x 2 themes | Phase 0 capture, Phase 4 header/footer proof | `runtime-audit.mjs --shots` |
| Horizontal-overflow sweep | Phase 6, acceptance criterion 6 | `runtime-audit.mjs` |
| axe-core, every route, both themes | Phase 7, acceptance criterion 7 | `runtime-audit.mjs` (needs `@axe-core/playwright`) |
| Tap targets ≥ 44x44 with ≥ 8px separation | Phase 6, acceptance criterion 10 | `runtime-audit.mjs` |
| Computed `font-size` on form controls | Phase 6, acceptance criterion 11 | `runtime-audit.mjs` |
| Fixed-layer collisions, scrolled to bottom and in landscape | Phase 6 | `runtime-audit.mjs` |
| `.mobile-sheet` focus trap, `Esc`, scroll lock, focus return | Phase 6 | manual |
| Safe-area insets on real hardware | Phase 6 | real device |
| Lighthouse, CLS, LCP, INP on throttled 4G + 4x CPU | Phase 9, criteria 17-18 | `lighthouse.yml` workflow already exists |
| Rich Results Test / Schema.org validator | Phase 8 | manual, needs a public URL |

**To run the whole runtime half:**

```bash
pnpm dlx playwright install chromium
pnpm add -Dw @axe-core/playwright         # if the axe pass is wanted
pnpm --filter @ecowoods/web dev           # separate terminal
node audit/scripts/runtime-audit.mjs --shots
# writes audit/runtime-report.json
```

`runtime-audit.mjs` covers public routes only. `/mypage/*` and `/admin/*` need an
authenticated context — add storage state to the script before auditing them.

### 2.2 No build verification

There is no `pnpm` in the audit environment, and `binaries.prisma.sh` is
unreachable, so `prisma generate` cannot run. The following were **not** run and
are therefore **not** claimed anywhere in this patch series:

- `pnpm install --frozen-lockfile`
- `pnpm --filter @ecowoods/web exec prisma generate`
- `pnpm --filter @ecowoods/web exec tsc --noEmit`
- `pnpm verify` (facts + migrations guards)
- `pnpm --filter @ecowoods/web build`

This patch touches only `audit/**`, so it cannot affect any of them — but that is
an argument, not a measurement, and the MANIFEST says so.

**What was run:** `node audit/scripts/parse-scan.mjs` over all 233 `.ts`/`.tsx`/
`.js`/`.mjs` files in the repository — **zero diagnostics**, zero stranded
interpolations, zero literal-`\n` corruption. That is the base state, recorded so
the next session can tell whether corruption is new.

### 2.3 No screen reader

Manual VoiceOver (iOS), VoiceOver (macOS) and NVDA passes were not performed.
Automated tooling catches roughly a third of real accessibility problems. Phase 7
cannot be closed on axe results alone, and this patch does not pretend otherwise.

### 2.4 Unverified individual findings

- **F-08** — two `<h1>` in `verify-email/page.tsx` and
  `mypage/invoices/[id]/pay/page.tsx`. Almost certainly mutually-exclusive
  conditional branches, in which case it is a non-finding. Needs a render.
- **F-16** — `Esc`-to-close and focus trapping on the FloorForge and estimate
  modals. Needs a browser.
- **F-12** — the 14px computed size on `.shop-input` and `.fc-postal` is derived
  from the cascade statically. Inline styles and later rules could override it.
- **§7.3 of FINDINGS** — whether any `--line` border is the *sole* affordance
  defining a control, and therefore subject to the 3:1 rule, needs a per-rule
  pass with rendered output.

---

## 3. Deliberately out of this patch series

### 3.1 Six tracked `.patch` files at the repo root

`.gitignore` already contains `*.patch`, but ignore rules do not untrack files
already committed:

```bash
git rm --cached dev-image-fix.patch ecowoods-logo-inline-fix.patch \
  ecowoods-perf-seo.patch fix-configurator-collision.patch \
  perf-quickwins.patch seo-boost.patch
git commit -m "chore: untrack stale patch files"
```

Not done here because this is an audit-docs patch and deleting six files is a
different concern with a different blast radius (Rule 4).

### 3.2 `apps/mobile/node_modules` is committed

378 tracked files, including an 8.7 MB `typescript.js` and a 6.0 MB `_tsc.js`.
This is why a fresh clone is 225 MB and why `git` operations are slow. Outside
the stated scope of this brief (design, responsive, a11y). Recorded because it
makes every future clone-verify cycle slower, including the one in the apply
sequence.

### 3.3 `api/backgrounds/route.ts`

Still calls the Unsplash API. Out of scope — API routes are explicitly excluded.
Once F-06's hero fix lands, this route has no caller and should be removed by
someone with permission to touch API routes.

### 3.4 `RotatingBackground.tsx`

Still present, and `SectionBackground.tsx` (its intended replacement) does not
exist. Whether `RotatingBackground` still has callers needs checking before Phase
9 removes anything. Component deletion is a Phase 4 concern, gated on Q4.

---

## 4. Things that are fine and should be left alone

Recorded because a later pass may otherwise "fix" them.

- **`prefers-reduced-motion` handling.** The global reset at `globals.css:1691`
  is correct and comprehensive. Six selectors flagged by an early version of the
  audit script were all false positives (`FINDINGS.md` §7.1). Verified: 0
  selectors can be left invisible. Do not add more per-component blocks; if
  anything, the existing fourteen are redundant.
- **`.btn-copper`'s hover rule** (`globals.css:487`) deliberately darkens rather
  than lightens, with a comment explaining that cream on `--copper-bright` is
  2.30:1. It is right. It is the model the other ten copper surfaces should
  follow (F-05).
- **`alt=""` on the header and footer logos.** Correct — `<strong>Ecowoods</strong>`
  sits immediately adjacent in both, so the mark is decorative. The 28.4 KB of
  base64 is the problem (F-19), not the alt text.
- **`--on-dark-*` having no dark override.** Documented at `globals.css:4041`:
  those surfaces never flip. Intentional.
- **The 47 hardcoded hexes in `/docs/{quote,invoice,contract}/[id]`.** Printable
  customer documents should render on a fixed light palette regardless of the
  theme toggle. Converting them to tokens would be a regression (F-10).
- **The dark theme's inline rationale comments.** `globals.css:4000-4068` records
  measured contrast ratios next to the values that were chosen because of them.
  Preserve those comments through any Phase 1 token consolidation.
