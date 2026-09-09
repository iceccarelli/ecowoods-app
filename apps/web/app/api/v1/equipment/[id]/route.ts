/**
 * GET /api/v1/equipment/{id} — one machine, every figure with its source URL.
 * 404 is JSON, never an HTML error page.
 */
import { handleEquipmentMachine } from '@/lib/registry/handlers';
import { options } from '@/lib/registry/http';

export const dynamic = 'force-dynamic';

export const GET = (request: Request, ctx: { params: Promise<{ id: string }> }) =>
  ctx.params.then(({ id }) => handleEquipmentMachine(request, id));
export const OPTIONS = options;
