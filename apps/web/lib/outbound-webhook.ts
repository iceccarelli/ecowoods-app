/**
 * Outbound fetch destination guards (Protocol v2, Stages 31–32).
 *
 * Two places this server fetches a URL it did not type itself:
 *
 *   1. LEADS_WEBHOOK_URL / PILOT_LEADS_WEBHOOK_URL — an operator-supplied CRM
 *      hook that receives lead PII. `safeWebhookUrl` refuses anything that is
 *      not a public https origin, so a mis-set variable (or a compromised
 *      dashboard) cannot turn the lead routes into a probe of the private
 *      network, a plaintext leak, or a redirect-follower. `postWebhook` sends
 *      with no redirects and a hard timeout.
 *
 *   2. Stored document URLs (quotePdfUrl, invoice.pdfUrl, contractPdfUrl) —
 *      written by lib/pdf/storage.ts, read back by /api/docs/*. The value in
 *      the database is allow-listed by host before it is fetched, so a row
 *      edited by hand or by a future bug cannot make the route proxy an
 *      arbitrary URL to an authenticated user.
 *
 * Pure functions, no Prisma, no Next imports — covered by tests/security.test.ts.
 */

const PRIVATE_HOSTNAMES = new Set(['localhost', 'localhost.localdomain', 'ip6-localhost', 'ip6-loopback']);

/** Dotted-quad IPv4 in a private, loopback, link-local, or otherwise non-public range. */
function isPrivateIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10) return true; // 10/8
  if (a === 127) return true; // 127/8 loopback
  if (a === 0) return true; // 0/8 "this network"
  if (a === 169 && b === 254) return true; // 169.254/16 link-local (cloud metadata lives here)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  if (a >= 224) return true; // multicast / reserved / broadcast
  return false;
}

/** Any IPv6 literal that is loopback, unspecified, unique-local, link-local, or an IPv4-mapped private address. */
function isPrivateIpv6(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === '::1' || h === '::' || h === '0:0:0:0:0:0:0:1') return true;
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return true; // fc00::/7 unique local
  if (/^fe[89ab][0-9a-f]:/.test(h)) return true; // fe80::/10 link local
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(h);
  if (mapped) return isPrivateIpv4(mapped[1]!);
  return false;
}

/** A bare IP literal of either family. */
function isIpLiteral(hostname: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true;
  return hostname.startsWith('[') || hostname.includes(':');
}

/**
 * Returns the parsed URL if it is a public https destination, else null.
 *
 * Refused: non-https schemes, embedded credentials, `localhost` and friends,
 * every private/loopback/link-local range of either family, and ANY bare IP
 * literal — a webhook lives on a hostname, and a literal is how a scanner is
 * aimed. Only the syntactic form is checked; DNS is not resolved here, so a
 * hostname that resolves to a private address is not caught (the timeout and
 * `redirect: 'error'` bound what such a request could do).
 */
export function safeWebhookUrl(raw: string | undefined | null): URL | null {
  if (!raw || typeof raw !== 'string') return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  const hostname = url.hostname.toLowerCase();
  if (!hostname) return null;
  if (PRIVATE_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) return null;
  // The WHATWG parser canonicalises every IPv4 spelling (hex, octal, shorthand)
  // to a dotted quad and brackets every IPv6, so the range checks see one form.
  if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) return null;
  if (isIpLiteral(hostname)) return null; // a public literal is still not a webhook
  return url;
}

const warned = new Set<string>();

/**
 * Resolve an env var to a safe webhook URL, logging ONCE per variable when it
 * is set but unusable. Returns null when unset or refused.
 */
export function webhookFromEnv(name: string): URL | null {
  const raw = process.env[name];
  if (!raw) return null;
  const url = safeWebhookUrl(raw);
  if (!url && !warned.has(name)) {
    warned.add(name);
    console.warn(
      JSON.stringify({
        event: 'webhook.refused',
        env: name,
        reason: 'not a public https URL (bare IP, private range, loopback, or non-https) — forward skipped',
      }),
    );
  }
  return url;
}

export const WEBHOOK_TIMEOUT_MS = 3000;

/**
 * POST a JSON payload to an already-validated webhook. Redirects are an error
 * (a 3xx to an internal address would otherwise be followed with the body),
 * and the call is abandoned after WEBHOOK_TIMEOUT_MS.
 */
export async function postWebhook(url: URL, payload: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    redirect: 'error',
    signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
  });
}

/**
 * Hosts a stored document URL may point at. Vercel Blob (what
 * lib/pdf/storage.ts writes in production), the Supabase project's storage
 * host when that fallback is configured, and the site's own canonical host.
 */
export function isAllowedDocumentUrl(
  raw: string | null | undefined,
  env: { siteUrl?: string; supabaseUrl?: string } = {
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  },
): boolean {
  if (!raw || typeof raw !== 'string') return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  if (host.endsWith('.public.blob.vercel-storage.com')) return true;
  const hostOf = (u?: string) => {
    try {
      return u ? new URL(u).hostname.toLowerCase() : null;
    } catch {
      return null;
    }
  };
  const site = hostOf(env.siteUrl ?? 'https://ecowoods.ca');
  if (site && host === site) return true;
  const supabase = hostOf(env.supabaseUrl);
  if (supabase && host === supabase) return true;
  return false;
}
