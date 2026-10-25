/**
 * lib/search-console.ts — Google Search Console performance data, read-only.
 *
 * WHY. Everything else on /admin/markets and /admin/funnel says what this site
 * IS. Only Search Console says what people actually searched for, which pages
 * were shown and which were clicked. It is the one authorised source for
 * search demand and for how a market page is really doing, and nothing here
 * invents any of it: without credentials the report says "not connected" and
 * names exactly what is missing.
 *
 * HOW. A Google service account (Search Console → Settings → Users and
 * permissions → add the service account's email as a Restricted user) signs a
 * JWT with node:crypto — no dependency — and exchanges it for a read-only
 * token. Configure three environment variables:
 *
 *   GSC_CLIENT_EMAIL   the service account's email
 *   GSC_PRIVATE_KEY    its private key (PEM; "\n" sequences are accepted)
 *   GSC_SITE           "sc-domain:ecowoods.ca" or "https://ecowoods.ca/"
 *
 * The private key is never logged or returned. Search Console data runs about
 * two days behind, so the window ends two days ago.
 */
import { createSign } from 'node:crypto';

export interface GscConfig { clientEmail: string; privateKey: string; site: string }

export type GscConfigState =
  | { configured: true; config: GscConfig }
  | { configured: false; missing: string[] };

export function gscConfig(env: Record<string, string | undefined> = process.env): GscConfigState {
  const clientEmail = env.GSC_CLIENT_EMAIL?.trim();
  const privateKey = env.GSC_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  const site = env.GSC_SITE?.trim();
  const missing = [
    !clientEmail && 'GSC_CLIENT_EMAIL',
    !privateKey && 'GSC_PRIVATE_KEY',
    !site && 'GSC_SITE',
  ].filter(Boolean) as string[];
  if (missing.length || !clientEmail || !privateKey || !site) return { configured: false, missing };
  return { configured: true, config: { clientEmail, privateKey, site } };
}

const b64url = (v: string | Buffer): string => Buffer.from(v).toString('base64url');

/** The signed assertion Google exchanges for an access token. */
export function signAssertion(cfg: GscConfig, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: cfg.clientEmail,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  }));
  const sig = createSign('RSA-SHA256').update(`${head}.${claim}`).sign(cfg.privateKey);
  return `${head}.${claim}.${b64url(sig)}`;
}

type Fetch = typeof fetch;

async function accessToken(cfg: GscConfig, f: Fetch): Promise<string> {
  const res = await f('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: signAssertion(cfg) }),
  });
  if (!res.ok) throw new Error(`Google token request failed (${res.status})`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('Google token response had no access_token');
  return json.access_token;
}

export interface GscRow { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }

export const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

/** [start, end] covering `days` days, ending two days ago (the data's lag). */
export function windowFor(days: number, now = new Date()): { startDate: string; endDate: string } {
  const end = new Date(now.getTime() - 2 * 864e5);
  const start = new Date(end.getTime() - (days - 1) * 864e5);
  return { startDate: isoDay(start), endDate: isoDay(end) };
}

export async function queryPerformance(
  cfg: GscConfig,
  opts: { days: number; dimensions: Array<'page' | 'query' | 'country' | 'device'>; rowLimit?: number },
  f: Fetch = fetch,
): Promise<GscRow[]> {
  const token = await accessToken(cfg, f);
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(cfg.site)}/searchAnalytics/query`;
  const res = await f(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ ...windowFor(opts.days), dimensions: opts.dimensions, rowLimit: opts.rowLimit ?? 1000 }),
  });
  if (!res.ok) throw new Error(`Search Console query failed (${res.status})`);
  const json = (await res.json()) as { rows?: GscRow[] };
  return json.rows ?? [];
}

/* ── turning URLs into the things this business decides about ─────────────── */

export type PageKind = 'service-area' | 'service' | 'guide' | 'commercial' | 'pricing' | 'estimate' | 'home' | 'other';

export function classifyPage(url: string): { kind: PageKind; slug: string | null; path: string } {
  let path = url;
  try { path = new URL(url).pathname; } catch { /* already a path */ }
  path = path.replace(/\/+$/, '') || '/';
  const seg = path.split('/').filter(Boolean);
  if (path === '/') return { kind: 'home', slug: null, path };
  if (seg[0] === 'service-areas' && seg[1]) return { kind: 'service-area', slug: seg[1], path };
  if (seg[0] === 'services' && seg[1]) return { kind: 'service', slug: seg[1], path };
  if (seg[0] === 'guides' && seg[1]) return { kind: 'guide', slug: seg[1], path };
  if (seg[0] === 'commercial') return { kind: 'commercial', slug: null, path };
  if (seg[0] === 'pricing') return { kind: 'pricing', slug: null, path };
  if (seg[0] === 'estimate') return { kind: 'estimate', slug: null, path };
  return { kind: 'other', slug: seg[0] ?? null, path };
}

export interface Rollup { key: string; clicks: number; impressions: number; ctr: number; position: number; pages: number }

/** Sum rows by a key; position is impression-weighted, ctr recomputed from totals. */
export function rollup(rows: GscRow[], keyOf: (row: GscRow) => string): Rollup[] {
  const acc = new Map<string, { clicks: number; impressions: number; posWeighted: number; pages: number }>();
  for (const r of rows) {
    const k = keyOf(r);
    const a = acc.get(k) ?? { clicks: 0, impressions: 0, posWeighted: 0, pages: 0 };
    a.clicks += r.clicks;
    a.impressions += r.impressions;
    a.posWeighted += r.position * r.impressions;
    a.pages += 1;
    acc.set(k, a);
  }
  return [...acc].map(([key, a]) => ({
    key,
    clicks: a.clicks,
    impressions: a.impressions,
    ctr: a.impressions ? a.clicks / a.impressions : 0,
    position: a.impressions ? a.posWeighted / a.impressions : 0,
    pages: a.pages,
  })).sort((x, y) => y.clicks - x.clicks || y.impressions - x.impressions || x.key.localeCompare(y.key));
}

/**
 * Pages that are being shown but not chosen: real impressions, ranked on page
 * one or two, and a click-through rate under what that position usually earns.
 * These are the cheapest wins — better title, answer and proof, not a new page.
 */
export function nearMisses(rows: GscRow[], minImpressions = 50): GscRow[] {
  return rows
    .filter((r) => r.impressions >= minImpressions && r.position >= 3 && r.position <= 15 && r.ctr < 0.03)
    .sort((a, b) => b.impressions - a.impressions);
}
