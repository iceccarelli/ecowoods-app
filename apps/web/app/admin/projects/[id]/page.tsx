import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { format } from 'date-fns';
import ProjectStatusForm from './ProjectStatusForm';
import InvoiceIssueForm from './InvoiceIssueForm';
import GenerateInvoicesButton from './GenerateInvoicesButton';
import GenerateContractButton from './GenerateContractButton';

function formatCAD(n: number | { toNumber(): number } | null | undefined) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(
    typeof n === 'number' ? n : n.toNumber()
  );
}

export default async function AdminProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    include: {
      user: true,
      invoices: {
        orderBy: { createdAt: 'asc' },
        include: { payments: { orderBy: { createdAt: 'desc' } } },
      },
      notes: { orderBy: { createdAt: 'asc' } },
      quoteRequest: { select: { id: true, name: true, status: true } },
    },
  });

  if (!project) notFound();

  const totalPaid = project.invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + Number(i.total), 0);
  const totalOutstanding = project.invoices.filter((i) => i.status === 'SENT' || i.status === 'OVERDUE').reduce((s, i) => s + Number(i.total), 0);
  const hasGeneratedInvoices = project.invoices.length > 0;

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1 className="portal-title" style={{ fontSize: '1.25rem' }}>{project.title}</h1>
          <p className="portal-subtitle">
            {project.user.name} · {project.city}, {project.province}
            {project.contractValue ? ` · ${formatCAD(project.contractValue)}` : ''}
          </p>
        </div>
        <Link href="/admin/projects" className="btn btn-ghost btn-sm">← Projects</Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left: main content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Project details */}
          <div className="portal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Project Details</h2>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <GenerateContractButton projectId={project.id} contractPdfUrl={project.contractPdfUrl} />
                {project.signedContractPdfUrl && (
                  <a href={project.signedContractPdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                    ✅ Signed Contract
                  </a>
                )}
              </div>
            </div>

            <dl className="detail-list">
              <div className="detail-row"><dt>Customer</dt><dd>{project.user.name} ({project.user.email})</dd></div>
              <div className="detail-row"><dt>Address</dt><dd>{[project.address, project.city, project.province].filter(Boolean).join(', ')}</dd></div>
              {Array.isArray(project.species) && (project.species as string[]).length > 0 && (
                <div className="detail-row"><dt>Species</dt><dd>{(project.species as string[]).join(', ')}</dd></div>
              )}
              {project.squareFeet && (
                <div className="detail-row"><dt>Square Footage</dt><dd>{project.squareFeet.toLocaleString()} sq ft</dd></div>
              )}
              <div className="detail-row"><dt>Contract Value</dt><dd>{formatCAD(project.contractValue)}</dd></div>
              <div className="detail-row"><dt>Tax Rate</dt><dd>{Number(project.taxRate)}%</dd></div>
              <div className="detail-row">
                <dt>Invoice Schedule</dt>
                <dd>Deposit {Number(project.depositPct)}% / Midpoint {Number(project.midpointPct)}% / Final {Number(project.finalPct)}%</dd>
              </div>
              {project.startDate && (
                <div className="detail-row"><dt>Start</dt><dd>{format(project.startDate, 'MMMM d, yyyy')}</dd></div>
              )}
              {project.endDate && (
                <div className="detail-row"><dt>End</dt><dd>{format(project.endDate, 'MMMM d, yyyy')}</dd></div>
              )}
              {project.description && (
                <div className="detail-row detail-row-full"><dt>Description</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{project.description}</dd></div>
              )}
            </dl>
          </div>

          {/* Invoices */}
          <div className="portal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Invoices (인보이스)</h2>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {/* Invoices can only be generated AFTER the contract is signed */}
                {!hasGeneratedInvoices && project.contractValue && (
                  project.status === 'SIGNED' || project.status === 'DEPOSIT_PAID' ||
                  project.status === 'IN_PROGRESS' || project.status === 'COMPLETED' ? (
                    <GenerateInvoicesButton projectId={project.id} />
                  ) : (
                    <span style={{ fontSize: '0.82rem', color: 'var(--muted)', padding: '0.4rem 0.75rem', background: 'var(--cream-100)', borderRadius: 'var(--radius)', border: '1px solid var(--line)' }}>
                      🔒 Sign contract first to generate invoices
                    </span>
                  )
                )}
                {(project.status === 'SIGNED' || project.status === 'DEPOSIT_PAID' ||
                  project.status === 'IN_PROGRESS' || project.status === 'COMPLETED') && (
                  <Link href={`/admin/invoices/new?projectId=${project.id}`} className="btn btn-ghost btn-sm">
                    + Custom Invoice
                  </Link>
                )}
              </div>
            </div>

            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--cream-100)', borderRadius: 'var(--radius)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Total Contract</div>
                <div style={{ fontWeight: 700 }}>{formatCAD(project.contractValue)}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '0.75rem', background: 'rgba(74,124,89,0.08)', borderRadius: 'var(--radius)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Paid</div>
                <div style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCAD(totalPaid)}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '0.75rem', background: 'rgba(212,164,68,0.1)', borderRadius: 'var(--radius)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Outstanding</div>
                <div style={{ fontWeight: 700, color: 'var(--warning)' }}>{formatCAD(totalOutstanding)}</div>
              </div>
            </div>

            {project.invoices.length === 0 ? (
              <p className="portal-empty">No invoices yet. Generate staged invoices or create a custom one.</p>
            ) : (
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Stage</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Due</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {project.invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 600 }}>#{inv.number}</td>
                      <td>{inv.stage}</td>
                      <td style={{ fontWeight: 700 }}>{formatCAD(inv.total)}</td>
                      <td>
                        <span className={`portal-badge portal-badge-${inv.status.toLowerCase()}`}>
                          {inv.status}
                        </span>
                        {inv.payments.some((p) => p.method === 'BANK_TRANSFER' && p.status === 'PENDING') && (
                          <span className="portal-badge portal-badge-warning" style={{ marginLeft: '0.25rem' }}>
                            Bank pending
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                        {inv.dueDate ? format(inv.dueDate, 'MMM d') : '—'}
                      </td>
                      <td>
                        <InvoiceIssueForm invoice={inv} projectId={project.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Notes */}
          {project.notes.length > 0 && (
            <div className="portal-card">
              <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Internal Notes</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {project.notes.map((note) => (
                  <div key={note.id} style={{ padding: '0.75rem', background: 'var(--cream-100)', borderRadius: 'var(--radius)', fontSize: '0.9rem' }}>
                    <p style={{ margin: 0 }}>{note.content}</p>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
                      {format(note.createdAt, 'MMM d, yyyy h:mm a')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: status management */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '1.5rem' }}>
          <ProjectStatusForm project={project} />
        </div>
      </div>
    </div>
  );
}
