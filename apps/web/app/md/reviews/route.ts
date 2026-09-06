/**
 * GET /reviews.md  (rewritten from this path by next.config.js)
 *
 * The review record as a table — platform, rating, count, most recent, read
 * date, profile link — from REVIEW_EVIDENCE, cited to source. Never an
 * aggregate of our own. See lib/markdown-export.ts.
 */
import { reviewsToMarkdown } from '@/lib/markdown-export';

export const dynamic = 'force-static';

export async function GET() {
  return new Response(reviewsToMarkdown(), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
