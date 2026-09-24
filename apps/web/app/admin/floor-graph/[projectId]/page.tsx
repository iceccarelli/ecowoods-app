import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { db } from '@/lib/db';
import OutcomeForm from './OutcomeForm';

/**
 * /admin/floor-graph/[projectId] — close one job into the Floor Graph.
 *
 * Everything the business already knows is loaded here and handed to the form
 * pre-filled: the contract value becomes the selling price, the end date
 * becomes the completion date. What is left to type is what only the crew
 * knows — hours, grit sequence, coats, waste, defects — and every one of those
 * is optional, because a row with four fields filled beats a form nobody
 * finishes.
 *
 * The open price prediction is shown next to the field that will close it, so
 * the person recording the outcome can see, at the moment they type it, how
 * far the estimate was out. That is the whole feedback loop rendered on one
 * screen, and it is the reason this page is worth more than the API endpoint
 * behind it.
 */
export const dynamic = 'force-dynamic';

function cad(n: number | null) {
  if (n === null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n);
}

export default async function CloseJobPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      city: true,
      province: true,
      squareFeet: true,
      species: true,
      startDate: true,
      endDate: true,
      contractValue: true,
      status: true,
      user: { select: { name: true, email: true } },
    },
  });
  if (!project) notFound();

  /* The quote is where the price prediction was written, so it is found the
     same way the outcome endpoint finds it — through the project's own quote
     request, not by assuming the prediction carries a project id. */
  const quote = await db.quoteRequest.findFirst({
    where: { projectId },
    select: { id: true, quotedAmount: true, service: true },
  });

  const openPrediction = await db.prediction.findFirst({
    where: {
      kind: 'PRICE_CAD',
      closedAt: null,
      OR: [{ projectId }, ...(quote ? [{ quoteRequestId: quote.id }] : [])],
    },
    orderBy: { predictedAt: 'desc' },
    select: { id: true, model: true, predictedValue: true, predictedAt: true },
  });

  const existing = await db.jobOutcome.findFirst({
    where: { projectId },
    select: { id: true, createdAt: true },
  });

  /* OWN-01 read-back — a passport already started for this project is shown,
     never silently re-offered as if none existed. See docs/FLOOR_GRAPH.md. */
  const floorRecord = await db.floorRecord.findFirst({
    where: { originProjectId: projectId },
    select: { id: true, publicRef: true, createdAt: true },
  });

  const contractValue = project.contractValue === null ? null : Number(project.contractValue);
  const predicted = openPrediction ? Number(openPrediction.predictedValue) : null;

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1 className="portal-title">{project.title}</h1>
          <p className="portal-subtitle">
            {project.city ?? 'Location not recorded'}
            {project.squareFeet ? ` · ${project.squareFeet} sq ft` : ''}
            {project.user?.name ? ` · ${project.user.name}` : ''}
          </p>
        </div>
        <Link href="/admin/floor-graph" className="btn btn-ghost btn-sm">
          Back to Floor Graph
        </Link>
      </div>

      {existing && (
        <div className="portal-card">
          <p>
            An outcome was already recorded for this project on{' '}
            {format(existing.createdAt, 'd MMMM yyyy')}. Recording a second one is allowed — jobs get
            revisited — but it will not close a prediction that is already closed.
          </p>
        </div>
      )}

      <div className="portal-card">
        <div className="portal-card-header">
            <h2>What was predicted</h2>
          </div>
        {openPrediction ? (
          <p>
            <strong>{cad(predicted)}</strong> by <code>{openPrediction.model}</code> on{' '}
            {format(openPrediction.predictedAt, 'd MMMM yyyy')}. Entering the selling price below
            closes it and computes the error.
          </p>
        ) : (
          <p>
            No open price prediction for this project. That is expected for anything estimated before
            the ledger existed — the outcome is still worth recording, it simply has nothing to close
            against.
          </p>
        )}
        {contractValue !== null && predicted !== null && (
          <p className="portal-subtitle">
            Contract value on file is {cad(contractValue)}, which is{' '}
            {cad(contractValue - predicted)} against the prediction.
          </p>
        )}
      </div>

      <div className="portal-card">
        <div className="portal-card-header">
          <h2>Floor Passport</h2>
        </div>
        {floorRecord ? (
          <p>
            This floor already has a passport: <strong>{floorRecord.publicRef}</strong>, started{' '}
            {format(floorRecord.createdAt, 'd MMMM yyyy')}. Recording another outcome below will attach
            to it, not start a second one.
          </p>
        ) : (
          <p>
            No passport yet. Check &ldquo;Save this floor to the Floor Passport&rdquo; below to start one from
            what is already on file for this project — nothing is guessed.
          </p>
        )}
      </div>

      <OutcomeForm
        projectId={project.id}
        defaultService={quote?.service ?? null}
        defaultCompletedOn={project.endDate ? format(project.endDate, 'yyyy-MM-dd') : null}
        defaultSellingPriceCad={contractValue}
        hasFloorRecord={Boolean(floorRecord)}
      />
    </div>
  );
}
