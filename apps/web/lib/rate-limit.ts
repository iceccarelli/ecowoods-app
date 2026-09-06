/**
 * Token-bucket rate limiter + browser-origin check for the public POST surfaces.
 *
 * TOKEN BUCKET, NOT A FIXED WINDOW. Each key holds up to `maxRequests` tokens
 * and refills continuously at `maxRequests per windowMs`. A burst spends the
 * bucket; a steady trickle never notices it. This replaced a sliding-window
 * timestamp array — same exported API, so no call site changed.
 *
 * STILL IN-MEMORY, STILL PER-INSTANCE. On serverless this resets per cold
 * start and is per-lambda, which is acceptable for what it protects (a flood
 * hitting one instance is throttled on that instance; a distributed flood
 * needs Upstash/Redis — documented, not pretended). The lead-capture routes
 * deliberately log BEFORE limiting, so a false positive can never erase a lead.
 *
 * Production default for lead POSTs: 10 requests / minute / IP (P0.7).
 */

export interface RateLimitConfig {
  windowMs: number; // refill period: maxRequests tokens per windowMs
  maxRequests: number; // bucket capacity
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 5,
};

/** The P0.7 contract for every public lead/estimate POST. */
export const LEAD_POST_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 10,
};

type Bucket = { tokens: number; updatedAt: number };

// Global store: key (usually IP) -> bucket
const store = new Map<string, Bucket>();

// Sweep idle buckets so the map cannot grow without bound. `unref` (when
// available) keeps this interval from pinning a serverless runtime open.
const sweeper = setInterval(
  () => {
    const now = Date.now();
    for (const [key, bucket] of store.entries()) {
      if (now - bucket.updatedAt > 10 * 60 * 1000) store.delete(key);
    }
  },
  5 * 60 * 1000,
);
(sweeper as unknown as { unref?: () => void }).unref?.();

/**
 * Check (and consume) one token for this key.
 * Returns: { allowed, remaining, resetAt }
 */
export function checkRateLimit(
  ip: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const refillPerMs = config.maxRequests / config.windowMs;

  const bucket = store.get(ip) ?? { tokens: config.maxRequests, updatedAt: now };
  // Continuous refill since last touch, capped at capacity.
  bucket.tokens = Math.min(config.maxRequests, bucket.tokens + (now - bucket.updatedAt) * refillPerMs);
  bucket.updatedAt = now;

  const allowed = bucket.tokens >= 1;
  if (allowed) bucket.tokens -= 1;
  store.set(ip, bucket);

  const msToNextToken = bucket.tokens >= 1 ? 0 : Math.ceil((1 - bucket.tokens) / refillPerMs);
  return {
    allowed,
    remaining: Math.floor(bucket.tokens),
    resetAt: now + msToNextToken,
  };
}

/**
 * Extract IP from request headers.
 *
 * Order: `x-vercel-forwarded-for` (set by Vercel's edge from the TCP peer and
 * never forwarded from an external proxy, so it cannot be supplied by the
 * caller), then the first hop of `x-forwarded-for` (which Vercel also
 * overwrites, and which any other reverse proxy sets), then `x-real-ip`, then
 * '127.0.0.1'.
 *
 * NOTE: trustworthy only behind a proxy that owns these headers. Off Vercel,
 * a client can send any `x-forwarded-for` it likes — the limiter then keys on
 * a value the attacker chose, which is a weaker limit, not a bypass of
 * anything else.
 */
export function getClientIp(request: Request): string {
  const vercel = request.headers.get('x-vercel-forwarded-for');
  if (vercel) {
    const first = vercel.split(',')[0]!.trim();
    if (first) return first;
  }

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]!.trim();
    if (first) return first;
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback (won't have real IP in local dev without proxy)
  return '127.0.0.1';
}

/**
 * Vercel preview hosts for THIS project only. Every Vercel deployment lives
 * under `*.vercel.app`, so trusting the whole suffix trusted every Vercel
 * customer's origin — a page on evil.vercel.app could post to the lead routes
 * from a browser. Preview URLs are `<project>[-<hash>|-git-<branch>][-<team>]`,
 * so the project name is the stable prefix.
 */
const PREVIEW_HOST = /^ecowoods[a-z0-9-]*\.vercel\.app$/;

/**
 * Browser-origin check for POSTs that only the site's own pages should make.
 *
 * Browsers attach `Origin` to every cross-origin request AND to same-origin
 * POSTs, so: an Origin that is present and is NOT ours ⇒ a cross-site browser
 * post ⇒ reject. An ABSENT Origin is allowed — curl, server-to-server tools
 * and some older same-origin form posts send none, and turning those away
 * would break the no-JS form fallback for zero security gain (a non-browser
 * client can forge any Origin it likes; this check is CSRF hygiene, not auth).
 *
 * Allowed: the canonical host (NEXT_PUBLIC_SITE_URL), localhost dev, and
 * Vercel preview deployments of THIS project (PREVIEW_HOST) — not every
 * `*.vercel.app`. `null` (opaque origin: sandboxed iframe, file://) is refused.
 */
export function isTrustedBrowserOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const url = new URL(origin);
    const host = url.host.toLowerCase();
    const hostname = url.hostname.toLowerCase();
    const site = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ecowoods.ca').host.toLowerCase();
    if (host === site || host === `www.${site}`) return true;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return true;
    if (url.protocol === 'https:' && PREVIEW_HOST.test(hostname)) return true;
    return false;
  } catch {
    return false;
  }
}
