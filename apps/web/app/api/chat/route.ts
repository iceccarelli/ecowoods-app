import { streamText, convertToModelMessages, tool, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { db } from '@/lib/db';
import { RENOGUIDE_SYSTEM_PROMPT, FLOORING_RATES_CAD_PER_SQFT } from '@ecowoods/shared/ai';

export const runtime = 'nodejs';
export const maxDuration = 30;

// crude per-IP rate limit (in-memory; swap for Upstash when you scale past one region)
const HITS = new Map<string, { n: number; t: number }>();
function limited(ip: string) {
  const now = Date.now(), w = 60_000, max = 20;
  const e = HITS.get(ip);
  if (!e || now - e.t > w) { HITS.set(ip, { n: 1, t: now }); return false; }
  e.n += 1; return e.n > max;
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (limited(ip)) return new Response(JSON.stringify({ error: 'Too many messages, give it a moment.' }), { status: 429 });
  if (!process.env.ANTHROPIC_API_KEY) return new Response(JSON.stringify({ error: 'Chat is not configured.' }), { status: 503 });

  let messages;
  try { ({ messages } = await req.json()); } catch { return new Response('Bad request', { status: 400 }); }

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'), // swap model id as you like
    system: RENOGUIDE_SYSTEM_PROMPT,
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(5), // allow tool -> follow-up answer
    tools: {
      get_company_context: tool({
        description: 'Get real EcoWoods contact facts (phone, email) before sharing them. Always call before quoting hours/phone.',
        inputSchema: z.object({}),
        execute: async () => {
          const s = await db.settings.findFirst().catch(() => null);
          return {
            company: 'EcoWoods',
            phone: '(416) 249-1276',
            email: s?.companyEmail ?? 'hello@ecowoods.ca',
            note: 'Toronto / GTA hardwood flooring. Est. 1998. Lifetime workmanship warranty.',
          };
        },
      }),
      estimate_project: tool({
        description: 'Rough installed cost RANGE in CAD for a hardwood project. This is an estimate that needs an in-home measure to finalize — say so when you present it.',
        inputSchema: z.object({
          species: z.string().describe('e.g. white oak, red oak, maple, walnut, hickory, engineered, or "refinishing"'),
          squareFeet: z.number().positive(),
        }),
        execute: async ({ species, squareFeet }) => {
          const key = species.toLowerCase().trim();
          const rate = FLOORING_RATES_CAD_PER_SQFT[key] ?? FLOORING_RATES_CAD_PER_SQFT['red oak'];
          return {
            species: key, squareFeet,
            estimatedLowCad: Math.round(rate.low * squareFeet),
            estimatedHighCad: Math.round(rate.high * squareFeet),
            perSqftCad: `$${rate.low}–$${rate.high}/sqft`,
            disclaimer: 'Rough range only. Final price requires a free in-home measure (subfloor, stairs, transitions, removal all affect it).',
          };
        },
      }),
      create_quote_request: tool({
        description: 'Persist a real quote request once the homeowner shares name, email, phone, and postal/city and wants a specialist to follow up.',
        inputSchema: z.object({
          name: z.string().min(2),
          email: z.string().email(),
          phone: z.string().min(7),
          postal: z.string().min(3),
          service: z.string().optional(),
          species: z.string().optional(),
          squareFeet: z.number().positive().optional(),
          timeline: z.string().optional(),
          notes: z.string().optional(),
        }),
        execute: async (lead) => {
          try {
            const q = await db.quoteRequest.create({
              data: {
                name: lead.name, email: lead.email, phone: lead.phone, city: lead.postal,
                service: lead.service ?? lead.species ?? null,
                squareFeet: lead.squareFeet ?? null,
                timeline: lead.timeline ?? null,
                notes: `[via RenoGuide chat] ${lead.notes ?? ''}`.trim(),
              },
            });
            console.log(JSON.stringify({ event: 'lead.captured', source: 'chat', leadId: q.id, lead }));
            return { ok: true, quoteId: q.id, message: 'Quote request saved. A specialist will call within 1 business day.' };
          } catch (err) {
            // Never lose it: log durably, still tell the user a human will follow up.
            console.log(JSON.stringify({ event: 'lead.captured', source: 'chat', leadId: 'chat_fallback', lead, dbError: err instanceof Error ? err.message : 'unknown' }));
            return { ok: true, quoteId: null, message: 'Got it — a specialist will reach out within 1 business day.' };
          }
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
