/**
 * services/render-api/src/keys.ts — who is calling, and how much have they used.
 *
 * An API you SELL needs three things this file provides and the site's own
 * /api/v1 deliberately does not have: a caller identity, a limit, and a record
 * you can bill from. /api/v1 is open on purpose — it exists to be crawled and
 * cited, and metering it would defeat its entire reason for existing. This
 * service is the opposite: it spends real CPU per request, so every request has
 * to be attributable to somebody.
 *
 * KEYS LIVE IN THE ENVIRONMENT, HASHED.
 *
 *   RENDER_API_KEYS="acme:<sha256 of the secret>:200, globex:<sha256>:60"
 *
 * The secret itself is never stored, here or on the machine — only its SHA-256,
 * so a leaked environment does not leak a working key. The comparison is
 * timing-safe: a plain `===` on a secret leaks its prefix to anyone willing to
 * measure, which is a real attack on an endpoint that answers in milliseconds.
 *
 * Everything here is pure and takes its inputs as arguments, so keys.test.ts
 * can hold it to a number rather than to a description.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

export type Plan = {
  id: string;
  /** Requests per minute. */
  limit: number;
};

export type KeyRecord = Plan & { hash: string };

export const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

/** Parse `id:hash:limit` triples. A malformed entry is dropped, never guessed. */
export function parseKeys(spec: string | undefined): Map<string, KeyRecord> {
  const out = new Map<string, KeyRecord>();
  for (const part of (spec ?? '').split(',')) {
    const [id, hash, limit] = part.trim().split(':');
    if (!id || !hash || hash.length !== 64) continue;
    const n = Number(limit);
    out.set(id, { id, hash: hash.toLowerCase(), limit: Number.isFinite(n) && n > 0 ? n : 60 });
  }
  return out;
}

/**
 * `Authorization: Bearer ew_live_<id>_<secret>`.
 *
 * The id travels in the clear so a request can be attributed before the secret
 * is checked — which is what lets a bad key be rate-limited rather than being
 * a free oracle.
 */
export function parseBearer(header: string | undefined): { id: string; secret: string } | null {
  const m = /^Bearer\s+ew_live_([A-Za-z0-9-]{1,40})_([A-Za-z0-9_-]{16,128})$/.exec((header ?? '').trim());
  return m ? { id: m[1]!, secret: m[2]! } : null;
}

export function verify(header: string | undefined, keys: Map<string, KeyRecord>): KeyRecord | null {
  const parsed = parseBearer(header);
  if (!parsed) return null;
  const rec = keys.get(parsed.id);
  if (!rec) return null;
  const a = Buffer.from(sha256(parsed.secret), 'hex');
  const b = Buffer.from(rec.hash, 'hex');
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? rec : null;
}

/**
 * A fixed-window counter, per key, per minute.
 *
 * NOT a token bucket and not distributed. This service is one machine and the
 * limit exists to stop one caller spending the CPU everybody else is waiting
 * for, not to bill by the millisecond. Fly scales it by adding machines, and
 * the moment there is more than one the limit becomes per machine — which is
 * stated here rather than discovered in production, and is the reason
 * fly.toml pins `max_machines_count = 1` until there is a shared counter.
 */
export class RateLimiter {
  /* Plain fields and an explicit assignment, NOT a constructor parameter
     property. Node's strip-only type stripping cannot emit the assignment a
     parameter property implies and refuses the file outright — which this
     service runs on, in the container, with no build step to paper over it. */
  private readonly hits: Map<string, { window: number; n: number }>;
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.hits = new Map();
    this.now = now;
  }

  /** Returns how many requests remain, or null when the caller is over. */
  take(key: KeyRecord): { remaining: number; resetSeconds: number } | null {
    const window = Math.floor(this.now() / 60_000);
    const cur = this.hits.get(key.id);
    const resetSeconds = 60 - Math.floor((this.now() % 60_000) / 1000);
    if (!cur || cur.window !== window) {
      this.hits.set(key.id, { window, n: 1 });
      return { remaining: key.limit - 1, resetSeconds };
    }
    if (cur.n >= key.limit) return null;
    cur.n += 1;
    return { remaining: key.limit - cur.n, resetSeconds };
  }

  /** Drop windows nobody is in any more, so a long uptime is not a slow leak. */
  sweep(): void {
    const window = Math.floor(this.now() / 60_000);
    for (const [id, v] of this.hits) if (v.window < window - 1) this.hits.delete(id);
  }
}

export type UsageLine = {
  event: 'render_api.request';
  key: string;
  route: string;
  status: number;
  ms: number;
  pixels?: number;
  at: string;
};

/**
 * One JSON line per request, on stdout.
 *
 * Fly ships stdout to its log stream, so this IS the billing record for now —
 * and the README says so plainly rather than implying a ledger that does not
 * exist. A durable table in the app's Postgres is the next slice; nothing here
 * has to change for it, because the shape is already the shape of a row.
 */
export const usageLine = (u: Omit<UsageLine, 'event' | 'at'>): string =>
  JSON.stringify({ event: 'render_api.request', ...u, at: new Date().toISOString() });
