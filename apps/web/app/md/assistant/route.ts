/**
 * GET /assistant.md  (rewritten from this path by next.config.js)
 *
 * Ask Francisco's machine edition. The HTML page is a streamed conversation —
 * exactly the content a crawler with limited or no JS execution cannot read
 * at all — so this states, in plain markdown, what the workspace is, what
 * Ecowoods actually executes versus what the assistant only advises on, what
 * it can calculate, what it refuses to fabricate, and the canonical
 * destinations it hands a conversation off to. Generated from the same
 * canonical sources (service registry, pricing, geography registry,
 * Framework) the HTML page and every other surface already read — see
 * lib/markdown-export.ts's assistantToMarkdown for the one place this is
 * assembled.
 */
import { assistantToMarkdown } from '@/lib/markdown-export';

export const dynamic = 'force-static';

export async function GET() {
  return new Response(assistantToMarkdown(), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
