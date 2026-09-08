/**
 * lib/wood/emc.ts — equilibrium moisture content from temperature and humidity.
 *
 * WHY THIS IS IN THE CODEBASE AND NOT IN A BLOG POST
 *
 * Every page on this site tells a homeowner that wood moves with humidity, and
 * /papers/toronto-hardwood-climate-moisture-protocol publishes the numbers that
 * make Toronto hard: 18–25% RH in winter, above 60% in summer, 35–55% safe.
 * Not one surface has ever told a person what those numbers do to THEIR floor.
 * That is the gap this module closes, and it is closed with physics rather than
 * with an adjective.
 *
 * THE MODEL
 *
 * Hailwood–Luikov sorption isotherm as fitted by Simpson and published as
 * equation (4–5) of the Wood Handbook (FPL-GTR-190, chapter 4):
 *
 *     M = (1800/W)·[ Kh/(1−Kh) + (K₁Kh + 2K₁K₂K²h²)/(1 + K₁Kh + K₁K₂K²h²) ]
 *
 * with h the relative humidity as a fraction and W, K, K₁, K₂ temperature-
 * dependent coefficients. Two coefficient sets are published, one for °F and
 * one for °C. They are SEPARATE least-squares fits, not unit conversions of
 * each other, so this module implements the °F set — the form Simpson
 * published and the one with the wider published validation — and converts a
 * Celsius input to Fahrenheit before evaluating. Converting the INPUT is unit
 * arithmetic; converting between the two fitted coefficient sets would not be.
 *
 * WHY YOU CAN TRUST THE IMPLEMENTATION
 *
 * `emc.test.ts` asserts this function against fifteen published values from
 * Wood Handbook Table 4–2, spanning 30–180 °F and 20–90% RH. It agrees to
 * within 0.053 percentage points of moisture content — the table is printed to
 * one decimal, so that is the table's own rounding and not an error in the
 * code. A change to this file that breaks the physics fails the build.
 *
 * WHAT IT IS NOT
 *
 * EMC is treated as species-independent — the Wood Handbook says explicitly
 * that for most practical purposes Table 4–2 applies to wood of any species.
 * Dimensional MOVEMENT is emphatically not species-independent; that lives in
 * ./species.ts and ./movement.ts.
 */

/** Published validity envelope. Outside it the sorption fit degrades. */
export const EMC_VALID = {
  minTempF: 35,
  maxTempF: 180,
  minRhPct: 20,
  maxRhPct: 80,
} as const;

export const EMC_SOURCE = {
  equation: 'Wood Handbook (FPL-GTR-190) equation 4–5, Hailwood–Luikov as fitted by Simpson',
  table: 'Wood Handbook (FPL-GTR-190) Table 4–2',
  url: 'https://www.fpl.fs.usda.gov/documnts/fplgtr/fplgtr190/chapter_04.pdf',
  /**
   * Simpson's published deviation against the measured data: average under
   * 0.13 percentage points of moisture content, never more than 0.9.
   */
  statedAccuracy: 'average deviation under 0.13% MC, maximum 0.9% MC (Simpson, USDA FPL)',
} as const;

export const cToF = (celsius: number): number => (celsius * 9) / 5 + 32;

/**
 * Equilibrium moisture content, in percent, for a temperature in °F and a
 * relative humidity given as a PERCENT (65, not 0.65).
 *
 * Returns null rather than a number when the inputs are outside the range the
 * published fit covers. A calculator that answers confidently at 95% RH is
 * worse than one that declines: above roughly 90% the isotherm becomes very
 * sensitive to small humidity errors, and the answer would look authoritative
 * while being unreliable.
 */
export function emcFromFahrenheit(tempF: number, rhPct: number): number | null {
  if (!Number.isFinite(tempF) || !Number.isFinite(rhPct)) return null;
  if (rhPct <= 0 || rhPct >= 100) return null;

  const h = rhPct / 100;
  const T = tempF;

  const W = 330 + 0.452 * T + 0.00415 * T * T;
  const K = 0.791 + 0.000463 * T - 0.000000844 * T * T;
  const K1 = 6.34 + 0.000775 * T - 0.0000935 * T * T;
  const K2 = 1.09 + 0.0284 * T - 0.0000904 * T * T;

  const Kh = K * h;
  const denomFirst = 1 - Kh;
  if (denomFirst <= 0) return null;

  const second =
    (K1 * Kh + 2 * K1 * K2 * Kh * Kh) / (1 + K1 * Kh + K1 * K2 * Kh * Kh);

  const m = (1800 / W) * (Kh / denomFirst + second);
  return Number.isFinite(m) ? m : null;
}

/** Same model, Celsius input. Toronto is the audience; Celsius is the unit. */
export function emcFromCelsius(tempC: number, rhPct: number): number | null {
  return emcFromFahrenheit(cToF(tempC), rhPct);
}

/** Is this condition inside the range the published fit actually covers? */
export function isWithinPublishedRange(tempC: number, rhPct: number): boolean {
  const f = cToF(tempC);
  return (
    f >= EMC_VALID.minTempF &&
    f <= EMC_VALID.maxTempF &&
    rhPct >= EMC_VALID.minRhPct &&
    rhPct <= EMC_VALID.maxRhPct
  );
}
