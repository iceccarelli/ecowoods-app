import { NextResponse } from 'next/server';
import { leadSchema } from '@ecowoods/shared/schemas';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { sendAdminNewQuoteEmail, sendQuoteReceivedEmail } from '@/lib/email';
import { checkRateLimit, getClientIp, isTrustedBrowserOrigin, LEAD_POST_LIMIT } from '@/lib/rate-limit';

/**
 * POST /api/leads — THE conversion surface.
 *
 * INVARIANT: once a lead validates, it is captured. Period.
 * - Rate-limit + honeypot run BEFORE durable capture (spam never becomes a lead).
 * - Durable structured log happens FIRST after validation (recoverable from Vercel logs).
 * - DB persistence is best-effort: a DB outage must NOT surface as a customer error.
 * - Admin email and customer acknowledgement are best-effort.
 * We only ever return non-2xx for a genuinely malformed/invalid submission (400),
 * rate-limit (429), never because a downstream system (DB/email) hiccupped.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function generateLeadId(): string {
  return `lead_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * A form POST and a fetch POST are the same lead.
 *
 * F-160: every page on this site served zero `<form>` elements, because the only
 * one lived inside a React modal behind state. The fix renders a real form in
 * the HTML — which means this route now receives
 * `application/x-www-form-urlencoded` from a browser with no JavaScript, as well
 * as the JSON it already took from fetch.
 *
 * Both go through the SAME validation and the SAME capture order below. That is
 * deliberate and it is the only safe way to do this: a second parsing path that
 * skipped the durable log would be a lead that vanishes exactly when the client
 * is least capable, which is the moment this whole change exists to serve.
 */
async function readBody(request: Request): Promise<{ body: unknown; isFormPost: boolean }> {
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
    const fd = await request.formData();
    const out: Record<string, unknown> = {};
    fd.forEach((v, k) => {
      if (typeof v !== 'string' || v === '') return;
      out[k] = k === 'sqft' ? Number(v) : v;
    });
    return { body: out, isFormPost: true };
  }
  return { body: await request.json(), isFormPost: false };
}

