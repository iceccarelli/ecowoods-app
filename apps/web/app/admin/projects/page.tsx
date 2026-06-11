import Link from 'next/link';
import { db } from '@/lib/db';
import { format } from 'date-fns';
import type { ProjectStatus } from '@prisma/client';

const statusColor: Record<ProjectStatus, string> = {
  DRAFT: 'neutral',
  CONTRACT_SENT: 'warning',
  SIGNED: 'info',
  DEPOSIT_PAID: 'info',
  IN_PROGRESS: 'active',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

function formatCAD(n: number | { toNumber(): number } | null | undefined) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(
    typeof n === 'number' ? n : n.toNumber()
  );
}

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const statusFilter = status as ProjectStatus | undefined;

  const projects = await db.project.findMany({
    where: statusFilter ? { status: statusFilter } : {},
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { name: true, email: true } },
      invoices: { select: { status: true, total: true } },
    },
  });

  const counts = await db.project.groupBy({ by: ['status'], _count: true });
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count]));

  const statuses: ProjectStatus[] = ['DRAFT', 'CONTRACT_SENT', 'SIGNED', 'DEPOSIT_PAID', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1 className="portal-title">Projects</h1>
          <p className="portal-subtitle">{projects.length} projects</p>
        </div>
        <Link href="/admin/projects/new" className="btn btn-copper btn-sm">+ New Project</Link>
      </div>

      {/* Status filters */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <Link href="/admin/projects" className={`btn btn-sm ${!statusFilter ? 'btn-copper' : 'btn-ghost'}`}>
          All
        </Link>
        {statuses.map((s) => (
          <Link key={s} href={`/admin/projects?status=${s}`} className={`btn btn-sm ${statusFilter === s ? 'btn-copper' : 'btn-ghost'}`}>
            {s.replace('_', ' ')} ({countMap[s] ?? 0})
          </Link>
        ))}
      </div>

      <div className="portal-card">
        <table className="portal-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Customer</th>
              <th>Contract Value</th>
              <th>Paid</th>
              <th>Status</th>
              <th>Start</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>No projects found.</td></tr>
            )}
            {projects.map((proj) => {
              const paid = proj.invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + Number(i.total), 0);
              return (
                <tr key={proj.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{proj.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{proj.city}, {proj.province}</div>
                  </td>
                  <td>
                    <div>{proj.user.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{proj.user.email}</div>
                  </td>
                  <td>{formatCAD(proj.contractValue)}</td>
                  <td style={{ color: paid > 0 ? 'var(--success)' : undefined }}>{paid > 0 ? formatCAD(paid) : '—'}</td>
                  <td>
                    <span className={`portal-badge portal-badge-${statusColor[proj.status]}`}>
                      {proj.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                    {proj.startDate ? format(proj.startDate, 'MMM d, yyyy') : '—'}
                  </td>
                  <td>
                    <Link href={`/admin/projects/${proj.id}`} className="btn btn-ghost btn-sm">Manage →</Link>
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
