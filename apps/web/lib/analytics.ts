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
 */

export type AnalyticsEvent =
  | 'quote_view'
  | 'quote_start'
  | 'quote_submit'
  | 'photo_triage_submit'
  | 'tel_click'
  | 'design_handoff';

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
