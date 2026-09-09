# The Floor Graph

**Status:** foundation, consented capture and the prediction ledger shipped
(`FG-01`, `FG-02`, `FG-03`). Nothing here is exposed publicly.
**Owner:** whoever last touched `apps/web/lib/floor-graph/`.
**Guard:** `pnpm verify:floorgraph` (`scripts/verify-floor-graph.mjs`), in the
pre-build gate.

---

## 1. What this is, and what it is not

The Floor Graph is the structured record of **what was actually true about a
floor**: what was there before, what was measured, what was done, what it cost,
and what happened afterwards.

It is not a CRM, and the strategic case for building it rests on that
distinction. Generic field-service software — Jobber from CAD 29/month,
Housecall Pro from CAD 59/month, CompanyCam from CAD 63/month — already manages
jobs, and each of them publishes a flooring landing page. None of them models a
floor. They record that a job happened; they do not record that the subfloor
read 14.8% at the north wall in February and that the same floor cupped
eighteen months later.

Everything else in this repository can be rebuilt by a competent team in a
quarter: the Next.js app, the Prisma schema above this section, the registry,
the agentic API, any model anyone points at it. A structured record of two
thousand Toronto floors cannot be rebuilt at all without doing the work. That
asymmetry is the whole thesis.

## 2. The test every column had to pass

Not "could we collect this". Two questions, in order:

1. **What prediction does this field make measurably better?**
2. **What decision does that prediction change?**

A field that cannot answer both is not in the schema. That is why there is no
`customerMood`, no `crewNotes` blob and no `photoTags`. They are collectable
and they are inert.

## 3. The models

| Model | What it holds | Why it earns its place |
|---|---|---|
| `ConsentRecord` | Append-only consent ledger: purpose, verbatim wording, surface, version, granted/withdrawn | Retention of a photograph and use of it to train a model are two purposes. A boolean cannot say which, when, on what wording, or that it was withdrawn. |
| `FloorRecord` | One physical floor: coarse location, storey, species, board dimensions, pattern, finish system, substrate, install method, install date | The passport spine. A floor outlives both the customer and the job, which is the point. |
| `FloorAssessment` | One look at one floor at one moment: stated intent, observed condition, moisture, RH, temperature, instrument, recommendation, reviewer | `source` and the reviewer fields are what stop a photo triage and a measured visit from being averaged together. |
| `AssessmentPhoto` | A retained photograph, its storage URL, and the consent row it is retained under | `consentId` is `NOT NULL`. There is no code path producing a retained image whose lawful basis cannot be named. |
| `FrameworkScoring` | An anonymous scoring of somebody's quote against the Well-Installed Framework | The one dataset here meant to become public. It has no identifiers and is never to gain any. |
| `JobOutcome` | What actually happened: labour hours, machine hours, grit sequence, coats, cure, material, waste, costs, schedule, defects, callbacks, warranty claims | The half no competitor can copy off a public repository, because it does not exist until somebody sands a floor. |
| `Prediction` | Every number the business commits to, with its inputs, closed later against the actual | A model never scored against reality is a rumour with a confidence interval. |

## 4. Three structural decisions

### 4.1 No hard foreign key to the commercial record

`FloorRecord.originProjectId`, `FloorAssessment.quoteRequestId`,
`JobOutcome.projectId` and `Prediction.projectId` are indexed UUID columns with
**no** `@relation`. Joins happen in application code.

A Prisma relation would bring referential integrity and, with it, a cascade.
Erasing a lead under a privacy request would silently delete the outcome record
for a floor that still exists in a house. The commercial record and the physical
record have different lifetimes and different lawful bases, and the schema has
to say so. `verify-floor-graph.mjs` fails the build if a relation is added.

### 4.2 Consent is a row, not a boolean

PIPEDA case summary **#2006-349** held that photographs of a dwelling's
interior are personal information about the person who lives there, and that a
notice which did not disclose that photographs would be taken was not consent.
The joint federal, provincial and territorial regulators' **principles for
generative AI (7 December 2023)** add that using that material to train a model
is a separate purpose requiring its own basis.

So: `ConsentRecord` is append-only, scoped to a purpose, and stores the exact
wording that was shown. A withdrawal is a new row plus a stamp on the open
grants — never an update in place. "We held consent on 3 March and it was
withdrawn on 9 April" is defensible. "Consent is currently false" is not.

The wording constants live in `lib/floor-graph/wording.ts` and are the same
strings rendered to the person, so the record cannot drift from the screen.
Editing one without bumping its version fails the build.

### 4.3 The benchmark table has no identifiers and is never to gain any

`FrameworkScoring` holds twenty-seven answer characters, a framework version, a
derived score and verdict, a coarse region, and a **date** — not a timestamp,
because on a low-volume table an exact millisecond is a fingerprint that
re-links an anonymous row to the request log that produced it.

The commercial reason is as strong as the privacy one. The benchmark exists so
that this business can eventually publish a sentence no competitor can publish
— *"of 1,240 GTA hardwood quotes scored against v1.0, 61% did not answer
criterion 1.3"* — and that sentence is only worth publishing if the dataset
behind it could be released whole tomorrow. The guard enforces the column list
so the unsafe version is unrepresentable rather than merely discouraged.

