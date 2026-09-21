/**
 * lib/analytics.ts — the ONE way an event leaves this site.
 *
 * GA4 loads only after consent (CookieConsentBanner → loadGoogleAnalytics),
 * so `window.gtag` may not exist for any given visitor, ever. Every call site
 * therefore goes through `track()`, which is a silent no-op without consent —
 * a conversion event must never be the thing that throws.
 *
 * Events are ALSO pushed to `window.dataLayer` unconditionally-safely, so a
 * future GTM container picks them up without touching call sites.
 *
 * THE EVENT NAMES ARE A CONTRACT. They are what a human marks as conversions
 * in GA4 (see ops/HUMAN-P0.md). Do not rename casually:
 *
 *   quote_view           — the #quote section entered the viewport
 *   quote_start          — first focus into the estimate form
 *   quote_submit         — measure-track lead accepted by /api/leads
 *   photo_triage_submit  — photo-track lead accepted by /api/photo-triage
 *   tel_click            — any tel: link activated
 *   design_handoff       — /design configuration carried into the quote form
 *   jobcard_click        — a first-party proof card was opened
 *   framework_assess_complete — every criterion answered in the quote scorer
 *   quote_review_submit  — someone sent us a competitor's quote to score
 *   commercial_cta       — a CTA on /commercial was activated
 *   realtor_cta          — a CTA on /realtors was activated
 *   recovery_opt_in      — the visitor consented to an unfinished-form reminder
 *   studio_open          — /floor-studio was opened
 *   studio_photo_analysed — a room photo was read (in the browser; nothing uploaded)
 *   studio_boundary_corrected — the visitor dragged the floor boundary
 *   studio_match_shown   — Floor Match returned its recommendations
 *   studio_visualised    — a real configuration was rendered into their room
 *   studio_config_changed — species / finish / pattern / width moved
 *   studio_compare       — two or more floors were compared
 *   studio_share         — a design link was copied or shared
 *   studio_samples_request — samples were requested from the studio
 *   studio_estimate_handoff — the design was carried into /estimate
 *   studio_live_opened   — a camera stream started
 *   studio_live_blocked  — it did not, and why (six possible reasons)
 *   studio_live_captured — a live frame was frozen into the studio
 *   studio_region_changed — the visitor moved between the Ontario and New York bands
 *
 * THE `design_id` PARAMETER (MEAS-01)
 *
 * `studio_visualised`, `studio_share`, `studio_estimate_handoff`,
 * `studio_samples_request` and `quote_submit` carry `design_id` — the minted
 * identifier from lib/floor-studio/design-id.ts, the same value written to
 * QuoteRequest.designId server-side.
 *
 * It is what finally makes the two halves of this business joinable: GA4 knows
 * how many designs were made, the database knows which of them became deposits,
 * and until now nothing connected the two. Note what it is NOT: not a user id,
 * not a session id, not a device id. It names a DESIGN, so a link shared with a
 * spouse reports one design and not two people — undercounting sessions, never
 * inventing them. Do not repurpose it as a visitor identifier; that is a
 * different field with different consent obligations.
 */

