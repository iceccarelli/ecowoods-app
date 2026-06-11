import { NextRequest, NextResponse } from 'next/server';
import { availabilityQuerySchema } from '@ecowoods/shared';
import { db } from '@/lib/db';
import { computeAvailability, localDateKey, addDaysToKey } from '@/lib/booking/availability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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
    const fromKey = parsed.data.from ?? localDateKey(now);
    const toKey = parsed.data.to ?? addDaysToKey(fromKey, 42);

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

    const result = computeAvailability({ now, bookingCounts }, parsed.data.from, parsed.data.to);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[availability] failed:', err);
    return NextResponse.json(
      { error: 'Could not load availability. Please call (416) 249-1276.' },
      { status: 500 },
    );
  }
}
