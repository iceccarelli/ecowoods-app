/**
 * Prisma client singleton.
 *
 * In development, Next.js hot-reload creates new module instances on each
 * file change. Without this pattern you'd exhaust the PostgreSQL connection
 * pool very quickly.
 *
 * 개발 환경에서 Next.js 핫 리로드 시 Prisma 인스턴스가 중복 생성되지 않도록
 * globalThis에 싱글톤으로 캐시합니다.
 */
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Append connection_limit=1 so Prisma's internal pool doesn't exhaust
// Supabase's session-mode slot limit (15 by default on free tier).
function buildUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    if (!u.searchParams.has('connection_limit')) {
      u.searchParams.set('connection_limit', '1');
    }
    return u.toString();
  } catch {
    return raw;
  }
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error'],
    ...(process.env.DATABASE_URL
      ? { datasources: { db: { url: buildUrl(process.env.DATABASE_URL) } } }
      : {}),
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
