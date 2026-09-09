import { NextResponse } from 'next/server';
import { photoTriageSchema } from '@ecowoods/shared/schemas';
import { db } from '@/lib/db';
import { sendAdminPhotoTriageEmail, type EmailAttachment } from '@/lib/email';
import { checkRateLimit, getClientIp, isTrustedBrowserOrigin, LEAD_POST_LIMIT } from '@/lib/rate-limit';
import { recordAssessment, storeAssessmentPhotos, type PhotoInput } from '@/lib/floor-graph';
import { grantConsent, readCheckbox } from '@/lib/floor-graph/consent';
import { storePhoto } from '@/lib/floor-graph/photo-storage';

/**
 * POST /api/photo-triage — track B of the two-track quote form.
 *
 * Three photos, a rough size, an intent, and contact details. It is a TRIAGE,
 * not a quote: the fixed price is written only after the in-home measure, and
 * the form says so in the same breath it asks for the photos.
 *
 * SAME INVARIANT AS /api/leads: once the fields validate, the lead is captured
 * — the durable structured log runs before the rate limiter, before the DB,
 * before the email, so no downstream failure (and no false-positive throttle)
 * can erase a person who tried to give us work. Photo BYTES are not logged
 * (they'd blow the log line); their names and sizes are, so a lost email is
 * still actionable from the log.
 *
 * WHAT CHANGED WHEN THE FLOOR GRAPH ARRIVED, AND WHAT DID NOT.
 *
 * Every submission now also writes a FloorAssessment row: the area, the
 * stated intent, the rough size, and the fact that a triage happened on a
 * given day. That is operational data about our own demand, collected from
 * somebody asking us to quote, and it is the shape of the business nobody
 * here could previously describe because it existed only as a folder of
 * internal email.
 *
 * The PHOTOGRAPHS are different and are gated. They are retained only when
 * the person ticked the retention box, only under a consent row that stores
 * the exact wording they were shown, and only into a private store — see
 * lib/floor-graph/photo-storage.ts, which refuses to write to a public blob
 * and fails closed when no private store is configured. Untick the box and
 * this route behaves exactly as it did before: photos to the estimating desk
 * by email, nothing kept.
 *
 * The capture invariant is unchanged and takes precedence over all of it. The
 * Floor Graph write happens AFTER the lead is safe, in a try/catch that
 * cannot reach the response. A dropped data point costs a data point; a
 * dropped lead costs a job.
 *
 * Multipart only. The client compresses each image to ≤1.5 MB
 * (lib/image-compress.ts); the server re-checks count/type/size because the
 * no-JS fallback posts originals.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILES = 3;
const MAX_FILE_BYTES = 2 * 1024 * 1024; // client targets 1.5 MB; small server headroom
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

function triageId(): string {
  return `triage_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Where to send a no-JS browser back to. Same-origin only. */
function backTo(request: Request, ok: boolean): string {
  const ref = request.headers.get('referer');
  try {
    const site = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ecowoods.ca');
    const u = new URL(ref ?? '/', site);
    if (u.host !== site.host) return '/?sent=1';
    u.searchParams.set(ok ? 'sent' : 'error', '1');
    u.hash = 'quote';
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return ok ? '/?sent=1' : '/?error=1';
  }
}

