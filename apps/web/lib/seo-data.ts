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

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export const CITIES: City[] = AREAS.map((name) => ({ slug: slugify(name), name }));
export const cityBySlug = (slug: string): City | undefined => CITIES.find((c) => c.slug === slug);

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
};

export const cityContent = (slug: string): CityContent | undefined => CITY_CONTENT[slug];
