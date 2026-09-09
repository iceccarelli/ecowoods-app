/**
 * GET /api/v1/equipment — see lib/registry/handlers.ts and /api/v1/openapi.json.
 * Pure and cacheable. `?volts=&amps=` runs the circuit assessment; without it
 * the response is the published specification alone.
 */
import { handleEquipmentIndex } from '@/lib/registry/handlers';
import { options } from '@/lib/registry/http';

export const dynamic = 'force-dynamic';

export const GET = (request: Request) => handleEquipmentIndex(request);
export const OPTIONS = options;
