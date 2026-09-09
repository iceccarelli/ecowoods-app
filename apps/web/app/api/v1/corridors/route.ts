/**
 * GET /api/v1/corridors — see lib/registry/handlers.ts and /api/v1/openapi.json.
 */
import { handleCorridors } from '@/lib/registry/handlers';
import { options } from '@/lib/registry/http';

export const dynamic = 'force-dynamic';

export const GET = (request: Request) => handleCorridors(request);
export const OPTIONS = options;
