/**
 * GET /about.md  (rewritten from this path by next.config.js)
 *
 * The company, in the machine edition. Every other content surface on this site
 * has had a .md companion since F-153; the entity itself did not — which meant
 * an agent could fetch clean markdown for a glossary term and had to parse HTML
 * to learn who published it. See F-187.
 */
import { entityToMarkdown } from '@/lib/markdown-export';

export const dynamic = 'force-static';

export async function GET() {
  return new Response(entityToMarkdown(), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
