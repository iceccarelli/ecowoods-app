import { streamText, tool, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { db } from '@/lib/db';
import { sendAdminNewQuoteEmail, sendAppointmentConfirmationEmail } from '@/lib/email';
import {
  computeAvailability, isBookableSlot, localDateKey,
  SLOT_DURATION_MINUTES, BUSINESS_TIMEZONE,
} from '@/lib/booking/availability';
import {
  RENOGUIDE_SYSTEM_PROMPT,
  estimateInstalledRangeCad,
  FINISH_OPTIONS,
  PATTERN_OPTIONS,
} from '@ecowoods/shared/ai';

export const runtime = 'nodejs';
export const maxDuration = 30;

// zod enums need a non-empty tuple; derive them from the shared catalogue so
// adding a finish in one place makes it instantly callable by the agent.
const FINISH_IDS = FINISH_OPTIONS.map((f) => f.id) as [string, ...string[]];
const PATTERN_IDS = PATTERN_OPTIONS.map((p) => p.id) as [string, ...string[]];

const HITS = new Map<string, { n: number; t: number }>();
function limited(ip: string) {
  const now = Date.now(), w = 60_000, max = 20;
  // HITS previously grew without bound on a warm lambda — one entry per IP, forever.
  // Sweep expired buckets whenever the map gets large enough to be worth it.
  if (HITS.size > 5_000) {
    for (const [k, v] of HITS) if (now - v.t > w) HITS.delete(k);
  }
  const e = HITS.get(ip);
  if (!e || now - e.t > w) { HITS.set(ip, { n: 1, t: now }); return false; }
  e.n += 1; return e.n > max;
}

function whenLabel(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: BUSINESS_TIMEZONE,
  }).format(d);
}

