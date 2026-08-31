# GA4 events — what to mark as a conversion

Every event below is fired by `apps/web/lib/analytics.ts`. Nothing fires until a
visitor accepts analytics in the consent banner AND
`NEXT_PUBLIC_GA_MEASUREMENT_ID` is set in Vercel — see `ops/HUMAN-P0.md` §6.

## Mark these as conversions (GA4 → Admin → Events → "Mark as key event")

| Event | Fires when | Why it is a conversion |
| --- | --- | --- |
| `quote_submit` | A measure-track lead is accepted by `/api/leads` | The job request. This is the number the business runs on. |
| `photo_triage_submit` | Photos accepted by `/api/photo-triage` | Same intent, lower friction. Track separately — if this outruns `quote_submit`, the form is too long. |
| `tel_click` | Any `tel:` link is activated | On mobile this is often the whole conversion. Reconcile against the phone log, not against form fills. |
| `quote_review_submit` | Somebody sends a competitor's quote for review | The MOFU weapon. A person who sends you a rival's quote has put you in the decision. |

## Track, do not mark as conversions

| Event | Fires when | What it tells you |
| --- | --- | --- |
| `quote_view` | The `#quote` section enters the viewport | Denominator for form conversion rate. |
| `quote_start` | First focus into either track | `quote_start` minus `quote_submit` is the abandonment P1.8 recovers. |
| `design_handoff` | A `/design` configuration is carried into the quote form | Whether the configurator earns its place. |
| `jobcard_click` | A first-party proof card is opened | Which jobs persuade. Params carry `slug` and `from`. |
| `framework_assess_complete` | All 27 criteria answered | Params carry `verdict` and `pct` — never the answers themselves. |
| `commercial_cta` / `realtor_cta` | A CTA on `/commercial` or `/realtors` | Whether the two new buyer surfaces are working. |
| `recovery_opt_in` | The unfinished-form reminder box is ticked | Consent rate. If it is high, the reminder is wanted; if near zero, remove the feature rather than "improving" it. |

## Two numbers worth building a report around

1. **`quote_view` → `quote_start` → `quote_submit`.** A funnel exploration on
   these three tells you whether the problem is reach, the form, or the offer.
   They are different problems with different fixes and they are routinely
   confused.
2. **`framework_assess_complete` → `quote_review_submit`.** This is the
   competitive play working or not working: people scoring somebody else's
   quote and then asking us to read it.

## What is deliberately NOT tracked

- The assess tool's individual answers. They never leave the browser. Only the
  fact of completion and the verdict are recorded — see the header of
  `AssessClient.tsx`.
- Any content of a photo, a document, or a message body.
