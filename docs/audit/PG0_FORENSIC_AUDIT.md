# PATCH GROUP 0 — FORENSIC AUDIT

No production changes. This document is the evidence base the four programs are built on.

Commit audited: `d4db913` (MACH-01). Production at time of writing: `1e96f1c`.
Method: four parallel read-only agents over `/apps/web`, `/packages`, `/apps/admin`,
`/apps/mobile`, `/backend`, `/scripts`, `/prisma`. Every load-bearing claim below was
re-verified by hand against the file. Claims that could not be verified are marked
CANNOT DETERMINE and say what would settle them.

---

## THE ONE-SENTENCE FINDING

Ecowoods has built a genuine commercial pipeline — quote to project to invoice to
payment to job outcome, all of it real, all of it wired — and has instrumented the
front of the funnel well; but **there is no identifier anywhere that joins a visitor
to a lead**, so not one dollar of revenue in the database can be traced to the tool
that produced it.

Everything in the four programs is downstream of fixing that.

---

## 1. WHAT IS ALREADY REAL (and must not be rebuilt)

The `NO` list in the transformation brief exists because these systems are good. The
audit confirms they are not just good, they are wired:

| System | Evidence it is real |
|---|---|
| Quote → Project conversion | `lib/actions/quotes.ts:267` `convertQuoteToProject()` creates a real `Project` row |
| Staged invoicing | `generateStagedInvoices()`; `Invoice.stage` enum DEPOSIT/PROGRESS/FINAL |
| Payments | Stripe Checkout + signature-verified webhook at `app/api/webhooks/stripe/route.ts` writes `Payment` |
| Appointments | `app/api/appointments/route.ts:96-121` creates `Appointment` + `QuoteRequest` in one transaction |
| Customer portal | `app/(portal)/mypage/*` — 6 real pages, `middleware.ts:24-40` gates on `isLoggedIn`, not admin |
| Orphan-lead linking | `lib/actions/auth.ts:159-163` — anonymous quotes attach to an account on email verification |
| Estimating accuracy ledger | `JobOutcome` written from `/admin/floor-graph/[projectId]`, auto-closes the matching `Prediction` |
| Assistant with tools | `app/api/chat/route.ts` — Anthropic `streamText` that books real appointments and creates real leads |
| Consent ledger | `ConsentRecord` + `ConsentPurpose`, correctly gating photo retention and benchmark contribution |
| 70 verification guards | `scripts/verify-*.mjs`, orchestrated by `verify-all.mjs` |

**The platform brief assumes far less exists than actually does.** Program 2 asks for a
project data model — it is here. Program 4 asks for a customer account — it is here.
This changes the priority order, and the brief explicitly permits that:
*"The agent MUST be willing to change the priority ... if repository evidence proves
another opportunity is materially more valuable."*

---

## 2. CAPABILITY MATRIX (Deliverable 3)

Seven states, as specified: FULL / PARTIAL / WEAK / DISCONNECTED / UNMEASURED / DUPLICATED / MISSING.

