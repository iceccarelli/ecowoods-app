import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

/**
 * POST /api/csp-report — where Content-Security-Policy violations land.
 *
 * WHY THIS EXISTS AT ALL
 *
 * P0 shipped a report-only CSP with no `report-uri`. Browsers dutifully
 * evaluated the policy and reported every violation... to the console of
 * whoever happened to have devtools open. Nobody does, on production, at the
 * moment a real visitor's browser blocks something. The header was doing the
 * work and throwing the answer away.
 *
 * Now both the enforced policy and the stricter report-only ladder point here,
 * and violations reach the Vercel log as one structured line each. That is what
 * turns "we think enforcing this is safe" into a measurement.
 *
 * IT IS DELIBERATELY DUMB. It logs and returns 204. It does not write to the
 * database, does not email, and does not alert: this endpoint is public and
 * unauthenticated by necessity — the browser posts to it with no credentials —
 * so anything expensive behind it is a denial-of-service lever handed to
 * anybody who can spell curl. Rate-limited hard for the same reason, and the
 * body is capped: a report is a few hundred bytes and anything larger is not a
 * report.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 8 * 1024;

export async function POST(request: Request) {
  // Generous enough for a page that genuinely violates several directives at
  // once, tight enough that this cannot be used as a log-flooding tool.
  const rl = checkRateLimit(`csp:${getClientIp(request)}`, { windowMs: 60_000, maxRequests: 30 });
  if (!rl.allowed) return new NextResponse(null, { status: 429 });

  try {
    const raw = await request.text();
    if (raw.length > MAX_BYTES) return new NextResponse(null, { status: 413 });
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    /* Two wire formats, because browser support is split: the deprecated
       `report-uri` sends { "csp-report": {...} }, the Reporting API sends an
       array of { type, body }. Normalise both to one log shape so a search of
       the logs finds every violation regardless of which browser reported it. */
    const reports = Array.isArray(parsed)
      ? (parsed as Array<{ body?: Record<string, unknown> }>).map((r) => r.body ?? {})
      : [(parsed['csp-report'] as Record<string, unknown>) ?? parsed];

    for (const r of reports) {
      console.warn(
        JSON.stringify({
          event: 'csp.violation',
          directive: r['effective-directive'] ?? r['effectiveDirective'] ?? r['violated-directive'],
          blocked: r['blocked-uri'] ?? r['blockedURL'],
          document: r['document-uri'] ?? r['documentURL'],
          disposition: r['disposition'],
          sample: typeof r['script-sample'] === 'string' ? String(r['script-sample']).slice(0, 120) : undefined,
        }),
      );
    }
  } catch {
    // A malformed report is not worth a status code the browser will ignore.
  }

  return new NextResponse(null, { status: 204 });
}
