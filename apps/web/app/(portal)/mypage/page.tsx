import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatDistanceToNow } from 'date-fns';

function formatCAD(amount: number | { toNumber(): number } | null | undefined) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(
    typeof amount === 'number' ? amount : amount.toNumber()
  );
}

export default async function MyPageDashboard() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const userId = session.user.id;

  // Fetch all summary data in parallel
  const [quotes, projects, invoices, inquiries] = await Promise.all([
    db.quoteRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),
    db.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { invoices: { select: { status: true, total: true } } },
    }),
    db.invoice.findMany({
      where: { project: { userId } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { project: { select: { title: true } } },
    }),
    db.inquiry.count({ where: { userId, status: { not: 'RESOLVED' } } }),
  ]);

  const totalOwed = invoices
    .filter((i) => i.status === 'SENT' || i.status === 'OVERDUE')
    .reduce((sum, i) => sum + Number(i.total), 0);

  const activeProjects = projects.filter(
    (p) => p.status !== 'COMPLETED' && p.status !== 'CANCELLED'
  ).length;

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1 className="portal-title">
            Welcome back, {session.user.name?.split(' ')[0] ?? 'there'} 👋
          </h1>
          <p className="portal-subtitle">Here&apos;s an overview of your Ecowoods account.</p>
        </div>
        <Link href="/mypage/quotes" className="btn btn-copper btn-sm">
          + New Quote Request
        </Link>
      </div>

      {/* Summary cards */}
      <div className="portal-stats">
        <div className="portal-stat-card">
          <div className="portal-stat-label">Active Projects</div>
          <div className="portal-stat-value">{activeProjects}</div>
          <Link href="/mypage/projects" className="portal-stat-link">View projects →</Link>
        </div>
        <div className="portal-stat-card">
          <div className="portal-stat-label">Outstanding Balance</div>
          <div className="portal-stat-value" style={{ color: totalOwed > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {formatCAD(totalOwed)}
          </div>
          <Link href="/mypage/invoices" className="portal-stat-link">View invoices →</Link>
        </div>
        <div className="portal-stat-card">
          <div className="portal-stat-label">Open Inquiries</div>
          <div className="portal-stat-value">{inquiries}</div>
          <Link href="/mypage/inquiries" className="portal-stat-link">View inquiries →</Link>
        </div>
        <div className="portal-stat-card">
          <div className="portal-stat-label">Quote Requests</div>
          <div className="portal-stat-value">{quotes.length}</div>
          <Link href="/mypage/quotes" className="portal-stat-link">View all →</Link>
        </div>
      </div>

      <div className="portal-grid-2">
        {/* Recent invoices */}
        <div className="portal-card">
          <div className="portal-card-header">
            <h2>Recent Invoices</h2>
            <Link href="/mypage/invoices" className="portal-card-link">See all</Link>
          </div>
          {invoices.length === 0 ? (
            <p className="portal-empty">No invoices yet.</p>
          ) : (
            <div className="portal-list">
              {invoices.map((inv) => (
                <div key={inv.id} className="portal-list-item">
                  <div>
                    <div style={{ fontWeight: 600 }}>#{inv.number}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>{inv.project.title}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>{formatCAD(inv.total)}</div>
                    <span className={`portal-badge portal-badge-${inv.status.toLowerCase()}`}>
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent projects */}
        <div className="portal-card">
          <div className="portal-card-header">
            <h2>My Projects</h2>
            <Link href="/mypage/projects" className="portal-card-link">See all</Link>
          </div>
          {projects.length === 0 ? (
            <p className="portal-empty">No projects yet. Submit a quote request to get started.</p>
          ) : (
            <div className="portal-list">
              {projects.map((proj) => (
                <div key={proj.id} className="portal-list-item">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{proj.title}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>
                      {proj.city}{proj.province ? `, ${proj.province}` : ''}
                    </div>
                  </div>
                  <span className={`portal-badge portal-badge-${proj.status.toLowerCase().replace('_', '-')}`}>
                    {proj.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent quote requests */}
      {quotes.length > 0 && (
        <div className="portal-card" style={{ marginTop: '1.5rem' }}>
          <div className="portal-card-header">
            <h2>Recent Quote Requests</h2>
            <Link href="/mypage/quotes" className="portal-card-link">See all</Link>
          </div>
          <div className="portal-list">
            {quotes.map((q) => (
              <div key={q.id} className="portal-list-item">
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {q.service ? q.service.charAt(0).toUpperCase() + q.service.slice(1) : 'Quote Request'}
                    {q.city ? ` — ${q.city}` : ''}
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>
                    Submitted {formatDistanceToNow(q.createdAt, { addSuffix: true })}
                  </div>
                </div>
                <span className={`portal-badge portal-badge-${q.status.toLowerCase()}`}>
                  {q.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
