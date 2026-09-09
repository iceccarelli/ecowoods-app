import { describe, it, expect } from 'vitest';
import { emcFromFahrenheit, emcFromCelsius, cToF } from './emc';
import { SPECIES, speciesById, widthCoefficient, orientationRatio } from './species';
import { computeMovement, dimensionalChange } from './movement';

/**
 * These tests assert against PUBLISHED NUMBERS, not against this
 * implementation's own output.
 *
 * That distinction is the entire value of the file. A test that snapshots what
 * the code currently returns proves the code has not changed. These prove the
 * code agrees with the Wood Handbook — so if someone later "simplifies" a
 * coefficient or reorders a term in the sorption isotherm, the build fails
 * against the United States Forest Products Laboratory rather than against a
 * fixture somebody wrote on a Tuesday.
 */

describe('EMC — Wood Handbook Table 4–2', () => {
  /**
   * Fifteen anchors spanning 30–180 °F and 20–90% RH, read from Table 4–2.
   * The table prints to one decimal place, so 0.06 is the tightest tolerance
   * the published data can support.
   */
  const TABLE_4_2: Array<[tempF: number, rhPct: number, publishedEmc: number]> = [
    [70, 20, 4.5],
    [70, 30, 6.2],
    [70, 40, 7.7],
    [70, 50, 9.2],
    [70, 60, 11.0],
    [70, 65, 12.0],
    [70, 70, 13.1],
    [70, 80, 16.0],
    [70, 90, 20.5],
    [30, 30, 6.3],
    [50, 50, 9.5],
    [80, 65, 11.7],
    [100, 80, 15.1],
    [140, 50, 7.7],
    [180, 65, 8.6],
  ];

  it.each(TABLE_4_2)('%i °F at %i%% RH is %f%% MC', (tempF, rhPct, published) => {
    const value = emcFromFahrenheit(tempF, rhPct);
    expect(value).not.toBeNull();
    expect(Math.abs(value! - published)).toBeLessThanOrEqual(0.06);
  });

  it('reproduces the classic 70 °F / 65% reference condition', () => {
    expect(emcFromFahrenheit(70, 65)!).toBeCloseTo(12.0, 1);
  });

  it('agrees with itself across the unit boundary', () => {
    // 21.1 °C is 70 °F to within a rounding step.
    expect(Math.abs(emcFromCelsius(21.1, 65)! - emcFromFahrenheit(70, 65)!)).toBeLessThan(0.02);
    expect(cToF(0)).toBe(32);
    expect(cToF(100)).toBe(212);
  });

  it('refuses impossible humidity rather than returning a confident number', () => {
    expect(emcFromFahrenheit(70, 0)).toBeNull();
    expect(emcFromFahrenheit(70, 100)).toBeNull();
    expect(emcFromFahrenheit(Number.NaN, 50)).toBeNull();
  });

  it('reproduces the NWFA 30–50% RH in-service band as roughly 6–9% MC', () => {
    // NWFA states that its recommended 30–50% RH range coincides with the
    // 6–9% moisture content most hardwood flooring is manufactured to. Two
    // independent sources agreeing is worth a test.
    expect(emcFromFahrenheit(70, 30)!).toBeGreaterThan(6);
    expect(emcFromFahrenheit(70, 30)!).toBeLessThan(6.5);
    expect(emcFromFahrenheit(70, 50)!).toBeGreaterThan(9);
    expect(emcFromFahrenheit(70, 50)!).toBeLessThan(9.5);
  });
});

describe('dimensional change — Wood Handbook worked example', () => {
  /**
   * Verbatim from chapter 13: a flat-grained white fir board 232 mm wide at 8%
   * moisture content, taken to 11%, with C = 0.00245, changes by 1.705 mm and
   * finishes at 233.7 mm.
   */
  it('reproduces the published white fir example', () => {
    const delta = dimensionalChange(232, 0.00245, 8, 11);
    expect(delta).toBeCloseTo(1.705, 3);
    expect(232 + delta).toBeCloseTo(233.7, 1);
  });

  it('is signed — losing moisture shrinks the board', () => {
    expect(dimensionalChange(232, 0.00245, 11, 8)).toBeCloseTo(-1.705, 3);
  });
});

