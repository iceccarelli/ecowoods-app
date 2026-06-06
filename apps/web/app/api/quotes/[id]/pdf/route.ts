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

export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [quote, settings] = await Promise.all([
    db.quoteRequest.findUnique({ where: { id: params.id } }),
    db.settings.findUnique({ where: { id: 'global' } }),
  ]);

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  }

  // Settings may not be seeded yet — use schema defaults as fallback
  const effectiveSettings = settings ?? {
    id: 'global',
    companyName: 'Ecowoods Hardwood Flooring Inc.',
    companyAddress: '32 Norfield Crsnt., Toronto, ON M3J 3A1',
    companyPhone: '(416) 249-1276',
    companyEmail: 'hello@ecowoods.ca',
    companyHstNumber: '',
    companyLogoUrl: null,
    defaultDepositPct: 30,
    defaultMidpointPct: 40,
    defaultFinalPct: 30,
    defaultTaxRate: 13,
    aiEnabled: false,
    bankTransferInstructions: '',
    updatedAt: new Date(),
  };

  try {
    const element = createElement(QuoteDocument, { quote, settings: effectiveSettings });
    const buffer = await renderToBuffer(element as never);
    const filename = `estimate-${quote.id}-${Date.now()}.pdf`;
    const url = await storePdf(buffer, filename);

    await db.quoteRequest.update({
      where: { id: params.id },
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
