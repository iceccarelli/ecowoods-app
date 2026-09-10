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

/**
 * Who confirmed an operational position. One value today, deliberately: the
 * owner. A second value would need a second process behind it.
 */
export type ConfirmedBy = 'owner';

/**
 * The date the owner confirmed coverage of the full Ontario map — all forty-
 * three markets in this file, every corridor end to end. Before it, twenty-five
 * of them carried `verifiedAt: null` and were correctly excluded from the
 * service area; after it, none do.
 *
 * It is one date rather than twenty-five because it was one statement. Writing
 * twenty-five different plausible-looking dates would make the record look more
 * thoroughly assembled than it is, which is the opposite of what this field is
 * for.
 */
export const OWNER_CONFIRMED_ON = '2026-09-10';

const OWNER: ConfirmedBy = 'owner';

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
   * What can honestly be said about serving this market, the date somebody
   * confirmed it, and who. A market with `verifiedAt: null` may appear in the
   * graph and in a corridor; it may not carry a page that implies coverage.
   *
   * `verifiedBy` exists so that one kind of truth is never mistaken for
   * another. `'owner'` means the owner of this business stated, on that date,
   * that the company covers this market — which is the only person entitled to
   * say it, and is exactly as strong as that. It is NOT a record of documented
   * completed work: that lives in CityContent and in the Floor Graph, and a
   * market carrying an owner confirmation and nothing else still has no page,
   * because lib/geo/worthiness.ts requires real local content independently.
   *
   * The distinction matters the day somebody asks what a claim rests on.
   */
  operationalTruth: { statement: string; verifiedAt: string | null; verifiedBy?: ConfirmedBy };
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
    verifiedBy: OWNER,
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

/* ── the sixteen Toronto neighbourhoods ───────────────────────────────────
 *
 * These have had pages, local content, sitemap entries and .md editions since
 * F-157 was resolved. What they did not have was a record in this file, which
 * meant the geographic model — corridors, the API, the expansion score, the
 * allocation audit — could not see the sixteen highest-intent pages on the
 * site. A query for "hardwood flooring Rosedale" was served by a page the
 * geography layer did not know existed.
 *
 * They enter as DISTRICTS of Toronto, never municipalities. That is the whole
 * of F-157: `serviceAreaMarkets()` filters to `kind === 'municipality'`, and
 * root-schema derives areaServed from CITIES, so a neighbourhood arriving as a
 * municipality would declare Rosedale a city of Ontario alongside Mississauga.
 * It is not. It is a neighbourhood inside a city that is already in the list,
 * and stating otherwise is a factual error in the one part of this site whose
 * job is to state facts a machine can rely on.
 *
 * Corridor membership is empty and inherited through `partOf`, exactly as it is
 * for North York and Etobicoke: a corridor is a drive between municipalities,
 * and Yorkville does not sit on the QEW separately from Toronto.
 */
const TORONTO_NEIGHBOURHOODS: Market[] = [
  m('Rosedale', 'rosedale', 'core-active', 'toronto', [], ['toronto', 'yorkville', 'cabbagetown'], TORONTO_TRUTH(), 'district', 'toronto'),
  m('Forest Hill', 'forest-hill', 'core-active', 'toronto', [], ['toronto', 'midtown-toronto', 'the-annex'], TORONTO_TRUTH(), 'district', 'toronto'),
  m('Yorkville', 'yorkville', 'core-active', 'toronto', [], ['toronto', 'the-annex', 'rosedale'], TORONTO_TRUTH(), 'district', 'toronto'),
  m('Leaside', 'leaside', 'core-active', 'toronto', [], ['toronto', 'davisville-village', 'east-york'], TORONTO_TRUTH(), 'district', 'toronto'),
  m('The Annex', 'the-annex', 'core-active', 'toronto', [], ['toronto', 'yorkville', 'forest-hill'], TORONTO_TRUTH(), 'district', 'toronto'),
  m('High Park', 'high-park', 'core-active', 'toronto', [], ['toronto', 'swansea', 'liberty-village'], TORONTO_TRUTH(), 'district', 'toronto'),
  m('Riverdale', 'riverdale', 'core-active', 'toronto', [], ['toronto', 'leslieville', 'cabbagetown'], TORONTO_TRUTH(), 'district', 'toronto'),
  m('Leslieville', 'leslieville', 'core-active', 'toronto', [], ['toronto', 'riverdale', 'the-beaches'], TORONTO_TRUTH(), 'district', 'toronto'),
  m('The Beaches', 'the-beaches', 'core-active', 'toronto', [], ['toronto', 'leslieville', 'east-york'], TORONTO_TRUTH(), 'district', 'toronto'),
  m('Lawrence Park', 'lawrence-park', 'core-active', 'toronto', [], ['toronto', 'midtown-toronto', 'north-york'], TORONTO_TRUTH(), 'district', 'toronto'),
  m('Cabbagetown', 'cabbagetown', 'core-active', 'toronto', [], ['toronto', 'riverdale', 'downtown-toronto'], TORONTO_TRUTH(), 'district', 'toronto'),
  m('Swansea', 'swansea', 'core-active', 'toronto', [], ['toronto', 'high-park', 'etobicoke'], TORONTO_TRUTH(), 'district', 'toronto'),
  m('Davisville Village', 'davisville-village', 'core-active', 'toronto', [], ['toronto', 'midtown-toronto', 'leaside'], TORONTO_TRUTH(), 'district', 'toronto'),
  m('Midtown Toronto', 'midtown-toronto', 'core-active', 'toronto', [], ['toronto', 'davisville-village', 'forest-hill'], TORONTO_TRUTH(), 'district', 'toronto'),
  m('King West', 'king-west', 'core-active', 'toronto', [], ['toronto', 'liberty-village', 'downtown-toronto'], TORONTO_TRUTH(), 'district', 'toronto'),
  m('Liberty Village', 'liberty-village', 'core-active', 'toronto', [], ['toronto', 'king-west', 'high-park'], TORONTO_TRUTH(), 'district', 'toronto'),
];

