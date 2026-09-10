/**
 * GET /api/v1/framework — see lib/registry/handlers.ts and /api/v1/openapi.json.
 * The Well-Installed Framework as citable data, criterion by criterion.
 */
import { handleFramework } from '@/lib/registry/handlers';
import { options } from '@/lib/registry/http';

export const dynamic = 'force-dynamic';

export const GET = (request: Request) => handleFramework(request);
export const OPTIONS = options;
