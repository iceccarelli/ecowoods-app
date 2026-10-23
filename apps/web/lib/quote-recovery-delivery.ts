/**
 * lib/quote-recovery-delivery.ts — the single quote-recovery reminder, delivered
 * once, durably and retryably (run by /api/cron/quote-recovery).
 *
 * DELIVERY STATE (columns on QuoteRecovery; an email is never "claimed" by
 * pretending it was sent — the same lease design as lib/email/order-confirmation.ts)
 *
 *   sentAt             written ONLY after the provider accepted the message.
 *   sendLeaseUntil     a ~3 minute lease taken before the provider call. A holder
 *                      that dies leaves a lease that simply expires.
 *   sendAttempts       attempts started; the row is EXHAUSTED at 5 (never retried,
 *                      sentAt stays null, sendLastError remains for an operator).
 *   sendNextAttemptAt  backoff after a failed attempt: 1h, 3h, 6h, 12h.
 *   sendLastError      the last failure, redacted of email addresses and trimmed.
 *
 *   1. A later QuoteRequest for the address means they finished: mark the row
 *      converted and skip. This runs BEFORE the claim.
 *   2. CLAIM (lib/quote-recovery-store.ts): one atomic UPDATE ... RETURNING that
 *      re-checks eligibility, including CASL consent and double opt-in.
 *   3. SEND with the same Idempotency-Key (quote-recovery/<id>/v1) on every
 *      attempt, under a timeout. A timeout is an UNKNOWN outcome: the provider may
 *      have accepted it, so it is retried with the same key and Resend
 *      de-duplicates it (the whole retry span is under its 24h window).
 *   4. MARK SENT after success. On failure the lease is dropped and the next
 *      attempt is scheduled. Over SMTP, which has no idempotency header, a crash
 *      between acceptance and the sent-mark can produce one second copy: the
 *      accepted trade for never silently burning the one reminder a person is allowed.
 *
 * HONEST LIMITATION: rows stamped by the earlier code (which wrote sentAt BEFORE
 * sending and never cleared it when the send threw) cannot be told apart from rows
 * that were genuinely sent. They are left as they are: nothing is re-sent
 * retroactively, and the funnel's "Reminder sent" can include reminders that
 * never left before this fix.
 */
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { escapeHtml } from '@/lib/email/html';
import {
  CRON_EMAIL_MAX_ATTEMPTS,
  CRON_EMAIL_SEND_TIMEOUT_MS,
  SendTimeoutError,
  sanitizeProviderError,
  withTimeout,
} from '@/lib/email/cron-email-policy';
import {
  claimQuoteRecovery,
  countExhaustedQuoteRecoveries,
  recordQuoteRecoveryFailure,
  selectDueQuoteRecoveries,
} from '@/lib/quote-recovery-store';

export const quoteRecoveryKey = (id: string): string => `quote-recovery/${id}/v1`;

const BATCH = 50;

export interface QuoteRecoveryCronResult {
  due: number;
  sent: number;
  failed: number;
  exhausted: number;
}

export interface QuoteRecoveryCronOptions {
  /** Test seam; production uses CRON_EMAIL_SEND_TIMEOUT_MS. */
  sendTimeoutMs?: number;
}

/** Thrown when the due-row query itself fails (the route answers 500). */
export class QuoteRecoveryQueryError extends Error {}

