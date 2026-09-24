import Link from 'next/link';
import { format } from 'date-fns';
import { db } from '@/lib/db';

/**
 * /admin/floor-graph/records — the first read-back the Floor Passport gets.
 *
 * The forensic audit's exact complaint about this table (and its siblings)
 * was "captured, consent-gated, correct — and never read back. Admin shows
 * counts only." This page is the minimum fix: every FloorRecord that OWN-01
 * writes, with what it knows and how many assessments/outcomes point to it.
 * Read-only — no write path lives here, only in the job-close flow.
 */
export const dynamic = 'force-dynamic';

export default async function FloorRecordsPage() {
  const records = await db.floorRecord.findMany({
    where: { erasedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      publicRef: true,
      city: true,
      province: true,
      areaSqFt: true,
      species: true,
      createdAt: true,
      originProjectId: true,
      _count: { select: { assessments: true, outcomes: true } },
    },
  });

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1 className="portal-title">Floor Passports</h1>
          <p className="portal-subtitle">
            Every persistent floor record on file — {records.length} total. Started only at a confirmed
            job close, never from a chat message.
          </p>
        </div>
        <Link href="/admin/floor-graph" className="btn btn-ghost btn-sm">
          Back to Floor Graph
        </Link>
      </div>

      <div className="portal-card">
        {records.length === 0 ? (
          <p>
            No passports yet. The first one is created by checking &ldquo;Save this floor to the Floor
            Passport&rdquo; when closing a job in the Floor Graph console.
          </p>
        ) : (
          <table className="portal-table">
            <thead>
              <tr>
                <th scope="col">Ref</th>
                <th scope="col">City</th>
                <th scope="col">Species</th>
                <th scope="col">Area</th>
                <th scope="col">Started</th>
                <th scope="col">Assessments</th>
                <th scope="col">Outcomes</th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.publicRef}</td>
                  <td>
                    {r.city ?? '—'}
                    {r.province ? `, ${r.province}` : ''}
                  </td>
                  <td>{r.species ?? '—'}</td>
                  <td>{r.areaSqFt ? `${r.areaSqFt} sq ft` : '—'}</td>
                  <td>{format(r.createdAt, 'd MMM yyyy')}</td>
                  <td>{r._count.assessments}</td>
                  <td>{r._count.outcomes}</td>
                  <td>
                    {r.originProjectId && (
                      <Link href={`/admin/floor-graph/${r.originProjectId}`} className="btn btn-ghost btn-sm">
                        Open project
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
