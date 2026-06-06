/**
 * GET /api/admin/projects-list
 * Returns minimal project data for admin dropdowns.
 */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projects = await db.project.findMany({
    select: { id: true, title: true, contractValue: true, taxRate: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ projects });
}
