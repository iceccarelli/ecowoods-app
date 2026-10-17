/**
 * POST /api/well-installed-review/submit
 *
 * Accepts the customer's quote document(s) against a PAID order and emails
 * them to the estimating desk — same delivery mechanism as the free
 * /api/quote-review, gated behind payment instead of open to anyone.
 *
 * Refuses unless the referenced Order is PAID (set by the existing Stripe
 * webhook from checkout's metadata.orderId) and the submitted email matches
 * the paying customer's, then marks the order FULFILLED so a second submit
 * against the same order is rejected rather than silently overwriting what
 * the desk already received.
 *
 * Like /api/quote-review: the document is attached to one internal email and
 * never written to disk or blob storage.
 */

import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { sendEmail, type EmailAttachment } from '@/lib/email';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { safeFilename, sniffDocumentFile, type SniffedDocument } from '@/lib/image-sniff';
import { checkSubmissionEligibility } from '@/lib/well-installed-review';
import { checkRateLimit, getClientIp, isTrustedBrowserOrigin, LEAD_POST_LIMIT } from '@/lib/rate-limit';
import { recordQuoteReviewEvent } from '@/lib/quote-intelligence/events';
import { extractTierId, isIntakeClaimLive, stripIntakeClaim, withIntakeClaim } from '@/lib/quote-intelligence/notes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILES = 3;
const MAX_PDF_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const fieldsSchema = z.object({
  orderId: z.string().uuid('Missing order reference.'),
  email: z.string().email('Please enter a valid email'),
  message: z.string().max(2000).optional(),
});

function reasonMessage(reason: string): string {
  switch (reason) {
    case 'not_found':
    case 'wrong_product': // indistinguishable from not_found: no probe of other products' order ids
      return 'We could not find that order.';
    case 'unpaid':
      return 'This order has not been paid yet. If you just paid, wait a few seconds and refresh — Stripe can take a moment to confirm.';
    case 'in_progress':
      return 'We are already processing a submission for this order. If it does not complete in a couple of minutes, try again.';
    case 'already_submitted':
      return 'A quote has already been received for this order.';
    case 'email_mismatch':
      return 'That email does not match the one used at checkout.';
    default:
      return 'This order is not eligible.';
  }
}

