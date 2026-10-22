/**
 * Timing and retry policy of the order-confirmation email (pure constants, no
 * imports). Kept apart from lib/email/order-confirmation.ts so the reconcile
 * sweep can share them without loading the mailer.
 */

/** Longest a holder may keep the claim; must comfortably exceed the provider timeout. */
export const CONFIRMATION_LEASE_MS = 3 * 60_000;
/** The provider call is abandoned (outcome unknown) after this long. */
export const CONFIRMATION_SEND_TIMEOUT_MS = 20_000;
export const CONFIRMATION_MAX_ATTEMPTS = 6;
/** Never email an order paid longer ago than this (also Resend's idempotency window). */
export const CONFIRMATION_MAX_AGE_MS = 24 * 3600_000;

const BACKOFF_SECONDS = [60, 300, 900, 3600, 3600];

/** Seconds to wait after the Nth failed attempt (1-based). */
export const confirmationBackoffSeconds = (attempt: number): number => BACKOFF_SECONDS[Math.min(Math.max(attempt, 1), BACKOFF_SECONDS.length) - 1]!;