| Capability | State | Evidence |
|---|---|---|
| Floor Studio render + configure | **FULL** | Renders, prices, share-code round-trips, 11 events fire |
| Floor Studio → estimate handoff | **FULL** | `estimateHref()` `studio-config.ts:334`; `EstimateForm.tsx:125-133` decodes it |
| Floor Studio design → business record | **DISCONNECTED** | Lands as free text in `QuoteRequest.notes`; no column, no admin decoder (verified: zero hits for `decodeStudioDesign` under `app/admin/`) |
| Floor Designer (`/design`) | **PARTIAL** | Works, but its primary CTA is a bare `/#quote` with no parameters; continuity survives only via localStorage |
| Spec sheet → quote | **BROKEN** | `SpecSheet.tsx:97` `` `/#quote?spec=${...}` `` — query string placed *after* the hash. Silently discarded. And `design_handoff` fires anyway at `:156`, so analytics records a success on the one CTA that loses its payload |
| Framework assessment | **FULL** | Score, verdict, shareable `?a=` code, opt-in anonymous benchmark |
| Quote-check comparator | **UNMEASURED** | Zero `track()` calls (verified) |
| Movement calculator | **UNMEASURED + DISCONNECTED** | Zero `track()` calls (verified); zero persistence; zero commercial path. Five minutes of input, thrown away on navigation |
| EcowoodsGuide assistant | **UNMEASURED** | Zero `track()` calls in `ChatWidget.tsx` or `app/api/chat/route.ts` (verified). It books appointments and creates leads, and none of it is counted |
| Revenue attribution | **MISSING** | No UTM capture, no session id, no client id. Verified: the only `utm_` strings in the repo are *outbound* credit links to Unsplash in `RotatingBackground.tsx:90,120`. The site attributes other people and captures nothing for itself |
| Server-side funnel events | **MISSING** | `track()` is browser-only (`lib/analytics.ts:97`). Appointment, estimate, acceptance, deposit, job_complete are all server writes and cannot reach GA4 |
| `FloorRecord` (Floor Passport) | **ORPHANED** | Verified: **0** `floorRecord.create/update/upsert` in the entire repo. Only `.count()` at `admin/floor-graph/page.tsx:55`. The schema is well designed and has never held a row |
| `Prediction` | **PARTIAL** | One call site, `lib/actions/quotes.ts:131`, always `PRICE_CAD`. `LABOUR_HOURS`/`MATERIAL_SQFT`/`SCHEDULE_DAYS` never produced; dead close-out code for `SCHEDULE_DAYS` at `outcome/route.ts:135-144` |
| `JobOutcome` margin variance | **PARTIAL** | Actuals are captured; there are no *predicted* cost fields to compare against, so only price accuracy is computable, not labour/material/margin variance |
| `FloorAssessment` / `AssessmentPhoto` / `FrameworkScoring` | **WRITE-ONLY** | Captured, consent-gated, correct — and never read back. Admin shows counts only |
| Referral | **WEAK** | Real form + email + logged consent. No `Referral` model, no referral code, no unique link, no reward automation. The 5%/$250 is applied by a human remembering |
| Consent withdrawal | **MISSING** | `hasLiveConsent`/`withdrawConsent` have zero callers; no withdrawal UI |
| `commercial_cta`, `realtor_cta` | **DEAD** | Declared in the `AnalyticsEvent` union, zero call sites |
| `@ecowoods/ui` `/auth` `/config` `/utils` | **ORPHANED** | Verified: every reference is a `package.json` or `tsconfig.json` path entry. Zero code imports. `packages/utils` has no source files at all |
| `apps/admin` | **DEAD** | No `package.json`, so not a workspace member. Static HTML/JS. Not built by turbo or either `vercel.json` |
| `apps/mobile/frontend/` | **DUPLICATED** | A second, older React Native app beside the current Expo-router app |
| `backend/` (Python/FastAPI/SQLite) | **DISCONNECTED** | A third codebase, unrelated to Prisma or Next. The root `.env.example` documents *this* project's variables, not the real ones |

---

## 3. DUPLICATION REPORT (Deliverable 4)

Genuine duplication, ranked by cost:

1. **`.env.example` documents the wrong application.** It lists `POSTGRES_USER`,
   `SECRET_KEY`, `CORS_ORIGINS` — the dead Python backend. A new contributor
   configures the wrong system. 38 real variables are documented nowhere.
2. **Two mobile apps** — `apps/mobile/app/` (Expo Router, current) and
   `apps/mobile/frontend/` (older, own `package.json`, own `eas.json`).
3. **Four empty workspace packages** carried in dependency graphs and tsconfig paths.
4. **Two configurators sharing one localStorage key.** `ew-studio-v1` and `ew-design-v1`
   — Floor Studio writes into both (`studio-config.ts:227-244`). This is deliberate
   and works, but it means the two tools have one shared mutable state with no owner.

Explicitly **NOT** duplication, despite appearances: `PilotLead`, `QuoteRecovery` and
`QuoteRequest` are three distinct entities, and `QuoteRecovery` has a working
de-duplication via `convertedAt` (`app/api/leads/route.ts:222`).

---

## 4. DATA-FLOW MAP (Deliverable 5) — visitor to actual outcome

