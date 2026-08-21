/**
 * GET /llms-full.txt — the entire published corpus in one fetch.
 *
 * /llms.txt is the index: what exists, and where. This is the text itself —
 * every technical paper, every decision guide, every glossary entry, in full,
 * in reading order.
 *
 * It is not part of the llms.txt proposal, which defines the index and the
 * `.md` companions and stops there. It is a de-facto convention that several
 * documentation sites have converged on, and it earns its place here for one
 * concrete reason: an agent asked "how long does hardwood need to acclimate in
 * Toronto" should not have to make eighty-seven requests to find out what this
 * site says before it can answer. One request, everything, attributed.
 *
 * Generated from lib/markdown-export.ts, which reads the same manifests the
 * pages read. There is nowhere in this route to type a claim.
 */
import { corpusToMarkdown } from '@/lib/markdown-export';

export const dynamic = 'force-static';

export async function GET() {
  return new Response(corpusToMarkdown(), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
