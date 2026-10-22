import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * The single bearer-secret check for cron, internal and IndexNow routes.
 *
 * - Fail-closed: an unset or empty secret authorises nobody (including a
 *   caller that sends "Bearer " or "Bearer undefined").
 * - Accepts only `Authorization: Bearer <secret>` (exact scheme spelling).
 * - Timing-safe and length-safe: both sides are hashed to a fixed width
 *   before `timingSafeEqual`, so neither content nor length leaks through
 *   response timing and `timingSafeEqual` never throws on unequal lengths.
 */
const digest = (value: string): Buffer => createHash('sha256').update(value, 'utf8').digest();

export function isAuthorizedBearer(request: Request, envValue: string | undefined | null): boolean {
  if (typeof envValue !== 'string' || envValue.length === 0) return false;
  const header = request.headers.get('authorization');
  if (!header) return false;
  return timingSafeEqual(digest(header), digest(`Bearer ${envValue}`));
}
