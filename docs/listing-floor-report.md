# Pre-List Floor Condition Report (EW-0003)

New-files-only build. Does **not** touch EW-0001 (Well-Installed Quote Review) or EW-0002 (Quote Intelligence) — different buyer, different SKU, different Stripe metadata, its own `LFR_REPORT:`/`LFR_INTAKE:`/`LFR_META:` markers in `Order.notes` so the two products can never misread each other's state.

## Buyer, problem, deliverable

**Buyer:** a Toronto/GTA listing agent (or the seller paying) with a photography date booked. `/realtors` currently converts to a free estimate; this is a paid, dated document the agent can hand the seller before the photographer arrives.

**Problem:** a tired finish photographs badly and can cost more at the offer table than a recoat would have. Nobody on this site currently sells a committed-turnaround answer to "recoat or leave it, and is there even time before the photos."

**Deliverable:** a 1–2 page written report: what the finish shows, what the wood shows, a recommendation (`recoat_ok` / `sand_required` / `leave_it` / `cannot_determine_from_photos`), and — only when `recoat_ok` — a three-working-day schedule counted backwards from the photography date. Published service bands (`SCREEN_RECOAT`, `FULL_SAND_FINISH`) are printed via `formatBand()`; no new `$`/sq ft figure is ever introduced.

## Payment event

Unchanged pattern from EW-0001: `POST /api/listing-floor-report/checkout` creates a guest `User` + PENDING `Order`, Stripe Checkout `mode: payment` with `metadata.orderId`/`metadata.kind=listing-floor-report`/`metadata.sku`, and the **existing, unmodified** `/api/webhooks/stripe` marks the order PAID. No second webhook.

## Pricing (Class C — not owner-confirmed)

`$349` (photo, 48h) / `$799` (onsite, booked around the in-home measure), declared in `content/constants/listing-floor-report-product.ts`. Same posture as `paid-review-product.ts`: these are the ecowoods-product agent's researched figures, not a confirmed commercial term. Per `ECOWOODS_AUTONOMOUS_EXECUTION_PROTOCOL.md` §7/§23, this PR is the prepared patch; a human merging it (with real Stripe keys) is the confirmation.

## Deliberate deviations from the brief

- **Checkout collects only name/email/sku (+ honeypot).** The brief's step 1 lists phone, role, brokerage, listing address, city, photography date and go-live date as landing-page fields. All of it is collected once, post-payment, in `/api/listing-floor-report/submit` — the same shape EW-0001 already uses, and it keeps the card-collection step from asking for eight fields before a payment method is even offered.
- **`Order.status` state machine matches the brief exactly** (`FULFILLED` means "report published", not "documents received"), which meant adding an `LFR_INTAKE:received` marker (`lib/listing-floor-report/notes.ts`) so a second intake submission is rejected even while the order still sits at `PAID`. Without that marker, `FULFILLED`-as-report-only would have left no way to block a duplicate submission.
- **Flat PDF filename**, same reasoning as EW-0002: `lib/pdf/storage.ts`'s local dev fallback has no recursive `mkdir` for a nested path, and that file isn't edited here.

## Legal / certainty vocabulary

Every finding is one of `verified | not_specified | unclear | cannot_determine | inspection_needed` (`lib/listing-floor-report/types.ts`). For the photo SKU, `compose()` forces `moisture` to `inspection_needed` regardless of what the estimator selects — a photograph cannot establish a physical fact like moisture, and presenting a guess as measured is exactly what this product refuses to do. The onsite SKU, which follows an actual visit, respects the estimator's real finding.

`lib/listing-floor-report/compose.ts` rejects (never silently rewrites) free text containing a dollar figure or percentage, a sale-price/market claim ("will add", "beats any other offer", …), or a named company/brokerage — a fresh, separate implementation of the same idea EW-0002's `compose.ts` uses, per this spec's explicit instruction not to import or edit that module.

## Photo retention

Reuses the **existing** Floor Graph consent gate exactly as `/api/photo-triage` does: `ConsentPurpose.ASSESSMENT_PHOTOS`, `grantConsent()`, `storePhoto()`, `recordAssessment({ source: 'PHOTO_TRIAGE', ... })`. No new consent purpose, no schema change, no `FloorGraphSource` extension. Unticked, or on any storage failure, photos still reach the estimating desk by email and are simply not retained — same fail-closed behavior as the existing route.

## Operational workflow

1. Guest pays (photo or onsite).
2. Existing webhook marks the `Order` PAID.
3. Guest submits listing details, photography date, and (photo SKU) 3–8 photos.
4. ADMIN estimator opens `/admin/listing-floor-report/[orderId]` (new page under the existing, unedited `/admin` tree — reuses its ADMIN gate, no nav link added) and sets the recommendation, findings, and short present/missing/questions text.
5. Publish renders the PDF, stores it, marks the order FULFILLED, and emails the customer a link to `/listing-floor-report/report?order=&email=`.

## Integration requests (orchestrator / human — not this PR)

- Link from `/realtors` to `/listing-floor-report`.
- Add `listing_floor_report.checkout_created` / `.intake_submitted` / `.report_generated`-shaped events to `lib/analytics.ts`'s `AnalyticsEvent` union (structured console logs already carry this data in the meantime).
- Owner Class C sign-off on `$349`/`$799`.
- Refresh the GitHub token blocking `git push`/`gh pr create` for this branch.
