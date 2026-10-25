/**
 * lib/lead-acquisition.ts — the database side of lib/acquisition.ts.
 *
 * Every function here catches its own failure and degrades to "not captured".
 * That is the contract that lets the application be deployed before or after
 * the LeadAcquisition migration with no effect on leads: a missing table makes
 * a write log a warning and a read return nothing, never throw into a lead
 * request or an admin page. See the model's comment in schema.prisma.
 */
import { db } from '@/lib/db';
import { isAcquisitionChannel, type Acquisition } from '@/lib/acquisition';

/** Store a lead's first touch. Idempotent per quote; never throws. */
export async function recordLeadAcquisition(quoteId: string, acquisition: Acquisition | null): Promise<void> {
  if (!acquisition) return;
  try {
    await db.leadAcquisition.upsert({
      where: { quoteId },
      create: { quoteId, channel: acquisition.channel, landing: acquisition.landing },
      update: {}, // first touch wins; a repeated submission never rewrites it
    });
  } catch (err) {
    console.warn(JSON.stringify({
      event: 'lead.acquisition_not_recorded',
      quoteId,
      error: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
      hint: 'The lead itself is saved. If this repeats, check that migration 20261025120000_add_lead_acquisition has been applied.',
    }));
  }
}

/** One lead's first touch for the admin screen; null when none was captured or the table is not there yet. */
export async function acquisitionForQuote(quoteId: string): Promise<Acquisition | null> {
  try {
    const row = await db.leadAcquisition.findUnique({ where: { quoteId } });
    return row && isAcquisitionChannel(row.channel) ? { channel: row.channel, landing: row.landing } : null;
  } catch {
    return null;
  }
}

/**
 * Channel slugs for a set of leads, for the funnel report. `available: false`
 * means the table could not be read at all (migration not applied), which the
 * report says plainly instead of presenting every lead as "not captured".
 */
export async function acquisitionByQuote(quoteIds: string[]): Promise<{ available: boolean; byQuote: Map<string, string> }> {
  const byQuote = new Map<string, string>();
  if (quoteIds.length === 0) return { available: true, byQuote };
  try {
    const rows = await db.leadAcquisition.findMany({ where: { quoteId: { in: quoteIds } }, select: { quoteId: true, channel: true } });
    for (const r of rows) byQuote.set(r.quoteId, r.channel);
    return { available: true, byQuote };
  } catch {
    return { available: false, byQuote };
  }
}
