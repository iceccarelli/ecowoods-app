/**
 * Timing, retry and error-handling policy shared by the two cron emails (the
 * quote-recovery reminder and the post-job review request). Pure: no database,
 * no mailer. Mirrors lib/email/order-confirmation-policy.ts, with its own
 * bounds because these are marketing-adjacent mails, not payment receipts.
 */

/** Longest a holder may keep a claim; must comfortably exceed the provider timeout. */
export const CRON_EMAIL_LEASE_MS = 3 * 60_000;
/** The provider call is abandoned (outcome UNKNOWN) after this long and retried with the same key. */
export const CRON_EMAIL_SEND_TIMEOUT_MS = 20_000;
/** After this many attempts a row is EXHAUSTED: never retried, left for an operator. */
export const CRON_EMAIL_MAX_ATTEMPTS = 5;

/**
 * Wait after the Nth failed attempt (1-based): 1h, 3h, 6h, 12h. The retries span
 * 22h in total, under Resend's 24h idempotency window, so every retry that
 * reuses the same key is de-duplicated by the provider if an earlier attempt
 * was in fact accepted. The 5th failure schedules nothing (exhausted).
 */
const BACKOFF_SECONDS = [3600, 3 * 3600, 6 * 3600, 12 * 3600];

export const cronEmailBackoffSeconds = (attempt: number): number =>
  BACKOFF_SECONDS[Math.min(Math.max(attempt, 1), BACKOFF_SECONDS.length) - 1]!;

/**
 * A provider error as stored in `*LastError`: provider messages can echo the
 * recipient (or the account owner's) address, so anything that looks like an
 * email address is redacted BEFORE truncating (a cut-off address can then never
 * survive), then the result is capped at 300 characters (the column width).
 */
export function sanitizeProviderError(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : 'unknown';
  return raw
    .replace(/[^\s<>()[\]"',;:]+@[^\s<>()[\]"',;]+/g, '[email]')
    .replace(/@/g, ' at ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

export class SendTimeoutError extends Error {
  constructor() {
    super('provider_timeout: outcome unknown');
  }
}

/** Rejects with SendTimeoutError after `ms`; the underlying work is not cancelled. */
export async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new SendTimeoutError()), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
