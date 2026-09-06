import { NextResponse } from 'next/server';
import { pilotLeadSchema } from '@ecowoods/shared/schemas';
import { db } from '@/lib/db';
import { sendAdminNewPilotLeadEmail } from '@/lib/email';
import { checkRateLimit, getClientIp, isTrustedBrowserOrigin, LEAD_POST_LIMIT } from '@/lib/rate-limit';
import { webhookFromEnv, postWebhook } from '@/lib/outbound-webhook';

/**
 * POST /api/pilot-leads — Durable, production-safe pilot interest capture.
 *
 * INVARIANT: once a pilot lead validates, it is captured. Period.
 * - Durable structured log happens FIRST and always (recoverable from Vercel logs).
 * - DB persistence is best-effort: a DB outage must NOT surface as a customer error.
 * - Admin email is best-effort.
 * - Rate limiting protects against spam and abuse.
 * We only ever return non-2xx for a genuinely malformed/invalid submission (400),
 * never because a downstream system (DB/email) hiccupped.
 *
 * RATE LIMITING: 5 submissions per minute per IP. Returns 429 if exceeded.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function generatePilotLeadId(): string {
  return `pilot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(request: Request) {
  /* Same CSRF posture as /api/leads: a cross-site page cannot submit a lead
     into this business's pipeline. Absent Origin (curl, native form) is fine;
     a foreign Origin is not. */
  if (!isTrustedBrowserOrigin(request)) {
    return NextResponse.json({ success: false, message: 'Origin not allowed.' }, { status: 403 });
  }
  const clientIp = getClientIp(request);
  const rateLimitCheck = checkRateLimit(clientIp, LEAD_POST_LIMIT);

  // Check rate limit first
  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      {
        success: false,
        message: 'Too many requests. Please try again in a moment.',
        retryAfter: Math.ceil((rateLimitCheck.resetAt - Date.now()) / 1000),
      },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimitCheck.resetAt - Date.now()) / 1000)) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid request body.' },
      { status: 400 }
    );
  }

  const parsed = pilotLeadSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !(key in fieldErrors)) {
        fieldErrors[key] = issue.message;
      }
    }
    return NextResponse.json(
      {
        success: false,
        message: 'Please check the highlighted fields.',
        fieldErrors,
      },
      { status: 400 }
    );
  }

  const lead = parsed.data as Record<string, unknown>;
  const pilotLeadId = generatePilotLeadId();

  // 1. DURABLE CAPTURE — guaranteed, synchronous, dependency-free.
  // The pilot lead now exists in structured logs, recoverable even if DB fails.
  console.log(
    JSON.stringify({
      event: 'pilot.lead.captured',
      pilotLeadId,
      receivedAt: new Date().toISOString(),
      lead,
    })
  );

  // 2. BEST-EFFORT DB persistence. Failure is logged, never fatal.
  let savedLeadId: string | null = null;
  try {
    const savedLead = await db.pilotLead.create({
      data: {
        name: String(lead.name ?? ''),
        email: String(lead.email ?? ''),
        phone: String(lead.phone ?? ''),
        company: String(lead.companyName ?? ''),
        role: String(lead.role ?? 'other'),
        program: String(lead.program ?? 'floorforge-waitlist'),
        squareFeet: lead.flooringSqFt ? Number(lead.flooringSqFt) : null,
        message: lead.message ? String(lead.message) : null,
        source: lead.source ? String(lead.source) : 'floorforge-pilot-form',
        status: 'new',
      },
    });
    savedLeadId = savedLead.id;
  } catch (err) {
    console.error(
      JSON.stringify({
        event: 'pilot.lead.db_persist_failed',
        pilotLeadId,
        error: err instanceof Error ? err.message : 'unknown',
        hint: 'Lead is safe in pilot.lead.captured log above. Check DATABASE_URL and Prisma migrations in this environment.',
      })
    );
  }

  // 3. BEST-EFFORT admin email. Never blocks, never fails the request.
  sendAdminNewPilotLeadEmail({
    pilotLeadId: savedLeadId ?? pilotLeadId,
    name: String(lead.name ?? ''),
    email: String(lead.email ?? ''),
    phone: String(lead.phone ?? ''),
    company: String(lead.companyName ?? ''),
    role: String(lead.role ?? 'other'),
    flooringSqFt: lead.flooringSqFt ? Number(lead.flooringSqFt) : undefined,
    message: lead.message ? String(lead.message) : undefined,
    program: String(lead.program ?? 'floorforge-waitlist'),
  }).catch((err) =>
    console.error(
      JSON.stringify({
        event: 'pilot.lead.email_failed',
        pilotLeadId,
        error: err instanceof Error ? err.message : 'unknown',
        hint: 'Lead is still captured in database and logs. Check email configuration (RESEND_API_KEY, ADMIN_EMAIL, etc.).',
      })
    )
  );

  // 4. Optional CRM/webhook forward (set PILOT_LEADS_WEBHOOK_URL to enable).
  //    Validated and redirect-free — see lib/outbound-webhook.ts.
  const webhookUrl = webhookFromEnv('PILOT_LEADS_WEBHOOK_URL');
  if (webhookUrl) {
    postWebhook(webhookUrl, {
      pilotLeadId: savedLeadId ?? pilotLeadId,
      ...lead,
    }).catch((err) =>
      console.error(
        JSON.stringify({
          event: 'pilot.lead.webhook_failed',
          pilotLeadId,
          error: err instanceof Error ? err.message : 'unknown',
        })
      )
    );
  }

  // The lead is captured. Always acknowledge success to the customer.
  return NextResponse.json(
    {
      success: true,
      pilotLeadId: savedLeadId ?? pilotLeadId,
      message:
        'Thank you for your interest! We will contact you within 2 business days to discuss the FloorForge pilot program and next steps.',
    },
    { status: 201 }
  );
}

export async function GET() {
  return NextResponse.json(
    { success: false, message: 'Use POST to submit pilot interest.' },
    { status: 405 }
  );
}
