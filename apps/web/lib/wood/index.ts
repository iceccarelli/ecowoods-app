/**
 * lib/wood — the hardwood movement engine.
 *
 * One import surface for the calculator page, the agentic API and anything
 * downstream. Every constant behind it is copied from a published table and
 * every formula is asserted in wood.test.ts against a published value.
 */
export {
  emcFromCelsius,
  emcFromFahrenheit,
  isWithinPublishedRange,
  cToF,
  EMC_VALID,
  EMC_SOURCE,
} from './emc';

export {
  SPECIES,
  SPECIES_SOURCE,
  speciesById,
  widthCoefficient,
  orientationRatio,
  type Orientation,
  type WoodSpecies,
} from './species';

export {
  computeMovement,
  dimensionalChange,
  COEFFICIENT_MC_LIMITS,
  type MovementInput,
  type MovementResult,
} from './movement';