```
VISITOR
  │   no utm, no client id, no session id captured        ← BREAK 1
  ▼
TOOL (studio / design / framework / movement / quote-check / chat)
  │   studio+design: config carried in URL or localStorage
  │   movement + quote-check: output discarded on navigate  ← BREAK 2
  │   chat: transcript discarded on reload, zero events     ← BREAK 3
  ▼
ESTIMATE FORM  ──►  POST /api/leads
  │   design arrives as free text inside notes             ← BREAK 4
  ▼
QuoteRequest  (real row, indexed on email/status/userId)
  │   admin reads notes by eye, retypes species by hand    ← BREAK 5
  ▼
Project ──► Invoice ──► Stripe ──► Payment        [REAL, WIRED]
  │
  ▼
JobOutcome (actual cost, actual margin)           [REAL, WIRED]
  │   closes Prediction(PRICE_CAD) only
  ▼
FloorRecord — 0 rows ever written                 ← BREAK 6
  │
  ▼
Maintenance / referral / repeat — no mechanism    ← BREAK 7
```

Five of the seven breaks are *joins that were never made between systems that already
exist*. Only breaks 6 and 7 require building something.

---

## 5. FOUR-PROGRAM GAP ANALYSIS (Deliverable 6)

**Program 1 — Digital Sales Engine.** The journey exists end to end. What is missing is
the *identity* that makes it measurable: a Design ID. The brief's own first item under
Program 1 is `DESIGN IDENTITY → Design ID`, and that is exactly right — it is the
single key that closes breaks 1, 4 and 5 at once. `SAVE MY FLOOR` and
`SPECIFICATION EXPORT` are near-free once an ID exists (the spec sheet is already built).

**Program 2 — Flooring Economics Engine.** Further along than the brief assumes.
`JobOutcome` is live. The gap is narrow and specific: no *predicted* labour/material
fields to compare actuals against, and `Prediction` only ever emits `PRICE_CAD`.
Prediction/ML is correctly gated behind data volume the business does not yet have —
the brief says *"only when enough clean data exists"*, and it does not.

**Program 3 — Decision Intelligence.** The tools are excellent and the privacy stance is
a real asset. The gap is that two of them (`movement`, `quote-check`) are invisible and
inert, and the framework's captured assessments are never read back.

**Program 4 — Customer Ownership.** Auth, portal, invoices, orphan-lead linking all
exist. `FloorRecord` is a designed-but-empty table. This is an extension, not a build —
materially cheaper than the brief assumes.

---

## 6. MONETIZATION MODEL (Deliverable 7)

| # | Feature | Behaviour changed | Revenue mechanism | KPI |
|---|---|---|---|---|
| 1 | Design ID + attribution | Every lead carries the design and the source that made it | Kills spend on channels that don't convert; desk opens the exact floor instead of retyping | Revenue per visitor; revenue per qualified lead |
| 2 | Server-side funnel events | Deposit and job completion become countable | Close-rate visibility per tool | Quote→deposit conversion |
| 3 | Chat instrumentation | The assistant's bookings get counted | Proves or kills the assistant's commercial value | Revenue per chat session |
| 4 | Save My Floor + spec export | Design survives the session; spouse/designer sees it | Multi-decision-maker purchases close more often | Design→quote conversion |
| 5 | Fix `SpecSheet` CTA | The spec actually reaches the form | Recovers a leaking CTA | Quote starts from `/design/spec` |
| 6 | Measure movement + quote-check | Two authority tools become visible | Attribution for top-of-funnel authority traffic | Assisted conversions |
| 7 | Predicted vs actual labour/material | Estimator learns from variance | Margin protection — the highest-leverage dollar on this list | Gross profit per crew-day |
| 8 | Floor Passport from JobOutcome | Customer has a durable asset | Maintenance, recoat, repeat rooms, referrals | CLV; repeat revenue |
| 9 | Referral model + code | Referrals become trackable and rewardable | Lowest-CAC channel becomes measurable | Referral CAC |

---

## 7. PRIORITY MATRIX (Deliverable 8)

Ranked by (revenue × gross profit × data moat) ÷ (complexity × risk).

