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
  /**
   * New York State, taking work. The showroom stays Toronto — there is no
   * second shop, no second phone, no United States address — and the job is on
   * site in the named city.
   */
  | 'us-active'
  /**
   * New York State, scheduled and confirmed in advance. Same six services, same
   * booking path, same salaried crew; the distance and the border crossing are
   * real and the schedule says so.
   */
  | 'us-by-confirmation';

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

/**
 * The date the owner confirmed the New York position: cross-border licensing
 * and crew work authorization in hand, and every western New York municipality
 * in this file a market Ecowoods takes work in.
 *
 * Before it, these markets carried the status `us-proxy` — advertising reach,
 * never service area — and three guards enforced that they could not hold a
 * page. That was the correct architecture for a company with no United States
 * position and the wrong one from this date. What the confirmation does NOT
 * change is the showroom, the phone, the hours, the price bands and the
 * reviews: those are Toronto facts, they appear on no page as local United
 * States facts, and a guard fails the build if a second address or phone
 * appears on a New York page.
 */
export const US_CONFIRMED_ON = '2026-09-10';

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

/* ── the luxury mesh and the lakeshore ────────────────────────────────────
 *
 * Communities inside municipalities that are already core-active, plus King
 * Township, which was assessed rather than published until 2026-09-10. Every
 * one of them is a place a homeowner names when they search — "hardwood
 * flooring Kleinburg", "refinishing Lorne Park" — and none of them was in this
 * file, so the geographic model could not see the queries the business most
 * wants to answer.
 *
 * They are DISTRICTS of their municipality, never municipalities. Angus Glen is
 * not a city beside Markham and Port Credit is not a city beside Mississauga;
 * the entity graph reads that literally and F-157 is the record of nearly
 * publishing it.
 */
const LUXURY_AND_LAKESHORE: Market[] = [
  m('King', 'king', 'active-expansion', 'vaughan', ['400-north', '407-york-peel'], ['vaughan', 'aurora', 'caledon'], COVERED('Vaughan')),
  m('King City', 'king-city', 'active-expansion', 'vaughan', [], ['king', 'aurora'], COVERED('Vaughan'), 'district', 'king'),
  m('Nobleton', 'nobleton', 'active-expansion', 'vaughan', [], ['king', 'caledon'], COVERED('Vaughan'), 'district', 'king'),
  m('Kleinburg', 'kleinburg', 'core-active', 'toronto', [], ['vaughan', 'woodbridge'], ACTIVE('2026-09-10'), 'district', 'vaughan'),
  m('Woodbridge', 'woodbridge', 'core-active', 'toronto', [], ['vaughan', 'kleinburg'], ACTIVE('2026-09-10'), 'district', 'vaughan'),
  m('Angus Glen', 'angus-glen', 'core-active', 'toronto', [], ['markham', 'cachet'], ACTIVE('2026-09-10'), 'district', 'markham'),
  m('Bayview Glen', 'bayview-glen', 'core-active', 'toronto', [], ['markham', 'richmond-hill'], ACTIVE('2026-09-10'), 'district', 'markham'),
  m('Cachet', 'cachet', 'core-active', 'toronto', [], ['markham', 'angus-glen'], ACTIVE('2026-09-10'), 'district', 'markham'),
  m('The Kingsway', 'the-kingsway', 'core-active', 'toronto', [], ['etobicoke', 'swansea'], TORONTO_TRUTH(), 'district', 'toronto'),
  m('Port Credit', 'port-credit', 'core-active', 'toronto', [], ['mississauga', 'mineola'], ACTIVE('2026-09-10'), 'district', 'mississauga'),
  m('Lorne Park', 'lorne-park', 'core-active', 'toronto', [], ['mississauga', 'clarkson'], ACTIVE('2026-09-10'), 'district', 'mississauga'),
  m('Mineola', 'mineola', 'core-active', 'toronto', [], ['mississauga', 'port-credit'], ACTIVE('2026-09-10'), 'district', 'mississauga'),
  m('Clarkson', 'clarkson', 'core-active', 'toronto', [], ['mississauga', 'lorne-park'], ACTIVE('2026-09-10'), 'district', 'mississauga'),
  m('Sheridan', 'sheridan', 'core-active', 'toronto', [], ['mississauga', 'clarkson'], ACTIVE('2026-09-10'), 'district', 'mississauga'),
];

