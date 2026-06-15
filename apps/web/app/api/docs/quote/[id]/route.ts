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

  const quote = await db.quoteRequest.findUnique({
    where: { id },
    select: { quotePdfUrl: true, userId: true, email: true },
  });

  const pdfUrl = quote?.quotePdfUrl as string | null | undefined;

  if (!pdfUrl || pdfUrl.startsWith('data:') || !pdfUrl.startsWith('http')) {
    return new NextResponse('Not found', { status: 404 });
  }

  const isAdmin = session.user.role === 'ADMIN';
  const isOwner =
    (quote != null && quote.userId != null && quote.userId === session.user.id) ||
    (quote != null && quote.email === session.user.email);
  if (!isAdmin && !isOwner) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const blobRes = await fetch(pdfUrl);
  if (!blobRes.ok) return new NextResponse('PDF unavailable', { status: 404 });

  const isDownload = new URL(req.url).searchParams.get('dl') === '1';

  return new NextResponse(blobRes.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': isDownload
        ? `attachment; filename="estimate-${id}.pdf"`
        : 'inline',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
