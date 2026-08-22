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
    title: 'The EcoWoods Well-Installed Framework v1.0',
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
