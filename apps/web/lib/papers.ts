/**
 * Technical papers — the manifest.
 *
 * WHY THE SUBSTANCE LIVES HERE AND NOT ONLY IN THE PDF
 *
 * A PDF is close to invisible to a language model next to an HTML page. AWS
 * whitepapers get quoted because AWS also publishes the substance as HTML; the
 * PDF is what a person downloads, the page is what gets crawled, chunked,
 * embedded and cited. So every paper carries its abstract, its sections and its
 * tables here as structured data, rendered as real HTML at /papers/<slug>, with
 * the PDF as the download beside it.
 *
 * CONTENT RULE
 *
 * Everything in this file is drawn from the paper it describes. No figure is
 * introduced here that is not in the source document, and no figure from a
 * source document is restated here as a claim about the business — see
 * scripts/verify-business-facts.mjs for the list that must never come back.
 */

import {
  SCREEN_RECOAT,
  FULL_SAND_FINISH,
  NEW_INSTALL,
  formatBandBare as bandBare,
} from '@/content/constants/pricing';

export type PaperTable = {
  caption?: string;
  head: string[];
  rows: string[][];
};

export type PaperSection = {
  id: string;
  heading: string;
  body: string[];
  bullets?: string[];
  ordered?: string[];
  table?: PaperTable;
  callout?: { label: string; text: string };
};

/**
 * One primary source, read on `readAt`.
 *
 * WHY EVERY PAPER NOW CARRIES THESE
 *
 * A technical paper without a reference list is an opinion with headings. The
 * three founding papers here rest on physical constants and on this company's
 * own site protocol, which is defensible; the provenance and grading papers rest
 * on documents published by governments and standards bodies, which is not
 * defensible unless the documents are named and linked. `readAt` is the date a
 * human opened the URL — not a publication date and not a build date — because
 * an external page can change under a citation and the only honest thing to
 * record is when we last looked.
 */
export type PaperReference = {
  /** The issuing organisation, as it names itself. */
  org: string;
  /** The document title, as published. Never paraphrased. */
  title: string;
  /** The organisation's own URL. Never a reseller, never a blog, never a mirror. */
  url: string;
  /** ISO date a human opened `url` and read the figure cited from it. */
  readAt: string;
};

export type Paper = {
  slug: string;
  title: string;
  subtitle: string;
  /** One sentence. Used on the card, in <meta>, in schema `abstract`. */
  abstract: string;
  /** 2-3 sentences. The lede on the detail page. */
  summary: string;
  version: string;
  /** ISO date. Publication month, not export date. */
  publishedAt: string;
  pages: number;
  readingMinutes: number;
  audience: string;
  topics: string[];
  /** Filename under public/papers/. */
  pdf: string;
  sections: PaperSection[];
  /** Primary sources, rendered as a numbered register at the foot of the page. */
  references?: PaperReference[];
};