/* ── the corridor, confirmed end to end ───────────────────────────────────
 *
 * These twenty-five carried `verifiedAt: null` until the owner confirmed them
 * on 2026-09-10. Nothing else about them changed: no local content was
 * invented, no housing note was written, no signature project appeared. What
 * changed is that the one thing only the owner could supply — whether this
 * company covers these places — is now on the record with a date and a name
 * against it, and the graph, the corridors and the service area can stop
 * saying "unconfirmed" about places the business actually serves.
 *
 * They are NOT all the same kind of coverage, and flattening them into one
 * status would have thrown away the most useful thing in the file. Eleven are
 * inside the daily-return radius and are scheduled like any other GTA job.
 * Fourteen — the far Niagara belt, the 403/6 run to Kitchener, the north end of
 * the 400 — are a real drive, and say so. A customer in Port Colborne reading
 * "scheduled as a trip, confirmed in advance, and priced with that in the
 * written quote" is being told something true that helps them; a customer in
 * Port Colborne reading "routine daily coverage" finds out it was not on the
 * day nobody arrives.
 *
 * Records, still not pages. Every one of these is now a confirmed market in the
 * service area, in the API and on its corridor page — and none of them has an
 * indexable municipal page, because lib/geo/worthiness.ts requires real local
 * content and no amount of confirmation substitutes for it. That gate did not
 * move.
 */
