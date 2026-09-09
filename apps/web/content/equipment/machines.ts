/**
 * content/equipment/machines.ts — professional floor sanding equipment, as the
 * manufacturers actually publish it.
 *
 * READ THIS BEFORE ADDING A MACHINE.
 *
 * Every numeric field here carries a `source` URL pointing at the page or PDF
 * it was read from, and a `verifiedAt` date. A field the manufacturer does not
 * publish is `null`. Not estimated, not converted from a dealer listing, not
 * inferred from a similar model — null.
 *
 * That rule is not fastidiousness. A contractor deciding whether a machine will
 * run on a house's electrical service is making a decision with a real failure
 * mode at the end of it, and this site's entire position is that its numbers
 * can be checked. scripts/verify-equipment.mjs fails the build on a value
 * without a source.
 *
 * THREE THINGS DELIBERATELY ABSENT FROM EVERY RECORD
 *
 * 1. NO PRICE. Lägler, Bona and American Sanders publish no list price for any
 *    machine — checked on all three manufacturers' own product and store pages.
 *    American Sanders' store page for the EZ-8 shows a dealer locator and a
 *    phone number where a price would be. So this file publishes no price, and
 *    the type has no field for one. (Lägler North America does publish live
 *    prices for PARTS and consumables; that is a different dataset and it can
 *    be cited when it is built.)
 *
 * 2. NO PRODUCTIVITY FIGURE. No manufacturer in this set publishes square feet
 *    or square metres per hour for any of these machines — searched
 *    specifically, on product pages, technical data sheets and operator's
 *    manuals. Every "600 sq ft/hr" on the internet is somebody's estimate. An
 *    ROI calculator built on one would be arithmetic performed on a guess,
 *    which is worse than no calculator because it looks like an answer.
 *
 * 3. NO WORKING WIDTH FOR LÄGLER MACHINES. Lägler publishes drum and disc
 *    DIAMETER only. The frequently quoted TRIO "340 mm working width" is not a
 *    Lägler figure.
 *
 * WHERE MANUFACTURERS CONTRADICT THEMSELVES, BOTH VALUES ARE RECORDED.
 * `conflicts` is a first-class field. Bona publishes three different weights
 * for the Belt UX across three of its own documents; American Sanders publishes
 * two different weights and two mutually exclusive motor types for the EZ-8.
 * Picking one and presenting it as fact would be inventing certainty the source
 * material does not contain.
 */

export type SpecSource = {
  /** The exact page or PDF the numbers came from. */
  url: string;
  /** What it is, so a reader knows how much weight to give it. */
  kind: 'product-page' | 'technical-data-sheet' | 'operators-manual' | 'parts-list' | 'store-page';
  /** ISO date the URL was read. */
  verifiedAt: string;
  /** Set where the document is the manufacturer's but is hosted elsewhere. */
  distributorHosted?: boolean;
};

export type PowerSpec = {
  /** Nominal supply voltage the machine is built for, in this region. */
  volts: number;
  hertz: number;
  phase: 1 | 3;
  /** Current draw where the manufacturer publishes it. Null is common. */
  amps: number | null;
  /** Minimum circuit protection the manufacturer states. */
  fuseAmps: number | null;
  kilowatts: number | null;
  /** Where the manufacturer publishes horsepower instead of, or as well as, kW. */
  horsepower: number | null;
  /** A connector the machine cannot be run without, e.g. a 30 A twist-lock. */
  connector: string | null;
  source: SpecSource;
};

export type Machine = {
  id: string;
  manufacturer: string;
  model: string;
  category: 'belt-sander' | 'multi-disc-sander' | 'edger' | 'buffer' | 'dust-extractor';
  /** One sentence. What it is for, not what it is like. */
  role: string;
  /** North American configuration. This is the one that decides a job. */
  northAmerica: PowerSpec | null;
  /** The European configuration, where the manufacturer's own page shows it. */
  europe: PowerSpec | null;
  weightKg: number | null;
  weightSource: SpecSource | null;
  /** Drum or disc diameter, millimetres. Not a working width. */
  drumOrDiscMm: number | null;
  discCount: number | null;
  rpm: number | null;
  /** Belt or disc format as the manufacturer states it. */
  abrasive: string | null;
  dustExtraction: 'on-board-bag' | 'requires-external' | 'is-the-extractor' | null;
  dimensionsSource: SpecSource | null;
  /** Documented disagreements between the manufacturer's own publications. */
  conflicts: string[];
  /** Everything the manufacturer does not publish for this machine. */
  notPublished: string[];
};

