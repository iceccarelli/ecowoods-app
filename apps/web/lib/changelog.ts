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
