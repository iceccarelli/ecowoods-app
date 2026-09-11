/**
 * GET /corridors/{id}.md  (rewritten from this path by next.config.js)
 *
 * One route: the stops in travel order, the districts inside each, and the
 * operational statement the owner confirmed for every one of them, verbatim.
 * Same source as the HTML page. See lib/markdown-export.ts.
 */
import { CORRIDORS } from '@/lib/geo';
import { corridorMarkdown } from '@/lib/markdown-export';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return CORRIDORS.map((c) => ({ id: c.id }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const md = corridorMarkdown(id);
  if (!md) return new Response('Not found\n', { status: 404 });
  return new Response(md, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
