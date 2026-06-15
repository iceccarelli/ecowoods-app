import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { format } from 'date-fns';

export default async function MyQuotesPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const quotes = await db.quoteRequest.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: { project: { select: { id: true, title: true, status: true } } },
  });

  const statusColor: Record<string, string> = {
    PENDING: 'info',
    QUOTED: 'active',
    ACCEPTED: 'success',
    REJECTED: 'neutral',
  };

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1 className="portal-title">My Quote Requests</h1>
          <p className="portal-subtitle">{quotes.length} request{quotes.length !== 1 ? 's' : ''} submitted</p>
        </div>
        <Link href="/#quote" className="btn btn-copper btn-sm">
          + New Request
        </Link>
      </div>

      {quotes.length === 0 ? (
        <div className="portal-empty-state">
          <p>You haven&apos;t submitted any quote requests yet.</p>
          <Link href="/#quote" className="btn btn-copper btn-sm">Get a free estimate</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {quotes.map((q) => (
            <div key={q.id} className="portal-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>
                    {q.service
                      ? q.service.charAt(0).toUpperCase() + q.service.slice(1)
                      : 'Quote Request'}
                    {q.city ? ` — ${q.city}, ${q.province}` : ''}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                    Submitted {format(q.createdAt, 'MMMM d, yyyy')}
                    {q.squareFeet ? ` · ${q.squareFeet.toLocaleString()} sq ft` : ''}
                    {Array.isArray(q.species) && (q.species as string[]).length > 0 ? ` · ${(q.species as string[]).join(', ')}` : ''}
                  </div>
                </div>
                <span className={`portal-badge portal-badge-${statusColor[q.status] ?? 'neutral'}`}>
                  {q.status}
                </span>
              </div>

              {q.notes && (
                <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginTop: '0.75rem', fontStyle: 'italic' }}>
                  &ldquo;{q.notes.slice(0, 160)}{q.notes.length > 160 ? '…' : ''}&rdquo;
                </p>
              )}

              {/* Estimate (견적서) PDF — hide data: URLs (legacy, shouldn't reach customers) */}
              {(q as { quotePdfUrl?: string | null }).quotePdfUrl &&
               !(q as { quotePdfUrl: string }).quotePdfUrl.startsWith('data:') && (
                <div style={{ marginTop: '0.75rem', padding: '0.875rem 1rem', background: 'rgba(200,126,79,0.07)', border: '1px solid rgba(200,126,79,0.25)', borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>📋 Estimate Ready</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                      Your formal estimate (견적서) is available.
                      {q.quotedAmount && (
                        <> Total: <strong>
                          {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(
                            Number(q.quotedAmount) * (1 + Number(q.quoteTaxRate ?? 13) / 100)
                          )} CAD
                        </strong></>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Link href={`/docs/quote/${q.id}`} className="btn btn-copper btn-sm">
                      View Estimate
                    </Link>
                    <a href={(q as { quotePdfUrl: string }).quotePdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                      Download PDF
                    </a>
                  </div>
                </div>
              )}

              {q.project && (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--cream-100)', borderRadius: 'var(--radius)', fontSize: '0.88rem' }}>
                  ✅ Converted to project:{' '}
                  <Link href="/mypage/projects" style={{ fontWeight: 700, color: 'var(--copper-deep)' }}>
                    {q.project.title}
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
