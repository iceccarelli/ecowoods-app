/**
 * seo-data.ts — single source of truth for programmatic SEO.
 * Cities, services and FAQs used by the sitemap, the /service-areas pages,
 * the JSON-LD builders and llms.txt. Keep business facts here in sync with
 * lib/structured-data.ts (NAP) and the homepage FAQ.
 */

import { BUSINESS_NAP } from '@ecowoods/shared/constants';

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
  'Downtown Toronto', 'North York', 'Etobicoke', 'Scarborough', 'East York', 'York',
  'Vaughan', 'Markham', 'Richmond Hill', 'Mississauga', 'Oakville', 'Brampton',
  'Aurora', 'Newmarket', 'Pickering', 'Ajax',
];

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
export const CITIES: City[] = AREAS.map((name) => ({ slug: slugify(name), name }));

/** Toronto neighbourhoods. Pages and local content; never a City node. */
export const NEIGHBOURHOOD_AREAS: City[] = NEIGHBOURHOODS.map((name) => ({
  slug: slugify(name),
  name,
}));

/**
 * Everything with a /service-areas page. The routes, the sitemap, the .md
 * editions and the local-content guard all read this; only CITIES reaches the
 * entity graph.
 */
export const SERVICE_AREAS: City[] = [...CITIES, ...NEIGHBOURHOOD_AREAS];

export const cityBySlug = (slug: string): City | undefined =>
  SERVICE_AREAS.find((c) => c.slug === slug);

export type Service = { slug: string; name: string; blurb: string };

export const SERVICES: Service[] = [
  { slug: 'hardwood-installation', name: 'Hardwood Flooring Installation', blurb: 'Solid and engineered hardwood laid by salaried craftsmen — straight-lay, herringbone, chevron and custom patterns.' },
  { slug: 'floor-refinishing', name: 'Hardwood Floor Refinishing', blurb: 'Bring tired floors back to life: sand to bare wood, re-stain and re-finish for a factory-fresh surface.' },
  { slug: 'dust-free-sanding', name: 'Dust-Free Floor Sanding', blurb: 'HEPA-sealed containment captures ~99.7% of airborne dust at the source, so most clients stay home during the work.' },
  { slug: 'floor-restoration', name: 'Hardwood Floor Restoration', blurb: 'Rescue and repair heritage and water-damaged floors — board replacement, feathering and colour matching.' },
  { slug: 'custom-inlays', name: 'Custom Inlays & Borders', blurb: 'Bespoke feature strips, medallions and borders routed and fitted by hand for a signature look.' },
  { slug: 'stair-refinishing', name: 'Stair Refinishing', blurb: 'Treads, risers and nosings refinished to match your floors for a seamless, hard-wearing finish.' },
];

export type FaqItem = { q: string; a: string };

// Mirror of the homepage FAQ — kept here so it can be emitted as FAQPage JSON-LD
// on every page. Keep in sync with app/page.tsx faqItems.
export const FAQ_ITEMS: FaqItem[] = [
  { q: 'Is the estimate really fixed? What about "unforeseen conditions"?', a: 'Yes — fixed, in writing, in your contract. Our senior estimator moisture-tests your subfloor and inspects conditions during the free consultation, so there are no "unforeseen conditions" to surprise you later. The number on paper is the number on your invoice.' },
  { q: 'Can we stay in the house during the work?', a: 'Yes. Our dust containment captures roughly 99.7% of airborne particulate at the source using HEPA-sealed systems. Most refinishing clients sleep at home every night of the job, and our water-based finishes are low-odour and walk-on ready in 2–4 hours.' },
  { q: 'What warranty comes with the work?', a: 'Your finishes and materials carry their manufacturer warranties — typically 25–35 years on finish, up to 50 years structural — passed through to you in writing, itemized in your contract. If anything in our workmanship isn\u2019t right, we come back and make it right.' },
  { q: 'How long will my project take?', a: 'A standard 1,000–1,500 sq ft installation takes 5 to 7 working days: moisture testing and acclimation, installation, then sanding, staining and finishing. Refinishing is typically 3–5 days. Your written estimate includes a committed schedule.' },
  // Two question-shaped entries, because those are the strings an answer engine
  // is handed verbatim. Both answers are the published position of a guide on
  // this site rather than new copy, and both name the guide so the citation
  // survives being quoted out of context.
  { q: 'What is the best hardwood flooring for concrete slab condos?', a: 'Engineered, not solid — the substrate decides it, not the budget. On a concrete slab the assembly is the specification: adhesive, underlayment and acoustic rating are part of the answer, and the slab is moisture-tested with in-situ probes before a board is opened. The full specification is published as our condominium-over-concrete-slab reference installation.' },
  { q: 'How do you match new hardwood to old floors seamlessly?', a: 'By matching species, width and grain direction first, then trialling stain on site on the actual old boards — never from a single can chosen off a sample. Where boards have to be replaced, repairs are feathered into the surrounding run rather than butted in a straight line. A full sand alone will not hide a species or width mismatch, which is why matching is decided before any machine is switched on.' },
  { q: 'How much does hardwood flooring cost in Toronto?', a: 'Installed ranges typically run about $11–$18 per sq ft for new hardwood, $4.75–$7.50 for full sand and finish, and $2.50–$4.00 for a screen and recoat — before stairs, transitions, or moisture remediation. Species, pattern, and substrate move the number. The fixed price is written after a free in-home measure, not from a phone quote.' },
  { q: 'What is dustless hardwood refinishing, and does it work in an occupied home?', a: 'Dustless means HEPA-sealed extraction at the machine and containment at the room — not a marketing label. Roughly 99.7% of airborne particulate is captured at the source. Most refinishing clients sleep at home every night of the job. Water-based finishes are low-odour and walk-on ready in 2–4 hours.' },
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

};

export const cityContent = (slug: string): CityContent | undefined => CITY_CONTENT[slug];
