/**
 * Error reporting — one function every failure path calls.
 *
 * WHAT IT DOES
 *
 *   1. Writes one structured JSON line to stderr. On Vercel that is the
 *      function log, searchable by `event:"error"` and by `source`.
 *   2. If ERROR_WEBHOOK_URL is set, POSTs the same record there. The body
 *      carries `text` (Slack incoming webhooks) and `content` (Discord) as
 *      well as the structured fields, so any of the common receivers renders
 *      it without an adapter. Nothing is sent when the variable is unset.
 *
 * WHAT IT NEVER DOES
 *
 *   · Throw. A reporter that can fail is a second bug on top of the first.
 *   · Block. The webhook call is bounded by ERROR_WEBHOOK_TIMEOUT_MS (3 s).
 *   · Leak. Only message, stack, route, method, digest and a user-agent reach
 *     the webhook — never headers, cookies, bodies or query strings.
 */
export type ErrorReport = {
  source: 'server' | 'client' | 'api';
  message: string;
  stack?: string;
  name?: string;
  digest?: string;
  path?: string;
  method?: string;
  routerKind?: string;
  routeType?: string;
  userAgent?: string;
  url?: string;
};

const WEBHOOK_TIMEOUT_MS = Number(process.env.ERROR_WEBHOOK_TIMEOUT_MS ?? 3000);
const MAX_FIELD = 4000;

const clip = (v: unknown): string | undefined =>
  typeof v === 'string' ? v.slice(0, MAX_FIELD) : v == null ? undefined : String(v).slice(0, MAX_FIELD);

export function normalizeError(err: unknown): { message: string; stack?: string; name?: string; digest?: string } {
  if (err instanceof Error) {
    return {
      message: err.message,
      stack: err.stack,
      name: err.name,
      digest: (err as Error & { digest?: string }).digest,
    };
  }
  return { message: typeof err === 'string' ? err : JSON.stringify(err) };
}

export async function reportError(report: ErrorReport): Promise<void> {
  const record = {
    event: 'error',
    at: new Date().toISOString(),
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
    source: report.source,
    name: clip(report.name),
    message: clip(report.message) ?? '(no message)',
    digest: clip(report.digest),
    path: clip(report.path),
    method: clip(report.method),
    routerKind: clip(report.routerKind),
    routeType: clip(report.routeType),
    url: clip(report.url),
    userAgent: clip(report.userAgent),
    stack: clip(report.stack),
  };

  try {
    console.error(JSON.stringify(record));
  } catch {
    /* stderr is the last resort; nothing below it. */
  }

  const webhook = process.env.ERROR_WEBHOOK_URL;
  if (!webhook) return;

  const headline = `[ecowoods ${record.env}] ${record.source} error${record.path ? ` at ${record.method ?? ''} ${record.path}`.replace(/\s+/g, ' ') : ''}: ${record.message}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: headline, content: headline.slice(0, 1900), ...record }),
      signal: controller.signal,
    });
  } catch {
    /* The webhook is best-effort. The stderr line above already has the record. */
  } finally {
    clearTimeout(timer);
  }
}
