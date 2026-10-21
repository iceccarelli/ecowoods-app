/**
 * lib/assistant-workspace/conversation-store.ts — Ask Francisco's durable
 * transcript (Gate 2, P0).
 *
 * WHAT THIS IS NOT
 *
 * Not a second Project Decision State. WorkspaceState (the objective, sell
 * horizon, rooms, target floor, selected services…) already persists —
 * client-side, in localStorage, keyed by designId
 * (WorkspaceStateProvider.tsx / lib/assistant-workspace/persistence.ts). This
 * module only makes the CONVERSATION reload-safe: what was said, in what
 * order, with which structured blocks attached. It never writes workspace
 * fields and is never read as the source of truth for them — the client
 * still sends its own workspace snapshot on every turn exactly as before.
 *
 * Not a second identity system. `designId` is the same MEAS-01 join key
 * QuoteRequest/Project/FunnelEvent/RenovationAnalysis already use —
 * anonymous-first, minted client-side by ensureDesignId(). `userId` is
 * attached only when a real session exists, and is never required.
 *
 * FAILURE POSTURE
 *
 * The chat route's job is answering the homeowner; persistence is a
 * side-effect of that, not a precondition for it. Every function here
 * swallows its own database errors and returns a value the caller can
 * safely ignore (an empty transcript, a no-op write) rather than letting a
 * transient Postgres hiccup take down the conversation itself.
 */
import { db } from '@/lib/db';
import { isDesignId } from '@/lib/floor-studio/design-id';
import { signAttachmentUrl } from './attachment-storage';
import type { AssistantChatCard } from './chat-schema';
import { hashAccessToken, isConversationAuthorized, newAccessToken } from './conversation-access';

export interface StoredAttachment {
  id: string;
  kind: 'room_photo' | 'floor_photo' | 'document';
  status: 'selected' | 'uploading' | 'uploaded' | 'analyzing' | 'analyzed' | 'failed' | 'deleting' | 'unavailable';
  filename?: string;
  url?: string;
  /**
   * The ConsentRecord row this attachment's retention is named under (see
   * lib/floor-graph/consent.ts's law: "a photograph whose lawful basis
   * cannot be named is a photograph we should not be holding"). Set once,
   * at persist time, from the value the upload route's grantConsent() call
   * returned — and only after chat/route.ts has independently verified that
   * grant was actually issued for THIS attachment id (never trusted as a
   * bare client echo — see chat/route.ts's validation gate). Internal only:
   * loadTranscript strips it before the transcript reaches the browser, and
   * the delete path reads it straight from this stored row.
   */
  consentId?: string;
  /**
   * Cleanup progress for a `status: 'deleting'` row — present only while a
   * deletion is in flight or partially failed. `url`/`consentId` are
   * DELIBERATELY KEPT (not wiped) while either flag is still false: that is
   * the only record of where the bytes are and which grant to withdraw, and
   * wiping it on the first attempt — the bug this replaced — makes a failed
   * cleanup unretryable forever. Both fields, and `url`/`consentId`
   * themselves, are cleared together only once BOTH are true (or
   * `consentId` was never set), at which point `status` becomes
   * `'unavailable'` and there is nothing left to retry.
   */
  storageDeleted?: boolean;
  consentWithdrawn?: boolean;
}

export interface StoredTurn {
  role: 'user' | 'assistant';
  content: string;
  blocks?: AssistantChatCard[];
  attachments?: StoredAttachment[];
  model?: string;
  createdAt: string;
}

/** Most recent N turns, oldest first — matches the order /api/assistant/chat expects for `messages`. */
const MAX_LOADED_TURNS = 60;

/**
 * `designId` is a shareable design label (Floor Studio share links carry it
 * — design-id.ts), so it is NOT the credential for a conversation. Reading a
 * transcript requires either the session of the account the conversation is
 * linked to, or — for an anonymous conversation — the private capability
 * minted when it was created (conversation-access.ts), presented by the
 * browser that created it. `accessToken` is that capability; `viewerUserId`
 * is the caller's own session (`auth()`).
 *
 * An unauthorized read returns the same empty result as "no conversation
 * exists" — never a distinct denial — so probing a design id can't even
 * learn whether it names someone else's conversation.
 */
