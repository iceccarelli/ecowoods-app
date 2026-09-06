/**
 * GET /pricing.md  (rewritten from this path by next.config.js)
 *
 * The pricing twin, rendered from the registry's price primitives — the same
 * projection of content/constants/pricing.ts that /api/v1/pricing serves, so
 * the table here, the JSON and the HTML page cannot disagree. Table first,
 * conditions second, the written price third; heading anchors match the
 * fragment ids the registry declares for /pricing. See lib/markdown-export.ts.
 */
import { getRegistry } from '@/lib/registry/registry';
import { pricingToMarkdown } from '@/lib/markdown-export';

export const dynamic = 'force-static';

export async function GET() {
  const reg = await getRegistry();
  return new Response(pricingToMarkdown(reg.prices), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
