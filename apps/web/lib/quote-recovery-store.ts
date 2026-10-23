/**
 * SQL for the quote-recovery reminder's delivery state (the raw, DB-clock half
 * of lib/quote-recovery-delivery.ts). Everything here uses the database's now(),
 * as lib/email/order-confirmation.ts does, so the app servers' clocks never
 * decide whether a lease is free or a backoff is due.
 */
import { db } from '@/lib/db';
import {
  CRON_EMAIL_LEASE_MS,
  CRON_EMAIL_MAX_ATTEMPTS,
  cronEmailBackoffSeconds,
} from '@/lib/email/cron-email-policy';

/** The reminder goes out between 2 hours and 7 days after the form was abandoned. */
export const RECOVERY_MIN_AGE_SECONDS = 2 * 3600;
export const RECOVERY_MAX_AGE_SECONDS = 7 * 24 * 3600;

export interface DueQuoteRecovery {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}

/**
 * Rows that may be attempted NOW, oldest first. Exhausted rows, rows in backoff
 * and rows under a live lease are excluded in SQL, so a few permanently failing
 * rows can never occupy the batch and starve healthy ones.
 */
export async function selectDueQuoteRecoveries(limit: number): Promise<DueQuoteRecovery[]> {
  return db.$queryRaw<DueQuoteRecovery[]>`
    SELECT "id", "email", "name", "createdAt"
      FROM "ecowoods"."QuoteRecovery"
     WHERE "sentAt" IS NULL
       AND "convertedAt" IS NULL
       AND "confirmedAt" IS NOT NULL
       AND "consentedAt" IS NOT NULL
       AND "createdAt" <= now() - make_interval(secs => ${RECOVERY_MIN_AGE_SECONDS})
       AND "createdAt" >= now() - make_interval(secs => ${RECOVERY_MAX_AGE_SECONDS})
       AND COALESCE("sendAttempts", 0) < ${CRON_EMAIL_MAX_ATTEMPTS}
       AND ("sendLeaseUntil" IS NULL OR "sendLeaseUntil" < now())
       AND ("sendNextAttemptAt" IS NULL OR "sendNextAttemptAt" <= now())
     ORDER BY "createdAt" ASC
     LIMIT ${limit}`;
}

/**
 * Take the lease: one atomic UPDATE ... RETURNING. The row must STILL be eligible
 * at claim time (consent and double opt-in are re-checked here, not trusted from
 * the selection or from upstream). Of any number of concurrent runs exactly one
 * gets the row. Returns the attempt number now held, or null.
 */
export async function claimQuoteRecovery(id: string): Promise<number | null> {
  const rows = await db.$queryRaw<Array<{ attempts: number }>>`
    UPDATE "ecowoods"."QuoteRecovery"
       SET "sendLeaseUntil" = now() + make_interval(secs => ${CRON_EMAIL_LEASE_MS / 1000}),
           "sendAttempts" = COALESCE("sendAttempts", 0) + 1
     WHERE "id" = ${id}::uuid
       AND "sentAt" IS NULL
       AND "convertedAt" IS NULL
       AND "confirmedAt" IS NOT NULL
       AND "consentedAt" IS NOT NULL
       AND "createdAt" <= now() - make_interval(secs => ${RECOVERY_MIN_AGE_SECONDS})
       AND "createdAt" >= now() - make_interval(secs => ${RECOVERY_MAX_AGE_SECONDS})
       AND COALESCE("sendAttempts", 0) < ${CRON_EMAIL_MAX_ATTEMPTS}
       AND ("sendLeaseUntil" IS NULL OR "sendLeaseUntil" < now())
       AND ("sendNextAttemptAt" IS NULL OR "sendNextAttemptAt" <= now())
    RETURNING "sendAttempts" AS "attempts"`;
  return rows[0]?.attempts ?? null;
}

/**
 * Record a failed attempt: drop our lease, schedule the next try (none after the
 * last attempt: the row is then exhausted) and keep the sanitised error.
 * Fenced on our attempt number, so a stale holder cannot overwrite a newer one.
 */
export async function recordQuoteRecoveryFailure(id: string, attempt: number, sanitisedError: string): Promise<void> {
  const exhausted = attempt >= CRON_EMAIL_MAX_ATTEMPTS;
  await db.$executeRaw`
    UPDATE "ecowoods"."QuoteRecovery"
       SET "sendLeaseUntil" = NULL,
           "sendNextAttemptAt" = CASE WHEN ${exhausted} THEN NULL ELSE now() + make_interval(secs => ${cronEmailBackoffSeconds(attempt)}) END,
           "sendLastError" = ${sanitisedError}
     WHERE "id" = ${id}::uuid AND "sentAt" IS NULL AND "sendAttempts" = ${attempt}`;
}

/** Reminders that ran out of attempts and were never sent (aggregate only, no identities). */
export async function countExhaustedQuoteRecoveries(): Promise<number> {
  const rows = await db.$queryRaw<Array<{ n: number }>>`
    SELECT COUNT(*)::int AS "n"
      FROM "ecowoods"."QuoteRecovery"
     WHERE "sentAt" IS NULL
       AND "convertedAt" IS NULL
       AND "createdAt" >= now() - make_interval(secs => ${RECOVERY_MAX_AGE_SECONDS})
       AND COALESCE("sendAttempts", 0) >= ${CRON_EMAIL_MAX_ATTEMPTS}`;
  return Number(rows[0]?.n ?? 0);
}