export function renderQuoteRecoveryEmail(name: string | null): { subject: string; text: string; html: string } {
  const first = (name ?? '').trim().split(/\s+/)[0];
  const greeting = first ? `${first},` : 'Hello,';
  return {
    subject: 'Your floor is still unmeasured',
    text:
      `${greeting}\n\n` +
      `You started an estimate with us and did not finish it — no problem, and this is the ` +
      `only time we will mention it.\n\n` +
      `If it is easier, reply to this email with three photos of the floor and we will tell ` +
      `you what it needs. Or call ${BUSINESS_NAP.phoneDisplay} and we will book the measure ` +
      `in about a minute.\n\n` +
      `The measurement is free and the written price does not move afterwards.\n\n` +
      `— ${BUSINESS_NAP.legalName}\n${BUSINESS_NAP.phoneDisplay}\n`,
    html:
      `<p>${escapeHtml(greeting)}</p>` +
      `<p>You started an estimate with us and did not finish it — no problem, and this is the only time we will mention it.</p>` +
      `<p>If it is easier, <strong>reply to this email with three photos of the floor</strong> and we will tell you what it needs. ` +
      `Or call <a href="${BUSINESS_NAP.phoneHref}">${BUSINESS_NAP.phoneDisplay}</a> and we will book the measure in about a minute.</p>` +
      `<p>The measurement is free and the written price does not move afterwards.</p>` +
      `<p style="color:#6b5d4f;font-size:13px;">— ${BUSINESS_NAP.legalName} · ${BUSINESS_NAP.phoneDisplay}<br>` +
      `You are receiving this once because you asked to be reminded if you left the form unfinished.</p>`,
  };
}

/** One cron sweep. Counts only: nothing identifying is returned or logged. */
export async function runQuoteRecoveryCron(options: QuoteRecoveryCronOptions = {}): Promise<QuoteRecoveryCronResult> {
  let rows: Awaited<ReturnType<typeof selectDueQuoteRecoveries>>;
  try {
    rows = await selectDueQuoteRecoveries(BATCH);
  } catch (err) {
    throw new QuoteRecoveryQueryError(err instanceof Error ? err.message : 'unknown');
  }

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    // Somebody who submitted anything after starting the form has finished.
    try {
      const later = await db.quoteRequest.findFirst({
        where: { email: { equals: row.email, mode: 'insensitive' }, createdAt: { gte: row.createdAt } },
        select: { id: true },
      });
      if (later) {
        await db.quoteRecovery.update({ where: { id: row.id }, data: { convertedAt: new Date() } });
        continue;
      }
    } catch {
      continue; // cannot prove they have not finished: do not send
    }

    let attempt: number | null;
    try {
      attempt = await claimQuoteRecovery(row.id);
    } catch {
      continue;
    }
    if (attempt === null) continue; // lost the race, or no longer eligible

    try {
      await withTimeout(
        sendEmail({ to: row.email, ...renderQuoteRecoveryEmail(row.name), idempotencyKey: quoteRecoveryKey(row.id) }),
        options.sendTimeoutMs ?? CRON_EMAIL_SEND_TIMEOUT_MS,
      );
    } catch (err) {
      const message = sanitizeProviderError(err);
      await recordQuoteRecoveryFailure(row.id, attempt, message).catch(() => undefined);
      failed += 1;
      console.error(
        JSON.stringify({
          event: 'quote_recovery.send_failed',
          id: row.id,
          attempt,
          unknownOutcome: err instanceof SendTimeoutError,
          willRetry: attempt < CRON_EMAIL_MAX_ATTEMPTS,
          error: message,
        }),
      );
      continue;
    }

    // The provider accepted it: only now is it "sent". If this write fails the lease expires and a
    // retry re-sends with the same idempotency key (see header).
    sent += 1;
    try {
      await db.quoteRecovery.updateMany({
        where: { id: row.id, sentAt: null },
        data: { sentAt: new Date(), sendLeaseUntil: null, sendNextAttemptAt: null, sendLastError: null },
      });
    } catch (err) {
      console.error(
        JSON.stringify({ event: 'quote_recovery.sent_mark_failed', id: row.id, error: sanitizeProviderError(err) }),
      );
    }
  }

  let exhausted = 0;
  try {
    exhausted = await countExhaustedQuoteRecoveries();
  } catch {
    /* the count is informational; never fail the sweep over it */
  }

  return { due: rows.length, sent, failed, exhausted };
}
