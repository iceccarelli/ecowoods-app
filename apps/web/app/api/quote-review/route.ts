import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendEmail, type EmailAttachment } from '@/lib/email';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { checkRateLimit, getClientIp, isTrustedBrowserOrigin, LEAD_POST_LIMIT } from '@/lib/rate-limit';

/**
 * POST /api/quote-review — "read the quote I already have".
 *
 * The MOFU surface. Someone holding a competitor's quote sends us the
 * document; a senior estimator replies with what is wrong, what is missing and
 * what is fine. It is the play against competitors with more Google reviews:
 * review volume does not tell a homeowner which of three quotes is correct.
 *
 * WHAT THIS ROUTE DELIBERATELY DOES NOT DO
 *
 * It does not write to the leads table. A person asking for a second opinion
 * has not asked us to quote their job, and filing them as a lead is how a
 * useful service turns into the thing nobody wants to use. It emails the
 * estimating desk, and a human decides whether there is a conversation to have.
 *
 * It does not store the document. The file is attached to one internal email
 * and never written to disk or blob storage — somebody else's commercial
 * document is not ours to retain, and the form says so.
 *
 * Same capture invariant as the other lead routes: the durable log line runs
 * before the rate limiter, so a false-positive throttle can never silently
 * erase a request. Document BYTES are never logged — names and sizes only.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILES = 3;
const MAX_PDF_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ACCEPTED = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const reviewSchema = z.object({
  name: z.string().min(2, 'Please enter your name'),
  email: z.string().email('Please enter a valid email'),
  message: z.string().max(2000).optional(),
  context: z.string().max(300).optional(),
  source: z.string().max(120).optional(),
  company: z.string().optional(), // honeypot
});

function reviewId(): string {
  return `qreview_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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

  if (fields.company?.trim()) {
    console.log(JSON.stringify({ event: 'quote_review.honeypot', at: new Date().toISOString() }));
    return NextResponse.json({ success: true, message: 'Received.' }, { status: 201 });
  }

  const parsed = reviewSchema.safeParse(fields);
  const fileErrors: string[] = [];
  if (files.length === 0) fileErrors.push('Attach the quote — a PDF, or photos of it.');
  if (files.length > MAX_FILES) fileErrors.push(`At most ${MAX_FILES} files.`);
  for (const f of files.slice(0, MAX_FILES)) {
    if (f.type && !ACCEPTED.has(f.type)) fileErrors.push(`${f.name}: send a PDF or an image.`);
    else if (f.type === 'application/pdf' && f.size > MAX_PDF_BYTES) fileErrors.push(`${f.name} is over 8 MB.`);
    else if (f.type !== 'application/pdf' && f.size > MAX_IMAGE_BYTES) fileErrors.push(`${f.name} is too large.`);
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

  const data = parsed.data;
  const id = reviewId();

  // Durable capture first — before the limiter, before the email.
  console.log(
    JSON.stringify({
      event: 'quote_review.captured',
      id,
      receivedAt: new Date().toISOString(),
      name: data.name,
      email: data.email,
      source: data.source,
      context: data.context,
      documents: files.map((f) => ({ name: f.name, type: f.type, size: f.size })),
    }),
  );

  const rl = checkRateLimit(getClientIp(request), LEAD_POST_LIMIT);
  if (!rl.allowed) {
    console.warn(JSON.stringify({ event: 'quote_review.rate_limited', id, note: 'Captured above.' }));
    return NextResponse.json(
      { success: false, message: 'Please wait a moment before sending another.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  try {
    const attachments: EmailAttachment[] = [];
    for (const f of files.slice(0, MAX_FILES)) {
      attachments.push({ filename: f.name || 'quote.pdf', content: Buffer.from(await f.arrayBuffer()) });
    }
    const rows = [
      ['Name', data.name],
      ['Email', data.email],
      ['Came from', data.source ?? '—'],
      ['Framework result', data.context ?? '—'],
      ['They suspect', data.message ?? '—'],
      ['Reference', id],
    ]
      .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b5d4f;">${k}</td><td style="padding:4px 0;"><strong>${v}</strong></td></tr>`)
      .join('');

    await sendEmail({
      to: process.env.ADMIN_EMAIL ?? BUSINESS_NAP.email,
      subject: `Quote review request — ${data.name}`,
      html:
        `<h2 style="margin:0 0 8px;">Somebody sent us a quote to read</h2>` +
        `<p style="margin:0 0 16px;">${attachments.length} document(s) attached. Reply with what is wrong, what is missing, and what is fine — including when the answer is that it is a good quote.</p>` +
        `<table style="border-collapse:collapse;">${rows}</table>`,
      text: `Quote review from ${data.name} (${data.email}). ${attachments.length} document(s). Context: ${data.context ?? 'none'}`,
      attachments,
    });
  } catch (err) {
    console.error(
      JSON.stringify({ event: 'quote_review.email_failed', id, error: err instanceof Error ? err.message : 'unknown' }),
    );
  }

  return NextResponse.json(
    { success: true, id, message: 'Received. A senior estimator will read it and reply.' },
    { status: 201 },
  );
}

export async function GET() {
  return NextResponse.json({ success: false, message: 'Use POST (multipart/form-data).' }, { status: 405 });
}
