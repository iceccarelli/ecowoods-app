import { NextResponse } from 'next/server';
import {
  estimateInstalledRangeCad,
  FLOORING_RATES_CAD_PER_SQFT,
  FINISH_OPTIONS,
  PATTERN_OPTIONS,
} from '@ecowoods/shared/ai';
import { PRICING, PRICE_PROMISE, estimateServiceBandCad } from '@/lib/pricing';
import { SITE_URL, BUSINESS } from '@/lib/seo-data';
import { checkRateLimit, getClientIp, isTrustedBrowserOrigin, LEAD_POST_LIMIT } from '@/lib/rate-limit';

/**
 * GET/POST /api/estimate — public rough-range endpoint for humans, tools, and AI agents.
 *
 * Same numbers as the floor configurator and EcowoodsGuide's estimate_project tool
 * (estimateInstalledRangeCad). Rate-limited. Never a fixed quote.
 *
 *   GET  /api/estimate?species=white%20oak&sqft=1200&finish=waterborne&pattern=straight
 *   POST /api/estimate  { "species":"white oak","squareFeet":1200,"finish":"waterborne","pattern":"straight" }
 *   GET  /api/estimate?service=fullSandAndFinish&sqft=1200
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * P0.7 — CORS `*` is for the PUBLIC READ surface only. GET returns the same
 * published bands as /api/knowledge and stays open to any origin (agents,
 * tools, browser fetches). POST is for this site's own pages: it gets no CORS
 * header, and a browser POST from a foreign origin is refused outright.
 */
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function bandPayload() {
  return {
    business: BUSINESS.name,
    url: SITE_URL,
    promise: PRICE_PROMISE,
    serviceBandsCadPerSqft: PRICING,
    speciesRatesCadPerSqft: FLOORING_RATES_CAD_PER_SQFT,
    finishes: FINISH_OPTIONS,
    patterns: PATTERN_OPTIONS,
    disclaimer:
      'Rough ranges only. Final price is fixed in writing after a free in-home measure.',
  };
}

function parseBody(input: Record<string, unknown>) {
  const species = typeof input.species === 'string' ? input.species : 'white oak';
  const sqftRaw = input.squareFeet ?? input.sqft;
  const squareFeet = typeof sqftRaw === 'number' ? sqftRaw : Number(sqftRaw);
  const finish = typeof input.finish === 'string' ? input.finish : undefined;
  const pattern = typeof input.pattern === 'string' ? input.pattern : undefined;
  const service = typeof input.service === 'string' ? input.service : undefined;
  return { species, squareFeet, finish, pattern, service };
}

function handle(input: Record<string, unknown>, request: Request, headers: Record<string, string>) {
  const ip = getClientIp(request);
  // P0.7 — token bucket, 10/min/IP, 429 JSON with Retry-After.
  const rl = checkRateLimit(ip, LEAD_POST_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: { ...headers, 'Retry-After': '60' } },
    );
  }

  const { species, squareFeet, finish, pattern, service } = parseBody(input);

  // Catalogue mode — no sqft.
  if (!Number.isFinite(squareFeet) || squareFeet <= 0) {
    return NextResponse.json({ ok: true, ...bandPayload() }, { headers });
  }

  if (service) {
    const band = estimateServiceBandCad(service, squareFeet);
    if (!band) {
      return NextResponse.json(
        { ok: false, error: 'unknown_service', services: Object.keys(PRICING) },
        { status: 400, headers },
      );
    }
    return NextResponse.json({ ok: true, ...band, ...bandPayload() }, { headers });
  }

  const result = estimateInstalledRangeCad({ species, squareFeet, finish, pattern });
  return NextResponse.json({ ok: true, estimate: result, ...bandPayload() }, { headers });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const input: Record<string, unknown> = {
    species: url.searchParams.get('species') ?? undefined,
    sqft: url.searchParams.get('sqft') ?? url.searchParams.get('squareFeet') ?? undefined,
    finish: url.searchParams.get('finish') ?? undefined,
    pattern: url.searchParams.get('pattern') ?? undefined,
    service: url.searchParams.get('service') ?? undefined,
  };
  return handle(input, request, CORS);
}

export async function POST(request: Request) {
  // Browser POSTs must come from this site (or a preview of it). Non-browser
  // clients that want the bands should use GET, which is CORS-open.
  if (!isTrustedBrowserOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'origin_not_allowed' }, { status: 403 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  return handle(body, request, {});
}
