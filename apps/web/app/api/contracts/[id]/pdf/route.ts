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
import type { Settings } from '@prisma/client';
import { BUSINESS_NAP, BUSINESS_ADDRESS_LINE } from '@ecowoods/shared/constants';

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
    db.settings.findFirst(),
  ]);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const effectiveSettings = (settings ?? {
    id: '00000000-0000-0000-0000-000000000001',
    companyName: 'Ecowoods Hardwood Flooring Inc.' as string | null,
    companyAddress: BUSINESS_ADDRESS_LINE as string | null,
    companyPhone: BUSINESS_NAP.phoneDisplay as string | null,
    companyEmail: BUSINESS_NAP.email as string | null,
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
