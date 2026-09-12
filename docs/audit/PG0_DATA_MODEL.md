# PG0 — Data Model Forensic Audit

Scope: `apps/web/prisma/schema.prisma` (1,060 lines, 26 models, 12 enums).
Method: `grep -rn 'db\.<model>\.'` against `apps/web` (the Prisma client is
exported as `db` from `apps/web/lib/db.ts`, not `prisma` — the schema-only
`prisma.<model>` search specified in the brief returns zero hits everywhere;
`db.<model>` is the real call site). Every claim below has a `file:line`.
Reachability was checked by tracing each write/read call up to a route file
under `app/api/**` or `app/**/page.tsx`, then confirming that route/page is
linked from a nav array or another page (`app/admin/layout.tsx` for admin,
public pages for public tools).

---

## 1. Model-by-model classification

| Model | Written | Read | Reachable | Verdict |
|---|---|---|---|---|
| User | `lib/actions/auth.ts:142` (`upsert`, signup), `lib/auth.ts:169` (verify) | `lib/actions/quotes.ts` etc. via relations, `app/admin/users/page.tsx` | Yes — `/register`, `/login`, `/admin/users` | LIVE |
| EmailVerificationToken | `lib/actions/auth.ts:40` | `lib/actions/auth.ts` (findUnique on verify) | Yes — email verify link | LIVE |
| Account | `prisma/seed.ts:31` (`deleteMany` only) | none found | NextAuth `PrismaAdapter` manages this table directly (not through `db.account.*` app code) — no direct app-level read/write | ORPHANED (app code) — adapter-owned, out of grep's reach by design |
| Session | `prisma/seed.ts:30` (`deleteMany` only) | none found | Same — NextAuth adapter-owned | ORPHANED (app code) |
| VerificationToken | none found | none found | NextAuth adapter model, unused by this app's magic-link-free auth flow (password + separate `EmailVerificationToken` used instead) | ORPHANED |
| PilotLead | `app/api/pilot-leads/route.ts:96` | none found (no admin list/detail view reads it) | Write path reachable — `/products/floorforge` form posts here. No read UI exists. | WRITE-ONLY |
| QuoteRecovery | `app/api/quote-recovery/route.ts:68,80`; `app/api/cron/quote-recovery/route.ts:69`; converted-flag set at `app/api/leads/route.ts:222` | `app/api/quote-recovery/route.ts:62`; `app/api/cron/quote-recovery/route.ts:45` | Write reachable from `EstimateForm.tsx`; read only by its own cron (`/api/cron/quote-recovery`), no admin UI | LIVE (machine-to-machine; no human-facing read) |
| QuoteRequest | `lib/actions/quotes.ts:38`, `app/api/leads/route.ts:189`, `app/api/photo-triage/route.ts:169`, `app/api/chat/route.ts:307`, `app/api/appointments/route.ts:97` (in `$transaction`) | `app/admin/quotes/page.tsx:23`, `app/(portal)/mypage/quotes/page.tsx:11`, `app/docs/quote/[id]/page.tsx:23` | Yes — public quote form, admin quotes list, customer MyPage | LIVE |
| Project | `lib/actions/quotes.ts:267` (convert), `lib/actions/projects.ts:37,66,98,168` | `app/admin/projects/page.tsx:31`, `app/(portal)/mypage/projects/page.tsx:37`, `app/admin/floor-graph/page.tsx:69` | Yes — admin projects UI, MyPage | LIVE |
| ProjectNote | `lib/actions/projects.ts:114` | none found (no page selects `notes`) | Write reachable from admin project page; nothing renders it back | WRITE-ONLY |
| Invoice | `lib/actions/invoices.ts:74,102,124,165,210,275,333,365` | `app/admin/invoices/page.tsx:29`, `app/(portal)/mypage/invoices/page.tsx:27`, `app/docs/invoice/[id]/page.tsx:39` | Yes | LIVE |
| Payment | `lib/actions/invoices.ts:171,254`, `app/api/webhooks/stripe/route.ts:109` | `app/admin/page.tsx:33`, `app/admin/invoices/page.tsx:37` | Yes — Stripe webhook + manual bank/cash confirmation, shown on admin dashboard | LIVE |
| Inquiry | `lib/actions/inquiries.ts:33` | `app/admin/inquiries` (list/detail, via `db.inquiry.findMany/findUnique`) | Yes — public contact form, admin inquiries UI | LIVE |
| InquiryReply | `lib/actions/inquiries.ts:60` | rendered on `app/admin/inquiries/[id]/page.tsx` (via `inquiry.replies` relation include) | Yes | LIVE |
| Settings | `lib/actions/inquiries.ts:121,123` (`updateSettings`, misnamed file) | `lib/actions/quotes.ts:161`, `app/admin/page.tsx`, 17 call sites total | Yes — `/admin/settings` | LIVE |
| Appointment | `app/api/appointments/route.ts:109` (in `$transaction`) | `app/api/availability/route.ts:34`, `app/api/appointments/route.ts:76`, `app/api/chat/route.ts:109,223` | Yes — public booking widget on quote form | LIVE |
| Product | `prisma/seed-products.ts:74,103`, `prisma/seed-product-images.ts:80` — **seed scripts only, no admin route** | `app/api/shop/checkout/route.ts`, storefront pages (`db.product.findMany`) | Read side reachable (storefront). **No reachable write path** — there is no admin product-management UI or route; the only mutators are one-off seed scripts run manually | READ-ONLY (in terms of live application code) |
| Order | `app/api/shop/checkout/route.ts:87,136`, `app/api/webhooks/stripe/route.ts:67`, `lib/actions/orders.ts:16` | `app/admin/orders/page.tsx`, `app/(portal)/mypage` (order history) | Yes | LIVE |
| OrderItem | nested create inside `app/api/shop/checkout/route.ts:94` (`items: { create: itemsToCreate }`) | included via `order` relation on admin/orders and mypage order pages | Yes | LIVE |
| ConsentRecord | `lib/floor-graph/consent.ts:65,101` (`grantConsent`/`withdrawConsent`), called from `app/api/photo-triage/route.ts:238` (purpose `ASSESSMENT_PHOTOS`) and `app/api/framework-scoring/route.ts:123` (purpose `BENCHMARK_CONTRIBUTION`) | `lib/floor-graph/consent.ts:123` (`hasLiveConsent`) — **defined but never called anywhere** | Write reachable via two public tools. `MODEL_TRAINING` and `FLOOR_RECORD` purposes are defined in `wording.ts:44,55` but no call site ever passes them — dead purposes. | LIVE (2 of 4 purposes only), READ path unused |
| FloorRecord | **none** — `db.floorRecord.create`/`update` do not exist anywhere in the app; only `db.floorRecord.count()` at `lib/floor-graph/index.ts:187` (inside `nextFloorRecordRef`, itself never called) and `app/admin/floor-graph/page.tsx:55` | `app/admin/floor-graph/page.tsx:55` (count only) | The generator for its `publicRef` exists but has zero callers | ORPHANED — schema-only, no row can ever be created by current code |
| FloorAssessment | `lib/floor-graph/index.ts:71` (`recordAssessment`), called from `app/api/photo-triage/route.ts:226` | `app/admin/floor-graph/page.tsx:56` (count only) | Yes, write side — every photo-triage submission | WRITE-ONLY (nothing lists/reviews individual assessments; `AssessmentStatus`/`reviewedBy` fields imply an intended admin triage queue that does not exist) |
| AssessmentPhoto | `lib/floor-graph/index.ts:112` (`storeAssessmentPhotos`), called from `app/api/photo-triage/route.ts:264` | `app/admin/floor-graph/page.tsx:57` (count only) | Yes, write side | WRITE-ONLY (no viewer for retained photos) |
| FrameworkScoring | `lib/floor-graph/index.ts:161` (`recordFrameworkScoring`), called from `app/api/framework-scoring/route.ts:129` | `app/admin/floor-graph/page.tsx:58` (count only); the route's own `GET` handler (`route.ts:145`) deliberately refuses to serve a read endpoint | Yes, write side — `/framework/assess` | WRITE-ONLY by design (see code comment: "no read endpoint ... until the corpus is large enough") |
| JobOutcome | `app/api/admin/floor-graph/outcome/route.ts:85`, driven by `app/admin/floor-graph/[projectId]/OutcomeForm.tsx` | `app/admin/floor-graph/page.tsx:59,76`, `app/admin/floor-graph/[projectId]/page.tsx:73` | Yes — full admin UI at `/admin/floor-graph/[projectId]`, linked from `/admin/floor-graph`, linked from nav (`app/admin/layout.tsx:24`) | LIVE |
| Prediction | `lib/floor-graph/prediction.ts:75` (`recordPrediction`), called **only** from `lib/actions/quotes.ts:131` (`saveEstimate`, kind `PRICE_CAD`) | `lib/floor-graph/prediction.ts:162,166` (`accuracySummary`), surfaced on `/admin/floor-graph`; closed via `closePrediction` at `app/api/admin/floor-graph/outcome/route.ts:128,141` | Yes | LIVE — but only for `PRICE_CAD`; `LABOUR_HOURS`, `MATERIAL_SQFT`, `SCHEDULE_DAYS` are never written by `recordPrediction` (grep for `recordPrediction(` finds exactly one call site) even though `closePrediction` code exists to close a `SCHEDULE_DAYS` row (`outcome/route.ts:135-144`) that can never exist |

