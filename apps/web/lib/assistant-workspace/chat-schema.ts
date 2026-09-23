/**
 * Request/response shapes for POST /api/assistant/chat.
 *
 * Reuses chatMessageSchema / CHAT_MAX_* from @ecowoods/shared/schemas (same
 * attack-surface discipline as the corner /api/chat). Adds a workspace
 * snapshot so the model can see Project Decision State without inventing it.
 */
import { z } from 'zod';
import {
  chatMessageSchema,
  CHAT_MAX_BODY_BYTES,
  CHAT_MAX_MESSAGES,
} from '@ecowoods/shared/schemas';

export { CHAT_MAX_BODY_BYTES };

const floorPrefSchema = z
  .object({
    productId: z.string().max(80).optional(),
    finishId: z.string().max(80).optional(),
    patternId: z.string().max(80).optional(),
    widthId: z.string().max(80).optional(),
  })
  .strict();

const roomSchema = z
  .object({
    label: z.string().min(1).max(80),
    squareFeet: z.number().positive().max(20_000).optional(),
  })
  .strict();

const personalizationSchema = z
  .object({
    neighbourhood: z.string().max(80).optional(),
    floorCondition: z.string().max(200).optional(),
    otherTrades: z.record(z.string().max(40), z.enum(['mentioned', 'planned', 'in-progress', 'done'])).optional(),
  })
  .strict();

const actionMemorySchema = z
  .object({
    dismissed: z.array(z.string().max(120)).max(200).optional(),
    completed: z.array(z.string().max(120)).max(200).optional(),
  })
  .strict();

/** Client-sent snapshot of Project Decision State — data for the model, not a write. */
export const workspaceSnapshotSchema = z
  .object({
    designId: z.string().max(80).optional(),
    country: z.enum(['CA', 'US']).optional(),
    objective: z.enum(['install', 'refinish', 'repair', 'not-sure']).nullable().optional(),
    sellHorizon: z.enum(['staying', 'selling-soon', 'not-sure']).nullable().optional(),
    stairs: z.boolean().optional(),
    rooms: z.array(roomSchema).max(20).optional(),
    targetFloor: floorPrefSchema.optional(),
    selectedServiceSlugs: z.array(z.string().max(80)).max(12).optional(),
    nextAction: z.enum(['measure', 'estimate', 'quote']).nullable().optional(),
    personalization: personalizationSchema.optional(),
    actionMemory: actionMemorySchema.optional(),
  })
  .strict();

export const assistantChatRequestSchema = z.object({
  messages: z
    .array(chatMessageSchema)
    .min(1)
    .max(CHAT_MAX_MESSAGES)
    .refine((m) => m.length > 0 && m[m.length - 1]!.role === 'user', 'The last message must be from the user'),
  workspace: workspaceSnapshotSchema.optional(),
});

export type AssistantChatRequest = z.infer<typeof assistantChatRequestSchema>;
export type WorkspaceSnapshot = z.infer<typeof workspaceSnapshotSchema>;

/**
 * Structured provider status for honesty about missing licensed adapters.
 * Never invent live numbers when status is pending_key or unavailable.
 */
export type ProviderStatus = 'ok' | 'pending_key' | 'unavailable' | 'not_applicable';

export interface ProviderOutcome {
  name: string;
  status: ProviderStatus;
  note?: string;
}

/**
 * `analysis_available` — the one new type this pass adds a real capability
 * for: `analyze_renovation_priorities` (renovation-analysis.ts), a
 * deterministic, rule-based sequencing pass over Project Decision State.
 * Free every time it runs — see ASSISTANT_MONETIZATION_SPEC.md for why the
 * deeper paid version is architecture-only in this pass, not wired to a
 * real price yet.
 */
export type AssistantChatCardType =
  | 'ecowoods_band'
  | 'pending_provider'
  | 'site_link'
  | 'conversion_proposed'
  | 'analysis_available'
  | 'paid_analysis_proposed';

export interface AssistantChatCard {
  type: AssistantChatCardType;
  /**
   * Stable per action INSTANCE (e.g. `analysis:roof,kitchen,floor` or
   * `band:refinish`), not per render — see WorkspaceActionMemory. Used to
   * filter a dismissed card out of every later turn and to record
   * completion. Optional only for backward compatibility with any card a
   * future tool forgets to id; the server filters by id when present and
   * never resurfaces an unidentified card differently.
   */
  id?: string;
  title: string;
  body: string;
  /** Why THIS card, in terms of what the visitor actually said — never a generic marketing line (directive rule 19). */
  reason?: string;
  /** The homeowner's-goal CTA label ("Calculate my project"), not the implementation ("Add to project"). Falls back to a per-type default in the UI when absent. */
  cta?: string;
  href?: string;
}

export interface AssistantChatResponse {
  reply: string;
  /** Validated WorkspacePatch fields for the client to apply via applyPatch. */
  patch: Record<string, unknown>;
  cards: AssistantChatCard[];
  providers: ProviderOutcome[];
  /** True when the model path ran; false when keyword fallback was used. */
  model: boolean;
}
