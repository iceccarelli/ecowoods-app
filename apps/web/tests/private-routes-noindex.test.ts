import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => null) }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

describe('private surfaces', () => {
  it('admin and customer-portal layouts export noindex metadata', async () => {
    const admin = await import('@/app/admin/layout');
    const portal = await import('@/app/(portal)/mypage/layout');
    const verify = await import('@/app/verify-email/page');
    for (const m of [admin.metadata, portal.metadata, verify.metadata]) {
      expect(m?.robots).toMatchObject({ index: false, follow: false });
    }
  });

  it('vercel.json sends X-Robots-Tag noindex for admin, mypage, docs, login, register, verify-email', () => {
    const cfg = JSON.parse(readFileSync(path.resolve(__dirname, '../../../vercel.json'), 'utf8'));
    const noindex = (cfg.headers as { source: string; headers: { key: string; value: string }[] }[])
      .filter((h) => h.headers.some((x) => x.key === 'X-Robots-Tag' && /noindex/.test(x.value)))
      .map((h) => h.source)
      .join(' ');
    for (const seg of ['admin', 'mypage', 'docs', 'login', 'register', 'verify-email']) {
      expect(noindex).toContain(seg);
    }
  });

  it('sitemap lists none of them', async () => {
    const sitemap = (await import('@/app/sitemap')).default;
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls.length).toBeGreaterThan(50);
    for (const u of urls) {
      expect(u).not.toMatch(/\/(admin|mypage|login|register|verify-email|docs|api)(\/|$)/);
    }
  });
});
