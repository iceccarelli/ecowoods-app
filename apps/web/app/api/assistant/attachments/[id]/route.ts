/**
 * DELETE /api/assistant/attachments/[id]?designId=... — make an attached
 * photo actually go away.
 *
 * The missing half of POST /api/assistant/attachments. Uploading granted a
 * real ASSISTANT_PHOTOS consent and wrote real bytes to a private bucket;
 * until this route existed, nothing could ever remove either one — a
 * homeowner who attached a photo had no way to take it back, and
 * `withdrawConsent` sat in lib/floor-graph/consent.ts unreachable from this
 * surface.
 *
 * Ownership: same boundary as GET /api/assistant/conversation — the owning
 * account, or the private access cookie; designId alone is not enough
 * (conversation-store.ts's findOwnedAttachment).
 *
 * DURABILITY CONTRACT — read before changing this route.
 *
 * Deletion has two independent external legs (the storage object, the
 * consent grant) plus one DB write recording which legs are done. The three
 * must never be collapsed into "wipe the pointers, then try the legs" — if
 * either leg fails after the pointers are gone, nothing can ever retry it.
 * So this route always goes claim -> cleanup -> finalize:
 *
 *   1. claimAttachmentForDeletion marks the row 'deleting' WITHOUT touching
 *      url/consentId, and reports exactly which legs are still outstanding
 *      (a retry naturally reports fewer).
 *   2. Only the outstanding legs are attempted, for real, here.
 *   3. finalizeAttachmentDeletion records the real outcome. Only once BOTH
 *      legs are done (or there was never a consentId to withdraw) does the
 *      row actually lose its url/consentId and become 'unavailable'.
 *
 * The response's `complete` field is the only thing that may be read as
 * "fully deleted" — `ok: true` alone means only "the request was handled
 * without a server error," not that cleanup finished. The client must
 * check `complete`, not `res.ok`.
 */
import { NextResponse } from 'next/server';
import { getClientIp, isTrustedBrowserOrigin } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit-durable';
import { auth } from '@/lib/auth';
import { readAccessToken } from '@/lib/assistant-workspace/conversation-access';
import { claimAttachmentForDeletion, finalizeAttachmentDeletion } from '@/lib/assistant-workspace/conversation-store';
import { deleteAttachment as deleteStoredObject } from '@/lib/assistant-workspace/attachment-storage';
import { withdrawConsentById } from '@/lib/floor-graph/consent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Generous — a homeowner removing several photos (and retrying a failed one) in one sitting, not a bulk-delete script. */
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
  const viewerUserId = session?.user?.id ?? null;
  const accessToken = readAccessToken(request, designId);

  const claim = await claimAttachmentForDeletion(designId, id, viewerUserId, accessToken);
  if (!claim.ok) {
    const status = claim.reason === 'forbidden' ? 403 : claim.reason === 'not_found' ? 404 : 502;
    return NextResponse.json({ error: claim.reason }, { status });
  }
  if (claim.alreadyComplete) {
    return NextResponse.json({ ok: true, complete: true, storageDeleted: true, consentWithdrawn: true }, { status: 200 });
  }

  // Only attempt the legs claimAttachmentForDeletion says are still
  // outstanding — a retry never re-runs a leg that already succeeded.
  const storageDeleted = claim.needsStorage
    ? await deleteStoredObject(claim.storagePath!).catch((err) => {
        console.warn(JSON.stringify({ event: 'assistant.attachment.delete_object_failed', attachmentId: id, error: err instanceof Error ? err.message : 'unknown' }));
        return false;
      })
    : true; // already done (or there was never a storage path at all, per claim's own needsStorage logic)

  const consentWithdrawn = claim.needsConsent
    ? await withdrawConsentById(claim.consentId!).catch((err) => {
        console.warn(JSON.stringify({ event: 'assistant.attachment.withdraw_consent_failed', attachmentId: id, error: err instanceof Error ? err.message : 'unknown' }));
        return false;
      })
    : true; // already withdrawn, or there was never a consent grant associated (legacy attachment)

  const final = await finalizeAttachmentDeletion(designId, id, viewerUserId, accessToken, { storageDeleted, consentWithdrawn });
  if (!final.ok) {
    // The claim succeeded but recording the outcome did not — the row is
    // still 'deleting' with whatever flags the LAST successful finalize
    // left it at, which is exactly the state a future retry needs to see.
    // Never report complete here: we do not actually know the final state.
    return NextResponse.json({ error: final.reason }, { status: 502 });
  }

  return NextResponse.json({ ok: true, complete: final.complete, storageDeleted, consentWithdrawn }, { status: 200 });
}

export async function GET() {
  return NextResponse.json({ error: 'Use DELETE to remove an attachment.' }, { status: 405 });
}