---

## A. QuoteRequest → Project → Invoice → Payment → Appointment: is there a real pipeline?

**Yes, fully wired, not just tables.** Traced end to end:

1. Visitor submits the public quote form → `submitQuoteRequest()` creates a `QuoteRequest` row (`lib/actions/quotes.ts:38`).
2. Admin opens `/admin/quotes/[id]` (linked from nav → `/admin/quotes`, `app/admin/layout.tsx:18`) and builds an estimate via `EstimateBuilder.tsx` → `saveEstimate()` (`lib/actions/quotes.ts:81-146`), which also writes a `PRICE_CAD` `Prediction` row.
3. Admin clicks convert via `ConvertToProjectForm.tsx` → `convertQuoteToProject()` (`lib/actions/quotes.ts:245-296`) — this **actually creates a `Project` row** (`quotes.ts:267`) and links it back with `quoteRequest.update({ projectId, status: 'ACCEPTED' })` (`quotes.ts:287`).
4. On the project page (`/admin/projects/[id]`), `ProjectStatusForm.tsx` drives `updateProjectStatus`/status transitions (`lib/actions/projects.ts:66,98`), and `InvoiceIssueForm.tsx` drives `generateStagedInvoices()` (`lib/actions/invoices.ts:191-234`), which creates `Invoice` rows split by deposit/midpoint/final percentages.
5. Customer pays via Stripe checkout (`app/api/invoices/[id]/checkout/route.ts`) → `app/api/webhooks/stripe/route.ts:88-109` marks the `Invoice` paid and creates a `Payment` row; OR admin manually confirms a bank/cash payment via `markInvoicePaid()` (`lib/actions/invoices.ts:156-188`).
6. `Appointment` is a separate, parallel booking flow off `QuoteRequest`: `app/api/appointments/route.ts:96-121` creates both a `QuoteRequest` and an `Appointment` in one `$transaction`, driven by the public booking widget and shown to admin via `db.appointment.findMany` in `app/api/availability/route.ts` and `app/api/chat/route.ts`.