const CORRIDOR_TARGETS: Market[] = [
  m('Milton', 'milton', 'active-expansion', 'toronto', ['core-gta'], ['oakville', 'halton-hills', 'burlington'], COVERED('Toronto')),
  m('Burlington', 'burlington', 'active-expansion', 'mississauga', ['core-gta', 'qew-west'], ['oakville', 'hamilton', 'milton'], COVERED('Mississauga')),
  m('Halton Hills', 'halton-hills', 'active-expansion', 'vaughan', ['407-york-peel'], ['milton', 'caledon'], COVERED('Vaughan')),
  m('Caledon', 'caledon', 'active-expansion', 'vaughan', ['407-york-peel'], ['brampton', 'halton-hills'], COVERED('Vaughan')),
  m('Whitby', 'whitby', 'active-expansion', 'toronto', ['401-east'], ['ajax', 'oshawa'], COVERED('Toronto')),
  m('Oshawa', 'oshawa', 'active-expansion', 'toronto', ['401-east'], ['whitby', 'clarington'], COVERED('Toronto')),
  m('Clarington', 'clarington', 'travel-by-confirmation', 'toronto', ['401-east'], ['oshawa', 'kawartha-lakes'], BY_TRIP('Toronto')),
  m('Barrie', 'barrie', 'travel-by-confirmation', 'vaughan', ['400-north', 'cottage-north-east'], ['innisfil', 'newmarket'], BY_TRIP('Vaughan')),
  m('Innisfil', 'innisfil', 'travel-by-confirmation', 'vaughan', ['400-north', 'cottage-north-east'], ['barrie', 'newmarket'], BY_TRIP('Vaughan')),
  m('Hamilton', 'hamilton', 'active-expansion', 'mississauga', ['qew-west', '403-6-west'], ['burlington', 'stoney-creek', 'ancaster'], COVERED('Mississauga')),
  m('Ancaster', 'ancaster', 'active-expansion', 'mississauga', [], ['hamilton', 'dundas'], COVERED('Mississauga'), 'district', 'hamilton'),
  m('Dundas', 'dundas', 'active-expansion', 'mississauga', [], ['hamilton', 'ancaster'], COVERED('Mississauga'), 'district', 'hamilton'),
  m('Stoney Creek', 'stoney-creek', 'active-expansion', 'mississauga', [], ['hamilton', 'grimsby'], COVERED('Mississauga'), 'district', 'hamilton'),
  m('Waterdown', 'waterdown', 'active-expansion', 'mississauga', [], ['hamilton', 'dundas'], COVERED('Mississauga'), 'district', 'hamilton'),
  m('Grimsby', 'grimsby', 'active-expansion', 'mississauga', ['qew-west', 'niagara-belt'], ['stoney-creek', 'lincoln'], COVERED('Mississauga')),
  m('Guelph', 'guelph', 'travel-by-confirmation', 'hamilton', ['403-6-west'], ['cambridge', 'kitchener'], BY_TRIP('Hamilton')),
  m('Cambridge', 'cambridge', 'travel-by-confirmation', 'hamilton', ['403-6-west'], ['kitchener', 'guelph'], BY_TRIP('Hamilton')),
  m('Kitchener', 'kitchener', 'travel-by-confirmation', 'hamilton', ['403-6-west'], ['cambridge', 'guelph'], BY_TRIP('Hamilton')),
  m('Lincoln', 'lincoln', 'travel-by-confirmation', 'grimsby', ['niagara-belt'], ['grimsby', 'st-catharines'], BY_TRIP('Grimsby')),
  m('Beamsville', 'beamsville', 'travel-by-confirmation', 'grimsby', [], ['lincoln', 'grimsby'], BY_TRIP('Grimsby'), 'district', 'lincoln'),
  m('St. Catharines', 'st-catharines', 'travel-by-confirmation', 'grimsby', ['niagara-belt'], ['lincoln', 'thorold', 'niagara-on-the-lake'], BY_TRIP('Grimsby')),
  m('Thorold', 'thorold', 'travel-by-confirmation', 'grimsby', ['niagara-belt'], ['st-catharines', 'welland'], BY_TRIP('Grimsby')),
  m('Welland', 'welland', 'travel-by-confirmation', 'grimsby', ['niagara-belt'], ['thorold', 'port-colborne'], BY_TRIP('Grimsby')),
  m('Niagara-on-the-Lake', 'niagara-on-the-lake', 'travel-by-confirmation', 'grimsby', ['niagara-belt'], ['st-catharines', 'niagara-falls-on'], BY_TRIP('Grimsby')),
  m('Niagara Falls', 'niagara-falls-on', 'travel-by-confirmation', 'grimsby', ['niagara-belt', 'buffalo-niagara'], ['niagara-on-the-lake', 'fort-erie'], BY_TRIP('Grimsby')),
  m('Port Colborne', 'port-colborne', 'travel-by-confirmation', 'grimsby', ['niagara-belt'], ['welland', 'fort-erie'], BY_TRIP('Grimsby')),
  m('Fort Erie', 'fort-erie', 'travel-by-confirmation', 'grimsby', ['niagara-belt', 'buffalo-niagara'], ['port-colborne', 'niagara-falls-on'], BY_TRIP('Grimsby')),
];

const TRAVEL_BY_CONFIRMATION: Market[] = [
  m('Kawartha Lakes', 'kawartha-lakes', 'travel-by-confirmation', 'toronto', ['401-east', 'cottage-north-east'], ['clarington', 'barrie'], {
    statement:
      'Outside the daily-return radius. A job here is scheduled as a trip, confirmed in advance, and priced with that in the written quote.',
    verifiedAt: '2026-09-09',
    verifiedBy: 'owner',
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
  /* Erie County, on the Buffalo metro corridor. */
  us('Buffalo', 'buffalo', ['niagara-falls-ny', 'cheektowaga', 'amherst'], ['buffalo-niagara', 'buffalo-metro']),
  us('Amherst', 'amherst', ['buffalo', 'tonawanda'], ['buffalo-niagara', 'buffalo-metro']),
  us('Williamsville', 'williamsville', ['amherst', 'clarence'], [], 'district', 'amherst'),
  us('Clarence', 'clarence', ['amherst', 'lockport'], ['buffalo-metro']),
  us('Cheektowaga', 'cheektowaga', ['buffalo', 'amherst'], ['buffalo-niagara', 'buffalo-metro']),
  us('Tonawanda', 'tonawanda', ['buffalo', 'amherst'], ['buffalo-niagara', 'buffalo-metro']),
  us('Kenmore', 'kenmore', ['tonawanda', 'buffalo'], [], 'district', 'tonawanda'),
  us('Orchard Park', 'orchard-park', ['buffalo', 'hamburg'], ['buffalo-metro']),
  us('Hamburg', 'hamburg', ['buffalo', 'orchard-park'], ['buffalo-metro']),
  us('East Aurora', 'east-aurora', ['orchard-park', 'hamburg'], ['buffalo-metro']),
  us('Grand Island', 'grand-island', ['tonawanda', 'niagara-falls-ny'], ['buffalo-metro']),

  /* Niagara County, on the cross-border corridor. */
  us('Niagara Falls', 'niagara-falls-ny', ['buffalo', 'lockport'], ['buffalo-niagara']),
  us('Lewiston', 'lewiston', ['niagara-falls-ny', 'north-tonawanda'], ['buffalo-niagara']),
  us('North Tonawanda', 'north-tonawanda', ['tonawanda', 'lockport'], ['buffalo-niagara']),
  us('Lockport', 'lockport', ['niagara-falls-ny', 'north-tonawanda'], ['buffalo-niagara']),
];

export const MARKETS: Market[] = [
  ...CORE,
  ...TORONTO_NEIGHBOURHOODS,
  ...CORRIDOR_TARGETS,
  ...TRAVEL_BY_CONFIRMATION,
  ...US_PROXY,
];

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
    verifiedBy: OWNER,
  };
}