export async function loadTranscript(
  designId: string | undefined,
  viewerUserId: string | null,
  accessToken: string | null,
): Promise<StoredTurn[]> {
  if (!designId || !isDesignId(designId)) return [];
  try {
    const conversation = await db.assistantConversation.findUnique({
      where: { designId },
      select: {
        userId: true,
        accessTokenHash: true,
        messages: {
          // Newest first so `take` keeps the MOST RECENT MAX_LOADED_TURNS —
          // taking from an ascending order instead would keep the OLDEST
          // ones on a conversation that ever exceeds the cap, which is
          // backwards for a transcript a visitor is resuming. Reversed
          // below to restore chronological (oldest-first) display order.
          orderBy: { createdAt: 'desc' },
          take: MAX_LOADED_TURNS,
          select: { role: true, content: true, blocks: true, attachments: true, model: true, createdAt: true },
        },
      },
    });
    if (!conversation) return [];
    if (!isConversationAuthorized(conversation, viewerUserId, accessToken)) return [];
    return await Promise.all(
      conversation.messages.reverse().map(async (m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
        blocks: Array.isArray(m.blocks) ? (m.blocks as unknown as AssistantChatCard[]) : undefined,
        /*
         * `url` on the stored row is the opaque internal storage path
         * (supabase://... or file://...), never renderable in a browser —
         * see attachment-storage.ts. The signed URL minted at upload time
         * is long expired by the time a transcript is reloaded, so every
         * read mints a fresh one here rather than persisting one that
         * would silently go stale.
         */
        attachments: Array.isArray(m.attachments)
          ? await Promise.all(
              (m.attachments as unknown as StoredAttachment[]).map(async (a) => {
                // consentId / storageDeleted / consentWithdrawn are internal
                // cleanup bookkeeping (see StoredAttachment's doc comment) —
                // destructured out rather than spread, so none of them can
                // reach the browser by a future field added to `a`.
                const { consentId: _consentId, storageDeleted: _storageDeleted, consentWithdrawn: _consentWithdrawn, ...rest } = a;
                // A 'deleting' row keeps its real `url` server-side so a
                // retry can resume — but the browser must never see it
                // re-appear mid-cleanup, so it gets the exact same
                // no-preview treatment as 'unavailable'.
                const stillVisible = a.status !== 'unavailable' && a.status !== 'deleting';
                return {
                  ...rest,
                  url: stillVisible && a.url ? ((await signAttachmentUrl(a.url)) ?? undefined) : undefined,
                };
              }),
            )
          : undefined,
        model: m.model ?? undefined,
        createdAt: m.createdAt.toISOString(),
      })),
    ) as StoredTurn[];
  } catch (err) {
    console.error(JSON.stringify({ event: 'assistant.conversation.load_failed', error: err instanceof Error ? err.message : 'unknown' }));
    return [];
  }
}

export type EstablishResult =
  | { ok: true; conversationId: string; /** Present only when this call minted the conversation: the caller MUST deliver it as the access cookie. */ newToken?: string }
  | { ok: false; reason: 'forbidden' | 'db_error' };

/**
 * Find the caller's conversation for `designId`, or create it. Called by the
 * chat and upload routes (never the client directly).
 *
 * - No row: create one and mint its capability (returned once, as `newToken`).
 * - Row the caller is authorised for: reuse it. A signed-in caller holding
 *   the anonymous capability links their account onto it (never the reverse).
 * - Row the caller is NOT authorised for: `forbidden` — a bare designId never
 *   lets a stranger write into, or attach photos to, someone's conversation.
 * - Pre-existing anonymous row with no stored hash: nobody holds a
 *   credential for it, so it is detached (re-keyed away from the shareable
 *   designId, data retained, unreachable by id) and a fresh conversation is
 *   started — the "degrade to a new conversation" path for old localStorage
 *   designIds. This reveals nothing: the caller gets an EMPTY conversation.
 */
