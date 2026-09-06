/**
 * GET /estimate.md  (rewritten from this path by next.config.js)
 *
 * The estimate path in three steps — in-home measure with a moisture test,
 * fixed written price with a committed schedule, the work — plus the phone,
 * email, hours and the form URL. Actions come from the registry's action
 * primitives. See lib/markdown-export.ts.
 */
import { estimateToMarkdown } from '@/lib/markdown-export';

export const dynamic = 'force-static';

export async function GET() {
  return new Response(estimateToMarkdown(), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
