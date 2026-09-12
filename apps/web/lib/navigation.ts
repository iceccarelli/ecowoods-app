/**
 * lib/navigation.ts — ONE NAVIGATION TRUTH, MANY SURFACES.
 *
 * WHY THIS FILE EXISTS
 *
 * This site already has a rule about facts: one source, many generated
 * surfaces, and the system never states two versions of the same thing.
 * Navigation is a fact — "where can you get to from here" — and it was the one
 * fact still kept in three places.
 *
 *   · the desktop mega-panels read one copy, in Header.tsx
 *   · the mobile drawer read the same copy (UI-NAV-01 fixed that), so those two
 *     have agreed since
 *   · ⌘K read NOTHING. CommandPalette.tsx carried its own hand-written list of
 *     six homepage anchors, written when this site was one page, and it was
 *     never updated as the corpus grew to 47 public routes. It could not reach
 *     Floor Studio, /pricing, /service-areas, /corridors, /estimate, /guides,
 *     /papers, /case-studies, /quote-check or /framework — and five of its
 *     thirteen actions did nothing at all on any page but the homepage, because
 *     `getElementById(hash)` finds nothing when the section is somewhere else.
 *     See NAV-03 in docs/GEO_CONTRADICTION_LOG.md.
 *
 * So the menus live here, in a module with no 'use client' and no React, and
 * the three surfaces project them:
 *
 *   Header.tsx        desktop panels + the mobile drawer accordions
 *   CommandPalette    every destination, searchable, on every page
 *   verify-navigation reads this file as chrome (see the widening note there)
 *
 * A page added to a menu here appears in all three the same deploy. That is the
 * whole point: a mega-menu, a drawer and a command palette that disagree about
 * what this site contains are three different sites.
 *
 * CURATED, NOT GENERATED — the original note, which still governs
 *
 * AWS does not list 240 services in its panel; it lists the categories a
 * visitor arrives with. Dumping forty-four glossary terms here would be a
 * directory, and a directory is what /glossary already is. These are the
 * entries that answer a question someone is holding.
 *
 * Every href is a real page and every one is also reachable from its hub, so
 * nothing here is the ONLY path to anything — a menu that is the sole route to
 * a page is a page that dies the day the menu breaks.
 */
import { CORRIDORS } from '@/content/geo/corridors';
import { SERVICE_AREAS } from '@/lib/seo-data';

export type MegaItem = { label: string; href: string; note?: string };

export type MegaColumn = {
  title: string;
  /** Where the column heading itself goes. Optional — some columns are lists only. */
  href?: string;
  items: MegaItem[];
};

