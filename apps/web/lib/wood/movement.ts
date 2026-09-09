/**
 * lib/wood/movement.ts — what a specific floor will actually do.
 *
 * This is the module the whole exercise exists for. Given a species, a board
 * width, a grain orientation and the two humidity extremes a Toronto interior
 * actually reaches, it answers the question the market never answers:
 *
 *     how many millimetres will each board of MY floor move, and what does
 *     that add up to across the room?
 *
 * THE PHYSICS, IN ORDER
 *
 * 1. Each humidity condition is converted to an equilibrium moisture content
 *    with the Hailwood–Luikov fit (./emc.ts). Wood does not respond to
 *    humidity; it responds to the moisture content humidity drives it to.
 * 2. The dimensional change across the board's width is Wood Handbook
 *    equation (13–2): ΔD = D · C · (M_f − M_i), where C is the tangential
 *    coefficient for flatsawn stock and the radial one for quartersawn.
 * 3. Board movement is multiplied by the number of boards across the run to
 *    get the cumulative movement — which is the number that decides whether an
 *    expansion gap was adequate, and the number nobody is ever given.
 *
 * WHAT THIS DELIBERATELY DOES NOT CLAIM
 *
 * It is a MODEL of unrestrained dimensional change in solid wood. A real floor
 * is fastened, is partly restrained by its own fasteners and by friction, and
 * distributes movement unevenly — some boards take more than their share and
 * some take none, which is exactly why gapping shows up in a few places rather
 * than everywhere. So the output is labelled as the total the floor has to
 * absorb, not as the gap that will appear at any one seam. Engineered flooring
 * is out of scope entirely: its cross-ply core is designed to defeat this
 * calculation, and applying a solid-wood coefficient to it would be wrong in
 * the direction that makes engineered look worse than it is.
 *
 * The 6–14% moisture content limit on the coefficients is enforced, not
 * assumed. Outside it the linear coefficient does not apply and the function
 * says so rather than extrapolating.
 */
import { emcFromCelsius, isWithinPublishedRange } from './emc';
import { widthCoefficient, orientationRatio, type Orientation, type WoodSpecies } from './species';

/** Wood Handbook Table 13–5 is valid over this moisture content band only. */
export const COEFFICIENT_MC_LIMITS = { min: 6, max: 14 } as const;

export type MovementInput = {
  species: WoodSpecies;
  orientation: Orientation;
  /** Face width of one board, in millimetres. */
  boardWidthMm: number;
  /** Width of the run the boards cross, in metres. Optional. */
  runWidthM?: number;
  /** Indoor temperature, °C. One value: interiors are conditioned. */
  tempC: number;
  /** The dry extreme the interior reaches, in percent RH. */
  rhLowPct: number;
  /** The damp extreme, in percent RH. */
  rhHighPct: number;
};

export type MovementResult = {
  emcLowPct: number;
  emcHighPct: number;
  /** Moisture content swing between the two conditions, percentage points. */
  mcSwingPct: number;
  /** Change in the width of ONE board, millimetres, over that swing. */
  boardMovementMm: number;
  /** As a percentage of the board's own width. */
  boardMovementPctOfWidth: number;
  /** Boards across the run, where a run width was given. */
  boardsAcrossRun: number | null;
  /** Cumulative movement the floor has to absorb across the run, millimetres. */
  runMovementMm: number | null;
  /** How much more this moves flatsawn than quartersawn. */
  orientationRatio: number;
  /** True where both EMC values sit inside the 6–14% coefficient band. */
  withinCoefficientRange: boolean;
  /** True where both conditions sit inside the published EMC fit envelope. */
  withinEmcRange: boolean;
  /** Non-fatal, human-readable reasons to treat the number with care. */
  caveats: string[];
};

/**
 * Wood Handbook equation (13–2). Kept as its own exported function because it
 * is what the unit test asserts against the Handbook's published worked
 * example, and a formula that is only reachable through three layers of
 * business logic is a formula nobody can check.
 */
export function dimensionalChange(
  dimension: number,
  coefficient: number,
  mcInitialPct: number,
  mcFinalPct: number,
): number {
  return dimension * coefficient * (mcFinalPct - mcInitialPct);
}

export function computeMovement(input: MovementInput): MovementResult | null {
  const { species, orientation, boardWidthMm, runWidthM, tempC, rhLowPct, rhHighPct } = input;

  if (!Number.isFinite(boardWidthMm) || boardWidthMm <= 0) return null;
  if (rhLowPct >= rhHighPct) return null;

  const emcLow = emcFromCelsius(tempC, rhLowPct);
  const emcHigh = emcFromCelsius(tempC, rhHighPct);
  if (emcLow === null || emcHigh === null) return null;

  const coefficient = widthCoefficient(species, orientation);
  const boardMovementMm = dimensionalChange(boardWidthMm, coefficient, emcLow, emcHigh);

  const boardsAcrossRun =
    runWidthM && runWidthM > 0 ? Math.max(1, Math.floor((runWidthM * 1000) / boardWidthMm)) : null;

  const caveats: string[] = [];

  const withinCoefficientRange =
    emcLow >= COEFFICIENT_MC_LIMITS.min &&
    emcHigh <= COEFFICIENT_MC_LIMITS.max &&
    emcHigh >= COEFFICIENT_MC_LIMITS.min;
  if (!withinCoefficientRange) {
    caveats.push(
      `The published coefficients are valid from ${COEFFICIENT_MC_LIMITS.min}% to ${COEFFICIENT_MC_LIMITS.max}% moisture content. This range reaches ${emcLow.toFixed(1)}%–${emcHigh.toFixed(1)}%, so the figure is an extrapolation at one end and understates what a floor in those conditions really does.`,
    );
  }

  const withinEmcRange =
    isWithinPublishedRange(tempC, rhLowPct) && isWithinPublishedRange(tempC, rhHighPct);
  if (!withinEmcRange) {
    caveats.push(
      'One or both humidity values sit outside the range over which the moisture-content model was published and validated (20%–80% RH). Treat the result as indicative.',
    );
  }

  if (species.commercialGroup) {
    caveats.push(
      `“${species.label}” is a commercial group in the source table rather than a single botanical species. Individual boards vary around the group value.`,
    );
  }

  return {
    emcLowPct: emcLow,
    emcHighPct: emcHigh,
    mcSwingPct: emcHigh - emcLow,
    boardMovementMm,
    boardMovementPctOfWidth: (boardMovementMm / boardWidthMm) * 100,
    boardsAcrossRun,
    runMovementMm: boardsAcrossRun === null ? null : boardMovementMm * boardsAcrossRun,
    orientationRatio: orientationRatio(species),
    withinCoefficientRange,
    withinEmcRange,
    caveats,
  };
}
