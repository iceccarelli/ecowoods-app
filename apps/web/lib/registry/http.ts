/**
 * lib/registry/http.ts — HTTP semantics for the agentic primitives
 * (Protocol v2, Stages 9.9, 31, 34).
 *
 * Every /api/v1 response:
 *   · application/json; charset=utf-8, pretty-printed (agents diff them)
 *   · a strong ETag over the body, and 304 on a matching If-None-Match, so a
 *     machine learns cheaply whether anything changed
 *   · Last-Modified from the registry's `updated_at`, never the build time
 *   · Cache-Control that lets the edge cache and revalidate
 *   · CORS open for GET/POST/OPTIONS — the API is public, read-only, cookieless
 *   · X-Robots-Tag: noindex — the JSON is for machines, the pages are for the index
 *   · a stable error envelope, never a stack trace
 */
import { createHash } from 'node:crypto';
import { checkRateLimit, getClientIp, type RateLimitConfig } from '@/lib/rate-limit';

export const API_VERSION = 'v1';

export const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, if-none-match',
  'access-control-expose-headers': 'etag, last-modified, x-registry-version, x-ratelimit-remaining',
  'access-control-max-age': '86400',
};

/** Public, cacheable for five minutes at the client, an hour at the edge, a day stale. */
export const CACHE_PUBLIC = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';
/** Computed answers: cacheable per URL, briefly. POST responses are not cached by the edge. */
export const CACHE_COMPUTED = 'public, max-age=60, s-maxage=300';

export type JsonOptions = {
  status?: number;
  cache?: string;
  updatedAt?: string;
  version?: string;
  /** The request, for conditional GET. */
  request?: Request;
  extraHeaders?: Record<string, string>;
};

export const etagFor = (body: string): string => `"${createHash('sha256').update(body).digest('hex').slice(0, 32)}"`;

const toHttpDate = (iso: string): string | undefined => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? undefined : new Date(t).toUTCString();
};

export function json(data: unknown, opts: JsonOptions = {}): Response {
  const body = JSON.stringify(data, null, 2);
  const etag = etagFor(body);
  const headers: Record<string, string> = {
    ...CORS_HEADERS,
    'content-type': 'application/json; charset=utf-8',
    'cache-control': opts.cache ?? CACHE_PUBLIC,
    etag,
    vary: 'accept-encoding',
    'x-content-type-options': 'nosniff',
    'x-robots-tag': 'noindex',
    'x-api-version': API_VERSION,
    ...(opts.version ? { 'x-registry-version': opts.version } : {}),
    ...(opts.extraHeaders ?? {}),
  };
  const lm = opts.updatedAt ? toHttpDate(opts.updatedAt) : undefined;
  if (lm) headers['last-modified'] = lm;

  const inm = opts.request?.headers.get('if-none-match');
  if ((opts.status ?? 200) === 200 && inm && inm.split(',').map((s) => s.trim()).includes(etag)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(body, { status: opts.status ?? 200, headers });
}

export type ApiErrorCode =
  | 'not_found'
  | 'invalid_request'
  | 'payload_too_large'
  | 'rate_limited'
  | 'method_not_allowed'
  | 'unsupported';

export function error(code: ApiErrorCode, message: string, status: number, details?: unknown): Response {
  return json(
    { error: { code, message, ...(details !== undefined ? { details } : {}) } },
    { status, cache: 'no-store' },
  );
}

export function options(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** The one rate limit for the computed endpoints: per client IP, per instance. */
export const MATCH_POST_LIMIT: RateLimitConfig = { maxRequests: 30, windowMs: 60_000 };
export const MAX_BODY_BYTES = 8 * 1024;

/**
 * Read and validate a small JSON body. Rejects oversized payloads before
 * parsing and never echoes the raw body back.
 */
export async function readJsonBody(request: Request): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  const len = Number(request.headers.get('content-length') ?? '0');
  if (len > MAX_BODY_BYTES) return { ok: false, response: error('payload_too_large', `Body must be ${MAX_BODY_BYTES} bytes or less.`, 413) };
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, response: error('invalid_request', 'Unreadable body.', 400) };
  }
  if (text.length > MAX_BODY_BYTES) return { ok: false, response: error('payload_too_large', `Body must be ${MAX_BODY_BYTES} bytes or less.`, 413) };
  if (!text.trim()) return { ok: true, body: {} };
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, response: error('invalid_request', 'Body must be valid JSON.', 400) };
  }
}

export function rateLimited(request: Request, config: RateLimitConfig = MATCH_POST_LIMIT): Response | null {
  const ip = getClientIp(request);
  const r = checkRateLimit(`api-v1:${ip}`, config);
  if (r.allowed) return null;
  return json(
    { error: { code: 'rate_limited', message: 'Too many requests. Try again shortly.' } },
    { status: 429, cache: 'no-store', extraHeaders: { 'retry-after': String(Math.max(1, Math.ceil((r.resetAt - Date.now()) / 1000))) } },
  );
}
