/**
 * GET /design.md  (rewritten from this path by next.config.js)
 *
 * The configurator's machine edition. Floor Studio has had one since it
 * shipped; this page had none, so an agent asking whether this site lets a
 * person specify a hardwood floor found one of the two doors. See
 * lib/markdown-export.ts and UI-NAV-02.
 */
import { designToMarkdown } from '@/lib/markdown-export';

export const dynamic = 'force-static';

export async function GET() {
  return new Response(designToMarkdown(), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
