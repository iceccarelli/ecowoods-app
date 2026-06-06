/**
 * Auth.js v5 — catch-all route handler
 * All auth requests (/api/auth/signin, /api/auth/session, etc.) handled here.
 */
import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
