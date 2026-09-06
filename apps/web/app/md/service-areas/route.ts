/**
 * GET /service-areas.md  (rewritten from this path by next.config.js)
 *
 * The service-area hub twin: who is served, what does not change by area
 * (the bands, the crew model), what does (housing stock, substrate), and
 * every published area with its own .md URL. Nothing outside
 * BUSINESS_NAP.region is claimed as covered. See lib/markdown-export.ts.
 */
import { areasHubToMarkdown } from '@/lib/markdown-export';

export const dynamic = 'force-static';

export async function GET() {
  return new Response(areasHubToMarkdown(), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
