/**
 * content/geo/corridors.ts — the routing spine of the expansion.
 *
 * A corridor is not a marketing region. It is a drive: a hub, a highway, and
 * the municipalities strung along it in the order a crew would reach them.
 * That is why corridors exist in the data model at all — the thing that decides
 * whether a job in Grimsby is profitable is the QEW, not a map colour.
 *
 * These corridors, their members and their order are stated by the owner.
 * Nothing here is inferred from a map or a distance API: a corridor is a
 * business decision about where crews will travel, and inventing one would be
 * inventing an operating plan.
 *
 * A corridor names MUNICIPALITIES. Districts reach it through their
 * municipality — see the note on `members` below, and GEO-002.
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
  | 'buffalo-metro'
  | 'rochester-east'
  | 'cottage-north-east';

export interface Corridor {
  id: CorridorId;
  name: string;
  /** The highway or geography the corridor follows, in plain words. */
  route: string;
  /** Market slug the corridor runs out from. */
  hub: string;
  /**
   * MUNICIPALITY slugs, in travel order from the hub. Municipalities only.
   *
   * A corridor is a drive between municipalities, and a district inherits its
   * municipality's membership through `partOf` — that rule is written in
   * content/geo/markets.ts on the `corridors` field and enforced from the
   * market side by scripts/verify-geo.mjs §2, which is why every district
   * declares `corridors: []`.
   *
   * Until GEO-002 this list said otherwise. It named Stoney Creek beside
   * Hamilton on the QEW, Ancaster and Dundas beside Guelph on the 403, and
   * Williamsville and Kenmore beside Buffalo and Amherst in Erie County — five
   * districts standing as peers of the cities that contain them, in the one
   * list a machine reads as "the places on this route"
   * (docs/GEO_CONTRADICTION_LOG.md GC-016). The guard checked the rule in one
   * direction only, so it passed.
   *
   * Nothing was lost by removing them: `corridorStops()` in lib/geo/index.ts
   * puts every district back on the page, under the municipality it is part
   * of, which is where it was always true.
   */
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
    members: ['vaughan', 'king', 'newmarket', 'aurora', 'innisfil', 'barrie'],
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
    members: ['vaughan', 'richmond-hill', 'markham', 'king', 'brampton', 'caledon', 'halton-hills'],
    summary:
      'The cross-town route that avoids the 401. It exists in this model because it changes which jobs can share a day: Markham in the morning and Brampton in the afternoon is a 407 decision.',
  },
  {
    id: 'qew-west',
    name: 'QEW West',
    route: 'QEW southwest along the lake to Hamilton',
    hub: 'mississauga',
    members: ['mississauga', 'oakville', 'burlington', 'hamilton', 'grimsby'],
    summary:
      'The lakeshore run. Housing age drops sharply and then rises again: newer detached stock through Oakville and Burlington, then Hamilton, where much of the stock predates the war and the substrate question changes with it.',
  },
  {
    id: '403-6-west',
    name: '403 / Highway 6 West',
    route: 'Hamilton west and north to Waterloo Region',
    hub: 'hamilton',
    members: ['hamilton', 'guelph', 'cambridge', 'kitchener'],
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
      'fort-erie', 'niagara-falls-on', 'niagara-falls-ny', 'lewiston', 'wheatfield',
      'north-tonawanda', 'lockport', 'buffalo', 'amherst', 'cheektowaga', 'tonawanda',
    ],
    summary:
      'The border crossing. Fort Erie and Niagara Falls on the Ontario side, then Niagara County on the New York side: Niagara Falls NY, Lewiston, Wheatfield, North Tonawanda and Lockport. Every municipality on it is a service area on both sides of the river, confirmed by the owner on 2026-09-10 together with the cross-border licensing and crew authorization that made it possible. The shop and showroom stay in Toronto: this corridor is a drive, not a second office.',
  },
  {
    id: 'buffalo-metro',
    name: 'Buffalo metro',
    route: 'Buffalo outward through the Erie County towns',
    hub: 'buffalo',
    members: [
      'buffalo', 'amherst', 'clarence', 'cheektowaga', 'lancaster',
      'west-seneca', 'tonawanda', 'grand-island', 'orchard-park', 'hamburg',
      'east-aurora',
    ],
    summary:
      'Erie County, out from Buffalo. Dense pre-1930 stock through the city itself — the Elmwood and Parkside blocks carry some of the best-preserved early-century hardwood in the Great Lakes basin — then post-war ranch and colonial through Amherst, Cheektowaga and West Seneca, and older village cores at Williamsville, East Aurora and Hamburg. Western New York runs the same continental humidity swing as southern Ontario: dry heated winters against humid summers, which is the same wood-movement arithmetic and the same acclimation discipline.',
  },
  {
    id: 'rochester-east',
    name: 'Rochester east',
    route: 'The Thruway east along the lake into Monroe and Ontario counties',
    hub: 'rochester-ny',
    members: [
      'rochester-ny', 'brighton', 'pittsford', 'fairport', 'victor',
      'webster', 'irondequoit', 'greece',
    ],
    summary:
      'The far end of the reach, and the newest. Rochester city carries strong pre-war stock — Park Avenue, Browncroft, the 19th Ward — while Pittsford and Fairport are canal-era villages inside later estate development, and Greece, Webster and Irondequoit are largely post-war suburban. Everything on this corridor is scheduled as a trip and confirmed in advance: the distance is real, the border is real, and the schedule says so rather than the offer being withheld.',
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
