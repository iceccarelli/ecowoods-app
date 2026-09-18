/**
 * POST /api/listing-floor-report/submit
 *
 * Post-payment intake for the Pre-List Floor Condition Report (EW-0003).
 * Collects the listing details, the photography date, and (for the photo
 * SKU) 3–8 photos — the same MIME/size limits as /api/photo-triage, copied
 * locally rather than imported so that route stays untouched.
 *
 * Photo retention reuses the EXISTING Floor Graph consent gate
 * (ConsentPurpose.ASSESSMENT_PHOTOS) exactly as /api/photo-triage does: no
 * new consent purpose, no schema change. Unticked, or on any storage
 * failure, the photos still go to the estimating desk by email and are
 * never retained — same fail-closed behavior as the existing route.
 *
 * DELIBERATE CONSOLIDATION vs the brief: the brief's step 1 (checkout) lists
 * phone/role/brokerage/address/city/photography-date/go-live-date as
 * landing-page fields, and step 5 (intake) asks for the photography date a
 * second time. All of it is collected exactly once, here, post-payment —
 * see the checkout route's own comment for why checkout stays name/email/sku
 * only.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { sendEmail, type EmailAttachment } from '@/lib/email';
import { checkListingReportSubmissionEligibility } from '@/lib/listing-floor-report';
import { appendIntakeMarker, appendMetaMarker, extractListingReportSku, hasIntakeMarker, isListingFloorReportOrder } from '@/lib/listing-floor-report/notes';
import { grantConsent, readCheckbox } from '@/lib/floor-graph/consent';
import { storePhoto } from '@/lib/floor-graph/photo-storage';
import { recordAssessment, storeAssessmentPhotos, type PhotoInput } from '@/lib/floor-graph';
import { checkRateLimit, getClientIp, isTrustedBrowserOrigin, LEAD_POST_LIMIT } from '@/lib/rate-limit';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 8;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

const fieldsSchema = z.object({
  orderId: z.string().uuid('Missing order reference.'),
  email: z.string().email('Please enter a valid email'),
  role: z.enum(['agent', 'seller']),
  brokerage: z.string().max(200).optional(),
  phone: z.string().max(40).optional(),
  address: z.string().min(3, 'Enter the listing address.').max(300),
  city: z.string().min(2, 'Enter the city.').max(120),
  photographyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date for when photography happens.'),
  listingGoLiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  message: z.string().max(2000).optional(),
});

function reasonMessage(reason: string): { message: string; status: number } {
  switch (reason) {
    case 'not_found':
      return { message: 'We could not find that order.', status: 404 };
    case 'unpaid':
      return {
        message: 'This order has not been paid yet. If you just paid, wait a few seconds and refresh.',
        status: 402,
      };
    case 'already_submitted':
      return { message: 'This order has already been submitted.', status: 409 };
    case 'email_mismatch':
      return { message: 'That email does not match the one used at checkout.', status: 409 };
    default:
      return { message: 'This order is not eligible.', status: 409 };
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
      { success: false, message: 'Send this as multipart/form-data.' },
      { status: 400 },
    );
  }

  const fields: Record<string, string> = {};
  const files: File[] = [];
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') {
      if (value !== '') fields[key] = value;
    } else if (key === 'photos' && value.size > 0) {
      files.push(value);
    }
  }

  const parsed = fieldsSchema.safeParse(fields);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
    return NextResponse.json(
      { success: false, message: 'Please check the highlighted fields.', fieldErrors },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const rl = checkRateLimit(getClientIp(request), LEAD_POST_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: 'Please wait a moment before sending another.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  const order = await db.order.findUnique({ where: { id: data.orderId }, include: { user: true } });
  if (order && !isListingFloorReportOrder(order.notes)) {
    return NextResponse.json({ success: false, message: 'Not a listing floor report order.' }, { status: 404 });
  }
  const eligibility = checkListingReportSubmissionEligibility(
    order ? { status: order.status, userEmail: order.user.email, alreadySubmitted: hasIntakeMarker(order.notes) } : null,
    data.email,
  );
  if (!eligibility.ok) {
    const { message, status } = reasonMessage(eligibility.reason);
    return NextResponse.json({ success: false, message }, { status });
  }

  /* sku is read from the order's own notes, never from the request body —
     the client cannot loosen the photo-count requirement by claiming a
     different SKU than the one actually paid for. */
  const sku = extractListingReportSku(order!.notes);
  const fileErrors: string[] = [];
  if (sku === 'photo') {
    if (files.length < MIN_PHOTOS) fileErrors.push(`Attach at least ${MIN_PHOTOS} photos: traffic lanes, overall field, a transition, and a close-up of any wear.`);
    if (files.length > MAX_PHOTOS) fileErrors.push(`At most ${MAX_PHOTOS} photos.`);
  }
  for (const f of files.slice(0, MAX_PHOTOS)) {
    if (f.type && !ACCEPTED.has(f.type)) fileErrors.push(`${f.name}: use JPEG, PNG, WebP or HEIC.`);
    else if (f.size > MAX_IMAGE_BYTES) fileErrors.push(`${f.name} is too large — photos must be under 2 MB each.`);
  }
  if (fileErrors.length) {
    return NextResponse.json(
      { success: false, message: 'Please check the highlighted fields.', fieldErrors: { photos: fileErrors.join(' ') } },
      { status: 400 },
    );
  }

  const photoConsent = readCheckbox(fields.photoConsent);
  let retainedPhotoCount = 0;

  // Floor Graph write is strictly downstream — see /api/photo-triage for the
  // same invariant. Nothing below this block may change the response.
  if (sku === 'photo') {
    try {
      const assessment = await recordAssessment({
        source: 'PHOTO_TRIAGE',
        statedIntent: 'pre-list',
        city: data.city,
      });

      if (assessment.ok && photoConsent) {
        const consentId = await grantConsent({
          purpose: 'ASSESSMENT_PHOTOS',
          surface: 'listing-floor-report:photos',
          subjectEmail: data.email,
        });

        const stored: PhotoInput[] = [];
        let position = 0;
        for (const f of files.slice(0, MAX_PHOTOS)) {
          const buffer = Buffer.from(await f.arrayBuffer());
          const contentType = f.type || 'image/jpeg';
          const put = await storePhoto(buffer, `${assessment.value}-${position}`, contentType);
          if (!put.ok) {
            console.warn(JSON.stringify({ event: 'listing_floor_report.photo_not_retained', orderId: order!.id, reason: put.reason }));
            break;
          }
          stored.push({ url: put.url, contentType, bytes: buffer.byteLength, position });
          position += 1;
        }
        if (stored.length > 0) {
          const result = await storeAssessmentPhotos(assessment.value, consentId, stored);
          if (result.ok) retainedPhotoCount = result.value;
        }
      }
    } catch (err) {
      console.error(
        JSON.stringify({ event: 'listing_floor_report.floor_graph_failed', orderId: order!.id, error: err instanceof Error ? err.message : 'unknown' }),
      );
    }
  }

  try {
    const attachments: EmailAttachment[] = [];
    for (const f of files.slice(0, MAX_PHOTOS)) {
      attachments.push({ filename: f.name || 'photo.jpg', content: Buffer.from(await f.arrayBuffer()) });
    }
    const rows = [
      ['Order', order!.id],
      ['SKU', sku],
      ['Role', data.role],
      ['Brokerage', data.brokerage ?? '—'],
      ['Phone', data.phone ?? '—'],
      ['Listing address', `${data.address}, ${data.city}`],
      ['Photography date', data.photographyDate],
      ['Listing go-live', data.listingGoLiveDate ?? '—'],
      ['Email', data.email],
      ['Message', data.message ?? '—'],
      ['Photos retained in Floor Graph', String(retainedPhotoCount)],
    ]
      .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b5d4f;">${k}</td><td style="padding:4px 0;"><strong>${v}</strong></td></tr>`)
      .join('');

    await sendEmail({
      to: process.env.ADMIN_EMAIL ?? BUSINESS_NAP.email,
      subject: `PAID listing floor report — ${sku} — ${data.address}`,
      html:
        `<h2 style="margin:0 0 8px;">Paid Pre-List Floor Condition Report intake</h2>` +
        `<p style="margin:0 0 16px;">${attachments.length} photo(s) attached.</p>` +
        `<table style="border-collapse:collapse;">${rows}</table>`,
      text: `Listing floor report intake, order ${order!.id}, sku ${sku}. ${attachments.length} photo(s).`,
      attachments,
    });
  } catch (err) {
    console.error(
      JSON.stringify({ event: 'listing_floor_report.email_failed', orderId: data.orderId, error: err instanceof Error ? err.message : 'unknown' }),
    );
    return NextResponse.json(
      { success: false, message: 'Something went wrong sending that. Please call and we will pick it up directly.' },
      { status: 500 },
    );
  }

  const notesWithMeta = appendMetaMarker(order!.notes, {
    role: data.role,
    brokerage: data.brokerage,
    phone: data.phone,
    address: data.address,
    city: data.city,
    photographyDate: data.photographyDate,
    listingGoLiveDate: data.listingGoLiveDate,
    message: data.message,
  });
  await db.order.update({ where: { id: order!.id }, data: { notes: appendIntakeMarker(notesWithMeta) } });

  console.log(JSON.stringify({ event: 'listing_floor_report.intake_submitted', orderId: order!.id, photoCount: files.length }));

  return NextResponse.json(
    { success: true, orderId: order!.id, message: 'Received. Your estimator is on it.' },
    { status: 201 },
  );
}

export async function GET() {
  return NextResponse.json({ success: false, message: 'Use POST (multipart/form-data).' }, { status: 405 });
}
