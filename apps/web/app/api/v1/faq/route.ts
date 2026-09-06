/**
 * GET /api/v1/faq — see lib/registry/handlers.ts and /api/v1/openapi.json.
 * Dynamic on purpose: the handler answers conditional requests (If-None-Match)
 * and the edge caches per URL via s-maxage. Never force-static.
 */
import { handleFaq } from '@/lib/registry/handlers';
import { options } from '@/lib/registry/http';

export const dynamic = 'force-dynamic';

export const GET = (request: Request) => handleFaq(request);
export const OPTIONS = options;
