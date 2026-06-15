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

  const invoice = await db.invoice.findUnique({
    where: { id },
    select: {
      pdfUrl: true,
      number: true,
      project: { select: { userId: true } },
    },
  });

  if (!invoice?.pdfUrl || invoice.pdfUrl.startsWith('data:') || !invoice.pdfUrl.startsWith('http')) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Admin can view all; customers can only view their own
  const isAdmin = session.user.role === 'ADMIN';
  const isOwner = invoice.project.userId === session.user.id;
  if (!isAdmin && !isOwner) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const blobRes = await fetch(invoice.pdfUrl);
  if (!blobRes.ok) return new NextResponse('PDF unavailable', { status: 404 });

  const isDownload = new URL(req.url).searchParams.get('dl') === '1';
  const filename = `invoice-${invoice.number ?? id}.pdf`;

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
