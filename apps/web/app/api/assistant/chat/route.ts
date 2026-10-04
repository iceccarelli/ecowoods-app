/**
 * POST /api/assistant/chat — Ask Francisco workspace conversation.
 *
 * Separate from /api/chat (corner EcowoodsGuide). Reuses pricing
 * (estimateInstalledRangeCad + bandForWork), findOnSite, Zod body discipline,
 * origin + rate-limit — but NEVER writes Appointment / QuoteRequest rows.
 * Conversion is propose_conversion → ConversionPanel confirm → existing
 * /api/appointments|/api/leads.
 *
 * Streams the reply as NDJSON (one JSON object per line, `Content-Type:
 * application/x-ndjson`): a `{"type":"text","value":"..."}` line per text
 * delta as Francisco's reply is generated, then exactly one
 * `{"type":"done","reply","patch","cards","providers","model"}` line once
 * every tool call this turn has resolved — cards/patch/providers are only
 * final at that point, since a tool can still fire after text has already
 * started streaming in an earlier step. A mid-stream failure sends
 * `{"type":"error","message"}` instead of the `done` line. See
 * ConversationPane's `respond()` for the reader.
 */
import { NextResponse } from 'next/server';
import { streamText, tool, stepCountIs, type ModelMessage } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { FINISH_OPTIONS, PATTERN_OPTIONS } from '@ecowoods/shared/ai';
import { getClientIp, isTrustedBrowserOrigin } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit-durable';
import { auth } from '@/lib/auth';
import { appendTurn, type StoredAttachment } from '@/lib/assistant-workspace/conversation-store';
import { siteCapabilitiesBlock } from '@/lib/assistant-site';
import { ASK_FRANCISCO_SYSTEM_PROMPT } from '@/lib/assistant-workspace/system-prompt';
import { downloadAttachment } from '@/lib/assistant-workspace/attachment-storage';
import {
  assistantChatRequestSchema,
  cardFallbackText,
  CHAT_MAX_BODY_BYTES,
  type AssistantChatCard,
  type AssistantChatResponse,
  type AttachmentRef,
  type ProviderOutcome,
} from '@/lib/assistant-workspace/chat-schema';
import {
  buildProjectSnapshotBlock,
  catalogHintsBlock,
  executeAttachToProject,
  executeFindOnSite,
  executeFlagRisk,
  executeGetEcowoodsBand,
  executeGetHouseProfile,
  executeGetMarketCost,
  executeGetWantVsValue,
  executeProposeConversion,
  executeProposeDecisionSummary,
  executeProposeRenovationAnalysis,
  executeProposeSequence,
  executeRetrieveEvidence,
  executeSuggestNextAction,
  mergePatches,
  workspaceSnapshotBlock,
} from '@/lib/assistant-workspace/chat-tools';
import { loadCaseStudyEvidence } from '@/lib/assistant-workspace/value-scenario-evidence';
import type { WorkspacePatch } from '@/lib/assistant-workspace/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

const FINISH_IDS = FINISH_OPTIONS.map((f) => f.id) as [string, ...string[]];
const PATTERN_IDS = PATTERN_OPTIONS.map((p) => p.id) as [string, ...string[]];

/**
 * The one model this route calls. Named here rather than inlined twice
 * (once for `streamText`, once for the persisted turn's `model` field) so
 * the two can never drift — persisting a model id that isn't the one that
 * actually ran would be exactly the invented execution metadata this
 * surface must never write.
 */
const CHAT_MODEL_ID = 'claude-sonnet-4-6';

/**
 * 20 turns/minute/IP, refilled continuously (token bucket, not a fixed
 * window). Backed by Postgres (see rate-limit-durable.ts) rather than an
 * in-memory Map: this route runs up to 8 model tool-call steps per request,
 * so a flood spread across serverless instances — each with its own empty
 * Map — was effectively unthrottled before this.
 *
 * `failClosed: false` — this is a free route. If Postgres is briefly
 * unreachable, `enforceRateLimit` falls back to the existing in-memory
 * bucket (per-instance, not cross-instance, but still a real limit) rather
 * than letting every request through uncounted against a paid model.
 */
const CHAT_RATE_LIMIT = { windowMs: 60_000, maxRequests: 20 };

