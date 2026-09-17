# Quote Intelligence Report (EW-0002)

New-files-only build on top of EW-0001 (Well-Installed Quote Review, `factory/EW-0001-commercial-platform`, commit `cb84501`). EW-0001 built the paid checkout and got the customer's quote document to the estimating desk by email; it never produced anything the customer could read. This closes that gap.

## Buyer, problem, deliverable

Same buyer as EW-0001: a Toronto/GTA homeowner (sometimes a realtor) holding 1–3 hardwood quotes, minutes from picking a contractor. The problem: three totals are usually three different jobs, and nothing free on this site (`/framework/assess`, the free `/api/quote-review`) commits to a turnaround or hands back a document.

The deliverable is a **Quote Intelligence Report**: a written read of one to three of the customer's quotes, scored against the Ecowoods Well-Installed Framework v1.0 (`lib/framework.ts`, 27 criteria across six pillars) and the published scope-item vocabulary (`content/quote-check/scope-items.ts`). If the quote is sound, the report says so; that is the stated brand behavior, not the default.

Per quote, the report carries:

- **Scope extraction** — every scope item, with its status and the page + wording it was read from.
- **Well-Installed criteria assessment** — every framework criterion, same treatment, scored by the existing `score()`.
- **Risk flags** — derived by rule in `lib/quote-intelligence/risk.ts` (a table keyed on criterion severity / scope-changing × status), each carrying the framework's own `risk` or the scope item's own `why` as the consequence and the published page it rests on as the source.
- **Questions to send back in writing** — derived from the same findings; everything unreadable is rolled into one "send a readable copy" request.

Across quotes (two or more): a **side-by-side matrix** and the like-for-like verdict from the existing `compare()` in `lib/quote-check` — the free `/quote-check` tool's normalization, not a second implementation. A scope item counts as included only when the document states it. A not-comparable set raises a HIGH flag saying the difference between totals is not a price difference.

### Five statuses, never yes/no

| Status | Rendered as | Doctrine class | Evidence required |
|---|---|---|---|
| `verified` | "Stated in the quote" | KNOWN — about the document only | page + excerpt |
| `not_specified` | "Not specified" | UNKNOWN | — |
| `unclear` | "Unclear" | UNKNOWN | page + excerpt |
| `cannot_determine` | "Cannot determine" | UNKNOWN | — |
| `inspection_needed` | "Inspection needed" | INSPECTION_REQUIRED | — |

`verified` is deliberately never printed as "verified": it confirms the wording, not the work. The report's first page and last page both state that it is a read of documents — not an inspection, a measurement, a moisture or structural assessment, a price, or a professional certification. `compose()` refuses to publish a quote with any unassessed item, a "stated"/"unclear" finding without an excerpt, or an "if sound, say so" statement the scoring doesn't support — including a quote that scores strong on the framework but is silent on a scope-changing item.

## Payment event

Unchanged from EW-0001. This build adds **no second charge** and no second Stripe product. Checkout is still `POST /api/well-installed-review/checkout` → the existing, unmodified `/api/webhooks/stripe` marks the `Order` PAID from `metadata.orderId`. Pricing (`$179` Standard / `$249` Rush) is read from `content/constants/paid-review-product.ts`, unchanged — this build imports `REVIEW_TIERS`, it does not restate the figures.

## Operational workflow

1. Customer pays (EW-0001).
2. Stripe webhook marks the `Order` PAID.
3. Customer uploads the quote document via EW-0001's success page → desk gets an email, `Order` moves to FULFILLED.
4. An ADMIN estimator opens `/admin/quote-intelligence/[orderId]` (a new page under the existing, unedited `/admin` layout — reuses its ADMIN gate rather than duplicating one under a new top-level route). For each quote (tabs, up to three) they record a status for every scope item and framework criterion, quoting page + wording where required; two bulk buttons fill only still-blank items. They write what's right, what's missing, optional extra questions and risk notes, and (only when true) a sentence saying the quotes are sound. The form autosaves to `localStorage` per order. **Publish stays disabled until a Preview of the current form has succeeded.**
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
- **GA4 events.** No event was added to `lib/analytics.ts`'s closed `AnalyticsEvent` union — extending it is an edit to an existing file. The product events are server-side instead (below).
- **AI pre-fill of findings.** The customer's document is emailed to the desk and deliberately never stored, so there is nothing for a model to read without first changing that retention promise. A draft-extraction step (estimator uploads the document into the workbench, a model proposes statuses + excerpts, the estimator confirms every one) is the obvious next lever on the 15–25 minute budget — it needs an owner decision on retention and on the "not professionally verified" wording for machine-proposed findings first.

## Product events

`lib/quote-intelligence/events.ts` logs one JSON line per commercial moment (`console.info`, countable from the Vercel log drain, no schema change):

| Event | Emitted by | Fields |
|---|---|---|
| `well_installed_review.checkout_created` | checkout route, after the Stripe session exists | orderId, tier, subtotalCad |
| `well_installed_review.documents_received` | submit route, after the desk email and FULFILLED | orderId, tier, documentCount |
| `well_installed_review.report_published` | publish route (also on an idempotent re-publish, `alreadyPublished: true`) | orderId, tier, quoteCount, highRiskFlags, questions, comparisonVerdict |
| `well_installed_review.report_viewed` | `/well-installed-review/report`, when the email matches and a report exists | orderId, tier |

Paid is not logged here — the existing webhook owns that transition; `checkout_created` → `documents_received` is the observable proxy. `buildEventLine` whitelists fields, so an email, name, filename, excerpt or document price can't reach a log line even if a caller passes one (tested).

## Tests

- `lib/quote-intelligence/{compose,risk,input,events,workbench-state,notes,report-pdf}.test.ts` — the rules, the risk table, body parsing, event whitelisting, workbench state, and a real three-quote PDF render (`QI_PDF_ARTIFACT=/path.pdf` writes it out).
- `tests/well-installed-review-flow.test.ts` — the real route handlers end to end (checkout → PAID → submit → compose → publish → report lookup) with only Prisma, Stripe, email, auth and blob storage faked.

## Known PDF pitfall (fixed here)

A unitless `lineHeight` on the react-pdf `Page` is inherited by the `fixed` footer and re-resolved against the font size on every page, so it compounds; a three-quote report reached 4e23 by page 11 and pdfkit threw `unsupported number`. `report-pdf.tsx` sets line height per text style instead. `lib/floor-plan/report-pdf.tsx` and `lib/listing-floor-report/report-pdf.tsx` still set it on the Page — harmless at their current 1–2 pages, but they will fail the same way if they grow.
- **Navigation.** No link was added from `/framework/assess`, `/quote-check`, `/estimate` or `/realtors`. Same reason.

## Integration requests (orchestrator / human — not this PR)

- Link from `/framework/assess` and `/quote-check` to `/well-installed-review`.
- Add the four `well_installed_review.*` events to GA4 (`lib/analytics.ts`'s `AnalyticsEvent` union) and/or a funnel-ledger stage if the owner wants them in the same report as contractor jobs.
- Raise the 3-file upload cap on `/api/well-installed-review/submit` if three quotes photographed page by page turns out to be common.
- Owner Class C sign-off on `$179`/`$249`.
- Optional, later: credit the review fee against a signed contract in admin invoicing — that touches existing invoice code and is out of scope here.
