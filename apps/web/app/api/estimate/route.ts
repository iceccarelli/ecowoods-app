import { NextResponse } from 'next/server';
import {
  estimateInstalledRangeCad,
  FLOORING_RATES_CAD_PER_SQFT,
  FINISH_OPTIONS,
  PATTERN_OPTIONS,
} from '@ecowoods/shared/ai';
import { PRICING, PRICE_PROMISE, estimateServiceBandCad } from '@/lib/pricing';
import { SITE_URL, BUSINESS } from '@/lib/seo-data';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

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

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
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

function handle(input: Record<string, unknown>, request: Request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, { windowMs: 60_000, maxRequests: 30 });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: { ...CORS, 'Retry-After': '60' } },
    );
  }

  const { species, squareFeet, finish, pattern, service } = parseBody(input);

  // Catalogue mode — no sqft.
  if (!Number.isFinite(squareFeet) || squareFeet <= 0) {
    return NextResponse.json({ ok: true, ...bandPayload() }, { headers: CORS });
  }

  if (service) {
    const band = estimateServiceBandCad(service, squareFeet);
    if (!band) {
      return NextResponse.json(
        { ok: false, error: 'unknown_service', services: Object.keys(PRICING) },
        { status: 400, headers: CORS },
      );
    }
    return NextResponse.json({ ok: true, ...band, ...bandPayload() }, { headers: CORS });
  }

  const result = estimateInstalledRangeCad({ species, squareFeet, finish, pattern });
  return NextResponse.json({ ok: true, estimate: result, ...bandPayload() }, { headers: CORS });
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
  return handle(input, request);
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400, headers: CORS });
  }
  return handle(body, request);
}
