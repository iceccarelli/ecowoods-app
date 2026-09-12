/**
 * The catalogue's contract, asserted.
 *
 * Three of these tests exist because of a specific way this feature could
 * quietly become a liability:
 *
 *   · "every product's rateKey resolves" — a typo here renders a floor whose
 *     price silently falls back to red oak. The homeowner sees a walnut floor
 *     and an oak number.
 *   · "no price literal is produced here" — the range must be byte-identical to
 *     what estimateInstalledRangeCad returns for the same inputs, because
 *     /design and EcowoodsGuide both call it directly.
 *   · "every layable configuration prices and moves" — the matcher iterates the
 *     whole space; one unpriceable member makes the studio throw in front of a
 *     customer.
 */
import { describe, expect, it } from 'vitest';
import {
  FINISH_OPTIONS,
  PATTERN_OPTIONS,
  estimateInstalledRangeCad,
} from '@ecowoods/shared/ai';
import { SPECIES as WOOD_SPECIES } from '@/lib/wood';
import { bandForWork, PRICE_BANDS } from '@/content/constants/pricing';
import {
  BOARD_WIDTHS,
  DEFAULT_CONFIGURATION,
  FLOOR_PRODUCTS,
  allConfigurations,
  configurationId,
  describeConfiguration,
  incompatibilities,
  isLayable,
  movementFor,
  parseConfigurationId,
  priceConfiguration,
  productById,
  widthById,
  withAxis,
} from './catalog';

describe('catalogue integrity', () => {
  it('every product resolves to a published band', () => {
    /* GEO-005. This asserted against FLOORING_RATES_CAD_PER_SQFT, a per-species
       rate table that was not the published band and disagreed with it by up to
       $4/sq ft. There is no rate table now: a product names the work, and the
       work selects a band this business actually publishes. */
    for (const p of FLOOR_PRODUCTS) {
      const band = bandForWork(p.rateKey);
      expect(band, `${p.id} → ${p.rateKey}`).toBeDefined();
      expect(PRICE_BANDS.some((b) => b.min === band.min && b.max === band.max), `${p.id} band is published`).toBe(true);
    }
  });

  it('every product resolves to a species in the published movement table', () => {
    for (const p of FLOOR_PRODUCTS) {
      expect(
        WOOD_SPECIES.some((s) => s.id === p.movementSpeciesId),
        `${p.id} → ${p.movementSpeciesId}`,
      ).toBe(true);
    }
  });

  it('every product offers only finishes that exist', () => {
    const ids = new Set(FINISH_OPTIONS.map((f) => f.id));
    for (const p of FLOOR_PRODUCTS) {
      for (const f of p.finishes) expect(ids.has(f), `${p.id} → ${f}`).toBe(true);
    }
  });

  it('product and width ids are unique', () => {
    expect(new Set(FLOOR_PRODUCTS.map((p) => p.id)).size).toBe(FLOOR_PRODUCTS.length);
    expect(new Set(BOARD_WIDTHS.map((w) => w.id)).size).toBe(BOARD_WIDTHS.length);
  });

  it('the default configuration is layable', () => {
    expect(isLayable(DEFAULT_CONFIGURATION)).toBe(true);
  });
});

describe('compatibility is chemistry and geometry', () => {
  it('refuses fuming on a species with no tannin to react', () => {
    const reasons = incompatibilities({
      productId: 'hard-maple',
      finishId: 'smoked',
      patternId: 'straight',
      widthId: '5',
    });
    expect(reasons).toHaveLength(1);
    expect(reasons[0]!.axis).toBe('finish');
    expect(reasons[0]!.reason).toMatch(/tannin/i);
  });

  it('allows fuming on oak, which has the tannin', () => {
    for (const id of ['white-oak', 'red-oak']) {
      expect(
        isLayable({ productId: id, finishId: 'smoked', patternId: 'straight', widthId: '5' }),
      ).toBe(true);
    }
  });

  it('refuses block patterns above five inches', () => {
    for (const pattern of ['herringbone', 'chevron']) {
      expect(
        isLayable({ productId: 'white-oak', finishId: 'satin', patternId: pattern, widthId: '7' }),
      ).toBe(false);
      expect(
        isLayable({ productId: 'white-oak', finishId: 'satin', patternId: pattern, widthId: '5' }),
      ).toBe(true);
    }
  });

  it('names the axis that broke, so the UI can say why', () => {
    const reasons = incompatibilities({
      productId: 'white-oak',
      finishId: 'satin',
      patternId: 'chevron',
      widthId: '8-plus',
    });
    expect(reasons.map((r) => r.axis)).toEqual(['width']);
  });
});

