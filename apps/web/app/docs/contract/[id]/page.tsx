import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { format } from 'date-fns';

function formatCAD(n: number | { toNumber(): number } | null | undefined) {
  if (n == null) return null;
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(
    typeof n === 'number' ? n : n.toNumber()
  );
}

export default async function PublicContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { id } = await params;

  const project = await db.project.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      city: true,
      province: true,
      contractValue: true,
      contractPdfUrl: true,
      signedContractPdfUrl: true,
      contractSignedAt: true,
      startDate: true,
      status: true,
      userId: true,
    },
  });

  if (project && session.user.role !== 'ADMIN' && project.userId !== session.user.id) {
    notFound();
  }

  if (!project) notFound();

  const pdfUrl = project.signedContractPdfUrl ?? project.contractPdfUrl;

  if (!pdfUrl || pdfUrl.startsWith('data:')) notFound();

  const proxyUrl = `/api/docs/contract/${id}`;
  const downloadUrl = `${proxyUrl}?dl=1`;

  const isSigned = !!project.signedContractPdfUrl;

  return (
    <div style={{ minHeight: '100vh', background: '#fdfbf6', fontFamily: 'sans-serif', color: '#1a0f08' }}>
      {/* Header */}
      <div style={{ background: '#1a0f08', padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: '#fdfbf6', fontSize: '18px', fontWeight: 300, letterSpacing: '2px' }}>ECOWOODS</div>
          <div style={{ color: '#c87e4f', fontSize: '11px', letterSpacing: '0.1em' }}>TORONTO HARDWOOD FLOORING</div>
        </div>
        <a
          href={downloadUrl}
          download
          style={{
            background: '#c87e4f',
            color: '#fdfbf6',
            padding: '10px 20px',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '14px',
          }}
        >
          Download PDF
        </a>
      </div>

      {/* Document info */}
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{
          background: '#fff',
          border: '1px solid #e8d4b8',
          borderRadius: '10px',
          padding: '28px 32px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
        }}>
          <div>
            <div style={{ fontSize: '12px', color: '#6b5d52', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
              {isSigned ? 'Signed Contract' : 'Service Contract'}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>{project.title}</div>
            {(project.city || project.province) && (
              <div style={{ fontSize: '14px', color: '#6b5d52', marginTop: '4px' }}>
                {[project.city, project.province].filter(Boolean).join(', ')}
              </div>
            )}
          </div>

          <div style={{ textAlign: 'right' }}>
            {isSigned && (
              <div style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: '99px',
                fontSize: '13px',
                fontWeight: 600,
                background: '#16a34a18',
                color: '#16a34a',
                marginBottom: '8px',
              }}>
                ✓ Signed
              </div>
            )}
            {project.contractValue && (
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#c87e4f' }}>
                {formatCAD(project.contractValue)}
              </div>
            )}
            {project.contractSignedAt && (
              <div style={{ fontSize: '13px', color: '#6b5d52', marginTop: '4px' }}>
                Signed {format(project.contractSignedAt, 'MMMM d, yyyy')}
              </div>
            )}
            {project.startDate && (
              <div style={{ fontSize: '13px', color: '#6b5d52' }}>
                Start {format(project.startDate, 'MMMM d, yyyy')}
              </div>
            )}
          </div>
        </div>

        {/* PDF Viewer */}
        <div style={{ background: '#fff', border: '1px solid #e8d4b8', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #e8d4b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '14px' }}>
              {isSigned ? 'Signed Contract Document' : 'Contract Document'}
            </span>
            <a href={downloadUrl} style={{ color: '#c87e4f', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
              Open in new tab ↗
            </a>
          </div>
          <iframe
            src={proxyUrl}
            style={{ width: '100%', height: '800px', border: 'none', display: 'block' }}
            title="Contract PDF"
          />
        </div>

        <div style={{ textAlign: 'center', padding: '24px', fontSize: '12px', color: '#6b5d52' }}>
          Ecowoods Hardwood Flooring Inc. · 32 Norfield Crsnt., Toronto, ON M3J 3A1 · (416) 249-1276
        </div>
      </div>
    </div>
  );
}
