/**
 * GET /api/v1/media/{id} — one project's stills, films and before/after pairs,
 * every URL absolute. 404 is JSON, never an HTML error page.
 */
import { handleMediaProject } from '@/lib/registry/handlers';
import { options } from '@/lib/registry/http';

export const dynamic = 'force-dynamic';

export const GET = (request: Request, ctx: { params: Promise<{ id: string }> }) =>
  ctx.params.then(({ id }) => handleMediaProject(request, id));
export const OPTIONS = options;
