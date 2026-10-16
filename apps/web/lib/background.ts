import { after } from 'next/server';

/**
 * Keep post-response work alive.
 *
 * On a serverless host the function can be frozen the moment the response is
 * sent, so an un-awaited email or SMS may never leave. `after()` extends the
 * invocation until the promise settles. Outside a request scope (unit tests,
 * scripts) `after` throws; the promise then simply runs as before.
 */
export function runAfterResponse(work: Promise<unknown>): void {
  const settled = work.catch(() => undefined);
  try {
    after(() => settled);
  } catch {
    void settled;
  }
}
