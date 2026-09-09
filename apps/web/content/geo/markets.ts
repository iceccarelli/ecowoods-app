/**
 * content/geo/markets.ts — every municipality this business names, and the
 * truth status of each.
 *
 * WHY A REGISTRY AND NOT FORTY-TWO PAGES
 *
 * The fastest way to "expand into the Golden Horseshoe" is to generate a page
 * per municipality from a template with the place name substituted in. It
 * produces forty-two URLs in an afternoon, and it is the single most reliably
 * punished pattern in local search — because every one of those pages is the
 * same page, competing with itself, saying nothing about the place it names.
 *
 * This repository has already been here. F-157 records fifteen of sixteen
 * service-area pages rendering one generic paragraph with a place name swapped
 * in, and CityContent exists with the rule stamped on it: EVERY field must be
 * REAL — invented detail is worse than none.
 *
 * So a market entering this file gets a *record*, not a page. It becomes a
 * page only when it has earned one, and lib/geo/worthiness.ts decides that
 * from evidence rather than intent: real local content, a verified operational
 * position, and no other page already answering the same query. Until then the
 * municipality is a first-class entity in the graph — corridor member, API
 * record, internal-link target — and no thin page exists to be suppressed.
 *
 * That is not caution slowing the expansion down. It is what makes the
 * expansion able to run: adding the next twenty municipalities is a data
 * change, and the day one of them has real content the page appears with its
 * metadata, schema, sitemap entry, internal links and API record already
 * correct.
 *
 * WHAT MAY BE WRITTEN HERE, AND WHAT MAY NOT
 *
 *   name, province, country, kind, partOf   public fact
 *   status, corridors, parentHub            owner decisions about where crews go
 *   localFacts                              only what is publicly checkable or
 *                                           already published on this site
 *   operationalTruth                        requires a date and a person; until
 *                                           then `verifiedAt: null`, and the
 *                                           guard refuses to publish a page
 *
 * There are no drive times, no coordinates, no population figures and no
 * housing-stock descriptions for markets nobody has worked in. Those are the
 * fields a template most wants filled, and the ones most likely to be invented.
 * A market with `localFacts: []` is not incomplete — it is honest, and it is
 * the queue of work that turns a corridor into coverage.
 */
import type { CorridorId } from './corridors';

export type MarketStatus =
  /** Worked routinely, from the Toronto shop, today. */
  | 'core-active'
  /** Actively taking work; coverage established but not yet routine. */
  | 'active-expansion'
  /** In the plan and in the graph; not yet claimed as coverage. */
  | 'corridor-target'
  /** Reachable, but only for a job confirmed in advance. Distance is real. */
  | 'travel-by-confirmation'
  /** Advertising reach only. Never emitted as service area. Never. */
  | 'us-proxy';

/** A municipality, or a place inside one. The distinction is not cosmetic. */
export type MarketKind = 'municipality' | 'district';

export interface Market {
  slug: string;
  name: string;
  country: 'CA' | 'US';
  /** Province or state code. */
  region: 'ON' | 'NY';
  kind: MarketKind;
  /**
   * For a district, the municipality it is part of. Etobicoke is part of
   * Toronto; Ancaster and Dundas are part of Hamilton. A district must never
   * become a schema.org City node alongside the municipality that contains it
   * — that is a factual error in the one part of the site a machine reads
   * literally, and F-157 is the record of nearly shipping it.
   */
  partOf?: string;
  status: MarketStatus;
  /**
   * Corridors this market is on. A DISTRICT declares none: a corridor is a
   * drive between municipalities, and Etobicoke does not sit on the QEW
   * separately from Toronto. Membership is inherited through `partOf`, which
   * is what corridorsFor() resolves — the alternative is two lists that must
   * agree and eventually will not.
   */
  corridors: CorridorId[];
  /** Where a crew would set out from for this market. */
  parentHub: string;
  /** Nearest other markets, for internal linking. Slugs. */
  nearest: string[];
  /**
   * Publicly checkable statements about the place, or points already published
   * in a paper on this site. Nothing about Ecowoods, and nothing that needed a
   * figure this site does not publish. Empty is a valid and common answer.
   */
  localFacts: string[];
  /**
   * What can honestly be said about serving this market, and the date somebody
   * confirmed it. A market with `verifiedAt: null` may appear in the graph and
   * in a corridor; it may not carry a page that implies coverage.
   */
  operationalTruth: { statement: string; verifiedAt: string | null };
}

