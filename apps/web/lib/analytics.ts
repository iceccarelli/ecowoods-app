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
  | 'studio_live_captured';

export function track(event: AnalyticsEvent, params?: Record<string, string | number | boolean>): void {
  if (typeof window === 'undefined') return;
  try {
    const w = window as Window & {
      gtag?: (...args: unknown[]) => void;
      dataLayer?: unknown[];
    };
    if (typeof w.gtag === 'function') {
      w.gtag('event', event, params ?? {});
    } else if (Array.isArray(w.dataLayer)) {
      w.dataLayer.push({ event, ...params });
    }
  } catch {
    /* an analytics failure must never surface to the visitor */
  }
}
