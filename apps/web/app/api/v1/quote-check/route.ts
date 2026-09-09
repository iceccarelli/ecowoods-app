/**
 * GET /api/v1/quote-check — see lib/registry/handlers.ts and /api/v1/openapi.json.
 * The scope checklist as data. Pure, cacheable, and free of any price figure.
 */
import { handleQuoteCheck } from '@/lib/registry/handlers';
import { options } from '@/lib/registry/http';

export const dynamic = 'force-dynamic';

export const GET = (request: Request) => handleQuoteCheck(request);
export const OPTIONS = options;
