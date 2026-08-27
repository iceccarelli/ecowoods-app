/**
 * Figures — numbered, captioned, citable visualisations of published data.
 *
 * WHY THIS EXISTS
 *
 * Every number in this manifest is already published in a paper on this site,
 * inside a table. A table is precise and almost unshareable. A figure with a
 * number, a caption and a permalink is the thing that gets screenshotted into a
 * slide deck, quoted in an article, and cited back — which is the entire point.
 * Scientific publishing figured this out a century ago: number the figures,
 * caption them, and let them be referenced independently of the document.
 *
 * CONTENT RULE — READ BEFORE EDITING
 *
 * Same rule as the framework, the guides and the glossary, and enforced harder.
 * Every figure carries `source: { paper, section }`, and
 * scripts/verify-figures.mjs does not merely check that the section exists — it
 * checks that **every numeric value in the figure appears in that section's
 * table**. A figure whose numbers drift from the paper it claims to visualise is
 * worse than no figure: it is a confident, shareable, wrong artifact carrying
 * this site's name.
 *
 * ON PRECISION
 *
 * `approx` and `openEnded` exist because the source says "≈1360" and "above
 * 60%", and a chart that silently renders those as 1360 and 70 has invented two
 * numbers. The renderer shows "≈" and an open-ended bar respectively. Rounding
 * a hedge away is the most common way a visualisation lies.
 */

export type FigureKind = 'range' | 'bar';

export type RangeRow = {
  label: string;
  from: number;
  to: number;
  /** The upper bound is not known — the source says "above N". */
  openEnded?: boolean;
  /** Draw recessively, behind the marks: this is context, not a series. */
  reference?: boolean;
  note?: string;
};

export type BarRow = {
  label: string;
  value: number;
  approx?: boolean;
  note?: string;
};

export type Figure = {
  /** Permanent id. Cited as "Figure 1" and linked as /data#fig-<id>. */
  id: string;
  number: number;
  kind: FigureKind;
  title: string;
  /** One or two sentences. Appears under the figure and in the API. */
  caption: string;
  /** What the axis measures, e.g. "% relative humidity". */
  unit: string;
  axisMax: number;
  axisTicks: number[];
  rangeRows?: RangeRow[];
  barRows?: BarRow[];
  source: { paper: string; section: string };
};

const P_CLIMATE = 'toronto-hardwood-climate-moisture-protocol';
const P_COST = 'hardwood-selection-and-cost-framework-gta';
const P_PROV = 'where-toronto-hardwood-comes-from';
const P_GRADE = 'hardwood-grading-standards-nhla-nwfa';

export const FIGURES: Figure[] = [
  {
    id: 'toronto-indoor-humidity',
    number: 1,
    kind: 'range',
    title: 'Indoor relative humidity against the band hardwood needs',
    caption:
      'Toronto indoor air spends much of the year outside the range hardwood is dimensionally stable in. The shaded band is the safe operating range; the two bars are the seasonal extremes an installed floor actually experiences. The gap between them is why moisture testing, acclimation and expansion gaps are not optional in this city.',
    unit: '% relative humidity',
    axisMax: 75,
    axisTicks: [0, 15, 30, 45, 60, 75],
    rangeRows: [
      {
        label: 'Safe operating band for hardwood',
        from: 35,
        to: 55,
        reference: true,
        note: 'Where the material is dimensionally stable',
      },
      { label: 'Winter indoor low', from: 18, to: 25, note: 'Heating season' },
      {
        label: 'Summer indoor high',
        from: 60,
        to: 75,
        openEnded: true,
        note: 'Source states "above 60%" — the upper bound is not published',
      },
    ],
    source: { paper: P_CLIMATE, section: 'climate-reality' },
  },
  {
    id: 'janka-hardness-gta',
    number: 2,
    kind: 'bar',
    title: 'Janka hardness of the species used in the GTA',
    caption:
      'Resistance to denting, for the five species that account for most Greater Toronto Area hardwood work. Hardness is one variable among several — stability, grain character and finish performance matter equally, and a species chosen on this number alone produces a floor that wears wrong.',
    unit: 'Janka rating',
    axisMax: 2000,
    axisTicks: [0, 500, 1000, 1500, 2000],
    barRows: [
      { label: 'Hickory', value: 1820, note: 'Extreme durability' },
      { label: 'Hard maple', value: 1450, note: 'High-traffic workhorse' },
      { label: 'White oak / European oak', value: 1360, approx: true, note: 'Current aesthetic and resale sovereign' },
      { label: 'Red oak (northern)', value: 1290, approx: true, note: 'Traditional default' },
      { label: 'Black walnut', value: 1010, note: 'Luxury accent' },
    ],
    source: { paper: P_COST, section: 'species' },
  },
  {
    id: 'ontario-hardwood-growing-stock',
    number: 3,
    kind: 'bar',
    title: 'Ontario growing stock, the hardwoods that become floors',
    caption:
      'Standing volume in Ontario by species, from the province\u2019s own 2021 forest inventory. Sugar maple 300,361,212 m\u00b3, red oak 85,019,702 m\u00b3, yellow birch 82,005,013 m\u00b3, ash as a group 42,273,003 m\u00b3, basswood 18,444,080 m\u00b3. Growing stock is what stands in the forest, not what is cut \u2014 Ontario publishes no hardwood-specific harvest volume at all, which is why the harvest is absent from this chart rather than estimated onto it.',
    unit: 'million cubic metres standing',
    axisMax: 320,
    axisTicks: [0, 100, 200, 300],
    barRows: [
      { label: 'Sugar maple', value: 300, approx: true, note: 'Largest Ontario flooring hardwood' },
      { label: 'Red oak', value: 85, approx: true, note: 'Principal tolerant hardwood' },
      { label: 'Yellow birch', value: 82, approx: true, note: 'Principal tolerant hardwood' },
      { label: 'Ash (group)', value: 42, approx: true, note: 'Under emerald ash borer pressure' },
      { label: 'Basswood', value: 18, approx: true, note: 'Not used for flooring' },
    ],
    source: { paper: P_PROV, section: 'growing-stock' },
  },
  {
    id: 'nhla-clear-face-yield',
    number: 4,
    kind: 'bar',
    title: 'NHLA lumber grades, by required clear-face yield',
    caption:
      'What each National Hardwood Lumber Association grade requires a board to yield in clear cuttings, under the rulebook effective 1 January 2023: FAS 83-1/3% (10/12), No. 1 Common 66-2/3% (8/12), No. 2A Common 50% (6/12), No. 3A Common 33-1/3% (4/12). This is a lumber grade and it is fixed at the sawmill. It is not the flooring grade on your quote \u2014 that is a separate NWFA/NOFMA appearance grade, and the two systems do not cross-reference each other.',
    unit: '% clear-face yield required',
    axisMax: 100,
    axisTicks: [0, 25, 50, 75, 100],
    barRows: [
      { label: 'FAS', value: 83, approx: true, note: 'Boards 6" and wider, 8\u201316 ft' },
      { label: 'No. 1 Common', value: 66, approx: true, note: 'Boards 3" and wider, 4\u201316 ft' },
      { label: 'No. 2A Common', value: 50, note: 'Minimum cutting 3"\u00d72 ft' },
      { label: 'No. 3A Common', value: 33, approx: true, note: 'Minimum cutting 3"\u00d72 ft' },
    ],
    source: { paper: P_GRADE, section: 'nhla-yield' },
  },
];

export const getFigures = (): Figure[] => [...FIGURES].sort((a, b) => a.number - b.number);
export const getFigure = (id: string): Figure | undefined => FIGURES.find((f) => f.id === id);