async function liveCountsForDay(dayKey: string) {
  const rows = await db.appointment.findMany({
    where: {
      status: 'SCHEDULED',
      startsAt: { gte: new Date(`${dayKey}T00:00:00Z`), lte: new Date(`${dayKey}T23:59:59Z`) },
    },
    select: { startsAt: true },
  });
  const counts = new Map<string, number>();
  for (const r of rows) {
    const iso = r.startsAt.toISOString();
    counts.set(iso, (counts.get(iso) ?? 0) + 1);
  }
  return counts;
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
    stopWhen: stepCountIs(8),
    tools: {
      get_company_context: tool({
        description: 'Get real Ecowoods contact facts (phone, email) before sharing them.',
        inputSchema: z.object({}),
        execute: async () => {
          const s = await db.settings.findFirst().catch(() => null);
          return { company: 'Ecowoods', phone: '(647) 244-5156', email: s?.companyEmail ?? 'services@ecowoods.ca', note: 'Toronto / GTA hardwood flooring. Est. 1998. Manufacturer finish and material warranties passed through in writing.' };
        },
      }),

      estimate_project: tool({
        description:
          'Rough installed cost RANGE in CAD. An estimate that needs an in-home measure to finalize. ' +
          'Accepts the optional finish and pattern the homeowner picked in the on-site floor configurator — ' +
          'pass them through verbatim so the number you quote matches the number they just saw on screen.',
        inputSchema: z.object({
          species: z.string(),
          squareFeet: z.number().positive(),
          finish: z.enum(FINISH_IDS).optional(),
          pattern: z.enum(PATTERN_IDS).optional(),
        }),
        execute: async ({ species, squareFeet, finish, pattern }) => {
          // Same function the configurator calls in the browser. Single source of truth.
          const r = estimateInstalledRangeCad({ species, squareFeet, finish, pattern });
          return {
            species: r.species,
            squareFeet: r.squareFeet,
            finish: r.finish,
            pattern: r.pattern,
            estimatedLowCad: r.estimatedLowCad,
            estimatedHighCad: r.estimatedHighCad,
            perSqftCad: r.perSqftCad,
            ...(r.speciesFallback
              ? { note: `We do not have a rate on file for "${species}". This range is for red oak — say so plainly and offer to have a specialist price the species they asked about.` }
              : {}),
            disclaimer: r.disclaimer,
          };
        },
      }),

      get_availability: tool({
        description: 'List the next free in-home measure slots (Toronto time). Call this BEFORE offering a time, so you only ever offer real openings.',
        inputSchema: z.object({}),
        execute: async () => {
          try {
            const now = new Date();
            const rows = await db.appointment.findMany({
              where: { status: 'SCHEDULED', startsAt: { gte: now } },
              select: { startsAt: true },
            });
            const bookingCounts = new Map<string, number>();
            for (const r of rows) {
              const iso = r.startsAt.toISOString();
              bookingCounts.set(iso, (bookingCounts.get(iso) ?? 0) + 1);
            }
            const { days } = computeAvailability({ now, bookingCounts }, localDateKey(now));
            const slots: { startsAt: string; label: string }[] = [];
            for (const d of days) {
              for (const s of d.slots) {
                if (s.remaining > 0) { slots.push({ startsAt: s.start, label: whenLabel(new Date(s.start)) }); }
                if (slots.length >= 6) break;
              }
              if (slots.length >= 6) break;
            }
            return slots.length
              ? { timezone: BUSINESS_TIMEZONE, slots, note: 'Offer 2-3 of these exact times. Pass the startsAt value verbatim to book_measure.' }
              : { timezone: BUSINESS_TIMEZONE, slots: [], note: 'No openings in range — ask them to call (647) 244-5156 to book.' };
          } catch {
            return { slots: [], note: 'Calendar unavailable — ask them to call (647) 244-5156 to book.' };
          }
        },
      }),

      book_measure: tool({
        description: 'Book a free in-home measure. Only call AFTER you have name, email, phone, and a startsAt the customer chose from get_availability.',
        inputSchema: z.object({
          name: z.string().min(2), email: z.string().email(), phone: z.string().min(7),
          startsAt: z.string().describe('Exact ISO timestamp from get_availability'),
          service: z.string().optional(), species: z.string().optional(),
          squareFeet: z.number().positive().optional(), postal: z.string().optional(), notes: z.string().optional(),
        }),
        execute: async (b) => {
          try {
            const startsAt = new Date(b.startsAt);
            if (Number.isNaN(startsAt.getTime())) return { ok: false, message: 'Invalid time — call get_availability again and offer a listed slot.' };
            const counts = await liveCountsForDay(localDateKey(startsAt));
            if (!isBookableSlot(b.startsAt, { now: new Date(), bookingCounts: counts })) {
              return { ok: false, message: 'That slot was just taken — call get_availability again and offer another time.' };
            }
            const service = b.service ?? 'new-install';
            const { quote, appt } = await db.$transaction(async (tx) => {
              const quote = await tx.quoteRequest.create({ data: {
                name: b.name, email: b.email, phone: b.phone, city: b.postal ?? null,
                service, squareFeet: b.squareFeet ?? null,
                notes: `[booked via RenoGuide chat]${b.species ? ' species: ' + b.species + '.' : ''}${b.notes ? ' ' + b.notes : ''}`.trim(),
              }});
              const appt = await tx.appointment.create({ data: {
                quoteRequestId: quote.id, startsAt, durationMinutes: SLOT_DURATION_MINUTES,
                customerName: b.name, customerEmail: b.email, customerPhone: b.phone, notes: b.notes ?? null,
              }});
              return { quote, appt };
            });
            const label = whenLabel(startsAt);
            sendAppointmentConfirmationEmail({ to: b.email, name: b.name, whenLabel: label, durationMinutes: SLOT_DURATION_MINUTES, service }).catch((e) => console.error('[chat] confirm email failed:', e));
            sendAdminNewQuoteEmail({ quoteId: quote.id, name: b.name, email: b.email, phone: b.phone, city: b.postal, service, squareFeet: b.squareFeet, notes: `In-home measure booked for ${label}.${b.notes ? ' ' + b.notes : ''}` }).catch((e) => console.error('[chat] admin email failed:', e));
            console.log(JSON.stringify({ event: 'measure.booked', source: 'chat', quoteId: quote.id, apptId: appt.id, startsAt: startsAt.toISOString() }));
            return { ok: true, appointmentId: appt.id, whenLabel: label, message: `Booked for ${label}. A confirmation email is on its way.` };
          } catch (err) {
            console.error(JSON.stringify({ event: 'measure.book_failed', source: 'chat', error: err instanceof Error ? err.message : 'unknown' }));
            return { ok: false, message: 'Could not confirm that — ask them to call (647) 244-5156 and we will book it.' };
          }
        },
      }),

      create_quote_request: tool({
        description: 'Persist a quote request when the homeowner is NOT ready to book a time but shares name, email, phone, and postal/city.',
        inputSchema: z.object({
          name: z.string().min(2), email: z.string().email(), phone: z.string().min(7), postal: z.string().min(3),
          service: z.string().optional(), species: z.string().optional(), squareFeet: z.number().positive().optional(),
          timeline: z.string().optional(), notes: z.string().optional(),
        }),
        execute: async (lead) => {
          const adminNotify = (quoteId: string) =>
            sendAdminNewQuoteEmail({
              quoteId, name: lead.name, email: lead.email, phone: lead.phone, city: lead.postal,
              service: lead.service ?? lead.species, squareFeet: lead.squareFeet,
              notes: `[via RenoGuide chat] ${lead.notes ?? ''}`.trim(),
            }).catch((e) => console.error('[chat] admin email failed:', e));
          try {
            const q = await db.quoteRequest.create({ data: {
              name: lead.name, email: lead.email, phone: lead.phone, city: lead.postal,
              service: lead.service ?? lead.species ?? null, squareFeet: lead.squareFeet ?? null,
              timeline: lead.timeline ?? null, notes: `[via RenoGuide chat] ${lead.notes ?? ''}`.trim(),
            }});
            adminNotify(q.id);
            console.log(JSON.stringify({ event: 'lead.captured', source: 'chat', leadId: q.id }));
            return { ok: true, quoteId: q.id, message: 'Saved. A specialist will call within 1 business day.' };
          } catch (err) {
            // DB hiccup must NOT lose the lead — notify admin anyway with the raw details.
            adminNotify('chat-fallback');
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
        controller.enqueue(encoder.encode('

(Sorry — something interrupted that. Please try again or call (647) 244-5156.)'));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache, no-transform' } });
}
