/**
 * lib/customer-confirmation.ts — a customer confirmation that fails must be
 * visible to the desk, not just a line in a log.
 *
 * The booking, the lead and the photo triage are all captured BEFORE any email
 * is attempted, and that order is right. What was wrong is what happened next:
 * when the customer's confirmation email threw (a provider blip, an
 * unconfigured production mailer), the route logged to console and moved on —
 * the customer believed nothing had been received, the desk's own notification
 * said nothing was amiss, and nobody had a reason to look at a log.
 *
 * `sendCustomerConfirmation` makes one retry (most provider errors are
 * transient) and returns whether the message left. `reportConfirmationFailure`
 * then tells the desk — by SMS alert and by email, each best-effort — so that
 * somebody contacts the customer. The desk's ORIGINAL notification is never
 * delayed behind either: it is sent independently, first.
 */
import { sendLeadAlert } from '@/lib/lead-alert';
import { sendAdminConfirmationFailedEmail } from '@/lib/email';

export async function sendCustomerConfirmation(
  kind: string,
  ref: string,
  send: () => Promise<unknown>,
  retryDelayMs = 750,
): Promise<boolean> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await send();
      return true;
    } catch (err) {
      lastError = err;
      if (attempt === 0 && retryDelayMs > 0) await new Promise((r) => setTimeout(r, retryDelayMs));
    }
  }
  console.error(
    JSON.stringify({
      event: 'customer_confirmation.failed',
      kind,
      ref,
      error: lastError instanceof Error ? lastError.message : 'unknown',
      hint: 'The record is saved. The desk is told by SMS alert and email to contact the customer.',
    }),
  );
  return false;
}

export type ConfirmationFailure = {
  /** Which journey step: 'appointment', 'lead', 'photo-triage', 'chat-lead'… */
  kind: string;
  /** The saved record's id (or the log id when nothing was saved). */
  ref: string;
  name: string;
  email: string;
  phone?: string | null;
  where?: string | null;
};

/** Tells the desk a customer was NOT sent their confirmation. Never throws. */
export async function reportConfirmationFailure(f: ConfirmationFailure): Promise<void> {
  try {
    await sendLeadAlert({
      kind: 'confirmation email failed',
      name: f.name,
      phone: f.phone ?? null,
      where: f.where ?? null,
      service: f.kind,
      source: null,
    });
  } catch (err) {
    console.error(JSON.stringify({ event: 'customer_confirmation.alert_failed', kind: f.kind, ref: f.ref, error: err instanceof Error ? err.message : 'unknown' }));
  }
  try {
    await sendAdminConfirmationFailedEmail(f);
  } catch (err) {
    console.error(JSON.stringify({ event: 'customer_confirmation.admin_email_failed', kind: f.kind, ref: f.ref, error: err instanceof Error ? err.message : 'unknown' }));
  }
}
