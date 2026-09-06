/**
 * GET /services.md  (rewritten from this path by next.config.js)
 *
 * The services hub twin: each service, its blurb, its published band or the
 * honest alternative, its canonical URL and its own .md URL. The per-service
 * twins live one level down at /md/services/[slug]. See lib/markdown-export.ts.
 */
import { servicesHubToMarkdown } from '@/lib/markdown-export';

export const dynamic = 'force-static';

export async function GET() {
  return new Response(servicesHubToMarkdown(), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
