import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { id } = await params;

  const project = await db.project.findUnique({
    where: { id },
    select: {
      contractPdfUrl: true,
      signedContractPdfUrl: true,
      title: true,
      userId: true,
    },
  });

  if (!project) return new NextResponse('Not found', { status: 404 });

  const isAdmin = session.user.role === 'ADMIN';
  const isOwner = project.userId === session.user.id;
  if (!isAdmin && !isOwner) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Prefer signed contract; fall back to unsigned
  const pdfUrl = project.signedContractPdfUrl ?? project.contractPdfUrl;

  if (!pdfUrl || pdfUrl.startsWith('data:') || !pdfUrl.startsWith('http')) {
    return new NextResponse('Not found', { status: 404 });
  }

  const blobRes = await fetch(pdfUrl);
  if (!blobRes.ok) return new NextResponse('PDF unavailable', { status: 404 });

  const isDownload = new URL(req.url).searchParams.get('dl') === '1';
  const filename = `contract-${project.title.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;

  return new NextResponse(blobRes.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': isDownload
        ? `attachment; filename="${filename}"`
        : 'inline',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
