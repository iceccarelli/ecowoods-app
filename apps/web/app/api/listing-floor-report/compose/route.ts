/**
 * POST /api/listing-floor-report/compose — ADMIN only.
 *
 * Preview: turns the estimator's in-progress findings into a report object
 * (or a list of what to fix) without touching the Order or generating a PDF.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { compose } from '@/lib/listing-floor-report/compose';
import { extractListingReportSku, extractMeta, isListingFloorReportOrder } from '@/lib/listing-floor-report/notes';
import type { ComposeInput } from '@/lib/listing-floor-report/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Partial<ComposeInput> | null;
  if (!body?.orderId) {
    return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
  }

  const order = await db.order.findUnique({ where: { id: body.orderId } });
  if (!order || !isListingFloorReportOrder(order.notes)) {
    return NextResponse.json({ error: 'Not a listing floor report order' }, { status: 404 });
  }

  const meta = extractMeta(order.notes);
  if (!meta) {
    return NextResponse.json({ error: 'No intake submitted for this order yet.' }, { status: 409 });
  }

  const result = compose({
    orderId: order.id,
    sku: extractListingReportSku(order.notes),
    photographyDate: meta.photographyDate,
    recommendation: body.recommendation ?? 'cannot_determine_from_photos',
    findings: body.findings ?? { finishWear: 'not_specified', woodDamage: 'not_specified', moisture: 'inspection_needed' },
    present: body.present ?? '',
    missing: body.missing ?? '',
    askInWriting: body.askInWriting,
  });

  if (!result.ok) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }
  return NextResponse.json({ report: result.report, meta });
}
