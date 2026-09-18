/**
 * POST /api/quote-intelligence/compose — ADMIN only.
 *
 * Preview: turns the estimator's in-progress findings into a report object
 * (or a list of what to fix) without touching the Order or generating a PDF.
 * The Workbench calls this on every "Preview" click; /publish calls the same
 * compose() function before it commits to a PDF.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { compose } from '@/lib/quote-intelligence/compose';
import { extractTierId, isWellInstalledReviewOrder } from '@/lib/quote-intelligence/notes';
import { reviewTierConfig } from '@/content/constants/paid-review-product';
import { parseComposeBody } from '@/lib/quote-intelligence/input';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = parseComposeBody(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { orderId, fields } = parsed.body;

  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || !isWellInstalledReviewOrder(order.notes)) {
    return NextResponse.json({ error: 'Not a Well-Installed Quote Review order' }, { status: 404 });
  }

  const tierId = extractTierId(order.notes);
  const result = compose({
    ...fields,
    orderId: order.id,
    tier: reviewTierConfig(tierId)?.name ?? 'Standard',
  });

  if (!result.ok) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }
  return NextResponse.json({ report: result.report });
}
