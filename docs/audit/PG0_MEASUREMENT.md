# PG0 — MEASUREMENT AUDIT

Evidence base for the attribution finding in `PG0_FORENSIC_AUDIT.md`.

## Provider

Google Analytics 4 only. No PostHog, Plausible, Mixpanel, Segment, or Vercel Analytics
anywhere in the repo.

- `lib/analytics.ts` (111 lines) exports `track(event, params)`.
- `lib/analytics.ts:96-111` — browser-only (`typeof window === 'undefined'` early return),
  try/catch wrapped so it can never throw. Calls `window.gtag`, else pushes `dataLayer`.
  If neither exists (pre-consent) it is a **silent no-op — the event is dropped, not queued**.
- `CookieConsentBanner.tsx:64-78` — GA loads only after explicit consent. `anonymize_ip: true`.
  Correct under PIPEDA; it also means pre-consent sessions are invisible.
- **All events leave to Google. There is no first-party ingest route and no event table.**
- `AnalyticsEvent` is a closed union (`lib/analytics.ts:43-94`) with per-event comments
  forbidding PII. `lib/funnels/index.ts` maps events to six funnels, compile-time enforced
  and checked by `scripts/verify-strategy.mjs`. This is genuinely good discipline.

## Events that fire today (30 call sites)

Estimate: `quote_view`, `quote_start`, `quote_submit`, `photo_triage_submit`,
`recovery_opt_in`, `photo_retention_opt_in` — `EstimateForm.tsx:153,226,267,302,214,631`.
Global: `tel_click` — `TelClickTracker.tsx:19`.
Design: `design_handoff` — `FloorConfigurator.tsx:324`, `SpecSheet.tsx:156`.
Proof: `jobcard_click` — `JobCard.tsx:85`, `ProofSlider.tsx:233`.
Framework: `framework_assess_complete` `AssessClient.tsx:150`,
`framework_benchmark_contribute` `:184`, `quote_review_submit` `QuoteReviewForm.tsx:86`.
Studio (11): `studio_open` `:195`, `studio_visualised` `:257`, `studio_match_shown` `:278`,
`studio_photo_analysed` `:374`, `studio_boundary_corrected` `:388`, `studio_config_changed`
`:446`, `studio_compare` `:459`, `studio_share` `:478,500`, `studio_region_changed` `:1020`,
`studio_estimate_handoff` `:1110`, `studio_samples_request` `:1118` — all `FloorStudio.tsx`.
Live camera: `studio_live_opened` `LiveRoom.tsx:122`, `studio_live_blocked` `:125`,
`studio_live_captured` `:222`.

**Declared but never fired:** `commercial_cta`, `realtor_cta` (`lib/analytics.ts:53-54`).

## Gap against the 21 canonical events

EXISTS (6): `studio_open`, `camera_start`≈`studio_live_opened`,
`recommendation_view`≈`studio_match_shown`, `share`≈`studio_share`, `quote_start`,
`quote_complete`≈`quote_submit`.

PARTIAL (6) — fires but cannot be attributed: `photo_upload`≈`studio_photo_analysed`
(no session id), `boundary_detect`≈`studio_boundary_corrected` (fires only on *manual
correction*, not on detection), `species_select` / `finish_select` / `pattern_select` /
`width_select` — all one event `studio_config_changed` with an `axis` param.

MISSING (9): `design_open`, `design_create`, `price_view`, `save`, `appointment`,
`estimate`, `acceptance`, `deposit`, `job_complete`.

**Structural cause of the last five:** every stage past `quote_submit` is a server write
(`Appointment`, `Project.status`, `Invoice`, `JobOutcome`) and `track()` is browser-only.
No amount of client work reaches them. They need a server-side path.

## Attribution — the finding

**No. Revenue cannot be attributed to any tool today.**

- No UTM capture. Verified: the only `utm_` strings in the repo are *outbound* credit
  links to Unsplash (`RotatingBackground.tsx:90,120`). The site attributes other people
  and captures nothing for itself.
- No visitor/session/client id stored anywhere. The only `localStorage` writes are the
  cookie-consent flag and the two configurator configs.
- `leadSchema` (`packages/shared/schemas/index.ts:28-58`) accepts:
  `name, email, phone, postal, city, company(honeypot), service, timeline, message,
  source, design, recoverConsent, sqft`. No `utm_*`, no `gclid`, no referrer, no session id.
- `source` is a hardcoded React prop naming the form instance, not a marketing channel.
- `design` is a **configuration fingerprint, not an identity**: `encodeStudioDesign`
  (`studio-config.ts:124-139`) is deterministic, so two visitors choosing the same floor
  produce the identical string. It cannot join a lead to a session.
- `QuoteRequest` has no `design` column (verified against `schema.prisma:298-347`); the
  code lands in free-text `notes` via `leadNotes()` (`api/leads/route.ts:79-85`).
- No downstream model (`Project`, `Invoice`, `Payment`, `Appointment`, `JobOutcome`)
  carries any attribution column.

## Reporting

No page or API anywhere reports conversion, funnel counts, or revenue by source —
neither `app/admin/*` nor the static `apps/admin/`. The only rollup is estimating
accuracy via `Prediction`/`JobOutcome`, which is a different question.

## The assistant is entirely uncounted

`ChatWidget.tsx` and `app/api/chat/route.ts` contain **zero** `track()` calls (verified).
`ChatWidget.tsx:161-163` has a `console.log` marked *"Dev-only telemetry breadcrumb;
wire to a real analytics sink for prod."* The assistant books appointments and creates
`QuoteRequest` rows directly — and none of it is counted, and a booking made through it
does not fire `quote_submit`.