export async function POST(request: Request) {
  if (!isTrustedBrowserOrigin(request)) {
    return NextResponse.json({ success: false, message: 'Origin not allowed.' }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, message: 'Send this as multipart/form-data with the quote attached.' },
      { status: 400 },
    );
  }

  const fields: Record<string, string> = {};
  const files: File[] = [];
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') {
      if (value !== '') fields[key] = value;
    } else if (key === 'documents' && value.size > 0) {
      files.push(value);
    }
  }

  const parsed = fieldsSchema.safeParse(fields);
  const fileErrors: string[] = [];
  if (files.length === 0) fileErrors.push('Attach the quote — a PDF, or photos of it.');
  if (files.length > MAX_FILES) fileErrors.push(`At most ${MAX_FILES} files.`);
  /* Decided from the bytes, not the declared type or the filename: a missing
     or forged `type` used to skip the check, and size limits followed it. */
  const sniffedByFile = new Map<File, SniffedDocument>();
  for (const f of files.slice(0, MAX_FILES)) {
    const kind = await sniffDocumentFile(f);
    if (!kind) fileErrors.push(`${f.name}: send a PDF or an image.`);
    else if (kind.contentType === 'application/pdf' && f.size > MAX_PDF_BYTES) fileErrors.push(`${f.name} is over 8 MB.`);
    else if (kind.contentType !== 'application/pdf' && f.size > MAX_IMAGE_BYTES) fileErrors.push(`${f.name} is too large.`);
    else sniffedByFile.set(f, kind);
  }

  if (!parsed.success || fileErrors.length) {
    const fieldErrors: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && !(key in fieldErrors)) fieldErrors[key] = issue.message;
      }
    }
    if (fileErrors.length) fieldErrors.documents = fileErrors.join(' ');
    return NextResponse.json(
      { success: false, message: 'Please check the highlighted fields.', fieldErrors },
      { status: 400 },
    );
  }

  const { orderId, email, message } = parsed.data;

  const rl = checkRateLimit(getClientIp(request), LEAD_POST_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: 'Please wait a moment before sending another.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  const order = await db.order.findUnique({ where: { id: orderId }, include: { user: true } });
  const eligibility = checkSubmissionEligibility(
    order ? { status: order.status, userEmail: order.user.email, notes: order.notes } : null,
    email,
  );
  if (!eligibility.ok) {
    return NextResponse.json(
      { success: false, message: reasonMessage(eligibility.reason) },
      { status: eligibility.reason === 'not_found' || eligibility.reason === 'wrong_product' ? 404 : 409 },
    );
  }

  /* Claim the order before anything leaves the building. The compare-and-swap
     on the exact notes text means that of any number of simultaneous requests
     exactly one wins; the rest are told it is in progress. The claim is a
     lease, so a request that dies mid-send frees the order when it expires. */
  const now = Date.now();
  if (isIntakeClaimLive(order!.notes, now)) {
    return NextResponse.json({ success: false, message: reasonMessage('in_progress') }, { status: 409, headers: { 'Retry-After': '120' } });
  }
  const token = randomUUID();
  const claimedNotes = withIntakeClaim(order!.notes, token, now);
  const claim = await db.order.updateMany({
    where: { id: orderId, status: 'PAID', notes: order!.notes },
    data: { notes: claimedNotes },
  });
  if (claim.count !== 1) {
    return NextResponse.json({ success: false, message: reasonMessage('in_progress') }, { status: 409, headers: { 'Retry-After': '120' } });
  }
  const release = () =>
    db.order
      .updateMany({ where: { id: orderId, status: 'PAID', notes: claimedNotes }, data: { notes: stripIntakeClaim(claimedNotes) } })
      .catch(() => undefined); // lease expiry covers a failed release

  try {
    const attachments: EmailAttachment[] = [];
    for (const f of files.slice(0, MAX_FILES)) {
      attachments.push({ filename: safeFilename(f.name, sniffedByFile.get(f)!.ext, 'quote'), content: Buffer.from(await f.arrayBuffer()) });
    }
    const rows = [
      ['Order', order!.id],
      ['Submission', token],
      ['Tier', order!.notes ?? '—'],
      ['Paid', `$${Number(order!.total).toFixed(2)} CAD`],
      ['Email', email],
      ['They suspect', message ?? '—'],
    ]
      .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b5d4f;">${k}</td><td style="padding:4px 0;"><strong>${v}</strong></td></tr>`)
      .join('');

    await sendEmail({
      to: process.env.ADMIN_EMAIL ?? BUSINESS_NAP.email,
      subject: `PAID quote review — ${order!.notes ?? 'Well-Installed Quote Review'}`,
      html:
        `<h2 style="margin:0 0 8px;">Paid quote review — reply per the tier's turnaround</h2>` +
        `<p style="margin:0 0 16px;">${attachments.length} document(s) attached. Reply with what is wrong, what is missing, and what is fine.</p>` +
        `<table style="border-collapse:collapse;">${rows}</table>`,
      text: `Paid quote review, order ${order!.id}, submission ${token}. ${attachments.length} document(s). Note: ${message ?? 'none'}`,
      attachments,
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        event: 'well_installed_review.email_failed',
        orderId,
        error: err instanceof Error ? err.message : 'unknown',
      }),
    );
    await release();
    return NextResponse.json(
      { success: false, message: 'Something went wrong sending that. Please call and we will pick it up directly.' },
      { status: 500 },
    );
  }

  /* The email is out. Email cannot be made exactly-once, so the order is
     marked FULFILLED with a short retry; if that write still fails the
     customer is told the truth (received) rather than invited to resend, and
     the "Submission" id in the email lets the desk spot a duplicate if the
     lease later expires and they do resubmit. */
  let marked = false;
  for (let attempt = 0; attempt < 3 && !marked; attempt++) {
    try {
      const done = await db.order.updateMany({
        where: { id: orderId, status: 'PAID', notes: claimedNotes },
        data: { status: 'FULFILLED', notes: stripIntakeClaim(claimedNotes) },
      });
      marked = done.count === 1;
      if (!marked) break; // someone else changed the row; nothing more to write
    } catch {
      /* retry */
    }
  }
  if (!marked) {
    console.error(JSON.stringify({ event: 'well_installed_review.fulfil_write_failed', orderId, submission: token }));
  }

  recordQuoteReviewEvent('well_installed_review.documents_received', {
    orderId,
    tier: extractTierId(order!.notes),
    documentCount: Math.min(files.length, MAX_FILES),
  });

  return NextResponse.json(
    { success: true, message: 'Received. We will reply in writing by the turnaround for your tier.' },
    { status: 201 },
  );
}

export async function GET() {
  return NextResponse.json({ success: false, message: 'Use POST (multipart/form-data).' }, { status: 405 });
}