/** Where to send a no-JS browser back to. Same-origin only. */
function backTo(request: Request, ok: boolean): string {
  const ref = request.headers.get('referer');
  try {
    const u = new URL(ref ?? '/', process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ecowoods.ca');
    const site = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ecowoods.ca');
    if (u.host !== site.host) return '/?sent=1';
    u.searchParams.set(ok ? 'sent' : 'error', '1');
    u.hash = 'estimate';
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return ok ? '/?sent=1' : '/?error=1';
  }
}

export async function POST(request: Request) {
  // P0.7 — CSRF hygiene. A browser POST carrying a foreign Origin header is
  // refused before anything is read. An absent Origin is allowed: the no-JS
  // form fallback and non-browser clients depend on it, and a non-browser
  // client can forge any Origin anyway — this blocks cross-site browser
  // posts, it does not pretend to be authentication.
  if (!isTrustedBrowserOrigin(request)) {
    return NextResponse.json({ success: false, message: 'Origin not allowed.' }, { status: 403 });
  }

  let body: unknown;
  let isFormPost = false;
  try {
    const read = await readBody(request);
    body = read.body;
    isFormPost = read.isFormPost;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request body.' }, { status: 400 });
  }

  // Honeypot — bots fill "company". Humans never see it. Accept silently, so a
  // bot cannot learn it was detected. Checked before the rate limiter so bot
  // traffic never consumes a real visitor's allowance.
  if (typeof (body as { company?: unknown }).company === 'string' && (body as { company: string }).company.trim()) {
    console.log(JSON.stringify({ event: 'lead.honeypot', at: new Date().toISOString() }));
    if (isFormPost) return NextResponse.redirect(new URL(backTo(request, true), request.url), 303);
    return NextResponse.json(
      { success: true, message: 'Quote request received! A specialist will call you within 1 business day.' },
      { status: 201 },
    );
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
    if (isFormPost) return NextResponse.redirect(new URL(backTo(request, false), request.url), 303);
    return NextResponse.json(
      { success: false, message: 'Please check the highlighted fields.', fieldErrors },
      { status: 400 },
    );
  }

  const lead = parsed.data as Record<string, unknown>;
  const leadId = generateLeadId();

  // 1. DURABLE CAPTURE — guaranteed, synchronous, dependency-free. The lead now exists.
  console.log(JSON.stringify({ event: 'lead.captured', leadId, receivedAt: new Date().toISOString(), lead }));

  /**
   * RATE LIMIT — AFTER VALIDATION, AND AFTER THE DURABLE LOG.
   *
   * The order here is the whole point, and the first draft of this had it
   * backwards in two ways that each break the one invariant this file exists to
   * protect: THE LEAD MUST NEVER BE LOST.
   *
   * It ran BEFORE validation. The limiter is five requests per minute per IP,
   * and a request that fails validation is still a request. A customer
   * correcting a phone number, a postal code and a typo has spent three. The
   * fourth correction is the one that would have succeeded, and the fifth is a
   * hard 429. We would have rate-limited someone for trying to give us money.
   *
   * It ran BEFORE the durable log. A 429 returned nothing to any log, so a real
   * lead caught by a false positive left no trace at all — and false positives
   * are not exotic here. A single office, a condo building, a school, or any
   * mobile carrier using CGNAT presents one IP for hundreds of people. Five per
   * minute across a whole building is a plausible Saturday.
   *
   * So: validate first, log first, and only then decide whether to answer. The
   * lead is already recoverable from the structured log before this line runs,
   * which means the worst a false positive can now do is inconvenience someone
   * — not erase them.
   *
   * The limit is the P0.7 contract for every public lead POST: a token bucket
   * of ten per minute per IP (LEAD_POST_LIMIT). Ten is protecting against a
   * flood, and a flood is not ten — while the token bucket (unlike the old
   * fixed window) refills continuously, so a household correcting typos never
   * feels it.
   */
  const rl = checkRateLimit(getClientIp(request), LEAD_POST_LIMIT);
  if (!rl.allowed) {
    console.warn(
      JSON.stringify({
        event: 'lead.rate_limited',
        leadId,
        note: 'Lead already captured in the log line above. Recoverable.',
      }),
    );
    return NextResponse.json(
      { success: false, message: 'Please wait a moment before sending another request.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  // 2. BEST-EFFORT DB persistence. Failure is logged, never fatal.
  //    city ← explicit city if provided; postal is stored on address (not city).
  let quoteId: string | null = null;
  try {
    const session = await auth().catch(() => null);
    const quote = await db.quoteRequest.create({
      data: {
        name: String(lead.name ?? ''),
        email: String(lead.email ?? ''),
        phone: lead.phone ? String(lead.phone) : null,
        city: lead.city ? String(lead.city) : null,
        address: lead.postal ? String(lead.postal) : null,
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

  // 4. Customer acknowledgement — best-effort, never fatal.
  sendQuoteReceivedEmail({
    name: String(lead.name ?? ''),
    email: String(lead.email ?? ''),
    leadId: quoteId ?? leadId,
  }).catch((err) =>
    console.error(JSON.stringify({ event: 'lead.customer_email_failed', leadId, error: err instanceof Error ? err.message : 'unknown' })),
  );

  // 5. Optional CRM/webhook forward (set LEADS_WEBHOOK_URL to enable).
  const webhookUrl = process.env.LEADS_WEBHOOK_URL;
  if (webhookUrl) {
    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, quoteId, ...lead }),
    }).catch((err) =>
      console.error(JSON.stringify({ event: 'lead.webhook_failed', leadId, error: err instanceof Error ? err.message : 'unknown' })),
    );
  }

  // The lead is captured. Always acknowledge success to the customer.
  if (isFormPost) return NextResponse.redirect(new URL(backTo(request, true), request.url), 303);
  return NextResponse.json(
    { success: true, leadId, quoteId, message: 'Quote request received! A specialist will call you within 1 business day.', ecoPointsEarned: 750 },
    { status: 201 },
  );
}

export async function GET() {
  return NextResponse.json({ success: false, message: 'Use POST to submit a lead.' }, { status: 405 });
}
