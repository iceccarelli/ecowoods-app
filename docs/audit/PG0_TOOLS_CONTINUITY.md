# PG0 — TOOL CONTINUITY AUDIT

Does a tool's output survive, and does it reach the business?

| Tool | Output persists? | Reaches the business? | Measured? |
|---|---|---|---|
| Floor Studio | Yes — localStorage `ew-studio-v1`, URL share code, `FS-XXXXXXX` ref | Yes, as free text in `notes` | Yes, 14 events |
| Floor Designer `/design` | Yes — localStorage `ew-design-v1` | Weakly — bare `/#quote`, no params | One event |
| `/design/spec` sheet | Yes — querystring + localStorage | **No — CTA is broken** | Fires a false success |
| Framework assess | Yes — `?a=` code in URL | Separate email only, never a lead | Yes |
| Quote-check | **No — discarded on navigate** | No | **No** |
| Movement calculator | **No — discarded on navigate** | **No** | **No** |
| EcowoodsGuide chat | **Transcript discarded on reload** | Yes — writes rows directly | **No** |
| Estimate form | Yes — `QuoteRequest` row | Yes, this is the endpoint | Yes, 6 events |
| `/contact` | N/A — static NAP page, no form | Links to `/estimate`, no params | `tel_click` only |

## The broken CTA

`app/design/spec/SpecSheet.tsx:97`

```ts
const quoteHref = `/#quote?spec=${encodeURIComponent(summary)}`;
```

The query string is placed **after** the hash fragment, so it is part of the fragment,
not the search. `EstimateForm.tsx` reads `design` from `window.location.search` and only
`#photo-triage` from the hash. The `spec` parameter is silently discarded on arrival.

It does not visibly break only because `SpecSheet.tsx:62-69` re-saves the config to
localStorage as a side effect, so the same data arrives by a different road. The
purpose-built mechanism on this button has never worked.

Worse: `SpecSheet.tsx:156` fires `design_handoff` on this click. **Analytics records a
successful handoff on the one CTA that loses its payload.** This is the most dangerous
finding in the audit, because it is a metric that lies in the optimistic direction.

## The manual bridge

`studio-config.ts:330-332` states the intended workflow in its own comment: *"the desk
pastes it back into /floor-studio and sees the floor."*

Verified: there is **no** `decodeStudioDesign` or `studioRef` usage anywhere under
`app/admin/` or the customer portal. The bridge from a customer's design to the
estimator's screen is a human copying a string out of an email. `QuoteRequest.species`
(a `Json?` column) is populated only by an admin retyping it (`lib/actions/quotes.ts:23,54`).

## Referral

Real: `/refer` is a native form posting to `/api/referrals`, which validates, logs
consent with a timestamp (`route.ts:95-106`), and emails the desk with terms from
`content/referral.ts` (5% credit or $250 CAD).

Missing: no `Referral` model in the schema, no referral code, no unique link, no reward
automation. Nothing links a later `QuoteRequest` or `Project` back to a referrer. The
reward is applied by a human remembering, months later.

`/r` is review-routing from a printed card — unrelated to referral, easily conflated.

## Customer account — already exists

`middleware.ts:24-40` gates `/admin/*` on `role==='ADMIN'` and `/mypage/*` on
`isLoggedIn` only. `app/(portal)/mypage/` has dashboard, quotes, projects, invoices
(with Stripe pay), orders and inquiries. Self-serve registration with email verification
(`lib/actions/auth.ts:26-63`).

Critically, `lib/actions/auth.ts:159-163` and `lib/auth.ts:19-29,164-171` attach prior
**anonymous** `QuoteRequest` rows to a new account on email verification. A customer who
submitted a quote before registering finds it waiting for them.

**Therefore Floor Passport is an extension of an existing, working account system —
not a new build.** What is missing is only that the floor the customer designed never
flows into it as structured data.
