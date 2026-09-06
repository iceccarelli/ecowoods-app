/**
 * GET /hardwood-flooring-toronto.md, /hardwood-floor-refinishing-toronto.md,
 * /hardwood-stairs-toronto.md  (rewritten to /md/commercial/{slug} by
 * next.config.js)
 *
 * The twin of each commercial head-term page: H1, identity, the services the
 * page covers, the price table with its caveat, the published FAQ and the
 * estimate path. Rendered from COMMERCIAL_MIRRORS in lib/markdown-export.ts,
 * which reads the same constants the pages read.
 */
import { COMMERCIAL_MIRRORS, commercialMarkdown } from '@/lib/markdown-export';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return COMMERCIAL_MIRRORS.map((x) => ({ slug: x.slug }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const md = commercialMarkdown(slug);
  if (!md) return new Response('Not found\n', { status: 404 });
  return new Response(md, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
