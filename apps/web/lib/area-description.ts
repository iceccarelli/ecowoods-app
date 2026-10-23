import { BUSINESS, areaDisplayName, cityContent, type City } from '@/lib/seo-data';

/**
 * The meta description of a /service-areas/[slug] page.
 *
 * Built from whole sentences of the area's own `cityContent` (or its real
 * neighbourhood names) and never from a cut-off string: a snippet that ends
 * mid-phrase with "…" reads as machine-generated, and a snippet that is only
 * the shared head and tail is identical copy across dozens of areas.
 *
 * Order of preference, first that fits:
 *   A  head + one local sentence + tail
 *   B  one local sentence that names the area + tail
 *   C  head, including the area's neighbourhoods + tail
 *   D  head + tail (only for an area with no local copy at all)
 */
export const AREA_DESCRIPTION_LIMIT = 158;

const ABBREVIATIONS = new Set(['st', 'mt', 'ft', 'dr', 'mr', 'mrs', 'ms', 'ste', 'ave', 'rd', 'blvd', 'hwy', 'no', 'vs', 'etc', 'n', 's', 'e', 'w']);

/** Sentence split that does not break after "St.", "Mt.", "Ave." and the like. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const piece of text.trim().split(/(?<=[.!?])\s+/)) {
    const prev = out[out.length - 1];
    const m = prev ? /(?:^|\s)([A-Za-z]{1,4})\.$/.exec(prev) : null;
    if (m && ABBREVIATIONS.has(m[1].toLowerCase())) out[out.length - 1] = `${prev} ${piece}`;
    else out.push(piece);
  }
  return out.filter(Boolean);
}

const list = (names: string[]) => (names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

export function areaDescription(area: City): string {
  const where = areaDisplayName(area);
  const head = `Dust-free hardwood refinishing and installation in ${where}`;
  const tail = ` Fixed written estimates. Call ${BUSINESS.phoneDisplay}.`;
  fits: {
    const cc = cityContent(area.slug);
    if (!cc) break fits;
    const base = where.split(',')[0].toLowerCase();
    const sentences = [...splitSentences(cc.intro), ...splitSentences(cc.localConsideration ?? '')].filter((s) => s.length >= 25);
    const ok = (d: string) => d.length <= AREA_DESCRIPTION_LIMIT;
    for (const s of sentences) if (ok(`${head}. ${s}${tail}`)) return `${head}. ${s}${tail}`;
    for (const s of sentences) if (s.toLowerCase().includes(base) && ok(`${s}${tail}`)) return `${s}${tail}`;
    for (let n = Math.min(cc.neighbourhoods.length, 5); n > 0; n--) {
      const d = `${head}, including ${list(cc.neighbourhoods.slice(0, n))}.${tail}`;
      if (ok(d)) return d;
    }
  }
  return `${head}.${tail}`;
}

/** The root layout appends this to every page title (`%s · Ecowoods`). */
export const TITLE_SUFFIX = ' · Ecowoods';
/** About what a results page shows of a title before it cuts it with an ellipsis. */
export const AREA_TITLE_LIMIT = 60;

/**
 * The <title> of a /service-areas/[slug] page, before the layout's suffix.
 *
 * The place name is what distinguishes these pages, so it must survive
 * truncation. The full "refinishing & installation" form pushed the composed
 * title to 61–75 characters on 97 of 100 pages, which cut the suffix on most
 * and clipped the place name itself on the longest ("…Niagara-on-the-").
 * Tiers, first one that fits with the suffix; the last is the fallback:
 *
 *   Hardwood floor refinishing & installation in {area}
 *   Hardwood floor refinishing in {area}
 *   Hardwood flooring in {area}
 *
 * The H1 and the schema names keep the full phrase; they are not truncated.
 */
export function areaTitle(area: City): string {
  const where = areaDisplayName(area);
  const tiers = [
    `Hardwood floor refinishing & installation in ${where}`,
    `Hardwood floor refinishing in ${where}`,
    `Hardwood flooring in ${where}`,
  ];
  return tiers.find((t) => t.length + TITLE_SUFFIX.length <= AREA_TITLE_LIMIT) ?? tiers[tiers.length - 1];
}