async function readBody(
  req: Request,
): Promise<{ ok: true; data: z.infer<typeof assistantChatRequestSchema> } | { ok: false; response: Response }> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > CHAT_MAX_BODY_BYTES) {
    return { ok: false, response: NextResponse.json({ error: 'Message too long.' }, { status: 413 }) };
  }
  let text: string;
  try {
    text = await req.text();
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'Bad request' }, { status: 400 }) };
  }
  if (text.length > CHAT_MAX_BODY_BYTES) {
    return { ok: false, response: NextResponse.json({ error: 'Message too long.' }, { status: 413 }) };
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'Bad request' }, { status: 400 }) };
  }
  const parsed = assistantChatRequestSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, response: NextResponse.json({ error: 'Bad request' }, { status: 400 }) };
  }
  return { ok: true, data: parsed.data };
}

function toModelMessages(
  messages: z.infer<typeof assistantChatRequestSchema>['messages'],
): ModelMessage[] {
  return messages
    .map((m): ModelMessage =>
      typeof m.content === 'string'
        ? { role: m.role, content: m.content }
        : { role: m.role, content: m.content.map((p) => ({ type: 'text' as const, text: p.text })) },
    )
    .filter((m) =>
      typeof m.content === 'string'
        ? m.content.trim().length > 0
        : m.content.some((p) => p.type === 'text' && p.text.trim().length > 0),
    );
}