export async function POST(request: Request) {
  // CSRF hygiene: a browser POST from a foreign origin is refused outright.
  if (!isTrustedBrowserOrigin(request)) {
    return NextResponse.json({ success: false, message: 'Origin not allowed.' }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, message: 'Send this form as multipart/form-data with up to 3 photos.' },
      { status: 400 },
    );
  }

  const isFormPost = !(request.headers.get('x-requested-with') === 'fetch');

  const fields: Record<string, string> = {};
  const files: File[] = [];
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') {
      if (value !== '') fields[key] = value;
    } else if (key === 'photos') {
      if (value.size > 0) files.push(value);
    }
  }

  // Honeypot — accept silently so a bot cannot learn it was detected.
  if (fields.company?.trim()) {
    console.log(JSON.stringify({ event: 'photo_triage.honeypot', at: new Date().toISOString() }));
    if (isFormPost) return NextResponse.redirect(new URL(backTo(request, true), request.url), 303);
    return NextResponse.json({ success: true, message: 'Photos received. We will call you back.' }, { status: 201 });
  }

  const parsed = photoTriageSchema.safeParse(fields);
  const fileErrors: string[] = [];
  if (files.length === 0) fileErrors.push('Attach at least one photo (up to 3).');
  if (files.length > MAX_FILES) fileErrors.push(`At most ${MAX_FILES} photos.`);
  for (const f of files.slice(0, MAX_FILES)) {
    if (f.type && !ACCEPTED_TYPES.has(f.type)) fileErrors.push(`${f.name}: use JPEG, PNG, WebP or HEIC.`);
    else if (f.size > MAX_FILE_BYTES) fileErrors.push(`${f.name} is too large — photos must be under 2 MB each.`);
  }

  if (!parsed.success || fileErrors.length) {
    const fieldErrors: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && !(key in fieldErrors)) fieldErrors[key] = issue.message;
      }
    }
    if (fileErrors.length) fieldErrors.photos = fileErrors.join(' ');
    if (isFormPost && !request.headers.get('accept')?.includes('application/json')) {
      return NextResponse.redirect(new URL(backTo(request, false), request.url), 303);
    }
    return NextResponse.json(
      { success: false, message: 'Please check the highlighted fields.', fieldErrors },
      { status: 400 },
    );
  }

  const lead = parsed.data;
  const leadId = triageId();

  /* Unticked is the default and is sent as ABSENT by every browser, so this
     reads false unless somebody actively said yes. */
  const photoConsent = readCheckbox(fields.photoConsent);

  // 1. DURABLE CAPTURE — before the limiter, before anything that can fail.
  console.log(
    JSON.stringify({
      event: 'photo_triage.captured',
      leadId,
      receivedAt: new Date().toISOString(),
      lead,
      photos: files.map((f) => ({ name: f.name, type: f.type, size: f.size })),
    }),
  );

  // 2. Rate limit — after capture, so a false positive inconveniences, never erases.
  const rl = checkRateLimit(getClientIp(request), LEAD_POST_LIMIT);
  if (!rl.allowed) {
    console.warn(JSON.stringify({ event: 'photo_triage.rate_limited', leadId, note: 'Captured in the log line above.' }));
    return NextResponse.json(
      { success: false, message: 'Please wait a moment before sending another request.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  // 3. Best-effort DB persistence (same QuoteRequest table the measure track uses).
  let quoteId: string | null = null;
  try {
    const quote = await db.quoteRequest.create({
      data: {
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        city: lead.area,
        service: `photo-triage:${lead.intent}`,
        squareFeet: lead.sqft ?? null,
        notes: [
          photoConsent
            ? 'PHOTO TRIAGE — photos emailed; retained in the Floor Graph with consent.'
            : 'PHOTO TRIAGE — photos emailed, not retained.',
          lead.designSummary ? `Design config: ${lead.designSummary}` : null,
          `Photos: ${files.map((f) => f.name).join(', ')}`,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    });
    quoteId = quote.id;
  } catch (err) {
    console.error(
      JSON.stringify({
        event: 'photo_triage.db_persist_failed',
        leadId,
        error: err instanceof Error ? err.message : 'unknown',
        hint: 'Lead is safe in photo_triage.captured above.',
      }),
    );
  }

  // 4. Best-effort internal email with the photos attached.
  try {
    const attachments: EmailAttachment[] = [];
    for (const f of files.slice(0, MAX_FILES)) {
      attachments.push({ filename: f.name || 'photo.jpg', content: Buffer.from(await f.arrayBuffer()) });
    }
    await sendAdminPhotoTriageEmail({
      leadId: quoteId ?? leadId,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      area: lead.area,
      intent: lead.intent,
      sqft: lead.sqft,
      designSummary: lead.designSummary,
      attachments,
    });
  } catch (err) {
    console.error(
      JSON.stringify({ event: 'photo_triage.email_failed', leadId, error: err instanceof Error ? err.message : 'unknown' }),
    );
  }

  // 5. FLOOR GRAPH — strictly downstream. Nothing below this line may change
  //    the response, and nothing below this line may throw out of the route.
  try {
    const assessment = await recordAssessment({
      source: 'PHOTO_TRIAGE',
      quoteRequestId: quoteId,
      statedIntent: lead.intent,
      statedSqFt: lead.sqft ?? null,
      city: lead.area,
    });

    /* Photographs only past this point, and only with a live grant. The
       consent row is written BEFORE the first byte is stored, so there is no
       window in which a retained image exists without one. */
    if (assessment.ok && photoConsent) {
      const consentId = await grantConsent({
        purpose: 'ASSESSMENT_PHOTOS',
        surface: 'estimate-form:photos',
        subjectEmail: lead.email,
      });

      const stored: PhotoInput[] = [];
      let position = 0;
      for (const f of files.slice(0, MAX_FILES)) {
        const buffer = Buffer.from(await f.arrayBuffer());
        const contentType = f.type || 'image/jpeg';
        const put = await storePhoto(buffer, `${assessment.value}-${position}`, contentType);
        if (!put.ok) {
          /* Fails closed: no private store configured, or the upload failed.
             The photographs are already on their way to the estimating desk
             by email; they are simply not kept. */
          console.warn(
            JSON.stringify({ event: 'floor_graph.photo_not_retained', leadId, reason: put.reason }),
          );
          break;
        }
        stored.push({ url: put.url, contentType, bytes: buffer.byteLength, position });
        position += 1;
      }

      if (stored.length > 0) {
        await storeAssessmentPhotos(assessment.value, consentId, stored);
      }
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        event: 'floor_graph.triage_capture_failed',
        leadId,
        error: err instanceof Error ? err.message : 'unknown',
        hint: 'Lead and email are unaffected — see photo_triage.captured above.',
      }),
    );
  }

  if (isFormPost && !request.headers.get('accept')?.includes('application/json')) {
    return NextResponse.redirect(new URL(backTo(request, true), request.url), 303);
  }
  return NextResponse.json(
    {
      success: true,
      leadId,
      quoteId,
      message: 'Photos received. A senior estimator will call you back — the fixed price is written after we measure.',
    },
    { status: 201 },
  );
}

export async function GET() {
  return NextResponse.json({ success: false, message: 'Use POST (multipart/form-data) to submit photos.' }, { status: 405 });
}
