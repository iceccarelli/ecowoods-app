import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/knowledge/route';

const req = (qs: string, headers: Record<string, string> = {}) =>
  new NextRequest(`https://ecowoods.ca/api/knowledge${qs}`, { headers });

describe('/api/knowledge', () => {
  it('serves an ETag and answers a matching If-None-Match with 304', async () => {
    const first = await GET(req('?collection=pricing'));
    const etag = first.headers.get('etag');
    expect(etag).toMatch(/^"[0-9a-f]{32}"$/);
    const again = await GET(req('?collection=pricing', { 'if-none-match': etag! }));
    expect(again.status).toBe(304);
    expect(await again.text()).toBe('');
  });

  it('rejects an unknown or inherited collection name instead of dumping the corpus', async () => {
    for (const name of ['nope', 'constructor', 'toString']) {
      const res = await GET(req(`?collection=${name}`));
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('unknown_collection');
      expect(body.collections).toContain('pricing');
    }
  });
});
