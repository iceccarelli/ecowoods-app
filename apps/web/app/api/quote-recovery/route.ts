import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { checkRateLimit, getClientIp, isTrustedBrowserOrigin, LEAD_POST_LIMIT } from '@/lib/rate-limit';

/**
 * POST /api/quote-recovery — record a CONSENTED reminder for an unfinished form.
 *
 * Fired by the estimate form when someone has typed an email AND ticked the
 * reminder box, but has not submitted. Two hours later, if they still have not,
 * /api/cron/quote-recovery sends exactly one email.
 *
 * THE CONSENT IS THE PRODUCT. Canada's anti-spam law does not care that the
 * address was typed into our own form — an unsolicited commercial email is an
 * offence with penalties measured in tens of thousands of dollars, and "they
 * were clearly interested" is not a defence. So the checkbox is required by the
 * schema, the timestamp is stored on the row, and the sender re-checks it. A
 * recovery programme that cannot prove consent per-message is not a growth
 * channel, it is a liability with a nice conversion rate.
 *
 * DEDUPED BY EMAIL. A person who tabs between two pages, or reloads, must not
 * accumulate reminders. One pending row per address; a repeat call refreshes
 * it rather than adding to it.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const recoverySchema = z.object({
  email: z.string().email(),
  name: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  source: z.string().max(120).optional(),
  service: z.string().max(60).optional(),
  city: z.string().max(80).optional(),
  /** Must be literally true. The box, ticked, by a person. */
  consent: z.literal(true),
});

export async function POST(request: Request) {
  if (!isTrustedBrowserOrigin(request)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const rl = checkRateLimit(getClientIp(request), LEAD_POST_LIMIT);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const parsed = recoverySchema.safeParse(body);
  if (!parsed.success) {
    // Deliberately terse: this endpoint is fired in the background by the form
    // and its failures must never surface to a visitor mid-typing.
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const d = parsed.data;

  try {
    const pending = await db.quoteRecovery.findFirst({
      where: { email: d.email, sentAt: null, convertedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (pending) {
      await db.quoteRecovery.update({
        where: { id: pending.id },
        data: {
          name: d.name ?? pending.name,
          phone: d.phone ?? pending.phone,
          source: d.source ?? pending.source,
          service: d.service ?? pending.service,
          city: d.city ?? pending.city,
          consentedAt: new Date(),
        },
      });
    } else {
      await db.quoteRecovery.create({
        data: {
          email: d.email,
          name: d.name ?? null,
          phone: d.phone ?? null,
          source: d.source ?? null,
          service: d.service ?? null,
          city: d.city ?? null,
          consentedAt: new Date(),
        },
      });
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        event: 'quote_recovery.persist_failed',
        error: err instanceof Error ? err.message : 'unknown',
      }),
    );
    // Never an error to the visitor: this is a background nicety, not the lead.
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
