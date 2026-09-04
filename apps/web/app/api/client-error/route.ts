import { NextResponse } from 'next/server';
import { reportError } from '@/lib/error-reporting';
import { checkRateLimit, getClientIp, isTrustedBrowserOrigin } from '@/lib/rate-limit';

/**
 * POST /api/client-error — the browser-side half of error tracking.
 *
 * app/error.tsx and app/global-error.tsx post here when a React render
 * fails in a visitor's browser; the record joins the server-side stream in
 * lib/error-reporting. Same-origin only, rate-limited per IP, body capped,
 * nothing stored — it is forwarded and forgotten.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIMIT = { windowMs: 60 * 1000, maxRequests: 10 };
const MAX_BODY = 16 * 1024;

export async function POST(request: Request) {
  if (!isTrustedBrowserOrigin(request)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const { allowed } = checkRateLimit(`client-error:${getClientIp(request)}`, LIMIT);
  if (!allowed) return NextResponse.json({ ok: false }, { status: 429 });

  let body: { message?: unknown; stack?: unknown; name?: unknown; digest?: unknown; url?: unknown } = {};
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return NextResponse.json({ ok: false }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

  await reportError({
    source: 'client',
    message: str(body.message) ?? 'client error',
    stack: str(body.stack),
    name: str(body.name),
    digest: str(body.digest),
    url: str(body.url),
    userAgent: request.headers.get('user-agent') ?? undefined,
  });
  return new NextResponse(null, { status: 204 });
}