describe('species coefficients — Wood Handbook Table 13–5', () => {
  /**
   * The Handbook derives Table 13–5 from total shrinkage with a straight-line
   * relationship from a 30% fibre saturation point, which closes to
   *
   *     C = S / (3000 − 20·S)
   *
   * for S given as a percentage. Reproducing the published coefficient from
   * the published shrinkage, for species that are single species rather than
   * commercial groups, is an independent check that the table was transcribed
   * correctly rather than typed from memory.
   */
  const fromShrinkage = (s: number) => s / (3000 - 20 * s);

  const SINGLE_SPECIES: Array<[id: string, radialShrinkage: number, tangentialShrinkage: number]> = [
    ['hard-maple', 4.8, 9.9],
    ['black-walnut', 5.5, 7.8],
    ['white-ash', 4.9, 7.8],
    ['yellow-birch', 7.3, 9.5],
    ['black-cherry', 3.7, 7.1],
  ];

  it.each(SINGLE_SPECIES)(
    '%s coefficients follow from its published shrinkage',
    (id, radial, tangential) => {
      const species = speciesById(id)!;
      expect(species).toBeDefined();
      expect(fromShrinkage(radial)).toBeCloseTo(species.cRadial, 5);
      expect(fromShrinkage(tangential)).toBeCloseTo(species.cTangential, 5);
    },
  );

  it('keeps the two hickories apart', () => {
    const pecan = speciesById('pecan-hickory')!;
    const trueHickory = speciesById('true-hickory')!;
    expect(pecan.cTangential).not.toBe(trueHickory.cTangential);
    expect(trueHickory.cTangential / pecan.cTangential).toBeGreaterThan(1.25);
  });

  it('never moves more radially than tangentially', () => {
    for (const s of SPECIES) {
      expect(s.cTangential).toBeGreaterThan(s.cRadial);
    }
  });

  it('selects the radial coefficient for quartersawn stock', () => {
    const whiteOak = speciesById('white-oak')!;
    expect(widthCoefficient(whiteOak, 'flatsawn')).toBe(0.00365);
    expect(widthCoefficient(whiteOak, 'quartersawn')).toBe(0.0018);
    expect(orientationRatio(whiteOak)).toBeCloseTo(2.03, 2);
  });
});

describe('computeMovement — the Toronto case', () => {
  /**
   * The published Toronto indoor range from
   * /papers/toronto-hardwood-climate-moisture-protocol: 18–25% RH in winter,
   * above 60% in summer. This uses 25% and 60% — the conservative end of both
   * — at a normal indoor 21 °C.
   */
  const toronto = { tempC: 21, rhLowPct: 25, rhHighPct: 60 } as const;

  it('moves a 5-inch flatsawn white oak board by a millimetre and a half or more', () => {
    const result = computeMovement({
      species: speciesById('white-oak')!,
      orientation: 'flatsawn',
      boardWidthMm: 127,
      runWidthM: 4,
      ...toronto,
    })!;
    expect(result).not.toBeNull();
    expect(result.boardMovementMm).toBeGreaterThan(1.5);
    expect(result.boardsAcrossRun).toBe(31);
    expect(result.runMovementMm).toBeCloseTo(result.boardMovementMm * 31, 6);
  });

  it('cuts that movement roughly in half when the same wood is quartersawn', () => {
    const common = {
      species: speciesById('white-oak')!,
      boardWidthMm: 127,
      ...toronto,
    };
    const flat = computeMovement({ ...common, orientation: 'flatsawn' })!;
    const quarter = computeMovement({ ...common, orientation: 'quartersawn' })!;
    expect(flat.boardMovementMm / quarter.boardMovementMm).toBeCloseTo(2.03, 2);
  });

  it('flags the commercial-group caveat, and does not flag it for a true species', () => {
    const oak = computeMovement({
      species: speciesById('white-oak')!,
      orientation: 'flatsawn',
      boardWidthMm: 89,
      ...toronto,
    })!;
    const cherry = computeMovement({
      species: speciesById('black-cherry')!,
      orientation: 'flatsawn',
      boardWidthMm: 89,
      ...toronto,
    })!;
    expect(oak.caveats.some((c) => c.includes('commercial group'))).toBe(true);
    expect(cherry.caveats.some((c) => c.includes('commercial group'))).toBe(false);
  });

  it('warns rather than extrapolating silently below the coefficient band', () => {
    // 15% RH drives EMC under the 6% floor of Table 13–5.
    const result = computeMovement({
      species: speciesById('hard-maple')!,
      orientation: 'flatsawn',
      boardWidthMm: 89,
      tempC: 21,
      rhLowPct: 15,
      rhHighPct: 60,
    })!;
    expect(result.withinCoefficientRange).toBe(false);
    expect(result.caveats.join(' ')).toContain('moisture content');
  });

  it('refuses a reversed humidity range', () => {
    expect(
      computeMovement({
        species: speciesById('white-oak')!,
        orientation: 'flatsawn',
        boardWidthMm: 127,
        tempC: 21,
        rhLowPct: 60,
        rhHighPct: 25,
      }),
    ).toBeNull();
  });
});
