/**
 * content/geo/corridors.ts — the routing spine of the expansion.
 *
 * A corridor is not a marketing region. It is a drive: a hub, a highway, and
 * the municipalities strung along it in the order a crew would reach them.
 * That is why corridors exist in the data model at all — the thing that decides
 * whether a job in Grimsby is profitable is the QEW, not a map colour.
 *
 * These nine, their members and their order are stated by the owner. Nothing
 * here is inferred from a map or a distance API: a corridor is a business
 * decision about where crews will travel, and inventing one would be inventing
 * an operating plan.
 */

export type CorridorId =
  | 'core-gta'
  | '400-north'
  | '401-east'
  | '407-york-peel'
  | 'qew-west'
  | '403-6-west'
  | 'niagara-belt'
  | 'buffalo-niagara'
  | 'cottage-north-east';

export interface Corridor {
  id: CorridorId;
  name: string;
  /** The highway or geography the corridor follows, in plain words. */
  route: string;
  /** Market slug the corridor runs out from. */
  hub: string;
  /** Market slugs, in travel order from the hub. */
  members: string[];
  /**
   * What this corridor is for, in one paragraph. Describes geography and
   * routing only — never a claim about work performed in these places.
   */
  summary: string;
}

export const CORRIDORS: Corridor[] = [
  {
    id: 'core-gta',
    name: 'Core GTA',
    route: 'Toronto outward through Peel, York and Halton',
    hub: 'toronto',
    members: ['toronto', 'mississauga', 'brampton', 'vaughan', 'markham', 'milton', 'oakville', 'burlington'],
    summary:
      'The dense inner ring, where a crew can reach the job and be working before nine. Every municipality here is within the daily-return radius of the Norfield Crescent shop, which is what makes same-week scheduling possible at all.',
  },
  {
    id: '400-north',
    name: '400 North',
    route: 'Highway 400 north from Vaughan to Barrie',
    hub: 'vaughan',
    members: ['vaughan', 'newmarket', 'aurora', 'innisfil', 'barrie'],
    summary:
      'Newer suburban stock north of the city, reached on one highway with no cross-town crawl. The corridor changes character past Bradford: closer to Lake Simcoe the seasonal humidity swing is wider than it is downtown, which is a wood-movement question before it is a scheduling one.',
  },
  {
    id: '401-east',
    name: '401 East',
    route: 'Highway 401 east through Durham Region',
    hub: 'toronto',
    members: ['toronto', 'pickering', 'ajax', 'whitby', 'oshawa', 'clarington', 'kawartha-lakes'],
    summary:
      'Durham east of the city, then out past Bowmanville toward the Kawarthas. The first four are commuter distance; Kawartha Lakes is not, and is treated as travel-by-confirmation rather than routine coverage.',
  },
  {
    id: '407-york-peel',
    name: '407 / York–Peel',
    route: 'Highway 407 across the top of the city',
    hub: 'vaughan',
    members: ['vaughan', 'richmond-hill', 'markham', 'brampton', 'caledon', 'halton-hills'],
    summary:
      'The cross-town route that avoids the 401. It exists in this model because it changes which jobs can share a day: Markham in the morning and Brampton in the afternoon is a 407 decision.',
  },
  {
    id: 'qew-west',
    name: 'QEW West',
    route: 'QEW southwest along the lake to Hamilton',
    hub: 'mississauga',
    members: ['mississauga', 'oakville', 'burlington', 'hamilton', 'stoney-creek', 'grimsby'],
    summary:
      'The lakeshore run. Housing age drops sharply and then rises again: newer detached stock through Oakville and Burlington, then Hamilton, where much of the stock predates the war and the substrate question changes with it.',
  },
  {
    id: '403-6-west',
    name: '403 / Highway 6 West',
    route: 'Hamilton west and north to Waterloo Region',
    hub: 'hamilton',
    members: ['hamilton', 'ancaster', 'dundas', 'guelph', 'cambridge', 'kitchener'],
    summary:
      'Past Hamilton toward Guelph and Waterloo Region. Ancaster and Dundas are part of the City of Hamilton rather than separate municipalities, and are modelled that way — they are places, not peer cities.',
  },
  {
    id: 'niagara-belt',
    name: 'Niagara Belt',
    route: 'QEW around the lake through Niagara Region',
    hub: 'grimsby',
    members: [
      'grimsby', 'lincoln', 'st-catharines', 'thorold', 'welland',
      'niagara-on-the-lake', 'niagara-falls-on', 'port-colborne', 'fort-erie',
    ],
    summary:
      'The far end of the QEW. Older housing stock and heritage properties, with lake proximity on both sides of the peninsula — a relative-humidity context that differs from the inland GTA and matters for acclimation.',
  },
  {
    id: 'buffalo-niagara',
    name: 'Buffalo–Niagara cross-border',
    route: 'Fort Erie and Niagara Falls across the border into western New York',
    hub: 'fort-erie',
    members: [
      'fort-erie', 'niagara-falls-on', 'niagara-falls-ny', 'buffalo',
      'amherst', 'cheektowaga', 'tonawanda', 'lockport',
    ],
    summary:
      'The only corridor that crosses the border, and the only one whose United States members are advertising reach rather than service coverage. Ecowoods operates in Ontario, from Ontario. The New York municipalities here exist in this model so that a property owner on that side of the river with an Ontario property can find the company — nothing more. They are never emitted as service area.',
  },
  {
    id: 'cottage-north-east',
    name: 'Cottage / north-east edge',
    route: 'Barrie and Innisfil east toward the Kawarthas',
    hub: 'barrie',
    members: ['barrie', 'innisfil', 'kawartha-lakes'],
    summary:
      'Seasonal and recreational property at the edge of the reachable map. Everything in this corridor is travel-by-confirmation: the distance is real, the logistics are real, and a page that implied routine coverage here would be the kind of claim this repository exists to prevent.',
  },
];

export const corridorById = (id: string): Corridor | undefined =>
  CORRIDORS.find((c) => c.id === id);

/**
 * Corridors a market sits on. A district inherits its municipality's — see the
 * note on Market.corridors. `resolveParent` is passed in rather than imported
 * so this file stays free of a cycle with markets.ts.
 */
export const corridorsFor = (
  marketSlug: string,
  resolveParent?: (slug: string) => string | undefined,
): Corridor[] => {
  const direct = CORRIDORS.filter((c) => c.members.includes(marketSlug));
  if (direct.length || !resolveParent) return direct;
  const parent = resolveParent(marketSlug);
  return parent ? CORRIDORS.filter((c) => c.members.includes(parent)) : [];
};
