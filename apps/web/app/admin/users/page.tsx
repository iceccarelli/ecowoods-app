import { db } from '@/lib/db';
import { format } from 'date-fns';
import Link from 'next/link';

function formatCAD(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n);
}

export default async function AdminUsersPage() {
  const users = await db.user.findMany({
    where: { role: 'USER' },
    orderBy: { createdAt: 'desc' },
    include: {
      quoteRequests: { select: { id: true } },
      projects: {
        select: {
          id: true,
          status: true,
          invoices: { select: { status: true, total: true } },
        },
      },
    },
  });

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1 className="portal-title">Customers</h1>
          <p className="portal-subtitle">{users.length} registered customer{users.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="portal-card">
        <table className="portal-table">
          <thead>
            <tr>
              <th>Name / Email</th>
              <th>Phone</th>
              <th>Quotes</th>
              <th>Projects</th>
              <th>Revenue (Paid)</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>No customers yet.</td></tr>
            )}
            {users.map((user) => {
              const totalPaid = user.projects
                .flatMap((p) => p.invoices)
                .filter((i) => i.status === 'PAID')
                .reduce((s, i) => s + Number(i.total), 0);

              return (
                <tr key={user.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{user.name ?? '—'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                      <a href={`mailto:${user.email}`}>{user.email}</a>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{user.phone ?? '—'}</td>
                  <td>{user.quoteRequests.length}</td>
                  <td>{user.projects.length}</td>
                  <td style={{ fontWeight: 600, color: totalPaid > 0 ? 'var(--success)' : undefined }}>
                    {totalPaid > 0 ? formatCAD(totalPaid) : '—'}
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                    {format(user.createdAt, 'MMM d, yyyy')}
                  </td>
                  <td>
                    <Link href={`/admin/projects?userId=${user.id}`} className="btn btn-ghost btn-sm">
                      Projects
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
