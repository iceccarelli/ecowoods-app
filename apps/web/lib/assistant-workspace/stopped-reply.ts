/**
 * What the transcript shows when the visitor presses Stop mid-reply.
 *
 * Partly streamed text is kept — throwing away a half-read answer is the
 * surprising behaviour — but it is marked unfinished so it is never read as a
 * complete answer, and it never carries cards or actions: only a reply that
 * finished (the `done` event) may offer anything to click, because a stopped
 * reply cannot have confirmed a booking, payment or report.
 */
export const STOPPED_MARKER = '— stopped before finishing';

export function stoppedReplyText(partial: string): string {
  const kept = partial.trim();
  return kept ? `${kept}\n\n${STOPPED_MARKER}` : 'Stopped.';
}