function TORONTO_TRUTH() {
  return {
    statement: 'Part of the City of Toronto, where the shop is. Routine daily coverage.',
    verifiedAt: '2026-09-09',
    verifiedBy: OWNER,
  };
}


/**
 * COVERED — a market the owner confirmed is worked inside the day.
 *
 * The hub is named because it is the fact that makes the sentence checkable
 * rather than promotional: a crew sets out from somewhere, and saying where
 * turns "we serve Burlington" into something with an operational shape. The
 * hub on every record is the same value this sentence quotes, so the two
 * cannot drift.
 */
function COVERED(hubName: string) {
  return {
    statement:
      `Owner-confirmed coverage. Worked from the ${hubName} hub, inside the daily-return radius, ` +
      'with routine scheduling.',
    verifiedAt: OWNER_CONFIRMED_ON,
    verifiedBy: OWNER,
  };
}

/**
 * BY_TRIP — confirmed coverage, honestly priced.
 *
 * The far ends of the Niagara belt, the 403/6 run to Kitchener and the north
 * end of the 400 are real coverage and a real drive. Saying so is worth more
 * than either of the two easy lies: that the distance is not there, or that
 * the market is not served. The wording is the owner's own from Kawartha
 * Lakes, which is where this sentence started.
 */
function BY_TRIP(hubName: string) {
  return {
    statement:
      `Owner-confirmed coverage, reached from the ${hubName} hub. Outside the daily-return radius: a job ` +
      'here is scheduled as a trip, confirmed in advance, and priced with that in the written quote.',
    verifiedAt: OWNER_CONFIRMED_ON,
    verifiedBy: OWNER,
  };
}

/**
 * The default for a market nobody has confirmed. It is deliberately not a
 * sentence that could be pasted onto a page: there is nothing here to publish,
 * which is the point.
 *
 * No market uses it today — the owner confirmed all forty-three on
 * {@link OWNER_CONFIRMED_ON}. It is exported and kept because the next
 * municipality added to this file must start here, unconfirmed, and having to
 * write the empty record by hand is exactly the friction that stops a place
 * name being pasted in with a coverage claim attached.
 */
export function UNVERIFIED() {
  return { statement: '', verifiedAt: null };
}

function m(
  name: string,
  slug: string,
  status: MarketStatus,
  parentHub: string,
  corridors: CorridorId[],
  nearest: string[],
  operationalTruth: { statement: string; verifiedAt: string | null; verifiedBy?: ConfirmedBy },
  kind: MarketKind = 'municipality',
  partOf?: string,
): Market {
  return {
    slug, name, country: 'CA', region: 'ON', kind, partOf,
    status, corridors, parentHub, nearest, localFacts: [], operationalTruth,
  };
}

function us(
  name: string,
  slug: string,
  nearest: string[],
  corridors: CorridorId[] = ['buffalo-niagara'],
  kind: MarketKind = 'municipality',
  partOf?: string,
): Market {
  return {
    slug, name, country: 'US', region: 'NY', kind, partOf,
    status: 'us-proxy',
    corridors: kind === 'district' ? [] : corridors,
    parentHub: 'fort-erie',
    nearest,
    localFacts: [],
    operationalTruth: {
      statement:
        'Not a service area. Ecowoods operates in Ontario. This market exists so that an owner of an Ontario property who lives on the New York side can find the company.',
      verifiedAt: '2026-09-09',
      verifiedBy: 'owner',
    },
  };
}
