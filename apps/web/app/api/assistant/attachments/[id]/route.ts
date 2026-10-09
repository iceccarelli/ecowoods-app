/**
 * DELETE /api/assistant/attachments/[id]?designId=... — make an attached
 * photo actually go away.
 *
 * The missing half of POST /api/assistant/attachments. Uploading granted a
 * real ASSISTANT_PHOTOS consent and wrote real bytes to a private bucket;
 * until this route existed, nothing could ever remove either one — a
 * homeowner who attached a photo had no way to take it back, and
 * `withdrawConsent` sat in lib/floor-graph/consent.ts unreachable from this
 * surface. This is that path: delete the stored object, withdraw the
 * specific consent grant that named it, and mark the persisted message's
 * attachment `unavailable` so a reload never re-signs or re-displays it and
 * the chat route never re-sends it to the model.
 *
 * Ownership: same anonymous-first / account-linked boundary as GET
 * /api/assistant/conversation (conversation-store.ts's deleteStoredAttachment)
 * — a conversation linked to a real account can only be touched by that
 * account's own session.
 *
 * The three cleanup steps (DB row, storage object, consent withdrawal) are
 * each attempted and each reported, rather than treated as all-or-nothing:
 * the DB row is authoritative for what the app will ever show or resend
 * again, so it is updated first and its success is what the route's overall
 * success means. A storage or consent-ledger failure after that point is
 * real and logged, but must not make the route claim the photo is still
 * live when the application will never display or resend it again.
 */
import { NextResponse } from 'next/server';
import { getClientIp, isTrustedBrowserOrigin } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit-durable';
import { auth } from '@/lib/auth';
import { deleteStoredAttachment } from '@/lib/assistant-workspace/conversation-store';
import { deleteAttachment as deleteStoredObject } from '@/lib/assistant-workspace/attachment-storage';
import { withdrawConsentById } from '@/lib/floor-graph/consent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Generous — a homeowner removing several photos in one sitting, not a bulk-delete script. */
const DELETE_RATE_LIMIT = { windowMs: 60_000, maxRequests: 20 };

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedBrowserOrigin(request)) {
    return NextResponse.json({ error: 'Origin not allowed.' }, { status: 403 });
  }

  const ip = getClientIp(request);
  const rateLimit = await enforceRateLimit({ routeKey: 'assistant-attachment-delete', identity: ip, config: DELETE_RATE_LIMIT });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests, give it a moment.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }

  const { id } = await params;
  const designId = new URL(request.url).searchParams.get('designId') ?? '';
  const session = await auth().catch(() => null);

  const result = await deleteStoredAttachment(designId, id, session?.user?.id ?? null);
  if (!result.ok) {
    const status = result.reason === 'forbidden' ? 403 : result.reason === 'not_found' ? 404 : 502;
    return NextResponse.json({ error: result.reason }, { status });
  }

  const storageDeleted = result.storedPath ? await deleteStoredObject(result.storedPath).catch(() => false) : true;
  if (!storageDeleted) {
    console.warn(JSON.stringify({ event: 'assistant.attachment.delete_object_failed', attachmentId: id }));
  }

  const consentWithdrawn = result.consentId ? await withdrawConsentById(result.consentId).catch(() => false) : false;
  if (result.consentId && !consentWithdrawn) {
    console.warn(JSON.stringify({ event: 'assistant.attachment.withdraw_consent_failed', attachmentId: id }));
  }

  return NextResponse.json({ ok: true, storageDeleted, consentWithdrawn }, { status: 200 });
}

export async function GET() {
  return NextResponse.json({ error: 'Use DELETE to remove an attachment.' }, { status: 405 });
}
