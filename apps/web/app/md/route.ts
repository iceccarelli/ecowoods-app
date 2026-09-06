/**
 * GET /md — the index of every markdown twin this site serves.
 *
 * Until this existed, /md was a 404 in production: the twins lived under it
 * and nothing listed them. Generated from the same manifests that generate
 * the routes (SERVICES, SERVICE_AREAS, getPapers(), getGuides(), getTerms()),
 * so a twin appears here exactly when its route exists. See
 * lib/markdown-export.ts.
 */
import { mirrorIndexToMarkdown } from '@/lib/markdown-export';

export const dynamic = 'force-static';

export async function GET() {
  return new Response(mirrorIndexToMarkdown(), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
