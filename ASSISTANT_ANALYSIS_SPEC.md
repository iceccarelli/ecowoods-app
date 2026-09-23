# Ask Francisco — analysis execution spec (2026-09-23)

## The execution boundary (directive rule 21)

`lib/assistant-workspace/analysis-execution.ts`'s `runRenovationAnalysis` is
the one function that sequences the paid analysis. It is a real server-side
capability with an explicit boundary — not "another generic chatbot
paragraph":

```
input:  userId, designId, WorkspaceState (normalized project facts —
        the same object type the whole workspace already uses, not a
        second representation), an idempotencyKey
process: computeRenovationSequence() → reserveCredits() →
         buildDetailedRenovationAnalysis() → settleReservation() |
         releaseReservation() on failure
output: DetailedRenovationAnalysis — items[] (rank, label, reason,
        costContext, nextStep), assumptions[], uncertainty[]
```

No LLM call anywhere in this path. Both engines
(`computeRenovationSequence`, `buildDetailedRenovationAnalysis`) are pure,
deterministic functions over `WorkspaceState` — see
`ASSISTANT_ACTION_ENGINE_SPEC.md` (Phase 2) for the sequencing logic itself;
Phase 3 adds the paid deliverable's expanded content
(`buildDetailedRenovationAnalysis`, `renovation-analysis.ts`):

- **Cost context** — for the floor project, a REAL published Ecowoods band
  (`bandForWork` + `estimateInstalledRangeCad`, the same functions
  `get_ecowoods_band` uses) when species + square footage are both known;
  an honest "not yet known" note otherwise. For every non-floor trade,
  always an honest "no verified cost data available... Ecowoods does not
  install this trade" — never a second, invented number for a trade
  Ecowoods doesn't do.
- **Assumptions** — two general, stated assumptions (no unstated emergency
  overrides the order; projects are independent unless the visitor said
  otherwise) — never a claim about THIS house's condition beyond what was
  said.
- **Uncertainty** — the visitor's own `pendingQuestions`, plus missing
  square footage / species flags, computed from what's actually absent from
  `WorkspaceState` — never a generic filler list.

## Cost routing (directive rule 35)

No model call at all for the core deliverable — the cheapest possible
routing (deterministic logic, zero marginal compute cost) for exactly the
part of the job that doesn't need a model: sequencing rules and real
catalog lookups. This is a deliberate choice, not a missing feature — see
`ASSISTANT_UNIT_ECONOMICS.md` for why what the customer pays for is
Francisco recognizing the moment and assembling the deliverable, not tokens.

## Persistence and versioning (directive rule 23-26)

`RenovationAnalysis` (Prisma) — `resultJson` (the full
`DetailedRenovationAnalysis`), `engineVersion`
(`renovation-analysis.ts`'s exported `RENOVATION_ANALYSIS_ENGINE_VERSION`,
bumped whenever the sequencing/cost-context logic changes in a way that
would change a past result), `status`, `creditCost`, `designId`,
`generatedAt`. `getRenovationAnalysis(id)` / `listRenovationAnalyses(userId, designId)`
support reading a result back later (`GET /api/assistant/analysis/[id]`,
ownership-checked). **Rerun**: calling `runRenovationAnalysis` again with a
NEW `idempotencyKey` (a fresh user action, e.g. clicking "Analyze my house"
again after adding new project facts) reserves and charges again — a rerun
is a distinct billable action, never silently free, per directive rule 26.
Calling it again with the SAME key returns the cached completed result at
no additional charge (see `ASSISTANT_CREDIT_LEDGER_SPEC.md`).

## Verified for real

`renovation-analysis.test.ts` (pure, 13 tests) covers
`buildDetailedRenovationAnalysis` directly — real published bands, honest
non-floor gaps, uncertainty derivation, pendingQuestions passthrough.
`analysis-execution.integration.test.ts` (5 tests, real Postgres) covers
the full orchestration including the golden-test assertion: a rich,
realistic `WorkspaceState` (Rexdale, selling-soon, 900 sq ft, scratched
floor, roof mentioned) produces a result whose `uncertainty` array does NOT
ask for square footage — i.e., it demonstrably used the stored context.
