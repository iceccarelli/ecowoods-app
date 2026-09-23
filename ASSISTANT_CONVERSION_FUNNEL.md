# Ask Francisco — conversion funnel spec (2026-09-23)

## Events (directive rule 32-33)

Added to `lib/analytics.ts`'s `AnalyticsEvent` union, fired via the existing
`track()` (GA4, no PII by construction — every param is a closed enum, a
count, or an already-public catalog id, never a balance, price, address,
email, or anything the visitor typed):

```
workspace_paid_action_shown     — PaidAnalysisAction mounts (creditCost param, a public constant)
workspace_account_prompt_shown  — the "Sign in to continue" link is shown/clicked
workspace_checkout_started      — "Buy credits" clicked
workspace_payment_succeeded     — (wired for the webhook path — see note below)
workspace_analysis_started      — "Analyze my house" clicked
workspace_analysis_completed    — POST /api/assistant/analysis/run returned ok
workspace_analysis_failed       — run failed (code param: insufficient_credits | not_enough_context | network | unknown)
workspace_analysis_report_viewed — AnalysisResultCard actually rendered
```

Existing Phase 0-2 events this funnel builds on: `workspace_open`,
`workspace_project_created`, `workspace_objective_selected`,
`workspace_measure_requested` / `_estimate_requested` / `_quote_requested`
(the Ecowoods-execution side, unchanged, kept separate per directive rule
31).

**Note on `workspace_payment_succeeded`**: declared in the enum for the
funnel's completeness, but nothing fires it yet — the moment payment
actually succeeds is server-side, inside the Stripe webhook
(`app/api/webhooks/stripe/route.ts`), which has no client to call `track()`
from. Firing a server-side conversion event into GA4 needs the Measurement
Protocol (a server-to-GA4 HTTP call with a client id this app doesn't yet
capture) — a real, separate piece of work, not a same-pass addition. Until
then, `workspace_checkout_started` → the next session's
`workspace_analysis_started` (which only reaches "enough credits" once a
purchase landed) is the closest proxy this pass ships.

## The funnel this measures

```
assistant_visit (workspace_open, existing)
  → meaningful_context (workspace_project_created / _objective_selected, existing)
    → paid_action_shown (NEW — the moment Phase 2's deepAnalysisEligible gate opens)
      → account_prompt_shown (NEW, only if not signed in)
        → checkout_started (NEW)
          → [payment — see note above]
            → analysis_started (NEW)
              → analysis_completed | analysis_failed (NEW)
                → report_viewed (NEW)
                  → workspace_measure_requested (existing — Ecowoods execution)
```

Measuring free→account, account→purchase, purchase→analysis completion,
analysis→Ecowoods lead (rule 32) is possible once
`workspace_account_prompt_shown` → `workspace_checkout_started` →
`workspace_analysis_completed` → `workspace_measure_requested` are joined
in GA4/whatever BI layer reads these events — that reporting setup is
outside this repo's code.

## Known limitation: conversation transcript continuity (directive rule 12,
48)

`WorkspaceState` (the durable project facts) persists across the checkout
round trip via localStorage — Francisco genuinely never re-asks what's
already known after a visitor signs in, buys credits, and returns. The
conversation TRANSCRIPT (the visible message bubbles) does not persist —
it's React state, reset on page reload, same architectural choice this
workspace's docs already made for the corner widget's chat
(`NEW_ASSISTANT_ARCHITECTURE.md`'s "central object" table). A returning
visitor sees one seeded "Payment complete — picking up where we left off"
message rather than their full prior conversation replayed.

This is a real, named gap against directive rule 12's "never make the
homeowner restart the conversation" — it does NOT restart the PROJECT (the
facts survive, the paid action is right there to run), but it does reset
what's visibly on screen. Closing it fully means persisting the message
transcript itself (a real architectural addition — what to persist, for how
long, and whether an anonymous visitor's full conversation should live in
localStorage indefinitely are product decisions, not a mechanical fix) —
scoped as the next increment, not silently accepted as done.

## Unit economics cross-reference

See `ASSISTANT_UNIT_ECONOMICS.md` (Phase 2) for the model/compute cost
side — unchanged by Phase 3 since the paid analysis itself makes zero model
calls. The new cost surface Phase 3 introduces is Stripe's own processing
fee (≈2.9% + $0.30 CAD per transaction, standard published Stripe pricing)
against the proposed $20 CAD price — worth confirming against the real
number once live keys are configured, not estimated further here.