export const SERVICES_MENU: MegaColumn[] = [
  /* "Send photos" no longer fits in the header — see the note on .topbar-photos
     in globals.css. It is the fastest route a visitor has to a real answer, so
     it does not simply disappear: it leads this menu, one click from every page. */
  {
    title: 'Start here',
    items: [
      /* Floor Studio leads the menu because it is the only entry on this site
         that costs the visitor nothing and shows them something they cannot get
         anywhere else: their own room, with a floor we can actually lay in it.
         In the chrome it is depth 0 — one click from every page. */
      { label: 'See it in your room', href: '/floor-studio', note: 'Your photo, a real floor, a live range' },
      /* The second door, one line under the first (UI-NAV-02). Floor Studio led
         this menu alone, and /design — the configurator it hands people on to —
         was reachable only from the footer. Two entries into one catalogue is
         the design; one of them being invisible in the chrome was not. The
         notes say which is which, because the labels alone read as duplicates. */
      { label: 'Design the specification', href: '/design', note: 'Every axis at once, no photo needed' },
      { label: 'Send three photos', href: '/#photo-triage', note: 'A read on your floor, usually same day' },
      /* This pointed at `/#quote` — the homepage quote section. It worked, and
         it cost a visitor deep in /service-areas/buffalo a round trip through
         the homepage to reach a form that has its own page. /estimate is that
         page: the measure, the written price and the work, and it is already
         where Floor Studio hands a finished design (studio-config.ts
         estimateHref). The menus now name it, which also stops /estimate being
         a page reachable only from the footer. NAV-03. */
      { label: 'Get a free estimate', href: '/estimate', note: 'Fixed price, in writing, after we measure' },
    ],
  },
  {
    title: 'By the job',
    href: '/services',
    items: [
      { label: 'Refinishing', href: '/hardwood-floor-refinishing-toronto', note: 'Screen and recoat, or full sand' },
      { label: 'New installation', href: '/hardwood-flooring-toronto', note: 'Solid and engineered' },
      { label: 'Dust-free sanding', href: '/services/dust-free-sanding', note: 'HEPA-sealed, stay in the house' },
      { label: 'Stairs', href: '/hardwood-stairs-toronto', note: 'Four different jobs, one word' },
      { label: 'Floor restoration', href: '/services/floor-restoration' },
      { label: 'Custom inlays', href: '/services/custom-inlays' },
    ],
  },
  {
    title: 'By who you are',
    href: '/commercial',
    items: [
      { label: 'Condo boards & property managers', href: '/commercial', note: 'After-hours, COI, priced by area' },
      { label: 'Realtors & sellers', href: '/realtors', note: 'Three-day pre-list recoat' },
      { label: 'Score a quote you already have', href: '/framework/assess', note: 'Any contractor, including us' },
    ],
  },
  {
    title: 'By the problem',
    href: '/hardwood-floor-problems-toronto',
    items: [
      { label: 'Cupping, gapping, crowning', href: '/hardwood-floor-problems-toronto', note: 'Five symptoms, one mechanism' },
      { label: 'Buckling and edge peaking', href: '/hardwood-floor-problems-toronto' },
      { label: 'Matching stairs to a floor', href: '/hardwood-stairs-toronto' },
      { label: 'Is my floor refinishable?', href: '/guides/reference-refinishing-existing-hardwood' },
    ],
  },
  {
    /* The geography page was in the footer and not here. It is what a "hardwood
       flooring near me" search lands on, it is the payoff of the whole corridor
       model, and the primary navigation did not mention it. Both counts are
       derived — the nav said "Nine routes" for a week after there were eleven. */
    title: 'Where we work',
    href: '/service-areas',
    items: [
      { label: 'Find your city', href: '/service-areas', note: `${SERVICE_AREAS.length} published areas, each with its own housing stock` },
      { label: 'Where we actually drive', href: '/corridors', note: `${CORRIDORS.length} routes, in travel order` },
      { label: 'Toronto', href: '/hardwood-flooring-toronto', note: 'The shop, and the city it is in' },
      { label: 'Mississauga', href: '/service-areas/mississauga' },
      { label: 'Hamilton', href: '/service-areas/hamilton' },
      /* The corridor page, not one town: it lists every Niagara municipality
         with a page, from Grimsby to Fort Erie, in the order a crew reaches them. */
      { label: 'Niagara', href: '/corridors/niagara-belt', note: 'Grimsby to Fort Erie, on the QEW' },
      { label: 'Kitchener', href: '/service-areas/kitchener', note: 'On the 403 and Highway 6, with Cambridge and Guelph' },
      { label: 'Buffalo, NY', href: '/service-areas/buffalo', note: 'The showroom is Toronto; the job is on site' },
    ],
  },
  {
    title: 'Before you decide',
    href: '/guides',
    items: [
      /* The published bands themselves. /pricing is the source every other
         surface on this site links to when it names a number, and until
         NAV-03 it appeared in no menu at all — desktop or mobile — only in
         the footer. A price page reachable only by scrolling to the bottom
         of a page is a price page the visitor concludes does not exist. */
      { label: 'What it costs', href: '/pricing', note: 'The three published bands, and what moves a job inside them' },
      { label: 'What it costs in Toronto', href: '/guides/hardwood-flooring-cost-toronto', note: 'Three published bands' },
      { label: 'Compare the quotes you have', href: '/quote-check', note: 'Are they even the same job?' },
      { label: 'How much your floor will move', href: '/tools/floor-movement', note: 'Nine species, computed' },
      { label: 'Jobs, photographed', href: '/projects', note: 'Before and after, in chapters' },
      { label: 'Sanding equipment', href: '/equipment', note: 'What runs on which circuit' },
      { label: 'Solid or engineered', href: '/guides/solid-vs-engineered-hardwood-toronto' },
      { label: 'How to choose a contractor', href: '/guides/how-to-choose-hardwood-contractor-toronto' },
    ],
  },
];

/* Where each group sits in the desktop panel: four columns, groups stacked.
   The mobile drawer lists SERVICES_MENU in its own order. */
export const SERVICES_LAYOUT: string[][] = [
  ['Start here', 'By who you are'],
  ['By the job', 'By the problem'],
  ['Where we work'],
  ['Before you decide'],
];