export const PAPERS: Paper[] = [
  {
    slug: 'toronto-hardwood-climate-moisture-protocol',
    title: 'Climate Mastery',
    subtitle: 'Why hardwood succeeds or fails in Toronto',
    abstract:
      "The physical science, moisture protocol and non-negotiable steps that decide whether a hardwood floor becomes a permanent asset or a permanent liability in Toronto's climate.",
    summary:
      "Toronto's indoor relative humidity swings from the high teens in winter to above sixty percent in summer — one of the most aggressive annual ranges of any major North American residential market. This paper sets out what that does to wood, the measurements that have to happen before a single board is laid, and the failure modes that appear when any step is skipped.",
    version: '1.0',
    publishedAt: '2026-08-01',
    pages: 13,
    readingMinutes: 9,
    audience: 'Homeowners, designers, general contractors, property managers',
    topics: ['Moisture', 'Acclimation', 'Substrate', 'Installation method', 'Failure modes'],
    pdf: 'ecowoods-toronto-hardwood-climate-moisture-protocol-v1.0-2026-08.pdf',
    sections: [
      {
        id: 'climate-reality',
        heading: "Toronto's climate reality",
        body: [
          'Wood is hygroscopic and anisotropic: it exchanges moisture with the surrounding air continuously, and it moves. Expansion and contraction occur primarily across the grain — length change is minimal, width change is significant and cumulative. Every board arrives with its own moisture history.',
          'The question is never whether a floor will move. It is whether the floor was specified, tested, acclimated and installed to survive decades of that movement.',
        ],
        table: {
          caption: 'Indoor relative humidity, Toronto residential',
          head: ['Condition', 'Relative humidity'],
          rows: [
            ['Winter indoor low', '18–25% RH'],
            ['Summer indoor high', 'above 60% RH'],
            ['Safe operating band for hardwood', '35–55% RH'],
          ],
        },
        callout: {
          label: 'Core truth',
          text: 'Wood will move. The only question is whether the floor was specified, tested, acclimated and installed to survive decades of that movement.',
        },
      },
      {
        id: 'moisture-testing',
        heading: 'Moisture testing — the first non-negotiable',
        body: [
          'A floor installed over a wet subfloor, or with boards that have not equalized, will cup, crown, gap or buckle. There is no warranty language that can override physics.',
        ],
        ordered: [
          'Subfloor moisture content must be measured.',
          'Flooring material moisture content must be measured.',
          "Both readings must sit within the manufacturer's and EcoWoods' acceptable delta.",
          'Testing occurs at the free estimate, and again immediately before installation.',
        ],
      },
      {
        id: 'solid-vs-engineered',
        heading: 'Solid versus engineered in the GTA',
        body: [
          'Solid hardwood is typically 3/4" (19 mm) with a generational wear layer, highly sensitive to RH swings, and best over plywood with a nail-down installation.',
          'Engineered hardwood pairs a real hardwood wear layer with a 90° cross-ply core. That construction is what gives it dimensional stability over concrete, in condominiums, and above radiant heat.',
        ],
        callout: {
          label: 'Position',
          text: 'Engineered is the correct specification for the majority of Toronto projects. We specify what the house can support. We never sell what will fail.',
        },
      },
      {
        id: 'method-and-substrate',
        heading: 'Correct method matched to substrate',
        body: [
          'Installation method is not a preference and not a sales option. It is determined by the substrate, the product construction, and the climate load the floor will face for decades.',
        ],
        table: {
          head: ['Method', 'When it is correct'],
          rows: [
            ['Nail-down', 'Solid hardwood over plywood'],
            ['Glue-down', 'Engineered over concrete, or in condominiums'],
            ['Floating', 'Engineered over radiant, or where acoustic separation is required'],
          ],
        },
      },
      {
        id: 'protocol',
        heading: 'The EcoWoods non-negotiable protocol',
        body: [
          'These steps prevent physical failure, and they are what make a lifetime workmanship warranty something a company can offer and still sleep at night.',
        ],
        ordered: [
          'Moisture testing of subfloor and material, documented.',
          'Minimum 72-hour acclimation in the actual conditioned space.',
          'Correct installation method matched to substrate.',
          'Proper expansion gaps at all fixed objects and walls.',
          'HEPA dust containment throughout the process.',
        ],
      },
      {
        id: 'failure-modes',
        heading: 'What happens when a step is skipped',
        body: [
          'These are not aesthetic issues. They are permanent, visible records of process failure that no amount of later refinishing can fully erase.',
        ],
        bullets: [
          'Cupping — edges higher than the centre of the board',
          'Crowning — centre higher than the edges',
          'Seasonal gapping',
          'Buckling and tenting',
          'Edge peaking and finish failure',
        ],
      },
      {
        id: 'what-to-demand',
        heading: 'What an informed homeowner should demand',
        body: [
          'Any company that cannot or will not provide these is optimizing for speed and lowest bid, not for decades of performance.',
        ],
        ordered: [
          'Written moisture readings of both subfloor and material before any deposit.',
          'Explicit confirmation of minimum 72-hour acclimation in the actual space.',
          'A fixed price in writing, with no open-ended "unforeseen conditions" language.',
          'Confirmation that salaried artisans, not subcontractors, will perform the work.',
          'Lifetime workmanship warranty language in the contract.',
          'Willingness to refuse the job if conditions are wrong.',
        ],
      },
    ],
  },

  {
    slug: 'hardwood-selection-and-cost-framework-gta',
    title: "The Intelligent Homeowner's Decision Framework",
    subtitle: 'How to choose hardwood that performs, appreciates, and never becomes a liability',
    abstract:
      'A decision framework for hardwood in the Greater Toronto Area: installed cost ranges, species hierarchy by Janka hardness, the solid-versus-engineered decision tree, and a checklist for evaluating any installer.',
    summary:
      'Hardwood is one of the few renovations that reliably returns more than it costs — when the physics and the process are both handled correctly. This paper covers what installation actually costs in the GTA, how to choose a species, how the substrate decides the product, and the six questions that separate a competent installer from a cheap one.',
    version: '1.0',
    publishedAt: '2026-08-01',
    pages: 13,
    readingMinutes: 8,
    audience: 'Homeowners planning a renovation, designers, realtors',
    topics: ['Cost', 'Species selection', 'Janka hardness', 'Resale', 'Installer evaluation'],
    pdf: 'ecowoods-hardwood-selection-and-cost-framework-gta-v1.0-2026-08.pdf',
    sections: [
      {
        id: 'roi',
        heading: 'Hardwood as a renovation investment',
        body: [
          'A correctly specified and installed hardwood floor is one of the few renovations that reliably returns more than it costs. It is the strongest visual signal to buyers, and a fixed-price installation removes the change-order risk that makes buyers nervous about a renovated home.',
        ],
        bullets: [
          '70–100%+ cost recovery on resale in the GTA',
          'Strongest visual and emotional signal to buyers',
          'Removes the primary buyer fear: future change orders and failure',
        ],
      },
      {
        id: 'installed-cost',
        heading: 'Installed cost in the GTA',
        body: [
          'These ranges assume professional installation, correct product, and the full protocol. Bargain pricing almost always means skipped moisture testing, shorter acclimation, or subcontracted labour.',
        ],
        table: {
          caption: 'Fully installed pricing, Greater Toronto Area',
          head: ['Scope', 'Range'],
          /* The last three rows are ECOWOODS' OWN published bands and are now
             interpolated from content/constants/pricing.ts. They were typed by
             hand here, which meant a paper — the most quotable document format
             this site publishes, and the one served as a downloadable PDF —
             could state a price the rest of the site had moved away from.

             The first two rows are different in kind: they are GTA MARKET
             figures, not this company's prices, and no source is recorded for
             either. They are registered as market.installedAverage and
             market.installedRange (status: unsourced) in content/claims.ts and
             are left in place pending a citation, because a market figure is
             not ours to change — only to source or withdraw. */
          rows: [
            ['Fully installed, average (GTA market)', '≈ $13 / sq ft'],
            ['Fully installed, typical range (GTA market)', '$8 – $18 / sq ft'],
            [`Screen and recoat (${SCREEN_RECOAT.label})`, `${bandBare(SCREEN_RECOAT)} / sq ft`],
            [`Full sand and finish (${FULL_SAND_FINISH.label})`, `${bandBare(FULL_SAND_FINISH)} / sq ft`],
            ['Premium new install (wide-plank, oil finishes, stairs)', `${bandBare(NEW_INSTALL)} / sq ft`],
          ],
        },
      },
      {
        id: 'species',
        heading: 'Species hierarchy',
        body: [
          'Wide-plank European white oak currently dominates both aesthetics and resale signalling across the Greater Toronto Area. Hardness is only one variable — stability, grain character and finish performance matter equally.',
        ],
        table: {
          caption: 'Janka hardness and role in the GTA',
          head: ['Species', 'Janka', 'Role'],
          rows: [
            ['White oak / European oak', '≈1360', 'Current aesthetic and resale sovereign'],
            ['Hard maple', '1450', 'High-traffic workhorse'],
            ['Red oak (northern)', '≈1290', 'Traditional default'],
            ['Hickory', '1820', 'Extreme durability'],
            ['Black walnut', '1010', 'Luxury accent'],
          ],
        },
      },
      {
        id: 'decision-tree',
        heading: 'Solid versus engineered — the decision tree',
        body: [
          'The substrate decides the product, not the budget and not the preference.',
        ],
        ordered: [
          'Is the substrate plywood over joists? → Solid is possible.',
          'Is the substrate concrete, condo slab, or radiant? → Engineered is required.',
          'Is the home subject to large seasonal RH swings? → Engineered preferred.',
          'Does the client want maximum future refinishing cycles? → Solid, only if the substrate allows.',
        ],
        callout: {
          label: 'Rule',
          text: 'We specify. We never sell what the house cannot support for decades. The correct product is the one that will still look and perform correctly in twenty years.',
        },
      },
      {
        id: 'fixed-price',
        heading: 'What a fixed price actually protects',
        body: [
          'A fixed price is not a marketing slogan. It is proof that the company has already performed the due diligence most installers skip — because it forces them to own every decision before work begins.',
        ],
        bullets: [
          'The number written on the estimate is the number that will be paid',
          'No change orders for "unforeseen conditions" that should have been tested on day one',
          'Removes the renovation anxiety that destroys buyer confidence',
        ],
      },
      {
        id: 'installer-checklist',
        heading: 'How to evaluate any installer',
        body: ['Any "no" answer is a red flag.'],
        ordered: [
          'Do they moisture-test at the free estimate, and document the readings?',
          'Do they require a minimum 72-hour acclimation in the actual space?',
          'Is the price fixed in writing, with no open-ended change-order language?',
          'Are the installers salaried employees, or day-labour subcontractors?',
          'Will they refuse the job if the substrate or conditions are wrong?',
          'Is there a true lifetime workmanship warranty in the contract?',
        ],
      },
      {
        id: 'action-plan',
        heading: 'Homeowner action plan',
        body: [],
        ordered: [
          'Request a free in-home estimate that includes moisture testing and samples.',
          'Insist on a written fixed-price proposal with the full protocol listed.',
          'Confirm that only salaried artisans will perform the work.',
          'Verify the lifetime workmanship warranty language before signing.',
          'Keep indoor RH between 35% and 55% year-round after installation.',
        ],
      },
    ],
  },

  {
    slug: 'hardwood-refinishing-machines-and-sequence',
    title: 'The Craft',
    subtitle: 'The four machines that refinish a hardwood floor, and the order they run in',
    abstract:
      'What each of the four core hardwood refinishing machines does, the progressive grit sequence they run in, and why the order — not the equipment — is what separates a master-level floor from a callback.',
    summary:
      'Belt sander, edger, planetary, buffer. Every professional hardwood refinish in North America runs on these four machines, and every one of them is available to anyone with a rental account. What is rare is the sequence: progressive grits, matched between field and perimeter, refined before finishing, screened between coats. This paper explains each machine, what it can and cannot fix, and what a skipped step looks like years later.',
    version: '1.0',
    publishedAt: '2026-08-17',
    pages: 18,
    readingMinutes: 11,
    audience: 'Homeowners, trade apprentices, designers, property managers',
    topics: ['Belt sander', 'Edger', 'Planetary sander', 'Buffer', 'Grit sequence', 'Dust extraction'],
    pdf: 'ecowoods-hardwood-refinishing-machines-and-sequence-v1.0-2026-08.pdf',
    sections: [
      {
        id: 'the-four-machines',
        heading: 'The four machines',
        body: [
          'Used in sequence with progressive grits and proper dust control, these four machines are the mechanical backbone of every professional hardwood refinish and every site-finished installation.',
          'They are also available to anyone. The machines are not the moat — the sequence, the people running them and the discipline to not skip a stage are.',
        ],
        table: {
          caption: 'The mechanical core of a professional refinish',
          head: ['#', 'Machine', 'What it does'],
          rows: [
            ['1', 'Belt floor sander', 'Levels the open field and removes the old finish'],
            ['2', 'Floor edger', 'Walls, baseboards, closets, stairs, under cabinets'],
            ['3', 'Planetary / multi-disc sander', 'Refines and blends field and perimeter together'],
            ['4', 'Buffer / screening machine', 'Final surface prep and abrasion between finish coats'],
          ],
        },
      },
      {
        id: 'belt-sander',
        heading: '1 — Belt floor sander, the big machine',
        body: [
          'A continuous abrasive belt runs over a cylindrical drum roughly 200 mm (8 inches) wide, with the operator walking behind at a steady pace. It is the primary material-removal machine: it strips old finish, levels high spots, takes out cupping and crowning, and establishes the flat plane every later machine builds on.',
          'It handles roughly 80% of total material removal on a typical refinish. Drum pressure is adjustable in steps, and the standard progression is 36 → 60 → 80/100 grit.',
        ],
        bullets: [
          'Keep it moving. Stopping or hesitating creates a permanent low spot.',
          'Belt tracking and consistent forward speed decide the final quality.',
          'Incorrect technique leaves waves, side-cut marks or chatter that later machines struggle to erase.',
          'Always run with high-efficiency dust extraction.',
        ],
        callout: {
          label: 'Why it matters',
          text: 'The belt sander is the foundation of the mechanical process. Mastery here decides whether the floor looks and performs correctly for decades — nothing downstream fully recovers from a bad first pass.',
        },
      },
      {
        id: 'edger',
        heading: '2 — Floor edger',
        body: [
          'A high-speed rotating disc, typically 150–178 mm (6–7 inches), in a body compact enough to reach walls, baseboards, closets, stairs and the space under cabinets — everywhere the belt sander physically cannot go.',
          'Per square centimetre it is the most aggressive of the four, and it must follow the exact same progressive grit sequence as the field. Corners and detail areas often still need hand scraping or orbital detail sanding afterwards.',
        ],
        bullets: [
          'Edges and transitions are where most low-quality jobs fail visually.',
          'Poor technique leaves swirl marks that are highly visible under a clear finish.',
          'Never edge ahead of the field — always match the grit of the current pass.',
          'Dust control is harder here than on the big machine.',
        ],
        callout: {
          label: 'Why it matters',
          text: 'The edger reveals the true skill level of a crew. The perimeter takes the same protocol as the open field, or the difference shows under finish for the life of the floor.',
        },
      },
      {
        id: 'planetary',
        heading: '3 — Planetary / multi-disc sander',
        body: [
          'Three or more counter-rotating discs mounted on a head that itself rotates. Because the discs spin independently while the head turns, the scratch pattern comes out random and multi-directional rather than aligned to a direction of travel.',
          'This is the refining and blending stage: it erases belt lines, edger swirls and cross-grain scratches, and leaves a uniform microscopic surface so stain and finish absorb evenly. It is particularly valuable on multi-species floors, on mixed hard and soft grain, and on engineered floors where aggressive belt sanding risks cutting through the wear layer.',
        ],
        callout: {
          label: 'Why it matters',
          text: 'This is a refining tool, not a stock-removal machine. Skipping or rushing the planetary pass is one of the most common reasons a floor shows machine marks after finishing — at which point the only fix is to start again.',
        },
      },
      {
        id: 'buffer',
        heading: '4 — Buffer and screening machine',
        body: [
          'A single-disc rotary machine with a large drive plate, typically 16–20 inches (400–500 mm), fitted with fine mesh screens around 100–150 grit or with abrasive pads. It removes microns, not wood.',
          'It does two jobs: final screening before the first coat of finish, and intercoat abrasion between successive coats. Both exist to create a uniform microscopic scratch pattern so the next layer of finish bonds properly.',
        ],
        bullets: [
          'Mandatory between coats on multi-coat water-based systems.',
          'Screening is light abrasion — excessive pressure or dwell burnishes the surface or leaves swirl.',
          'Keep the machine moving in overlapping passes.',
          'It does not correct bad sanding. It only prepares a correctly sanded floor.',
        ],
      },
      {
        id: 'sequence',
        heading: 'The full sequence',
        body: [
          'Any skipped step is a future liability, and most of them are invisible on handover day.',
        ],
        ordered: [
          'Moisture testing and acclimation — minimum 72 hours in the actual conditioned space.',
          'Belt sander, progressive grits, field only.',
          'Edger, matching grits, on every perimeter and detail.',
          'Planetary / multi-disc, refining and blending field into edges.',
          'Buffer / screening for a final uniform surface.',
          'Vacuum, tack, apply the finish system.',
          'Intercoat screening with the buffer between coats.',
          'Final coat.',
        ],
      },
      {
        id: 'equipment-is-not-the-moat',
        heading: 'Equipment is not the difference',
        body: [
          'Every machine in this paper can be rented in the Greater Toronto Area this afternoon. What cannot be rented is the sequence being followed when nobody is watching, on the section behind the door, at the end of a long day.',
        ],
        table: {
          head: ['', 'Market average', 'What the protocol requires'],
          rows: [
            ['Bid', 'Lowest', 'Fixed in writing'],
            ['Labour', 'Subcontracted', 'Salaried artisans'],
            ['Moisture testing', 'Optional', 'The first gate — before any deposit'],
            ['Optimised for', 'Speed', 'Zero callbacks'],
          ],
        },
        callout: {
          label: 'The point',
          text: 'The machines are available to everyone. The combination of machines, trained people and documented restraint is what is rare — and it is the only thing a floor can still prove twenty years later.',
        },
      },
    ],
  },
  {
    slug: 'where-toronto-hardwood-comes-from',
    title: 'Provenance',
    subtitle: 'Where the hardwood installed in Toronto actually comes from',
    abstract:
      'The forest, the mill and the paperwork behind a Toronto hardwood floor — what the Government of Ontario, the NWFA, the USDA Forest Products Laboratory and the manufacturers themselves publish, and an explicit register of what none of them publish at all.',
    summary:
      'A floor is a forest product with a supply chain, and almost nothing written for homeowners about that chain is sourced. This paper reconstructs it from primary documents only: Ontario’s own forest inventory, the province’s silvicultural guides, the manufacturers’ own disclosures, and the federal legality instruments. It ends with the longest section in the paper — the list of things we looked for and could not source, published so that nobody has to take the rest on trust.',
    version: '1.0',
    publishedAt: '2026-08-27',
    pages: 18,
    readingMinutes: 14,
    audience: 'Homeowners, architects, designers, specifiers, general contractors, property managers',
    topics: ['Provenance', 'Ontario forest', 'Species supply', 'Manufacturing', 'Certification', 'Evidence limits'],
    pdf: 'ecowoods-where-toronto-hardwood-comes-from-v1.0-2026-08.pdf',
    sections: [
      {
        id: 'why-provenance',
        heading: 'Why provenance is a specification question, not a sentiment',
        body: [
          'Provenance usually arrives in flooring conversations as a feeling: local is good, imported is suspect, sustainable is a logo. None of that survives contact with a floor that has to hold a Toronto winter for thirty years.',
          'Provenance is a specification question for three concrete reasons. The species available to you is set by what grows and what is cut, and that is a published number, not a preference. The grade you are sold is set by a rulebook written by a body that is not your contractor. And the moisture content the boards arrive at is set at the mill, before anyone in your house has a say in it — the NWFA standard puts that at 6% to 9% moisture content, with a 5% allowance for pieces outside that range up to 12%.',
          'Everything downstream of those three facts is negotiable. None of the three is. So the honest way to talk about where your floor comes from is to go and read what the forest service, the grading bodies and the mills actually publish, and to say plainly where that record stops.',
        ],
        callout: {
          label: 'The rule this paper follows',
          text: 'Every figure below was read from a document published by the organisation named beside it, on 27 August 2026. Where we could not source something, it is not softened or estimated — it is listed in the register at the end.',
        },
      },
      {
        id: 'ontario-forest',
        heading: 'The Ontario forest, in the numbers the province publishes',
        body: [
          'Ontario publishes its forest inventory, and it is very large. The province states that Ontario has 70.4 million hectares of forest, which it puts at 4.8 hectares of forest for every Ontarian. A second provincial page, updated more recently, states 70.5 million hectares and 66% of Ontario. We publish both and average neither; the discrepancy is the province’s, not ours.',
          'The harvest is a small fraction of the standing resource and a fraction of what is permitted. Over 2009 to 2019, on average 121,000 hectares was harvested per year resulting in 13 million cubic metres of wood, which the province records as 44% of the approved area and volume that was available to harvest. In 2024, 113,000 hectares of forest was harvested, representing 40% of the approved area, yielding 11.4 million cubic metres.',
          'Almost none of that is your floor. Ontario’s 2024 harvest by species was spruce 41%, jack pine 28% and poplar 16% — softwoods and a pulpwood hardwood, cut principally for lumber and pulp. The hardwoods that become flooring live in the residual, which the province does not break out.',
        ],
        table: {
          caption: 'Ontario productive forest by ownership (Forest Resources of Ontario 2021)',
          head: ['Ownership category', 'Area'],
          rows: [
            ['Managed Crown forest', '27.8 million hectares'],
            ['Unmanaged Crown forest', '15.8 million hectares'],
            ['Parks and protected areas', '6.1 million hectares'],
            ['Private and other', '6.6 million hectares'],
          ],
        },
      },
      {
        id: 'tolerant-hardwoods',
        heading: 'The seven tolerant hardwoods — and which flooring species are not on the list',
        body: [
          'Ontario groups the hardwoods that hold a closed canopy as "tolerant hardwoods", and its silvicultural guide names seven principal species: sugar maple, American beech, yellow birch, red oak, white ash, black cherry and basswood. The 1998 guide describes them as distributed on more than 3.6 million hectares with a gross total volume of 562 million cubic metres, including hemlock. The 2021 provincial inventory records the tolerant hardwood forest type at 2,565,209 hectares, of which 1,215,664 hectares are Crown managed.',
          'Those two extents are twenty-three years apart, measured on different bases, and they are not reconcilable from the documents themselves. We quote both.',
          'Read that species list against the six hardwoods a Toronto homeowner is actually shown, and the interesting result is what is missing. Red oak, hard maple and white ash are principal Ontario tolerant hardwoods. White oak, hickory and black walnut are not on that list — all three grow in Ontario, and Ontario’s own tree atlas says so, but none is a named principal commercial tolerant hardwood and none appears as a separate line in the growing-stock table we read.',
          'That is evidence of non-prominence. It is not evidence of zero harvest, and we decline to convert the one into the other.',
        ],
        bullets: [
          'White oak is found in Southern Ontario; Ontario lists its wood use as lumber for furniture and flooring.',
          'Red oak is found east of Lake Superior and across Central and Southern Ontario.',
          'Sugar maple is found in Central, Southern and parts of Northwestern Ontario, and Ontario names flooring as a use.',
          'White ash is found throughout Southern Ontario and north to Lake Nipissing and Sault Ste. Marie.',
          'Shagbark hickory grows in Southern Ontario, including along the St. Lawrence River and into Quebec.',
          'Black walnut is a common species in moist, low-lying areas in Southwestern Ontario, often planted beyond its range.',
        ],
      },
      {
        id: 'growing-stock',
        heading: 'Growing stock, by species',
        body: [
          'Growing stock is the volume of wood standing in the forest. Ontario publishes it by species, and the ordering is the single most useful provenance fact available to an Ontario homeowner, because it says which species the province could keep supplying without importing anything.',
          'Sugar maple dominates: 300,361,212 cubic metres, the largest of any Ontario flooring hardwood, and the province separately describes it as roughly 3% of Ontario’s managed forest and the most common tree in the Great Lakes–St. Lawrence and Deciduous Forest regions. Red oak follows at 85,019,702 cubic metres and yellow birch at 82,005,013. Ash, as a group, stands at 42,273,003 and basswood at 18,444,080.',
          'For scale rather than for flooring: white birch is recorded at 475,521,667 cubic metres and poplar at 1,187,029,219. Those are pulp and panel species, and their size is a reminder that the flooring hardwoods are a minority interest inside a working forest built around something else.',
        ],
        table: {
          caption: 'Ontario gross total growing-stock volume, selected species (Forest Resources of Ontario 2021)',
          head: ['Species', 'Gross total volume', 'Used for flooring in the GTA'],
          rows: [
            ['Sugar maple', '300,361,212 m³', 'Yes — hard maple'],
            ['Red oak', '85,019,702 m³', 'Yes'],
            ['Yellow birch', '82,005,013 m³', 'Occasionally'],
            ['Ash (group)', '42,273,003 m³', 'Yes — under decline pressure'],
            ['Basswood', '18,444,080 m³', 'No'],
          ],
        },
        callout: {
          label: 'What this does not tell you',
          text: 'Growing stock is what stands, not what is cut. Ontario does not publish a hardwood-specific harvest volume, and the species split it does publish stops at spruce, jack pine and poplar. Anyone quoting an Ontario hardwood harvest figure should be asked where they got it.',
        },
      },
      {
        id: 'selection-system',
        heading: 'How Ontario cuts them: the selection system',
        body: [
          'Tolerant hardwood is not clear-cut in Ontario. The province’s silviculture guide defines the selection system as periodic partial harvests timed on basal-area recruitment, using vigour, risk and species preference to choose which trees are taken and which are kept.',
          'The result it specifies is an all-aged future forest, with regeneration established under at least 70% residual cover — roughly 30% or less full sunlight — and dense mature forest cover maintained in perpetuity. The same guide records that residual trees in a selection harvest may be retained for multiple cutting cycles totalling 100 years or more.',
          'Sugar maple is described by the province as amenable to the single-tree selection silvicultural system, which is one reason it is both the largest growing stock and a species that can be cut without opening the canopy.',
          'This matters to a floor for an unromantic reason. A stand managed on 100-year cutting cycles produces slow, even growth, and slow even growth is what produces the tight, consistent grain that grades well and machines well. The silviculture and the grade are the same fact seen at two ends of the chain.',
        ],
      },
      {
        id: 'manufacturing',
        heading: 'Where the mills are: Quebec, and one in Ontario',
        body: [
          'The heaviest hardwood-flooring manufacturing capacity serving the Greater Toronto Area is in Quebec, and it is vertically integrated — the same company owns the sawmill, the kilns and the finishing line.',
          'Mercier states that it has been vertically integrated for over twenty years, that its Drummondville, Quebec sawmill provides its own raw lumber and houses kiln drying units and production lines, and that Montmagny handles finishing from stain application to delivery. Lauzon, founded 1985 at Papineauville, operates five Quebec sites and describes its Thurso sawmill as the largest hardwood sawmill in Canada. Preverco, founded 1988, runs a sawmill at Daveluyville with plants at Boisbriand and Saint-Augustin-de-Desmaures. Mirage has manufactured since 1983; Wickham has been in business over thirty-five years.',
          'Ontario contributed exactly one named flooring manufacturer to this search. Superior Flooring, trading as Herwynen Sawmill Limited, mills at Rockwood, Ontario, began in 1986 producing rough-cut lumber on land severed from the family farm, and lists five species: ash, hickory, maple, red oak and white oak.',
          'The most completely traceable Toronto supply chain we could document runs entirely inside Ontario: Herwynen mills and prefinishes at Rockwood, the NWFA lists Superior Hardwood Flooring / Herwynen Saw Mill Ltd. as a NOFMA-certified factory-finished solid manufacturer, and the brand appears stocked at Canadian Flooring on Steeles Avenue West in North York. Every link in that chain is on a page we opened. What no source anywhere told us is where Herwynen’s logs come from.',
        ],
        table: {
          caption: 'Vertically integrated hardwood flooring manufacturers serving the GTA, from their own disclosures',
          head: ['Manufacturer', 'Sawmill', 'Other plants', 'Stated since'],
          rows: [
            ['Mercier', 'Drummondville, QC', 'Montmagny, QC (finishing)', 'Founded over 45 years ago'],
            ['Lauzon', 'Thurso, QC', 'Maniwaki, Papineauville, Saint-Norbert, QC', '1985'],
            ['Preverco', 'Daveluyville, QC', 'Boisbriand, Saint-Augustin-de-Desmaures, QC', '1988'],
            ['Mirage (Boa-Franc)', 'Not stated on the page read', 'Quebec', '1983'],
            ['Superior / Herwynen', 'Rockwood, ON', 'Rockwood, ON (prefinishing)', '1986'],
          ],
        },
      },
      {
        id: 'chain',
        heading: 'Log to floor: the chain, reconstructed',
        body: [
          'No single publication describes the Canadian log-to-floor chain end to end. We looked. What exists is each company’s account of its own segment, plus the Quebec Wood Export Bureau’s process listings — sawing, kiln drying, planing and container loading — across more than 125 manufacturers.',
          'Assembled from those disclosures, the chain has six links, and a floor can fail at any of them before a contractor ever sees it.',
        ],
        ordered: [
          'Standing timber, cut under a silvicultural system — in Ontario tolerant hardwood, the selection system, on cutting cycles measured in decades.',
          'Sawmill: the log is broken down into boards, and the NHLA yield grade of each board is fixed here and never improves afterwards.',
          'Kiln: the boards are dried to a target moisture content. The NWFA standard puts manufactured flooring at 6% to 9% moisture content.',
          'Flooring mill: boards are milled to profile — tongue, groove and back relief — and graded a second time, on appearance, under the NWFA/NOFMA rules.',
          'Finishing line or unfinished pack-out, then distribution to a regional wholesaler.',
          'Site: acclimation to the actual building, moisture testing of the subfloor, and installation. This is the first link the homeowner controls, and the last one that can save the five before it.',
        ],
        callout: {
          label: 'Where the chain usually breaks in Toronto',
          text: 'Not at the forest. A board can be perfectly graded, correctly kiln-dried to 7% and still cup within a season if it was laid against an untested subfloor. The provenance chain hands you a good board; only the site protocol turns it into a floor.',
        },
      },
      {
        id: 'certification',
        heading: 'Certification, legality and what the marks actually certify',
        body: [
          'Canada certifies a very large share of its forest. The Forest Products Association of Canada publishes 154 million hectares of certified forest land in Canada across FSC, PEFC and SFI, puts Canada at 38% of the world’s certified forest, and notes that 10% of the world’s forests are certified at all.',
          'In Ontario, the provincial picture is published as unit counts rather than hectares. As of December 2020, 26.1 million hectares were certified — 29 of 39 management units, equating to 77% of the public lands and waters within management units. Of those: 13 units FSC, 9 SFI, 6 dual FSC and SFI, 1 CSA, and 10 uncertified.',
          'Legality is a separate instrument from sustainability. Canada’s Wild Animal and Plant Protection and Regulation of International and Interprovincial Trade Act prohibits the import of plant products taken or transported in contravention of foreign law; the United States Lacey Act prohibits trade in illegally sourced timber products. Natural Resources Canada states plainly that the risk of illegal logging is negligible in all regions of Canada.',
          'For engineered flooring, the relevant instrument is an emissions limit on the core rather than a forest mark. Under US TSCA Title VI, tested to ASTM E1333-14, hardwood plywood is limited to 0.05 ppm formaldehyde, medium-density fibreboard to 0.11 ppm, thin MDF to 0.13 ppm and particleboard to 0.09 ppm, for product sold, supplied, offered for sale or manufactured on or after 1 June 2018 in the United States. The EPA states it worked with the California Air Resources Board so the national rule was consistent with California’s.',
        ],
        callout: {
          label: 'A limit we will not overstate',
          text: 'Those formaldehyde limits are United States law. We looked for and did not find a Canadian federal instrument setting an equivalent limit, so we do not tell you that TSCA Title VI binds product sold in Canada. Ask a supplier for the certificate rather than assuming a jurisdiction.',
        },
      },
      {
        id: 'ash',
        heading: 'The one species being cut faster than it grows',
        body: [
          'Across the six hardwoods used for flooring in this market, five show annual growth at roughly double annual harvest in the American Hardwood Export Council’s inventory: red oak 60.6 against 31.9 million cubic metres a year, white oak 40.1 against 20.1, hard maple 19.1 against 10.2, hickory 14.6 against 6.0, black walnut 4.8 against 1.9.',
          'White ash is inverted. Growth 3.3 million cubic metres a year against harvest 6.9. It is the only one of the six in that position.',
          'The reason is not demand. The emerald ash borer was first detected near Detroit, Michigan and Windsor, Ontario in 2002, and up to 99% of ash trees are killed within eight to ten years of its establishment. Standing ash is being salvaged ahead of an insect, and the harvest figure is what that salvage looks like in a table.',
          'The specification consequence is narrow and real. Ash is a beautiful, hard, pale floor at 1,320 lbf. It is also the one species in this set whose supply is contracting for a reason unrelated to how well it performs, and a homeowner choosing it should be told that rather than discovering it at the reorder.',
        ],
      },
      {
        id: 'not-published',
        heading: 'What nobody publishes',
        body: [
          'This is the section that makes the rest of the paper worth reading. Everything below was searched for and not found in any document we could open. It is published deliberately, because the alternative — filling the gaps with plausible sentences — is what the rest of this industry does.',
        ],
        bullets: [
          'Ontario’s annual hardwood harvest volume. The province publishes the total and a species split covering spruce, jack pine and poplar only; the residual is not broken out.',
          'An Ontario annual allowable cut for hardwood specifically. Only an undifferentiated percentage of approved area is published.',
          'The Crown-versus-private split of Ontario hardwood harvest volume. The area split exists; the volume split does not.',
          'Cutting-cycle length in years for Ontario tolerant hardwood selection harvest. The 2019 guide says only "multiple cutting cycles totalling 100+ years".',
          'Residual basal-area targets in square metres per hectare after selection harvest in Ontario.',
          'FSC-certified and SFI-certified hectares in Ontario. Only unit counts are published.',
          'The proportion of hardwood flooring sold in Canada that is imported versus domestically manufactured. No flooring sub-industry is broken out under NAICS 321, and every remaining source was a paywalled market-research vendor.',
          'Any dataset of GTA or Ontario installed flooring by species.',
          'Any authority for the very common claim that red oak dominates Ontario housing stock historically. We found abundant blog content asserting it and no source. We do not publish it.',
          'Ontario growing-stock volumes for white oak, hickory and black walnut, and whether they are commercially harvested in Ontario at all.',
          'A Canadian federal formaldehyde emission limit for composite wood cores.',
          'Published wear-layer thickness ranges for engineered flooring, as distinct from the refinishable thresholds.',
          'How many refinishing cycles an engineered floor supports. The NWFA’s own article declines to quantify it.',
          'Kiln schedules or drying times for Ontario hardwood.',
          'Any statute or regulation making NHLA or NWFA rules mandatory in Canada. On the evidence we have, both are voluntary trade-association standards.',
        ],
        callout: {
          label: 'How to use this list',
          text: 'If a supplier, a showroom or an assistant gives you a confident number for anything on this list, ask which document it came from. We could not find one, and we looked on 27 August 2026.',
        },
      },
      {
        id: 'what-to-ask',
        heading: 'What to ask, before you buy',
        body: [
          'Provenance becomes useful the moment it turns into a question a supplier has to answer in writing. These are the six that change what arrives on your floor.',
        ],
        ordered: [
          'Which species, botanically — not "oak" but red oak or white oak. They are different woods with different hardness, different grain and different supply.',
          'Which flooring grade, under which rulebook, named on the quote. NWFA/NOFMA Clear, Select, No. 1 Common and No. 2 Common are appearance grades with published permissions.',
          'What moisture content the material leaves the mill at, and what it reads on arrival at your house.',
          'For engineered: the wear-layer thickness at its thinnest point, and whether the product meets the NWFA refinishable thresholds of 3.2 mm unfinished or 2.5 mm factory-finished.',
          'For engineered: which emission standard the core is certified to, and by whom.',
          'Who milled it and where. A vertically integrated manufacturer can answer this in one sentence; a repackager cannot answer it at all.',
        ],
        callout: {
          label: 'Why we publish this',
          text: 'Every question above is one a customer can use against us as easily as against anyone else. That is the point. A market where those six questions are normal is a market where doing the work properly is finally worth more than describing it well.',
        },
      },
    ],
    references: [
      {
        org: 'Government of Ontario, Ministry of Natural Resources',
        title: "State of Ontario's Natural Resources — Forest 2021",
        url: 'https://www.ontario.ca/page/state-ontarios-natural-resources-forest-2021',
        readAt: '2026-08-27',
      },
      {
        org: 'Government of Ontario',
        title: 'Forest management facts and figures',
        url: 'https://www.ontario.ca/page/forest-management-facts-and-figures',
        readAt: '2026-08-27',
      },
      {
        org: 'Government of Ontario',
        title: "Forest Resources of Ontario 2021 — Ontario's landbase",
        url: 'https://www.ontario.ca/document/forest-resources-ontario-2021/ontarios-landbase',
        readAt: '2026-08-27',
      },
      {
        org: 'Government of Ontario',
        title: 'Forest Resources of Ontario 2021 — Growing stock volumes',
        url: 'https://www.ontario.ca/document/forest-resources-ontario-2021/growing-stock-volumes',
        readAt: '2026-08-27',
      },
      {
        org: 'Ontario Ministry of Natural Resources',
        title: 'A Silvicultural Guide for the Tolerant Hardwood Forest in Ontario',
        url: 'https://docs.ontario.ca/documents/2820/siv-guide-tolerant-hardwood.pdf',
        readAt: '2026-08-27',
      },
      {
        org: 'Ontario Ministry of Natural Resources',
        title: 'Forest Management Guide to Silviculture in the Great Lakes–St. Lawrence and Boreal Forests of Ontario',
        url: 'https://www.ontario.ca/page/forest-management-guide-silviculture-great-lakes-st-lawrence-and-boreal-forests-ontario',
        readAt: '2026-08-27',
      },
      {
        org: 'Ontario Biodiversity Council',
        title: "State of Ontario's Biodiversity — Forest certification",
        url: 'https://sobr.ca/indicator/forest-certification/',
        readAt: '2026-08-27',
      },
      {
        org: 'Forest Products Association of Canada',
        title: 'Forest management certifications',
        url: 'https://www.fpac.ca/forest-management-certifications',
        readAt: '2026-08-27',
      },
      {
        org: 'Natural Resources Canada',
        title: 'Legality and sustainability of Canadian forest products',
        url: 'https://natural-resources.canada.ca/forests-forestry/sustainable-forest-management/legality-sustainability',
        readAt: '2026-08-27',
      },
      {
        org: 'US Environmental Protection Agency / eCFR',
        title: '40 CFR § 770.10 — Formaldehyde emission standards',
        url: 'https://www.ecfr.gov/current/title-40/part-770/section-770.10',
        readAt: '2026-08-27',
      },
      {
        org: 'American Hardwood Export Council',
        title: 'A Guide to Sustainable American Hardwoods',
        url: 'https://www.americanhardwood.org/sites/default/files/publications/download/2021-05/8168_AHEC_Species_Guide_March21_update_DIGITAL_Spreads_AW_01_compressed.pdf',
        readAt: '2026-08-27',
      },
      {
        org: 'Invasive Species Centre',
        title: 'Emerald ash borer',
        url: 'https://www.invasivespeciescentre.ca/invasive-species/meet-the-species/invasive-insects/emerald-ash-borer-duplicate-471/',
        readAt: '2026-08-27',
      },
      {
        org: 'Quebec Wood Export Bureau',
        title: 'Hardwood Lumber & Flooring Manufacturer Directory, October 2025',
        url: 'https://quebecwoodexport.com/wp-content/uploads/2022/09/REPHardwood_9x6_imp_Oct25_v1.pdf',
        readAt: '2026-08-27',
      },
      {
        org: 'National Wood Flooring Association',
        title: 'NWFA/NOFMA certified manufacturers',
        url: 'https://nwfa.org/nofma-manufacturers/',
        readAt: '2026-08-27',
      },
    ],
  },
  {
    slug: 'hardwood-grading-standards-nhla-nwfa',
    title: 'Grade',
    subtitle: 'The two grading systems behind every hardwood floor, and what each one actually promises',
    abstract:
      'A hardwood floor is graded twice by two different bodies under two different logics — once as lumber on yield, once as flooring on appearance — and almost every quote in this market names neither. This paper publishes both rulebooks side by side.',
    summary:
      'The National Hardwood Lumber Association grades a board by how much clear material it will yield. The NWFA/NOFMA flooring standard grades a finished board by how it looks, and states outright that all grades are equally strong. Confusing the two is how a homeowner ends up paying a Clear price for a No. 1 Common floor and having no document to point at. This paper sets out what each grade permits, as published.',
    version: '1.0',
    publishedAt: '2026-08-27',
    pages: 16,
    readingMinutes: 12,
    audience: 'Homeowners, designers, specifiers, general contractors, estimators',
    topics: ['NHLA', 'NWFA/NOFMA', 'Grading', 'Moisture content', 'Engineered construction', 'Emissions'],
    pdf: 'ecowoods-hardwood-grading-standards-nhla-nwfa-v1.0-2026-08.pdf',
    sections: [
      {
        id: 'two-systems',
        heading: 'Two systems, two bodies, two logics',
        body: [
          'There are two grading systems in the life of a hardwood floor and they measure different things. They are published by different organisations, in separate documents, and the flooring standard does not cross-reference the lumber rules at all.',
          'The National Hardwood Lumber Association grades lumber. It describes itself as the official governing body responsible for developing, maintaining and interpreting the hardwood lumber grading rules in North America, and has done so for more than 125 years. An NHLA grade answers one question: how much clear, usable material will this board yield when it is cut up.',
          'The National Wood Flooring Association, through the NOFMA standard, grades finished flooring. Its logic is the opposite, and the standard says so in a single sentence that should be printed on every showroom wall: appearance alone determines the grades of hardwood flooring since all grades are equally strong and serviceable in any application.',
          'So a lumber grade is a statement about yield, and a flooring grade is a statement about looks. Neither is a statement about strength. A No. 2 Common floor is not a weak floor; it is a floor with more character marks, and the NWFA describes it as most desirable where numerous notable character marks and prominent colour contrast are wanted.',
        ],
        callout: {
          label: 'The commercial consequence',
          text: 'A quote that says "premium oak" names neither system and commits to nothing. A quote that says "NWFA/NOFMA Select, white oak" is a specification you can hold someone to.',
        },
      },
      {
        id: 'nhla-yield',
        heading: 'NHLA: a grade is a yield of clear cuttings',
        body: [
          'The NHLA rulebook effective 1 January 2023 sets each grade as a combination of minimum board size, minimum cutting size, and a required clear-face yield expressed in twelfths.',
          'FAS — the top grade, from the historical "Firsts and Seconds" — requires boards 6 inches and wider, 8 to 16 feet long, a minimum cutting of 4 inches by 5 feet or 3 inches by 7 feet, and a clear-face yield of 83-1/3%, written as 10/12. FAS One Face grades not below FAS on the better face with the reverse not below No. 1 Common. Selects drop the width to 4 inches and wider at 6 to 16 feet.',
          'Below that the yield steps down in clear increments: No. 1 Common at 66-2/3% or 8/12, from boards 3 inches and wider admitting 5% of 3-inch widths; No. 2A Common at 50%, or 6/12, on a minimum cutting of 3 inches by 2 feet; No. 3A Common at 33-1/3%, or 4/12.',
          'The important structural fact is that this grade is fixed at the sawmill and never improves. A No. 1 Common board is not upgraded by a good finish; it is a board with a known clear yield, and everything a flooring mill does downstream works within that.',
        ],
        table: {
          caption: 'NHLA hardwood lumber grades (2023 rulebook)',
          head: ['Grade', 'Board minimum', 'Minimum cutting', 'Clear-face yield'],
          rows: [
            ['FAS', '6" and wider, 8–16 ft', '4"×5 ft or 3"×7 ft', '83-1/3% (10/12)'],
            ['FAS One Face', '6" and wider, 8–16 ft', '4"×2 ft or 3"×3 ft', 'FAS on better face'],
            ['Selects', '4" and wider, 6–16 ft', '4"×3 ft or 3"×6 ft', 'FAS on better face'],
            ['No. 1 Common', '3" and wider, 4–16 ft', '4"×2 ft or 3"×3 ft', '66-2/3% (8/12)'],
            ['No. 2A Common', '3" and wider, 4–16 ft', '3"×2 ft', '50% (6/12)'],
            ['No. 3A Common', '3" and wider, 4–16 ft', '3"×2 ft', '33-1/3% (4/12)'],
          ],
        },
      },
      {
        id: 'nwfa-appearance',
        heading: 'NWFA/NOFMA: a grade is an appearance',
        body: [
          'The NWFA/NOFMA International Standards for Unfinished Solid Wood Flooring, revised April 2018, replaced all editions of the Official Flooring Grading Rules previously published by the Wood Flooring Manufacturers Association. It grades by species group, because the same character mark means different things in oak and in maple.',
          'For oak the ladder runs Clear, Select, No. 1 Common, No. 2 Common. Clear is a heartwood-dominant product allowing minimal character marks — it still permits up to 3/8 inch of bright sapwood along the full length, small burls, fine pin worm holes, tight checks and occasional thin brown streaks. Select permits unlimited sound sapwood, one small tight knot per 3 feet, slightly open checks and intermittent machine burns not exceeding a quarter inch.',
          'No. 1 Common admits open characters such as checks and knot holes, provided they are sound and fillable, and excludes broken knots over half an inch and splits through the piece. No. 2 Common accepts sound natural forest variations and manufacturing imperfections while prohibiting shattered or rotten ends, large broken knots, shake and advanced rot.',
          'For hard maple, beech and birch the top grade is Select & Better: a nearly defect-free face with natural colour variation permitted, allowing occasional pin knots to 1/8 inch, dark green or black spots to a quarter inch by 3 inches, bird’s eyes and small burls. The equivalent ladder continues through No. 1 Common and No. 2 Common, the latter defined as flooring that must provide serviceable flooring with firm wood.',
        ],
        table: {
          caption: 'NWFA/NOFMA oak flooring grades — what each permits, as published',
          head: ['Grade', 'What it permits'],
          rows: [
            ['Clear', 'Heartwood-dominant, minimal character. Up to 3/8" bright sapwood full length, small burls, fine pin worm holes, tight checks, occasional thin brown streaks.'],
            ['Select', 'Unlimited sound sapwood, one small tight knot per 3 ft, pin worm holes, burls, slightly open checks, two flag worm holes per 8 ft, machine burns to 1/4" wide.'],
            ['No. 1 Common', 'Open characters — checks and knot holes — that are sound and fillable. Excludes broken knots over 1/2" and splits through the piece. Sticker stain permitted.'],
            ['No. 2 Common', 'Sound natural forest variations and manufacturing imperfections. Prohibits shattered ends, large broken knots, shake and advanced rot.'],
          ],
        },
        callout: {
          label: 'Grade is not quality',
          text: 'The standard is explicit that all grades are equally strong and serviceable in any application. Choosing No. 2 Common is an aesthetic decision about character, not a compromise on the floor.',
        },
      },
      {
        id: 'moisture-at-manufacture',
        heading: 'Moisture content, fixed at the mill',
        body: [
          'The same standard sets the moisture content flooring is manufactured at: 6% to 9%, with a 5% allowance for pieces outside that range up to 12%.',
          'That is a manufacturing specification, not a site condition, and the gap between the two is where most Toronto floor failures live. The NWFA installation guidance puts the interior operating environment at 30 to 50 percent relative humidity and 60 to 80 degrees Fahrenheit, and sets the permitted difference between properly acclimated flooring and subfloor at no more than 4 percentage points for strip under 3 inches, and no more than 2 for wide-width flooring 3 inches or wider. It also asks for a minimum of 20 moisture readings per 1,000 square feet, averaged.',
          'We attribute those last three figures carefully. They come from copies of the NWFA installation guidelines hosted by third parties and dated 2007 to 2008; the current guidelines are members-only. The 6% to 9% manufactured range, by contrast, is from an NWFA-hosted document revised April 2018.',
        ],
        callout: {
          label: 'Where a grade stops helping you',
          text: 'A Clear-grade board delivered at 8% moisture content into a house sitting at 22% relative humidity will still gap. The grade governs what the board looks like. Only the site protocol governs whether it stays that way.',
        },
      },
      {
        id: 'dimensions',
        heading: 'Thickness, strip, plank, wide plank',
        body: [
          'The standard also fixes the vocabulary that quotes use loosely. Unfinished solid flooring thickness is .750 inches, or 19.05 mm, with a tolerance of plus or minus .015 inches — .38 mm.',
          'Width names are defined, not descriptive. Strip is less than 3 inches, or 76.2 mm. Plank is 3 to 5 inches. Wide plank is greater than 5 inches. A showroom describing a 4-inch board as wide plank is using a word the standard has already defined differently.',
        ],
        table: {
          caption: 'Solid flooring dimensional definitions (NWFA/NOFMA, April 2018)',
          head: ['Term', 'Definition'],
          rows: [
            ['Thickness', '.750" (19.05 mm), ± .015" (.38 mm)'],
            ['Strip', 'Less than 3" (76.2 mm)'],
            ['Plank', '3" to 5"'],
            ['Wide plank', 'Greater than 5"'],
          ],
        },
      },
      {
        id: 'engineered',
        heading: 'Engineered construction, and the refinishable thresholds',
        body: [
          'The Environmental Product Declaration published jointly by the Decorative Hardwoods Association and the NWFA describes engineered wood flooring as normally made using multiple wood veneers or slats of wood glued together under pressure at opposing directions, or a variety of composites for core material such as MDF, with a finished thickness ranging from 3/8 inch to 3/4 inch.',
          'The same document records that red oak and white oak are the dominant species in the US hardwood forests and therefore comprise the majority of engineered hardwood flooring production — which is the clearest published statement available of why the engineered market looks the way it does.',
          'The number that decides whether an engineered floor is an asset or a consumable is the wear layer. The NWFA Refinishable programme sets the thresholds: 3.2 mm — 4/32 inch — for unfinished smooth, 2.5 mm — 3/32 inch — for factory-finished smooth, and 2.5 mm at the lowest point for sculpted or distressed product. Refinishing is defined there as sanding a previously finished floor to bare wood and applying new stain or finish.',
          'What is not published anywhere we could find is how many refinishing cycles an engineered floor supports. The NWFA’s own article declines to quantify it: it notes that a sanding removes about 1/32 inch and that the floor remains refinishable once more, and stops. Anyone quoting you a cycle count is quoting themselves.',
        ],
        table: {
          caption: 'NWFA refinishable wear-layer thresholds',
          head: ['Product', 'Minimum wear layer'],
          rows: [
            ['Unfinished, smooth', '3.2 mm (4/32")'],
            ['Factory-finished, smooth', '2.5 mm (3/32")'],
            ['Sculpted or distressed', '2.5 mm (3/32") at the lowest point'],
          ],
        },
      },
      {
        id: 'emissions',
        heading: 'What the core is certified to',
        body: [
          'An engineered board has a core, and the core is a composite panel governed by emissions law rather than by flooring rules.',
          'Under US TSCA Title VI, based on test method ASTM E1333-14, the limits are 0.05 ppm for hardwood plywood with a veneer or composite core, 0.11 ppm for medium-density fibreboard, 0.13 ppm for thin MDF and 0.09 ppm for particleboard, applying to product sold, supplied, offered for sale or manufactured — including imported — on or after 1 June 2018 in the United States. The EPA states that it worked with the California Air Resources Board to help ensure the final national rule was consistent with California’s requirements.',
          'ANSI/HPVA HP-1-2024, approved 20 August 2024, covers the principal types, face grades, back grades, inner ply grades and constructions of plywood made primarily with hardwood faces, describing constructions with an odd number of plies where all inner plies except the innermost occur in pairs. Its scope does not name flooring.',
          'We found no Canadian federal instrument setting an equivalent formaldehyde limit, and we do not assert that TSCA Title VI binds product sold in Canada. Ask for the certificate.',
        ],
      },
      {
        id: 'canada',
        heading: 'What applies in Canada',
        body: [
          'The Canadian Hardwood Bureau states that hardwood lumber grading standards in Canada are published and overseen by the National Hardwood Lumber Association. For flooring, the operative evidence is behavioural: Canadian mills certify to the American standard.',
          'The NWFA lists Lauzon Distinctive Hardwood Flooring of Papineauville, Quebec as a NOFMA-certified manufacturer of unfinished solid and factory-finished solid flooring, and Superior Hardwood Flooring / Herwynen Saw Mill Ltd. of Rockwood, Ontario as a NOFMA-certified factory-finished solid manufacturer. NWFA/NOFMA-certified flooring, in its own words, is made by NWFA manufacturing members that have pledged to uphold the NWFA/NOFMA standards.',
          'On the evidence we have, both bodies are voluntary trade-association standards in Canada, and we found no statute or regulation making either mandatory. That is not a reason to ignore them. It is a reason to require them by name in the contract, because nothing else will.',
        ],
        callout: {
          label: 'Why this is in the contract, not the brochure',
          text: 'A voluntary standard becomes enforceable the moment it is written into a fixed-price scope. That is the entire mechanism, and it costs nothing to use.',
        },
      },
      {
        id: 'reading-a-quote',
        heading: 'Reading a grade on a quote',
        body: [
          'Six checks, in the order they matter. Any competent supplier can answer all six in one email.',
        ],
        ordered: [
          'Does the quote name the species botanically — red oak or white oak, not "oak"?',
          'Does it name a flooring grade under NWFA/NOFMA — Clear, Select, No. 1 Common or No. 2 Common — rather than an invented marketing tier?',
          'Does it state a thickness and a width, and does the width name match the standard’s definitions of strip, plank and wide plank?',
          'For engineered: does it state the wear layer at its thinnest point in millimetres, and does that meet 3.2 mm unfinished or 2.5 mm factory-finished?',
          'For engineered: does it name the emissions standard the core is certified to, and who certified it?',
          'Does it name the manufacturer and the mill, so that every answer above can be checked against a document rather than a salesperson?',
        ],
        callout: {
          label: 'The test',
          text: 'If a quote survives all six questions, the grade you paid for is the grade that arrives. If it survives none, you have bought an adjective.',
        },
      },
    ],
    references: [
      {
        org: 'National Hardwood Lumber Association',
        title: 'Rules for the Measurement & Inspection of Hardwood & Cypress (effective 1 January 2023)',
        url: 'https://nhla.com/wp-content/uploads/2023/07/2023-Rulesbook_English_web.pdf',
        readAt: '2026-08-27',
      },
      {
        org: 'National Hardwood Lumber Association',
        title: 'NHLA grading rules',
        url: 'https://www.nhla.com/services/nhla-grading-rules',
        readAt: '2026-08-27',
      },
      {
        org: 'Canadian Hardwood Bureau',
        title: 'Grading',
        url: 'https://hardwoodscanada.ca/grading/',
        readAt: '2026-08-27',
      },
      {
        org: 'National Wood Flooring Association',
        title: 'NWFA/NOFMA International Standards for Unfinished Solid Wood Flooring, revised April 2018',
        url: 'https://nwfa.org/wp-content/uploads/2020/03/NWFA-NOFMA-Unfinished-Standard-Final-April-2018.pdf',
        readAt: '2026-08-27',
      },
      {
        org: 'National Wood Flooring Association',
        title: 'NWFA Engineered Wood Flooring Refinishable Program, Hardwood Floors magazine, Aug/Sept 2022',
        url: 'https://nwfa.org/wp-content/uploads/2022/09/HFM_AugSept22_final_refinishable_small.pdf',
        readAt: '2026-08-27',
      },
      {
        org: 'National Wood Flooring Association',
        title: 'NWFA/NOFMA certified manufacturers',
        url: 'https://nwfa.org/nofma-manufacturers/',
        readAt: '2026-08-27',
      },
      {
        org: 'Decorative Hardwoods Association and National Wood Flooring Association',
        title: 'Environmental Product Declaration for Engineered Wood Flooring (2022-11-25)',
        url: 'https://www.decorativehardwoods.org/sites/default/files/2023-02/Engineered%20Wood%20Flooring%20EPD%2020230207docx%20(2).pdf',
        readAt: '2026-08-27',
      },
      {
        org: 'Decorative Hardwoods Association / ANSI',
        title: 'ANSI/HPVA HP-1-2024, approved 20 August 2024',
        url: 'https://www.decorativehardwoods.org/sites/default/files/2024-10/ANSI-HPVA%20HP-1-2024.pdf',
        readAt: '2026-08-27',
      },
      {
        org: 'US Environmental Protection Agency / eCFR',
        title: '40 CFR § 770.10 — Formaldehyde emission standards',
        url: 'https://www.ecfr.gov/current/title-40/part-770/section-770.10',
        readAt: '2026-08-27',
      },
      {
        org: 'US Environmental Protection Agency',
        title: 'Formaldehyde emission standards for composite wood products',
        url: 'https://www.epa.gov/formaldehyde/formaldehyde-emission-standards-composite-wood-products',
        readAt: '2026-08-27',
      },
    ],
  },
];

