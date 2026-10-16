import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => null) }));

const STATIC_PAGES = ['floor-studio', 'assistant', 'catalogues', 'team', 'papers', 'about', 'technical-library', 'products/floorforge'];

type Md = { title?: unknown; description?: string };
const titleOf = (t: unknown) => (typeof t === 'string' ? t : t && typeof t === 'object' && 'absolute' in t ? String((t as { absolute: string }).absolute) : '');

async function metadataOf(p: string): Promise<Md> {
  const m = (await import(`@/app/${p}/page`)) as { metadata?: Md; generateMetadata?: () => Promise<Md> };
  return m.generateMetadata ? m.generateMetadata() : (m.metadata ?? {});
}

describe('search-result metadata', () => {
  for (const p of STATIC_PAGES) {
    it(`/${p}: title ≤ 70 and description ≤ 165 characters`, async () => {
      const md = await metadataOf(p);
      expect(titleOf(md.title).length).toBeLessThanOrEqual(70);
      if (md.description) expect(md.description.length).toBeLessThanOrEqual(165);
    });
  }

  it('every corridor page: title ≤ 70, description ≤ 165', async () => {
    const { CORRIDORS } = await import('@/lib/geo');
    const { generateMetadata } = await import('@/app/corridors/[id]/page');
    const bad: string[] = [];
    for (const c of CORRIDORS) {
      const md = (await generateMetadata({ params: Promise.resolve({ id: c.id }) })) as Md;
      if (titleOf(md.title).length > 70 || (md.description?.length ?? 0) > 165) bad.push(c.id);
    }
    expect(bad).toEqual([]);
  });

  it('no meta description repeats a claim the registry marks unsourced (lifetime workmanship warranty)', async () => {
    for (const p of STATIC_PAGES) {
      const md = await metadataOf(p);
      expect(md.description ?? '').not.toMatch(/lifetime/i);
    }
  });
});