const LAEGLER_HUMMEL: SpecSource = { url: 'https://www.laegler.com/en/products/machines/hummel', kind: 'product-page', verifiedAt: '2026-09-08' };
const LAEGLER_HUMMEL_NA: SpecSource = { url: 'https://www.laglernorthamerica.com/catalog/hummel-parts/hummel-motor-electrical/', kind: 'parts-list', verifiedAt: '2026-09-08' };
const LAEGLER_TRIO: SpecSource = { url: 'https://www.laegler.com/en/products/machines/trio', kind: 'product-page', verifiedAt: '2026-09-08' };
const LAEGLER_TRIO_NA: SpecSource = { url: 'https://www.laglernorthamerica.com/product/p974-motor-trio-220v/', kind: 'parts-list', verifiedAt: '2026-09-08' };
const LAEGLER_FLIP: SpecSource = { url: 'https://www.laegler.com/en/products/machines/flip', kind: 'product-page', verifiedAt: '2026-09-08' };
const LAEGLER_FLIP_NA: SpecSource = { url: 'https://www.laglernorthamerica.com/wp-content/uploads/2020/02/parts-flip.pdf', kind: 'parts-list', verifiedAt: '2026-09-08' };
const LAEGLER_UNICO: SpecSource = { url: 'https://www.laegler.com/en/products/machines/unico', kind: 'product-page', verifiedAt: '2026-09-08' };
const LAEGLER_UNICO_PARTS: SpecSource = { url: 'https://www.laegler.com/fileadmin/user_upload/Downloads/PDF-Dokumente/Ersatzteillisten/EN/AL_00-465-20-802_2025-05-12__UNICO_Spare_Parts_English.pdf', kind: 'parts-list', verifiedAt: '2026-09-08' };
const BONA_BELT_UX_TDS: SpecSource = { url: 'https://www.bona.com/globalassets/catalogassets/bona-belt-ux-tds.pdf', kind: 'technical-data-sheet', verifiedAt: '2026-09-08' };
const BONA_BELT_UX_MANUAL: SpecSource = { url: 'https://www.bona.com/globalassets/catalogassets/bona-belt-ux_manual_2023_us.pdf', kind: 'operators-manual', verifiedAt: '2026-09-08' };
const BONA_BELT_TDS: SpecSource = { url: 'https://www.bona.com/globalassets/catalogassets/bona-belt-tds.pdf', kind: 'technical-data-sheet', verifiedAt: '2026-09-08' };
const BONA_POWER_DRIVE: SpecSource = { url: 'https://www.bona.com/globalassets/catalogassets/bona-power-drive-tds-2025.pdf', kind: 'technical-data-sheet', verifiedAt: '2026-09-08' };
const BONA_FLEXISAND: SpecSource = { url: 'https://www.bona.com/globalassets/catalogassets/tech-data-sheet--bona-flexisand-1.9-2024---.pdf', kind: 'technical-data-sheet', verifiedAt: '2026-09-08' };
const BONA_EDGE_UX: SpecSource = { url: 'https://www.bona.com/globalassets/catalogassets/tech-data-sheet---bona-edge-ux--eng-2020.pdf', kind: 'technical-data-sheet', verifiedAt: '2026-09-08' };
const BONA_DCS50: SpecSource = { url: 'https://www.bona.com/globalassets/catalogassets/bona-dcs-50-tds.pdf', kind: 'technical-data-sheet', verifiedAt: '2026-09-08' };
const AS_EZ8_MANUAL: SpecSource = { url: 'https://www.americansanders.com/docs/default-source/machine-manuals/ez8_manual_lt069300_020723.pdf', kind: 'operators-manual', verifiedAt: '2026-09-08' };
const AS_EZ8_PDS: SpecSource = { url: 'https://www.americansanders.com/docs/default-source/pds/ez-8-pds_en_0904206823b1adf30c47f7a223d3b9046c95db.pdf', kind: 'technical-data-sheet', verifiedAt: '2026-09-08' };
const AS_SUPER7R: SpecSource = { url: 'https://www.americansanders.com/docs/default-source/machine-manuals/super7r_068500_042622-web.pdf', kind: 'operators-manual', verifiedAt: '2026-09-08' };
const AS_B2: SpecSource = { url: 'https://americansanders.com/docs/default-source/machine-manuals/lt068200_b-2_dc_edger_042622-web.pdf', kind: 'operators-manual', verifiedAt: '2026-09-08' };