describe('withAxis never strands a visitor on a floor that does not exist', () => {
  it('repairs the finish when the species cannot take it', () => {
    const from = { productId: 'white-oak', finishId: 'smoked', patternId: 'straight', widthId: '5' };
    const { config, repairedAxes } = withAxis(from, 'productId', 'hard-maple');
    expect(config.productId).toBe('hard-maple');
    expect(repairedAxes).toContain('finishId');
    expect(isLayable(config)).toBe(true);
  });

  it('repairs the pattern when the visitor widened the board', () => {
    const from = { productId: 'white-oak', finishId: 'satin', patternId: 'herringbone', widthId: '5' };
    const { config, repairedAxes } = withAxis(from, 'widthId', '8-plus');
    expect(config.widthId).toBe('8-plus');
    expect(repairedAxes).toContain('patternId');
    expect(isLayable(config)).toBe(true);
  });

  it('repairs the width when the visitor chose the pattern', () => {
    const from = { productId: 'white-oak', finishId: 'satin', patternId: 'straight', widthId: '8-plus' };
    const { config, repairedAxes } = withAxis(from, 'patternId', 'chevron');
    expect(config.patternId).toBe('chevron');
    expect(repairedAxes).toContain('widthId');
    expect(isLayable(config)).toBe(true);
  });

  it('never touches the axis the visitor just moved', () => {
    for (const product of FLOOR_PRODUCTS) {
      for (const pattern of PATTERN_OPTIONS) {
        const { config } = withAxis(DEFAULT_CONFIGURATION, 'patternId', pattern.id);
        expect(config.patternId).toBe(pattern.id);
        const moved = withAxis(DEFAULT_CONFIGURATION, 'productId', product.id);
        expect(moved.config.productId).toBe(product.id);
      }
    }
  });
});

describe('identity round-trips', () => {
  it('parses back everything it serialises', () => {
    for (const config of allConfigurations()) {
      expect(parseConfigurationId(configurationId(config))).toEqual(config);
    }
  });

  it('refuses an id that names a floor we do not lay', () => {
    expect(parseConfigurationId('hard-maple__smoked__straight__5')).toBeNull();
    expect(parseConfigurationId('white-oak__satin__chevron__7')).toBeNull();
    expect(parseConfigurationId('nonsense')).toBeNull();
    expect(parseConfigurationId('a__b__c__d')).toBeNull();
  });

  it('describes a configuration in one line naming all four axes', () => {
    const line = describeConfiguration(DEFAULT_CONFIGURATION);
    expect(line.split(' · ')).toHaveLength(4);
    expect(line).toContain('White Oak');
  });
});

describe('price is a delegation, not a calculation', () => {
  it('returns exactly what estimateInstalledRangeCad returns', () => {
    const config = { productId: 'black-walnut', finishId: 'wire-brushed', patternId: 'herringbone', widthId: '5' };
    const mine = priceConfiguration(config, 900);
    const theirs = estimateInstalledRangeCad({
      species: productById('black-walnut')!.rateKey,
      squareFeet: 900,
      finish: 'wire-brushed',
      pattern: 'herringbone',
      band: bandForWork(productById('black-walnut')!.rateKey),
    });
    expect(mine).toEqual(theirs);
  });

  it('never falls back — every product is a known species', () => {
    for (const p of FLOOR_PRODUCTS) {
      const r = priceConfiguration(
        { productId: p.id, finishId: 'satin', patternId: 'straight', widthId: '5' },
        900,
      );
      expect(r.speciesFallback, p.id).toBe(false);
    }
  });

  it('board width does not move the published band', () => {
    const at5 = priceConfiguration({ productId: 'white-oak', finishId: 'satin', patternId: 'straight', widthId: '5' }, 900);
    const at8 = priceConfiguration({ productId: 'white-oak', finishId: 'satin', patternId: 'straight', widthId: '8-plus' }, 900);
    expect(at8.estimatedLowCad).toBe(at5.estimatedLowCad);
    expect(at8.estimatedHighCad).toBe(at5.estimatedHighCad);
  });

  it('prices and moves every layable configuration', () => {
    const configs = allConfigurations();
    expect(configs.length).toBeGreaterThan(50);
    for (const config of configs) {
      const price = priceConfiguration(config, 900);
      expect(price.estimatedLowCad).toBeGreaterThan(0);
      expect(price.estimatedHighCad).toBeGreaterThan(price.estimatedLowCad);
      expect(movementFor(config)).not.toBeNull();
    }
  });
});

describe('movement comes from the published coefficients', () => {
  it('a wider board of the same species moves further', () => {
    const narrow = movementFor({ productId: 'white-oak', finishId: 'satin', patternId: 'straight', widthId: '3-25' })!;
    const wide = movementFor({ productId: 'white-oak', finishId: 'satin', patternId: 'straight', widthId: '8-plus' })!;
    expect(wide.boardMovementMm).toBeGreaterThan(narrow.boardMovementMm);
  });

  it('walnut moves less than white oak at the same width, as the table says', () => {
    const walnut = movementFor({ productId: 'black-walnut', finishId: 'satin', patternId: 'straight', widthId: '5' })!;
    const oak = movementFor({ productId: 'white-oak', finishId: 'satin', patternId: 'straight', widthId: '5' })!;
    expect(walnut.boardMovementMm).toBeLessThan(oak.boardMovementMm);
  });

  it('says it is arithmetic rather than a promise', () => {
    const note = movementFor(DEFAULT_CONFIGURATION)!;
    expect(note.sentence).toMatch(/not a warranty/i);
    expect(note.sentence).toMatch(/Wood Handbook/);
  });
});

describe('widths', () => {
  it('resolves each width and orders them ascending', () => {
    const inches = BOARD_WIDTHS.map((w) => w.inches);
    expect([...inches].sort((a, b) => a - b)).toEqual(inches);
    for (const w of BOARD_WIDTHS) expect(widthById(w.id)).toBe(w);
  });
});