/* ── the existing sixteen ──────────────────────────────────────────────────
 *
 * These already have pages, CityContent and, in most cases, months of index
 * history. Their slugs are unchanged and their pages are untouched. What they
 * gain here is corridor membership and an explicit status, so that one file
 * answers "where does this business work" for the whole stack.
 */
const CORE: Market[] = [
  m('Toronto', 'toronto', 'core-active', 'toronto', ['core-gta', '401-east'], ['mississauga', 'vaughan', 'markham'], {
    statement: 'Head office and shop. Routine daily coverage.',
    verifiedAt: '2026-09-09',
  }),
  m('Downtown Toronto', 'downtown-toronto', 'core-active', 'toronto', [], ['toronto', 'east-york'], TORONTO_TRUTH(), 'district', 'toronto'),
  m('North York', 'north-york', 'core-active', 'toronto', [], ['toronto', 'vaughan'], TORONTO_TRUTH(), 'district', 'toronto'),
  m('Etobicoke', 'etobicoke', 'core-active', 'toronto', [], ['toronto', 'mississauga'], TORONTO_TRUTH(), 'district', 'toronto'),
  m('Scarborough', 'scarborough', 'core-active', 'toronto', [], ['toronto', 'pickering'], TORONTO_TRUTH(), 'district', 'toronto'),
  m('East York', 'east-york', 'core-active', 'toronto', [], ['toronto', 'north-york'], TORONTO_TRUTH(), 'district', 'toronto'),
  m('York', 'york', 'core-active', 'toronto', [], ['toronto', 'north-york'], TORONTO_TRUTH(), 'district', 'toronto'),
  m('Mississauga', 'mississauga', 'core-active', 'toronto', ['core-gta', 'qew-west'], ['toronto', 'oakville', 'brampton'], ACTIVE('2026-09-09')),
  m('Brampton', 'brampton', 'core-active', 'toronto', ['core-gta', '407-york-peel'], ['mississauga', 'caledon', 'vaughan'], ACTIVE('2026-09-09')),
  m('Vaughan', 'vaughan', 'core-active', 'toronto', ['core-gta', '400-north', '407-york-peel'], ['toronto', 'richmond-hill', 'brampton'], ACTIVE('2026-09-09')),
  m('Markham', 'markham', 'core-active', 'toronto', ['core-gta', '407-york-peel'], ['richmond-hill', 'scarborough', 'vaughan'], ACTIVE('2026-09-09')),
  m('Richmond Hill', 'richmond-hill', 'core-active', 'toronto', ['407-york-peel'], ['markham', 'vaughan', 'aurora'], ACTIVE('2026-09-09')),
  m('Oakville', 'oakville', 'core-active', 'toronto', ['core-gta', 'qew-west'], ['mississauga', 'burlington', 'milton'], ACTIVE('2026-09-09')),
  m('Aurora', 'aurora', 'active-expansion', 'vaughan', ['400-north'], ['newmarket', 'richmond-hill'], ACTIVE('2026-09-09')),
  m('Newmarket', 'newmarket', 'active-expansion', 'vaughan', ['400-north'], ['aurora', 'innisfil'], ACTIVE('2026-09-09')),
  m('Pickering', 'pickering', 'active-expansion', 'toronto', ['401-east'], ['ajax', 'scarborough'], ACTIVE('2026-09-09')),
  m('Ajax', 'ajax', 'active-expansion', 'toronto', ['401-east'], ['pickering', 'whitby'], ACTIVE('2026-09-09')),
];

