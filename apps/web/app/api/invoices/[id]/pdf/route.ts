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

export const runtime = 'nodejs';

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [invoice, settings] = await Promise.all([
    db.invoice.findUnique({
      where: { id: params.id },
      include: { project: { include: { user: true } } },
    }),
    db.settings.findUnique({ where: { id: 'global' } }),
  ]);

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

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
    const element = createElement(InvoiceDocument, { invoice, settings: effectiveSettings });
    const buffer = await renderToBuffer(element);
    const filename = `invoice-${invoice.number}-${Date.now()}.pdf`;
    const url = await storePdf(Buffer.from(buffer), filename);

    await db.invoice.update({ where: { id: params.id }, data: { pdfUrl: url } });

    return NextResponse.json({ url });
  } catch (err) {
    console.error('[pdf] invoice generation failed:', err);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}
