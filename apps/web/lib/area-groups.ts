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
import { CORRIDORS, corridorsFor, marketBySlug } from '@/lib/geo';
import { SERVICE_AREAS, cityBySlug, cityContent, US_AREA_SLUGS, type City } from '@/lib/seo-data';
import { GUIDES, type Guide } from '@/lib/guides';
import { PROJECTS, type Project } from '@/lib/projects';

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

/* ── LOCAL DISCOVERY LINKS ───────────────────────────────────────────────────
 *
 * City pages linked out to services and neighbours but never to the guides that
 * answer the area's own question, to the corridor it sits on, or to a published
 * job in it; project pages printed their neighbourhood as plain text. These
 * helpers read registries that already exist (guides, corridors, projects,
 * CITY_CONTENT) and return links. They hold no copy of their own.
 */
const GUIDE_SLAB = 'reference-condominium-concrete-slab';
const GUIDE_RADIANT = 'reference-radiant-heat-main-floor';
const GUIDE_REFINISH = 'reference-refinishing-existing-hardwood';
const GUIDE_METHOD = 'nail-down-glue-down-or-floating';
const GUIDE_QUOTE = 'how-to-evaluate-a-hardwood-quote';

/**
 * Up to three guides for an area. The substrate is read from the area's own
 * `housingNote` (the registry that already describes its stock); the fallbacks
 * are the two guides that apply to every job whatever the floor sits on. A slug
 * that stops resolving in GUIDES is dropped rather than rendered as a 404.
 */
export function guidesForArea(slug: string): Guide[] {
  const text = (cityContent(slug)?.housingNote ?? '').toLowerCase();
  const picks: string[] = [];
  if (/\b(condo|condominium|concrete|slab|loft)/.test(text)) picks.push(GUIDE_SLAB);
  if (/\bradiant/.test(text)) picks.push(GUIDE_RADIANT);
  if (/\b(original|pre-war|prewar|century|victorian|edwardian|1[89]\d0s|heritage)/.test(text)) {
    picks.push(GUIDE_REFINISH);
  }
  picks.push(GUIDE_METHOD, GUIDE_QUOTE);
  const out: Guide[] = [];
  for (const s of picks) {
    const g = GUIDES.find((x) => x.slug === s);
    if (g && !out.includes(g)) out.push(g);
    if (out.length === 3) break;
  }
  return out;
}

/** The first corridor an area sits on, as a link target, or null. */
export function corridorLinkForArea(slug: string): { id: string; name: string } | null {
  const id = firstCorridorId(slug);
  const c = id ? CORRIDORS.find((x) => x.id === id) : undefined;
  return c ? { id: c.id, name: c.name } : null;
}

const slugOf = (s: string) =>
  s.toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/**
 * The published area a project location belongs to: its neighbourhood when
 * that is itself a published area, else its city when that is. `GTA`, or a
 * neighbourhood with no page, resolves to the city or to null, never to a guess.
 */
export function areaForProjectLocation(loc: { neighbourhood: string; city: string }): City | null {
  const hood = cityBySlug(slugOf(loc.neighbourhood));
  if (hood && !US_AREA_SLUGS.has(hood.slug)) return hood;
  return cityBySlug(slugOf(loc.city)) ?? null;
}

export interface AreaPlacement {
  /** The containing municipality. `page` is set only when it has its own /service-areas page (Toronto does not). */
  parent: { slug: string; name: string; page: City | null };
  neighbours: City[];
  corridors: { id: string; name: string }[];
}

/**
 * WHERE A DISTRICT SITS, from the market registry alone: the municipality it is
 * part of, the published areas it borders (`nearest`), and the corridors that
 * municipality is on. Null for a municipality, and for a district whose parent
 * is not in the registry. These are the facts the neighbourhood pages were missing as
 * prose; none is written here, all are read.
 */
export function areaPlacement(slug: string): AreaPlacement | null {
  const mk = marketBySlug(slug);
  if (!mk || mk.kind !== 'district' || !mk.partOf) return null;
  const parentMarket = marketBySlug(mk.partOf);
  if (!parentMarket) return null;
  const parent = { slug: parentMarket.slug, name: parentMarket.name, page: cityBySlug(parentMarket.slug) ?? null };
  const neighbours = mk.nearest
    .filter((s) => s !== mk.partOf && s !== slug)
    .map((s) => cityBySlug(s))
    .filter((c): c is City => Boolean(c));
  const corridors = corridorsFor(slug).map((c) => ({ id: c.id, name: c.name }));
  return { parent, neighbours, corridors };
}

/** Published projects whose location resolves to this area. */
export function projectsForArea(slug: string): Project[] {
  return PROJECTS.filter((p) => areaForProjectLocation(p.location)?.slug === slug);
}
