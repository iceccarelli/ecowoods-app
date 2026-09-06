/**
 * POST /api/v1/service-match — see lib/registry/handlers.ts and /api/v1/openapi.json.
 * GET with no query returns usage; GET with ?project=/?query= runs the same
 * computation so a browser or a curl can try it. Pure: no side effects, no
 * network, no storage. Validated with zod, capped at 8 KB, rate limited.
 */
import { handleServiceMatch } from '@/lib/registry/handlers';
import { options } from '@/lib/registry/http';

export const dynamic = 'force-dynamic';

export const GET = (request: Request) => handleServiceMatch(request);
export const POST = (request: Request) => handleServiceMatch(request);
export const OPTIONS = options;
