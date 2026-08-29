/**
 * What's new — the changelog of everything published here.
 *
 * WHY THIS IS WRITTEN AND NOT DERIVED
 *
 * A sitemap says what exists. A feed says what changed. Neither says WHY IT
 * MATTERS, and that sentence is the whole value of a changelog entry — it is
 * what makes an item worth reading rather than merely worth indexing.
 *
 * So entries are written. The risk with a written changelog is that it silently
 * falls behind: something ships, nobody adds a line, and the page quietly claims
 * a publication history it no longer has. scripts/verify-changelog.mjs closes
 * that by working in the other direction — it walks papers, guides and figures
 * and FAILS THE BUILD if any of them has no entry here. The prose is editorial;
 * the completeness is mechanical.
 *
 * This is the AWS "What's New" pattern, and the important half of it is what it
 * is NOT: it carries this business's own releases, not a digest of other
 * people's news. Aggregating the trade press would make this a secondary source
 * competing with its own inputs. External bodies are tracked separately, as a
 * standards register, in lib/standards.ts.
 */

export type ChangeKind = 'paper' | 'guide' | 'figure' | 'framework' | 'tool' | 'data';

export type ChangeEntry = {
  id: string;
  date: string;
  kind: ChangeKind;
  title: string;
  /** Why a reader should care. One or two sentences, no marketing. */
  body: string;
  href: string;
  /** Manifest ids this entry covers, for the completeness guard. */
  covers?: string[];
};

