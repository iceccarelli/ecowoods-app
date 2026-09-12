/**
 * apps/web/content/constants/pricing.ts — THE published price bands.
 *
 * WHY THIS FILE EXISTS WHEN lib/pricing.ts ALREADY DID
 *
 * It did not already do this. `lib/pricing.ts` held the three bands as bare
 * `{ min, max, label }` triples with no unit and no currency attached to them,
 * and every call site supplied those two facts itself — a `$` typed into a
 * template literal here, the string "per sq ft" typed into a sentence there.
 * That is two claims per price, restated by hand at every surface, and neither
 * of them was covered by any guard. A band rendered as `$4.75–$7.50` in a
 * schema `Offer` with no `priceCurrency` is read by Google as USD. Nothing in
 * this repository would have caught that.
 *
 * So the band now carries its own unit and its own currency, the three
 * canonical names the brief names them by, and the rule is absolute:
 *
 *   No component, schema builder, calculator, llms surface, Markdown mirror,
 *   API route or citation block may contain a price literal. It imports from
 *   here or it does not have a price.
 *
 * `scripts/verify-pricing-source.mjs` scans the whole tree for a decimal price
 * literal outside this file and fails the build on any hit. That guard is the
 * point of the file; the constants are just what it is guarding.
 *
 * SOURCE OF THE NUMBERS
 *
 * Owner-published service bands, unchanged from lib/pricing.ts, which is now a
 * re-export of this module. Changing a band means changing it here, once. Every
 * rendered surface follows, including the ones nobody remembers exist.
 *
 * WHY A BAND NOW KNOWS WHICH CURRENCY IT IS (GEO-003)
 *
 * `currency` was the literal type `'CAD'`, and the formatters below wrote a
 * bare `$`. That was sound while one currency existed and became the most
 * dangerous line in the repository the moment a second one was contemplated:
 * `$4.75–$7.50` is byte-identical whether it means Canadian or American
 * dollars, and `tests/drift.test.ts` asserts that exact string is present on
 * every surface. A band rendered in the wrong currency would therefore have
 * passed every guard, every test and the build, and been read as a price by a
 * customer.
 *
 * So the currency is part of the type and part of the STRING. A band in the
 * site's home currency reads exactly as it always did — nothing published today
 * changes — and any other currency names itself wherever it is written. The
 * existing presence assertions then distinguish the two for free, because the
 * strings differ, which is worth more than a new guard that has to remember to
 * look.
 */

/**
 * ISO 4217, and only the currencies this business actually publishes in.
 * Widening this list is a business decision, not a typing convenience.
 */
export type Currency = 'CAD' | 'USD';

/**
 * The currency this site is written in. A band in it is written plainly; a band
 * in any other currency carries its code in the rendered string. This is the
 * one place that asymmetry is decided.
 */
export const HOME_CURRENCY: Currency = 'CAD';

export type PriceBand = {
  /** Low end of the published band, per `unit`, in `currency`. */
  readonly min: number;
  /** High end of the published band, per `unit`, in `currency`. */
  readonly max: number;
  /** The denominator. Every band on this site is per square foot. */
  readonly unit: 'sq ft';
  /** ISO 4217. Present so no schema `Offer` can be emitted currency-less. */
  readonly currency: Currency;
  /** Customer-facing name of the service this band belongs to. */
  readonly label: string;
  /** The `PRICING` key and `SERVICE_PAGES.pricing` key this band backs. */
  readonly key: 'screenAndRecoat' | 'fullSandAndFinish' | 'newInstall';
};

/** Existing finish is sound; abrade and recoat without going to bare wood. */
export const SCREEN_RECOAT: PriceBand = {
  min: 2.5,
  max: 4.0,
  unit: 'sq ft',
  currency: 'CAD',
  label: 'Screen & Recoat',
  key: 'screenAndRecoat',
} as const;

/** Sand to bare wood, re-stain where specified, re-finish. */
export const FULL_SAND_FINISH: PriceBand = {
  min: 4.75,
  max: 7.5,
  unit: 'sq ft',
  currency: 'CAD',
  label: 'Full Sand & Finish',
  key: 'fullSandAndFinish',
} as const;

/** New hardwood supplied and installed, solid or engineered. */
export const NEW_INSTALL: PriceBand = {
  min: 11.0,
  max: 18.0,
  unit: 'sq ft',
  currency: 'CAD',
  label: 'New Hardwood Install',
  key: 'newInstall',
} as const;

/** All three, in the order a homeowner meets them: cheapest intervention first. */
export const PRICE_BANDS = [SCREEN_RECOAT, FULL_SAND_FINISH, NEW_INSTALL] as const;

/** Keyed by the name every existing consumer already uses. */
export const PRICE_BANDS_BY_KEY = {
  screenAndRecoat: SCREEN_RECOAT,
  fullSandAndFinish: FULL_SAND_FINISH,
  newInstall: NEW_INSTALL,
} as const;

export type PriceBandKey = keyof typeof PRICE_BANDS_BY_KEY;

/**
 * The code a band carries in prose: nothing for the home currency, the ISO code
 * for anything else. `$4.75–$7.50` on a Canadian site needs no decoration;
 * `$4.00–$6.25 USD` on the same site does, and a reader who meets the second
 * string can never mistake it for the first.
 */
const code = (b: PriceBand): string => (b.currency === HOME_CURRENCY ? '' : ` ${b.currency}`);

/**
 * "$4.75–$7.50 per sq ft" — the ONE way a band is written in prose.
 *
 * En dash, not a hyphen: a hyphen between two numbers reads as a subtraction to
 * a parser and as a typo to a reader. Two decimal places always, because
 * "$4.75–$7.5" is the kind of detail that makes a published price look
 * unpublished. A band outside the home currency reads "$4.00–$6.25 USD per sq
 * ft"; the code sits with the number, not at the end of the sentence, because
 * the number is what gets quoted out of context.
 */
export const formatBand = (b: PriceBand): string =>
  `$${b.min.toFixed(2)}–$${b.max.toFixed(2)}${code(b)} per ${b.unit}`;

/** "$4.75–$7.50" — for tables and schema where the unit is its own column. */
export const formatBandBare = (b: PriceBand): string =>
  `$${b.min.toFixed(2)}–$${b.max.toFixed(2)}${code(b)}`;

/**
 * The distinct currencies in a band set, written for prose: "CAD", or
 * "CAD and USD".
 *
 * `/llms.txt` said `${PRICE_BANDS[0].currency}` in two places and meant "the
 * currency this site publishes in" — true only for as long as the array holds
 * one. Reading the set says what is actually there.
 */
export const currenciesIn = (bands: readonly PriceBand[]): string => {
  const list = [...new Set(bands.map((b) => b.currency))];
  if (list.length <= 1) return list[0] ?? HOME_CURRENCY;
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
};

/**
 * A schema.org `PriceSpecification` for a band, with the currency attached.
 *
 * Not optional and not inferred. `UnitPriceSpecification` without
 * `priceCurrency` defaults to nothing at all in Google's parser, and a
 * `unitCode` of `FTK` is the UN/CEFACT code for square foot — the field exists
 * precisely so a price per area is not read as a price per item.
 */
export const priceSpecification = (b: PriceBand) => ({
  '@type': 'UnitPriceSpecification' as const,
  priceCurrency: b.currency,
  minPrice: b.min,
  maxPrice: b.max,
  unitCode: 'FTK',
  unitText: b.unit,
});