export type AnalyticsEvent =
  | 'quote_view'
  | 'quote_start'
  | 'quote_submit'
  | 'photo_triage_submit'
  | 'tel_click'
  | 'design_handoff'
  | 'jobcard_click'
  | 'framework_assess_complete'
  | 'quote_review_submit'
  | 'commercial_cta'
  | 'realtor_cta'
  | 'recovery_opt_in'
  /* Floor Graph opt-ins. Both record that a CHOICE was made, never what was
     chosen about: no photo, no answer, no quote content ever reaches an
     analytics call. The value of knowing the opt-in rate is that it tells us
     whether the wording is fair — a rate near zero means people did not
     understand it, and a rate near one means it was not really a choice. */
  | 'photo_retention_opt_in'
  | 'framework_benchmark_contribute'
  /* Floor Studio. The funnel this business has never been able to measure:
     what a visitor does between wanting a floor and asking for a price.
     studio_visualised is the wow moment; studio_estimate_handoff is the one
     that pays for the feature, and lib/funnels binds it as the completion of
     the studio funnel. None of these carries a photograph, a room, or
     anything about the person — the parameters are a configuration id and a
     count, and that is all they are allowed to be. */
  | 'studio_open'
  | 'studio_photo_analysed'
  | 'studio_boundary_corrected'
  | 'studio_match_shown'
  | 'studio_visualised'
  | 'studio_config_changed'
  | 'studio_compare'
  | 'studio_share'
  | 'studio_samples_request'
  | 'studio_estimate_handoff'
  /* The live camera (LIVE-01). studio_live_opened fires when a stream actually
     starts, not when the button is pressed — the gap between those two is the
     permission prompt, and studio_live_blocked with its reason is the only way
     to find out how many people never get past it. Neither carries a frame, a
     room or anything about the person; the reason is one of six words from
     classifyCameraError and nothing else. */
  | 'studio_live_opened'
  | 'studio_live_blocked'
  | 'studio_live_captured'
  /* GEO-006. Which band set the visitor is pricing against — 'CA' or 'US' and
     nothing else. It is the only way to find out whether the New York links are
     landing people in the right currency, and it carries no location: the
     visitor chose it, and a choice between two published band sets is not a
     place. */
  | 'studio_region_changed'
  /* MEAS-03 — the surfaces that produced value and reported nothing.
   *
   * PG0 found the assistant firing ZERO events while creating real
   * QuoteRequest rows and booking real Appointments, and the movement
   * calculator and quote comparator firing none at all. Three tools that a
   * visitor can spend ten minutes inside, invisible to every report, so the
   * honest answer to "is EcowoodsGuide worth what it costs to run" was that
   * nobody could tell.
   *
   * The commercial outcomes of a chat are recorded SERVER-side in the funnel
   * ledger, where they are authoritative and do not depend on consent. These
   * client events are the denominator: how many people opened it and how far
   * the conversation got. Neither carries a message, a name, or anything the
   * visitor typed — `turn` is a count and `source` is which button opened the
   * panel.
   *
   * movement_calculated and quote_check_compared carry only what was chosen
   * from a fixed list and how many quotes were pasted in. Never a price, never
   * a document, never a filename: both tools promise on their face that
   * nothing is uploaded and nothing is stored, and an analytics event that
   * carried the contents would make that sentence false. */
  | 'assistant_open'
  | 'assistant_message'
  | 'movement_calculated'
  | 'quote_check_compared'
  /* SALE-02 — the specification was opened. The brief's SPECIFICATION EXPORT
     exists so a design can be handed to a spouse, a designer or a contractor,
     and this is the only way to find out whether anybody does that. Carries a
     configuration id and the design id, same as every other studio event. */
  | 'studio_spec_opened'
  /* ASSISTANT-01 — /assistant (AI Home Advisor) opened. A separate product
     from the corner chat widget's assistant_open/assistant_message above:
     that widget is mounted on every page, this is a dedicated route. `source`
     is always 'workspace' here, never a value the corner widget's events use,
     so the two are never mistaken for one funnel in a report. No message, no
     project detail — same discipline as assistant_open. Later phases add
     workspace_project_started, workspace_product_selected, etc. per
     docs/assistant-workspace/PHASE_PLAN.md (ASSISTANT-09); none of those
     exist yet, so this is the only workspace_* event today. */
  | 'workspace_open';

export function track(
  event: AnalyticsEvent,
  /* `undefined` is accepted so a call site can write `design_id: design.designId`
     without a ternary at every one of them. It is STRIPPED below rather than
     sent: a parameter present with no value is worse than an absent one,
     because it registers in GA4 as a dimension that exists and is always
     empty, and somebody eventually builds a report on it. */
  params?: Record<string, string | number | boolean | undefined>,
): void {
  if (typeof window === 'undefined') return;
  try {
    const w = window as Window & {
      gtag?: (...args: unknown[]) => void;
      dataLayer?: unknown[];
    };
    const clean: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(params ?? {})) {
      if (v !== undefined) clean[k] = v;
    }
    if (typeof w.gtag === 'function') {
      w.gtag('event', event, clean);
    } else if (Array.isArray(w.dataLayer)) {
      w.dataLayer.push({ event, ...clean });
    }
  } catch {
    /* an analytics failure must never surface to the visitor */
  }
}