export const CHANGELOG: ChangeEntry[] = [
  {
    id: 'provenance-paper-v1',
    date: '2026-08-27',
    kind: 'paper',
    title: 'Where the hardwood installed in Toronto actually comes from',
    body: 'The forest, the mill and the paperwork behind a Toronto floor, reconstructed from primary documents only \u2014 Ontario\u2019s own forest inventory and silvicultural guides, the manufacturers\u2019 own disclosures, and the federal legality instruments. The longest section in it is the one listing what we looked for and could not source, published in full so that nobody has to take the rest on trust. It also records the single most consequential supply fact in this market: white ash is the only one of the six species used here being cut faster than it grows.',
    href: '/papers/where-toronto-hardwood-comes-from',
    covers: ['where-toronto-hardwood-comes-from'],
  },
  {
    id: 'grading-paper-v1',
    date: '2026-08-27',
    kind: 'paper',
    title: 'The two grading systems behind every hardwood floor',
    body: 'A hardwood board is graded twice, by two different bodies, under two opposite logics: the NHLA grades lumber on how much clear material it will yield, and the NWFA/NOFMA standard grades finished flooring on appearance alone \u2014 stating outright that all grades are equally strong and serviceable in any application. Almost every quote in this market names neither. This paper publishes both rulebooks side by side, with the six questions that turn a grade into something a customer can hold a supplier to.',
    href: '/papers/hardwood-grading-standards-nhla-nwfa',
    covers: ['hardwood-grading-standards-nhla-nwfa'],
  },
  {
    id: 'species-dossiers-v1',
    date: '2026-08-27',
    kind: 'guide',
    title: 'Five species dossiers \u2014 case studies of the material, not of a client',
    body: 'Red oak, hard maple, white ash, hickory and black walnut, each with its published hardness, its Ontario range and status, its standing inventory, its growth against its harvest, and the flooring grades it is actually sold in. Every figure traces to a government or standards-body document named in the paper behind it. They were written instead of five more client case studies on purpose: the five already published are real jobs with measured readings, and five invented ones would have passed every check in this repository, because the checks test consistency and not truth.',
    href: '/guides',
    covers: [
      'red-oak-flooring-toronto',
      'hard-maple-flooring-toronto',
      'white-ash-flooring-toronto',
      'hickory-flooring-toronto',
      'black-walnut-flooring-toronto',
    ],
  },
  {
    id: 'provenance-figures-v1',
    date: '2026-08-27',
    kind: 'figure',
    title: 'Two new plotted figures: Ontario standing volume, and the NHLA yield ladder',
    body: 'Ontario\u2019s hardwood growing stock by species, and what each NHLA lumber grade requires a board to yield in clear cuttings. Both are drawn from figures that appear verbatim in the paper section each one cites \u2014 the guard that checks this refuses any plotted number that is not already published in its source, which is what stops a chart from quietly becoming its own evidence.',
    href: '/data',
    covers: ['ontario-hardwood-growing-stock', 'nhla-clear-face-yield'],
  },
  {
    id: 'paper-sources-register-v1',
    date: '2026-08-27',
    kind: 'data',
    title: 'Every technical paper now carries its sources, and the PDF is generated from the page',
    body: 'Papers can now carry a register of the primary documents behind them \u2014 the issuing organisation, the exact title, the organisation\u2019s own URL, and the date a human opened it. Those references are also emitted as machine-readable citations, which is the field an answer engine reads to decide whether a document is grounded or merely asserted. Separately, the LaTeX source each PDF is exported from is now generated from the same manifest the page renders from, so the download can no longer drift away from what the site says.',
    href: '/papers',
  },
  {
    id: 'entity-answers-v1',
    date: '2026-08-22',
    kind: 'tool',
    title: 'Every question about this company, answered in one paragraph each',
    body: 'Who we are, how long we have worked, whether we subcontract, where we go, what it costs, and how the work is judged \u2014 stated in the words those questions are actually asked, one self-contained paragraph each, on a single page. Every figure on it is read from the same source the rest of the site renders from, so there is nowhere on that page to type a number that could drift from the truth. It is also carried in the machine-readable editions, because the first thing anything reading this site has to settle is who it belongs to.',
    href: '/about',
  },
  {
    id: 'images-discoverable-v1',
    date: '2026-08-22',
    kind: 'data',
    title: 'The logo is now an image on the internet, and every diagram is findable',
    body: 'The brand mark was embedded in the page as encoded text rather than published as a file, which meant it had no address \u2014 nothing could crawl it, index it, link to it or share it, and image search had no way to know the logo existed. It is now a file at a permanent URL, with a description attached, and the same mark at full resolution is what search engines read as the company\u2019s logo. The sitemap also declares every technical diagram, because an image reached only by JavaScript is one a search engine is told about or does not find.',
    href: '/library',
  },
  {
    id: 'brand-assets-v2',
    date: '2026-08-22',
    kind: 'data',
    title: 'The logo fix, actually applied this time',
    body: 'The previous release corrected where the organisation\u2019s logo URL came from, and the code that builds the schema was ignoring it \u2014 hardcoding the old path one line below the field that read the setting correctly. Every check in the repository passed. The production check, which fetches the logo the live page actually declares rather than reading the source, failed on its first run. That is what it is for.',
    href: '/authority',
  },
  {
    id: 'brand-assets-v1',
    date: '2026-08-22',
    kind: 'data',
    title: 'The logo in our structured data now exists',
    body: 'The organisation\u2019s logo and image had pointed at two URLs that returned 404 \u2014 one file sitting in a directory this host does not serve, the other never created at all. Those are the fields a search engine reads to attach a brand mark to a knowledge panel, and every structured-data validator passed the markup, because a validator checks that a URL is well formed and never checks that it resolves. Both are now derived from imported files, so a missing one stops the build. Every article also carries an image, which is what makes it eligible for a rich result at all.',
    href: '/authority',
  },
  {
    id: 'high-intent-guides-v1',
    date: '2026-08-22',
    kind: 'guide',
    title: 'Five guides for the questions people actually type',
    body: 'Cost, choosing a contractor, white oak, dustless refinishing, and the pattern floors \u2014 herringbone, chevron and parquet. Each is written the way the question is asked, answers it in the first paragraph, and cites the paper section behind every technical claim. The cost guide publishes the three service bands as a table rather than a starting-from number, and says plainly which variables move a phone range into a fixed written price.',
    href: '/guides',
    covers: [
      'hardwood-flooring-cost-toronto',
      'how-to-choose-hardwood-contractor-toronto',
      'white-oak-flooring-toronto',
      'dustless-hardwood-refinishing-toronto',
      'herringbone-chevron-parquet-toronto',
    ],
  },
  {
    id: 'neighbourhood-pages-v1',
    date: '2026-08-22',
    kind: 'tool',
    title: 'Sixteen Toronto neighbourhoods, each with its own page',
    body: 'Rosedale, Forest Hill, Yorkville, Leaside, The Annex, High Park, Riverdale, Leslieville, The Beaches, Lawrence Park, Cabbagetown, Swansea, Davisville Village, midtown, King West and Liberty Village. Each carries the housing stock and the technical constraint specific to it \u2014 heritage wear layer in Cabbagetown, slab moisture and elevator windows in King West, lakeside humidity in the Beaches. They are neighbourhoods, not municipalities, and the entity graph says so: only real cities appear as City nodes in the organisation\u2019s service area.',
    href: '/service-areas',
  },
  {
    id: 'lead-path-hardening-v1',
    date: '2026-08-22',
    kind: 'tool',
    title: 'The estimate request is harder to abuse and impossible to lose',
    body: 'A hidden field catches automated submissions, a rate limit absorbs floods, and an acknowledgement email now goes to the customer within seconds of submitting. The order of those checks is the part that matters: the request is validated and written to a durable log before anything is allowed to reject it, so a rate limit can inconvenience a real customer but can never erase one. A public estimate endpoint at /api/estimate returns the same published bands to any tool or agent that asks.',
    href: '/api/estimate',
  },
  {
    id: 'agent-corpus-v2',
    date: '2026-08-22',
    kind: 'data',
    title: 'The machine-readable corpus now answers local and commercial questions',
    body: 'Until now /llms-full.txt carried the technical material only \u2014 papers, guides, glossary. An agent asked who refinishes hardwood in Etobicoke found no service, no price and no area in the one file built for agents to read. Services and all sixteen service areas are now in the corpus and each has its own .md edition, so a single fetch answers what the work is, what it costs and where it is done. The knowledge API carries the same, with URLs. The corpus went from 70 KB to 115 KB, none of it new claims.',
    href: '/llms-full.txt',
  },
  {
    id: 'gta-coverage-v1',
    date: '2026-08-22',
    kind: 'tool',
    title: 'Every service area has its own page, not the same page sixteen times',
    body: 'Fifteen of the sixteen service-area pages rendered one generic paragraph with a place name substituted in. Each now carries the housing stock, the neighbourhoods and the technical constraint that are actually specific to it \u2014 slab moisture downtown and in Mississauga\u2019s towers, remaining wear layer in East York, heated assemblies in Vaughan, lakeside humidity in Pickering and Ajax. The organisation\u2019s coverage is now derived from the same list the pages are built from, so the entity graph cannot claim an area with no page or omit one that has a page. Homepage and service titles lead with what the work is rather than with the brand.',
    href: '/service-areas',
  },
  {
    id: 'service-pages-v1',
    date: '2026-08-22',
    kind: 'tool',
    title: 'One page per service, each with its price band and the paper behind it',
    body: 'Installation, refinishing, dust-free sanding, restoration, stairs and inlays now have their own URLs. Each carries the published price band as a full band rather than a starting-from number, the framework pillars the work is scored against, the paper sections that establish the technique, and the decision guides that say when the service is the wrong one. No figure on any of them is new \u2014 every one was already published elsewhere on this site. The organisation\u2019s structured data had been identifying these six services by URLs that did not exist; now they resolve.',
    href: '/services',
  },
  {
    id: 'machine-editions-v1',
    date: '2026-08-21',
    kind: 'data',
    title: 'Every document, as clean Markdown, at its own URL',
    body: 'Append .md to any paper, guide or glossary URL and you get the document itself \u2014 headings, tables and ordered protocols intact, with its canonical URL and citation line attached. The whole corpus is also served in one file at /llms-full.txt. Both are generated from the same source as the pages, so neither can drift from what the site says, and neither summarises anything: an agent quoting us should be quoting the sentence we published, not a paraphrase of it.',
    href: '/llms-full.txt',
  },
  {
    id: 'nwfa-installation-2025',
    date: '2026-08-21',
    kind: 'data',
    title: 'The NWFA installation guidelines, edition verified',
    body: 'The standards register carried this entry for a year without naming an edition, because the association\u2019s landing page does not list one and this register does not assert what it has not read. The document itself has now been read at source: Wood Flooring Installation Guidelines, Revised \u00a9 2025, published by the National Wood Flooring Association. The entry names the edition, links the document rather than the homepage, and the register shows an Edition row wherever an edition has actually been confirmed \u2014 and no row where it has not.',
    href: '/standards',
  },
  {
    id: 'library-v1',
    date: '2026-08-21',
    kind: 'data',
    title: 'A visual library — 136 images, indexed and linked',
    body: 'Every diagram and photograph on this site in one place: 28 technical cross-sections, each a link to the page that explains it, plus the twelve floors and twelve machines. The photographs rotate with a staggered Ken Burns push in four alternating variants, paused while off-screen. The diagrams do not move — a frame scaling under a cross-section makes it harder to read, not more alive.',
    href: '/library',
  },
  {
    id: 'illustrations-v1',
    date: '2026-08-21',
    kind: 'data',
    title: '28 technical diagrams across the framework, guides and glossary',
    body: 'Cross-sections of the three substrate assemblies, the four failure modes, the expansion gap, acclimation and the machine sequence. Flat vector, one palette, and no text baked into any image — every label stays in the HTML where a screen reader can read it and a crawler can index it. Each diagram is trimmed to its own content, so it carries its true aspect ratio rather than sitting in an empty 16:9 box.',
    href: '/framework',
  },
  {
    id: 'market-v1',
    date: '2026-08-20',
    kind: 'data',
    title: 'What moves a hardwood quote — three commodity inputs, live',
    body: 'Forestry, energy and USD/CAD, pulled hourly from the Bank of Canada, with the mechanism behind each and why it is volatile. Published so a price change can be evaluated rather than suspected. A source that cannot be reached shows as missing rather than as the last cached number.',
    href: '/market',
  },
  {
    id: 'standards-v1',
    date: '2026-08-20',
    kind: 'data',
    title: 'A standards register, with the date we last checked each entry',
    body: 'The external documents this trade answers to — ASTM concrete moisture and floor-preparation methods, NWFA guidelines — each mapped to the framework criteria that depend on it, linked to the issuing body, and stamped with a verification date the build warns about when it goes stale.',
    href: '/standards',
  },
  {
    id: 'figures-v1',
    date: '2026-08-20',
    kind: 'figure',
    title: 'Two numbered figures, each with the table it was built from',
    body: 'Indoor relative humidity against the band hardwood needs, and Janka hardness across the five species used across the GTA. Every plotted value is checked against its source paper at build time, so a figure cannot drift from the document it claims to visualise. Free to reuse under CC BY 4.0.',
    href: '/data',
    covers: ['toronto-indoor-humidity', 'janka-hardness-gta'],
  },
  {
    id: 'knowledge-api',
    date: '2026-08-20',
    kind: 'data',
    title: 'The whole corpus is now available as JSON',
    body: 'Every paper with full section text, all 27 framework criteria with their sources, every guide and every glossary term — CORS-open, no key, CC BY 4.0. Generated from the same manifests the pages render from, so it cannot describe a page that does not exist.',
    href: '/api/knowledge',
  },
  {
    id: 'glossary-v1',
    date: '2026-08-20',
    kind: 'data',
    title: 'A 32-term glossary, one addressable page per term',
    body: 'Acclimation, cupping, crowning, telegraphing, overwood, moisture differential and the rest — each with a canonical definition, DefinedTerm schema, and a link to the paper section it comes from.',
    href: '/glossary',
  },
  {
    id: 'framework-v1',
    date: '2026-08-19',
    kind: 'framework',
    title: 'The Ecowoods Well-Installed Framework v1.0',
    body: 'Six pillars and 27 binary criteria for judging a hardwood installation, published under CC BY with permanent criterion ids. Written to be used on any contractor in the GTA, including us. The self-assessment scores a quote in the browser and sends nothing anywhere.',
    href: '/framework',
  },
  {
    id: 'guides-v1',
    date: '2026-08-19',
    kind: 'guide',
    title: 'Three decision guides and three reference installations',
    body: 'Solid versus engineered, installation method by substrate, and how to evaluate a quote — plus three scenarios specified end to end: condominium over slab, radiant heat main floor, and refinishing an existing floor.',
    href: '/guides',
    covers: [
      'solid-vs-engineered-hardwood-toronto',
      'nail-down-glue-down-or-floating',
      'how-to-evaluate-a-hardwood-quote',
      'reference-condominium-concrete-slab',
      'reference-radiant-heat-main-floor',
      'reference-refinishing-existing-hardwood',
    ],
  },
  {
    id: 'paper-craft',
    date: '2026-08-17',
    kind: 'paper',
    title: 'The Craft — the four machines and the order they run in',
    body: 'Belt sander, edger, planetary and buffer: what each one does that the others cannot, and why a skipped step in the sequence is a liability that stays invisible until handover day.',
    href: '/papers/hardwood-refinishing-machines-and-sequence',
    covers: ['hardwood-refinishing-machines-and-sequence'],
  },
  {
    id: 'papers-v1',
    date: '2026-08-01',
    kind: 'paper',
    title: 'Climate Mastery and The Intelligent Homeowner’s Decision Framework',
    body: 'Why hardwood succeeds or fails in Toronto — moisture, acclimation, substrate and method — and how to choose a floor that performs rather than one that photographs well. Published in full as HTML, not gated.',
    href: '/papers',
    covers: [
      'toronto-hardwood-climate-moisture-protocol',
      'hardwood-selection-and-cost-framework-gta',
    ],
  },
];

export const getChangelog = (): ChangeEntry[] =>
  [...CHANGELOG].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

export const KIND_LABEL: Record<ChangeKind, string> = {
  paper: 'Technical paper',
  guide: 'Guide',
  figure: 'Figure',
  framework: 'Framework',
  tool: 'Tool',
  data: 'Data',
};
