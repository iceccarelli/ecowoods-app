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

/**
 * A reference to a photo already uploaded via POST /api/assistant/attachments
 * — never the bytes themselves, and never a public URL. `url` here is the
 * opaque internal storage path (`supabase://...` or `file://...`, see
 * attachment-storage.ts), resolved server-side in chat/route.ts; the client
 * never reads or displays it directly, only the short-lived signed preview
 * URL the upload/conversation-read routes hand back separately. At most 3
 * per turn — a homeowner showing a few rooms, not a bulk upload.
 */
const attachmentRefSchema = z
  .object({
    id: z.string().min(1).max(80),
    kind: z.enum(['room_photo', 'document']),
    url: z.string().min(1).max(300),
    contentType: z.string().min(1).max(100),
    filename: z.string().max(200).optional(),
  })
  .strict();

export type AttachmentRef = z.infer<typeof attachmentRefSchema>;

/** chatMessageSchema plus an optional attachment list — only meaningful on the newest user turn. */
const assistantChatMessageSchema = chatMessageSchema.extend({
  attachments: z.array(attachmentRefSchema).max(3).optional(),
});

export const assistantChatRequestSchema = z.object({
  messages: z
    .array(assistantChatMessageSchema)
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
 * The five original card types (unchanged, still the exact shape
 * chat-tools.test.ts and ConversationPane already depend on) plus the
 * structured answer-stack blocks below. This stays ONE discriminated union,
 * never a second response system: everything the workspace can show a
 * homeowner is a member of `AssistantChatCard['type']`, and every renderer
 * switches on that one field.
 *
 * The new block types exist because a real renovation answer is not one
 * paragraph plus at most two generic cards (the `.slice(0, 2)` this
 * replaced) — it is a small, intent-driven stack: a direct answer, the
 * project facts that back it, a cost or scenario view when one applies,
 * the evidence behind it, what's still unknown, and one next action.
 * ConversationPane composes and caps that stack; this file only defines
 * what each block IS.
 *
 * Every block is either:
 *   - a deterministic server-side builder reading canonical data directly
 *     (project_snapshot from Project Decision State, cost ranges from
 *     bandForWork/estimateInstalledRangeCad), or
 *   - a typed tool the model calls with STRUCTURED arguments (decision
 *     summary text, sequence steps, a flagged risk) — the model supplies
 *     content, the application still owns the shape. There is no tool that
 *     lets the model hand back arbitrary card JSON.
 */
export type EvidenceStrength = 'strong' | 'moderate' | 'weak';
export type CostSource = 'published_band' | 'estimate' | 'unavailable';
export type NextActionKind =
  | 'measure'
  | 'estimate'
  | 'quote'
  | 'floor_studio'
  | 'quote_check'
  | 'document_upload'
  | 'external_trade_followup';
/** Mirrors ProviderStatus but scoped to a single evidence/data block's own availability, not a whole tool call. */
export type BlockAvailability = 'ok' | 'pending_key' | 'unavailable';

export interface EcowoodsBandCard {
  type: 'ecowoods_band';
  title: string;
  body: string;
  href?: string;
  /** Structured cost-range fields alongside the original prose `body` — additive, never replacing it. */
  minCad?: number;
  maxCad?: number;
  currency?: 'CAD' | 'USD';
  source?: CostSource;
  scope?: string;
}

export interface PendingProviderCard {
  type: 'pending_provider';
  title: string;
  body: string;
  href?: string;
}

export interface SiteLinkCard {
  type: 'site_link';
  title: string;
  body: string;
  href?: string;
}

export interface ConversionProposedCard {
  type: 'conversion_proposed';
  title: string;
  body: string;
  href?: string;
}

export interface RenovationAnalysisOfferCard {
  type: 'renovation_analysis_offer';
  title: string;
  body: string;
  href?: string;
  /** The exact credit cost, never omitted so the UI never has to guess a price. */
  creditsCost?: number;
}

/** "Here's what I think is happening, and what to do first" — one per turn, at most. */
export interface DecisionSummaryBlock {
  type: 'decision_summary';
  title: string;
  situation: string;
  whatMatters: string[];
  firstStep: string;
}

/** Project Decision State, rendered as a fact block instead of left implicit — built server-side, never by the model. */
export interface ProjectSnapshotBlock {
  type: 'project_snapshot';
  title: string;
  objective?: string;
  sellHorizon?: string;
  squareFeet?: number;
  rooms?: string[];
  stairs?: boolean;
  selectedServices?: string[];
  targetFloor?: string;
  designId?: string;
}

/** A comparison of named options — e.g. refinish vs. replace — never the same fact repeated as prose + card. */
export interface ScenarioComparisonBlock {
  type: 'scenario_comparison';
  title: string;
  scenarios: {
    label: string;
    minCad?: number;
    maxCad?: number;
    currency?: 'CAD' | 'USD';
    assumptions: string[];
  }[];
}

/** A cited source — guide, paper, Framework criterion or case study — never a bare claim with no path. */
export interface EvidenceBlock {
  type: 'evidence';
  title: string;
  sourceType: 'guide' | 'paper' | 'framework' | 'case_study' | 'review';
  href?: string;
  whyItMatters: string;
  strength: EvidenceStrength;
}

/** A named unknown or risk, and what would resolve it — "inspection needed" is a valid, complete answer. */
export interface RiskBlock {
  type: 'risk';
  title: string;
  issue: string;
  impact: string;
  unknown?: string;
  resolvedBy?: string;
}

/** Ordered work with a reason per step — whole-home sequencing, not just floor scope. */
export interface SequenceBlock {
  type: 'sequence';
  title: string;
  steps: { label: string; rationale?: string }[];
}

/** Property facts the workspace was actually given/sourced — never a fabricated AVM. Absence is a valid state. */
export interface PropertyContextBlock {
  type: 'property_context';
  title: string;
  status: BlockAvailability;
  source?: string;
  freshness?: string;
  confidence?: string;
  body: string;
}

/** Market cost context for a non-floor trade — status-first, so "no licensed source yet" reads as structured, not as a dead end. */
export interface MarketContextBlock {
  type: 'market_context';
  title: string;
  status: BlockAvailability;
  source?: string;
  geography?: string;
  asOf?: string;
  body: string;
}

/** One concrete next move, tied to a real Ecowoods destination — never a fake booking confirmation. */
export interface NextActionBlock {
  type: 'next_action';
  title: string;
  action: NextActionKind;
  body: string;
  href?: string;
}

/** A pointer to a REAL saved RenovationAnalysis row — the paid artifact, rendered as itself, never re-described in prose. */
export interface AnalysisResultBlock {
  type: 'analysis_result';
  title: string;
  analysisId: string;
  href: string;
  body: string;
}

export type AssistantChatCard =
  | EcowoodsBandCard
  | PendingProviderCard
  | SiteLinkCard
  | ConversionProposedCard
  | RenovationAnalysisOfferCard
  | DecisionSummaryBlock
  | ProjectSnapshotBlock
  | ScenarioComparisonBlock
  | EvidenceBlock
  | RiskBlock
  | SequenceBlock
  | PropertyContextBlock
  | MarketContextBlock
  | NextActionBlock
  | AnalysisResultBlock;

/**
 * A one-line fallback string for any card, used only when the model
 * produced no reply text of its own (route.ts) — never rendered instead of
 * the card itself. Every block type gets a sentence here; the switch is
 * exhaustive so a new block type is a compile error until it's added.
 */
export function cardFallbackText(card: AssistantChatCard): string {
  switch (card.type) {
    case 'ecowoods_band':
    case 'pending_provider':
    case 'site_link':
    case 'conversion_proposed':
    case 'renovation_analysis_offer':
      return card.body;
    case 'decision_summary':
      return card.situation;
    case 'project_snapshot':
      return card.title;
    case 'scenario_comparison':
      return card.title;
    case 'evidence':
      return card.whyItMatters;
    case 'risk':
      return card.issue;
    case 'sequence':
      return card.title;
    case 'property_context':
    case 'market_context':
      return card.body;
    case 'next_action':
      return card.body;
    case 'analysis_result':
      return card.body;
  }
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
