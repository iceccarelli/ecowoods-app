/**
 * lib/assistant-workspace/conversation-access.ts — who may touch a
 * conversation.
 *
 * `designId` names a DESIGN and is deliberately shareable (Floor Studio's
 * share link carries it — lib/floor-studio/design-id.ts). It must therefore
 * never be the credential for the PRIVATE things hung off it: the transcript
 * (names, address), and the room photos. That credential is a separate,
 * random, unguessable capability minted server-side when the conversation is
 * created, delivered ONLY as an httpOnly cookie to the browser that created
 * it, and stored ONLY as a SHA-256 hash. A forwarded share link carries the
 * designId and never the cookie, so it opens the floor and nothing else.
 *
 * An account-linked conversation (userId set) is authorised by the session
 * instead; the token is not consulted for it.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const ACCESS_COOKIE_PREFIX = 'ew_ac_';
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;
/** 32 random bytes, base64url — 43 chars. Anything else is rejected before hashing. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

export function newAccessToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashAccessToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** The capability the request presents for `designId`, or null. Never throws. */
export function readAccessToken(request: Request, designId: string | undefined): string | null {
  if (!designId) return null;
  const header = request.headers.get('cookie');
  if (!header) return null;
  const name = `${ACCESS_COOKIE_PREFIX}${designId}`;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const value = part.slice(eq + 1).trim();
    return TOKEN_SHAPE.test(value) ? value : null;
  }
  return null;
}

/** Set-Cookie value for a freshly minted capability. */
export function serializeAccessCookie(designId: string, token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${ACCESS_COOKIE_PREFIX}${designId}=${token}; Path=/api/assistant; Max-Age=${ONE_YEAR_SECONDS}; HttpOnly; SameSite=Lax${secure}`;
}

export interface ConversationAccessRow {
  userId: string | null;
  accessTokenHash: string | null;
}

/**
 * The single authorisation rule. Account-linked → only that session.
 * Anonymous → only the holder of the token whose hash is stored. A legacy
 * anonymous row with no stored hash is authorised for NOBODY.
 */
export function isConversationAuthorized(row: ConversationAccessRow, viewerUserId: string | null, token: string | null): boolean {
  if (row.userId) return row.userId === viewerUserId;
  if (!row.accessTokenHash || !token) return false;
  const a = Buffer.from(hashAccessToken(token), 'hex');
  const b = Buffer.from(row.accessTokenHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
