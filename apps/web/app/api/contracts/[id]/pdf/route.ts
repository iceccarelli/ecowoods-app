/**
 * POST /api/contracts/[id]/pdf
 * Generates a contract PDF for a project, stores it, updates the project record.
 */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { renderToBuffer } from '@react-pdf/renderer';
import { ContractDocument } from '@/lib/pdf/contract-document';
import { storePdf } from '@/lib/pdf/storage';
import { createElement } from 'react';
import { updateContractPdf } from '@/lib/actions/projects';

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

  const [project, settings] = await Promise.all([
    db.project.findUnique({
      where: { id },
      include: { user: true },
    }),
    db.settings.findUnique({ where: { id: 'global' } }),
  ]);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
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
    const element = createElement(ContractDocument, { project, settings: effectiveSettings });
    const buffer = await renderToBuffer(element as never);
    const filename = `contract-${project.id}-${Date.now()}.pdf`;
    const url = await storePdf(Buffer.from(buffer), filename);

    await updateContractPdf(project.id, url, false);

    return NextResponse.json({ url });
  } catch (err) {
    console.error('[pdf] contract generation failed:', err);
    return NextResponse.json({ error: 'Contract PDF generation failed' }, { status: 500 });
  }
}
