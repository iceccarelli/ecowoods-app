/**
 * GET /where-we-work.md  (rewritten from this path by next.config.js)
 *
 * The proof map as text: every published job, its year, its floor area, the
 * service and the case study that carries the measurements. No coordinate is
 * emitted — COORDS_VERIFIED is false, and scripts/verify-work-map.mjs §6 is
 * the mechanical half of that rule. See lib/markdown-export.ts.
 */
import { whereWeWorkToMarkdown } from '@/lib/markdown-export';

export const dynamic = 'force-static';

export async function GET() {
  return new Response(whereWeWorkToMarkdown(), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
