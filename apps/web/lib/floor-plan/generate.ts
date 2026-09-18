/**
 * lib/floor-plan/generate.ts — the one side-effecting step this product
 * needs: decode the paid design, build the spec, render + store the PDF,
 * and mark the order fulfilled. No admin step exists for EW-0004 — every
 * input is either the catalogue or the customer's own already-paid-for
 * configuration, so there is no expert judgment call for a human to make
 * (unlike EW-0002/EW-0003, where a human reads someone else's document).
 *
 * Called from the [id] page itself the first time it renders for a PAID
 * order with no report yet. Idempotency is enforced by
 * appendReportMarker()'s own no-op-if-present check; two concurrent first
 * views of the same order could in principle each render a PDF before either
 * write lands, which would store one wasted extra blob but would still
 * leave every reader seeing the SAME url afterwards (extractReportUrl reads
 * the first marker in the string). That tradeoff is accepted for the SSV
 * rather than adding a locking column to Order for a $99 digital product.
 */

import { db } from '@/lib/db';
import { decodeStudioDesign } from '@/lib/floor-studio/studio-config';
import { buildFloorPlanSpec } from './spec';
import { storeFloorPlanSpec } from './store';
import { appendReportMarker, extractDesignCode, extractReportUrl, isFloorPlanOrder } from './notes';

export type GenerateResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'not_found' | 'not_paid' | 'bad_design' };

export async function ensureFloorPlanReport(orderId: string): Promise<GenerateResult> {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || !isFloorPlanOrder(order.notes)) return { ok: false, reason: 'not_found' };

  const existingUrl = extractReportUrl(order.notes);
  if (existingUrl) return { ok: true, url: existingUrl };

  if (order.status !== 'PAID' && order.status !== 'FULFILLED') {
    return { ok: false, reason: 'not_paid' };
  }

  const code = extractDesignCode(order.notes);
  const design = code ? decodeStudioDesign(code) : null;
  if (!design) return { ok: false, reason: 'bad_design' };

  const spec = buildFloorPlanSpec(order.id, design);
  const url = await storeFloorPlanSpec(spec);

  await db.order.update({
    where: { id: order.id },
    data: { notes: appendReportMarker(order.notes, url), status: 'FULFILLED' },
  });

  console.log(JSON.stringify({ event: 'floor_plan.report_generated', orderId: order.id }));

  return { ok: true, url };
}