/* ── New York State, and the line that still holds ─────────────────────────
 *
 * Until 2026-09-10 these were `us-proxy`: advertising reach for Ontario
 * property, never service area, and three guards enforced that none could hold
 * a page. That was right for a company with no United States position. The
 * owner confirmed cross-border licensing and crew work authorization on that
 * date, and every municipality below is now a market Ecowoods takes work in.
 *
 * THE LINE THAT DID NOT MOVE. There is one shop and one showroom, at 32
 * Norfield Crescent in Toronto. There is one phone number. The hours are
 * Toronto hours, the price bands are Ontario bands, and the 177 HomeStars and
 * 19 Google reviews are the company's, not any city's. Not one of those becomes
 * a local United States fact on any page below, and scripts/verify-geo.mjs
 * fails the build if a second address or telephone appears on a New York
 * surface. A page here says what is true: Ecowoods serves this city, the
 * showroom is Toronto, the job is on site, book the measure.
 *
 * Erie and Niagara counties run out from Buffalo; Monroe and Ontario counties
 * run out from Rochester on the rochester-east corridor.
 */
const US_MARKETS: Market[] = [
  /* Erie County — the Buffalo metro. */
  us('Buffalo', 'buffalo', ['cheektowaga', 'amherst', 'tonawanda'], ['buffalo-niagara', 'buffalo-metro']),
  us('Amherst', 'amherst', ['buffalo', 'tonawanda', 'clarence'], ['buffalo-niagara', 'buffalo-metro']),
  us('Williamsville', 'williamsville', ['amherst', 'clarence'], [], 'district', 'amherst'),
  us('Clarence', 'clarence', ['amherst', 'lancaster'], ['buffalo-metro']),
  us('Cheektowaga', 'cheektowaga', ['buffalo', 'lancaster'], ['buffalo-niagara', 'buffalo-metro']),
  us('Lancaster', 'lancaster', ['cheektowaga', 'clarence'], ['buffalo-metro']),
  us('West Seneca', 'west-seneca', ['buffalo', 'orchard-park'], ['buffalo-metro']),
  us('Tonawanda', 'tonawanda', ['buffalo', 'amherst', 'north-tonawanda'], ['buffalo-niagara', 'buffalo-metro']),
  us('Kenmore', 'kenmore', ['tonawanda', 'buffalo'], [], 'district', 'tonawanda'),
  us('Grand Island', 'grand-island', ['tonawanda', 'niagara-falls-ny'], ['buffalo-metro']),
  us('Orchard Park', 'orchard-park', ['buffalo', 'hamburg', 'west-seneca'], ['buffalo-metro']),
  us('Hamburg', 'hamburg', ['orchard-park', 'buffalo'], ['buffalo-metro']),
  us('East Aurora', 'east-aurora', ['orchard-park', 'hamburg'], ['buffalo-metro']),

  /* Niagara County — the cross-border run. */
  us('Niagara Falls', 'niagara-falls-ny', ['lewiston', 'wheatfield', 'grand-island'], ['buffalo-niagara']),
  us('Lewiston', 'lewiston', ['niagara-falls-ny', 'wheatfield'], ['buffalo-niagara']),
  us('Wheatfield', 'wheatfield', ['niagara-falls-ny', 'north-tonawanda'], ['buffalo-niagara']),
  us('North Tonawanda', 'north-tonawanda', ['tonawanda', 'wheatfield', 'lockport'], ['buffalo-niagara']),
  us('Lockport', 'lockport', ['north-tonawanda', 'wheatfield'], ['buffalo-niagara']),

  /* Monroe and Ontario counties — the Rochester run, east along the lake. */
  us('Rochester', 'rochester-ny', ['brighton', 'irondequoit', 'greece'], ['rochester-east'], 'municipality', undefined, 'us-by-confirmation', 'rochester-ny'),
  us('Brighton', 'brighton', ['rochester-ny', 'pittsford'], ['rochester-east'], 'municipality', undefined, 'us-by-confirmation', 'rochester-ny'),
  us('Pittsford', 'pittsford', ['brighton', 'fairport'], ['rochester-east'], 'municipality', undefined, 'us-by-confirmation', 'rochester-ny'),
  us('Fairport', 'fairport', ['pittsford', 'victor'], ['rochester-east'], 'municipality', undefined, 'us-by-confirmation', 'rochester-ny'),
  us('Victor', 'victor', ['fairport', 'pittsford'], ['rochester-east'], 'municipality', undefined, 'us-by-confirmation', 'rochester-ny'),
  us('Webster', 'webster', ['irondequoit', 'fairport'], ['rochester-east'], 'municipality', undefined, 'us-by-confirmation', 'rochester-ny'),
  us('Irondequoit', 'irondequoit', ['rochester-ny', 'webster'], ['rochester-east'], 'municipality', undefined, 'us-by-confirmation', 'rochester-ny'),
  us('Greece', 'greece', ['rochester-ny', 'irondequoit'], ['rochester-east'], 'municipality', undefined, 'us-by-confirmation', 'rochester-ny'),
];

