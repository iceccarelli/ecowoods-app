/**
 * lib/report-delivery.ts — the publish state machine shared by the Quote
 * Intelligence Report and the Pre-List Floor Condition Report.
 *
 * No schema field exists for "report stored" or "customer told", so both are
 * line markers in Order.notes (as the QI_REPORT / LFR_REPORT lines already
 * were). Every write is a compare-and-swap on the exact notes text, so of any
 * number of concurrent publishes exactly one holds the claim and the rest are
 * told it is in progress. The claim is a lease: a publish that dies mid-way
 * frees the order when it expires.
 *
 * Order of effects, and why:
 *   1. claim            — nobody else may render or email while we hold it
 *   2. render + store   — only if no report URL is persisted yet
 *   3. persist the URL  — BEFORE any notification, so a retry reuses this PDF
 *   4. email            — with a stable idempotency key (Resend honours it;
 *                         SMTP has no equivalent)
 *   5. record NOTIFIED  — until this lands, a retry re-sends (same key, same
 *                         payload) and the failure stays visible to the admin
 *
 * Limits, stated plainly: email is at-least-once. Resend de-duplicates a
 * repeated Idempotency-Key for a limited window; SMTP does not. If the
 * provider accepts a message and step 5 then fails, a retry sends it again.
 */

import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';

export const PUBLISH_LEASE_MS = 3 * 60 * 1000;

const CLAIM_RE = /(?:^|\n)REPORT_PUBLISH_CLAIM:[0-9a-f-]{36}:(\d+)(?=\n|$)/;
const NOTIFIED_RE = /(?:^|\n)REPORT_NOTIFIED:\d+(?=\n|$)/;

export const isPublishClaimLive = (notes: string | null, now: number): boolean => {
  const m = notes?.match(CLAIM_RE);
  return !!m && now - Number(m[1]) < PUBLISH_LEASE_MS;
};
export const stripPublishClaim = (notes: string | null): string => (notes ?? '').replace(CLAIM_RE, '').trim();
export const withPublishClaim = (notes: string | null, token: string, now: number): string =>
  `${stripPublishClaim(notes)}\nREPORT_PUBLISH_CLAIM:${token}:${now}`.trim();
export const hasReportNotified = (notes: string | null): boolean => !!notes && NOTIFIED_RE.test(notes);
const withNotified = (notes: string, now: number): string => `${stripPublishClaim(notes)}\nREPORT_NOTIFIED:${now}`.trim();

/** Stable per order and delivery version; bump `v1` only to deliberately re-send. */
export const reportDeliveryKey = (orderId: string): string => `report-delivery/${orderId}/v1`;

export type PublishInput = {
  orderId: string;
  /** Statuses from which this product may publish (anything else is not paid / not taken in). */
  allowedStatuses: Array<'PAID' | 'FULFILLED'>;
  productTag: string;
  extractUrl: (notes: string | null) => string | null;
  appendUrl: (notes: string | null, url: string) => string;
  /** Null only when a URL is already persisted. Called at most once, under the claim. */
  renderAndStore: (() => Promise<string>) | null;
  email: { to: string; subject: string; html: string; text: string };
};

export type PublishOutcome =
  | { kind: 'busy' }
  | { kind: 'not_eligible' }
  | { kind: 'failed'; stage: 'render' | 'persist'; orphanUrl?: string }
  | { kind: 'done'; url: string; alreadyPublished: boolean; notified: boolean; notificationError?: string };

const log = (level: 'info' | 'error', event: string, fields: Record<string, unknown>) =>
  console[level](JSON.stringify({ event, ...fields }));

export async function publishReport(input: PublishInput): Promise<PublishOutcome> {
  const { orderId, productTag } = input;
  const order = await db.order.findUnique({ where: { id: orderId }, include: { user: true } });
  if (!order || !input.allowedStatuses.includes(order.status as 'PAID' | 'FULFILLED')) return { kind: 'not_eligible' };

  const existing = input.extractUrl(order.notes);
  if (existing && hasReportNotified(order.notes)) {
    return { kind: 'done', url: existing, alreadyPublished: true, notified: true };
  }
  const now = Date.now();
  if (isPublishClaimLive(order.notes, now)) return { kind: 'busy' };
  if (!existing && !input.renderAndStore) return { kind: 'not_eligible' };

  // 1. Claim.
  const token = randomUUID();
  let current = withPublishClaim(order.notes, token, now);
  const claim = await db.order.updateMany({
    where: { id: orderId, status: order.status, notes: order.notes },
    data: { notes: current },
  });
  if (claim.count !== 1) return { kind: 'busy' };

  const write = async (data: { notes: string; status?: 'FULFILLED' }): Promise<boolean> => {
    const res = await db.order.updateMany({ where: { id: orderId, notes: current }, data });
    if (res.count === 1) current = data.notes;
    return res.count === 1;
  };
  const release = () => write({ notes: stripPublishClaim(current) }).catch(() => false); // lease expiry covers a failed release

  // 2–3. Render once; persist the URL before notifying.
  let url = existing;
  if (!url) {
    try {
      url = await input.renderAndStore!();
    } catch (err) {
      log('error', `${productTag}.pdf_failed`, { orderId, error: err instanceof Error ? err.message : 'unknown' });
      await release();
      return { kind: 'failed', stage: 'render' };
    }
    let persisted = false;
    try {
      persisted = await write({ notes: input.appendUrl(current, url), status: 'FULFILLED' });
    } catch {
      /* handled below */
    }
    if (!persisted) {
      log('error', `${productTag}.report_url_not_persisted`, { orderId, orphanUrl: url });
      await release();
      return { kind: 'failed', stage: 'persist', orphanUrl: url };
    }
  }

  // 4. Notify.
  try {
    await sendEmail({ to: input.email.to, subject: input.email.subject, html: input.email.html, text: input.email.text, idempotencyKey: reportDeliveryKey(orderId) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    log('error', `${productTag}.notification_failed`, { orderId, error: message, hint: 'Report is stored. Publish again to retry the customer email.' });
    await release();
    return { kind: 'done', url, alreadyPublished: !!existing, notified: false, notificationError: message };
  }

  // 5. Record that the customer was told.
  let recorded = false;
  for (let attempt = 0; attempt < 3 && !recorded; attempt++) {
    try {
      recorded = await write({ notes: withNotified(current, Date.now()) });
      if (!recorded) break; // the row changed under us; nothing further to write
    } catch {
      /* retry */
    }
  }
  if (!recorded) {
    log('error', `${productTag}.notified_not_recorded`, { orderId, hint: 'Email was accepted. A retry will re-send with the same idempotency key.' });
    await release();
  }
  return { kind: 'done', url, alreadyPublished: !!existing, notified: true };
}
