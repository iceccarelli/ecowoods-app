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
          rows: [
            ['Fully installed, average', '≈ $13 / sq ft'],
            ['Fully installed, typical range', '$8 – $18 / sq ft'],
            ['Screen and recoat', '$2.50 – $4.00 / sq ft'],
            ['Full sand and finish', '$4.75 – $7.50 / sq ft'],
            ['Premium new install (wide-plank, oil finishes, stairs)', '$11 – $18 / sq ft'],
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
