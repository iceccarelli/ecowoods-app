'use server';

/**
 * Project server actions (admin-only).
 * 프로젝트 서버 액션 (관리자 전용)
 */

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { ProjectStatus } from '@prisma/client';

// ─── Create project ──────────────────────────────────────────────────────────
export async function createProject(input: {
  userId: string;
  title: string;
  description?: string;
  address?: string;
  city?: string;
  province?: string;
  species?: string[];
  squareFeet?: number;
  contractValue?: number;
  depositPct?: number;
  midpointPct?: number;
  finalPct?: number;
  taxRate?: number;
  startDate?: string;
  endDate?: string;
}) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const settings = await db.settings.findFirst();

  const project = await db.project.create({
    data: {
      userId: input.userId,
      title: input.title,
      description: input.description,
      address: input.address,
      city: input.city,
      province: input.province,
      species: (input.species ?? undefined) as import('@prisma/client').Prisma.InputJsonValue | undefined,
      squareFeet: input.squareFeet,
      contractValue: input.contractValue,
      depositPct: input.depositPct ?? settings?.defaultDepositPct ?? 30,
      midpointPct: input.midpointPct ?? settings?.defaultMidpointPct ?? 40,
      finalPct: input.finalPct ?? settings?.defaultFinalPct ?? 30,
      taxRate: input.taxRate ?? settings?.defaultTaxRate ?? 13,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
    },
  });

  revalidatePath('/admin/projects');
  return { success: true, projectId: project.id };
}

// ─── Update project status ───────────────────────────────────────────────────
export async function updateProjectStatus(projectId: string, status: ProjectStatus) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  await db.project.update({ where: { id: projectId }, data: { status } });
  revalidatePath('/admin/projects');
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath('/mypage/projects');
}

// ─── Update contract PDF URL (after generation or signed upload) ─────────────
export async function updateContractPdf(
  projectId: string,
  url: string,
  isSigned = false
) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  await db.project.update({
    where: { id: projectId },
    data: isSigned
      ? { signedContractPdfUrl: url, contractSignedAt: new Date(), status: 'SIGNED' }
      : { contractPdfUrl: url },
  });

  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath('/mypage/projects');
}

// ─── Add project note ────────────────────────────────────────────────────────
export async function addProjectNote(projectId: string, content: string) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  await db.projectNote.create({ data: { projectId, content } });
  revalidatePath(`/admin/projects/${projectId}`);
}

// ─── Send contract to customer ───────────────────────────────────────────────
export async function sendContractToCustomer(projectId: string) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { user: true },
  });
  if (!project) throw new Error('Project not found.');
  if (!project.contractPdfUrl) throw new Error('Generate the contract PDF first before sending.');
  if (project.contractPdfUrl.startsWith('data:'))
    throw new Error('Please click "Generate PDF" again to create a shareable link before sending.');

  const baseUrl = (process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const pdfUrl = project.contractPdfUrl.startsWith('http')
    ? project.contractPdfUrl
    : `${baseUrl}${project.contractPdfUrl}`;

  const { sendContractEmail } = await import('@/lib/email');
  await sendContractEmail({
    to: project.user.email,
    name: project.user.name ?? project.user.email,
    projectTitle: project.title,
    contractPdfUrl: pdfUrl,
    portalProjectUrl: `${baseUrl}/mypage/projects`,
    viewUrl: `${baseUrl}/docs/contract/${projectId}`,
  });

  revalidatePath(`/admin/projects/${projectId}`);
}

// ─── Update project details ──────────────────────────────────────────────────
export async function updateProject(
  projectId: string,
  data: Partial<{
    title: string;
    description: string;
    contractValue: number;
    depositPct: number;
    midpointPct: number;
    finalPct: number;
    taxRate: number;
    startDate: string;
    endDate: string;
  }>
) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  await db.project.update({
    where: { id: projectId },
    data: {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    },
  });

  revalidatePath('/admin/projects');
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath('/mypage/projects');
}