Conclusion: this is a real, reachable commercial pipeline with an admin UI at every step, not dead schema.

## B. JobOutcome — is the "flooring economics engine" wired or empty?

**Genuinely wired**, not just present. `JobOutcome` holds both execution fields (`labourHours`, `machineHours`, `crewSize`, `gritSequence`, `finishCoats`, `cureHours`, `materialSqFt`, `wastePct`, `finishLitres`) and economics fields (`materialCostCad`, `labourCostCad`, `sellingPriceCad` — schema.prisma:977-993), plus consequence fields (`scheduleDays`, `defects`, `callbackAt`, `warrantyClaimAt`).

Write path: `POST /api/admin/floor-graph/outcome` (`app/api/admin/floor-graph/outcome/route.ts:85`) is called from a real form, `app/admin/floor-graph/[projectId]/OutcomeForm.tsx`, on a real page (`app/admin/floor-graph/[projectId]/page.tsx`) that is one click (`/admin/floor-graph` → "Close" button, `page.tsx:185-187`) from the admin nav (`Floor Graph`, `app/admin/layout.tsx:24`).

It is not, however, an "estimated vs. actual" comparison in the sense of storing the *estimate* on the same row — the estimate side lives in `Prediction` (kind `PRICE_CAD`), and `JobOutcome` only stores the actual. The two are joined by `closePrediction()` (`lib/floor-graph/prediction.ts:101-132`), invoked automatically from the outcome route (`outcome/route.ts:114-131`) when `sellingPriceCad` is submitted — this is the "predicted vs actual" comparison the schema comment describes, and it is real, not aspirational.

