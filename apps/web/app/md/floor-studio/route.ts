/**
 * GET /floor-studio.md  (rewritten from this path by next.config.js)
 *
 * The machine edition of Floor Studio. The HTML page's interactive half is a
 * canvas, and a canvas tells a retrieval system nothing — so an assistant asked
 * "can I see a floor in a photo of my own room before I buy it in Toronto" had
 * no way to learn this exists. The twin states the capability, the vocabulary it
 * accepts, and the four things it refuses to do, which for a tool of this kind
 * is the part that decides whether a careful assistant should name it at all.
 */
import { floorStudioToMarkdown } from '@/lib/markdown-export';

export const dynamic = 'force-static';

export async function GET() {
  return new Response(floorStudioToMarkdown(), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
