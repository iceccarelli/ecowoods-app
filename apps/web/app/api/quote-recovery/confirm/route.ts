import { db } from '@/lib/db';
import { hashConfirmToken } from '@/lib/quote-recovery';

/**
 * /api/quote-recovery/confirm — the double opt-in step.
 *
 * GET only renders a button; POST consumes the token. Mail scanners and link
 * previewers fetch GET links automatically, and a GET that confirmed would let
 * a scanner "consent" on the owner's behalf.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const page = (title: string, body: string) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<meta name="robots" content="noindex"><title>${title}</title></head>` +
      `<body style="font-family:sans-serif;max-width:480px;margin:4rem auto;padding:0 1rem;color:#1a0f08;">${body}</body></html>`,
    { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  );

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  if (!token || token.length > 200) return page('Link not valid', '<p>This confirmation link is not valid.</p>');
  return page(
    'Confirm reminder',
    `<h1>Confirm your reminder</h1><p>We will send one email if your estimate form is left unfinished, and never again.</p>` +
      `<form method="post" action="/api/quote-recovery/confirm"><input type="hidden" name="token" value="${esc(token)}">` +
      `<button type="submit" style="padding:.7rem 1.2rem;font-size:1rem;">Yes, send me that one reminder</button></form>`,
  );
}

export async function POST(request: Request) {
  let token = '';
  try {
    const fd = await request.formData();
    const v = fd.get('token');
    token = typeof v === 'string' ? v : '';
  } catch {
    /* fall through to invalid */
  }
  if (!token || token.length > 200) return page('Link not valid', '<p>This confirmation link is not valid.</p>');

  try {
    const row = await db.quoteRecovery.findFirst({
      where: { confirmTokenHash: hashConfirmToken(token), sentAt: null, convertedAt: null },
      select: { id: true, confirmSentAt: true },
    });
    if (!row || !row.confirmSentAt || Date.now() - row.confirmSentAt.getTime() > TOKEN_TTL_MS) {
      return page('Link expired', '<p>This confirmation link has expired or was already used. Nothing will be sent.</p>');
    }
    // Single use: the hash is cleared as the row is confirmed.
    await db.quoteRecovery.update({
      where: { id: row.id },
      data: { confirmedAt: new Date(), confirmTokenHash: null },
    });
  } catch (err) {
    console.error(
      JSON.stringify({ event: 'quote_recovery.confirm_failed', error: err instanceof Error ? err.message : 'unknown' }),
    );
    return page('Something went wrong', '<p>We could not record that. Please try the link again in a moment.</p>');
  }
  return page('Reminder confirmed', '<h1>Confirmed</h1><p>Thank you. You will get at most one reminder, and only if the form is left unfinished.</p>');
}
