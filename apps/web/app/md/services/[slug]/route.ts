/**
 * GET /services/{slug}.md  (rewritten from this path by next.config.js)
 *
 * The clean-markdown companion, rendered from the same manifest the HTML page
 * reads. See lib/markdown-export.ts, and F-153 for why the commercial and local
 * surfaces were missing from the machine-readable edition until now.
 */
import { getServicePages } from '@/lib/service-pages';
import { serviceMarkdown } from '@/lib/markdown-export';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return getServicePages().map((x) => ({ slug: x.slug }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const md = serviceMarkdown(slug);
  if (!md) return new Response('Not found\n', { status: 404 });
  return new Response(md, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
