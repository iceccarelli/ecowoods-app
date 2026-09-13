/**
 * lib/lead-alert.ts — SALE-04. The text message that wakes somebody up.
 *
 * THE GAP THIS CLOSES
 *
 * A lead arriving at /api/leads today produces two emails: one to ADMIN_EMAIL
 * and one to the customer. That is the entire notification path. There is no
 * SMS anywhere in this repository — `grep -rni twilio` across every
 * package.json and every source file returns nothing.
 *
 * So the interval between a homeowner asking for a measure and somebody
 * knowing about it is bounded only by how often a person opens an inbox. For a
 * home-services business that interval is the single largest determinant of
 * close rate, and it is the one part of the funnel this site had no mechanism
 * for at all — every other stage now has a ledger row and an event.
 *
 * NO NEW DEPENDENCY, DELIBERATELY
 *
 * Twilio's REST API is an HTTPS form POST with basic auth. The npm package
 * adds a lockfile entry, a resolution step and a supply-chain surface for
 * something `fetch` does in fifteen lines — and this repository installs with
 * a lockfile that is expected to be already up to date, so a dependency added
 * in a patch is a dependency that breaks `pnpm install` on the machine that
 * applies it.
 *
 * The consequence worth stating: this speaks Twilio's wire format. If the
 * business moves to another provider, this file changes. That is a smaller
 * cost than the alternative, and it is one file.
 *
 * EVERY RULE THE REST OF THIS CODEBASE ALREADY FOLLOWS
 *
 *   - Never throws. A lead that was captured is captured whether or not the
 *     alert sends, and an alert failure must never turn a 201 into a 500.
 *   - Never awaited by a caller with commercial work left to do.
 *   - Silent and inert when unconfigured, with one structured log line, so a
 *     deployment without credentials behaves exactly as it does today rather
 *     than erroring on every lead.
 *   - Hard timeout, no redirects.
 */

/** Twilio's own endpoint. Not operator-supplied, so there is nothing to guard. */
const TWILIO_HOST = 'https://api.twilio.com';

/** Long enough for a carrier hop, short enough not to hold a serverless invocation. */
const TIMEOUT_MS = 4000;

export type LeadAlert = {
  /** What happened. Kept short — it is the first thing read on a lock screen. */
  kind: 'lead' | 'measure booked' | 'photos';
  name: string;
  /** The number to call back. This is the entire point of the message. */
  phone?: string | null;
  /** Postal code or city as the visitor typed it. */
  where?: string | null;
  service?: string | null;
  /** Which page or tool produced it — service-area-etobicoke, assistant, … */
  source?: string | null;
};

/**
 * What the estimator's phone actually shows.
 *
 * Deliberately minimal: who, where, what, and the number to ring. It does NOT
 * carry the email, the message body, the design, or the address. An SMS
 * crosses a carrier in the clear and lands on a lock screen that anybody
 * standing nearby can read — so it carries the least that still lets someone
 * return the call, and the full record stays in the admin screen and the email.
 */
export function composeLeadAlert(a: LeadAlert): string {
  const parts = [
    `Ecowoods — ${a.kind}`,
    a.name,
    a.phone ?? null,
    a.where ?? null,
    a.service ?? null,
    a.source ? `via ${a.source}` : null,
  ].filter(Boolean);
  /* One segment where possible. Longer messages are split by the carrier and
     arrive out of order often enough to matter on a phone in a van. */
  return parts.join(' · ').slice(0, 320);
}

type TwilioConfig = { sid: string; token: string; from: string; to: string[] };

/**
 * Read the configuration, or report exactly why there is none.
 *
 * Returns null rather than throwing, and never logs a token. `ALERT_SMS_TO`
 * takes a comma-separated list so a second estimator can be added without a
 * deploy.
 */
export function alertConfig(env: Record<string, string | undefined>): TwilioConfig | null {
  const sid = env.TWILIO_ACCOUNT_SID?.trim();
  const token = env.TWILIO_AUTH_TOKEN?.trim();
  const from = env.TWILIO_FROM?.trim();
  const to = (env.ALERT_SMS_TO ?? '')
    .split(',')
    .map((n) => n.trim())
    .filter((n) => /^\+[1-9]\d{6,14}$/.test(n));
  if (!sid || !token || !from || to.length === 0) return null;
  return { sid, token, from, to };
}

/**
 * Send it. Fire and forget.
 *
 * Returns a promise so a test can await it. No production caller does: the
 * customer's request must not wait on a carrier.
 */
export function sendLeadAlert(
  alert: LeadAlert,
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const cfg = alertConfig(env);
  if (!cfg) {
    /* Not an error. Most environments — preview builds, local development, a
       deployment that has not bought a number yet — have no credentials, and
       an alert path that shouted on every lead would be turned off within a
       day and then be off when it mattered. */
    console.log(JSON.stringify({ event: 'lead_alert.skipped', reason: 'not configured' }));
    return Promise.resolve();
  }

  const body = composeLeadAlert(alert);
  const auth = Buffer.from(`${cfg.sid}:${cfg.token}`).toString('base64');

  return Promise.allSettled(
    cfg.to.map(async (to) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(`${TWILIO_HOST}/2010-04-01/Accounts/${cfg.sid}/Messages.json`, {
          method: 'POST',
          redirect: 'error',
          signal: controller.signal,
          headers: {
            authorization: `Basic ${auth}`,
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ To: to, From: cfg.from, Body: body }).toString(),
        });
        if (!res.ok) {
          /* The STATUS, never the response body: a provider error can echo the
             request back, and that request contains a customer's phone number. */
          console.error(
            JSON.stringify({ event: 'lead_alert.rejected', status: res.status, kind: alert.kind }),
          );
        }
      } catch (err) {
        console.error(
          JSON.stringify({
            event: 'lead_alert.failed',
            kind: alert.kind,
            error: err instanceof Error ? err.message : 'unknown',
            hint: 'The lead itself is safe — see lead.captured above and the admin email.',
          }),
        );
      } finally {
        clearTimeout(timer);
      }
    }),
  ).then(() => undefined);
}
