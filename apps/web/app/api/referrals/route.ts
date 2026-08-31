import { NextResponse } from 'next/server';
import { referralSchema } from '@ecowoods/shared/schemas';
import { sendEmail } from '@/lib/email';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { REFERRAL, referralOfferLine } from '@/content/referral';
import { checkRateLimit, getClientIp, isTrustedBrowserOrigin, LEAD_POST_LIMIT } from '@/lib/rate-limit';

/**
 * POST /api/referrals — somebody vouching for us to somebody they know.
 *
 * THE MOST VALUABLE LEAD TYPE THERE IS, AND THE EASIEST TO MISHANDLE.
 *
 * A referred customer arrives pre-trusted: the hardest part of selling a
 * five-figure floor is already done by a person the buyer believes. The way to
 * destroy that is to treat the referred person as a marketing list. So:
 *
 *   · The referrer's consent is required by the schema and recorded on the
 *     durable log line — CASL's referral exemption permits ONE message, and
 *     only where a real relationship exists.
 *   · Nothing is auto-sent to the referred person. This route emails the
 *     ESTIMATING DESK. A human decides how to make contact, mentions who sent
 *     them, and does it once.
 *   · The reward terms are read from content/referral.ts, so the internal email
 *     states the same offer the referrer read on the page.
 *
 * Same capture invariant as every other lead route: durable structured log
 * before the rate limiter, so a false positive can inconvenience but never
 * erase.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function referralId(): string {
  return `ref_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function backTo(request: Request, ok: boolean): string {
  const ref = request.headers.get('referer');
  try {
    const site = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ecowoods.ca');
    const u = new URL(ref ?? '/refer', site);
    if (u.host !== site.host) return '/refer?sent=1';
    u.searchParams.set(ok ? 'sent' : 'error', '1');
    return `${u.pathname}${u.search}`;
  } catch {
    return ok ? '/refer?sent=1' : '/refer?error=1';
  }
}

export async function POST(request: Request) {
  if (!isTrustedBrowserOrigin(request)) {
    return NextResponse.json({ success: false, message: 'Origin not allowed.' }, { status: 403 });
  }

  const type = request.headers.get('content-type') ?? '';
  let body: Record<string, unknown> = {};
  let isFormPost = false;
  try {
    if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
      const fd = await request.formData();
      fd.forEach((v, k) => {
        if (typeof v === 'string' && v !== '') body[k] = v;
      });
      isFormPost = true;
    } else {
      body = (await request.json()) as Record<string, unknown>;
    }
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request body.' }, { status: 400 });
  }

  if (typeof body.company === 'string' && body.company.trim()) {
    console.log(JSON.stringify({ event: 'referral.honeypot', at: new Date().toISOString() }));
    if (isFormPost) return NextResponse.redirect(new URL(backTo(request, true), request.url), 303);
    return NextResponse.json({ success: true }, { status: 201 });
  }

  const parsed = referralSchema.safeParse(body);
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

  const d = parsed.data;
  const id = referralId();

  console.log(
    JSON.stringify({
      event: 'referral.captured',
      id,
      receivedAt: new Date().toISOString(),
      referrer: { name: d.referrerName, email: d.referrerEmail, phone: d.referrerPhone },
      referred: { name: d.friendName, contact: d.friendContact, area: d.friendArea },
      // The consent that makes the single outbound contact lawful. Logged, not implied.
      referrerConsentedAt: new Date().toISOString(),
      offer: referralOfferLine(),
    }),
  );

  const rl = checkRateLimit(getClientIp(request), LEAD_POST_LIMIT);
  if (!rl.allowed) {
    console.warn(JSON.stringify({ event: 'referral.rate_limited', id, note: 'Captured above.' }));
    return NextResponse.json({ success: false, message: 'Please wait a moment.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  try {
    const rows = [
      ['Referred by', `${d.referrerName} — ${d.referrerEmail}, ${d.referrerPhone}`],
      ['Who they referred', d.friendName],
      ['How to reach them', d.friendContact],
      ['Area', d.friendArea ?? '—'],
      ['Note', d.note ?? '—'],
      ['Reward owed on completion', referralOfferLine()],
      ['Reference', id],
    ]
      .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b5d4f;">${k}</td><td style="padding:4px 0;"><strong>${v}</strong></td></tr>`)
      .join('');

    await sendEmail({
      to: process.env.ADMIN_EMAIL ?? BUSINESS_NAP.email,
      subject: `Referral from ${d.referrerName} — ${d.friendName}`,
      html:
        `<h2 style="margin:0 0 8px;">A customer referred somebody</h2>` +
        `<p style="margin:0 0 16px;">Contact them <strong>once</strong>, say who sent you, and do it soon — a referral goes cold faster than a form fill. ` +
        `The referrer is owed ${REFERRAL.creditPercent}% credit or $${REFERRAL.flatCad} ${REFERRAL.condition}.</p>` +
        `<table style="border-collapse:collapse;">${rows}</table>`,
      text: `Referral from ${d.referrerName} (${d.referrerEmail}) → ${d.friendName} (${d.friendContact}). Reward: ${referralOfferLine()}. Ref ${id}`,
    });
  } catch (err) {
    console.error(
      JSON.stringify({ event: 'referral.email_failed', id, error: err instanceof Error ? err.message : 'unknown' }),
    );
  }

  if (isFormPost) return NextResponse.redirect(new URL(backTo(request, true), request.url), 303);
  return NextResponse.json({ success: true, id, message: 'Thank you — we will reach out to them once, and mention you.' }, { status: 201 });
}

export async function GET() {
  return NextResponse.json({ success: false, message: 'Use POST to submit a referral.' }, { status: 405 });
}
