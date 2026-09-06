/**
 * GET /api/v1/services/[id] — see lib/registry/handlers.ts and /api/v1/openapi.json.
 * Dynamic on purpose: the handler answers conditional requests (If-None-Match)
 * and the edge caches per URL via s-maxage. Never force-static.
 */
import { handleService } from '@/lib/registry/handlers';
import { options } from '@/lib/registry/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleService(request, id);
}
export const OPTIONS = options;