export async function establishConversation(designId: string, userId: string | null, accessToken: string | null): Promise<EstablishResult> {
  try {
    const existing = await db.assistantConversation.findUnique({
      where: { designId },
      select: { id: true, userId: true, accessTokenHash: true },
    });
    if (existing) {
      if (isConversationAuthorized(existing, userId, accessToken)) {
        if (userId && !existing.userId) {
          await db.assistantConversation.update({ where: { id: existing.id }, data: { userId } });
        }
        return { ok: true, conversationId: existing.id };
      }
      if (existing.userId || existing.accessTokenHash) return { ok: false, reason: 'forbidden' };
      // Legacy credential-less anonymous row: detach, then start fresh below.
      await db.assistantConversation.updateMany({
        where: { id: existing.id, userId: null, accessTokenHash: null },
        data: { designId: `lg${existing.id.replace(/-/g, '').slice(0, 14)}` },
      });
    }
    const token = newAccessToken();
    try {
      const created = await db.assistantConversation.create({
        data: { designId, userId, accessTokenHash: hashAccessToken(token) },
        select: { id: true },
      });
      return { ok: true, conversationId: created.id, newToken: token };
    } catch (err) {
      // Lost a creation race on the unique designId: whoever won holds the
      // capability; we only get in if we hold it too.
      const winner = await db.assistantConversation.findUnique({
        where: { designId },
        select: { id: true, userId: true, accessTokenHash: true },
      });
      if (winner && isConversationAuthorized(winner, userId, accessToken)) return { ok: true, conversationId: winner.id };
      if (winner) return { ok: false, reason: 'forbidden' };
      throw err;
    }
  } catch (err) {
    console.error(JSON.stringify({ event: 'assistant.conversation.ensure_failed', error: err instanceof Error ? err.message : 'unknown' }));
    return { ok: false, reason: 'db_error' };
  }
}

interface AttachmentLocation {
  messageId: string;
  attachments: StoredAttachment[];
  index: number;
}

type AuthorizedLookup = { ok: true; locations: AttachmentLocation[] } | { ok: false; reason: 'not_found' | 'forbidden' | 'db_error' };

/**
 * Shared by claim/finalize below: find EVERY message holding `attachmentId`
 * inside `designId`'s conversation, enforcing the same ownership boundary as
 * loadTranscript.
 *
 * WHY EVERY MESSAGE, NOT THE FIRST ONE FOUND: an id is minted once per
 * upload, but nothing guarantees it is ever persisted exactly once — a
 * retried chat POST (a network hiccup resubmitting the identical attachment
 * ref) legitimately writes the same id into a second message row, and a
 * rejected forged ref (see chat/route.ts's provenance gate) can ALSO leave
 * an inert `status: 'failed'`, no-url row under an id the attacker
 * borrowed. An earlier version of this function returned only the first
 * match; found live, against this sandbox's own Postgres, to let a DELETE
 * call report `complete: true` after only clearing ONE of several rows
 * sharing the id — the real photo stayed fully intact, undeleted, with its
 * consent ungranted-but-never-withdrawn, in whichever row wasn't picked.
 * Operating on every location closes that: a photo is "deleted" only once
 * every row that ever claimed to hold it agrees.
 */
async function findOwnedAttachment(
  designId: string | undefined,
  attachmentId: string,
  viewerUserId: string | null,
  accessToken: string | null,
): Promise<AuthorizedLookup> {
  if (!designId || !isDesignId(designId)) return { ok: false, reason: 'not_found' };
  try {
    const conversation = await db.assistantConversation.findUnique({
      where: { designId },
      select: { userId: true, accessTokenHash: true, messages: { select: { id: true, attachments: true } } },
    });
    if (!conversation) return { ok: false, reason: 'not_found' };
    if (!isConversationAuthorized(conversation, viewerUserId, accessToken)) return { ok: false, reason: 'forbidden' };
    const locations: AttachmentLocation[] = [];
    for (const message of conversation.messages) {
      const attachments = Array.isArray(message.attachments) ? (message.attachments as unknown as StoredAttachment[]) : [];
      const index = attachments.findIndex((a) => a.id === attachmentId);
      if (index !== -1) locations.push({ messageId: message.id, attachments, index });
    }
    if (locations.length === 0) return { ok: false, reason: 'not_found' };
    return { ok: true, locations };
  } catch (err) {
    console.error(JSON.stringify({ event: 'assistant.conversation.find_attachment_failed', error: err instanceof Error ? err.message : 'unknown' }));
    return { ok: false, reason: 'db_error' };
  }
}

/**
 * Picks which of several same-id locations is "the real one" to read
 * url/consentId/flags from: the first that actually carries a url or
 * consentId, falling back to the first location of all if none do (every
 * occurrence is already inert — e.g. all of them are rejected-forged
 * echoes). Real occurrences of a legitimately-duplicated id should always
 * agree on url/consentId (they are echoes of the same upload), so "first
 * one with data" and "true state" coincide in practice.
 */