/* ── the corridor. Records, not pages. ────────────────────────────────────── */
const CORRIDOR_TARGETS: Market[] = [
  m('Milton', 'milton', 'corridor-target', 'toronto', ['core-gta'], ['oakville', 'halton-hills', 'burlington'], UNVERIFIED()),
  m('Burlington', 'burlington', 'corridor-target', 'mississauga', ['core-gta', 'qew-west'], ['oakville', 'hamilton', 'milton'], UNVERIFIED()),
  m('Halton Hills', 'halton-hills', 'corridor-target', 'vaughan', ['407-york-peel'], ['milton', 'caledon'], UNVERIFIED()),
  m('Caledon', 'caledon', 'corridor-target', 'vaughan', ['407-york-peel'], ['brampton', 'halton-hills'], UNVERIFIED()),
  m('Whitby', 'whitby', 'corridor-target', 'toronto', ['401-east'], ['ajax', 'oshawa'], UNVERIFIED()),
  m('Oshawa', 'oshawa', 'corridor-target', 'toronto', ['401-east'], ['whitby', 'clarington'], UNVERIFIED()),
  m('Clarington', 'clarington', 'corridor-target', 'toronto', ['401-east'], ['oshawa', 'kawartha-lakes'], UNVERIFIED()),
  m('Barrie', 'barrie', 'corridor-target', 'vaughan', ['400-north', 'cottage-north-east'], ['innisfil', 'newmarket'], UNVERIFIED()),
  m('Innisfil', 'innisfil', 'corridor-target', 'vaughan', ['400-north', 'cottage-north-east'], ['barrie', 'newmarket'], UNVERIFIED()),
  m('Hamilton', 'hamilton', 'corridor-target', 'mississauga', ['qew-west', '403-6-west'], ['burlington', 'stoney-creek', 'ancaster'], UNVERIFIED()),
  m('Ancaster', 'ancaster', 'corridor-target', 'mississauga', [], ['hamilton', 'dundas'], UNVERIFIED(), 'district', 'hamilton'),
  m('Dundas', 'dundas', 'corridor-target', 'mississauga', [], ['hamilton', 'ancaster'], UNVERIFIED(), 'district', 'hamilton'),
  m('Stoney Creek', 'stoney-creek', 'corridor-target', 'mississauga', [], ['hamilton', 'grimsby'], UNVERIFIED(), 'district', 'hamilton'),
  m('Grimsby', 'grimsby', 'corridor-target', 'mississauga', ['qew-west', 'niagara-belt'], ['stoney-creek', 'lincoln'], UNVERIFIED()),
  m('Guelph', 'guelph', 'corridor-target', 'hamilton', ['403-6-west'], ['cambridge', 'kitchener'], UNVERIFIED()),
  m('Cambridge', 'cambridge', 'corridor-target', 'hamilton', ['403-6-west'], ['kitchener', 'guelph'], UNVERIFIED()),
  m('Kitchener', 'kitchener', 'corridor-target', 'hamilton', ['403-6-west'], ['cambridge', 'guelph'], UNVERIFIED()),
  m('Lincoln', 'lincoln', 'corridor-target', 'grimsby', ['niagara-belt'], ['grimsby', 'st-catharines'], UNVERIFIED()),
  m('St. Catharines', 'st-catharines', 'corridor-target', 'grimsby', ['niagara-belt'], ['lincoln', 'thorold', 'niagara-on-the-lake'], UNVERIFIED()),
  m('Thorold', 'thorold', 'corridor-target', 'grimsby', ['niagara-belt'], ['st-catharines', 'welland'], UNVERIFIED()),
  m('Welland', 'welland', 'corridor-target', 'grimsby', ['niagara-belt'], ['thorold', 'port-colborne'], UNVERIFIED()),
  m('Niagara-on-the-Lake', 'niagara-on-the-lake', 'corridor-target', 'grimsby', ['niagara-belt'], ['st-catharines', 'niagara-falls-on'], UNVERIFIED()),
  m('Niagara Falls', 'niagara-falls-on', 'corridor-target', 'grimsby', ['niagara-belt', 'buffalo-niagara'], ['niagara-on-the-lake', 'fort-erie'], UNVERIFIED()),
  m('Port Colborne', 'port-colborne', 'corridor-target', 'grimsby', ['niagara-belt'], ['welland', 'fort-erie'], UNVERIFIED()),
  m('Fort Erie', 'fort-erie', 'corridor-target', 'grimsby', ['niagara-belt', 'buffalo-niagara'], ['port-colborne', 'niagara-falls-on'], UNVERIFIED()),
];

