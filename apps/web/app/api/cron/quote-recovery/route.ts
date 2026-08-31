import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';

/**
 * GET /api/cron/quote-recovery — send the one reminder, once.
 *
 * Run by Vercel Cron (see the `crons` block in vercel.json). Every row it
 * touches carries a consent timestamp put there by a person ticking a box; the
 * check is repeated here rather than trusted from upstream, because the cost of
 * being wrong is a CASL violation rather than a bad metric.
 *
 * THE RULES, IN THE ORDER THEY ARE ENFORCED
 *
 *   · The caller presents CRON_SECRET, or gets a 401. An unauthenticated route
 *     that emails addresses out of your database is a spam cannon with your
 *     domain's reputation attached to it.
 *   · consentedAt is set        — no consent, no send. Ever.
 *   · sentAt is null            — exactly one email per person, forever.
 *   · convertedAt is null       — somebody who finished is never asked to.
 *   · The row is at least 2h old and at most 7 days old. A reminder about a
 *     form somebody abandoned last month is not a reminder, it is a cold email.
 *   · sentAt is stamped BEFORE the send. A crash after the send would otherwise
 *     re-queue the same person on the next run, and sending twice is worse than
 *     not sending at all.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_AGE_MS = 2 * 60 * 60 * 1000; // the brief's two hours
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH = 50;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  let due: Array<{ id: string; email: string; name: string | null }> = [];
  try {
    due = await db.quoteRecovery.findMany({
      where: {
        sentAt: null,
        convertedAt: null,
        createdAt: { lte: new Date(now - MIN_AGE_MS), gte: new Date(now - MAX_AGE_MS) },
      },
      select: { id: true, email: true, name: true },
      take: BATCH,
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        event: 'quote_recovery.cron_query_failed',
        error: err instanceof Error ? err.message : 'unknown',
      }),
    );
    return NextResponse.json({ ok: false, error: 'query_failed' }, { status: 500 });
  }

  let sent = 0;
  for (const row of due) {
    // Stamp FIRST. A crash mid-send loses one email; a crash after an unstamped
    // send emails the same person on every run until somebody notices.
    try {
      await db.quoteRecovery.update({ where: { id: row.id }, data: { sentAt: new Date() } });
    } catch {
      continue;
    }

    const first = (row.name ?? '').trim().split(/\s+/)[0];
    const greeting = first ? `${first},` : 'Hello,';

    try {
      await sendEmail({
        to: row.email,
        subject: 'Your floor is still unmeasured',
        text:
          `${greeting}\n\n` +
          `You started an estimate with us and did not finish it — no problem, and this is the ` +
          `only time we will mention it.\n\n` +
          `If it is easier, reply to this email with three photos of the floor and we will tell ` +
          `you what it needs. Or call ${BUSINESS_NAP.phoneDisplay} and we will book the measure ` +
          `in about a minute.\n\n` +
          `The measurement is free and the written price does not move afterwards.\n\n` +
          `— ${BUSINESS_NAP.legalName}\n${BUSINESS_NAP.phoneDisplay}\n`,
        html:
          `<p>${greeting}</p>` +
          `<p>You started an estimate with us and did not finish it — no problem, and this is the only time we will mention it.</p>` +
          `<p>If it is easier, <strong>reply to this email with three photos of the floor</strong> and we will tell you what it needs. ` +
          `Or call <a href="${BUSINESS_NAP.phoneHref}">${BUSINESS_NAP.phoneDisplay}</a> and we will book the measure in about a minute.</p>` +
          `<p>The measurement is free and the written price does not move afterwards.</p>` +
          `<p style="color:#6b5d4f;font-size:13px;">— ${BUSINESS_NAP.legalName} · ${BUSINESS_NAP.phoneDisplay}<br>` +
          `You are receiving this once because you asked to be reminded if you left the form unfinished.</p>`,
      });
      sent += 1;
    } catch (err) {
      console.error(
        JSON.stringify({
          event: 'quote_recovery.send_failed',
          id: row.id,
          error: err instanceof Error ? err.message : 'unknown',
        }),
      );
    }
  }

  console.log(JSON.stringify({ event: 'quote_recovery.cron_run', due: due.length, sent }));
  return NextResponse.json({ ok: true, due: due.length, sent });
}
