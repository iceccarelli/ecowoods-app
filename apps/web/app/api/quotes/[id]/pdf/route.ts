/**
 * POST /api/quotes/[id]/pdf
 * Generates a formal estimate (견적서) PDF, stores it, updates the quote record.
 */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { QuoteDocument } from '@/lib/pdf/quote-document';
import { storePdf } from '@/lib/pdf/storage';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import type { Settings } from '@prisma/client';

export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [quote, settings] = await Promise.all([
    db.quoteRequest.findUnique({ where: { id } }),
    db.settings.findFirst(),
  ]);

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  }

  // Settings may not be seeded yet — use schema defaults as fallback
  const effectiveSettings = (settings ?? {
    id: '00000000-0000-0000-0000-000000000001',
    companyName: 'Ecowoods Hardwood Flooring Inc.' as string | null,
    companyAddress: '32 Norfield Crescent, Toronto, ON M9W 1X6' as string | null,
    companyPhone: '(647) 244-5156' as string | null,
    companyEmail: 'services@ecowoods.ca' as string | null,
    companyNumberHst: null as string | null,
    companyLogoUrl: null as string | null,
    defaultDepositPct: 30,
    defaultMidpointPct: 40,
    defaultFinalPct: 30,
    defaultTaxRate: 13,
    aiEnabled: true,
    aiBankTransferInstructions: null as string | null,
    updatedAt: new Date(),
  }) as unknown as Settings;

  try {
    const element = createElement(QuoteDocument, { quote, settings: effectiveSettings });
    const buffer = await renderToBuffer(element as never);
    const filename = `estimate-${quote.id}-${Date.now()}.pdf`;
    const url = await storePdf(buffer, filename);

    await db.quoteRequest.update({
      where: { id },
      data: {
        quotePdfUrl: url,
        quoteIssuedAt: new Date(),
        status: 'QUOTED',
      },
    });

    return NextResponse.json({ url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[pdf] quote generation failed:', msg);
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? msg : 'PDF generation failed' },
      { status: 500 }
    );
  }
}
