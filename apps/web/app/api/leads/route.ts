import { NextResponse } from 'next/server';
import { leadSchema } from '@ecowoods/shared/schemas';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { sendAdminNewQuoteEmail } from '@/lib/email';

/**
 * POST /api/leads — THE LEAD CAPTURE ENDPOINT
 *
 * Upgraded to persist to Prisma DB (QuoteRequest table).
 * Maintains backward compatibility with the existing client (submitLead).
 * Also notifies admin via email.
 *
 * Design principle: A LEAD IS NEVER SILENTLY LOST.
 * - Validate against the SAME shared schema the client uses (defense in depth).
 * - Capture the lead durably (structured log) BEFORE attempting any notification.
 * - A downstream notification failure still returns success to the customer and
 *   leaves a recoverable record in the logs — we never trade a captured lead for
 *   a flaky email send.
 *
 * Response shape matches exactly what submitLead expects:
 *   { success, leadId, message, ecoPointsEarned }
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function generateLeadId(): string {
  // URL-safe, sortable-ish, no external dep. Format: lead_<base36 time>_<rand>
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `lead_${time}_${rand}`;
}

/**
 * Persist a lead durably.
 *
 * LAUNCH VERSION: structured stdout log. On Vercel these are captured in the
 * deployment's runtime logs and are queryable/exportable — so no lead is lost
 * even before you wire a permanent destination.
 *
 * TO ACTIVATE A PERMANENT DESTINATION (pick one, one-line change):
 *   • Email:   add RESEND_API_KEY, then send in `notifyLead` below.
 *   • Webhook: add LEADS_WEBHOOK_URL (n8n / Zapier / CRM), POST the lead.
 *   • DB:      add a hosted Postgres (Neon/Vercel Postgres) connection string,
 *              insert here. (Your local Docker :5432 is NOT reachable from a
 *              Vercel deployment — use a hosted instance.)
 */
async function persistLead(lead: Record<string, unknown>, leadId: string): Promise<void> {
  // Durable structured record — appears in Vercel runtime logs.
  console.log(
    JSON.stringify({
      event: 'lead.captured',
      leadId,
      receivedAt: new Date().toISOString(),
      lead,
    }),
  );
}

/**
 * Best-effort notification. Activates automatically if an env destination is set.
 * Failures here are logged but DO NOT fail the request — the lead is already captured.
 */
async function notifyLead(lead: Record<string, unknown>, leadId: string): Promise<void> {
  const webhookUrl = process.env.LEADS_WEBHOOK_URL;
  if (!webhookUrl) return; // No destination configured yet — capture-only mode.

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, ...lead }),
    });
  } catch (err) {
    // Non-fatal: the lead is already durably captured in persistLead().
    console.error(
      JSON.stringify({
        event: 'lead.notify_failed',
        leadId,
        error: err instanceof Error ? err.message : 'unknown',
      }),
    );
  }
}

export async function POST(request: Request) {
  // 1. Parse body defensively.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid request body.' },
      { status: 400 },
    );
  }

  // 2. Validate against the SHARED schema — identical contract to the client.
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !(key in fieldErrors)) {
        fieldErrors[key] = issue.message;
      }
    }
    return NextResponse.json(
      { success: false, message: 'Please check the highlighted fields.', fieldErrors },
      { status: 400 },
    );
  }

  const lead = parsed.data as Record<string, unknown>;
  const leadId = generateLeadId();

  // 3. Capture durably FIRST — structured log + persist to DB.
  try {
    await persistLead(lead, leadId);

    // Persist to Prisma DB (primary storage)
    const session = await auth();
    const quote = await db.quoteRequest.create({
      data: {
        name: String(lead.name ?? ''),
        email: String(lead.email ?? ''),
        phone: lead.phone ? String(lead.phone) : null,
        city: lead.postal ? String(lead.postal) : null,
        service: lead.service ? String(lead.service) : null,
        squareFeet: lead.sqft ? Number(lead.sqft) : null,
        timeline: lead.timeline ? String(lead.timeline) : null,
        notes: lead.message ? String(lead.message) : null,
        userId: session?.user?.id ?? null,
      },
    });

    // Notify admin (non-blocking)
    sendAdminNewQuoteEmail({
      quoteId: quote.id,
      name: String(lead.name ?? ''),
      email: String(lead.email ?? ''),
      phone: lead.phone ? String(lead.phone) : undefined,
      service: lead.service ? String(lead.service) : undefined,
      squareFeet: lead.sqft ? Number(lead.sqft) : undefined,
      notes: lead.message ? String(lead.message) : undefined,
    }).catch(() => {});

  } catch (err) {
    console.error(
      JSON.stringify({
        event: 'lead.capture_failed',
        error: err instanceof Error ? err.message : 'unknown',
      }),
    );
    return NextResponse.json(
      {
        success: false,
        message:
          'We could not record your request. Please try again or call (416) 249-1276.',
      },
      { status: 500 },
    );
  }

  // 4. Notify via webhook best-effort (never blocks success).
  await notifyLead(lead, leadId);

  // 5. Acknowledge with the exact shape submitLead expects.
  return NextResponse.json(
    {
      success: true,
      leadId,
      message: 'Quote request received! A specialist will call you within 1 business day.',
      ecoPointsEarned: 750,
    },
    { status: 201 },
  );
}

/** Friendly guard so a stray GET doesn't look like a server error. */
export async function GET() {
  return NextResponse.json(
    { success: false, message: 'Use POST to submit a lead.' },
    { status: 405 },
  );
}
