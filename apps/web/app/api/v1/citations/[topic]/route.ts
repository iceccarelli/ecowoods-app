/**
 * GET /api/v1/citations/[topic] — see lib/registry/handlers.ts and /api/v1/openapi.json.
 * Dynamic on purpose: the handler answers conditional requests (If-None-Match)
 * and the edge caches per URL via s-maxage. Never force-static.
 */
import { handleCitation } from '@/lib/registry/handlers';
import { options } from '@/lib/registry/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  return handleCitation(request, topic);
}
export const OPTIONS = options;
