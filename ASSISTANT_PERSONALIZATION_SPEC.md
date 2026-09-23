# Ask Francisco — personalization spec (2026-09-23)

## Extended `WorkspaceState`, not a second store

`lib/assistant-workspace/types.ts` gained two new interfaces on the existing
`WorkspaceState` — no parallel state object, no second persistence key
(directive rule 4: "do not create a second project database"):

```ts
interface WorkspacePersonalization {
  neighbourhood?: string;      // "Rexdale" — verbatim, never geocoded
  floorCondition?: string;     // "scratched and dull" — verbatim, never a diagnosis Francisco invented
  otherTrades: Partial<Record<string, TradeMentionStatus>>;  // 'roof' -> 'mentioned' | 'planned' | 'in-progress' | 'done'
}
interface WorkspaceActionMemory {
  dismissed: string[];
  completed: string[];
}
```

Both are fields on `WorkspaceState`, sanitized in `state.ts`
(`sanitizePersonalization`, `sanitizeActionMemory`) with the same discipline
every other field already had: length caps, enum validation, unknown values
dropped rather than carried through. `applyPatch` merges `personalization`
field-by-field (naming only `neighbourhood` doesn't erase `floorCondition` —
same pattern as `currentFloor`/`targetFloor`), and `hydrateWorkspaceState`
sanitizes both from an untrusted localStorage blob or client-sent snapshot.

They persist through the existing `persistence.ts` localStorage round-trip
with zero changes to that file — it already serializes/deserializes the
whole `WorkspaceState`.

## Where the data actually comes from

Only two write paths, both already-existing mechanisms extended, not new
ones:

1. **`attach_to_project`** (`chat-tools.ts`'s `executeAttachToProject`) gained
   `neighbourhood`, `floorCondition`, `trade`, `tradeStatus` inputs. The
   system prompt tells the model to call this "the moment you learn
   something," not to batch it to the end of a turn.
2. **Nothing else writes personalization.** No keyword-fallback path was
   extended to guess these fields from free text — `interpretMessage()` in
   `interpret.ts` was deliberately left untouched, since it only runs when
   the model is unavailable, and guessing a neighbourhood or floor condition
   from regex is exactly the kind of invention the directive prohibits.
   When the model is down, these facts simply aren't captured that turn —
   same honest degradation the rest of the keyword fallback already has.

## "Don't ask again," concretely

`workspaceSnapshotBlock()` (`chat-tools.ts`) now prefixes the JSON state dump
with: *"everything here is already known; do not ask for it again."* The
system prompt's new NEVER RE-ASK WHAT'S ALREADY KNOWN rule points at this
block explicitly. This is a prompt-level guarantee, not a server-enforced
one — there's no code path that would block the model from asking a
redundant question, because "did this response ask something already
answered" isn't mechanically checkable the way "does this card's id appear
in dismissed[]" is. Where mechanical enforcement WAS possible (dismissed
action cards), it was built — see `ASSISTANT_ACTION_ENGINE_SPEC.md`.

## Minimum-question principle

System prompt (`system-prompt.ts`) gained an explicit rule: ask the smallest
question that unblocks the next useful thing, never a list in one turn. This
is prompt-level guidance, same honesty note as above — there is no
structural way to enforce "ask exactly one question" against free-text
model output without a much larger change (e.g. a second model pass scoring
the reply, which has its own cost and false-positive risk). Scoped out this
pass.

## Removing "pending_key" from what the homeowner reads

**The concrete bug this pass fixed:** `pending_provider` cards'
`body` field — rendered verbatim in the UI — previously contained the raw
internal words `"pending_key"` and `"adapter"` (e.g. *"House profile adapter
is not live yet (pending_key)"*). Directive rule 24 names this exact
failure. Every `pending_provider` card body was rewritten to plain homeowner
language (*"I don't have verified property data for that address yet, so I
won't guess at it"*); the internal `note`/`provider.note` fields — which are
tool-output text the model reads, never rendered to the visitor — keep the
precise internal language, since that's genuinely useful for the model's own
reasoning and for engineers reading logs. `chat-tools.test.ts` now asserts
no card body contains either string, for all three pending-provider tools.

The system prompt also gained a standing rule (NEVER SAY "pending_key" ...)
covering the model's own free-text reply, which the card-body fix alone
doesn't reach — a rendered card is deterministic, but `result.text` is the
model's own prose, so that's still prompt-level guidance, not
mechanically enforced.

## Answer length

System prompt tightened from a single "under ~120 words" line to: 20-80
words for a simple question, up to ~150 only when a comparison or tool
result genuinely needs it, structured as answer → at most one clarifying
question → one next step. This is prompt-level (there is no server-side
truncation, which would risk cutting a real published-band number mid
sentence) — verified by inspection of the prompt text, not by a runtime
assertion, since word-count enforcement on LLM output belongs in an eval
suite this pass didn't build.

## What's explicitly not built here

- **Account-gated persistence** (directive rule 33: anonymous gets useful
  free conversation, an account preserves history/starter allowance). Auth.js
  already exists (`lib/auth.ts`) but nothing in `/assistant` reads a session
  today — `WorkspaceState` is anonymous-localStorage-only, unchanged this
  pass. Wiring "save this project to my account" is a real feature (a
  Project-linked-to-User write path, a sign-in prompt at the right moment,
  not just a login button) and wasn't attempted alongside personalization
  memory to keep this diff reviewable.
- **Property type, approximate age, budget, timing** (directive rule 4's
  fuller list) — no field added for these. `neighbourhood` and
  `floorCondition` were the two the directive's own worked examples (rules
  5, 45) actually exercise; the rest can extend
  `WorkspacePersonalization` the same way once there's a concrete
  conversation flow that needs them — adding unused fields "for
  completeness" is exactly the premature-abstraction pattern to avoid.
