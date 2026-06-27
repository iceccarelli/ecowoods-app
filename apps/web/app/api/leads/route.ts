import { NextResponse } from 'next/server';
import { leadSchema } from '@ecowoods/shared/schemas';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { sendAdminNewQuoteEmail } from '@/lib/email';

/**
 * POST /api/leads — THE conversion surface.
 *
 * INVARIANT: once a lead validates, it is captured. Period.
 * - Durable structured log happens FIRST and always (recoverable from Vercel logs).
 * - DB persistence is best-effort: a DB outage must NOT surface as a customer error.
 * - Admin email is best-effort.
 * We only ever return non-2xx for a genuinely malformed/invalid submission (400),
 * never because a downstream system (DB/email) hiccupped.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function generateLeadId(): string {
  return `lead_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
    return NextResponse.json(
      { success: false, message: 'Please check the highlighted fields.', fieldErrors },
      { status: 400 },
    );
  }

  const lead = parsed.data as Record<string, unknown>;
  const leadId = generateLeadId();

  // 1. DURABLE CAPTURE — guaranteed, synchronous, dependency-free. The lead now exists.
  console.log(JSON.stringify({ event: 'lead.captured', leadId, receivedAt: new Date().toISOString(), lead }));

  // 2. BEST-EFFORT DB persistence. Failure is logged, never fatal.
  let quoteId: string | null = null;
  try {
    const session = await auth().catch(() => null);
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
    quoteId = quote.id;
  } catch (err) {
    console.error(JSON.stringify({
      event: 'lead.db_persist_failed', leadId,
      error: err instanceof Error ? err.message : 'unknown',
      hint: 'Lead is safe in lead.captured log above. Check DATABASE_URL in this environment.',
    }));
  }

  // 3. BEST-EFFORT admin email. Never blocks, never fails the request.
  sendAdminNewQuoteEmail({
    quoteId: quoteId ?? leadId,
    name: String(lead.name ?? ''),
    email: String(lead.email ?? ''),
    phone: lead.phone ? String(lead.phone) : undefined,
    service: lead.service ? String(lead.service) : undefined,
    squareFeet: lead.sqft ? Number(lead.sqft) : undefined,
    notes: lead.message ? String(lead.message) : undefined,
  }).catch((err) =>
    console.error(JSON.stringify({ event: 'lead.email_failed', leadId, error: err instanceof Error ? err.message : 'unknown' })),
  );

  // 4. Optional CRM/webhook forward (set LEADS_WEBHOOK_URL to enable).
  const webhookUrl = process.env.LEADS_WEBHOOK_URL;
  if (webhookUrl) {
    fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId, quoteId, ...lead }) })
      .catch((err) => console.error(JSON.stringify({ event: 'lead.webhook_failed', leadId, error: err instanceof Error ? err.message : 'unknown' })));
  }

  // The lead is captured. Always acknowledge success to the customer.
  return NextResponse.json(
    { success: true, leadId, quoteId, message: 'Quote request received! A specialist will call you within 1 business day.', ecoPointsEarned: 750 },
    { status: 201 },
  );
}

export async function GET() {
  return NextResponse.json({ success: false, message: 'Use POST to submit a lead.' }, { status: 405 });
}
