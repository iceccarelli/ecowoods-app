/**
 * seo-data.ts — single source of truth for programmatic SEO.
 * Cities, services and FAQs used by the sitemap, the /service-areas pages,
 * the JSON-LD builders and llms.txt. Keep business facts here in sync with
 * lib/structured-data.ts (NAP) and the homepage FAQ.
 */

import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { MARKETS } from '@/content/geo/markets';
import {
  SCREEN_RECOAT,
  FULL_SAND_FINISH,
  NEW_INSTALL,
  formatBandBare as bandBare,
} from '@/content/constants/pricing';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ecowoods.ca';

/**
 * Derived from BUSINESS_NAP so there is exactly one place to change a business
 * fact. Shape preserved for existing call sites.
 */
export const BUSINESS = {
  name: BUSINESS_NAP.name,
  phone: BUSINESS_NAP.phoneSchema,
  phoneDisplay: BUSINESS_NAP.phoneDisplay,
  email: BUSINESS_NAP.email,
  region: BUSINESS_NAP.region,
  address: BUSINESS_NAP.address,
  foundedYear: BUSINESS_NAP.foundedYear,
} as const;

export type City = { slug: string; name: string };

const AREAS = [
  /*
   * The inner ring. The six former municipalities of Toronto — Downtown
   * Toronto, North York, Etobicoke, Scarborough, East York and York — were in
   * this list until GEO-001, which made each of them a schema.org City node
   * beside the City of Toronto that contains them. content/geo/markets.ts has
   * always recorded them as districts of Toronto; they are in DISTRICTS below
   * now, with the same pages, and emit as a Place inside Toronto. GC-003.
   */
  'Vaughan', 'Markham', 'Richmond Hill', 'Mississauga', 'Oakville', 'Brampton',
  'Aurora', 'Newmarket', 'Pickering', 'Ajax',
  /*
   * The eleven owner-confirmed municipalities that had no page (GEO-001).
   * Each was a confirmed market in content/geo/markets.ts and in the
   * /api/v1/markets service area, and had no URL, no sitemap entry and no
   * graph edge — a coverage claim with nothing behind it (GC-001). Each now
   * has local content written from public geography, with no job, review or
   * address invented for it.
   */
  'Whitby', 'Oshawa', 'Clarington', 'Kawartha Lakes', 'Halton Hills', 'Caledon',
  'Innisfil', 'Guelph', 'Cambridge', 'Kitchener', 'Port Colborne',
  /*
   * The corridor west and south, published after the owner confirmed coverage
   * of the whole Ontario map on 2026-09-10. Every name here exists in
   * content/geo/markets.ts as a municipality with a dated operational
   * confirmation, and scripts/verify-geo.mjs fails the build if one does not —
   * that join is what stops this list becoming a coverage claim by edit.
   */
  'Milton', 'Burlington', 'Hamilton', 'Grimsby',
  'St. Catharines', 'Niagara-on-the-Lake', 'Niagara Falls', 'Barrie',
  /* King Township, and the rest of the Niagara belt. */
  'King', 'Lincoln', 'Welland', 'Thorold', 'Fort Erie',
  /*
   * New York State, published 2026-09-10 when the owner confirmed cross-border
   * licensing and crew work authorization. Erie and Niagara counties out from
   * Buffalo; Monroe and Ontario counties out from Rochester.
   *
   * The showroom, the telephone, the hours, the price bands and the reviews are
   * Toronto facts and appear on none of these pages as local United States
   * facts. `scripts/verify-geo.mjs` fails the build if a second address or
   * phone number ever appears in the geographic content.
   */
  'Buffalo', 'Amherst', 'Clarence', 'Cheektowaga', 'Lancaster', 'West Seneca',
  'Tonawanda', 'Grand Island', 'Orchard Park', 'Hamburg', 'East Aurora',
  'Niagara Falls, NY', 'Lewiston', 'Wheatfield', 'North Tonawanda', 'Lockport',
  'Rochester, NY', 'Brighton', 'Pittsford', 'Fairport', 'Victor', 'Webster',
  'Irondequoit', 'Greece',
];

/**
 * The one display name that does not slugify to its market slug.
 *
 * There are two Niagara Falls on this corridor and the registry disambiguates
 * them as `niagara-falls-on` and `niagara-falls-ny`, which is not negotiable —
 * one silently overwrites the other in every lookup otherwise. The page is for
 * a Canadian audience and is titled "Niagara Falls", so the name and the slug
 * part company exactly here. Both this file and verify-geo read this map, so
 * they cannot disagree about which market a page belongs to.
 */
export const AREA_SLUG_OVERRIDES: Record<string, string> = {
  'Niagara Falls': 'niagara-falls-on',
};

/**
 * Places INSIDE a municipality: the six former municipalities of Toronto
 * (since GEO-001), and communities inside a municipality that is in AREAS.
 *
 * Ancaster, Dundas, Stoney Creek and Waterdown are communities of the City of
 * Hamilton; Beamsville is the main community of the Town of Lincoln. They are
 * the same category as the sixteen Toronto neighbourhoods and get the same
 * treatment: pages, local content, sitemap entries, .md editions — and never a
 * schema.org City node, because Hamilton is already in the list and Ancaster is
 * not a second city inside it.
 *
 * The parent is carried here rather than assumed, because the Toronto list
 * could assume it and this one cannot: `placeForArea` emits Ancaster as a Place
 * contained in Hamilton and Beamsville as a Place contained in Lincoln, and a
 * hard-coded "Toronto" would have made both of them wrong in the one part of
 * the site a machine reads literally.
 */
const DISTRICTS: Array<{ name: string; partOf: string }> = [
  /* The six former municipalities of Toronto. Districts of the City of Toronto (GC-003). */
  { name: 'Downtown Toronto', partOf: 'Toronto' },
  { name: 'North York', partOf: 'Toronto' },
  { name: 'Etobicoke', partOf: 'Toronto' },
  { name: 'Scarborough', partOf: 'Toronto' },
  { name: 'East York', partOf: 'Toronto' },
  { name: 'York', partOf: 'Toronto' },
  { name: 'Ancaster', partOf: 'Hamilton' },
  { name: 'Dundas', partOf: 'Hamilton' },
  { name: 'Stoney Creek', partOf: 'Hamilton' },
  { name: 'Waterdown', partOf: 'Hamilton' },
  { name: 'Beamsville', partOf: 'Lincoln' },
  /* King Township. */
  { name: 'King City', partOf: 'King' },
  { name: 'Nobleton', partOf: 'King' },
  /* Vaughan. */
  { name: 'Kleinburg', partOf: 'Vaughan' },
  { name: 'Woodbridge', partOf: 'Vaughan' },
  /* Markham. */
  { name: 'Angus Glen', partOf: 'Markham' },
  { name: 'Bayview Glen', partOf: 'Markham' },
  { name: 'Cachet', partOf: 'Markham' },
  /* Mississauga's lakeshore. */
  { name: 'Port Credit', partOf: 'Mississauga' },
  { name: 'Lorne Park', partOf: 'Mississauga' },
  { name: 'Mineola', partOf: 'Mississauga' },
  { name: 'Clarkson', partOf: 'Mississauga' },
  { name: 'Sheridan', partOf: 'Mississauga' },
  /* Erie County. */
  { name: 'Williamsville', partOf: 'Amherst' },
  { name: 'Kenmore', partOf: 'Tonawanda' },
];

/**
 * The Toronto sixteen plus The Kingsway. Listed with the neighbourhoods rather
 * than the districts because its parent is Toronto, not a municipality beside
 * it — Etobicoke is itself a district and a district may not contain another.
 */
const EXTRA_TORONTO = ['The Kingsway'];

/**
 * Toronto neighbourhoods. Pages, yes — `schema.org/City`, no.
 *
 * F-157. These sixteen arrived in AREAS, which would have been the fastest way
 * to give each one a page. It would also have put them straight into
 * `LocalBusiness.areaServed` as `City` nodes, because root-schema derives that
 * list from CITIES — so the entity graph would have declared Rosedale, King
 * West, The Annex and Liberty Village to be cities.
 *
 * They are not. They are neighbourhoods inside Toronto, a city already in the
 * list. Declaring them as peers of Mississauga and Oakville is not an
 * exaggeration a crawler forgives; it is a factual error in the one part of the
 * site whose entire job is to state facts a machine can rely on. The project's
 * own rule is that structured data describes reality.
 *
 * So they are a separate list. They get pages, they get local content, they get
 * sitemap entries and `.md` editions — everything a query for "hardwood
 * flooring Rosedale" needs. What they do not get is a `City` node claiming
 * Toronto has sixteen more cities inside it.
 */
const NEIGHBOURHOODS = [
  'Rosedale', 'Forest Hill', 'Yorkville', 'Leaside', 'The Annex', 'High Park',
  'Riverdale', 'Leslieville', 'The Beaches', 'Lawrence Park', 'Cabbagetown',
  'Swansea', 'Davisville Village', 'Midtown Toronto', 'King West', 'Liberty Village',
];

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** Municipalities. These, and only these, become schema.org City nodes. */
export const CITIES: City[] = AREAS.map((name) => ({
  slug: AREA_SLUG_OVERRIDES[name] ?? slugify(name),
  name,
}));

/** Toronto neighbourhoods. Pages and local content; never a City node. */
export const NEIGHBOURHOOD_AREAS: City[] = [...NEIGHBOURHOODS, ...EXTRA_TORONTO].map((name) => ({
  slug: slugify(name),
  name,
}));

/**
 * Slugs of areas in New York State. The page appends ", NY" to the title and
 * heading for these, so a search result and a schema name both disambiguate a
 * Niagara Falls or a Brighton without the reader having to know which one.
 * Derived from the market registry rather than restated, so a market changing
 * country cannot leave a page saying the wrong one.
 */
export const US_AREA_SLUGS = new Set(
  MARKETS.filter((mk) => mk.country === 'US').map((mk) => mk.slug),
);

/**
 * Ontario markets whose name is also the name of a New York market — today,
 * Niagara Falls. The New York one already says ", NY"; until GEO-001 the
 * Ontario one said nothing, so a title, an H1 and a schema name all read
 * "Niagara Falls" and a reader resolved it against whichever one they knew
 * (GC-014). Derived from the registry, so a new collision is disambiguated the
 * day it is added.
 */
const bareName = (n: string) => n.replace(/,\s*(NY|ON)$/, '').trim().toLowerCase();
const US_MARKET_NAMES = new Set(MARKETS.filter((mk) => mk.country === 'US').map((mk) => bareName(mk.name)));
const CA_NAME_COLLISIONS = new Set(
  MARKETS.filter((mk) => mk.country === 'CA' && US_MARKET_NAMES.has(bareName(mk.name))).map((mk) => mk.slug),
);

/** The area name as a page says it: "Buffalo, NY", "Niagara Falls, ON", "Oakville". */
export const areaDisplayName = (area: City): string => {
  if (US_AREA_SLUGS.has(area.slug)) return /,\s*NY$/.test(area.name) ? area.name : `${area.name}, NY`;
  if (CA_NAME_COLLISIONS.has(area.slug)) return /,\s*ON$/.test(area.name) ? area.name : `${area.name}, ON`;
  return area.name;
};

/**
 * Everything with a /service-areas page. The routes, the sitemap, the .md
 * editions and the local-content guard all read this; only CITIES reaches the
 * entity graph.
 */
/**
 * Communities inside a municipality other than Toronto. Pages, never City nodes.
 * `partOf` is the municipality name as it appears in AREAS.
 */
export const DISTRICT_AREAS: Array<City & { partOf: string }> = DISTRICTS.map((d) => ({
  slug: slugify(d.name),
  name: d.name,
  partOf: d.partOf,
}));

/**
 * The top level a visitor chooses from: Toronto's six districts, then every
 * municipality. The footer column, the resources index, the framework's area
 * select and the library promo list these. Before GEO-001 they listed CITIES,
 * which happened to start with the six Toronto districts because those were
 * (wrongly) municipalities; they keep the same first entries now that they are
 * districts, and the lists stay derived.
 */
const TORONTO_DISTRICT_AREAS = DISTRICT_AREAS.filter((d) => d.partOf === 'Toronto');
export const PRIMARY_AREAS: City[] = [...TORONTO_DISTRICT_AREAS, ...CITIES];

export const SERVICE_AREAS: City[] = [
  ...PRIMARY_AREAS,
  ...NEIGHBOURHOOD_AREAS,
  ...DISTRICT_AREAS.filter((d) => d.partOf !== 'Toronto'),
];

export const cityBySlug = (slug: string): City | undefined =>
  SERVICE_AREAS.find((c) => c.slug === slug);

export type Service = { slug: string; name: string; blurb: string };