Caveat: labour/material **cost** fields have no corresponding *predicted* cost anywhere — only price is predicted (see C below), so margin variance (predicted margin vs actual margin) cannot currently be computed even though the actual-side columns exist.

## C. Prediction / PredictionKind — inference path or empty promise?

Half-wired. `PredictionKind` has four values: `PRICE_CAD`, `LABOUR_HOURS`, `MATERIAL_SQFT`, `SCHEDULE_DAYS` (schema.prisma:747-754). `recordPrediction()` (`lib/floor-graph/prediction.ts:71`) has exactly **one caller in the whole codebase**: `saveEstimate()` in `lib/actions/quotes.ts:131-142`, which always passes `kind: 'PRICE_CAD'`. Grep for `recordPrediction(` confirms this is the only call site.

`LABOUR_HOURS` and `MATERIAL_SQFT` are never produced anywhere. `SCHEDULE_DAYS` is not produced either, but the outcome route still contains dead code to close it (`app/api/admin/floor-graph/outcome/route.ts:135-144`, `db.prediction.findMany({ where: { kind: 'SCHEDULE_DAYS', ... } })`) — this query will always return an empty set today because nothing ever creates a `SCHEDULE_DAYS` row. There is no model/AI inference anywhere in this path — `model: 'estimator'` (a human-typed literal, `quotes.ts:133`) is the only value ever written to `Prediction.model`; no ML or algorithmic predictor exists. This is a working **price accuracy ledger**, not an inference engine.

## D. FloorRecord — Floor Passport or empty table?

**Empty table — nothing writes it.** `db.floorRecord.create` and `db.floorRecord.update` do not exist anywhere in `apps/web`. The only mutating-adjacent code is `nextFloorRecordRef()` (`lib/floor-graph/index.ts:184-189`), which computes the next `publicRef` (e.g. `FR-2026-0001`) by counting existing rows — and that function itself has **zero callers** (confirmed by grep). The only other reference is `db.floorRecord.count()` on the admin dashboard (`app/admin/floor-graph/page.tsx:55`), which will report 0 forever under current code.

Fields present (schema.prisma:790-837): `publicRef`, coarse location (`city`, `province`, `postalPrefix`, `propertyType`, `storey`), floor spec (`areaSqFt`, `species`, `boardWidthMm`, `boardThickMm`, `pattern`, `finishSystem`, `substrate`, `installMethod`, `installedOn`), soft links (`originQuoteRequestId`, `originProjectId`), relations to `assessments`/`outcomes`, and `erasedAt` for right-to-erasure.

