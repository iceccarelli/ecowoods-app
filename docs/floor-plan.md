# Personal Floor Plan spec PDF (EW-0004)

New-files-only build. Does not touch EW-0001/EW-0002/EW-0003, Floor Studio, `studio-products.ts`, `/design`, or `pricing.ts`.

## Buyer, problem, deliverable

**Buyer:** a homeowner who already configured a layable floor in Floor Studio and wants the specification in writing — for a spouse, a designer, or a condo board.

**Problem:** `/design/spec` already renders this as a free, on-screen document with a "Download as PDF" button — but that button is `window.print()`, not a stored, forwardable, server-generated PDF, and it carries no fixed record a customer can revisit by link. `studio-products.ts` already declares this exact rung (`id: 'floor-plan'`, `priceCad: null`, `published: false`) — publishing a figure by editing that file is the one thing its own header says no engineer or agent gets to do in a patch, so this ships as a sibling NEW product instead.

**Deliverable:** a real, stored PDF: species, finish, pattern (direction of lay), board width, seasonal movement for that width, the indicative installed range, and a pre-installation checklist cited to the Well-Installed Framework's moisture/substrate/specification pillars. Every fact in it is imported from the existing catalogue and framework — this module invents nothing, including no "grade" field, since the catalogue does not track one and fabricating one would be exactly the kind of unverified claim `honesty-kernel` product law exists to prevent.

## Why no human step

Unlike EW-0002/EW-0003, this product needs no estimator. Those two involve Ecowoods judging *someone else's* document (a competitor's quote, a listing's photos); this one turns the *customer's own, already-configured* floor into a formatted document — a mechanical transformation of published data, not an expert opinion. `ensureFloorPlanReport()` (`lib/floor-plan/generate.ts`) therefore runs on first view of `/floor-plan/[id]`, with no admin workbench.

## Payment event

`POST /api/floor-plan/checkout` decodes and validates the share code (`decodeStudioDesign()` already refuses anything not `isLayable`) **before** creating the Stripe session — charging $99 for a floor Ecowoods cannot lay is structurally impossible, not just a copy promise. Guest `User` + PENDING `Order`, metadata `{ orderId, userId, kind: 'floor-plan' }`, existing unmodified `/api/webhooks/stripe` marks it PAID.

## Pricing (Class C)

$99 CAD, declared in `content/constants/floor-plan-product.ts`. Same posture as every other paid constants file on this branch: the ecowoods-opportunity agent's recommendation, not an owner-confirmed price — see the file header and `ECOWOODS_AUTONOMOUS_EXECUTION_PROTOCOL.md` §7/§23.

## Deliberate deviation: the share code, not a form, is the whole checkout

The brief's SSV lists `/floor-plan` (paste code, pay) and `/floor-plan/[id]` (paid unlock) — this collects the code at checkout, since unlike EW-0001/EW-0003 there is no second, larger set of fields worth deferring to a post-payment step. `lib/floor-plan/share-code.ts` accepts a bare code, a `/design/spec?design=` link, or a `/floor-studio` address-bar link (the three shapes this site's own share links actually take) and normalizes all three before handing them to `decodeStudioDesign()`.

## Order.notes protocol

Two markers, `FP_DESIGN:` (the paid share code, written at checkout) and `FP_REPORT:` (the generated PDF, appended once) — never `QI_REPORT:` or `LFR_REPORT:`. `Order.status` moves PENDING → PAID (webhook) → FULFILLED (`ensureFloorPlanReport`, on first successful view).

## Integration requests (orchestrator / human — not this PR)

- A CTA inside `/floor-studio` or `/design` pointing at `/floor-plan` (forbidden here — editing either page to add a link).
- Owner Class C sign-off on $99.
- `floor_plan.checkout_created` / `.report_generated` events into `lib/analytics.ts`'s closed union.
- Refresh the GitHub token blocking `git push`/`gh pr create` for this branch.
