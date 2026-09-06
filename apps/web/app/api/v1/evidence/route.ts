/**
 * GET /api/v1/evidence — see lib/registry/handlers.ts and /api/v1/openapi.json.
 * Dynamic on purpose: the handler answers conditional requests (If-None-Match)
 * and the edge caches per URL via s-maxage. Never force-static.
 */
import { handleEvidence } from '@/lib/registry/handlers';
import { options } from '@/lib/registry/http';

export const dynamic = 'force-dynamic';

export const GET = (request: Request) => handleEvidence(request);
export const OPTIONS = options;
