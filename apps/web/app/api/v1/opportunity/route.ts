/**
 * GET /api/v1/opportunity — removed; answers 410 Gone with a pointer to
 * /api/v1/markets. The model now lives behind /api/internal/market-intelligence.
 */
import { handleOpportunity } from '@/lib/registry/handlers';
import { options } from '@/lib/registry/http';

export const dynamic = 'force-dynamic';

export const GET = (request: Request) => handleOpportunity(request);
export const OPTIONS = options;
