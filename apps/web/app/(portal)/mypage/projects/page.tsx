import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { format } from 'date-fns';

function formatCAD(amount: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
}

const statusColors: Record<string, string> = {
  DRAFT: 'neutral',
  CONTRACT_SENT: 'warning',
  SIGNED: 'info',
  DEPOSIT_PAID: 'info',
  IN_PROGRESS: 'active',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

const statusSteps = [
  'DRAFT',
  'CONTRACT_SENT',
  'SIGNED',
  'DEPOSIT_PAID',
  'IN_PROGRESS',
  'COMPLETED',
];

export default async function MyProjectsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const projects = await db.project.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      invoices: {
        where: { status: { not: 'DRAFT' } },  // hide DRAFT invoices from customers
        select: { id: true, number: true, status: true, total: true, stage: true, pdfUrl: true },
      },
    },
  });

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1 className="portal-title">My Projects</h1>
          <p className="portal-subtitle">{projects.length} project{projects.length !== 1 ? 's' : ''} on your account</p>
        </div>
        <Link href="/#quote" className="btn btn-copper btn-sm">
          Request a new quote
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="portal-empty-state">
          <p>No projects yet. Submit a quote request and our team will convert it to a project.</p>
          <Link href="/#quote" className="btn btn-copper btn-sm">Get a free estimate</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {projects.map((proj) => {
            const currentStep = statusSteps.indexOf(proj.status);
            const paidTotal = proj.invoices
              .filter((i) => i.status === 'PAID')
              .reduce((s, i) => s + i.total, 0);

            return (
              <div key={proj.id} className="portal-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                      {proj.title}
                    </h2>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                      {[proj.city, proj.province].filter(Boolean).join(', ')}
                      {proj.squareFeet ? ` · ${proj.squareFeet.toLocaleString()} sq ft` : ''}
                      {proj.contractValue ? ` · Contract: ${formatCAD(proj.contractValue)}` : ''}
                    </div>
                  </div>
                  <span className={`portal-badge portal-badge-${statusColors[proj.status] ?? 'neutral'}`}>
                    {proj.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Progress bar */}
                {proj.status !== 'CANCELLED' && (
                  <div style={{ margin: '1.25rem 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      {statusSteps.map((step, i) => (
                        <div
                          key={step}
                          style={{
                            flex: 1,
                            textAlign: 'center',
                            fontSize: '0.7rem',
                            color: i <= currentStep ? 'var(--copper-deep)' : 'var(--muted-soft)',
                            fontWeight: i === currentStep ? 700 : 400,
                          }}
                        >
                          {step.replace('_', ' ')}
                        </div>
                      ))}
                    </div>
                    <div style={{ height: 6, background: 'var(--cream-100)', borderRadius: 99, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${((currentStep + 1) / statusSteps.length) * 100}%`,
                          background: 'var(--copper)',
                          borderRadius: 99,
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                  {proj.startDate && (
                    <div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Start Date</div>
                      <div style={{ fontWeight: 600 }}>{format(proj.startDate, 'MMMM d, yyyy')}</div>
                    </div>
                  )}
                  {proj.endDate && (
                    <div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>End Date</div>
                      <div style={{ fontWeight: 600 }}>{format(proj.endDate, 'MMMM d, yyyy')}</div>
                    </div>
                  )}
                  {proj.contractValue && (
                    <div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Paid to Date</div>
                      <div style={{ fontWeight: 600, color: paidTotal > 0 ? 'var(--success)' : undefined }}>
                        {formatCAD(paidTotal)} / {formatCAD(proj.contractValue)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Contract PDFs */}
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {proj.contractPdfUrl && !proj.contractPdfUrl.startsWith('data:') && (
                    <a href={proj.contractPdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                      📄 Download Contract
                    </a>
                  )}
                  {proj.signedContractPdfUrl && !proj.signedContractPdfUrl.startsWith('data:') && (
                    <a href={proj.signedContractPdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                      ✅ Signed Contract
                    </a>
                  )}
                </div>

                {/* Invoices */}
                {proj.invoices.length > 0 && (
                  <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--line)', paddingTop: '1.25rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--muted)' }}>
                      INVOICES
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {proj.invoices.map((inv) => (
                        <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                            #{inv.number} — {inv.stage}
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700 }}>{formatCAD(inv.total)}</span>
                            <span className={`portal-badge portal-badge-${inv.status.toLowerCase()}`}>{inv.status}</span>
                            {(inv.status === 'SENT' || inv.status === 'OVERDUE') && (
                              <Link href={`/mypage/invoices/${inv.id}/pay`} className="btn btn-copper btn-sm" style={{ padding: '0.3rem 0.75rem' }}>
                                Pay
                              </Link>
                            )}
                            {inv.pdfUrl && !inv.pdfUrl.startsWith('data:') && (
                              <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ padding: '0.3rem 0.75rem' }}>
                                PDF
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
