/**
 * lib/lead-acknowledgement.ts — "we received your request", for every surface
 * that captures a lead.
 *
 * It goes to whatever address was typed, so it is limited durably per address
 * and per IP; past the limit the lead is still captured and only the courtesy
 * email is skipped ('suppressed' — deliberate, not a failure). A send that
 * throws is retried once; if it still fails the desk is told
 * (lib/customer-confirmation.ts) so somebody contacts the customer, and the
 * result is 'failed'.
 *
 * /api/leads has always done this inline. The corner assistant's
 * create_quote_request tool and /api/photo-triage captured the same kind of
 * lead and sent the customer nothing at all.
 */
import { sendQuoteReceivedEmail } from '@/lib/email';
import { enforceRateLimit } from '@/lib/rate-limit-durable';
import { reportConfirmationFailure, sendCustomerConfirmation } from '@/lib/customer-confirmation';

export type AcknowledgementResult = 'sent' | 'suppressed' | 'failed';

export async function acknowledgeLead(input: {
  name: string;
  email: string;
  /** The reference printed in the email: the quote id, or the log id when nothing was saved. */
  ref: string;
  ip: string;
  /** Log label, so a suppressed/failed event can be traced to its surface. */
  surface: string;
  phone?: string | null;
  where?: string | null;
}): Promise<AcknowledgementResult> {
  const ackEmail = input.email.trim().toLowerCase();
  const [byEmail, byIp] = await Promise.all([
    enforceRateLimit({ routeKey: 'lead-ack-email', identity: ackEmail, config: { windowMs: 60 * 60 * 1000, maxRequests: 2 } }),
    enforceRateLimit({ routeKey: 'lead-ack-ip', identity: input.ip, config: { windowMs: 60 * 60 * 1000, maxRequests: 5 } }),
  ]);
  if (!byEmail.allowed || !byIp.allowed) {
    console.warn(JSON.stringify({ event: 'lead.ack_suppressed', surface: input.surface, ref: input.ref, byEmail: !byEmail.allowed, byIp: !byIp.allowed }));
    return 'suppressed';
  }
  const sent = await sendCustomerConfirmation(input.surface, input.ref, () =>
    sendQuoteReceivedEmail({ name: input.name, email: input.email, leadId: input.ref }),
  );
  if (sent) return 'sent';
  await reportConfirmationFailure({
    kind: input.surface, ref: input.ref, name: input.name, email: input.email, phone: input.phone, where: input.where,
  });
  return 'failed';
}
