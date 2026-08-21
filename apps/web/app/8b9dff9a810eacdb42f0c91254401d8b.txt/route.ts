/**
 * The IndexNow ownership key, served as a route.
 *
 * WHY IT IS A ROUTE AND NOT A FILE
 *
 * It WAS a file — apps/web/public/8b9dff9a810eacdb42f0c91254401d8b.txt — and it
 * returned 404 for its entire existence, because this deployment does not serve
 * apps/web/public (F-131).
 *
 * IndexNow works by the search engine fetching this exact URL and checking the
 * body equals the key in the submission. A 404 here means **every submission
 * Bing and Yandex ever received from this site was rejected**, silently, with no
 * error surfaced anywhere. lib/indexnow.ts is correct and app/api/indexnow is
 * correct; the verification step they both depend on could never succeed.
 *
 * Route handlers demonstrably work on this host — /llms.txt, /ai.txt, /feed.xml
 * and /sitemap.xml all serve this way, and so does this now.
 *
 * The body must be the key and nothing else.
 */

export const dynamic = 'force-static';

const KEY = '8b9dff9a810eacdb42f0c91254401d8b';

export function GET() {
  return new Response(KEY, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=86400, s-maxage=604800',
    },
  });
}
