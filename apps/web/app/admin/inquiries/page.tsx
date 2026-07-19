import { db } from '@/lib/db';
import { format } from 'date-fns';
import InquiryReplyForm from './InquiryReplyForm';

export default async function AdminInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const statusFilter = status;

  const inquiries = await db.inquiry.findMany({
    where: statusFilter ? { status: statusFilter as never } : { status: { in: ['NEW', 'IN_PROGRESS'] } },
    orderBy: { createdAt: 'desc' },
    include: {
      replies: { orderBy: { createdAt: 'asc' } },
      user: { select: { name: true } },
    },
  });

  const counts = await db.inquiry.groupBy({ by: ['status'], _count: true });
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count]));

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1 className="portal-title">Inquiries</h1>
          <p className="portal-subtitle">Customer messages requiring responses</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[['', 'New + In Progress'], ['NEW', 'New'], ['IN_PROGRESS', 'In Progress'], ['RESOLVED', 'Resolved']].map(([val, label]) => (
          <a key={val} href={val ? `/admin/inquiries?status=${val}` : '/admin/inquiries'}
            className={`btn btn-sm ${statusFilter === val || (!statusFilter && !val) ? 'btn-copper' : 'btn-ghost'}`}>
            {label} ({val ? countMap[val] ?? 0 : (countMap['NEW'] ?? 0) + (countMap['IN_PROGRESS'] ?? 0)})
          </a>
        ))}
      </div>

      {inquiries.length === 0 ? (
        <div className="portal-card"><p className="portal-empty">No inquiries found. 🎉</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {inquiries.map((inq) => (
            <div key={inq.id} className="portal-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{inq.subject}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>
                    {inq.name} · <a href={`mailto:${inq.email}`}>{inq.email}</a>
                    {inq.phone && ` · ${inq.phone}`}
                    {' · '}{format(inq.createdAt, 'MMM d, yyyy')}
                  </div>
                </div>
                <span className={`portal-badge portal-badge-${inq.status === 'NEW' ? 'info' : inq.status === 'IN_PROGRESS' ? 'warning' : 'success'}`}>
                  {inq.status.replace('_', ' ')}
                </span>
              </div>

              {/* Thread */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="inquiry-message customer">
                  <div className="inquiry-message-meta">Customer · {format(inq.createdAt, 'MMM d, h:mm a')}</div>
                  <p style={{ margin: 0 }}>{inq.message}</p>
                </div>
                {inq.replies.map((r) => (
                  <div key={r.id} className={`inquiry-message ${r.fromAdmin ? 'admin' : 'customer'}`}>
                    <div className="inquiry-message-meta">
                      {r.fromAdmin ? '🌲 Ecowoods' : 'Customer'} · {format(r.createdAt, 'MMM d, h:mm a')}
                    </div>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{r.content}</p>
                  </div>
                ))}
              </div>

              {inq.status !== 'RESOLVED' && (
                <InquiryReplyForm inquiryId={inq.id} customerName={inq.name} subject={inq.subject ?? ''} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