## 5. Observation versus inference

`observedSpecies`, `observedSubstrate`, `moisturePctWood`,
`moisturePctSubfloor`, `relativeHumidityPct` and `temperatureC` are filled by a
person with an instrument, or they stay null. `instrument` records what took the
reading.

A model's guess goes into `AssessmentPhoto.observations`, keyed by the run that
produced it, where it can be scored later and discarded if it was wrong. It
never enters an observation column.

This is not fastidiousness. A dataset in which measured and inferred values
share a column cannot be used to train anything, because there is no way to
learn which of the two you are fitting to. Pooling them destroys the only asset
the exercise was for.

## 6. Provenance, retention, erasure

- **Provenance.** Every assessment carries `source` (`PHOTO_TRIAGE`,
  `MEASURE_VISIT`, `JOB_EXECUTION`, `FRAMEWORK_ASSESS`, `IMPORT`). Aggregate
  queries that mix sources without saying so are a reporting bug.
- **Retention.** Photographs are retained only under a live
  `ASSESSMENT_PHOTOS` grant. There is no default retention period yet; setting
  one is an open decision for the owner, and it belongs in this section when it
  is made.
- **Erasure.** `FloorRecord`, `FloorAssessment` and `AssessmentPhoto` carry
  `erasedAt`. The procedure on a request is: withdraw the consent
  (`withdrawConsent`), delete the stored blobs, stamp `erasedAt`, and null the
  identifying columns on `FloorRecord` — the physical facts about a floor stop
  being personal information once they cannot be tied to a person, and the
  aggregate record survives. `JobOutcome` and `Prediction` carry no personal
  data by construction and are unaffected.
- **Export.** A subject's Floor Graph rows are reachable by
  `subjectEmail` on the consent ledger plus the soft links; there is no export
  endpoint yet. Build it before the first request arrives, not after.

## 6a. The prediction ledger, and how the loop closes

`Prediction` is written at the moment a number is committed and closed later
against what happened. Two call sites exist today:

| Written | Where | Closed |
|---|---|---|
| `PRICE_CAD`, model `estimator` | `saveEstimate()` in `lib/actions/quotes.ts`, when the written estimate is saved | `POST /api/admin/floor-graph/outcome` with `sellingPriceCad` |
| `SCHEDULE_DAYS` | not yet written by any call site | `POST /api/admin/floor-graph/outcome` with `scheduleDays` |

`GET /api/admin/floor-graph/accuracy` reports mean signed error, MAPE and the
share within 10%, split by kind and model, **next to the count of predictions
still open**. That last number is the honest one: four hundred open rows and
twelve closed ones is not a twelve-row accuracy figure, it is a broken closing
process, and a dashboard that reported the MAPE alone would be the most
misleading thing in the system.

Two rules the code enforces and the reviewer should keep enforcing:

- **The feature vector is captured before the outcome is known.** `inputs` is
  written at prediction time. A vector reconstructed afterwards is contaminated
  by the answer, which is how a model that looks excellent offline turns out to
  be worthless in production.
- **Error is signed.** A business 8% under on every job has a different and far
  more fixable problem than one that is ±8% at random. An absolute-only ledger
  cannot tell them apart.

Nothing about accuracy may be published externally off this table without a
study designed for the purpose. Under Competition Act s.74.01(1)(b) a
performance claim requires adequate and proper testing that exists **before**
the claim is made; after Bill C-59 the exposure is the greater of CAD 10
million or 3% of worldwide gross revenue, and since June 2025 a private party
can seek leave to bring it. The ledger is the raw material for that study, not
a shortcut past it.

## 7. Open decisions

These are the owner's, not the schema's. They are listed here so they stay
visible rather than being settled by whoever writes the next migration.

1. **Photograph retention period.** Indefinite-under-consent is the current
   behaviour. A stated period is better.
2. **Does the Floor Record travel with the property?** The passport thesis says
   yes. That is a legal and commercial commitment, not a column.
3. **Region granularity on the benchmark.** Municipality is the current plan.
   Forward sortation area would be more useful and less safe.
4. **Who may see photographs.** Today: whoever can reach the admin. A named
   role and an access log belong here before the corpus is large enough to
   matter.

## 8. What is deliberately not built yet

- **No public Floor Graph API.** Exposing an endpoint before the data behind it
  is genuinely valuable produces an API nobody pays for and a contract that is
  expensive to change. The `/api/v1` registry stays what it is until the
  benchmark and the outcome corpus are real.
- **No diagnosis from photographs.** A claim that a model identifies floor
  damage to some accuracy is a *performance claim* under Competition Act
  s.74.01(1)(b), and the testing that substantiates it has to exist **before**
  the claim is published — with penalties after Bill C-59 reaching the greater
  of CAD 10 million or 3% of worldwide gross revenue. The corpus this schema
  builds is the precondition for that study, not a substitute for it.
- **No storage of a competitor's quote document.** `/api/quote-review`
  deliberately does not retain the file, and this schema gives it nowhere to go.