Relative to a real "Floor Passport" (customer + property + installed spec + warranty + service history), what exists in the schema but is unpopulated:
- Installed floor spec fields exist (species, dimensions, finish, substrate, install method/date) — schema-complete, but never populated.
- No warranty terms/expiry/document fields at all (only `JobOutcome.warrantyClaimAt`, which records a *claim*, not coverage terms or an expiry date).
- No customer/property identity — by deliberate design (schema.prisma:679-702 explains the no-hard-FK decision), only coarse `city`/`province`/`postalPrefix`; full address and owner identity live only on the soft-linked `Project`/`QuoteRequest`, and there is no code that ever joins them into a FloorRecord row.
- No explicit recurring "service visit"/maintenance-history model — only `FloorAssessment` (a look at a floor) and `JobOutcome` (one completed job) relate to it, so a passport's "service history" would have to be assembled from those, and since neither ever sets `floorRecordId` (grep shows `floorRecordId` is never assigned a value in any `create` call), even that assembly is currently impossible.
- No ownership-transfer / handoff-to-new-owner tracking, despite the `FLOOR_RECORD` consent purpose wording explicitly promising this (`lib/floor-graph/wording.ts:55-59`: "can be handed to a future owner").

Conclusion: this is the schema for a Floor Passport with correctly-designed columns, but it is currently 100% aspirational — an empty table with no write path, and the consent purpose that would gate its creation (`FLOOR_RECORD` in `ConsentPurpose`) is itself never granted anywhere (`grantConsent` is called only with `ASSESSMENT_PHOTOS` and `BENCHMARK_CONTRIBUTION` — see section F).

## E. FloorAssessment / AssessmentPhoto / FrameworkScoring — connected to public tools, or browser-only?

**Connected — this is the one part of the Floor Graph that is genuinely live end-to-end for capture.**

- The photo-based estimate track (`/api/photo-triage`, `app/api/photo-triage/route.ts`) writes a `QuoteRequest` (line 169), then downstream and non-blocking (lines 225-276) writes a `FloorAssessment` via `recordAssessment()` (line 226), and — only if the visitor ticked the retention checkbox — grants an `ASSESSMENT_PHOTOS` `ConsentRecord` (line 238) before storing `AssessmentPhoto` rows (line 264).
- The Well-Installed Framework tool at `/framework/assess` (`app/framework/assess/AssessClient.tsx`) explicitly does **not** persist the raw answers by design (its own header comment says so) but does offer an opt-in "contribute to the benchmark" action that posts to `/api/framework-scoring` (`app/api/framework-scoring/route.ts`), which grants a `BENCHMARK_CONTRIBUTION` consent row (line 123) and writes a `FrameworkScoring` row (line 129).

So it is not "purely browser-side with no persistence" — persistence exists and is reachable from both public tools, gated correctly behind consent. What is missing is the *review/read* side: nobody ever queries an individual `FloorAssessment` or `AssessmentPhoto` back out (admin dashboard only shows aggregate counts, `app/admin/floor-graph/page.tsx:56-57`), so photographs and triage data are captured but currently unreviewable through any UI — a data sink, not yet a working triage queue, despite `FloorAssessment.status`/`reviewedBy`/`reviewedAt` fields implying one was planned.

## F. ConsentRecord / ConsentPurpose — working system?

Working, but only 2 of 4 purposes are ever exercised. `ConsentPurpose` enum defines: `ASSESSMENT_PHOTOS`, `MODEL_TRAINING`, `BENCHMARK_CONTRIBUTION`, `FLOOR_RECORD` (schema.prisma:704-715). `grantConsent()`/`withdrawConsent()`/`hasLiveConsent()` are fully implemented in `lib/floor-graph/consent.ts` with a real append-only ledger design (grant + separate withdrawal row, never an update).

Grep for actual call sites of `grantConsent(` finds exactly two:
- `purpose: 'ASSESSMENT_PHOTOS'` — `app/api/photo-triage/route.ts:238`
- `purpose: 'BENCHMARK_CONTRIBUTION'` — `app/api/framework-scoring/route.ts:123`

`MODEL_TRAINING` and `FLOOR_RECORD` have wording drafted (`lib/floor-graph/wording.ts:44-49,55-59`) but are never granted anywhere — no UI offers them, consistent with there being no model-training feature and no FloorRecord writer (section D). `hasLiveConsent()` and `withdrawConsent()` are fully implemented but have **zero callers anywhere in the app** — there is no consent-withdrawal UI/route for a visitor to exercise the right the ledger is designed to support.