export const MACHINES: Machine[] = [
  {
    id: 'laegler-hummel',
    manufacturer: 'Lägler',
    model: 'HUMMEL',
    category: 'belt-sander',
    role: 'The main belt sander for taking a floor to bare wood.',
    northAmerica: { volts: 220, hertz: 60, phase: 1, amps: null, fuseAmps: null, kilowatts: 2.9, horsepower: null, connector: null, source: LAEGLER_HUMMEL_NA },
    europe: { volts: 230, hertz: 50, phase: 1, amps: null, fuseAmps: 16, kilowatts: 2.2, horsepower: null, connector: null, source: LAEGLER_HUMMEL },
    weightKg: 79,
    weightSource: LAEGLER_HUMMEL,
    drumOrDiscMm: 200,
    discCount: null,
    rpm: 2400,
    abrasive: '200 × 750 mm belt',
    dustExtraction: 'on-board-bag',
    dimensionsSource: LAEGLER_HUMMEL,
    conflicts: [],
    notPublished: [
      'Horsepower — Lägler publishes kW only.',
      'Current draw — the product page gives a minimum fuse rating, not amps.',
      'Working width, as distinct from the 200 mm drum width.',
      'The North American weight; 79 kg is the European figure.',
    ],
  },
  {
    id: 'laegler-trio',
    manufacturer: 'Lägler',
    model: 'TRIO',
    category: 'multi-disc-sander',
    role: 'Three-disc machine for flattening and for finish sanding without drum marks.',
    northAmerica: { volts: 220, hertz: 60, phase: 1, amps: null, fuseAmps: null, kilowatts: 1.8, horsepower: null, connector: null, source: LAEGLER_TRIO_NA },
    europe: { volts: 230, hertz: 50, phase: 1, amps: null, fuseAmps: 16, kilowatts: 1.8, horsepower: null, connector: null, source: LAEGLER_TRIO },
    weightKg: 76,
    weightSource: LAEGLER_TRIO,
    drumOrDiscMm: 200,
    discCount: 3,
    rpm: 600,
    abrasive: '200 mm discs, three of them',
    dustExtraction: 'on-board-bag',
    dimensionsSource: LAEGLER_TRIO,
    conflicts: [],
    notPublished: [
      'Working width. Lägler publishes disc diameter and disc count only — the commonly quoted 340 mm is not a Lägler figure.',
      'Horsepower, and current draw.',
    ],
  },
  {
    id: 'laegler-flip',
    manufacturer: 'Lägler',
    model: 'FLIP',
    category: 'edger',
    role: 'Edge and corner machine — the only one here that reaches into a corner.',
    northAmerica: { volts: 110, hertz: 60, phase: 1, amps: null, fuseAmps: null, kilowatts: null, horsepower: null, connector: null, source: LAEGLER_FLIP_NA },
    europe: { volts: 230, hertz: 50, phase: 1, amps: null, fuseAmps: 10, kilowatts: 1.35, horsepower: null, connector: null, source: LAEGLER_FLIP },
    weightKg: 9.8,
    weightSource: LAEGLER_FLIP,
    drumOrDiscMm: 150,
    discCount: null,
    rpm: 3100,
    abrasive: '150 mm disc; 60 mm corner attachment at 7750 rpm',
    dustExtraction: 'on-board-bag',
    dimensionsSource: LAEGLER_FLIP,
    conflicts: [],
    notPublished: ['kW for the 110 V North American motor — the parts list names the motor but not its rating.'],
  },
  {
    id: 'laegler-unico',
    manufacturer: 'Lägler',
    model: 'UNICO',
    category: 'edger',
    role: 'Edge sander, offered in both 110 V and 220 V North American forms.',
    northAmerica: { volts: 110, hertz: 60, phase: 1, amps: null, fuseAmps: 10, kilowatts: 1.1, horsepower: null, connector: null, source: LAEGLER_UNICO_PARTS },
    europe: { volts: 230, hertz: 50, phase: 1, amps: null, fuseAmps: 10, kilowatts: 1.1, horsepower: null, connector: null, source: LAEGLER_UNICO },
    weightKg: 20,
    weightSource: LAEGLER_UNICO,
    drumOrDiscMm: 178,
    discCount: null,
    rpm: 2700,
    abrasive: '178 mm disc',
    dustExtraction: null,
    dimensionsSource: LAEGLER_UNICO,
    conflicts: [],
    notPublished: ['Dust extraction arrangement is not stated on the product page.'],
  },
  {
    id: 'bona-belt-ux',
    manufacturer: 'Bona',
    model: 'Belt UX',
    category: 'belt-sander',
    role: 'Eight-inch belt sander. Needs a dedicated 30 A circuit.',
    northAmerica: { volts: 230, hertz: 60, phase: 1, amps: null, fuseAmps: 20, kilowatts: 3.7, horsepower: 5, connector: '30 A 230 V twist-lock', source: BONA_BELT_UX_TDS },
    europe: { volts: 230, hertz: 50, phase: 1, amps: null, fuseAmps: null, kilowatts: 3.7, horsepower: null, connector: null, source: BONA_BELT_UX_MANUAL },
    weightKg: 89,
    weightSource: BONA_BELT_UX_MANUAL,
    drumOrDiscMm: 200,
    discCount: null,
    rpm: 2050,
    abrasive: '750 × 203 mm belt',
    dustExtraction: 'on-board-bag',
    dimensionsSource: BONA_BELT_UX_TDS,
    conflicts: [
      'Weight: the US technical data sheet says 187.5 lb (85 kg), the US manual says 89 kg, the EU manual says 85 kg. The 89 kg figure here is the US manual, because the machine in question is the US one.',
      'Drum speed: the data sheet prints 1,850/2,050 rpm while the US manual gives 1980–2280 rpm at 60 Hz. The data sheet appears to reprint the 50 Hz speeds.',
      'Bona lists 187.5 lb for both this 8-inch machine and the 10-inch Belt. Two different chassis cannot weigh the same to a tenth of a pound.',
    ],
    notPublished: ['Current draw. The thermal switch rating and the connector are published; the running amps are not.'],
  },
  {
    id: 'bona-belt',
    manufacturer: 'Bona',
    model: 'Belt',
    category: 'belt-sander',
    role: 'Ten-inch belt sander — more width per pass, same 30 A circuit requirement.',
    northAmerica: { volts: 230, hertz: 60, phase: 1, amps: null, fuseAmps: null, kilowatts: null, horsepower: 4, connector: '30 A 230 V twist-lock', source: BONA_BELT_TDS },
    europe: null,
    weightKg: 85,
    weightSource: BONA_BELT_TDS,
    drumOrDiscMm: 254,
    discCount: null,
    rpm: 2300,
    abrasive: '7⅞ × 29½ in or 9⅞ × 29½ in sleeve',
    dustExtraction: 'on-board-bag',
    dimensionsSource: BONA_BELT_TDS,
    conflicts: ['Weight is published as 187.5 lb, the same figure Bona gives for the narrower Belt UX.'],
    notPublished: ['kW, and current draw.'],
  },
  {
    id: 'bona-power-drive',
    manufacturer: 'Bona',
    model: 'Power Drive',
    category: 'buffer',
    role: 'Sixteen-inch driven buffer for finish abrasion and between-coat work.',
    northAmerica: { volts: 240, hertz: 60, phase: 1, amps: null, fuseAmps: 16, kilowatts: null, horsepower: 2.5, connector: null, source: BONA_POWER_DRIVE },
    europe: { volts: 230, hertz: 50, phase: 1, amps: 11, fuseAmps: 16, kilowatts: 1.9, horsepower: null, connector: null, source: BONA_FLEXISAND },
    weightKg: 51,
    weightSource: BONA_POWER_DRIVE,
    drumOrDiscMm: 407,
    discCount: null,
    rpm: 147,
    abrasive: 'One 16 in drive plate, or four 150 mm discs',
    dustExtraction: 'requires-external',
    dimensionsSource: BONA_POWER_DRIVE,
    conflicts: ['The European FlexiSand 1.9 sheet gives 50 kg; the North American Power Drive sheet gives 112 lb (51 kg). Close, and from two documents about closely related machines.'],
    notPublished: ['kW for the North American configuration; Bona publishes horsepower there and kW in Europe.'],
  },
  {
    id: 'bona-edge-ux',
    manufacturer: 'Bona',
    model: 'Edge UX',
    category: 'edger',
    role: 'Edger with a sealed dust path.',
    northAmerica: null,
    europe: { volts: 230, hertz: 50, phase: 1, amps: null, fuseAmps: 10, kilowatts: 1.25, horsepower: null, connector: null, source: BONA_EDGE_UX },
    weightKg: 14.4,
    weightSource: BONA_EDGE_UX,
    drumOrDiscMm: 178,
    discCount: null,
    rpm: 3000,
    abrasive: '178 mm disc',
    dustExtraction: 'on-board-bag',
    dimensionsSource: BONA_EDGE_UX,
    conflicts: ['The older Bona Edge sheet gives 2.0 kW; the Edge UX sheet gives 1.25 kW. Ten years apart and different machines, but worth knowing before assuming they are interchangeable.'],
    notPublished: ['A North American configuration. The data sheet publishes 230 V / 50 Hz only.'],
  },
  {
    id: 'bona-dcs-50',
    manufacturer: 'Bona',
    model: 'DCS 50',
    category: 'dust-extractor',
    role: 'The North American dust containment unit. Its rating already includes a tool plugged into it.',
    northAmerica: { volts: 120, hertz: 60, phase: 1, amps: 15, fuseAmps: null, kilowatts: 1.38, horsepower: null, connector: null, source: BONA_DCS50 },
    europe: null,
    weightKg: 18.4,
    weightSource: BONA_DCS50,
    drumOrDiscMm: null,
    discCount: null,
    rpm: null,
    abrasive: null,
    dustExtraction: 'is-the-extractor',
    dimensionsSource: BONA_DCS50,
    conflicts: [],
    notPublished: ['Phase is not stated; single phase is implied by the 120 V rating.'],
  },
  {
    id: 'american-sanders-ez-8',
    manufacturer: 'American Sanders',
    model: 'EZ-8',
    category: 'belt-sander',
    role: 'The one eight-inch drum sander here that runs on an ordinary household circuit.',
    northAmerica: { volts: 115, hertz: 60, phase: 1, amps: 12, fuseAmps: null, kilowatts: null, horsepower: 1.5, connector: null, source: AS_EZ8_MANUAL },
    europe: { volts: 240, hertz: 50, phase: 1, amps: 6, fuseAmps: null, kilowatts: null, horsepower: 1.5, connector: null, source: AS_EZ8_MANUAL },
    weightKg: 56.7,
    weightSource: AS_EZ8_MANUAL,
    drumOrDiscMm: 203,
    discCount: null,
    rpm: 1800,
    abrasive: '8 × 19 in sleeve',
    dustExtraction: 'on-board-bag',
    dimensionsSource: AS_EZ8_PDS,
    conflicts: [
      'Weight: the operator’s manual says 125 lb (57 kg), the product data sheet says 105 lb (47.6 kg). Twenty pounds apart, in the same manufacturer’s own literature.',
      'Motor type: the manual says 1½ HP TEFC, the data sheet says 1.5 hp Universal. Those are different motors and both cannot be right.',
    ],
    notPublished: ['A reconciled weight.'],
  },
  {
    id: 'american-sanders-super-7r',
    manufacturer: 'American Sanders',
    model: 'Super 7R',
    category: 'edger',
    role: 'Seven-inch edger on a standard circuit.',
    northAmerica: { volts: 115, hertz: 60, phase: 1, amps: 12, fuseAmps: null, kilowatts: null, horsepower: 1, connector: null, source: AS_SUPER7R },
    europe: { volts: 230, hertz: 50, phase: 1, amps: 6, fuseAmps: null, kilowatts: 0.75, horsepower: null, connector: null, source: AS_SUPER7R },
    weightKg: null,
    weightSource: null,
    drumOrDiscMm: 178,
    discCount: null,
    rpm: 2800,
    abrasive: '7 × 7⅞ in disc',
    dustExtraction: 'on-board-bag',
    dimensionsSource: null,
    conflicts: ['The 230 V manual prints the abrasive as 7 × 7/8 in, which is almost certainly a typo for 7⅞ in — the 115 V manual says 7⅞.'],
    notPublished: ['Weight. It is absent from the specification table in both operator’s manuals.'],
  },
  {
    id: 'american-sanders-b-2',
    manufacturer: 'American Sanders',
    model: 'B-2 +DC',
    category: 'edger',
    role: 'Seven-inch edger with dust collection, on a standard circuit.',
    northAmerica: { volts: 115, hertz: 60, phase: 1, amps: 12, fuseAmps: null, kilowatts: 1.3, horsepower: null, connector: null, source: AS_B2 },
    europe: null,
    weightKg: 14.5,
    weightSource: AS_B2,
    drumOrDiscMm: 178,
    discCount: null,
    rpm: 2800,
    abrasive: '7 in disc',
    dustExtraction: 'on-board-bag',
    dimensionsSource: AS_B2,
    conflicts: [],
    notPublished: ['Horsepower, and the dust control rate in CFM.'],
  },
];

export const machineById = (id: string): Machine | undefined => MACHINES.find((m) => m.id === id);
