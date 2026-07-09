/**
 * RenoGuide bus.
 *
 * WHY THIS EXISTS
 * ---------------
 * ChatWidget already owns a working agent loop: it streams /api/chat, which
 * has real tools (estimate_project, get_availability, book_measure,
 * create_quote_request) that write to Prisma and send email.
 *
 * Every new surface we add — the configurator, ⌘K, exit intent, WhatsApp —
 * is worthless if it dead-ends in its own little UI. So none of them get
 * their own state. They all do exactly one thing: hand RenoGuide a sentence
 * and let the existing tools do the work.
 *
 * That means:
 *   configurator "Ask RenoGuide" → openRenoGuide({ prefill: '...' })
 *     → ChatWidget opens, sends it, model calls estimate_project
 *   configurator "Book my measure" → openRenoGuide({ prefill: '...' })
 *     → model calls get_availability then book_measure → real Appointment row
 *
 * One seam. No duplicated pricing UI, no second booking flow, no drift.
 */

export const RENOGUIDE_OPEN_EVENT = 'renoguide:open';

export interface RenoGuideOpenDetail {
  /** Text dropped into the composer. */
  prefill?: string;
  /** Send it immediately instead of letting the user edit first. Default true. */
  autoSend?: boolean;
  /** Attribution for analytics — 'configurator' | 'command-palette' | 'exit-intent' | ... */
  source?: string;
}

/** Fire-and-forget. Safe to call during SSR (no-ops) and before ChatWidget mounts. */
export function openRenoGuide(detail: RenoGuideOpenDetail = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<RenoGuideOpenDetail>(RENOGUIDE_OPEN_EVENT, {
      detail: { autoSend: true, ...detail },
    }),
  );
}

export function onRenoGuideOpen(handler: (detail: RenoGuideOpenDetail) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<RenoGuideOpenDetail>).detail ?? {});
  window.addEventListener(RENOGUIDE_OPEN_EVENT, listener);
  return () => window.removeEventListener(RENOGUIDE_OPEN_EVENT, listener);
}
