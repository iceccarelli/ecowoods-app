/**
 * GET /api/v1/media — see lib/registry/handlers.ts and /api/v1/openapi.json.
 * Public, cacheable, absolute URLs. No auth: media metadata about completed
 * work is exactly the thing this business wants quoted.
 */
import { handleMediaIndex } from '@/lib/registry/handlers';
import { options } from '@/lib/registry/http';

export const dynamic = 'force-dynamic';

export const GET = (request: Request) => handleMediaIndex(request);
export const OPTIONS = options;
