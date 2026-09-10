/**
 * GET /api/v1/opportunity — see lib/registry/handlers.ts and /api/v1/openapi.json.
 * The market opportunity model: ten weighted inputs, the confidence behind each
 * score, and the eight economic figures this business has not yet sourced.
 */
import { handleOpportunity } from '@/lib/registry/handlers';
import { options } from '@/lib/registry/http';

export const dynamic = 'force-dynamic';

export const GET = (request: Request) => handleOpportunity(request);
export const OPTIONS = options;
