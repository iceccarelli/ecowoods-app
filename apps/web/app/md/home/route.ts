/**
 * GET /index.md  (rewritten from this path by next.config.js)
 *
 * The homepage twin. Identity, the service list, the published bands with
 * their caveat, where the work is done, the evidence, the two ways to start a
 * job, and the NAP — every value read from the constant the HTML page reads.
 * See lib/markdown-export.ts.
 */
import { homeToMarkdown } from '@/lib/markdown-export';

export const dynamic = 'force-static';

export async function GET() {
  return new Response(homeToMarkdown(), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
