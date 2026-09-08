/**
 * lib/wood/species.ts — dimensional change coefficients.
 *
 * EVERY NUMBER IN THIS FILE IS COPIED FROM ONE PUBLISHED TABLE.
 *
 * Wood Handbook (FPL-GTR-190, 2010), Table 13–5, "Dimensional change
 * coefficients for shrinking or swelling within moisture content limits of
 * 6% to 14%". The same values appear as Table 12–5 of the 1999 edition
 * (FPL-GTR-113); both were checked and they agree exactly.
 *
 * Nothing here was estimated, interpolated, or averaged by us. That is the
 * whole point: this business already publishes a framework whose credibility
 * rests on every criterion citing a paper, and a calculator built on invented
 * coefficients would undo that in one afternoon. If a species is not in the
 * table, it is not in this file — see the note on jatoba below.
 *
 * TWO THINGS THAT LOOK LIKE DETAILS AND ARE NOT
 *
 * 1. "White oak" and "red oak" in Table 13–5 are COMMERCIAL GROUPS, not
 *    species. Their coefficients are group values and cannot be re-derived
 *    from any single species' shrinkage figures — we checked, and they do not
 *    reproduce, while every true single species does. Never "improve" these by
 *    recomputing them.
 *
 * 2. HICKORY IS TWO ENTRIES. The table separates pecan hickory from true
 *    hickory and they differ by about 30% tangentially (0.00315 against
 *    0.00411). A single averaged "hickory" row would be a number that appears
 *    in no published table and describes no real wood.
 *
 * GRAIN ORIENTATION IS NOT A SPECIES
 *
 * A flatsawn (plainsawn) board moves across its width TANGENTIALLY; a
 * quartersawn or rift board moves across its width RADIALLY. For commercial
 * white oak that is 0.00365 against 0.00180 — the same wood, moving 2.03 times
 * as much, decided by how the log was cut. That ratio is the single most
 * useful fact this module can hand a homeowner choosing between two quotes,
 * and it is why `orientation` is a required argument rather than a default.
 *
 * JATOBA / BRAZILIAN CHERRY IS DELIBERATELY ABSENT. It is not in Table 13–5.
 * Deriving it from published green-to-ovendry shrinkage requires assuming a
 * fibre saturation point, and the plausible range of that assumption (22–30%)
 * moves the tangential coefficient by 35%. A number with a 35% assumption band
 * presented next to nine measured ones would be the least honest thing on the
 * page.
 */

export type Orientation = 'flatsawn' | 'quartersawn';

export type WoodSpecies = {
  /** Stable id, used in URLs and by the API. Never renumber in place. */
  id: string;
  /** How the rest of the site names it — matches the configurator vocabulary. */
  label: string;
  /** The row heading exactly as it reads in Table 13–5. */
  tableName: string;
  /** Radial coefficient, per 1% moisture content change. */
  cRadial: number;
  /** Tangential coefficient, per 1% moisture content change. */
  cTangential: number;
  /** True where the table row is a commercial group rather than one species. */
  commercialGroup: boolean;
};

export const SPECIES_SOURCE = {
  table: 'Wood Handbook (FPL-GTR-190) Table 13–5',
  url: 'https://www.fpl.fs.usda.gov/documnts/fplgtr/fplgtr190/chapter_13.pdf',
  basis: 'per 1% moisture content change, valid 6%–14% MC',
} as const;

export const SPECIES: WoodSpecies[] = [
  {
    id: 'white-oak',
    label: 'White oak',
    tableName: 'Oak, white, commercial',
    cRadial: 0.0018,
    cTangential: 0.00365,
    commercialGroup: true,
  },
  {
    id: 'red-oak',
    label: 'Red oak',
    tableName: 'Oak, red, commercial',
    cRadial: 0.00158,
    cTangential: 0.00369,
    commercialGroup: true,
  },
  {
    id: 'hard-maple',
    label: 'Hard maple',
    tableName: 'Maple, sugar',
    cRadial: 0.00165,
    cTangential: 0.00353,
    commercialGroup: false,
  },
  {
    id: 'black-walnut',
    label: 'Black walnut',
    tableName: 'Walnut, black',
    cRadial: 0.0019,
    cTangential: 0.00274,
    commercialGroup: false,
  },
  {
    id: 'white-ash',
    label: 'White ash',
    tableName: 'Ash, white',
    cRadial: 0.00169,
    cTangential: 0.00274,
    commercialGroup: false,
  },
  {
    id: 'yellow-birch',
    label: 'Yellow birch',
    tableName: 'Birch, yellow',
    cRadial: 0.00256,
    cTangential: 0.00338,
    commercialGroup: false,
  },
  {
    id: 'black-cherry',
    label: 'Black cherry',
    tableName: 'Cherry, black',
    cRadial: 0.00126,
    cTangential: 0.00248,
    commercialGroup: false,
  },
  {
    id: 'pecan-hickory',
    label: 'Pecan hickory',
    tableName: 'Hickory, pecan',
    cRadial: 0.00169,
    cTangential: 0.00315,
    commercialGroup: true,
  },
  {
    id: 'true-hickory',
    label: 'True hickory',
    tableName: 'Hickory, true',
    cRadial: 0.00259,
    cTangential: 0.00411,
    commercialGroup: true,
  },
];

export const speciesById = (id: string): WoodSpecies | undefined =>
  SPECIES.find((s) => s.id === id);

/** The coefficient that governs movement ACROSS THE WIDTH of a board. */
export const widthCoefficient = (species: WoodSpecies, orientation: Orientation): number =>
  orientation === 'quartersawn' ? species.cRadial : species.cTangential;

/**
 * How much more a flatsawn board of this species moves than a quartersawn one.
 * Published, not marketing: it is the ratio of two table columns.
 */
export const orientationRatio = (species: WoodSpecies): number =>
  species.cTangential / species.cRadial;