export const LIBRARY_MENU: MegaColumn[] = [
  {
    title: 'Technical papers',
    href: '/papers',
    items: [
      { label: 'Provenance', href: '/papers/where-toronto-hardwood-comes-from', note: 'Where the wood comes from' },
      { label: 'Grade', href: '/papers/hardwood-grading-standards-nhla-nwfa', note: 'NHLA and NWFA, side by side' },
      { label: 'Climate Mastery', href: '/papers/toronto-hardwood-climate-moisture-protocol' },
      { label: 'The Craft', href: '/papers/hardwood-refinishing-machines-and-sequence' },
      { label: 'Selection and cost', href: '/papers/hardwood-selection-and-cost-framework-gta' },
    ],
  },
  {
    title: 'Species dossiers',
    href: '/guides',
    items: [
      { label: 'White oak', href: '/guides/white-oak-flooring-toronto' },
      { label: 'Red oak', href: '/guides/red-oak-flooring-toronto' },
      { label: 'Hard maple', href: '/guides/hard-maple-flooring-toronto' },
      { label: 'White ash', href: '/guides/white-ash-flooring-toronto', note: 'Cut faster than it grows' },
      { label: 'Hickory · Black walnut', href: '/guides/hickory-flooring-toronto' },
    ],
  },
  {
    title: 'Reference',
    href: '/resources',
    items: [
      /* TWO LIBRARY DOORS, AND THE MENU NAMED ONLY ONE (VIS-02).
         /resources is "everything we publish, organised by what you are trying
         to do" — the front door, task-first. /technical-library is "the
         engineering reference behind our work" — the corpus, and the breadcrumb
         parent ArticleLayout gives EVERY article. It sits at sitemap priority
         0.95 and appeared in no menu at all, so a visitor who followed a
         breadcrumb up from an article landed on a page the navigation could not
         show them the position of. Both are named now, and the notes say which
         is which — the same fix UI-NAV-02 made for /floor-studio and /design,
         for the same reason: the labels alone read as duplicates. */
      { label: 'Technical library', href: '/technical-library', note: 'The engineering reference every article sits under' },
      { label: 'Glossary', href: '/glossary', note: '44 terms, each citing a paper' },
      /* The catalogues sit in Reference and not in the primary conversion nav:
         Quote and Call come first, and a download is not a conversion. */
      { label: 'Field catalogues', href: '/catalogues', note: 'Landscape PDFs, built to print, nothing gated' },
      { label: 'Standards register', href: '/standards', note: 'NHLA, NWFA, ASTM, FPL' },
      { label: 'Figures and data', href: '/data' },
      { label: 'The Well-Installed Framework', href: '/framework' },
      { label: 'Visual library', href: '/library' },
    ],
  },
  {
    title: 'Evidence',
    href: '/case-studies',
    items: [
      { label: 'Case studies', href: '/case-studies', note: 'Measured jobs, published readings' },
      /* Footer-only until NAV-03. It is the first-party proof page — every
         published job, each linked to what was measured — and it is neither
         /service-areas (where we will go) nor /corridors (how we get there).
         Three geography-shaped pages, and the one carrying the evidence was
         the one no menu named. */
      { label: 'Where the work has been done', href: '/where-we-work', note: 'Every published job, on a map' },
      { label: 'Reviews', href: '/reviews' },
      { label: 'What we publish about ourselves', href: '/about' },
      { label: 'Everything, as it shipped', href: '/whats-new' },
    ],
  },
];

export const TOP_LINKS = [
  /* Two panels and four links. See MegaMenu.tsx for why a panel beats a hub, and
   * F-163 for why the five commercial pages are here at all. */
  { label: 'Refinishing', href: '/hardwood-floor-refinishing-toronto' },
  { label: 'Installation', href: '/hardwood-flooring-toronto' },
  { label: 'Stairs', href: '/hardwood-stairs-toronto' },
  { label: 'Problems', href: '/hardwood-floor-problems-toronto' },
];

/** The drawer's accordions, in drawer order. */
export const MOBILE_GROUPS = [
  { key: 'services', label: 'Services', cols: SERVICES_MENU },
  { key: 'library', label: 'Library', cols: LIBRARY_MENU },
];

/**
 * Every destination in the chrome, flattened, de-duplicated, in menu order.
 *
 * This is what ⌘K searches. It is DERIVED rather than written, which is the
 * only reason the palette can be trusted to still be true a year from now: a
 * link added to a panel is in the palette the same commit, and a link removed
 * from a panel cannot linger there.
 *
 * On-page anchors (`/#quote`) are kept — they are real destinations and they
 * work from anywhere, because they carry a path. What is deliberately NOT here
 * is a bare `#hash`, which is what the old palette stored and what made five of
 * its actions silent no-ops away from the homepage.
 */
export type Destination = { label: string; href: string; note?: string; group: string };

export const DESTINATIONS: Destination[] = (() => {
  const out: Destination[] = [];
  const seen = new Set<string>();
  const push = (group: string, it: MegaItem) => {
    const key = it.href;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ...it, group });
  };
  /* A column heading is a destination too — "Where we work" goes to
     /service-areas — but only when no row under it already goes there. Listing
     the same page twice under two names is how a search box teaches someone
     that it has more in it than it does. */
  const addColumn = (col: MegaColumn) => {
    const items = new Set(col.items.map((it) => it.href));
    if (col.href && !items.has(col.href)) push(col.title, { label: col.title, href: col.href });
    for (const it of col.items) push(col.title, it);
  };
  for (const link of TOP_LINKS) push('Services', link);
  for (const col of SERVICES_MENU) addColumn(col);
  for (const col of LIBRARY_MENU) addColumn(col);
  return out;
})();
