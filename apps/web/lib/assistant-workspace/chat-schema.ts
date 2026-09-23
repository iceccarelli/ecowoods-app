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

export interface AssistantChatCard {
  type: 'ecowoods_band' | 'pending_provider' | 'site_link' | 'conversion_proposed';
  title: string;
  body: string;
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