function representativeAttachment(locations: AttachmentLocation[]): StoredAttachment {
  const withData = locations.find((l) => {
    const a = l.attachments[l.index]!;
    return !!a.url || !!a.consentId;
  });
  return (withData ?? locations[0]!).attachments[(withData ?? locations[0]!).index]!;
}

/**
 * Compare-and-swap the whole `attachments` array on one message row. A
 * plain read-then-write here is exactly the bug this replaces: two
 * concurrent DELETE calls (or a retry racing the original request) could
 * both read the same array, each compute their own "next" version, and
 * whichever write lands last silently discards the other's progress. The
 * `WHERE ... AND attachments = $expected` clause makes Postgres the
 * arbiter — only the caller whose `expected` still matches the live row
 * wins; everyone else gets `affected !== 1` back and knows to re-read and
 * retry rather than having clobbered anything. Same raw-SQL-with-guarded-
 * WHERE technique as rate-limit-durable.ts's bucket consume, just without
 * needing a stored function for a one-column swap.
 */
async function casSwapAttachments(messageId: string, expected: StoredAttachment[], next: StoredAttachment[]): Promise<boolean> {
  const affected = await db.$executeRaw`
    UPDATE "ecowoods"."AssistantMessage"
    SET attachments = ${JSON.stringify(next)}::jsonb
    WHERE id = ${messageId}::uuid AND attachments = ${JSON.stringify(expected)}::jsonb
  `;
  return affected === 1;
}

const MAX_CAS_ATTEMPTS = 8;

export type ClaimAttachmentResult =
  | { ok: true; alreadyComplete: true }
  | { ok: true; alreadyComplete: false; storagePath?: string; consentId?: string; needsStorage: boolean; needsConsent: boolean }
  | { ok: false; reason: 'not_found' | 'forbidden' | 'db_error' };

/**
 * Step 1 of a DELETE request: find the attachment, authorize it, and mark
 * it `'deleting'` — KEEPING its `url`/`consentId` and any cleanup flags a
 * prior attempt already set, never wiping them up front. The caller (the
 * delete route) then performs whatever cleanup `needsStorage`/`needsConsent`
 * says is still outstanding and calls `finalizeAttachmentDeletion` with the
 * real outcome. Calling this again on a row already `'deleting'` is exactly
 * how a retry resumes: it returns the SAME unfinished legs, not a fresh
 * claim that would re-attempt work already done.
 */
export async function claimAttachmentForDeletion(
  designId: string | undefined,
  attachmentId: string,
  viewerUserId: string | null,
  accessToken: string | null,
): Promise<ClaimAttachmentResult> {
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
    const found = await findOwnedAttachment(designId, attachmentId, viewerUserId, accessToken);
    if (!found.ok) return found;

    if (found.locations.every((l) => l.attachments[l.index]!.status === 'unavailable')) {
      return { ok: true, alreadyComplete: true };
    }

    const current = representativeAttachment(found.locations);
    const needsStorage = !current.storageDeleted && !!current.url;
    const needsConsent = !current.consentWithdrawn && !!current.consentId;

    // Claim every location that isn't already 'deleting' or 'unavailable' —
    // an inert duplicate (e.g. a rejected forged echo, no url/consentId of
    // its own) still gets marked 'deleting' here so it converges to
    // 'unavailable' alongside the real one, rather than sitting forever in
    // whatever status it had when the forged request was rejected.
    let raced = false;
    for (const loc of found.locations) {
      const row = loc.attachments[loc.index]!;
      if (row.status === 'unavailable' || row.status === 'deleting') continue;
      const claimed: StoredAttachment = {
        id: row.id,
        kind: row.kind,
        status: 'deleting',
        url: row.url,
        consentId: row.consentId,
        storageDeleted: row.storageDeleted ?? false,
        consentWithdrawn: row.consentWithdrawn ?? false,
      };
      const next = [...loc.attachments];
      next[loc.index] = claimed;
      const swapped = await casSwapAttachments(loc.messageId, loc.attachments, next).catch((err) => {
        console.error(JSON.stringify({ event: 'assistant.conversation.claim_attachment_failed', error: err instanceof Error ? err.message : 'unknown' }));
        return 'error' as const;
      });
      if (swapped === 'error') return { ok: false, reason: 'db_error' };
      if (!swapped) {
        raced = true;
        break; // someone else changed this row between our read and our swap — re-read everything and retry
      }
    }
    if (raced) continue;
    return { ok: true, alreadyComplete: false, storagePath: current.url, consentId: current.consentId, needsStorage, needsConsent };
  }
  return { ok: false, reason: 'db_error' };
}

