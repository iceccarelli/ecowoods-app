/**
 * GET /guides/{slug}.md  (rewritten from this path by next.config.js)
 *
 * The clean-markdown companion the llms.txt proposal asks for. Rendered from
 * the same manifest the HTML page reads — see lib/markdown-export.ts for why
 * that is the only rule that matters here.
 */
import { getGuides } from '@/lib/guides';
import { guideMarkdown } from '@/lib/markdown-export';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return getGuides().map((x) => ({ slug: x.slug }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const md = guideMarkdown(slug);
  if (!md) return new Response('Not found\n', { status: 404 });
  return new Response(md, {
    headers: {
      // text/markdown so an agent knows what it has; charset because these
      // documents contain en-dashes, degree signs and a µ.
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
