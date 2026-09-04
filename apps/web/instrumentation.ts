import type { Instrumentation } from 'next';
import { reportError, normalizeError } from '@/lib/error-reporting';

/**
 * Next.js instrumentation — server-side error capture without a vendor SDK.
 *
 * `onRequestError` is invoked by Next for every uncaught error in a server
 * component, route handler, server action or middleware, with the request
 * and the route it failed in. Everything goes through lib/error-reporting,
 * which logs a structured line and (when ERROR_WEBHOOK_URL is set) posts it
 * to the team's webhook.
 */
export function register() {
  /* Nothing to initialise: the reporter is stateless. */
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const e = normalizeError(err);
  await reportError({
    source: 'server',
    ...e,
    path: request.path,
    method: request.method,
    routerKind: context.routerKind,
    routeType: context.routeType,
    userAgent: typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : undefined,
  });
};
