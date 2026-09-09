/**
 * GET /api/v1/movement — see lib/registry/handlers.ts and /api/v1/openapi.json.
 * Pure: no side effects, no storage, no network. Every input is a query
 * parameter, so the same question is the same URL and the edge caches it.
 */
import { handleMovement } from '@/lib/registry/handlers';
import { options } from '@/lib/registry/http';

export const dynamic = 'force-dynamic';

export const GET = (request: Request) => handleMovement(request);
export const OPTIONS = options;
