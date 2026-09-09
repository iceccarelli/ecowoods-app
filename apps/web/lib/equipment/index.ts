/**
 * lib/equipment — professional sanding equipment, as published.
 *
 * One import surface for the /equipment pages, the agentic API and the guard.
 * Every constant behind it carries a manufacturer source URL and a verification
 * date; scripts/verify-equipment.mjs fails the build on one that does not.
 */
export { MACHINES, machineById } from '@/content/equipment/machines';
export type { Machine, PowerSpec, SpecSource } from '@/content/equipment/machines';
export {
  assess,
  circuitLoad,
  CONTINUOUS_LOAD_FACTOR,
  type Service,
  type Verdict,
  type Assessment,
  type CircuitResult,
} from './power';
