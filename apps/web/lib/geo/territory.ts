/**
 * lib/geo/territory.ts — the one phrase that names the whole territory.
 *
 * WHY THIS EXISTS (GEO-001)
 *
 * `BUSINESS_NAP.region` is "Toronto & the GTA". It is true of the shop, and it
 * was used as the name of the service territory on eleven surfaces — llms.txt,
 * /about, /team, /press, the Toronto head-term pages, the Markdown hub, ai.txt
 * and the matcher's answers — directly in front of a list of 89 areas that ran
 * from Barrie to Port Colborne and across the river to Rochester. "89 areas
 * across Toronto & the GTA: …, Buffalo, …" is a sentence that puts Buffalo in
 * the GTA (docs/GEO_CONTRADICTION_LOG.md GC-004).
 *
 * So the territory is named from the published places themselves, not typed:
 * the Ontario part names the GTA and every other published municipality, and
 * the New York part names the hubs of the New York corridors that carry a
 * published place. Publish a municipality and the phrase gains it; nothing in
 * it can name a place that has no page.
 *
 * `BUSINESS_NAP.region` is left alone: "a hardwood flooring contractor in
 * Toronto & the GTA" is where the business IS, and stays true. This is where
 * it WORKS.
 */
import { MARKETS, marketBySlug } from '@/content/geo/markets';
import { CORRIDORS } from '@/content/geo/corridors';
import { regionOf } from '@/content/geo/regions';
import { SERVICE_AREAS, CITIES, DISTRICT_AREAS, NEIGHBOURHOOD_AREAS } from '@/lib/seo-data';

const published = new Set(SERVICE_AREAS.map((a) => a.slug));

const publishedMunicipalities = MARKETS.filter((m) => m.kind === 'municipality' && published.has(m.slug));

/*
 * The Ontario part names what is published, region by region — never a wider
 * planning region than that. "The Greater Golden Horseshoe" was the first
 * draft of this phrase and it was wrong: Brantford, Orangeville and
 * Peterborough are inside it and are named-but-not-published places
 * (content/geo/regions.ts DISCOVERY), so the phrase would have claimed them.
 * The GTA is named as a region because the business is Toronto's; every other
 * published Ontario municipality is named, with the Niagara municipalities
 * collapsed into "Niagara".
 */
const caPart = (): string | null => {
  const ca = publishedMunicipalities.filter((m) => m.country === 'CA');
  if (!ca.length) return null;
  const parts: string[] = [];
  for (const m of ca) {
    const region = regionOf(m.slug, 'CA');
    const label = region === 'gta' ? 'Toronto and the GTA' : region === 'niagara-region' ? 'Niagara' : m.name;
    if (!parts.includes(label)) parts.push(label);
  }
  if (parts[0] !== 'Toronto and the GTA' && parts.includes('Toronto and the GTA')) {
    parts.splice(parts.indexOf('Toronto and the GTA'), 1);
    parts.unshift('Toronto and the GTA');
  }
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
};

const usPart = (): string | null => {
  const hubs = CORRIDORS.map((c) => marketBySlug(c.hub))
    .filter((h): h is NonNullable<typeof h> => Boolean(h && h.country === 'US'))
    .filter((h) => CORRIDORS.some((c) => c.hub === h.slug && c.members.some((s) => published.has(s))));
  const names = [...new Set(hubs.map((h) => h.name))];
  if (!names.length) return null;
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `the ${list} area${names.length === 1 ? '' : 's'} of New York State`;
};

/** "Toronto and the GTA, Barrie, …, Kawartha Lakes, and the Buffalo and Rochester areas of New York State". */
export const TERRITORY: string = [caPart(), usPart()].filter(Boolean).join(', and ');

/** For headings and counts: "Ontario and New York State", or "Ontario" alone. */
export const TERRITORY_SHORT: string = [
  publishedMunicipalities.some((m) => m.country === 'CA') ? 'Ontario' : null,
  publishedMunicipalities.some((m) => m.country === 'US') ? 'New York State' : null,
].filter(Boolean).join(' and ');

/**
 * Published areas by kind — the partition every "N areas (…)" sentence must add
 * up to. llms.txt said "89 published areas (53 municipalities and districts, 17
 * Toronto neighbourhoods)", which sums to 70 (GC-007): the third list was never
 * counted. All three are read here, and they sum to the total by construction.
 */
export const PUBLISHED_PARTITION = {
  total: SERVICE_AREAS.length,
  municipalities: CITIES.length,
  districts: DISTRICT_AREAS.length,
  neighbourhoods: NEIGHBOURHOOD_AREAS.length,
};

/** Published areas by country. */
export const PUBLISHED_BY_COUNTRY = {
  ca: SERVICE_AREAS.filter((a) => marketBySlug(a.slug)?.country !== 'US').length,
  us: SERVICE_AREAS.filter((a) => marketBySlug(a.slug)?.country === 'US').length,
};
