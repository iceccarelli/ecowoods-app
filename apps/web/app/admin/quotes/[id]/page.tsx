import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { format } from 'date-fns';
import EstimateBuilder from './EstimateBuilder';
import ConvertToProjectForm from './ConvertToProjectForm';

export default async function AdminQuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = await db.quoteRequest.findUnique({
    where: { id },
    include: {
      user: true,
      project: { select: { id: true, title: true, status: true } },
    },
  });
  if (!quote) notFound();

  const customers = await db.user.findMany({
    where: { role: 'USER' },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });

  const settings = await db.settings.findFirst();

  // Determine current step
  const step =
    quote.status === 'ACCEPTED' ? 4 :
    quote.quotePdfUrl           ? 3 :
    quote.quotedAmount          ? 2 : 1;

  const stepLabels = [
    { n: 1, label: 'Review Request',    desc: 'Review the customer\'s request and gather details' },
    { n: 2, label: 'Build Estimate',    desc: 'Enter line items and pricing for the formal estimate (견적서)' },
    { n: 3, label: 'Send Estimate',     desc: 'Generate PDF and email to customer for approval' },
    { n: 4, label: 'Convert to Project',desc: 'Customer approved — create project and contract' },
  ];

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1 className="portal-title">{quote.name}</h1>
          <p className="portal-subtitle">
            Submitted {format(quote.createdAt, 'MMMM d, yyyy, h:mm a')}
          </p>
        </div>
        <Link href="/admin/quotes" className="btn btn-ghost btn-sm">← All Quotes</Link>
      </div>

      {/* ── Step progress indicator ── */}
      {quote.status !== 'REJECTED' && (
        <div className="quote-steps">
          {stepLabels.map((s) => (
            <div key={s.n} className={`quote-step ${step >= s.n ? 'active' : ''} ${step === s.n ? 'current' : ''}`}>
              <div className="quote-step-num">{step > s.n ? '✓' : s.n}</div>
              <div>
                <div className="quote-step-label">{s.label}</div>
                <div className="quote-step-desc">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="portal-grid-2" style={{ alignItems: 'start' }}>
        {/* ── Left: Customer request details ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="portal-card">
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem' }}>
              Customer Request
            </h2>
            <dl className="detail-list">
              <div className="detail-row"><dt>Name</dt><dd>{quote.name}</dd></div>
              <div className="detail-row">
                <dt>Email</dt>
                <dd><a href={`mailto:${quote.email}`}>{quote.email}</a></dd>
              </div>
              {quote.phone && (
                <div className="detail-row">
                  <dt>Phone</dt>
                  <dd><a href={`tel:${quote.phone}`}>{quote.phone}</a></dd>
                </div>
              )}
              <div className="detail-row">
                <dt>Location</dt>
                <dd>{[quote.city, quote.province].filter(Boolean).join(', ')}</dd>
              </div>
              {quote.address && <div className="detail-row"><dt>Address</dt><dd>{quote.address}</dd></div>}
              {quote.service && <div className="detail-row"><dt>Service</dt><dd>{quote.service}</dd></div>}
              {quote.projectType && <div className="detail-row"><dt>Type</dt><dd>{quote.projectType.replace('_', ' ')}</dd></div>}
              {Array.isArray(quote.species) && (quote.species as string[]).length > 0 && <div className="detail-row"><dt>Species</dt><dd>{(quote.species as string[]).join(', ')}</dd></div>}
              {quote.squareFeet && <div className="detail-row"><dt>Sq Ft</dt><dd>{quote.squareFeet.toLocaleString()} sq ft</dd></div>}
              {quote.timeline && <div className="detail-row"><dt>Timeline</dt><dd>{quote.timeline.replace(/_/g, ' ')}</dd></div>}
              {quote.budgetRange && <div className="detail-row"><dt>Budget</dt><dd>{quote.budgetRange}</dd></div>}
              {quote.notes && (
                <div className="detail-row detail-row-full">
                  <dt>Notes</dt>
                  <dd style={{ whiteSpace: 'pre-wrap' }}>{quote.notes}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Linked customer */}
          {quote.user ? (
            <div className="portal-card">
              <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>Linked Customer</h2>
              <div style={{ fontWeight: 600 }}>{quote.user.name}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{quote.user.email}</div>
            </div>
          ) : (
            <div className="portal-card" style={{ borderColor: 'var(--warning)', borderWidth: 1.5 }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>⚠ No Account Linked</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                Submitted without login. Account at <strong>{quote.email}</strong> will auto-link on registration.
                You can still create a project by selecting an existing customer below.
              </p>
            </div>
          )}
        </div>

        {/* ── Right: Action panel (changes by step) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* STEP 2–3: Estimate builder */}
          {quote.status !== 'ACCEPTED' && quote.status !== 'REJECTED' && (
            <EstimateBuilder
              quoteId={quote.id}
              existingLineItems={quote.quoteLineItems as never}
              existingAmount={quote.quotedAmount !== null ? Number(quote.quotedAmount) : null}
              existingTaxRate={Number(quote.quoteTaxRate ?? settings?.defaultTaxRate ?? 13)}
              existingNotes={quote.quoteNotes ?? ''}
              quotePdfUrl={quote.quotePdfUrl}
              quoteIssuedAt={quote.quoteIssuedAt}
              step={step}
            />
          )}

          {/* STEP 4: Already converted */}
          {quote.project ? (
            <div className="portal-card" style={{ background: 'rgba(74,124,89,0.07)', border: '1px solid rgba(74,124,89,0.3)' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                ✅ Converted to Project
              </h2>
              <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{quote.project.title}</div>
              <span className="portal-badge portal-badge-active" style={{ marginBottom: '0.75rem', display: 'inline-block' }}>
                {quote.project.status.replace('_', ' ')}
              </span>
              <br />
              <Link href={`/admin/projects/${quote.project.id}`} className="btn btn-copper btn-sm">
                Manage Project →
              </Link>
            </div>
          ) : quote.quotePdfUrl && quote.status !== 'REJECTED' ? (
            /* Estimate sent — ready to convert */
            <ConvertToProjectForm
              quoteId={quote.id}
              customers={customers}
              defaultTitle={`${quote.service ?? 'Project'} — ${quote.name}`}
              defaultUserId={quote.userId ?? ''}
              quotedAmount={quote.quotedAmount !== null ? Number(quote.quotedAmount) : null}
              defaultTaxRate={Number(quote.quoteTaxRate ?? settings?.defaultTaxRate ?? 13)}
              defaultDepositPct={Number(settings?.defaultDepositPct ?? 30)}
              defaultMidpointPct={Number(settings?.defaultMidpointPct ?? 40)}
              defaultFinalPct={Number(settings?.defaultFinalPct ?? 30)}
            />
          ) : null}

          {/* Close quote option */}
          {quote.status !== 'ACCEPTED' && quote.status !== 'REJECTED' && (
            <form action={async () => {
              'use server';
              const { updateQuoteStatus } = await import('@/lib/actions/quotes');
              await updateQuoteStatus(quote.id, 'REJECTED');
            }}>
              <button type="submit" className="btn btn-ghost btn-sm" style={{ opacity: 0.6 }}>
                Close / Archive this quote
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