export type FinalizeAttachmentResult = { ok: true; complete: boolean } | { ok: false; reason: 'not_found' | 'forbidden' | 'db_error' };

/**
 * Step 2: record what the route's cleanup calls actually accomplished.
 * Only flips to `'unavailable'` (and only THEN wipes `url`/`consentId`) once
 * storage deletion succeeded AND either consent was withdrawn or there was
 * never a consent grant to withdraw (a legacy attachment persisted before
 * this association existed — see chat/route.ts). Otherwise the row stays
 * `'deleting'` with the real per-leg outcome recorded, so the next DELETE
 * call on this id retries only the leg that actually failed.
 */
export async function finalizeAttachmentDeletion(
  designId: string | undefined,
  attachmentId: string,
  viewerUserId: string | null,
  accessToken: string | null,
  outcome: { storageDeleted: boolean; consentWithdrawn: boolean },
): Promise<FinalizeAttachmentResult> {
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
    const found = await findOwnedAttachment(designId, attachmentId, viewerUserId, accessToken);
    if (!found.ok) return found;

    if (found.locations.every((l) => l.attachments[l.index]!.status === 'unavailable')) {
      return { ok: true, complete: true }; // a concurrent finalize already won everywhere
    }

    // `complete` is computed from the REPRESENTATIVE row's real url/consentId
    // — an inert duplicate (no url/consentId of its own) never has an
    // outstanding leg to block completion on. Applied uniformly to every
    // non-'unavailable' location below, so a photo is only ever reported
    // gone once EVERY row that references it agrees.
    const representative = representativeAttachment(found.locations);
    const storageDeleted = outcome.storageDeleted || !!representative.storageDeleted;
    const consentWithdrawn = outcome.consentWithdrawn || !!representative.consentWithdrawn;
    const complete = storageDeleted && (consentWithdrawn || !representative.consentId);

    let raced = false;
    for (const loc of found.locations) {
      const row = loc.attachments[loc.index]!;
      if (row.status === 'unavailable') continue;
      const rowStorageDeleted = outcome.storageDeleted || !!row.storageDeleted;
      const rowConsentWithdrawn = outcome.consentWithdrawn || !!row.consentWithdrawn;
      const next = [...loc.attachments];
      next[loc.index] = complete
        ? { id: row.id, kind: row.kind, status: 'unavailable' }
        : { id: row.id, kind: row.kind, status: 'deleting', url: row.url, consentId: row.consentId, storageDeleted: rowStorageDeleted, consentWithdrawn: rowConsentWithdrawn };
      const swapped = await casSwapAttachments(loc.messageId, loc.attachments, next).catch((err) => {
        console.error(JSON.stringify({ event: 'assistant.conversation.finalize_attachment_failed', error: err instanceof Error ? err.message : 'unknown' }));
        return 'error' as const;
      });
      if (swapped === 'error') return { ok: false, reason: 'db_error' };
      if (!swapped) {
        raced = true;
        break;
      }
    }
    if (raced) continue;
    return { ok: true, complete };
  }
  return { ok: false, reason: 'db_error' };
}

export interface AppendTurnInput {
  /** From establishConversation — already authorised for this caller. Null → no-op. */
  conversationId: string | null;
  role: 'user' | 'assistant';
  content: string;
  blocks?: AssistantChatCard[];
  attachments?: StoredAttachment[];
  model?: string;
}

/** Best-effort append. Never throws — a failed write here must never surface as a failed chat turn. */
export async function appendTurn(input: AppendTurnInput): Promise<void> {
  const conversationId = input.conversationId;
  if (!conversationId) return;
  if (!input.content.trim() && !input.blocks?.length) return;
  try {
    await db.assistantMessage.create({
      data: {
        conversationId,
        role: input.role,
        content: input.content.slice(0, 20_000),
        blocks: input.blocks?.length ? (input.blocks as unknown as object) : undefined,
        attachments: input.attachments?.length ? (input.attachments as unknown as object) : undefined,
        model: input.model,
      },
    });
  } catch (err) {
    console.error(JSON.stringify({ event: 'assistant.conversation.append_failed', error: err instanceof Error ? err.message : 'unknown' }));
  }
}