const TRAVEL_BY_CONFIRMATION: Market[] = [
  m('Kawartha Lakes', 'kawartha-lakes', 'travel-by-confirmation', 'toronto', ['401-east', 'cottage-north-east'], ['clarington', 'barrie'], {
    statement:
      'Outside the daily-return radius. A job here is scheduled as a trip, confirmed in advance, and priced with that in the written quote.',
    verifiedAt: '2026-09-09',
  }),
];

/* ── the United States side, and the line it does not cross ────────────────
 *
 * These six exist so that a property owner on the American side of the river
 * with an Ontario property can find an Ontario company. That is the whole
 * purpose. Ecowoods has no United States office, no United States address, no
 * United States phone number and no United States crew, and this file is where
 * that stops being a matter of good intentions: `us-proxy` is a status the
 * schema layer refuses to emit as service area, and scripts/verify-geo.mjs
 * fails the build if one appears there.
 */
const US_PROXY: Market[] = [
  us('Buffalo', 'buffalo', ['niagara-falls-ny', 'cheektowaga', 'amherst']),
  us('Niagara Falls', 'niagara-falls-ny', ['buffalo', 'lockport']),
  us('Amherst', 'amherst', ['buffalo', 'tonawanda']),
  us('Cheektowaga', 'cheektowaga', ['buffalo', 'amherst']),
  us('Tonawanda', 'tonawanda', ['buffalo', 'amherst']),
  us('Lockport', 'lockport', ['niagara-falls-ny', 'amherst']),
];

export const MARKETS: Market[] = [...CORE, ...CORRIDOR_TARGETS, ...TRAVEL_BY_CONFIRMATION, ...US_PROXY];

export const marketBySlug = (slug: string): Market | undefined =>
  MARKETS.find((x) => x.slug === slug);

export const marketsInCorridor = (id: string): Market[] =>
  MARKETS.filter((x) => (x.corridors as string[]).includes(id));

/** Statuses that describe actual coverage. Everything else is not service. */
export const OPERATIONAL_STATUSES: MarketStatus[] = [
  'core-active',
  'active-expansion',
  'travel-by-confirmation',
];

export const isOperational = (x: Market): boolean =>
  OPERATIONAL_STATUSES.includes(x.status) && x.operationalTruth.verifiedAt !== null;

/* ── constructors, so a record cannot be half-written ─────────────────────── */

function ACTIVE(verifiedAt: string) {
  return {
    statement: 'Within the daily-return radius of the Toronto shop. Routine scheduling.',
    verifiedAt,
  };
}

function TORONTO_TRUTH() {
  return {
    statement: 'Part of the City of Toronto, where the shop is. Routine daily coverage.',
    verifiedAt: '2026-09-09',
  };
}

/**
 * The default for a market nobody has confirmed. It is deliberately not a
 * sentence that could be pasted onto a page: there is nothing here to publish,
 * which is the point.
 */
function UNVERIFIED() {
  return { statement: '', verifiedAt: null };
}

function m(
  name: string,
  slug: string,
  status: MarketStatus,
  parentHub: string,
  corridors: CorridorId[],
  nearest: string[],
  operationalTruth: { statement: string; verifiedAt: string | null },
  kind: MarketKind = 'municipality',
  partOf?: string,
): Market {
  return {
    slug, name, country: 'CA', region: 'ON', kind, partOf,
    status, corridors, parentHub, nearest, localFacts: [], operationalTruth,
  };
}

function us(name: string, slug: string, nearest: string[]): Market {
  return {
    slug, name, country: 'US', region: 'NY', kind: 'municipality',
    status: 'us-proxy',
    corridors: ['buffalo-niagara'],
    parentHub: 'fort-erie',
    nearest,
    localFacts: [],
    operationalTruth: {
      statement:
        'Not a service area. Ecowoods operates in Ontario. This market exists so that an owner of an Ontario property who lives on the New York side can find the company.',
      verifiedAt: '2026-09-09',
    },
  };
}
