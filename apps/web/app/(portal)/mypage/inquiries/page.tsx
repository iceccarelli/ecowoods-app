import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { format } from 'date-fns';
import NewInquiryForm from './NewInquiryForm';

export default async function MyInquiriesPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const inquiries = await db.inquiry.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      replies: { orderBy: { createdAt: 'asc' } },
    },
  });

  const statusColor: Record<string, string> = {
    OPEN: 'info',
    IN_PROGRESS: 'warning',
    RESOLVED: 'success',
  };

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1 className="portal-title">Inquiries</h1>
          <p className="portal-subtitle">Your messages with the Ecowoods team</p>
        </div>
      </div>

      {/* New inquiry form */}
      <div className="portal-card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Send a New Message</h2>
        <NewInquiryForm />
      </div>

      {/* Existing inquiries */}
      {inquiries.length === 0 ? (
        <div className="portal-empty-state">
          <p>No messages yet. Use the form above to get in touch with our team.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {inquiries.map((inq) => (
            <div key={inq.id} className="portal-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{inq.subject}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                    Submitted {format(inq.createdAt, 'MMMM d, yyyy')}
                  </div>
                </div>
                <span className={`portal-badge portal-badge-${statusColor[inq.status] ?? 'neutral'}`}>
                  {inq.status.replace('_', ' ')}
                </span>
              </div>

              {/* Conversation thread */}
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Original message */}
                <div className="inquiry-message customer">
                  <div className="inquiry-message-meta">You · {format(inq.createdAt, 'MMM d, h:mm a')}</div>
                  <p>{inq.message}</p>
                </div>

                {/* Replies */}
                {inq.replies.map((reply) => (
                  <div
                    key={reply.id}
                    className={`inquiry-message ${reply.fromAdmin ? 'admin' : 'customer'}`}
                  >
                    <div className="inquiry-message-meta">
                      {reply.fromAdmin ? '🌲 Ecowoods' : 'You'} · {format(reply.createdAt, 'MMM d, h:mm a')}
                    </div>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{reply.content}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