export const SERVICES: Service[] = [
  { slug: 'hardwood-installation', name: 'Hardwood Flooring Installation', blurb: 'Solid and engineered hardwood laid by salaried craftsmen — straight-lay, herringbone, chevron and custom patterns.' },
  { slug: 'floor-refinishing', name: 'Hardwood Floor Refinishing', blurb: 'Bring tired floors back to life: sand to bare wood, re-stain and re-finish for a factory-fresh surface.' },
  { slug: 'dust-free-sanding', name: 'Dust-Free Floor Sanding', blurb: 'HEPA-sealed extraction at the machine and containment at the room, so most clients stay home during the work.' },
  { slug: 'floor-restoration', name: 'Hardwood Floor Restoration', blurb: 'Rescue and repair heritage and water-damaged floors — board replacement, feathering and colour matching.' },
  { slug: 'custom-inlays', name: 'Custom Inlays & Borders', blurb: 'Bespoke feature strips, medallions and borders routed and fitted by hand for a signature look.' },
  { slug: 'stair-refinishing', name: 'Stair Refinishing', blurb: 'Treads, risers and nosings refinished to match your floors for a seamless, hard-wearing finish.' },
];

export type FaqItem = { q: string; a: string };

// Mirror of the homepage FAQ — kept here so it can be emitted as FAQPage JSON-LD
// on every page. Keep in sync with app/page.tsx faqItems.
export const FAQ_ITEMS: FaqItem[] = [
  { q: 'Is the estimate really fixed? What about "unforeseen conditions"?', a: 'Yes — fixed, in writing, in your contract. Our senior estimator moisture-tests your subfloor and inspects conditions during the free consultation, so there are no "unforeseen conditions" to surprise you later. The number on paper is the number on your invoice.' },
  { q: 'Can we stay in the house during the work?', a: 'Yes. Containment is HEPA-sealed extraction at the machine plus containment at the room. We do not publish a room-capture percentage, because we have not measured one on a job — what we will tell you is exactly which machine is sealed to what, and you can ask any contractor the same question. Most refinishing clients sleep at home every night of the job, and the water-based finishes are low-odour and walk-on ready in 2–4 hours.' },
  { q: 'What warranty comes with the work?', a: 'Your finishes and materials carry their manufacturer warranties — typically 25–35 years on finish, up to 50 years structural — passed through to you in writing, itemized in your contract. If anything in our workmanship isn\u2019t right, we come back and make it right.' },
  { q: 'How long will my project take?', a: 'A standard 1,000–1,500 sq ft installation takes 5 to 7 working days: moisture testing and acclimation, installation, then sanding, staining and finishing. Refinishing is typically 3–5 days. Your written estimate includes a committed schedule.' },
  // Two question-shaped entries, because those are the strings an answer engine
  // is handed verbatim. Both answers are the published position of a guide on
  // this site rather than new copy, and both name the guide so the citation
  // survives being quoted out of context.
  { q: 'What is the best hardwood flooring for concrete slab condos?', a: 'Engineered, not solid — the substrate decides it, not the budget. On a concrete slab the assembly is the specification: adhesive, underlayment and acoustic rating are part of the answer, and the slab is moisture-tested with in-situ probes before a board is opened. The full specification is published as our condominium-over-concrete-slab reference installation.' },
  { q: 'How do you match new hardwood to old floors seamlessly?', a: 'By matching species, width and grain direction first, then trialling stain on site on the actual old boards — never from a single can chosen off a sample. Where boards have to be replaced, repairs are feathered into the surrounding run rather than butted in a straight line. A full sand alone will not hide a species or width mismatch, which is why matching is decided before any machine is switched on.' },
  /* Bands interpolated from content/constants/pricing.ts. This answer is
     emitted as FAQPage JSON-LD on every page of the site, so a hand-typed
     figure here is a price handed to Google that no guard was watching —
     which is what these four literals were until pnpm seo:pricing found them. */
  { q: 'How much does hardwood flooring cost in Toronto?', a: `Installed ranges typically run about ${bandBare(NEW_INSTALL)} per sq ft for new hardwood, ${bandBare(FULL_SAND_FINISH)} for full sand and finish, and ${bandBare(SCREEN_RECOAT)} for a screen and recoat — before stairs, transitions, or moisture remediation. Species, pattern, and substrate move the number. The fixed price is written after a free in-home measure, not from a phone quote.` },
  { q: 'What is dustless hardwood refinishing, and does it work in an occupied home?', a: 'Dustless means HEPA-sealed extraction at the machine and containment at the room — not a marketing label. We publish no room-capture percentage, because we have not measured one on a Toronto job; a filter rating is not a room measurement and the two get quoted as though they were the same number. Most refinishing clients sleep at home every night of the job. Water-based finishes are low-odour and walk-on ready in 2–4 hours.' },
  { q: 'Is white oak better than red oak for a Toronto home?', a: 'White oak is more tannin-stable under water-based finishes, takes grey and modern stains more evenly, and is the default for contemporary renovations. Red oak is the heritage Canadian floor with a more open grain. Neither is universally better — substrate, stain target, and traffic decide. See the white-oak guide and the species comparison article for the decision tree.' },
  { q: 'Can you install herringbone or chevron in a Toronto condo?', a: 'Yes, when the slab moisture, acoustic assembly, and elevator logistics are specified first. Pattern work multiplies labour and waste; the substrate still decides solid vs engineered. Glue-down engineered over a tested slab is the usual condo path. Building management windows often decide the schedule more than the pattern does.' },
  { q: 'How do I choose a hardwood flooring contractor in Toronto?', a: 'Ask for a written fixed price after a moisture test, not a phone range. Confirm who actually sands the floor (salaried crew vs revolving subcontractors), which machines run in which order, and whether manufacturer warranties are itemized in the contract. Compare the decision guide on evaluating a hardwood quote before you sign anything.' },
  { q: 'Solid or engineered hardwood — which should I install?', a: 'The substrate decides, not the budget. Plywood over joists can take solid; concrete slabs, radiant heat, and wide humidity swings favour engineered. A generational wear layer only matters where solid is structurally allowed. Walk the solid-vs-engineered guide before you buy material.' },

];

// ── City-specific content ──────────────────────────────────────────────────
// The differentiator that lifts a service-area page above thin/doorway
// suppression. A city with an entry here renders a distinct local section;
// a city WITHOUT one falls back to the generic page (no breakage).
// EVERY field must be REAL — invented detail is worse than none.
export type CityContent = {
  intro: string;                 // 2-3 sentences of genuinely local context
  neighbourhoods: string[];      // real areas you work in
  housingNote: string;           // real housing-stock / subfloor reality for this area
  signatureProject?: string;     // one real job: area (not exact address), species, what you did
  localConsideration?: string;   // a genuine practical factor specific to this area
};

