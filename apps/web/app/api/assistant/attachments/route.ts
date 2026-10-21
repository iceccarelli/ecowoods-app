/**
 * POST /api/assistant/attachments — upload one photo to attach in Ask
 * Francisco (/assistant).
 *
 * Separate from /api/photo-triage (estimate-form lead capture) on purpose:
 * that route's photos are retained under ASSESSMENT_PHOTOS consent, tied to
 * a lead and a FloorAssessment row. This route has no lead and writes no
 * Floor Graph row — it exists only so the homeowner can show Francisco a
 * photo inside a conversation. The consent purpose (ASSISTANT_PHOTOS), the
 * bucket (lib/assistant-workspace/attachment-storage.ts), and the retention
 * story are all separate from the triage path for exactly that reason.
 *
 * Multipart only: `photo` (one file), `designId` (the MEAS-01 join key this
 * conversation already uses). The client compresses with
 * lib/image-compress.ts before sending; the server re-checks type/size since
 * nothing stops a direct POST from skipping that step.
 *
 * Consent is granted here, unconditionally, because attaching a photo IS the
 * request to analyze it — there is no separate retention checkbox the way
 * the triage form has one, because nothing here is kept past this one
 * conversation's own lifetime. The grant still exists (ASSISTANT_PHOTOS,
 * see lib/floor-graph/wording.ts) because the capture layer's own law is
 * "no retained photograph without a named lawful basis," and a consent row
 * with the wording that was effectively shown (the upload affordance's own
 * label, enforced client-side) is how that basis is named — see
 * docs/FLOOR_GRAPH.md and scripts/verify-floor-graph.mjs.
 */
import { NextResponse } from 'next/server';
import { getClientIp, isTrustedBrowserOrigin } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit-durable';
import { auth } from '@/lib/auth';
import { readAccessToken, serializeAccessCookie } from '@/lib/assistant-workspace/conversation-access';
import { establishConversation } from '@/lib/assistant-workspace/conversation-store';
import { sniffFile, safeFilename } from '@/lib/image-sniff';
import { isDesignId } from '@/lib/floor-studio/design-id';
import { grantConsent } from '@/lib/floor-graph/consent';
import { storeAttachment, signAttachmentUrl, attachmentConsentSurface } from '@/lib/assistant-workspace/attachment-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_BYTES = 2 * 1024 * 1024; // client targets 1.5 MB (lib/image-compress.ts); small server headroom

/** 10 uploads/minute/IP — generous for a homeowner attaching a couple of photos, tight enough to blunt a storage-filling flood. */
const ATTACHMENT_RATE_LIMIT = { windowMs: 60_000, maxRequests: 10 };

function attachmentId(): string {
  return `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(request: Request) {
  if (!isTrustedBrowserOrigin(request)) {
    return NextResponse.json({ error: 'Origin not allowed.' }, { status: 403 });
  }

  const ip = getClientIp(request);
  const rateLimit = await enforceRateLimit({ routeKey: 'assistant-attachment-upload', identity: ip, config: ATTACHMENT_RATE_LIMIT });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many uploads, give it a moment.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Send this as multipart/form-data with one photo.' }, { status: 400 });
  }

  const designId = String(form.get('designId') ?? '');
  if (!isDesignId(designId)) {
    return NextResponse.json({ error: 'Missing or invalid designId.' }, { status: 400 });
  }

  const file = form.get('photo');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Attach one photo.' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'That photo is too large — please use one under 2 MB.' }, { status: 400 });
  }
  /* The type is decided from the bytes. The declared type is only a hint and a
     missing one no longer skips the check. */
  const sniffed = await sniffFile(file);
  if (!sniffed) {
    return NextResponse.json({ error: 'Use JPEG, PNG, WebP or HEIC.' }, { status: 400 });
  }

  const session = await auth().catch(() => null);

  /* designId alone must not let a stranger attach photos to someone's
     conversation: the caller must hold its private capability (or be its
     owner). First contact mints the conversation and its cookie. */
  const access = await establishConversation(designId, session?.user?.id ?? null, readAccessToken(request, designId));
  if (!access.ok) {
    return access.reason === 'forbidden'
      ? NextResponse.json({ error: 'forbidden' }, { status: 403 })
      : NextResponse.json({ error: "Couldn't save that photo — try again in a moment." }, { status: 502 });
  }

  const id = attachmentId();
  const contentType = sniffed.contentType;
  const buffer = Buffer.from(await file.arrayBuffer());

  const consentId = await grantConsent({
    purpose: 'ASSISTANT_PHOTOS',
    // Stamped per-attachment (not a flat 'assistant-chat:attachments'
    // label) so chat/route.ts can later verify a client-echoed consentId
    // was actually issued for THIS id, not replayed from a different
    // upload — see isConsentValidForAttachment's own comment for why that
    // matters.
    surface: attachmentConsentSurface(id),
    userId: session?.user?.id ?? null,
  }).catch((err) => {
    console.error(JSON.stringify({ event: 'assistant.attachment.consent_failed', error: err instanceof Error ? err.message : 'unknown' }));
    return null;
  });
  if (!consentId) {
    return NextResponse.json({ error: "Couldn't record consent for that upload — try again." }, { status: 502 });
  }

  const stored = await storeAttachment(buffer, `${designId}/${id}`, contentType);
  if (!stored.ok) {
    console.error(JSON.stringify({ event: 'assistant.attachment.store_failed', reason: stored.reason }));
    return NextResponse.json({ error: "Couldn't save that photo — try again in a moment." }, { status: 502 });
  }

  const previewUrl = await signAttachmentUrl(stored.path, 600);

  const response = NextResponse.json(
    {
      id,
      kind: 'room_photo' as const,
      path: stored.path,
      previewUrl,
      contentType,
      filename: safeFilename(file.name, sniffed.ext),
      // Echoed straight through by the client into the attachment ref it
      // sends with the chat turn — see chat-schema.ts's attachmentRefSchema
      // and StoredAttachment.consentId for why this is the one way the
      // persisted row can later be told "delete this, and withdraw the
      // consent that named its lawful basis" without guessing.
      consentId,
    },
    { status: 201 },
  );
  if (access.newToken) response.headers.append('Set-Cookie', serializeAccessCookie(designId, access.newToken));
  return response;
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST (multipart/form-data) to upload a photo.' }, { status: 405 });
}
