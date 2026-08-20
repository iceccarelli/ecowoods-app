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
];

export const getFigures = (): Figure[] => [...FIGURES].sort((a, b) => a.number - b.number);
export const getFigure = (id: string): Figure | undefined => FIGURES.find((f) => f.id === id);
