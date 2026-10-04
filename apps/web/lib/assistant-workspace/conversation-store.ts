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

export interface StoredAttachment {
  id: string;
  kind: 'room_photo' | 'floor_photo' | 'document';
  status: 'selected' | 'uploading' | 'uploaded' | 'analyzing' | 'analyzed' | 'failed' | 'unavailable';
  filename?: string;
  url?: string;
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
 * `designId` is deliberately NOT an access-control token elsewhere in this
 * codebase (see design-id.ts: "it is not a secret... a label that two
 * records can be joined on" — Floor Studio's own share links depend on it
 * being freely shareable). Reading a transcript by bare designId inherits
 * that same anonymous-first posture, which is correct for an anonymous
 * conversation. It stops being correct the moment a conversation is linked
 * to a real account: once `userId` is set, only a session authenticated as
 * that same user may read it — a designId that leaked into a shared link,
 * a referrer header, or a support screenshot must not become a way to read
 * a signed-in homeowner's private transcript. `viewerUserId` is the
 * caller's own session (`auth()`), never a second identity system.
 *
 * An unauthorized read returns the same empty result as "no conversation
 * exists" — never a distinct denial — so probing a design id can't even
 * learn whether it names someone else's linked conversation.
 */
export async function loadTranscript(designId: string | undefined, viewerUserId: string | null): Promise<StoredTurn[]> {
  if (!designId || !isDesignId(designId)) return [];
  try {
    const conversation = await db.assistantConversation.findUnique({
      where: { designId },
      select: {
        userId: true,
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
    if (conversation.userId && conversation.userId !== viewerUserId) return [];
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
              (m.attachments as unknown as StoredAttachment[]).map(async (a) => ({
                ...a,
                url: a.url ? ((await signAttachmentUrl(a.url)) ?? undefined) : undefined,
              })),
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

/**
 * Idempotent conversation lookup/creation. Called once per turn from the
 * chat route (never from the client directly) so a design's first message
 * mints the row and every later message reuses it — one conversation per
 * design, matching the one-workspace-per-design model this whole surface
 * already follows.
 */
async function ensureConversation(designId: string, userId: string | null): Promise<string | null> {
  try {
    const conversation = await db.assistantConversation.upsert({
      where: { designId },
      // A returning visitor who has since signed in backfills userId onto
      // the conversation their browser already holds a designId for —
      // never overwrites it back to null on an anonymous request.
      update: userId ? { userId } : {},
      create: { designId, userId },
      select: { id: true },
    });
    return conversation.id;
  } catch (err) {
    console.error(JSON.stringify({ event: 'assistant.conversation.ensure_failed', error: err instanceof Error ? err.message : 'unknown' }));
    return null;
  }
}

export interface AppendTurnInput {
  designId: string | undefined;
  userId: string | null;
  role: 'user' | 'assistant';
  content: string;
  blocks?: AssistantChatCard[];
  attachments?: StoredAttachment[];
  model?: string;
}

/** Best-effort append. Never throws — a failed write here must never surface as a failed chat turn. */
export async function appendTurn(input: AppendTurnInput): Promise<void> {
  if (!input.designId || !isDesignId(input.designId)) return;
  if (!input.content.trim() && !input.blocks?.length) return;
  const conversationId = await ensureConversation(input.designId, input.userId);
  if (!conversationId) return;
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
