# Ask Francisco — credit ledger spec (2026-09-23)

`lib/assistant-workspace/credit-ledger.ts` + three Prisma models
(`prisma/schema.prisma`, migration `20260923223246_phase3_renovation_credits`).
Verified against a real local PostgreSQL 16 instance — see
`ASSISTANT_PHASE3_COMMERCIAL_AUDIT.md` for exactly what that means and its
limits.

## Schema

```
CreditWallet   — one per User. balance (spendable now) + reserved (held).
CreditTransaction — one row per ledger event. type (PURCHASE |
  PROMOTIONAL_GRANT | RESERVE | SETTLE | RELEASE | REFUND), amount (always
  positive — type carries the sign/meaning), reason, optional orderId /
  analysisId, and a UNIQUE idempotencyKey — the actual enforcement
  mechanism, not an application-level check.
RenovationAnalysis — one row per analysis run/attempt. status (RESERVED |
  RUNNING | COMPLETED | FAILED | RELEASED), creditCost, engineVersion,
  resultJson, keyed by designId (Ask Francisco's WorkspaceState.designId —
  NOT the commercial Project.id, since a homeowner running a paid analysis
  hasn't necessarily converted to a formal Project yet).
```

Balance accounting: `PURCHASE`/`PROMOTIONAL_GRANT`/`RELEASE`/`REFUND`
increase `balance`. `RESERVE` moves `balance → reserved` (both change,
nothing is created or destroyed). `SETTLE` decreases `reserved` only —
the credits are spent, gone, never returned to `balance`.

## The state machine (directive rule 14, 17)

```
                    ┌─────────┐
  grantCredits() →  │ balance │
                    └────┬────┘
                         │ reserveCredits(amount, analysisId)
                         ▼
                    ┌──────────┐
                    │ reserved │
                    └─┬──────┬─┘
     settleReservation()  releaseReservation()
        (success)            (failure/timeout/cancel)
              │                    │
              ▼                    ▼
         [spent, gone]      balance += amount
                                (fully reversed)
```

`refundSettledAnalysis()` is the one path back from "spent" — a distinct
function from `releaseReservation` (which un-does a reservation that never
settled), for a support decision after the fact.

## Idempotency — the actual mechanism (directive rule 15, 30)

Every mutating function takes an `idempotencyKey`, unique at the database
level. A retried call with the same key hits `CreditTransaction`'s unique
constraint, and the function returns `{ ok: true, duplicate: true, ... }`
with the ALREADY-COMMITTED result — it never re-runs the balance mutation.
This is what makes double-click, browser retry, and duplicate webhook
delivery all resolve to exactly one credit movement, verified by
`credit-ledger.integration.test.ts`'s explicit duplicate-key and
concurrent-`Promise.all` tests against a real database.

**A real bug this caught, fixed, and re-verified**: the first
implementation tried to recover from a unique-constraint violation by
querying the wallet again *inside the same Postgres transaction* — Postgres
aborts an ENTIRE transaction on the first error (`25P02`), so that recovery
query itself failed. Fixed by catching outside `db.$transaction` and
re-reading in a fresh one. A mocked Prisma client would not have surfaced
this; the real-database test did.

## Row locking (directive rule 40 — never trust a stale read)

`reserveCredits`/`settleReservation`/`releaseReservation`/`grantCredits` all
take a `SELECT ... FOR UPDATE` lock on the wallet row before reading
balance — two concurrent requests against the same wallet serialize rather
than both reading a stale balance and both succeeding. Verified by the
concurrent-grant test (`Promise.all` of two identical-key grants → exactly
one credit added, exactly one call reports `duplicate: true`).

## Analysis-level idempotency (`analysis-execution.ts`)

`runRenovationAnalysis`'s `analysisId` is DERIVED deterministically from the
caller's `idempotencyKey` (SHA-256 → UUID-shaped string), not random — a
retry of the same logical request resolves to the same `RenovationAnalysis`
row, and a call that finds an existing `COMPLETED` row with a saved result
returns it immediately rather than re-reserving. `upsert` (not `create`)
handles the "retry of an in-flight or previously-failed attempt" case.
Verified end-to-end by `analysis-execution.integration.test.ts`'s duplicate
call test: two calls with the same key move the balance by exactly one
analysis's cost (20 credits), not two.

## What this explicitly does NOT do (scope, not oversight)

- **No expiration.** Directive rule 13 lists it as "if applicable" — with a
  single 20-credit pack that maps to exactly one analysis, an unused
  balance sitting indefinitely isn't a real problem yet. Add an
  `expiresAt` column when a larger pack or a subscription makes it one.
- **No admin UI for promotional grants.** `grantCredits({ type:
  'PROMOTIONAL_GRANT' })` is callable from server code (a future admin
  route or script); no route exposes it to end users, and none should.
