/**
 * GET /contact.md  (rewritten from this path by next.config.js)
 *
 * NAP, hours, showroom address and the map link, every value from
 * BUSINESS_NAP / BUSINESS_HOURS / GOOGLE_PLACE. See lib/markdown-export.ts.
 */
import { contactToMarkdown } from '@/lib/markdown-export';

export const dynamic = 'force-static';

export async function GET() {
  return new Response(contactToMarkdown(), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
