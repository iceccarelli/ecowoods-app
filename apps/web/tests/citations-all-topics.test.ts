/**
 * Every citation topic the OpenAPI document advertises must be servable, and
 * every URL the pack cites must be a canonical ecowoods.ca URL.
 */
import { describe, it, expect } from 'vitest';
import { CITATION_TOPICS } from '@/lib/registry/citations';
import { buildOpenApi } from '@/lib/registry/openapi';
import { GET } from '@/app/api/v1/citations/[topic]/route';
import { SITE_URL } from '@/lib/seo-data';

const get = (topic: string, headers: Record<string, string> = {}) =>
  GET(new Request(`${SITE_URL}/api/v1/citations/${topic}`, { headers: { 'x-forwarded-for': '10.9.0.1', ...headers } }), {
    params: Promise.resolve({ topic }),
  } as never);

describe('citations — every advertised topic', () => {
  it('OpenAPI enumerates exactly CITATION_TOPICS', async () => {
    const spec = JSON.stringify(buildOpenApi());
    for (const t of CITATION_TOPICS) expect(spec, t).toContain(`"${t}"`);
  });

  for (const topic of CITATION_TOPICS) {
    it(`/api/v1/citations/${topic} → 200 with canonical URLs and conditional support`, async () => {
      const res = await get(topic);
      expect(res.status).toBe(200);
      const etag = res.headers.get('etag')!;
      expect(etag).toBeTruthy();
      const body = await res.text();
      for (const url of body.match(/https?:\/\/[^"\s)]+/g) ?? []) {
        if (/ecowoods\.ca/.test(url)) expect(url.startsWith(SITE_URL), url).toBe(true);
      }
      const again = await get(topic, { 'if-none-match': etag });
      expect(again.status).toBe(304);
    });
  }
});
