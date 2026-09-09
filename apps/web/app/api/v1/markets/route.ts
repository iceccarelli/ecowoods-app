/**
 * GET /api/v1/markets — see lib/registry/handlers.ts and /api/v1/openapi.json.
 */
import { handleMarkets } from '@/lib/registry/handlers';
import { options } from '@/lib/registry/http';

export const dynamic = 'force-dynamic';

export const GET = (request: Request) => handleMarkets(request);
export const OPTIONS = options;