export async function POST(req: Request) {
  if (!isTrustedBrowserOrigin(req)) {
    return NextResponse.json({ error: 'Origin not allowed.' }, { status: 403 });
  }
  const ip = getClientIp(req);
  const rateLimit = await enforceRateLimit({ routeKey: 'assistant-chat', identity: ip, config: CHAT_RATE_LIMIT });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many messages, give it a moment.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Chat is not configured.', code: 'pending_key' }, { status: 503 });
  }

  const body = await readBody(req);
  if (!body.ok) return body.response;

  const messages = toModelMessages(body.data.messages);
  if (messages.length === 0 || messages[messages.length - 1]!.role !== 'user') {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  // Reload-safe transcript (Gate 2, P0) — best-effort, never blocks or fails
  // the turn. designId is the same MEAS-01 key the workspace snapshot
  // already carries; userId is attached only when a real session exists.
  const designId = body.data.workspace?.designId;
  const session = await auth().catch(() => null);
  const userId = session?.user?.id ?? null;
  const lastUserRaw = body.data.messages[body.data.messages.length - 1]!;
  const lastUserText =
    typeof lastUserRaw.content === 'string'
      ? lastUserRaw.content
      : lastUserRaw.content.map((p) => p.text).join('\n');

  /*
   * Multimodal augmentation — a photo the homeowner just attached. Only the
   * NEWEST user turn may carry attachments (see attachmentRefSchema's
   * comment); downloaded once, here, so the per-attachment outcome below is
   * ground truth, not an assumption. An attachment the model never actually
   * received is named as unavailable in the prompt text, never silently
   * dropped — Francisco must never claim to have looked at a photo he did
   * not get. Documents (kind: 'document') are not sent to the model yet —
   * P0 scope is photos; see this PR's description for what's deferred.
   */
  const attachmentRefs: AttachmentRef[] = lastUserRaw.role === 'user' ? (lastUserRaw.attachments ?? []) : [];
  const attachmentOutcomes: { ref: AttachmentRef; delivered: boolean }[] = [];
  if (attachmentRefs.length > 0 && messages.length > 0) {
    const parts: Array<{ type: 'text'; text: string } | { type: 'image'; image: Buffer; mediaType: string }> = [];
    if (lastUserText.trim()) parts.push({ type: 'text', text: lastUserText });
    const unavailable: string[] = [];
    for (const ref of attachmentRefs) {
      if (ref.kind !== 'room_photo') continue;
      const downloaded = await downloadAttachment(ref.url).catch(() => null);
      if (downloaded) {
        parts.push({ type: 'image', image: downloaded.buffer, mediaType: downloaded.contentType });
        attachmentOutcomes.push({ ref, delivered: true });
      } else {
        unavailable.push(ref.filename ?? 'a photo');
        attachmentOutcomes.push({ ref, delivered: false });
      }
    }
    if (unavailable.length) {
      parts.push({
        type: 'text',
        text: `[${unavailable.join(', ')} did not come through — you do not have it. Say so plainly and ask the homeowner to try attaching it again. Do not describe or guess at its contents.]`,
      });
    }
    if (parts.length) messages[messages.length - 1] = { role: 'user', content: parts };
  }

  const persistedAttachments: StoredAttachment[] | undefined = attachmentOutcomes.length
    ? attachmentOutcomes.map(({ ref, delivered }) => ({
        id: ref.id,
        kind: ref.kind,
        status: delivered ? 'analyzed' : 'failed',
        filename: ref.filename,
        url: ref.url,
      }))
    : undefined;
  void appendTurn({ designId, userId, role: 'user', content: lastUserText, attachments: persistedAttachments });

  const patches: WorkspacePatch[] = [];
  const cards: AssistantChatCard[] = [];
  const providers: ProviderOutcome[] = [];

  // Same loader /assistant's Server Component already uses for value
  // scenarios (value-scenario-evidence.ts) — never a second evidence read
  // path. Evidence retrieval is supplementary: a filesystem hiccup here
  // must not break the conversation, so failure degrades to an empty pool.
  const caseStudyPool = await loadCaseStudyEvidence().catch(() => []);

  const system =
    ASK_FRANCISCO_SYSTEM_PROMPT +
    siteCapabilitiesBlock() +
    catalogHintsBlock() +
    workspaceSnapshotBlock(body.data.workspace as Record<string, unknown> | undefined);

  const encoder = new TextEncoder();
  const ndjson = (obj: unknown) => encoder.encode(`${JSON.stringify(obj)}\n`);

  try {
    const result = streamText({
      model: anthropic(CHAT_MODEL_ID),
      system,
      messages,
      stopWhen: stepCountIs(8),
      tools: {
        get_ecowoods_band: tool({
          description:
            'Published Ecowoods hardwood/stairs installed cost RANGE in CAD from bandForWork + estimateInstalledRangeCad. Never invent a number outside this tool.',
          inputSchema: z.object({
            species: z.string().max(60),
            squareFeet: z.number().positive().max(1_000_000),
            finish: z.enum(FINISH_IDS).optional(),
            pattern: z.enum(PATTERN_IDS).optional(),
            country: z.enum(['CA', 'US']).optional(),
          }),
          execute: async (input) => {
            const out = executeGetEcowoodsBand(input);
            cards.push(out.card);
            providers.push(out.provider);
            return out;
          },
        }),

        attach_to_project: tool({
          description:
            'Attach understood facts to Project Decision State using catalog ids only (productId, finishId, patternId, serviceSlugs, objective, sellHorizon, stairs, squareFeet).',
          inputSchema: z.object({
            objective: z.enum(['install', 'refinish', 'repair', 'not-sure']).optional(),
            sellHorizon: z.enum(['staying', 'selling-soon', 'not-sure']).optional(),
            stairs: z.boolean().optional(),
            productId: z.string().max(80).optional(),
            finishId: z.string().max(80).optional(),
            patternId: z.string().max(80).optional(),
            widthId: z.string().max(80).optional(),
            serviceSlugs: z.array(z.string().max(80)).max(8).optional(),
            squareFeet: z.number().positive().max(20_000).optional(),
            roomLabel: z.string().max(80).optional(),
            country: z.enum(['CA', 'US']).optional(),
            pendingQuestions: z.array(z.string().max(200)).max(10).optional(),
          }),
          execute: async (input) => {
            const out = executeAttachToProject(input);
            if (Object.keys(out.patch).length) patches.push(out.patch);
            providers.push(out.provider);
            return out;
          },
        }),

        find_on_site: tool({
          description:
            'Search this website for a real page (guide, service, pricing, Floor Studio, estimate). Returns paths from navigation only.',
          inputSchema: z.object({
            query: z.string().min(2).max(120),
          }),
          execute: async ({ query }) => {
            const out = executeFindOnSite(query);
            cards.push(...out.cards);
            providers.push(out.provider);
            return out;
          },
        }),

        get_house_profile: tool({
          description:
            'Fetch house/neighbourhood profile. Until licensed adapters exist this returns pending_key — never invent property attributes.',
          inputSchema: z.object({
            neighbourhood: z.string().max(120).optional(),
            addressHint: z.string().max(200).optional(),
          }),
          execute: async (input) => {
            const out = executeGetHouseProfile(input);
            cards.push(out.card);
            providers.push(out.provider);
            return out;
          },
        }),

        get_market_cost: tool({
          description:
            'Market cost for a renovation trade. Floors/stairs → use get_ecowoods_band. Other trades may return pending_key (no invented kitchen/roof quotes).',
          inputSchema: z.object({
            trade: z.string().min(2).max(80),
            neighbourhood: z.string().max(120).optional(),
          }),
          execute: async (input) => {
            const out = executeGetMarketCost(input);
            if (out.card) cards.push(out.card);
            providers.push(out.provider);
            return out;
          },
        }),

        get_want_vs_value: tool({
          description:
            'Want list vs evidenced value. May return pending_key; never invent AVMs or absolute house-worth claims.',
          inputSchema: z.object({
            wants: z.array(z.string().max(120)).max(12).optional(),
            sellHorizon: z.enum(['staying', 'selling-soon', 'not-sure']).optional(),
          }),
          execute: async (input) => {
            const out = executeGetWantVsValue(input);
            cards.push(out.card);
            providers.push(out.provider);
            return out;
          },
        }),

        propose_conversion: tool({
          description:
            'Propose measure | estimate | quote for Ecowoods-executable floor/stair work. Does NOT book — user confirms in the Next step panel.',
          inputSchema: z.object({
            action: z.enum(['measure', 'estimate', 'quote']),
            reason: z.string().max(200).optional(),
          }),
          execute: async (input) => {
            const out = executeProposeConversion(input);
            if (out.ok && Object.keys(out.patch).length) patches.push(out.patch);
            if (out.card) cards.push(out.card);
            providers.push(out.provider);
            return out;
          },
        }),

        propose_renovation_analysis: tool({
          description:
            'Offer the paid Renovation Decision Analysis (Renovation Credits) when there is enough project context to make it worth paying for — an objective plus a sell horizon, square footage, or a selected service. Never charges anything; only shows the offer card. Do not call this on the first turn or with only an objective set.',
          inputSchema: z.object({}),
          execute: async () => {
            const out = executeProposeRenovationAnalysis(body.data.workspace);
            if (out.card) cards.push(out.card);
            providers.push(out.provider);
            return out;
          },
        }),

        retrieve_evidence: tool({
          description:
            'Look up real Ecowoods evidence for a topic — guides, technical papers, Well-Installed Framework criteria, and case studies. Returns at most a few sourced results with a canonical path each. Use this before making a claim that a guide/paper/case study would materially strengthen (e.g. "cupping", "refinish vs replace", "herringbone pattern", "moisture"). Returns found: 0 when nothing matches — say plainly there is no sourced evidence rather than inventing one.',
          inputSchema: z.object({ topic: z.string().min(2).max(120) }),
          execute: async ({ topic }) => {
            const out = executeRetrieveEvidence(topic, caseStudyPool);
            cards.push(...out.cards);
            providers.push(out.provider);
            return out;
          },
        }),

        propose_decision_summary: tool({
          description:
            'State your read of the situation as a structured summary: the situation in one or two sentences, up to five short bullet points of what matters most, and the single first step. Call this once, after you have enough of the picture (objective plus at least one more fact) — never on the very first turn with nothing attached yet.',
          inputSchema: z.object({
            situation: z.string().min(10).max(400),
            whatMatters: z.array(z.string().min(3).max(160)).min(1).max(5),
            firstStep: z.string().min(5).max(200),
          }),
          execute: async (input) => {
            const out = executeProposeDecisionSummary(input);
            cards.push(out.card);
            providers.push(out.provider);
            return out;
          },
        }),

        propose_sequence: tool({
          description:
            'Lay out an ordered sequence of work with a one-line reason per step, for whole-home sequencing questions ("what should I do first"). Up to 6 steps. Use real trade/service names, never invented ones.',
          inputSchema: z.object({
            steps: z.array(z.object({ label: z.string().min(2).max(120), rationale: z.string().max(200).optional() })).min(2).max(6),
          }),
          execute: async (input) => {
            const out = executeProposeSequence(input);
            cards.push(out.card);
            providers.push(out.provider);
            return out;
          },
        }),

        flag_risk: tool({
          description:
            'Name one real risk or unknown that affects the decision — e.g. "subfloor condition not yet inspected", "sale timeline could compress the schedule". State the issue, its impact, what specifically is unknown, and what would resolve it (usually the free in-home measure). Do not invent a risk that is not actually implied by what the homeowner said.',
          inputSchema: z.object({
            issue: z.string().min(5).max(200),
            impact: z.string().min(5).max(200),
            unknown: z.string().max(200).optional(),
            resolvedBy: z.string().max(200).optional(),
          }),
          execute: async (input) => {
            const out = executeFlagRisk(input);
            cards.push(out.card);
            providers.push(out.provider);
            return out;
          },
        }),

        suggest_next_action: tool({
          description:
            'Point at ONE concrete next destination beyond propose_conversion\'s measure/estimate/quote — Floor Studio for visualization, Quote Check for reviewing a contractor quote, or "this is a job for another trade" for a non-floor scope. Does not book anything and does not touch Project Decision State; it only surfaces a destination card.',
          inputSchema: z.object({
            action: z.enum(['measure', 'estimate', 'quote', 'floor_studio', 'quote_check', 'document_upload', 'external_trade_followup']),
            body: z.string().min(5).max(200),
          }),
          execute: async (input) => {
            const out = executeSuggestNextAction(input);
            cards.push(out.card);
            providers.push(out.provider);
            return out;
          },
        }),
      },
    });

    let accumulated = '';
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const delta of result.textStream) {
            accumulated += delta;
            controller.enqueue(ndjson({ type: 'text', value: delta }));
          }
          // Draining textStream above guarantees every tool call this turn has
          // already run its `execute` — patches/cards/providers are complete.
          const mergedPatch = mergePatches(patches);

          const reply =
            accumulated.trim() ||
            (cards[0] && cardFallbackText(cards[0])) ||
            `I heard you — tell me the neighbourhood and what you want done on this house, or call ${BUSINESS_NAP.phoneDisplay}.`;

          // Deterministic, not model-dependent: whenever this turn's patch (or
          // the incoming snapshot) gives the project real shape, the fact
          // block leads the answer stack — never left to the model to
          // remember to call a tool for something the client already sent.
          const snapshotForBlock = {
            ...(body.data.workspace ?? {}),
            ...(mergedPatch as Record<string, unknown>),
          } as typeof body.data.workspace;
          const projectSnapshot = buildProjectSnapshotBlock(snapshotForBlock);
          if (projectSnapshot) cards.unshift(projectSnapshot);

          const response: AssistantChatResponse = {
            reply,
            patch: mergedPatch as Record<string, unknown>,
            cards,
            providers,
            model: true,
          };
          // Only attribute the reply to the model when its text is genuinely
          // model output. `reply` can fall back to a card's own fallback
          // text or a static canned line (see above) when the model
          // returned no text this turn — persisting CHAT_MODEL_ID against a
          // canned string would be exactly the invented execution metadata
          // this surface must never write.
          void appendTurn({
            designId,
            userId,
            role: 'assistant',
            content: reply,
            blocks: cards,
            model: accumulated.trim() ? CHAT_MODEL_ID : undefined,
          });
          controller.enqueue(ndjson({ type: 'done', ...response }));
        } catch (err) {
          console.error(
            JSON.stringify({
              event: 'assistant.chat.stream_failed',
              error: err instanceof Error ? err.message : 'unknown',
            }),
          );
          controller.enqueue(
            ndjson({
              type: 'error',
              message: `Something interrupted that. Try again or call ${BUSINESS_NAP.phoneDisplay}.`,
            }),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-store' },
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        event: 'assistant.chat.failed',
        error: err instanceof Error ? err.message : 'unknown',
      }),
    );
    return NextResponse.json(
      {
        error: `Something interrupted that. Try again or call ${BUSINESS_NAP.phoneDisplay}.`,
      },
      { status: 502 },
    );
  }
}
