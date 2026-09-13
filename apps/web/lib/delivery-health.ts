/**
 * lib/delivery-health.ts — does anybody find out?
 *
 * WHY THIS EXISTS
 *
 * Measured on production: fourteen quote requests PENDING, none ever priced,
 * none ever issued, the oldest eighty-five days old and the newest two days
 * old. DESK-01 put that queue on the dashboard oldest-first, which makes the
 * backlog visible to somebody who opens the dashboard. This is about the step
 * before that — whether anybody is told to open it at all.
 *
 * THE SILENT FAILURE THIS EXPOSES
 *
 * lib/email/index.ts selects its transport from the environment:
 *
 *     RESEND_API_KEY set → Resend
 *     SMTP_HOST set      → nodemailer
 *     neither            → 'dev'
 *
 * and in 'dev' it console.logs the message and RETURNS. It does not throw. So
 * on a deployment with neither variable set, `sendAdminNewQuoteEmail(...)`
 * resolves successfully, the `.catch()` every caller carefully attached never
 * fires, `lead.email_failed` is never logged, and the request completes
 * exactly as it does when the mail was really delivered. There is no error
 * anywhere. The lead is in the database and nobody has been told.
 *
 * SALE-04's SMS alert is inert in the same way by design — `alertConfig`
 * returns null without Twilio credentials and `sendLeadAlert` returns — which
 * is correct behaviour for an optional channel and indistinguishable from
 * success from the outside.
 *
 * So neither channel can fail loudly, and between them they are the only
 * things that turn a row in a table into a phone call. This module reads the
 * environment the same way both of them do and says, on the screen the desk
 * already opens, whether a new lead reaches a human.
 *
 * NO SECRET IS EVER RETURNED. The presence of a key is a fact worth showing;
 * its value is not. Keys and tokens are tested for emptiness and then
 * discarded — they never enter the returned object — and the destinations that
 * ARE returned are masked, because the admin screen is a page, pages get
 * screenshotted, and a business inbox is worth something to a scraper.
 * delivery-health.test.ts fails if any secret value survives into the output.
 */
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { alertConfig } from '@/lib/lead-alert';

export type DeliveryChannel = {
  id: 'email' | 'sms';
  label: string;
  /** Whether a real message leaves the server. */
  live: boolean;
  /** The transport, named. 'none' when nothing is configured. */
  via: string;
  /** Where it goes, masked. Null when nothing is configured. */
  to: string | null;
  /** What to set, or what is happening instead. One sentence, plain. */
  detail: string;
};

export type DeliveryHealth = {
  channels: readonly DeliveryChannel[];
  /** True when at least one channel actually delivers. */
  anyLive: boolean;
};

/** `vince.ceccarelli@gmail.com` → `v••••••@gmail.com`. Never the local part. */
export function maskEmail(address: string): string {
  const at = address.indexOf('@');
  if (at < 1) return '••••';
  return `${address[0]}${'•'.repeat(Math.max(3, Math.min(8, at - 1)))}${address.slice(at)}`;
}

/** `+14165551234` → `+1416•••1234`. Enough to recognise, not enough to dial. */
export function maskPhone(number: string): string {
  const n = number.trim();
  if (n.length < 8) return '•'.repeat(Math.max(4, n.length));
  return `${n.slice(0, 5)}•••${n.slice(-4)}`;
}

export function deliveryHealth(env: Record<string, string | undefined> = process.env): DeliveryHealth {
  /* Read EXACTLY as lib/email/index.ts reads it, including the fallback to the
     published business inbox, or this reports on a different system. */
  const resend = env.RESEND_API_KEY?.trim();
  const smtp = env.SMTP_HOST?.trim();
  const adminTo = env.ADMIN_EMAIL?.trim() || BUSINESS_NAP.email;

  const emailLive = Boolean(resend || smtp);
  const email: DeliveryChannel = {
    id: 'email',
    label: 'Email',
    live: emailLive,
    via: resend ? 'Resend' : smtp ? 'SMTP' : 'none',
    to: emailLive ? maskEmail(adminTo) : null,
    detail: emailLive
      ? 'A new quote request is emailed as soon as it is submitted.'
      : 'Neither RESEND_API_KEY nor SMTP_HOST is set, so sendEmail() writes the message to the server log and returns without error. Nothing is delivered and nothing fails.',
  };

  /* The same function SALE-04 gates the send on, so this cannot disagree
     with what actually happens. Its return value is discarded except for
     the destinations, which are masked — the SID and token never leave here. */
  const sms = alertConfig(env);
  const smsChannel: DeliveryChannel = {
    id: 'sms',
    label: 'SMS',
    live: sms !== null,
    via: sms ? 'Twilio' : 'none',
    to: sms ? sms.to.map(maskPhone).join(', ') : null,
    detail: sms
      ? 'A new quote request sends a text message.'
      : 'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM and ALERT_SMS_TO are not all set, so sendLeadAlert() returns without sending.',
  };

  const channels = [email, smsChannel] as const;
  return { channels, anyLive: channels.some((c) => c.live) };
}