export const MARKETS: Market[] = [
  ...CORE,
  ...TORONTO_NEIGHBOURHOODS,
  ...LUXURY_AND_LAKESHORE,
  ...CORRIDOR_TARGETS,
  ...TRAVEL_BY_CONFIRMATION,
  ...US_MARKETS,
];

export const marketBySlug = (slug: string): Market | undefined =>
  MARKETS.find((x) => x.slug === slug);

export const marketsInCorridor = (id: string): Market[] =>
  MARKETS.filter((x) => (x.corridors as string[]).includes(id));

/**
 * Statuses that describe actual coverage.
 *
 * `us-proxy` was here until 2026-09-10 and is gone from the type entirely. It
 * meant "advertising reach, never service area", and it was correct for exactly
 * as long as the business had no United States position. The owner confirmed
 * cross-border licensing and crew work authorization on 2026-09-10, and from
 * that date a New York municipality is a market this company takes work in.
 *
 * What did NOT change with it: the showroom, the phone, the hours, the price
 * bands and the reviews are Toronto facts and appear nowhere as local United
 * States facts. `verify-geo.mjs` fails the build if a second address or phone
 * ever appears on a New York page.
 */
export const OPERATIONAL_STATUSES: MarketStatus[] = [
  'core-active',
  'active-expansion',
  'travel-by-confirmation',
  'us-active',
  'us-by-confirmation',
];

/** The two statuses that mean New York. Used where the copy differs, not the offer. */
export const US_STATUSES: MarketStatus[] = ['us-active', 'us-by-confirmation'];

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
  status: MarketStatus = 'us-active',
  hub = 'buffalo',
): Market {
  return {
    slug, name, country: 'US', region: 'NY', kind, partOf,
    status,
    corridors: kind === 'district' ? [] : corridors,
    parentHub: hub,
    nearest,
    localFacts: [],
    operationalTruth: {
      statement:
        `Owner-confirmed service area in New York State. Ecowoods takes hardwood installation, refinishing, ` +
        `dust-free sanding, restoration, stair refinishing and custom inlay work in ${name}. The shop and ` +
        'showroom are in Toronto; there is no second address, phone or crew in New York State.',
      verifiedAt: US_CONFIRMED_ON,
      verifiedBy: OWNER,
    },
  };
}