export const getPapers = (): Paper[] =>
  [...PAPERS].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

export const getPaper = (slug: string): Paper | undefined =>
  PAPERS.find((p) => p.slug === slug);

/** Public URL of the PDF. Served from apps/web/public/papers/. */
export const pdfHref = (paper: Paper): string => `/papers/${paper.pdf}`;

/**
 * Is the PDF actually published yet?
 *
 * The two source PDFs still carry two retired claims on their title slide — the
 * founding-year drift and the invented home count (facts-allow: this comment
 * has to name the shape of the problem to explain it). Both are listed in
 * scripts/verify-business-facts.mjs — they were removed from the entire
 * codebase in the business-facts remediation, and that guard now reads PDF text
 * as well, so dropping them into public/ turns the build red on purpose.
 *
 * So the pages ship first and the download appears the moment a corrected
 * export lands in apps/web/public/papers/. The HTML is the citable artifact
 * either way; the PDF is the thing a person emails to their spouse.
 *
 * Resolved at build time on the server. Never called from a client component.
 */
export function pdfIsPublished(paper: Paper): boolean {
  try {
     
    const { existsSync } = require('node:fs') as typeof import('node:fs');
     
    const { join } = require('node:path') as typeof import('node:path');
    return existsSync(join(process.cwd(), 'public', 'papers', paper.pdf));
  } catch {
    return false;
  }
}
