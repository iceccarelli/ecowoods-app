/**
 * GET /corridors.md  (rewritten from this path by next.config.js)
 *
 * The corridor hub twin: every route, its hub, how many municipalities sit on
 * it and how many districts sit inside those, and what each status means.
 * Generated from content/geo/corridors.ts and the market registry — see
 * lib/markdown-export.ts, and GEO-002 for why this surface had no machine
 * edition until now.
 */
import { corridorsHubToMarkdown } from '@/lib/markdown-export';

export const dynamic = 'force-static';

export async function GET() {
  return new Response(corridorsHubToMarkdown(), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
