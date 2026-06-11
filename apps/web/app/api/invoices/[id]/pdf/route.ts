/**
 * POST /api/invoices/[id]/pdf
 * Generates an invoice PDF, stores it, updates the invoice record, returns the URL.
 */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoiceDocument } from '@/lib/pdf/invoice-document';
import { storePdf } from '@/lib/pdf/storage';
import { createElement } from 'react';
import type { Settings } from '@prisma/client';

export const runtime = 'nodejs';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [invoice, settings] = await Promise.all([
    db.invoice.findUnique({
      where: { id },
      include: { project: { include: { user: true } } },
    }),
    db.settings.findFirst(),
  ]);

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const effectiveSettings = (settings ?? {
    id: '00000000-0000-0000-0000-000000000001',
    companyName: 'Ecowoods Hardwood Flooring Inc.' as string | null,
    companyAddress: '32 Norfield Crsnt., Toronto, ON M3J 3A1' as string | null,
    companyPhone: '(416) 249-1276' as string | null,
    companyEmail: 'hello@ecowoods.ca' as string | null,
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
    const element = createElement(InvoiceDocument, { invoice, settings: effectiveSettings });
    const buffer = await renderToBuffer(element as never);
    const filename = `invoice-${invoice.number}-${Date.now()}.pdf`;
    const url = await storePdf(Buffer.from(buffer), filename);

    await db.invoice.update({ where: { id }, data: { pdfUrl: url } });

    return NextResponse.json({ url });
  } catch (err) {
    console.error('[pdf] invoice generation failed:', err);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}
