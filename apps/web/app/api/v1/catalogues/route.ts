/**
 * GET /api/v1/catalogues — see lib/registry/handlers.ts and /api/v1/openapi.json.
 * The field catalogues as data: what each covers, and which page argues it.
 */
import { handleCatalogues } from '@/lib/registry/handlers';
import { options } from '@/lib/registry/http';

export const dynamic = 'force-dynamic';

export const GET = (request: Request) => handleCatalogues(request);
export const OPTIONS = options;
