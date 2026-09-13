/**
 * lib/area-groups.ts — GROUP-01. The hundred service areas, in the shape the
 * business already drives them.
 *
 * THE PROBLEM
 *
 * /service-areas rendered all 100 published areas as one flat grid of tiles.
 * On a phone that is a hundred cards in a single column before the page says
 * anything else about what is done in them or what it costs — and for an
 * assistant reading the page it is a hundred sibling links with no structure
 * to summarise.
 *
 * THE GROUPING IS NOT INVENTED
 *
 * content/geo/corridors.ts already models eleven routes, curated by somebody
 * who drives them, and `corridorsFor` already resolves a district to its
 * municipality's corridors. Measured before this was written: all 100
 * published areas map to a corridor, and none falls outside one. So this is
 * the data's own shape rather than a taxonomy bolted on to tidy a list — which
 * matters, because a grouping nobody in the business recognises is worse than
 * no grouping.
 *
 * ONE CITY, ONE GROUP
 *
 * A market can sit on two corridors — that is what a corridor is. For this
 * index each city is listed under the FIRST, once. Listing it under both would
 * turn a hundred links into more than a hundred, make every count in every
 * summary wrong, and give a crawler duplicate paths to the same page from the
 * same document. The corridor pages themselves are where a city's full
 * membership belongs, and they already show it.
 *
 * EMPTY CORRIDORS ARE OMITTED
 *
 * `cottage-north-east` is a real route with no published service-area page on
 * it. It renders as nothing here rather than as a group with a zero beside it:
 * an empty accordion is a promise of content that is not there.
 */
import { CORRIDORS, corridorsFor } from '@/lib/geo';
import { SERVICE_AREAS, type City } from '@/lib/seo-data';

export type AreaGroup = {
  id: string;
  name: string;
  cities: City[];
};

/** The id of the first corridor a slug sits on, or null. */
function firstCorridorId(slug: string): string | null {
  const on = corridorsFor(slug) as Array<string | { id: string }>;
  if (!on.length) return null;
  const head = on[0]!;
  return typeof head === 'string' ? head : head.id;
}

/**
 * The published areas, grouped by corridor, in the order corridors are
 * declared — which is the order they are presented everywhere else on this
 * site, so a visitor who has seen /corridors recognises this page.
 *
 * A city on no corridor would land in a trailing "Elsewhere" group rather
 * than being dropped. There are none today; the branch exists so that adding
 * a market without corridor membership makes it appear somewhere rather than
 * vanish from the index silently.
 */
export function areaGroups(): AreaGroup[] {
  const byCorridor = new Map<string, City[]>();
  const ungrouped: City[] = [];

  for (const city of SERVICE_AREAS) {
    const id = firstCorridorId(city.slug);
    if (!id) {
      ungrouped.push(city);
      continue;
    }
    const list = byCorridor.get(id);
    if (list) list.push(city);
    else byCorridor.set(id, [city]);
  }

  const groups: AreaGroup[] = [];
  for (const corridor of CORRIDORS) {
    const cities = byCorridor.get(corridor.id);
    /* An empty corridor is omitted, not rendered as a zero. */
    if (cities && cities.length) {
      groups.push({ id: corridor.id, name: corridor.name, cities });
    }
  }

  /* Largest first: the group a visitor most likely wants is the one open by
     default, and on this business that is the GTA core by a wide margin. */
  groups.sort((a, b) => b.cities.length - a.cities.length);

  if (ungrouped.length) {
    groups.push({ id: 'elsewhere', name: 'Elsewhere', cities: ungrouped });
  }
  return groups;
}

/** Every city appears exactly once across the groups. Used by the test. */
export const groupedCityCount = (groups: AreaGroup[]): number =>
  groups.reduce((n, g) => n + g.cities.length, 0);
