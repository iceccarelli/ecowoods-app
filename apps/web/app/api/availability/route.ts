import { NextRequest, NextResponse } from 'next/server';
import { availabilityQuerySchema } from '@ecowoods/shared';
import { db } from '@/lib/db';
import { computeAvailability, localDateKey, clampWindow } from '@/lib/booking/availability';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(`availability:${getClientIp(request)}`, { windowMs: 60_000, maxRequests: 30 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))) } });
  }
  const { searchParams } = new URL(request.url);
  const parsed = availabilityQuerySchema.safeParse({
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid date range.' }, { status: 400 });
  }

  try {
    const now = new Date();
    /* The window is bounded (F: an anonymous caller could ask for every
       appointment ever scheduled with from=0001-01-01&to=9999-12-31). */
    const window = clampWindow(parsed.data.from ?? localDateKey(now), parsed.data.to);
    if (!window) return NextResponse.json({ error: 'Invalid date range.' }, { status: 400 });
    const { fromKey, toKey } = window;

    // Pull existing confirmed appointments in range, count per slot start.
    const rows = await db.appointment.findMany({
      where: {
        status: 'SCHEDULED',
        startsAt: { gte: new Date(`${fromKey}T00:00:00Z`), lte: new Date(`${toKey}T23:59:59Z`) },
      },
      select: { startsAt: true },
    });
    const bookingCounts = new Map<string, number>();
    for (const r of rows) {
      const iso = r.startsAt.toISOString();
      bookingCounts.set(iso, (bookingCounts.get(iso) ?? 0) + 1);
    }

    const result = computeAvailability({ now, bookingCounts }, fromKey, toKey);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[availability] failed:', err);
    return NextResponse.json(
      { error: `Could not load availability. Please call ${BUSINESS_NAP.phoneDisplay}.` },
      { status: 500 },
    );
  }
}
