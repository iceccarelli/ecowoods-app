# Quote Intelligence Report (EW-0002)

New-files-only build on top of EW-0001 (Well-Installed Quote Review, `factory/EW-0001-commercial-platform`, commit `cb84501`). EW-0001 built the paid checkout and got the customer's quote document to the estimating desk by email; it never produced anything the customer could read. This closes that gap.

## Buyer, problem, deliverable

Same buyer as EW-0001: a Toronto/GTA homeowner (sometimes a realtor) holding 1–3 hardwood quotes, minutes from picking a contractor. The problem: three totals are usually three different jobs, and nothing free on this site (`/framework/assess`, the free `/api/quote-review`) commits to a turnaround or hands back a document.

The deliverable is a **Quote Intelligence Report**: a 1–2 page written read of the customer's quote, scored against the Ecowoods Well-Installed Framework v1.0 (`lib/framework.ts`, 27 criteria across six pillars) and the published scope-item vocabulary (`content/quote-check/scope-items.ts`) — what's present, what's missing, and the exact questions to send back in writing. If the quote is sound, the report says so; that is the stated brand behavior, not the default.

## Payment event

Unchanged from EW-0001. This build adds **no second charge** and no second Stripe product. Checkout is still `POST /api/well-installed-review/checkout` → the existing, unmodified `/api/webhooks/stripe` marks the `Order` PAID from `metadata.orderId`. Pricing (`$179` Standard / `$249` Rush) is read from `content/constants/paid-review-product.ts`, unchanged — this build imports `REVIEW_TIERS`, it does not restate the figures.

## Operational workflow

1. Customer pays (EW-0001).
2. Stripe webhook marks the `Order` PAID.
3. Customer uploads the quote document via EW-0001's success page → desk gets an email, `Order` moves to FULFILLED.
4. An ADMIN estimator opens `/admin/quote-intelligence/[orderId]` (a new page under the existing, unedited `/admin` layout — reuses its ADMIN gate rather than duplicating one under a new top-level route), answers the 27 framework criteria and ticks which scope items the document actually contains, and writes three short fields: what's present, what's missing, and (only when true) a sentence saying the quote is sound.
5. Publish (`POST /api/quote-intelligence/publish`) renders the PDF, stores it, appends a `QI_REPORT:` marker to `Order.notes` (the tier line EW-0001's checkout wrote is preserved, never overwritten), and emails the customer a link to `/well-installed-review/report?order=&email=`.
6. The customer reads the report at that URL. The desk may then invite a free in-home measure by hand — this build does **not** auto-create a `QuoteRequest`, because turning a paid, neutral review into a lead-generation trigger is exactly the trust the product sells.

Budget: 15–25 minutes of estimator time per report. If the workbench can't be filled out that fast, the product has failed on its own terms — this build has not measured that in production.

## Legal line (unchanged from `/quote-check`)

No dollar figure is put on anything a quote leaves out; no competitor is named or ranked. Same reasoning as `content/quote-check/scope-items.ts`: Competition Act s.74.01(1)(b) requires adequate and proper testing before a performance claim, Bill C-59 raised the exposure to the greater of CAD 10M or 3% of worldwide gross revenue with private access to the Tribunal since 20 June 2025, and naming a competitor's document invites the disparagement analysis in *Energizer Brands v Gillette*, 2023 FC 804.

`lib/quote-intelligence/compose.ts` enforces this at runtime on every free-text field an estimator types (present / missing / additional questions / "if sound" statement): a dollar figure, a percentage, comparison vocabulary ("worse than", "typically costs", …), or a recognizable company-name pattern (`Something Inc.`, `Something Flooring`, `Something Hardwood`, …) is **rejected**, not silently stripped, so the estimator sees exactly what to remove before the report can publish.

## Class C — pricing is not decided by this PR

The `$179`/`$249` figures are the ecowoods-opportunity agent's researched recommendation from EW-0001, not an owner-confirmed commercial term. Per `ECOWOODS_AUTONOMOUS_EXECUTION_PROTOCOL.md` §7/§23, a new public price claim is Class C — prepare the patch, name the blocker, do not publish it autonomously. This PR is the confirmation gate: nothing here reaches a paying customer until the branch is reviewed, merged and deployed with live Stripe keys.

## What was deliberately not built here

- **Guard script.** The spec suggested an optional `scripts/verify-quote-intelligence.mjs` that fails on `$`/`%`/comparison vocabulary in new files. Not added: the PDF legitimately renders `{report.pct}%` — the framework's own transparent score — and a blunt scan can't distinguish that from a forbidden pricing percentage without the same free-text-vs-structured-data judgment `compose()` already makes at runtime. Shipping a guard that immediately false-positives on compliant code is worse than the gap it would close.
- **Analytics.** No event was added to `lib/analytics.ts`'s closed `AnalyticsEvent` union — extending it is an edit to an existing file, out of scope for a new-files-only build. `well_installed_review_paid` / `quote_intelligence_published` are integration requests below.
- **Navigation.** No link was added from `/framework/assess`, `/quote-check`, `/estimate` or `/realtors`. Same reason.

## Integration requests (orchestrator / human — not this PR)

- Link from `/framework/assess` and `/quote-check` to `/well-installed-review`.
- Add `well_installed_review_paid` and `quote_intelligence_published` to `lib/analytics.ts`'s `AnalyticsEvent` union.
- Owner Class C sign-off on `$179`/`$249`.
- Refresh the expired GitHub token blocking `git push`/`gh pr create` for this branch.
- Optional, later: credit the review fee against a signed contract in admin invoicing — that touches existing invoice code and is out of scope here.
