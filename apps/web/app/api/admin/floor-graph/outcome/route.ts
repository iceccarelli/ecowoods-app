import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { closePrediction } from '@/lib/floor-graph/prediction';

/**
 * POST /api/admin/floor-graph/outcome — close a job into the Floor Graph.
 *
 * This is the write that makes every other part of the system worth building,
 * and it is also the one nobody will do unless it takes under a minute. So the
 * payload is deliberately small and almost entirely optional: a project id and
 * whatever of the execution record is actually known. A row with three fields
 * filled is worth more than a form nobody completes.
 *
 * WHAT IT DOES BEYOND STORING THE ROW
 *
 * It closes the open PRICE_CAD prediction for that project against what the
 * job actually sold for. That single arithmetic step is the flywheel's return
 * path: without it the ledger fills with predictions nobody ever scores, which
 * is the exact failure this whole exercise exists to prevent.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 * It does not infer. `labourHours` left out stays null; it is not derived from
 * schedule days, and `materialSqFt` is not derived from the quote. A derived
 * value written into a measurement column is indistinguishable from a
 * measurement six months later, and the dataset stops being trainable.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const numeric = z.number().nonnegative().optional();

const outcomeSchema = z.object({
  projectId: z.string().uuid(),
  floorRecordId: z.string().uuid().optional(),
  service: z.string().max(80).optional(),
  completedOn: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),

  labourHours: numeric,
  machineHours: numeric,
  crewSize: z.number().int().positive().max(50).optional(),
  gritSequence: z.string().max(120).optional(),
  finishCoats: z.number().int().nonnegative().max(20).optional(),
  cureHours: numeric,

  materialSqFt: numeric,
  wastePct: numeric,
  finishLitres: numeric,

  materialCostCad: numeric,
  labourCostCad: numeric,
  sellingPriceCad: numeric,

  scheduleDays: z.number().int().nonnegative().max(400).optional(),
  defects: z.array(z.object({ kind: z.string().max(80), note: z.string().max(400).optional() })).optional(),
  notes: z.string().max(4000).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send JSON.' }, { status: 400 });
  }

  const parsed = outcomeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })) },
      { status: 400 },
    );
  }

  const d = parsed.data;
  const completedOn = d.completedOn ? new Date(d.completedOn) : null;

  const outcome = await db.jobOutcome.create({
    data: {
      projectId: d.projectId,
      floorRecordId: d.floorRecordId ?? null,
      service: d.service ?? null,
      completedOn,
      labourHours: d.labourHours ?? null,
      machineHours: d.machineHours ?? null,
      crewSize: d.crewSize ?? null,
      gritSequence: d.gritSequence ?? null,
      finishCoats: d.finishCoats ?? null,
      cureHours: d.cureHours ?? null,
      materialSqFt: d.materialSqFt ?? null,
      wastePct: d.wastePct ?? null,
      finishLitres: d.finishLitres ?? null,
      materialCostCad: d.materialCostCad ?? null,
      labourCostCad: d.labourCostCad ?? null,
      sellingPriceCad: d.sellingPriceCad ?? null,
      scheduleDays: d.scheduleDays ?? null,
      defects: d.defects ? (d.defects as object) : undefined,
      notes: d.notes ?? null,
    },
    select: { id: true },
  });

  /* Close the ledger. The quote that became this project is where the price
     prediction was written, so the lookup goes through the project's own quote
     request rather than assuming the prediction carries a project id. */
  const closed: string[] = [];
  if (d.sellingPriceCad !== undefined) {
    const quote = await db.quoteRequest.findFirst({
      where: { projectId: d.projectId },
      select: { id: true },
    });
    const open = await db.prediction.findMany({
      where: {
        kind: 'PRICE_CAD',
        closedAt: null,
        OR: [{ projectId: d.projectId }, ...(quote ? [{ quoteRequestId: quote.id }] : [])],
      },
      select: { id: true },
    });
    for (const p of open) {
      const result = await closePrediction(p.id, d.sellingPriceCad, outcome.id);
      if (result.ok) closed.push(p.id);
    }
  }

  /* Schedule days is a second prediction only where one was recorded; nothing
     is invented to have something to close. */
  if (d.scheduleDays !== undefined) {
    const open = await db.prediction.findMany({
      where: { kind: 'SCHEDULE_DAYS', closedAt: null, projectId: d.projectId },
      select: { id: true },
    });
    for (const p of open) {
      const result = await closePrediction(p.id, d.scheduleDays, outcome.id);
      if (result.ok) closed.push(p.id);
    }
  }

  return NextResponse.json({ outcomeId: outcome.id, predictionsClosed: closed.length }, { status: 201 });
}

export async function GET() {
  return NextResponse.json(
    { error: 'Use POST with a projectId and whatever of the execution record is known.' },
    { status: 405 },
  );
}