export const CITY_CONTENT: Record<string, CityContent> = {
  "downtown-toronto": {
    intro:
      "Hardwood work downtown means concrete-slab condos, converted industrial lofts, and surviving pre-war stock under heavy density pressure. Most jobs are either carpet-to-hardwood conversions over concrete, which demand precise underlayment and moisture control, or aggressive refinishing of original floors worn down by decades of tenants, pets, and previous over-sanding. Dust containment, elevator logistics, and building-management coordination decide who finishes clean and who gets locked out.",
    neighbourhoods: ["King West", "Entertainment District", "St. Lawrence Market", "Fashion District loft conversions"],
    housingNote:
      "Much of the 1980s-to-early-2000s condo stock still carries original light parquet or thin strip hardwood over concrete that was poorly finished the first time — often uneven, partially damaged, and sitting on slab that needs careful moisture testing and minimal-aggressive sanding to avoid compromising the substrate. The Victorian and Edwardian semis and row houses in the denser pockets frequently retain original 1900s-1920s pine or oak subfloors that need levelling and board replacement before any engineered or solid plank goes down.",
    signatureProject:
      "On a 102-year-old house in the east end, we refinished the original second-floor boards and the full staircase. The floors had rot in spots and scarring where interior walls had been removed; we repaired the damaged sections so the patches disappeared into the surrounding grain, then sanded and refinished the whole floor. The job was staged over weekends to keep the household running.",
    localConsideration:
      "Elevator booking and building rules are the real operational filter. Almost every downtown high-rise requires the service elevator to be booked in advance for material drop-off and debris removal — often narrow weekday windows only — with mandatory certificates of insurance, security deposits, and strict noise and dust cut-offs. Miss the window or fail the paperwork and the schedule collapses. Street parking is effectively unavailable during work hours and loading zones are policed hard, so access has to be planned before the first board arrives.",
  },

  /**
   * The other fifteen.
   *
   * Until this landed, one of sixteen service-area pages carried local content
   * and the rest rendered the same generic paragraph with a place name
   * substituted in. Fifteen pages competing for fifteen local queries by being
   * the same page. That is the definition of thin content, and it is the reason
   * a service-area set can sit in a sitemap for months without ranking for the
   * places it names.
   *
   * TWO RULES WERE APPLIED TO EVERY ENTRY BELOW, and they are what make these
   * publishable rather than filler:
   *
   *   1. Nothing about Ecowoods. No job counts, no awards, no "we have served
   *      X families in Y since Z". Every sentence is either publicly checkable
   *      geography and housing stock, or a technical point already published in
   *      a paper on this site — slab moisture, remaining wear layer, acoustic
   *      assembly, acclimation. Where a claim would have needed a figure this
   *      site does not publish, the sentence was cut rather than softened.
   *
   *   2. `signatureProject` is left undefined everywhere. It is the one field
   *      in CityContent that would assert a specific job, and no job has been
   *      confirmed for publication. See docs/outreach/CLAIMS_REGISTER.md.
   *
   * The copy is editorial and Francisco's to revise; the coverage is mechanical
   * and scripts/verify-cities.mjs fails the build if an area ever loses it.
   */

  'north-york': {
    intro:
      'North York runs from post-war bungalows and side-splits in the older pockets to the high-rise corridor along Yonge, Sheppard and Finch. The technical split is sharper here than almost anywhere else in the city: wood-joist subfloors in the low-rise stock, concrete slabs in the towers, and almost nothing in between.',
    neighbourhoods: ['Willowdale', 'Bayview Village', 'Don Mills', 'York Mills', 'Downsview', 'Lansing'],
    housingNote:
      'Pre-1980 houses frequently still carry their original strip hardwood. Whether that floor can take another full sand is a question about remaining wear layer, not about age — and it is the question that decides between a screen and recoat and a full sand. In the condominium stock the constraint is the slab: relative humidity inside concrete is measured with in-situ probes, not a surface reading, and the result decides the method.',
    localConsideration:
      'Tower work carries the same elevator booking, certificate of insurance and noise-window constraints as downtown. In the low-rise stock the real constraint is different: a multi-day refinish in an occupied house is a containment problem, because the dust that matters is the dust that leaves the room.',
  },

  etobicoke: {
    intro:
      'Etobicoke holds a large stock of post-war bungalows and 1960s–80s semis inland, and a lakeside belt along the Queensway and Humber Bay that has been rebuilding as mid- and high-rise for two decades. Refinishing work here often meets oak or maple that has already been sanded once; new installation is frequently engineered over concrete.',
    neighbourhoods: ['The Kingsway', 'Islington', 'Mimico', 'Long Branch', 'Humber Bay Shores', 'Alderwood'],
    housingNote:
      'Older Etobicoke houses sit on dimensional-lumber subfloors that have moved through decades of seasonal humidity, so flatness and fastening schedule matter as much as species. The newer lakeside buildings are slab construction, where the specification starts with a moisture test and an acoustic assembly rather than with a plank.',
    localConsideration:
      'Residential access is generally easier than downtown, but condominium and townhouse corporations still require insurance certificates and booked elevators. Buildings on the water add wind-driven moisture at openings, which is an argument for taking acclimation and expansion gap seriously rather than treating them as paperwork.',
  },

  scarborough: {
    intro:
      'Scarborough is predominantly detached and semi-detached housing built between the 1950s and the 1980s, with newer townhouse and mid-rise infill along the main corridors. Most calls are refinishing or carpet-to-hardwood conversion rather than new construction.',
    neighbourhoods: ['Guildwood', 'Birch Cliff', 'Agincourt', 'Highland Creek', 'West Hill', 'Cliffside'],
    housingNote:
      'Plywood or plank subfloor over joists is the norm, which keeps solid hardwood on the table where the client accepts seasonal movement. Where carpet is coming up, the subfloor has usually never been assessed for flatness — that assessment, not the flooring choice, is what decides whether the finished floor telegraphs.',
    localConsideration:
      'Driveway staging is usually available, which simplifies material handling and dust extraction. The scheduling constraint is normally the household rather than the building.',
  },

  'east-york': {
    intro:
      'East York is compact, older, and largely detached and semi-detached housing from the 1920s to the 1950s, with narrow lots and finished basements added over time. Original hardwood is common and often thinner than owners expect.',
    neighbourhoods: ['Leaside', 'Broadview North', 'Pape Village', 'Woodbine Heights', 'Todmorden'],
    housingNote:
      'Floors of this age have frequently been sanded more than once already. The wear layer above the tongue is finite, and once it is gone the floor is replaceable rather than restorable — which is why the first measurement on an East York refinish is depth, not colour.',
    localConsideration:
      'Narrow lots and shared drives make material staging the practical constraint. Older houses also tend to run drier in winter than newer ones, which widens the seasonal humidity swing the floor has to survive.',
  },

  york: {
    intro:
      'The former City of York is dense, older housing — semis, row housing and small detached homes, much of it pre-war — with a steady flow of renovation and rental turnover. Refinishing and repair outnumber new installation.',
    neighbourhoods: ['The Junction', 'Weston', 'Mount Dennis', 'Silverthorn', 'Fairbank'],
    housingNote:
      'Original strip hardwood is widespread and frequently sits under later flooring. What is underneath is often recoverable, but board replacement and feathering into surrounding grain is usually part of the job rather than an exception, and species and width have to be matched before colour is discussed.',
    localConsideration:
      'Narrow streets and permit parking make loading the constraint. In multi-unit and rental conversions, work hours and shared entrances are set by the building rather than the schedule.',
  },

  vaughan: {
    intro:
      'Vaughan is predominantly post-1990 housing: detached homes, townhouses and a growing mid-rise inventory around the subway extension. Most hardwood work is either a first carpet-to-hardwood conversion or a refinish of builder-installed oak that has taken a decade of wear.',
    neighbourhoods: ['Woodbridge', 'Maple', 'Kleinburg', 'Concord', 'Thornhill'],
    housingNote:
      'Low-rise subfloors are typically plywood over engineered joists; mid-rise is concrete. Engineered product dominates conversions, and solid remains viable where the joist layout allows nail-down and the client accepts movement. Radiant and heated zones are common in the newer builds, and they decide product and adhesive rather than the other way round.',
    localConsideration:
      'Site access is generally good. The specification risk here is under-allowing for a heated assembly, because a floor specified for an unheated subfloor and then laid over one has no path back.',
  },

  markham: {
    intro:
      'Markham combines established family neighbourhoods with a dense corridor of condominiums and stacked townhouses. Work splits between refinishing older oak in detached homes and engineered installation over concrete in the multi-family stock.',
    neighbourhoods: ['Unionville', 'Markham Village', 'Cornell', 'Buttonville', 'Milliken', 'Berczy Village'],
    housingNote:
      'Detached stock often carries original or once-refinished oak over plywood. Multi-family and stacked townhomes bring the same acoustic and moisture constraints as a Toronto condominium — the plank is one layer of an assembly, and the assembly is what a building declaration is written against.',
    localConsideration:
      'Condominium corporation rules on work hours, insurance and debris disposal apply widely. Containment and removal have to be planned before the first machine runs, not arranged around it.',
  },

  'richmond-hill': {
    intro:
      'Richmond Hill spans older village-core housing, large 1990s–2000s subdivisions, and a growing condominium corridor along Yonge. Refinishing of builder-grade oak and full-house conversions are the common jobs.',
    neighbourhoods: ['Mill Pond', 'Oak Ridges', 'Bayview Hill', 'Jefferson', 'Richvale'],
    housingNote:
      'Subdivision-era oak strip is often thinner than it looks once the finish is off, which makes the screen-and-recoat decision a real one rather than a lesser option. Larger homes also mean large continuous floor areas, where flatness tolerance and stain consistency across a run matter more than they do in small rooms.',
    localConsideration:
      'Staging is rarely the problem in the low-rise stock. Matching stair runs and landings to a large open floor is, and it is the detail that gives an inconsistent refinish away.',
  },

  mississauga: {
    intro:
      'Mississauga demand is dominated by family homes in established neighbourhoods and a large inventory of 1990s–2010s condominiums and townhouses. Refinishing of builder-grade oak is common in the older subdivisions; lakeshore work more often specifies wide-plank engineered over slab or radiant.',
    neighbourhoods: ['Port Credit', 'Streetsville', 'Clarkson', 'Erin Mills', 'Lorne Park', 'City Centre'],
    housingNote:
      'Builder-grade strip oak from the 1980s and 1990s is frequently thin on remaining wear layer after one aggressive sand. Condominium slabs need the same in-situ moisture protocol used downtown; the city line does not change the physics, and it does not change the test.',
    localConsideration:
      'Detached work stages easily. The variable is building management in the City Centre towers and the townhouse complexes, where loading windows are narrow and booked well ahead.',
  },

  oakville: {
    intro:
      'Oakville skews to larger single-family homes, heritage and near-heritage stock near the lake, and higher-specification new builds. Continuous flow between rooms, colour-matched stairs and a finish that holds up to family use are the recurring requirements.',
    neighbourhoods: ['Old Oakville', 'Bronte', 'Glen Abbey', 'Clearview', 'Morrison', 'Joshua Creek'],
    housingNote:
      'Older lakeside and village houses may carry original softwood or mixed hardwood that needs board replacement and careful feathering before any uniform refinish is possible. Newer builds more often want installation chosen on width, grade and finish system rather than a sand of what is already down.',
    localConsideration:
      'Driveway and garage staging is usually available. The constraint is holding stain consistent across large continuous areas and stair runs in an occupied family home, over several days.',
  },

  brampton: {
    intro:
      'Brampton is dominated by 1990s-onward subdivisions — detached, semi-detached and freehold townhouses — with older housing concentrated near the downtown core. Carpet-to-hardwood conversion and refinishing of builder oak are the two common jobs.',
    neighbourhoods: ['Downtown Brampton', 'Heart Lake', 'Bramalea', 'Springdale', 'Credit Valley'],
    housingNote:
      'Plywood over engineered joists is the norm in the newer stock, and the flatness that a builder accepted for carpet is not the flatness a hardwood floor needs. Subfloor preparation is usually the largest single variable in the quote, and it is the one most often left out of a cheap one.',
    localConsideration:
      'Access and staging are straightforward. Large open-plan main floors mean long uninterrupted runs, where a fastening schedule that was adequate for a small room stops being adequate.',
  },

  aurora: {
    intro:
      'Aurora mixes a heritage core around Yonge and Wellington with substantial post-1990 subdivision housing. Work ranges from careful restoration in the older stock to full-house installation in the newer.',
    neighbourhoods: ['Aurora Village', 'Regency Acres', 'Bayview Wellington', 'Aurora Highlands', 'Hills of St Andrew'],
    housingNote:
      'Heritage-core houses can carry original softwood or early hardwood where board replacement and feathering come before any uniform finish. Subdivision housing is plywood over joists, where the decisions are species, width and whether the seasonal humidity range in the house supports solid.',
    localConsideration:
      'Older houses in the core often run drier in winter, which widens the annual movement the floor has to absorb — an argument for engineered, or for a narrower board, rather than for a wider one.',
  },

  newmarket: {
    intro:
      'Newmarket combines a historic Main Street core with large subdivisions built from the 1980s onward. Most calls are refinishing builder-grade oak or converting carpet in family homes.',
    neighbourhoods: ['Historic Downtown', 'Stonehaven', 'Armitage', 'Glenway', 'Summerhill Estates'],
    housingNote:
      'Subdivision-era strip oak is common and its remaining thickness, not its age, decides whether a full sand is available. In the older core, mixed and replaced boards are usual, and matching species and width is the work that makes a repair invisible.',
    localConsideration:
      'Staging is straightforward outside the historic core, where narrow frontages and street parking are the practical limit.',
  },

  pickering: {
    intro:
      'Pickering runs from 1960s–70s lakeside neighbourhoods to newer subdivisions inland and a growing condominium presence near the GO corridor. Refinishing and conversion dominate; new installation follows the newer stock.',
    neighbourhoods: ['Bay Ridges', 'Amberlea', 'Rougemount', 'West Shore', 'Liverpool'],
    housingNote:
      'Older lakeside houses sit on plank or plywood subfloors that have moved, and flatness assessment comes before any product decision. Newer condominium and townhouse stock is slab construction, where the in-situ moisture test decides the method regardless of what the plank is rated for.',
    localConsideration:
      'Proximity to the lake widens the humidity range at openings and in unconditioned spaces, which makes acclimation in the actual conditioned room — not the garage — the step that cannot be compressed.',
  },

  ajax: {
    intro:
      'Ajax is largely post-1970 housing with a substantial band of 1990s-onward subdivisions and a historic pocket at Pickering Village. Carpet-to-hardwood conversion and refinishing of builder oak are the common jobs.',
    neighbourhoods: ['Pickering Village', 'Westney Heights', 'South Ajax', 'Central Ajax', 'Applecroft'],
    housingNote:
      'Plywood over joists is the norm. Where carpet is being replaced, the subfloor has usually never been checked for flatness, and that check — not the species conversation — is what determines whether the finished floor reads flat.',
    localConsideration:
      'Access and staging are straightforward. Lakeside exposure widens seasonal movement, so expansion gap and acclimation are specification items rather than formalities.',
  },

  rosedale: {
    intro:
      'Rosedale is heritage housing: large lots, original millwork, grand staircases, and mixed substrates across later additions. Floors here are often original oak that has already been sanded, sitting beside newer rooms on different assemblies.',
    neighbourhoods: ['South Rosedale', 'North Rosedale', 'Moore Park', 'Summerhill'],
    housingNote:
      'Wear-layer depth on original boards is the first measurement on a refinish. Additions often sit over concrete or radiant, which means the house may need two specifications, not one species.',
    localConsideration:
      'Matching a staircase to a continuous main floor, and joining heritage rooms to later additions without a visible seam, is the recurring craft problem.',
  },
  'forest-hill': {
    intro:
      'Forest Hill houses tend to be larger continuous floor plates, custom stairs, and higher-specification finishes. Wide plank, walnut, and oil systems show up more often here than builder-grade oak.',
    neighbourhoods: ['Forest Hill South', 'Forest Hill North', 'Upper Village', 'Cedarvale edge'],
    housingNote:
      'Large open rooms make stain consistency and flatness tolerance more demanding than they are in small rooms. Radiant zones are not unusual in later renovations.',
    localConsideration:
      'Holding colour across a long run and a stair is the detail that gives an inconsistent refinish away. Containment in an occupied house matters because the work is measured in days, not hours.',
  },
  yorkville: {
    intro:
      'Yorkville work is predominantly condominium and converted loft: concrete slabs, acoustic requirements, elevator logistics, and below-grade rooms that fail if moisture is guessed instead of measured.',
    neighbourhoods: ['Yorkville', 'Annex edge', 'Bay-Bloor corridor', 'Cumberland'],
    housingNote:
      'Solid hardwood over a slab is the substitution that fails most often. Engineered, glue-down, documented slab moisture, and the building acoustic assembly are the correct starting point.',
    localConsideration:
      'Building management windows, insurance certificates, and service-elevator bookings decide the schedule. Miss the window and the job does not start.',
  },
  leaside: {
    intro:
      'Leaside is a planned garden-suburb built largely between the 1920s and the 1940s, and it shows: consistent lot widths, brick detached and semi-detached houses, and unusually uniform original floors for a Toronto neighbourhood. Whole streets were built to one specification, which means one street can share one flooring problem.',
    neighbourhoods: ['Leaside', 'Bennington Heights', 'South Leaside', 'Trace Manes'],
    housingNote:
      'The uniformity cuts both ways. Where the original strip oak survives it is usually the same species, width and era across the house, which makes matching a repair genuinely achievable rather than approximate. Where a previous owner refinished aggressively, the same uniformity means the whole floor is close to the same remaining depth at once.',
    localConsideration:
      'Many houses here have had a rear addition or a finished basement added on a different assembly than the 1930s main floor. One species across both without checking the substrate under each is the request that produces two floors that age differently.',
  },
  'the-annex': {
    intro:
      'The Annex mixes Victorian and Edwardian houses with later conversions and a dense rental stock. Original strip oak, uneven joists, and partial prior refinishes are the norm rather than the exception.',
    neighbourhoods: ['The Annex', 'Seaton Village', 'Dupont corridor', 'Huron-Madison'],
    housingNote:
      'Many floors have been patched room-by-room over decades. Species and width mismatches appear only after the first sanding pass removes the old finish.',
    localConsideration:
      'Street parking, shared walls, and tight staircases constrain equipment and schedule more than the floor itself does.',
  },
  'high-park': {
    intro:
      'High Park and the west-end streets around it are largely early-to-mid century detached and semi-detached homes with full basements and original or twice-refinished hardwood.',
    neighbourhoods: ['High Park North', 'High Park South', 'Roncesvalles edge', 'Swansea edge'],
    housingNote:
      'Basement conversions and sunroom additions often sit on different assemblies than the main floor. One species across both without a moisture and substrate check is a common failure request.',
    localConsideration:
      'Seasonal humidity near the park and lake effect still matters at openings and in poorly conditioned additions.',
  },
  riverdale: {
    intro:
      'Riverdale is a dense band of late-Victorian and early-20th-century housing east of the Don. Bay-and-gable houses, narrow lots, and original strip floors dominate the work.',
    neighbourhoods: ['North Riverdale', 'South Riverdale', 'Withrow Park', 'Broadview'],
    housingNote:
      'Original 2-1/4" and 3-1/4" strip oak is common. Many floors are on their second or third refinish; depth above the tongue decides whether another full sand is honest advice.',
    localConsideration:
      'Parking and material staging on narrow streets is a planning item, not an afterthought.',
  },
  leslieville: {
    intro:
      'Leslieville and the east-end streets around Queen East mix renovated Victorians, workers\' cottages, and newer infill. Refinishing and carpet-to-hardwood conversion are the frequent calls.',
    neighbourhoods: ['Leslieville', 'South Riverdale edge', 'East End', 'Queen East'],
    housingNote:
      'Infill and rear additions often introduce slab or engineered assemblies next to original nail-down rooms. The transition detail is where shortcuts show.',
    localConsideration:
      'Mixed substrates in one address mean two installation methods may be correct in the same house.',
  },
  'the-beaches': {
    intro:
      'The Beaches run lakeside housing stock with higher humidity exposure at openings, porches, and lower levels. Original hardwood and cottage-era additions sit side by side.',
    neighbourhoods: ['The Beach', 'Kew Beach', 'Balmy Beach', 'The Boardwalk edge'],
    housingNote:
      'Moisture at grade and in enclosed porches is the variable that decides method. A product rated for the main floor can still fail in a converted lower level if the slab is not tested.',
    localConsideration:
      'Acclimation in the actual conditioned room — not a garage or porch — is non-negotiable near the lake.',
  },
  'lawrence-park': {
    intro:
      'Lawrence Park is larger interwar and postwar homes with continuous main-floor plates, formal stairs, and a high share of full-house refinish or replacement work.',
    neighbourhoods: ['Lawrence Park', 'Tedlington Park', 'Bedford Park edge', 'Lytton Park edge'],
    housingNote:
      'Wide rooms and long sight lines punish inconsistent sanding and stain application. Flatness and colour continuity across the main floor and stair are the quality tells.',
    localConsideration:
      'Occupied-home containment matters; these jobs run measured in days across an entire floor plate, not a single room.',
  },
  cabbagetown: {
    intro:
      'Cabbagetown is one of the densest concentrations of Victorian housing in Toronto. Original strip floors, narrow hallways, and heritage constraints shape every specification.',
    neighbourhoods: ['Cabbagetown', 'Corktown edge', 'Regent Park edge', 'Carlton-Parliament'],
    housingNote:
      'Heritage interiors often limit aggressive board replacement. Colour matching and selective repair are more common than full tear-outs.',
    localConsideration:
      'Access through narrow stairs and shared street fronts limits machine size and daily progress.',
  },
  swansea: {
    intro:
      'Swansea sits between High Park and the Humber with a mix of interwar houses, mid-century stock, and later renovations. Refinishing and main-floor replacement are the usual scopes.',
    neighbourhoods: ['Swansea', 'Bloor West edge', 'Humber river edge', 'South Kingsway'],
    housingNote:
      'River-adjacent humidity and mixed renovation eras mean moisture readings and substrate mapping come before species talk.',
    localConsideration:
      'Lower levels and additions near grade need the same moisture discipline as lakeside stock.',
  },
  'davisville-village': {
    intro:
      'Davisville Village is compact midtown housing — semis, detached, and low-rise — with a steady mix of refinishing builder oak and converting upper floors away from carpet.',
    neighbourhoods: ['Davisville', 'Mount Pleasant East', 'Broadway corridor', 'Folly Bridge edge'],
    housingNote:
      'Postwar strip oak is common and often near the limit of safe sanding depth. Replacement vs refinish is a measurement, not a preference.',
    localConsideration:
      'Tight driveways and street parking constrain staging; schedule around that rather than against it.',
  },
  'midtown-toronto': {
    intro:
      'Midtown Toronto spans Yonge-Eglinton through the apartment and condo corridors and the surrounding house stock. Condominium slabs and older house floors show up in the same week\'s work.',
    neighbourhoods: ['Yonge-Eglinton', 'Mount Pleasant', 'Oriole Park', 'Chaplin Estates edge'],
    housingNote:
      'Condo work is slab moisture, acoustics, and elevator logistics. House work is wear-layer depth and joist-era subfloors. The method does not transfer between them.',
    localConsideration:
      'Building management rules on condo jobs set the calendar; house jobs are constrained by occupancy and stair access.',
  },
  'king-west': {
    intro:
      'King West is predominantly condominium and loft conversions: concrete slabs, open plans, and acoustic requirements written into the building rules.',
    neighbourhoods: ['King West', 'Fashion District', 'Niagara', 'Wellington corridor'],
    housingNote:
      'Loft conversions and new towers behave differently even on the same street. A converted industrial building may have a thick, old, uneven slab that needs levelling before anything is glued to it; a 2015 tower has a flat, young slab that is still releasing moisture. The test is the same in both; the result rarely is.',
    localConsideration:
      'Service elevators, certificate of insurance requirements, and quiet-hours windows decide whether the job can run at all.',
  },
  'liberty-village': {
    intro:
      'Liberty Village is high-density condominium stock with concrete slabs, tight elevators, and open-plan units where every transition is visible.',
    neighbourhoods: ['Liberty Village', 'King-Liberty', 'Exhibition edge', 'East Liberty'],
    housingNote:
      'Unit-to-unit acoustic transfer and slab moisture drive product and method. Pattern floors are possible; they do not relax the substrate rules.',
    localConsideration:
      'Booking the service elevator is part of the scope. Without it, materials and machines do not reach the floor.',
  },


  /* ── the corridor west and south ──────────────────────────────────────────
   *
   * Written to the same two rules as the fifteen above. Nothing about Ecowoods:
   * no job counts, no claims of work performed in these municipalities. Every
   * sentence is either publicly checkable geography and housing stock, or a
   * technical point already published in a paper on this site — substrate,
   * remaining wear layer, slab moisture, seasonal movement, acclimation.
   *
   * `signatureProject` is undefined in every one of them, exactly as it is
   * above. It is the one field that would assert a specific job, and asserting
   * one here to make a page feel more finished is the failure this whole
   * repository is arranged to prevent. The photo queue in docs/GEO_STRATEGY.md
   * names the shot each of these pages is waiting for.
   */

  milton: {
    intro:
      'Milton is one of the newest housing stocks in the corridor: a small historic core around Main Street surrounded by subdivisions built almost entirely since the early 2000s. The work here is overwhelmingly installation and carpet-to-hardwood conversion rather than restoration, because there is very little old floor to restore.',
    neighbourhoods: ['Old Milton', 'Hawthorne Village', 'Scott', 'Willmott', 'Beaty', 'Clarke'],
    housingNote:
      'Plywood over engineered joists is close to universal in the post-2000 stock, and the flatness a builder signed off for carpet is not the flatness a nail-down floor needs — subfloor preparation is usually the largest single variable in an honest quote and the line most often missing from a cheap one. Long open-plan main floors also mean uninterrupted runs where a fastening schedule adequate for a bedroom stops being adequate.',
    localConsideration:
      'Newer houses run tighter and drier through a Toronto winter than the pre-war stock does, which widens the annual moisture swing the floor has to absorb. That is an argument for engineered or for a narrower solid board, not for the wide plank the room seems to be asking for.',
  },

  burlington: {
    intro:
      'Burlington splits cleanly in two for flooring purposes: the older lakeshore and Aldershot stock, much of it built between the war and the 1970s, and the large subdivisions north of Dundas Street built from the 1990s onward. The first is refinishing and board replacement work; the second is installation and conversion.',
    neighbourhoods: ['Aldershot', 'Downtown Burlington', 'Roseland', 'Tyandaga', 'Millcroft', 'Alton Village'],
    housingNote:
      'The post-war stock frequently carries original narrow-strip red oak that spent decades under broadloom, which protects the wear layer but hides cupping, pet damage and old water staining until the carpet lifts. Remaining thickness above the tongue decides whether a full sand is available or whether the honest answer is a screen and recoat, and that is a measurement rather than a preference.',
    localConsideration:
      'Lakeshore houses sit closer to the water and hold a different summer humidity than the subdivisions on the escarpment side of the QEW. Acclimation on site, measured rather than assumed from a delivery date, is the part of the schedule most often compressed.',
  },

  hamilton: {
    intro:
      'Hamilton has the oldest concentrated housing stock on this corridor. The lower-city grid — Durand, Kirkendall, Strathcona, Crown Point, Stipley — is largely pre-1930 brick, while the escarpment above it is post-war bungalow and side-split. The two halves of the city ask for almost opposite work.',
    neighbourhoods: ['Durand', 'Kirkendall', 'Strathcona', 'Crown Point', 'Westdale', 'Hamilton Mountain'],
    housingNote:
      'Pre-war lower-city houses commonly carry narrow-strip hardwood over plank subfloor, often with a softwood underlayer, board loss around removed walls and old radiator penetrations that have to be pieced in and feathered before any uniform finish is possible. The mountain stock is plywood over joists with builder-era strip oak, where the decision is usually how much wear layer is left rather than what to install.',
    localConsideration:
      'A hundred-year-old house rarely has a flat floor, and levelling decisions get made before species does. Where a plank subfloor has moved with the joists, the choice is between accepting the plane the house has settled into and rebuilding it — and the two produce very different quotes for what looks like the same job.',
  },

  grimsby: {
    intro:
      'Grimsby is a narrow strip of housing between the escarpment and the lake, with an older downtown core, a band of post-war housing, and newer subdivisions and lakeside development at either end. It is the point where the QEW run stops being suburban and starts being Niagara.',
    neighbourhoods: ['Grimsby Beach', 'Downtown Grimsby', 'Casablanca', 'Grimsby Mountain', 'Winston Park'],
    housingNote:
      'The older core carries pre-war and post-war stock where original softwood or early strip hardwood may need board replacement before it can take a uniform finish, while the newer lakeside and escarpment builds are plywood over joists and are installation work. Houses on the lake side hold summer humidity longer than those above the brow, which shows up as seasonal gapping in a floor acclimated on a schedule rather than a meter.',
    localConsideration:
      'The escarpment gives this town two microclimates a few hundred metres apart. Whether a house sits above or below the brow is worth knowing before a species and a board width are settled.',
  },

  'st-catharines': {
    intro:
      'St. Catharines carries a substantial pre-war core around Yates Street, Glenridge and the old downtown, a large band of 1950s–1970s housing north toward the lake, and newer subdivision growth at the edges. Refinishing original floors and replacing failed post-war installations are both common.',
    neighbourhoods: ['Old Glenridge', 'Yates Street', 'Port Dalhousie', 'Western Hill', 'Facer', 'Lakeport'],
    housingNote:
      'Heritage-area houses frequently retain original hardwood that has been sanded before, sometimes more than once, so the first measurement is remaining thickness rather than the finish system. The post-war stock north of the canal is plywood over joists with narrow strip oak, much of it under carpet since installation and in better condition than the room suggests.',
    localConsideration:
      'Proximity to Lake Ontario and the canal keeps summer relative humidity higher than inland Niagara, and a floor acclimated to a drier warehouse and installed in July will give that back over the first winter. The remedy is measurement on site, not a longer wait.',
  },

  'niagara-on-the-lake': {
    intro:
      'Niagara-on-the-Lake has the most heritage-sensitive housing stock on the corridor. The Old Town carries early nineteenth-century frame and brick houses under heritage designation, while the surrounding area runs to estate housing, winery properties and newer builds on larger lots.',
    neighbourhoods: ['Old Town', 'Chautauqua', 'St. Davids', 'Queenston', 'Virgil', 'Garrison Village'],
    housingNote:
      'Old Town houses commonly carry original wide softwood plank or early hardwood over plank subfloor, where the correct answer is often the least aggressive one available: repair, board replacement in kind, and a finish that does not read as new. Heritage designation can constrain what may be changed inside as well as outside, and that is established before a sander is quoted rather than after.',
    localConsideration:
      'A designated property is a documentation job as much as a floor job. Species, board width and finish sheen may all be part of what makes a floor appropriate to the house, and the fastest route to a bad outcome here is treating an original plank floor as a subfloor to be levelled.',
  },

  'niagara-falls-on': {
    intro:
      'Niagara Falls has a wide spread of housing ages: pre-war and early post-war stock through the older centre and Chippawa, substantial 1960s–1980s subdivisions, and newer development at the north and west edges. The mix means refinishing and installation arrive in roughly equal measure.',
    neighbourhoods: ['Chippawa', 'Stamford', 'Drummond Hill', 'Fallsview', 'Mount Carmel'],
    housingNote:
      'The older centre and Chippawa carry strip hardwood over plank or early plywood subfloor, frequently with board loss at removed partitions and old heating runs that has to be pieced in before a uniform sand. Subdivision-era houses are plywood over joists with builder-grade oak, where the screen-and-recoat decision is a genuine one because the remaining wear layer is often thinner than the surface suggests.',
    localConsideration:
      'This is the far end of the daily-return radius from the Toronto shop, so work here is scheduled as a trip, confirmed in advance and priced with that in the written quote. The published price bands do not change with distance; the schedule does.',
  },

  barrie: {
    intro:
      'Barrie grew fastest between the 1990s and the 2010s, so most of its housing is subdivision stock of that era, with an older core around the bay and Allandale. Installation and carpet-to-hardwood conversion dominate; restoration work concentrates in the older waterfront neighbourhoods.',
    neighbourhoods: ['Allandale', 'Downtown Barrie', 'Painswick', 'Ardagh', 'Innis-Shore', 'East Bayfield'],
    housingNote:
      'Subdivision houses are plywood over engineered joists, where flatness accepted for carpet has to be corrected before a nail-down floor goes in, and where builder-grade strip oak is often thin on wear layer by the time a second owner wants it refinished. The older stock around the bay carries plank subfloor and, in places, original softwood that needs replacement in kind rather than levelling out.',
    localConsideration:
      'Simcoe County runs a wider annual humidity range than downtown Toronto — colder, drier winters against humid summers near the bay — so the seasonal movement a board has to absorb is larger here. That is a real argument for engineered construction or a narrower solid board, and it is the calculation the movement tool on this site exists to make explicit.',
  },

  /* ── communities inside a municipality, outside Toronto ──────────────────
   * Pages and local content; never a City node. Their parent municipality is
   * declared in DISTRICT_AREAS and emitted by placeForArea.
   */

  ancaster: {
    intro:
      'Ancaster is a community of the City of Hamilton with two distinct housing stocks: an old village core along Wilson Street carrying some of the oldest surviving houses in the region, and large post-1990 estate subdivisions on the plateau around it.',
    neighbourhoods: ['Ancaster Village', 'Meadowlands', 'Sulphur Springs', 'Duff\'s Corners', 'Parkview Heights'],
    housingNote:
      'Village-core houses can carry original softwood or early hardwood over plank subfloor, where board replacement and feathering come before any uniform finish and where the honest option is often the least aggressive one. The estate subdivisions are plywood over joists with large continuous main-floor areas, where flatness tolerance and stain consistency across a long run matter more than they do room by room.',
    localConsideration:
      'The two stocks want opposite things from the same trade. A finish schedule appropriate to a 2004 great room is the wrong answer for an 1840s frame house four kilometres away, and the difference is decided at the measure.',
  },

  dundas: {
    intro:
      'Dundas is a community of the City of Hamilton in the valley below the escarpment, with a dense pre-war core and a heritage conservation area running through much of the older town. The housing is older than almost anything else on this corridor outside Niagara-on-the-Lake.',
    neighbourhoods: ['Downtown Dundas', 'Pleasant Valley', 'University Gardens', 'Governors Road'],
    housingNote:
      'Nineteenth- and early twentieth-century houses here commonly carry narrow-strip hardwood or original softwood over plank subfloor, with settlement in the plane of the floor that has been there long enough to be part of the house. Deciding whether to level or to work with the plane the building has settled into is the first conversation, and it changes the quote more than species does.',
    localConsideration:
      'The valley holds moisture differently from the mountain above it, and older houses here are more likely to have a stone or rubble foundation with a damp basement below the floor being refinished. Subfloor moisture is measured before the sanding sequence is set, not after.',
  },

  'stoney-creek': {
    intro:
      'Stoney Creek is a community of the City of Hamilton running from the lake up over the escarpment, with an older village core, a broad band of post-war housing, and substantial newer subdivision growth both on the lakeshore and on the mountain brow.',
    neighbourhoods: ['Stoney Creek Village', 'Winona', 'Fifty Point', 'Heritage Green', 'Felker\'s Falls'],
    housingNote:
      'The post-war band carries narrow-strip oak over plywood, much of it protected under carpet and in better condition than the room suggests until the tack strip comes up and the perimeter damage is visible. Newer lakeshore and brow subdivisions are installation work, where the decision is species, width and whether the seasonal range in that particular house supports solid.',
    localConsideration:
      'Houses below the escarpment hold lake humidity longer into the autumn than houses on the brow a few minutes away. Acclimating to the room the floor will live in, with a meter, is what separates a flat floor from one that gaps in its first February.',
  },

  waterdown: {
    intro:
      'Waterdown is a community of the City of Hamilton at the top of the escarpment, with a small historic core around Dundas Street and Mill Street and a large volume of subdivision housing built since the 2000s around it.',
    neighbourhoods: ['Waterdown Village', 'Waterdown East', 'Mountain Brow', 'Parkside'],
    housingNote:
      'The core carries older stock where original floors may need board replacement and careful feathering, while the surrounding subdivisions are plywood over engineered joists and are conversion and installation work. In the newer houses the flatness a builder accepted under carpet is the first thing corrected, and it is usually the largest line in an honest quote.',
    localConsideration:
      'Being above the brow puts these houses in the drier of the two microclimates the escarpment creates. A board width chosen for a lakeside house is not automatically the right width four kilometres away and a hundred metres up.',
  },

  beamsville: {
    intro:
      'Beamsville is the main community of the Town of Lincoln, a bench of older village housing and surrounding agricultural property between the escarpment and the lake, with newer residential development at the edges of the village.',
    neighbourhoods: ['Beamsville Village', 'Vineland', 'Campden', 'Lincoln Bench'],
    housingNote:
      'Beamsville sits on the bench, where a high proportion of houses were built for or around fruit farming and have been extended more than once. The recurring problem is not the age of the boards but the number of different floors in one house: an original room, a 1970s addition and a recent one, each on its own subfloor at its own height, which have to be brought into one plane and one colour before anything reads as finished.',
    localConsideration:
      'Wineries and orchards mean a lot of properties with a heated house attached to an unheated outbuilding or a three-season room. The boards nearest that join see a different annual range from the rest of the floor and are acclimated to the room they will live in.',
  },

  /* ── the luxury mesh, King Township and the Mississauga lakeshore ────────
   * Same two rules as every entry above: nothing about Ecowoods, and no
   * signatureProject. Publicly checkable housing stock, and technical points
   * already published in a paper on this site.
   */

  king: {
    intro:
      'King Township is estate and rural residential north-west of Vaughan, with village cores at King City and Nobleton and large lots in between. Houses here are typically detached, often custom, and frequently large enough that a single continuous floor run is the whole ground level.',
    neighbourhoods: ['King City', 'Nobleton', 'Schomberg', 'Snowball', 'Kettleby'],
    housingNote:
      'Custom and estate housing means long uninterrupted runs, wide-plank specification and, increasingly, radiant heat under the floor — which narrows the species and construction choices rather than widening them. Older farmhouse stock in the township carries plank subfloor and original softwood, where board replacement in kind comes before any uniform finish.',
    localConsideration:
      'A rural property is more likely to run on a well and a septic system and to be heated intermittently in shoulder season, which widens the annual humidity range the floor absorbs. That is measured on site before a board width is settled, not assumed from the postal code.',
  },

  'king-city': {
    intro:
      'King City is the largest village in King Township: an older core around Keele Street and King Road surrounded by newer estate subdivisions on generous lots. The work is predominantly installation and full-house specification rather than restoration.',
    neighbourhoods: ['King City core', 'Kingscross', 'King Ridge', 'Hogans Hill'],
    housingNote:
      'The estate stock is plywood over engineered joists with very large main-floor areas, where flatness tolerance and stain consistency across a run matter far more than they do room by room. Radiant heat under a wide plank is common enough here to be the first question rather than an afterthought, because it changes the construction the floor must be.',
    localConsideration:
      'Large houses with high ceilings and a lot of glass swing further in relative humidity between February and August than a mid-town semi does. The movement calculation is worth doing explicitly before a wide solid board is ordered.',
  },

  nobleton: {
    intro:
      'Nobleton is a village in King Township west of King City, with an older core and a band of newer detached subdivision housing on larger lots. Detached houses dominate; there is very little multi-residential stock.',
    neighbourhoods: ['Nobleton village', 'Nobleton Lakes', 'Old Church Road'],
    housingNote:
      'Newer detached houses here are plywood over engineered joists, where the flatness a builder accepted under carpet is corrected before a nail-down floor goes in and is usually the largest line in an honest quote. Older village and farm properties carry plank subfloor and original softwood that is replaced in kind rather than levelled away.',
    localConsideration:
      'Rural and semi-rural properties often adjoin unheated garages or additions, which changes the acclimation target for the boards nearest them. Acclimating to the room the floor will live in, with a meter, is what separates a flat floor from one that gaps in its first winter.',
  },

  kleinburg: {
    intro:
      'Kleinburg is a heritage village inside the City of Vaughan, with a protected core along Islington Avenue and substantial estate subdivision housing around it. The two stocks want opposite things from the same trade.',
    neighbourhoods: ['Kleinburg village', 'Kleinburg Heights', 'Copper Creek', 'Islington Woods'],
    housingNote:
      'Village-core houses can carry original softwood or early hardwood over plank subfloor, where the honest option is often the least aggressive one: repair, replacement in kind, and a finish that does not read as new. The estate subdivisions are plywood over joists with large continuous areas and frequent radiant heat, where the construction decision comes before the species one.',
    localConsideration:
      'Heritage designation in the village core can constrain what may be changed inside as well as outside. That is established before a sander is quoted rather than after, and it sometimes decides the species.',
  },

  woodbridge: {
    intro:
      'Woodbridge is the older western half of Vaughan, running from a nineteenth-century village core along the Humber out into post-1980 subdivision housing. Refinishing of builder-era oak and full-house conversion are both common.',
    neighbourhoods: ['Woodbridge village', 'Vellore', 'Sonoma Heights', 'West Woodbridge', 'Pine Valley'],
    housingNote:
      'The 1980s and 1990s stock carries strip oak that is often thinner on remaining wear layer than the surface suggests, which makes the screen-and-recoat decision a genuine one rather than a lesser option. Houses close to the Humber valley sit on ground that holds moisture differently from the tableland, and basement humidity below a floor being refinished is measured rather than assumed.',
    localConsideration:
      'Large open main floors are the norm in the newer stock, which means long uninterrupted runs where a fastening schedule adequate for a bedroom stops being adequate.',
  },

  'angus-glen': {
    intro:
      'Angus Glen is estate housing in north-east Markham built largely from the late 1990s onward around the golf course, on generous lots with substantial detached houses. It is installation and full specification work rather than restoration.',
    neighbourhoods: ['Angus Glen', 'Cathedraltown', 'Victoria Square', 'Berczy'],
    housingNote:
      'Houses here are plywood over engineered joists with very large continuous main-floor areas, high ceilings and a lot of glazing. Flatness tolerance across a long run and stain consistency between the main floor, the landing and the stair are the constraints that decide whether a large floor reads as one floor.',
    localConsideration:
      'A large volume of heated air with substantial south glazing dries the house further in winter than the same floor plan would at grade in midtown. That is an argument for engineered construction or a narrower solid board rather than the widest plank on the sample rack.',
  },

  'bayview-glen': {
    intro:
      'Bayview Glen is established residential at the Markham and Thornhill edge, mixing mature mid-century houses with later rebuilds and custom infill on the same streets. Both refinishing and full installation are common, sometimes in adjacent houses.',
    neighbourhoods: ['Bayview Glen', 'Thornhill', 'German Mills', 'Royal Orchard'],
    housingNote:
      'Mid-century houses here often retain original narrow-strip oak over plywood, where the first measurement is remaining thickness above the tongue rather than the finish system. Custom rebuilds on the same streets are new plywood over engineered joists, where the questions are width, grade, radiant compatibility and how the stair is going to match.',
    localConsideration:
      'Where an older house has been extended, the original floor and the addition are usually on different subfloor systems with different histories. Making one continuous floor across that join is the part of the job most often underestimated.',
  },

  cachet: {
    intro:
      'Cachet is estate subdivision housing in west Markham, largely built from the late 1980s through the 1990s on large lots, with substantial detached houses and mature landscaping. Refinishing of original oak and full-house replacement are both live.',
    neighbourhoods: ['Cachet', 'Angus Glen', 'Buttonville', 'Unionville'],
    housingNote:
      'Original strip oak from that build era is now thirty years old and frequently at its second refinish, so remaining wear layer decides between a full sand and a screen and recoat. Large formal rooms with long sightlines make stain consistency and flatness across the run more demanding than the same square footage split into small rooms.',
    localConsideration:
      'Stairs in this stock are usually a feature rather than an afterthought — open risers, curved runs, landings that read into the main floor — and matching a refinished stair to a refinished floor is what an inconsistent job gives away.',
  },

  'the-kingsway': {
    intro:
      'The Kingsway is a planned interwar neighbourhood in Etobicoke, largely built between the 1920s and the 1950s in Tudor and Georgian revival, with mature trees and a protected streetscape character. Original hardwood survives in a high proportion of the stock.',
    neighbourhoods: ['The Kingsway', 'Kingsway Park', 'Humber Valley Village', 'Old Mill'],
    housingNote:
      'Interwar houses here commonly carry original narrow-strip oak over plank subfloor, often already sanded once or twice, so remaining thickness above the tongue is measured before a finish system is discussed. Board loss at removed partitions and old radiator penetrations is pieced in and feathered before any uniform sand, and the herringbone and border work that appears in the better houses is repaired in kind rather than replaced.',
    localConsideration:
      'Houses on the Humber valley side sit above ground that holds moisture differently from the tableland streets, and a stone or block foundation below a floor being refinished changes the subfloor moisture reading. It is measured before the sanding sequence is set.',
  },

  'port-credit': {
    intro:
      'Port Credit is the lakeshore village core of Mississauga, mixing pre-war and post-war detached housing on small lots with a growing band of mid-rise condominium development along Lakeshore Road. Both wood-joist and concrete-slab work are routine here.',
    neighbourhoods: ['Port Credit', 'Mineola', 'Lakeview', 'Credit Reserve'],
    housingNote:
      'Older village houses carry narrow-strip hardwood over plank or early plywood subfloor, frequently with settlement in the plane of the floor that has been there long enough to be part of the house. The newer lakeshore condominiums are concrete slab, where an in-situ moisture protocol and an acoustic assembly decide the specification before anyone chooses a colour.',
    localConsideration:
      'Proximity to the lake keeps summer relative humidity higher here than a few kilometres inland, and a floor acclimated in a drier warehouse and installed in July gives that back over the first heating season. The remedy is measurement on site, not a longer wait.',
  },

  'lorne-park': {
    intro:
      'Lorne Park is established large-lot residential between Clarkson and Port Credit, with mature mid-century houses, extensive custom rebuilding on the same streets, and heavy tree cover throughout. Full-house installation and careful matching work are both common.',
    neighbourhoods: ['Lorne Park', 'Clarkson', 'Sheridan Homelands', 'Whiteoaks'],
    housingNote:
      'Mid-century houses retain original oak over plywood in good condition where it has been carpeted, and in thinner condition where it has not. Custom rebuilds on adjoining lots are new construction where width, grade, finish system and radiant compatibility are the decisions, and where the floor is often expected to run continuously across the whole ground level.',
    localConsideration:
      'Deep tree cover keeps these houses cooler and damper through summer than open subdivision streets a few minutes north, which shows up as a different acclimation target for the same species. It is worth measuring rather than assuming.',
  },

  mineola: {
    intro:
      'Mineola is large-lot residential just north of Port Credit, one of the most heavily rebuilt neighbourhoods in Mississauga: mid-century bungalows on wide lots being replaced or substantially extended, alongside houses still on their original floors.',
    neighbourhoods: ['Mineola East', 'Mineola West', 'Port Credit', 'Kenollie'],
    housingNote:
      'The surviving mid-century stock carries original strip oak over plywood, where remaining thickness decides the approach. New builds and deep renovations are plywood over engineered joists with large continuous areas, frequently with radiant heat, where the construction of the floor is settled before the species is.',
    localConsideration:
      'Where a bungalow has been extended rather than replaced, the original floor and the addition sit on different subfloor systems of different ages. Making one continuous floor across that join, flat and colour-consistent, is the part of the job most often underestimated.',
  },

  clarkson: {
    intro:
      'Clarkson is western Mississauga between the lake and the QEW, with a village core, substantial 1950s to 1970s detached housing, and later infill. Refinishing of original oak is common, and so is full replacement where a floor has already been sanded thin.',
    neighbourhoods: ['Clarkson village', 'Lorne Park', 'Sheridan', 'Meadowwood', 'Rattray Marsh'],
    housingNote:
      'Post-war houses here carry narrow-strip oak over plywood, much of it protected under broadloom and in better condition than the room suggests until the tack strip comes up and the perimeter damage is visible. Houses nearer the marsh and the lake sit on ground that holds moisture, and basement humidity below a floor being refinished is measured rather than assumed.',
    localConsideration:
      'Lakeside houses hold summer humidity longer into the autumn than houses on the north side of the QEW a few minutes away. Acclimating to the room the floor will live in, with a meter, is what separates a flat floor from one that gaps in February.',
  },

  sheridan: {
    intro:
      'Sheridan is western Mississauga north of Clarkson, largely detached housing built between the 1960s and the 1980s on regular lots, with mature trees and a stable ownership pattern. Second-generation refinishing and carpet-to-hardwood conversion dominate.',
    neighbourhoods: ['Sheridan Homelands', 'Erin Mills', 'Clarkson', 'Sheridan Park'],
    housingNote:
      'Builder-grade strip oak from that era is frequently thin on remaining wear layer after one aggressive sand, which makes the screen-and-recoat decision real rather than a lesser option. Where carpet has been down since installation, the floor underneath is often sound and needs less than the owner expects.',
    localConsideration:
      'Split-level plans are common in this stock, which means short runs interrupted by landings and half-flights. Matching stain and sheen across three or four levels of the same floor is harder than laying one long run, and it is where an inconsistent refinish shows.',
  },

  /* ── the rest of the Niagara belt ─────────────────────────────────────── */

  lincoln: {
    intro:
      'The Town of Lincoln runs from the escarpment down to the lake between Grimsby and St. Catharines, with village cores at Beamsville and Vineland and substantial agricultural and estate property on the bench between them.',
    neighbourhoods: ['Beamsville', 'Vineland', 'Campden', 'Jordan', 'Lincoln Bench'],
    housingNote:
      'Village and farm houses here often carry original softwood plank or early strip hardwood over plank subfloor, sometimes over a stone foundation, where subfloor moisture and replacement in kind matter more than the finish system. Newer builds on the bench and at the village edges are plywood over joists and are ordinary installation work by comparison.',
    localConsideration:
      'Agricultural properties more often have unheated or intermittently heated space adjoining the floor being installed, which changes the acclimation target. Work here is scheduled as a trip, confirmed in advance and priced with that in the written quote.',
  },

  welland: {
    intro:
      'Welland sits in the centre of the Niagara peninsula on the canal, with a pre-war core, a large band of post-war housing, and newer subdivision development at the edges. Refinishing original floors and replacing failed post-war installations are both common.',
    neighbourhoods: ['Downtown Welland', 'Dain City', 'Chippawa Park', 'Northeast Welland'],
    housingNote:
      'Pre-war houses carry narrow-strip hardwood or original softwood over plank subfloor, often with settlement that has been in the building long enough to be part of it. The post-war band is plywood over joists with builder strip oak, where remaining thickness above the tongue decides between a full sand and a screen and recoat.',
    localConsideration:
      'Canal-side and low-lying properties can carry higher basement humidity than the same house type on higher ground, and subfloor moisture is measured before the sanding sequence is set rather than after.',
  },

  thorold: {
    intro:
      'Thorold sits on the escarpment between St. Catharines and Welland, following the canal, with a nineteenth-century stone-built core, post-war housing above it, and newer subdivision growth at the edges.',
    neighbourhoods: ['Downtown Thorold', 'Thorold South', 'Port Robinson', 'Confederation Heights'],
    housingNote:
      'The older core carries original softwood or early hardwood over plank subfloor, frequently in houses with stone foundations where basement humidity below the floor is the first measurement. Post-war and newer stock is plywood over joists and is conventional refinishing and installation work.',
    localConsideration:
      'Sitting on the escarpment puts these houses in a drier microclimate than the lakeside towns a short drive north. A board width chosen for a Port Dalhousie house is not automatically right here.',
  },

  'fort-erie': {
    intro:
      'Fort Erie faces Buffalo across the Niagara River, with an older core near the crossing, lakeshore and riverside housing through Crystal Beach and Ridgeway, and post-war and newer development inland.',
    neighbourhoods: ['Bridgeburg', 'Ridgeway', 'Crystal Beach', 'Stevensville', 'Douglastown'],
    housingNote:
      'Lakeshore and riverside houses include a substantial number of former seasonal cottages converted to year-round use, where the original floor sits on a subfloor and a foundation that were never built for a heated winter. That history is read before a specification is written; the rest of the stock is conventional post-war plywood over joists.',
    localConsideration:
      'This is the Canadian side of the border crossing, and work here shares a corridor with Niagara Falls NY, Lewiston and Buffalo. The published Ontario price bands apply; the schedule reflects the distance from the Toronto shop.',
  },

  /* ── New York State ─────────────────────────────────────────────────────
   *
   * Published 2026-09-10, when the owner confirmed cross-border licensing and
   * crew work authorization. Written to the same two rules as every Ontario
   * entry above and to one more that only applies here:
   *
   *   NO LOCAL PRESENCE IS IMPLIED. There is one shop and one showroom, at 32
   *   Norfield Crescent in Toronto, one telephone number and one set of hours.
   *   No entry below claims a county office, a local number, local reviews, or
   *   a job on a named street. `scripts/verify-geo.mjs` fails the build if a
   *   second address or telephone appears in the geographic content.
   *
   * The technical common ground is real and is what makes these pages worth
   * reading: western New York runs the same continental humidity cycle as
   * southern Ontario — dry heated winters against humid summers off the lakes —
   * so the movement arithmetic, the acclimation discipline and the substrate
   * questions are the ones already published on this site.
   */

  buffalo: {
    intro:
      'Buffalo has one of the best-preserved concentrations of early-twentieth-century housing on the Great Lakes: Elmwood, Parkside, Allentown and the Fruit Belt are dense pre-1930 stock, much of it in two-family houses and Victorians that still carry their original floors.',
    neighbourhoods: ['Elmwood Village', 'Parkside', 'Allentown', 'North Buffalo', 'Central Park', 'Kaisertown'],
    housingNote:
      'Pre-1930 Buffalo houses commonly carry narrow-strip oak or maple over plank subfloor, frequently with inlaid borders in the principal rooms and with board loss where partitions and radiators were removed. Piecing in and feathering comes before any uniform sand, and a border that has survived a century is repaired in kind rather than sanded flat.',
    localConsideration:
      'Lake-effect winters with long heating seasons pull indoor relative humidity low for months, then release it through a humid summer — the same annual cycle as southern Ontario, and the same argument for measuring moisture content at delivery rather than trusting a calendar.',
  },

  amherst: {
    intro:
      'Amherst is the largest of the Buffalo suburbs, running from the older Williamsville and Snyder streets out through post-war ranch and colonial subdivisions to newer development along Transit Road. Refinishing and full-house conversion are both routine.',
    neighbourhoods: ['Snyder', 'Eggertsville', 'Williamsville', 'Getzville', 'Audubon'],
    housingNote:
      'Amherst reads as three build eras on adjacent streets: Snyder and Eggertsville from the 1920s to the 1940s, a wide ranch-and-colonial belt through the 1950s and 1960s, and Transit Road development from the 1980s on. What that means practically is that the same species and the same width can be correct in one house and wrong two blocks away, because the subfloor, the ceiling height and the room sizes all changed with the decade.',
    localConsideration:
      'Basements here are frequently finished and heated, which changes the moisture gradient under a first-floor refinish. The subfloor is measured rather than assumed from the age of the house.',
  },

  williamsville: {
    intro:
      'Williamsville is a village inside the Town of Amherst with a nineteenth-century core along Main Street and mature residential streets around it — the oldest concentrated stock in the Amherst area.',
    neighbourhoods: ['Williamsville village', 'Snyder', 'Glen Park', 'Amherst'],
    housingNote:
      'Village houses carry original softwood or early hardwood over plank subfloor, sometimes over a stone foundation, where the honest answer is often the least aggressive one: repair, board replacement in kind, and a finish that does not read as new. Settlement in the plane of the floor has usually been there long enough to be part of the house.',
    localConsideration:
      'Older village properties often adjoin unheated or intermittently heated space, which widens the moisture range the floor absorbs. Acclimation is measured to the room the floor will live in.',
  },

  clarence: {
    intro:
      'Clarence runs east from Amherst with a historic hamlet at Clarence Hollow and substantial newer estate subdivision housing on large lots, much of it built from the 1990s onward.',
    neighbourhoods: ['Clarence Hollow', 'Clarence Center', 'Harris Hill', 'Swormville'],
    housingNote:
      'The estate stock is plywood over engineered joists with large continuous main-floor areas, high ceilings and frequent radiant heat, where the construction the floor must be is settled before the species is. The hamlet carries older houses on plank subfloor where replacement in kind precedes any uniform finish.',
    localConsideration:
      'Large heated volumes with substantial glazing swing further in relative humidity across the year than a smaller house on the same street. That is an argument for engineered construction or a narrower board rather than the widest plank available.',
  },

  cheektowaga: {
    intro:
      'Cheektowaga is dense post-war housing immediately east of Buffalo — cape cods, bungalows and ranches built largely between the late 1940s and the 1960s on regular lots, with a stable ownership pattern and a high rate of original floors.',
    neighbourhoods: ['Pine Hill', 'Doyle', 'Forks', 'Union', 'Depew'],
    housingNote:
      'Post-war houses here commonly carry narrow-strip oak over plywood that has spent decades under broadloom, which protects the wear layer and hides perimeter damage at the tack strip until the carpet lifts. Where a floor has already been sanded, remaining thickness decides whether a full sand is available at all.',
    localConsideration:
      'Small rooms and short runs mean the visible test of a refinish here is the transitions and the doorways rather than a long sightline. Consistency across a hallway that touches six rooms is the harder part.',
  },

  lancaster: {
    intro:
      'Lancaster sits east of Cheektowaga with a village core, a band of post-war housing and substantial newer subdivision growth. Detached houses dominate and the stock spans a wide range of ages.',
    neighbourhoods: ['Lancaster village', 'Depew', 'Bowmansville', 'Como Park'],
    housingNote:
      'Village and early post-war houses carry original strip hardwood over plank or plywood subfloor with the usual patching at removed partitions and heating runs. Newer subdivisions are plywood over engineered joists where flatness accepted under carpet is corrected before a nail-down floor goes down.',
    localConsideration:
      'Where an older house has been extended, the original floor and the addition sit on different subfloor systems of different ages, and making one continuous floor across that join is the underestimated part of the job.',
  },

  'west-seneca': {
    intro:
      'West Seneca is post-war suburban housing south-east of Buffalo along the Buffalo Creek corridor, mostly detached ranches and colonials from the 1950s through the 1970s with later infill.',
    neighbourhoods: ['Ebenezer', 'Winchester', 'Harlem Road', 'Union Road'],
    housingNote:
      'Builder-grade strip oak over plywood is the common floor, frequently thinner than the surface suggests once a previous sand is accounted for. Split-level and raised-ranch plans are common, which means short runs interrupted by landings and half-flights rather than one continuous field.',
    localConsideration:
      'Creek-adjacent properties can carry higher basement humidity than the same house type on higher ground nearby, and the subfloor is measured before a sanding sequence is set.',
  },

  tonawanda: {
    intro:
      'The Town of Tonawanda is dense inter-war and early post-war housing between Buffalo and the Niagara River, built largely between the 1920s and the 1950s on small regular lots with a very high proportion of original hardwood.',
    neighbourhoods: ['Kenmore', 'Brighton', 'Sheridan Parkside', 'Elmwood', 'Riverside'],
    housingNote:
      'The 1920s and 1930s stock carries narrow-strip oak over plank subfloor, often with a simple border in the front rooms, and is frequently on its second or third finish. Remaining thickness above the tongue is the first measurement, and where it is gone the honest answer is a screen and recoat or a replacement rather than another aggressive sand.',
    localConsideration:
      'Small rooms, many doorways and original trim mean the job is decided at the edges: undercutting, transitions and how a refinished floor meets a hundred-year-old baseboard.',
  },

  kenmore: {
    intro:
      'Kenmore is a village inside the Town of Tonawanda, one of the densest and best-preserved inter-war neighbourhoods in western New York, built largely between 1915 and 1940 on small lots with mature street trees.',
    neighbourhoods: ['Kenmore village', 'Tonawanda', 'North Buffalo', 'Brighton'],
    housingNote:
      'Almost the whole stock carries original narrow-strip oak over plank subfloor, much of it with inlaid borders in the living and dining rooms, and much of it already refinished more than once. Thickness above the tongue is measured before any finish system is discussed, and a surviving border is repaired in kind rather than sanded through.',
    localConsideration:
      'Original trim, plaster and hardware throughout mean a floor here is one element of an intact interior. Sheen and colour are chosen against the trim rather than from a sample card.',
  },

  'grand-island': {
    intro:
      'Grand Island sits in the Niagara River between Buffalo and Niagara Falls, with post-war and later detached housing, a substantial waterfront band and a number of former seasonal properties converted to year-round use.',
    neighbourhoods: ['Grand Island', 'Sandy Beach', 'East River', 'Whitehaven'],
    housingNote:
      'Waterfront and former seasonal houses frequently sit on foundations and subfloors that were never built for a heated winter, and that history is read before a specification is written. The inland post-war stock is conventional plywood over joists with builder strip oak.',
    localConsideration:
      'Being surrounded by the river keeps summer humidity higher and for longer here than a few kilometres inland. Acclimation is measured to the room rather than assumed from a delivery date.',
  },

  'orchard-park': {
    intro:
      'Orchard Park runs south from Buffalo with a historic village core, mature large-lot housing around it, and newer estate subdivision development further out. It is one of the higher-specification markets in Erie County.',
    neighbourhoods: ['Orchard Park village', 'Windom', 'Ellicott', 'Chestnut Ridge'],
    housingNote:
      'Village and near-village houses carry original hardwood over plank subfloor with the patching and feathering that a century of partition changes leaves behind. The estate subdivisions are plywood over engineered joists with large continuous areas where flatness across the run and stain consistency between floor and stair decide whether the result reads as one floor.',
    localConsideration:
      'Higher ground south of the city runs a colder, drier winter than the lakeshore, which widens the annual movement the floor absorbs and argues for measuring rather than assuming a board width.',
  },

  hamburg: {
    intro:
      'Hamburg is three towns in one: a preserved village of nineteenth-century brick and frame, a hard-weather Lake Erie shoreline at Athol Springs and Wanakah, and a wide belt of post-war and later subdivision between them. Almost every job here starts by establishing which of the three the house belongs to.',
    neighbourhoods: ['Hamburg village', 'Blasdell', 'Athol Springs', 'Water Valley', 'Armor'],
    housingNote:
      'Village houses carry original softwood or early hardwood over plank subfloor where replacement in kind precedes any uniform finish. Lakeshore properties include former cottages on foundations never built for a heated winter, and the inland subdivisions are conventional plywood over joists.',
    localConsideration:
      'Lake Erie holds summer humidity against the shore band well into the autumn and drives hard lake-effect winters, so the annual range here is wider than a few kilometres inland. It is measured on site.',
  },

  'east-aurora': {
    intro:
      'East Aurora is a village south-east of Buffalo with an unusually intact nineteenth- and early twentieth-century core, mature residential streets, and a strong preservation culture. Original floors survive at a high rate.',
    neighbourhoods: ['East Aurora village', 'Aurora', 'Elma', 'Marilla'],
    housingNote:
      'The village stock carries original softwood plank and early hardwood over plank subfloor, often with settlement in the plane that has been part of the house for a century, and frequently in interiors where trim, plaster and hardware are all original. Least-aggressive repair and replacement in kind is usually the correct approach rather than a uniform sand.',
    localConsideration:
      'In an intact interior the floor is chosen against the trim, not from a sample rack, and a finish that reads as new is often the wrong outcome even when it is the easiest one.',
  },

  'niagara-falls-ny': {
    intro:
      'Niagara Falls, New York carries a wide spread of housing ages: pre-war stock through the older centre and the DeVeaux and Hyde Park neighbourhoods, substantial post-war development, and newer building at the edges.',
    neighbourhoods: ['DeVeaux', 'Hyde Park', 'LaSalle', 'Deveaux Woods', 'North End'],
    housingNote:
      'DeVeaux and Hyde Park carry inter-war houses built for a chemical and power workforce, which means solid but unshowy material: plain-sawn oak and maple in quantity, laid narrow, usually without borders. It refinishes very well when there is thickness left, and the LaSalle and post-war stock behind it is a different and simpler proposition on plywood over joists.',
    localConsideration:
      'This is directly across the river from Niagara Falls, Ontario, and the two share a corridor and a climate. The housing stock does not; the American side carries more inter-war density and the Ontario side more post-war and newer subdivision.',
  },

  lewiston: {
    intro:
      'Lewiston is a historic village on the Niagara River escarpment north of the falls, with an early nineteenth-century core, mature residential streets and larger properties on the surrounding ridge.',
    neighbourhoods: ['Lewiston village', 'Sanborn', 'Model City', 'Escarpment ridge'],
    housingNote:
      'Village houses include some of the oldest surviving stock in the county, carrying original wide softwood plank or early hardwood over plank subfloor, sometimes over stone foundations where basement humidity is the first measurement. Ridge properties are later and larger, with conventional plywood over joists.',
    localConsideration:
      'A house that has stood for two centuries has a floor plane it has settled into. Deciding whether to level or to work with that plane changes the quote more than the species does.',
  },

  wheatfield: {
    intro:
      'Wheatfield lies between Niagara Falls and North Tonawanda and is one of the faster-growing towns in Niagara County, dominated by detached subdivision housing built from the 1990s onward on regular lots.',
    neighbourhoods: ['Shawnee', 'Bergholz', 'Sawyer', 'Walmore'],
    housingNote:
      'The stock is overwhelmingly plywood over engineered joists, where the flatness a builder accepted under carpet is corrected before a nail-down floor goes in and is usually the largest single line in an honest quote. There is very little old floor here to restore; the work is installation and conversion.',
    localConsideration:
      'Newer houses run tighter and drier through a lake-effect winter than the inter-war stock nearer the river, which widens the annual moisture swing and argues for engineered construction or a narrower solid board.',
  },

  'north-tonawanda': {
    intro:
      'North Tonawanda sits at the mouth of the Erie Canal on the Niagara River, with a dense pre-war core built through the lumber and carousel era, post-war housing around it, and newer development at the edges.',
    neighbourhoods: ['Downtown North Tonawanda', 'Martinsville', 'Gratwick', 'Sweeney'],
    housingNote:
      'The pre-war core carries original narrow-strip hardwood over plank subfloor in houses built when the town was a lumber centre, frequently with better-than-average material and simple borders in the front rooms. Remaining thickness decides the approach; post-war stock is plywood over joists and conventional.',
    localConsideration:
      'Riverside and canal-adjacent properties can carry higher basement humidity than the same house type a few streets inland, and the subfloor is measured before a sanding sequence is set.',
  },

  lockport: {
    intro:
      'Lockport is the canal town of Niagara County, with a substantial nineteenth-century core built through the Erie Canal era, post-war housing around it, and rural and estate property in the surrounding town.',
    neighbourhoods: ['Downtown Lockport', 'Lowertown', 'Rapids', 'Wrights Corners'],
    housingNote:
      'Lockport was built up and down a rock cut, so a great many houses sit directly on the escarpment with foundations cut into stone and floors that have never been fully dry underneath. The reading below the boards decides everything here, and it is taken in more than one place: the same house can be within tolerance at the front and out of it at the back wall.',
    localConsideration:
      'Stone-founded houses on the escarpment can run damp below a floor being refinished regardless of the season. It is measured before the sanding sequence is set rather than after.',
  },

  'rochester-ny': {
    intro:
      'Rochester carries some of the strongest pre-war residential stock in upstate New York — Park Avenue, Browncroft, the South Wedge and the 19th Ward are dense early-twentieth-century housing where original hardwood, borders and inlay survive at a high rate.',
    neighbourhoods: ['Park Avenue', 'Browncroft', 'South Wedge', '19th Ward', 'Highland Park', 'Corn Hill'],
    housingNote:
      'Pre-1930 houses commonly carry quarter-sawn oak or maple over plank subfloor, frequently with inlaid borders and feature strips in the principal rooms, and frequently already refinished more than once. Thickness above the tongue is measured first, and a surviving border is repaired in kind rather than sanded through.',
    localConsideration:
      'Work in Monroe County is scheduled as a trip and confirmed in advance. The published price is fixed after the free in-home measure, as it is everywhere else; the schedule reflects the distance, not the standard.',
  },

  brighton: {
    intro:
      'Brighton is the inner suburb immediately south-east of Rochester, largely built between the 1920s and the 1960s, with mature tree-lined streets, a stable ownership pattern and a high proportion of original floors.',
    neighbourhoods: ['Home Acres', 'Meridian Hill', 'Council Rock', 'Twelve Corners', 'Buckland'],
    housingNote:
      'Inter-war and early post-war houses here carry original narrow-strip oak over plank or early plywood subfloor, often with a border in the principal rooms and often on a second finish already. Where a floor has been carpeted since installation it is usually sounder than the room suggests until the tack strip comes up.',
    localConsideration:
      'Intact original trim and plaster through much of this stock means the floor is chosen against the interior rather than from a sample card, and the transitions and undercuts decide how the work reads.',
  },

  pittsford: {
    intro:
      'Pittsford combines a canal-era village core with extensive later estate subdivision development on large lots, and is one of the higher-specification residential markets in Monroe County.',
    neighbourhoods: ['Pittsford village', 'Sutherland', 'Thornell', 'Mendon Center', 'Golf Club Estates'],
    housingNote:
      'The canal village and the estate development are two different problems sharing a postal code. In the village the floor is usually older than the plumbing and the correct move is repair with matched stock. In the estate houses the floor is a single field of several thousand square feet under a lot of glass, where the failure mode is not wear but movement, and where a wide plank ordered on looks alone will telegraph every seasonal swing.',
    localConsideration:
      'Large heated volumes with substantial glazing dry further across a Monroe County winter than a smaller house on the same street, which is a real argument against the widest plank on the rack. Work here is scheduled as a trip and confirmed in advance.',
  },

  fairport: {
    intro:
      'Fairport is a canal village east of Rochester with an intact nineteenth-century core along the Erie Canal and substantial later residential development in the surrounding town of Perinton.',
    neighbourhoods: ['Fairport village', 'Perinton', 'Egypt', 'Bushnells Basin'],
    housingNote:
      'Village houses carry original softwood plank and early hardwood over plank subfloor, often over stone foundations where basement humidity is measured before anything else. The surrounding subdivision stock is plywood over engineered joists and is installation and conversion work.',
    localConsideration:
      'Canal-adjacent properties can run damper below the floor than the same house type on higher ground a few streets away. The subfloor decides the sanding sequence, not the calendar.',
  },

  victor: {
    intro:
      'Victor sits in Ontario County south-east of Rochester and is one of the faster-growing towns in the region, with a small village core and a large volume of detached subdivision housing built from the 1990s onward.',
    neighbourhoods: ['Victor village', 'Fishers', 'East Victor', 'Turk Hill'],
    housingNote:
      'Almost everything here has been built within one generation, which means the floors are first-generation rather than second: the question is what to lay, not what is left. Open-concept plans with a great room, kitchen and hall in one field make the fastening schedule and the expansion allowance at the perimeter matter more than the species, because there is nothing to break the run.',
    localConsideration:
      'Newer construction on higher ground south of the lake runs a colder, drier heating season than the lakeshore towns, which widens the annual movement the floor has to absorb.',
  },

  webster: {
    intro:
      'Webster runs along the Lake Ontario shore east of Irondequoit Bay, with a village core, a lakeshore band including converted seasonal properties, and substantial post-war and newer subdivision housing inland.',
    neighbourhoods: ['Webster village', 'North Ponds', 'Holt Road', 'Lake Road'],
    housingNote:
      'The Webster shore runs cottages that became houses one addition at a time, and the giveaway is a floor that changes direction, height or species at a doorway. Bringing that into one plane is structural work before it is a flooring decision, and it is settled at the measure — inland, the town is conventional plywood over joists and a far shorter conversation.',
    localConsideration:
      'The lake holds summer humidity against the shore band into the autumn and moderates the winter, so the annual range differs measurably from the towns a few kilometres south.',
  },

  irondequoit: {
    intro:
      'Irondequoit sits between Rochester and Lake Ontario, densely built between the 1920s and the 1950s on small lots, with a very high proportion of original hardwood surviving under later floor coverings.',
    neighbourhoods: ['Summerville', 'Sea Breeze', 'Point Pleasant', 'Ridge Culver', 'Durand'],
    housingNote:
      'The inter-war and early post-war stock carries narrow-strip oak over plank or early plywood subfloor, much of it under broadloom since installation and in better condition than the room suggests until the tack strip comes up. Where a floor has already been sanded, remaining thickness decides whether a full sand is available at all.',
    localConsideration:
      'Proximity to the lake and the bay keeps summer humidity high and moderates the winter compared with the towns inland, and acclimation is measured to the room rather than assumed.',
  },

  greece: {
    intro:
      'Greece is the large suburban town west of Rochester along the lake, built predominantly between the 1950s and the 1980s with later infill, and dominated by detached single-family housing on regular lots.',
    neighbourhoods: ['Charlotte', 'Barnard', 'North Greece', 'Paddy Hill', 'Braddock Heights'],
    housingNote:
      'Greece is largely one long build-out of ranches and colonials, so the floors arrive with the same problem at the same age: a builder oak strip laid over plywood, sanded once somewhere around its thirtieth year, and now being asked for a third finish it may not have the thickness to give. That measurement, taken at a doorway where the tongue is exposed, is the whole conversation.',
    localConsideration:
      'Matching stain and sheen across the three or four levels of a split-level, and across the landings between them, is harder than laying one long run and is where an inconsistent refinish shows.',
  },

  /* ── GEO-001: the eleven owner-confirmed municipalities that had no page ──
   *
   * Every one of these was a confirmed market (content/geo/markets.ts, owner
   * confirmation 2026-09-10) and in the /api/v1/markets service area, with no
   * URL behind the claim. What is written below is public geography — how the
   * municipality was formed, when its housing was built, what that means for a
   * floor — and the site's own published method. No job, review, customer or
   * address is stated or implied for any of them, and none carries a
   * signatureProject.
   */
  whitby: {
    intro:
      'Whitby runs from the Lake Ontario shore at Port Whitby, through a nineteenth-century downtown on Brock and Dundas Streets, north to the village of Brooklin. Most of its housing between those points is subdivision stock built from the 1980s onward, around an older core that still carries original floors.',
    neighbourhoods: ['Downtown Whitby', 'Port Whitby', 'Brooklin', 'Williamsburg', 'Pringle Creek', 'Rolling Acres'],
    housingNote:
      'The pre-war houses around the downtown core sit on plank subfloor with narrow-strip or face-nailed boards that have usually been sanded before, so remaining thickness is the first measurement. The newer subdivisions to the north are plywood over engineered joists, where carpet-grade flatness has to be corrected before a nail-down floor goes in.',
    localConsideration:
      'Brooklin and the north end are new enough that many houses are on their first floor covering, and conversion from builder carpet to hardwood is the common job; the older lakeshore and downtown stock is where refinishing and board replacement concentrate.',
  },

  oshawa: {
    intro:
      'Oshawa grew around the McLaughlin carriage works that became General Motors of Canada, and its housing still reads that history: early-twentieth-century and wartime houses south and east of downtown, post-war streets through the middle of the city, and subdivisions north toward Windfields and the university campus.',
    neighbourhoods: ['Lakeview', 'McLaughlin', 'Donevan', 'Eastdale', 'Samac', 'Windfields'],
    housingNote:
      'The older worker housing near downtown and down toward Lakeview Park is small-footprint stock with original strip floors, frequently under two or three later coverings, where board replacement and feathering come before any sand. The north-end subdivisions are plywood over engineered joists and are installation and conversion work.',
    localConsideration:
      'Houses within a few blocks of the lake at Lakeview hold more summer humidity than the north end does, and a floor delivered from a dry warehouse in July is measured on site before it is installed rather than dated from the delivery slip.',
  },

  clarington: {
    intro:
      'Clarington is not one town but several: Bowmanville, Courtice, Newcastle and Orono, with hamlets between them, joined into one municipality in the 1970s. Bowmanville has a Victorian main street and older residential streets around it; Courtice and the edges of Bowmanville are largely built since the 1990s.',
    neighbourhoods: ['Bowmanville', 'Courtice', 'Newcastle', 'Orono', 'Hampton'],
    housingNote:
      'Heritage houses in old Bowmanville and Newcastle village carry plank subfloors and original boards that often change species or width room to room, so matching comes before sanding. The Courtice and south Bowmanville subdivisions are conventional plywood over joists, where subfloor flatness is the variable that most changes the quote.',
    localConsideration:
      'Clarington is outside the daily-return radius of the Toronto shop: a job here is scheduled as a trip, confirmed in advance and priced with the distance in the written quote. Lakeshore streets in Bowmanville and Newcastle hold more summer humidity than the inland hamlets, and acclimation is measured on site.',
  },

  'kawartha-lakes': {
    intro:
      'Kawartha Lakes is a single municipality covering Lindsay, Fenelon Falls, Bobcaygeon, Omemee and the lake country around them, much of it strung along the Trent-Severn Waterway. Its housing is a mix of small-town cores, rural houses and a large stock of cottages, many of them converted to year-round use.',
    neighbourhoods: ['Lindsay', 'Fenelon Falls', 'Bobcaygeon', 'Omemee', 'Coboconk'],
    housingNote:
      'Cottage conversions are the defining job here: floors laid over joists that were framed for summer use, crawlspaces open to lake air, and additions at different heights. The subfloor and the moisture below it are measured before any material is chosen, because an unconditioned crawlspace decides what a floor can survive.',
    localConsideration:
      'This is outside the daily-return radius of the Toronto shop. A job here is scheduled as a trip, confirmed in advance and priced with that in the written quote — and a seasonal property that is shut in winter changes the acclimation plan entirely.',
  },

  'halton-hills': {
    intro:
      'Halton Hills is Georgetown and Acton, with the hamlets of Glen Williams, Limehouse and Terra Cotta between them along the Credit River and the escarpment. Georgetown has a nineteenth-century core around Main Street and large subdivisions built from the 1970s onward; Acton is a smaller town of the same pattern.',
    neighbourhoods: ['Georgetown', 'Acton', 'Glen Williams', 'Limehouse', 'Terra Cotta'],
    housingNote:
      'The 1970s and 1980s subdivisions in Georgetown frequently still carry their original strip oak under carpet, with enough wear layer left for a full sand when nothing has been done to them since. The older core and the hamlet houses are plank subfloor and mixed-age boards that call for repair in kind before refinishing.',
    localConsideration:
      'Escarpment and river-valley lots run cooler and damper than the flat subdivisions, and houses on the valley slopes often have walk-out basements where a below-grade floor is a moisture question before it is a flooring one.',
  },

  caledon: {
    intro:
      'Caledon is the largest municipality by area in the GTA and mostly rural: Bolton in the southeast, Caledon East, Caledon Village, Inglewood, Alton, Belfountain and Palgrave, spread across the Oak Ridges Moraine and the Niagara Escarpment. Estate lots and custom houses sit alongside the subdivision growth in Bolton.',
    neighbourhoods: ['Bolton', 'Caledon East', 'Caledon Village', 'Inglewood', 'Alton', 'Belfountain', 'Palgrave'],
    housingNote:
      'Custom and estate houses bring long open runs, wide-plank specifications and radiant heat, which together make engineered construction and a measured moisture reading on the slab or subfloor part of the specification rather than an option. Bolton subdivisions are conventional plywood over joists and are installation and conversion work.',
    localConsideration:
      'Moraine and escarpment lots run cooler than the Bolton subdivisions, and large rural houses often have basements finished at different times; each below-grade room is a moisture reading before it is a flooring choice.',
  },

  innisfil: {
    intro:
      'Innisfil lies along the west shore of Lake Simcoe south of Barrie, with Alcona as its largest community and Lefroy, Stroud, Cookstown and the shoreline settlements around it. Much of the lakeside housing began as cottages; the inland growth around Alcona is recent subdivision stock.',
    neighbourhoods: ['Alcona', 'Lefroy', 'Stroud', 'Cookstown', 'Sandy Cove', 'Gilford'],
    housingNote:
      'Shoreline houses that started as cottages carry the same signature as anywhere on a lake: additions at different heights, floors that change direction at a doorway, and crawlspaces that breathe lake air. The Alcona subdivisions are plywood over engineered joists, where flatness is corrected before a nail-down floor is laid.',
    localConsideration:
      'Innisfil is reached from the Vaughan hub on the 400 and is outside the daily-return radius, so a job is scheduled as a trip and confirmed in advance. Lake Simcoe widens the humidity swing near the shore, which is an argument for engineered construction on the lakeside properties.',
  },

  guelph: {
    intro:
      'Guelph is a planned nineteenth-century city built out of local limestone, and its older neighbourhoods around downtown and the University of Guelph still carry that stock. Post-war housing fills the middle of the city, and the south end is subdivision growth from the 1990s onward.',
    neighbourhoods: ['Exhibition Park', 'Old University', 'St. George’s Park', 'The Ward', 'Kortright Hills', 'South End'],
    housingNote:
      'Stone and brick houses near downtown carry original boards over plank subfloor, often with heating ducts, radiators and old repairs cut through them, so piecing in and feathering come before any uniform sand. The south-end subdivisions are plywood over engineered joists and are installation work with subfloor flatness as the main variable.',
    localConsideration:
      'Guelph is reached from the Hamilton hub on the 403 and Highway 6 and is outside the daily-return radius: a job is scheduled as a trip, confirmed in advance and priced with the distance in the written quote. Thick masonry walls in the limestone houses change how quickly a room settles to its winter humidity.',
  },

  cambridge: {
    intro:
      'Cambridge was formed in 1973 from Galt, Preston and Hespeler, three older towns on the Grand and Speed Rivers, and each core still has its own nineteenth-century main street and stone buildings. It is part of Waterloo Region, beside Kitchener, with post-war and newer subdivision housing between and around the old centres.',
    neighbourhoods: ['Galt', 'Preston', 'Hespeler', 'Blair', 'West Galt', 'East Galt'],
    housingNote:
      'The older houses in Galt, Preston and Hespeler carry original boards over plank subfloor, sometimes several species in one house where rooms were added over a century. The post-war and newer streets are plywood over joists with strip oak or builder engineered, and are refinishing and conversion work.',
    localConsideration:
      'Cambridge is reached from the Hamilton hub on the 403 corridor and is outside the daily-return radius, so a job is scheduled as a trip and confirmed in advance. River-valley lots in Galt run damper than the upland subdivisions, and basements there are measured before anything is laid below grade.',
  },

  kitchener: {
    intro:
      'Kitchener, called Berlin until 1916, is the largest city in Waterloo Region. Its pre-war housing surrounds the downtown and Victoria Park, a broad band of post-war streets runs through the middle of the city, and the south end toward Doon is recent subdivision growth. The City of Waterloo is a separate municipality to the north.',
    neighbourhoods: ['Downtown Kitchener', 'Victoria Park', 'Forest Heights', 'Stanley Park', 'Doon', 'Laurentian Hills'],
    housingNote:
      'The pre-war houses around Victoria Park and downtown carry narrow-strip oak or maple over plank subfloor, often sanded before, so remaining thickness decides between a full sand and a screen and recoat. Post-war Stanley Park and Forest Heights stock is frequently original strip oak under carpet; the south-end subdivisions are installation work.',
    localConsideration:
      'Kitchener is reached from the Hamilton hub on the 403 and Highway 6 corridor and is outside the daily-return radius: a job is scheduled as a trip, confirmed in advance and priced with the distance in the written quote. This page covers Kitchener; the City of Waterloo is not a published area.',
  },

  'port-colborne': {
    intro:
      'Port Colborne sits at the Lake Erie end of the Welland Canal, a working canal town with an older downtown along the waterway and early-twentieth-century housing around it, post-war streets inland, and lakeshore cottages east toward Sherkston. It is part of Niagara Region, south of Welland.',
    neighbourhoods: ['Downtown Port Colborne', 'Humberstone', 'Sherkston', 'Gasline', 'Bethel'],
    housingNote:
      'Canal-era and early-twentieth-century houses carry plank subfloor with original boards that have usually been covered or patched more than once, so repair in kind comes before refinishing. Lakeshore cottages converted to year-round use bring crawlspaces open to lake air, which are measured before any floor is chosen.',
    localConsideration:
      'Port Colborne is reached from the Grimsby hub across the Niagara peninsula and is outside the daily-return radius: a job is scheduled as a trip, confirmed in advance and priced with the distance in the written quote. Lake Erie keeps the shore band humid well into the autumn.',
  },
};

export const cityContent = (slug: string): CityContent | undefined => CITY_CONTENT[slug];