| Rank | Work | Revenue | Moat | Complexity | Risk | Time to value |
|---|---|---|---|---|---|---|
| 1 | **Design ID + attribution join key** | High | High | Medium | Low | Immediate |
| 2 | **Server-side funnel events** | High | High | Medium | Low | Immediate |
| 3 | **Chat + calculator instrumentation** | Medium | Medium | Low | Very low | Immediate |
| 4 | **Fix SpecSheet CTA + lying `design_handoff`** | Low | — | Trivial | None | Immediate |
| 5 | **Structured design on QuoteRequest + admin decoder** | High | Medium | Medium | Low | Weeks |
| 6 | **Save My Floor / spec export** | Medium | Medium | Medium | Low | Weeks |
| 7 | **Predicted labour/material on Prediction** | High | Very high | Medium | Low | Months to pay off |
| 8 | **Floor Passport from JobOutcome** | Medium | Very high | High | Medium | Months |
| 9 | **Referral model + code** | Medium | Medium | Medium | Low | Months |
| — | Prediction/ML layer | — | — | High | High | **Blocked on data volume — do not start** |
| — | B2B portal / Ecowoods OS | — | — | Very high | Very high | **Not phase 1, per the brief** |

Ranks 1–4 are the measurement foundation. The brief calls this PATCH GROUP 1 and puts
it before everything, and the evidence agrees: without rank 1, none of ranks 5–9 can be
proven to have worked.

---

## 8. PATCH ROADMAP (Deliverable 9)

| Patch | Name | Group | Production change |
|---|---|---|---|
| **PG0** | This audit | 0 | Docs only — SHIPPED |
| **MEAS-01** | Design ID — one identity from first render to job outcome | 1 | Yes — SHIPPED |
| **MEAS-02** | The funnel ledger — six server-side commercial stages, plus /admin/funnel | 1 | Yes — SHIPPED |
| **MEAS-03** | The unmeasured tools: chat, movement, quote-check; kill dead events | 1 | Yes |
| **MEAS-04** | The lying handoff: fix `SpecSheet` CTA, make `design_handoff` truthful | 1 | Yes |
| **SALE-01** | Structured design on `QuoteRequest` + admin decoder (stop retyping) | 2 | Yes |
| **SALE-02** | Save My Floor + specification export | 2 | Yes |
| **ECON-01** | Predicted labour/material, so variance is computable | 4 | Yes |
| **OWN-01** | Floor Passport — first write to `FloorRecord`, from `JobOutcome` | 7 | Yes |
| **OWN-02** | Referral model, referral code, reward attribution | 7 | Yes |
| **HYG-01** | Delete the four empty packages, the duplicate mobile app, fix `.env.example` | — | Build only |

Each ships as one `.patch`, independently reviewable, independently reversible,
with the 66-guard suite green and `tsc` clean. No patch mixes unrelated feature work.

---

## 9. SUCCESS MEASUREMENT PLAN (Deliverable 10)

The test is not "the funnel is instrumented". The test is a question the business
cannot answer today and will be able to answer after MEAS-01 and MEAS-02:

> **Of the last 100 deposits taken, how many began in Floor Studio, and what was the
> gross margin on those jobs versus the ones that did not?**

Today that question has no answer at any price. There is no join key. When it has an
answer, Program 1 has succeeded and Programs 2–4 become measurable in turn.

Secondary, in order of when they become answerable:
1. Revenue per 1,000 Floor Studio sessions (after MEAS-01/02)
2. Quote→deposit conversion by originating tool (after MEAS-02)
3. Labour and material variance by species and crew (after ECON-01, plus ~1 season of jobs)
4. Referral CAC, calculated not estimated (after OWN-02)
5. CLV (after OWN-01 plus one maintenance cycle)

---

## 10. WHAT I WILL NOT DO

Per the brief's `NO` list and the evidence:

- Not rebuilding `/floor-studio`, `/design`, the framework, the movement calculator,
  published pricing, or case studies.
- Not building a prediction/ML layer. `JobOutcome` does not yet hold enough rows, and
  the brief gates this on *"enough clean data"*. Starting it now would be a model
  trained on nothing, presented as intelligence.
- Not building a subscription, a marketplace, a B2B portal, or Ecowoods OS.
- Not weakening Floor Studio's on-device privacy. The Design ID in MEAS-01 is a
  configuration identity, not a person, and no room image will be retained by it.
- Not turning the framework assessment or quote-check into disguised lead forms.
  Their neutrality is the asset.
