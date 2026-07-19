import Link from 'next/link';
import { db } from '@/lib/db';
import { format } from 'date-fns';
import type { QuoteStatus } from '@prisma/client';

const STATUS_ORDER: QuoteStatus[] = ['PENDING', 'QUOTED', 'ACCEPTED', 'REJECTED'];
const statusColor: Record<QuoteStatus, string> = {
  PENDING: 'info',
  QUOTED: 'warning',
  ACCEPTED: 'success',
  REJECTED: 'neutral',
};

export default async function AdminQuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const statusFilter = status as QuoteStatus | undefined;
  const searchQuery = q;

  const quotes = await db.quoteRequest.findMany({
    where: {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(searchQuery
        ? {
            OR: [
              { name: { contains: searchQuery, mode: 'insensitive' } },
              { email: { contains: searchQuery, mode: 'insensitive' } },
              { city: { contains: searchQuery, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true } } },
  });

  // Count by status for filter tabs
  const counts = await db.quoteRequest.groupBy({
    by: ['status'],
    _count: true,
  });
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count]));

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1 className="portal-title">Quotes &amp; Leads</h1>
          <p className="portal-subtitle">{quotes.length} result{quotes.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <Link
          href="/admin/quotes"
          className={`btn btn-sm ${!statusFilter ? 'btn-copper' : 'btn-ghost'}`}
        >
          All ({quotes.length})
        </Link>
        {STATUS_ORDER.map((s) => (
          <Link
            key={s}
            href={`/admin/quotes?status=${s}`}
            className={`btn btn-sm ${statusFilter === s ? 'btn-copper' : 'btn-ghost'}`}
          >
            {s} ({countMap[s] ?? 0})
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="portal-card">
        <table className="portal-table">
          <thead>
            <tr>
              <th>Name / Contact</th>
              <th>Location</th>
              <th>Service</th>
              <th>Sq Ft</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {quotes.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>
                  No quotes found.
                </td>
              </tr>
            )}
            {quotes.map((q) => (
              <tr key={q.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{q.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{q.email}</div>
                  {q.phone && <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{q.phone}</div>}
                </td>
                <td>{q.city}, {q.province}</td>
                <td style={{ fontSize: '0.88rem' }}>{q.service ?? '—'}</td>
                <td>{q.squareFeet?.toLocaleString() ?? '—'}</td>
                <td>
                  <span className={`portal-badge portal-badge-${statusColor[q.status]}`}>
                    {q.status}
                  </span>
                </td>
                <td style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>
                  {format(q.createdAt, 'MMM d, yyyy')}
                </td>
                <td>
                  <Link href={`/admin/quotes/${q.id}`} className="btn btn-ghost btn-sm">
                    Review →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