## G. PilotLead / QuoteRecovery — duplicating QuoteRequest?

**Not duplicates; three genuinely distinct entities with distinct purposes and distinct write paths:**

- **QuoteRequest** — the real lead / quote pipeline (section A).
- **PilotLead** (`schema.prisma:220-244`) — interest capture for the separate "FloorForge" pilot program, written from `app/api/pilot-leads/route.ts:96`, sourced from `app/products/floorforge/page.tsx`. Distinct fields (`role`, `program`, `company`) that don't exist on `QuoteRequest`. It is WRITE-ONLY: no admin list/detail page reads `PilotLead` back (no `db.pilotLead.findMany`/`findUnique` anywhere) — leads are captured and then only ever reachable via the admin notification email (`sendAdminNewPilotLeadEmail`) or an optional external webhook (`PILOT_LEADS_WEBHOOK_URL`), never in-app.
- **QuoteRecovery** (`schema.prisma:246-292`) — not a lead at all; it is an abandoned-form reminder ledger for someone who typed an email into the estimate form and left without submitting, gated on an explicit `consentedAt` checkbox. Written from `/api/quote-recovery` (`app/api/quote-recovery/route.ts:68,80`) while the visitor is still typing, read and actioned only by its own cron job `/api/cron/quote-recovery` (`app/api/cron/quote-recovery/route.ts:45,69`) which sends exactly one email. The explicit anti-duplication mechanism works: when a real `QuoteRequest` is later submitted for the same email, `app/api/leads/route.ts:221-222` sets `convertedAt`, which the recovery cron's query excludes (`convertedAt: null` filter, `cron/quote-recovery/route.ts:48`), so a converted visitor is never emailed a "did you forget?" reminder. This is a deliberate three-table separation, not accidental duplication.

## H. Migrations — exist? drift?

`apps/web/prisma/migrations/` contains **7 migrations**: `20260620000002_init_ecowoods_schema`, `20260720000000_add_shop_orders`, `20260720222126_add_product_image_credit`, `20260806164120_add_pilot_lead`, `20260831000000_add_quote_recovery`, `20260904000000_add_project_review_requested_at`, `20260908120000_add_floor_graph`.

Counted `CREATE TABLE "ecowoods"."<Name>"` across all migration.sql files: **26 tables**. Counted `^model <Name>` in `schema.prisma`: **26 models**. Every model name in the schema has a matching `CREATE TABLE` in the migration history and vice versa (diffed both lists — identical sets). **No drift detected** between the schema and the last migration (`20260908120000_add_floor_graph`, which added the seven Floor Graph tables/enums additively, per its own header comment, and touches nothing pre-existing).

---

## Summary of dead/live data

**LIVE (written + read + reachable):** User, EmailVerificationToken, QuoteRequest, Project, Invoice, Payment, Inquiry, InquiryReply, Settings, Appointment, Order, OrderItem, JobOutcome, Prediction (PRICE_CAD only), QuoteRecovery (machine-only read).

**WRITE-ONLY (dead data — captured, never read back):** PilotLead, ProjectNote, FloorAssessment, AssessmentPhoto, FrameworkScoring (by design, per its own route comment).

**READ-ONLY (dead queries / no reachable write path):** Product (mutated only by manual seed scripts, never by app code).

**ORPHANED (schema-only or adapter-only, no app-level read/write):** Account, Session, VerificationToken (NextAuth-adapter-owned), FloorRecord (zero rows possible under current code).

The single highest-leverage finding: **FloorRecord — the "Floor Passport" spine — cannot have a single row today.** Its own ID-generator function (`nextFloorRecordRef`) is dead code with no caller. Everything built on top of it in the schema comments (warranty, service history, future-owner handoff) is schema-only. By contrast, `JobOutcome`, `Prediction`, `FloorAssessment`, `AssessmentPhoto`, `FrameworkScoring`, and `ConsentRecord` are genuinely wired to reachable code — the Floor Graph is real for capture-and-close-the-loop-on-price, but the passport itself does not exist yet.
