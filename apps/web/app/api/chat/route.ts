import { streamText, tool, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { db } from '@/lib/db';
import { RENOGUIDE_SYSTEM_PROMPT, FLOORING_RATES_CAD_PER_SQFT } from '@ecowoods/shared/ai';

export const runtime = 'nodejs';
export const maxDuration = 30;

const HITS = new Map<string, { n: number; t: number }>();
function limited(ip: string) {
  const now = Date.now(), w = 60_000, max = 20;
  const e = HITS.get(ip);
  if (!e || now - e.t > w) { HITS.set(ip, { n: 1, t: now }); return false; }
  e.n += 1; return e.n > max;
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (limited(ip)) return new Response('Too many messages, give it a moment.', { status: 429 });
  if (!process.env.ANTHROPIC_API_KEY) return new Response('Chat is not configured.', { status: 503 });

  let messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  try { ({ messages } = await req.json()); } catch { return new Response('Bad request', { status: 400 }); }

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: RENOGUIDE_SYSTEM_PROMPT,
    messages,
    stopWhen: stepCountIs(5),
    tools: {
      get_company_context: tool({
        description: 'Get real EcoWoods contact facts (phone, email) before sharing them.',
        inputSchema: z.object({}),
        execute: async () => {
          const s = await db.settings.findFirst().catch(() => null);
          return { company: 'EcoWoods', phone: '(416) 249-1276', email: s?.companyEmail ?? 'hello@ecowoods.ca', note: 'Toronto / GTA hardwood flooring. Est. 1998. Lifetime workmanship warranty.' };
        },
      }),
      estimate_project: tool({
        description: 'Rough installed cost RANGE in CAD. An estimate that needs an in-home measure to finalize.',
        inputSchema: z.object({ species: z.string(), squareFeet: z.number().positive() }),
        execute: async ({ species, squareFeet }) => {
          const key = species.toLowerCase().trim();
          const rate = FLOORING_RATES_CAD_PER_SQFT[key] ?? FLOORING_RATES_CAD_PER_SQFT['red oak'];
          return { species: key, squareFeet, estimatedLowCad: Math.round(rate.low * squareFeet), estimatedHighCad: Math.round(rate.high * squareFeet), perSqftCad: `$${rate.low}-$${rate.high}/sqft`, disclaimer: 'Rough range only. Final price needs a free in-home measure.' };
        },
      }),
      create_quote_request: tool({
        description: 'Persist a real quote request once the homeowner shares name, email, phone, and postal/city.',
        inputSchema: z.object({
          name: z.string().min(2), email: z.string().email(), phone: z.string().min(7), postal: z.string().min(3),
          service: z.string().optional(), species: z.string().optional(), squareFeet: z.number().positive().optional(),
          timeline: z.string().optional(), notes: z.string().optional(),
        }),
        execute: async (lead) => {
          try {
            const q = await db.quoteRequest.create({ data: {
              name: lead.name, email: lead.email, phone: lead.phone, city: lead.postal,
              service: lead.service ?? lead.species ?? null, squareFeet: lead.squareFeet ?? null,
              timeline: lead.timeline ?? null, notes: `[via RenoGuide chat] ${lead.notes ?? ''}`.trim(),
            }});
            console.log(JSON.stringify({ event: 'lead.captured', source: 'chat', leadId: q.id }));
            return { ok: true, quoteId: q.id, message: 'Saved. A specialist will call within 1 business day.' };
          } catch (err) {
            console.log(JSON.stringify({ event: 'lead.captured', source: 'chat', leadId: 'fallback', lead, dbError: err instanceof Error ? err.message : 'unknown' }));
            return { ok: true, quoteId: null, message: 'Got it — a specialist will reach out within 1 business day.' };
          }
        },
      }),
    },
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of result.textStream) controller.enqueue(encoder.encode(chunk));
      } catch {
        controller.enqueue(encoder.encode('\n\n(Sorry — something interrupted that. Please try again or call (416) 249-1276.)'));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache, no-transform' } });
}
