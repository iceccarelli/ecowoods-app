/**
 * lib/floor-plan/generate.ts — the one side-effecting step this product
 * needs: decode the paid design, build the spec, render + store the PDF,
 * and mark the order fulfilled. No admin step exists for EW-0004 — every
 * input is either the catalogue or the customer's own already-paid-for
 * configuration, so there is no expert judgment call for a human to make
 * (unlike EW-0002/EW-0003, where a human reads someone else's document).
 *
 * Called from the [id] page itself and from /api/floor-plan/report the first
 * time either runs for a PAID order with no report yet. The URL is persisted
 * with a compare-and-swap on the exact notes text, so of any number of
 * concurrent first views exactly one write lands; the losers discard their
 * (wasted) PDF and return the URL that did land. Every reader therefore ends
 * up with the same stored report. No lease or extra column is needed: the
 * only side effect before the write is rendering a PDF, and an extra blob is
 * the whole cost of a lost race.
 */

import { db } from '@/lib/db';
import { decodeStudioDesign } from '@/lib/floor-studio/studio-config';
import { buildFloorPlanSpec } from './spec';
import { storeFloorPlanSpec } from './store';
import { appendReportMarker, extractDesignCode, extractReportUrl, isFloorPlanOrder } from './notes';

export type GenerateResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'not_found' | 'not_paid' | 'bad_design' | 'storage_failed' };

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
  let url: string;
  try {
    url = await storeFloorPlanSpec(spec);
  } catch (err) {
    console.error(JSON.stringify({ event: 'floor_plan.store_failed', orderId: order.id, error: err instanceof Error ? err.message : 'unknown' }));
    return { ok: false, reason: 'storage_failed' };
  }

  const won = await db.order.updateMany({
    where: { id: order.id, notes: order.notes },
    data: { notes: appendReportMarker(order.notes, url), status: 'FULFILLED' },
  });
  if (won.count !== 1) {
    // Another request persisted a report (or touched the row) first: serve what is stored.
    const latest = await db.order.findUnique({ where: { id: order.id } });
    const stored = latest ? extractReportUrl(latest.notes) : null;
    if (stored) return { ok: true, url: stored };
    console.error(JSON.stringify({ event: 'floor_plan.report_not_persisted', orderId: order.id, orphanUrl: url }));
    return { ok: false, reason: 'storage_failed' };
  }

  console.log(JSON.stringify({ event: 'floor_plan.report_generated', orderId: order.id }));

  return { ok: true, url };
}
