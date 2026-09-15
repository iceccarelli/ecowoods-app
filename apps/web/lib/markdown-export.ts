/**
 * Clean Markdown renderings of the published corpus.
 *
 * WHY THIS EXISTS
 *
 * The llms.txt proposal (v2, llmstxt.org) asks for two things. The first is the
 * index at /llms.txt, which this site has served since F-23. The second is the
 * part that was missing:
 *
 *   > pages with information that agents might need provide a clean markdown
 *   > version of those pages at the same URL as the original page, either with
 *   > `.md` appended (`page.html.md`) or with the extension replaced by `.md`
 *   > (`page.md`)
 *
 * The reason it matters is narrower than "AI is important". An agent that wants
 * to quote this site currently has to fetch a Next.js page, walk a DOM full of
 * layout wrappers, `tlx-` class names, nav chrome and a footer, and guess which
 * text is the content. Every one of those guesses is a chance to attribute a
 * navigation label to a technical claim, or to drop the sentence that carries
 * the qualification. A `.md` companion removes the guessing: headings are
 * headings, tables are tables, the ordered protocol is an ordered list.
 *
 * WHAT THIS IS NOT
 *
 * It is not a second edition of the content. Every function here reads the same
 * manifest the HTML page reads — lib/papers.ts, lib/guides.ts, lib/glossary.ts —
 * and renders it. There is no place to type a sentence into. If a claim is not
 * in the manifest it cannot appear here, which is the same rule that governs
 * the PDF export and the knowledge API, and the reason `verify-business-facts`
 * can police all of them at once.
 *
 * Two consequences worth stating, because both are deliberate:
 *
 *   · The markdown is generated at build time and served static. It cannot
 *     drift from the HTML, because drift would require two sources.
 *   · Nothing here is a summary. Summarising is where an export starts making
 *     claims of its own.
 */
import { entityAnswers } from '@/lib/entity-answers';
import {
  REVIEW_EVIDENCE,
  PRIMARY_REVIEW_EVIDENCE,
  PROFILE_LINKS,
  BUSINESS_NAP,
  BUSINESS_ADDRESS_LINE,
  BUSINESS_TIMEZONE_NAME,
  HOURS_LINE,
  GOOGLE_PLACE,
} from '@ecowoods/shared/constants';
import { getPapers, getPaper, type Paper, type PaperSection } from '@/lib/papers';
import { catalogueHref, getPublishedCatalogues } from '@/lib/catalogues';
import { getGuides, getGuide, type Guide } from '@/lib/guides';
import { getTerms, getTerm, type GlossaryTerm } from '@/lib/glossary';
import {
  SITE_URL,
  BUSINESS,
  SERVICES,
  CITIES,
  NEIGHBOURHOOD_AREAS,
  DISTRICT_AREAS,
  SERVICE_AREAS,
  FAQ_ITEMS,
  cityContent,
  areaDisplayName,
  US_AREA_SLUGS,
  type CityContent,
  type FaqItem,
} from '@/lib/seo-data';
import { TERRITORY, PUBLISHED_PARTITION } from '@/lib/geo/territory';
import { DISCOVERY } from '@/content/geo/regions';
import {
  CORRIDORS, corridorById, corridorStops, corridorMarkets, marketBySlug, assess, type Corridor,
} from '@/lib/geo';
import { WORK_PLACES } from '@/content/work-map';
import {
  getServicePages,
  getServicePage,
  serviceFor,
  priceBand,
  priceBandIn,
  faqsFor,
  type ServicePage,
} from '@/lib/service-pages';
import { PILLARS, FRAMEWORK_NAME, FRAMEWORK_VERSION, criterionCount } from '@/lib/framework';
import { PRICE_PROMISE } from '@/lib/pricing';
import { NEW_INSTALL, formatBand } from '@/content/constants/pricing';
import { FINISH_OPTIONS, PATTERN_OPTIONS } from '@ecowoods/shared/ai';
import { BOARD_WIDTHS, FLOOR_PRODUCTS } from '@/lib/floor-studio/catalog';
import { FEELS } from '@/lib/floor-studio/match';
import { CLAIMS } from '@/content/claims';
import { buildPrices, buildActions } from '@/lib/registry/registry';
import type { PricePrimitive } from '@/lib/registry/types';

/* ── primitives ───────────────────────────────────────────────────────────── */

const table = (head: string[], rows: string[][], caption?: string): string[] => {
  const out: string[] = [];
  if (caption) out.push(`*${caption}*`, '');
  out.push(`| ${head.join(' | ')} |`);
  out.push(`| ${head.map(() => '---').join(' | ')} |`);
  for (const r of rows) out.push(`| ${r.join(' | ')} |`);
  out.push('');
  return out;
};

/**
 * Every document carries the same footer. An agent that quotes one paragraph
 * out of one of these files should still be holding the canonical URL, the
 * licence and the business it belongs to — that is the entire point of
 * publishing a machine-readable edition rather than only a human one.
 */
const provenance = (canonical: string, extra: string[] = []): string[] => [
  '',
  '---',
  '',
  '## Provenance',
  '',
  `- Canonical URL: ${canonical}`,
  `- Publisher: ${BUSINESS.name}, ${BUSINESS.region}`,
  `- Contact: ${BUSINESS.phoneDisplay} · ${BUSINESS.email}`,
  ...extra,
  `- Citation guide: ${SITE_URL}/ai.txt`,
  '',
  'Quote freely with attribution to the canonical URL above. This file is',
  'generated from the same source as the HTML page and says nothing the page',
  'does not say.',
  '',
];

/* ── papers ───────────────────────────────────────────────────────────────── */

const paperSection = (sec: PaperSection): string[] => {
  const out: string[] = [`## ${sec.heading}`, ''];
  for (const p of sec.body) out.push(p, '');
  if (sec.bullets?.length) {
    for (const b of sec.bullets) out.push(`- ${b}`);
    out.push('');
  }
  if (sec.ordered?.length) {
    sec.ordered.forEach((s, i) => out.push(`${i + 1}. ${s}`));
    out.push('');
  }
  if (sec.table) out.push(...table(sec.table.head, sec.table.rows, sec.table.caption));
  if (sec.callout) out.push(`> **${sec.callout.label}** — ${sec.callout.text}`, '');
  return out;
};

export const paperToMarkdown = (paper: Paper): string => {
  const canonical = `${SITE_URL}/papers/${paper.slug}`;
  const out: string[] = [
    `# ${paper.title}`,
    '',
    `**${paper.subtitle}**`,
    '',
    paper.summary,
    '',
    ...table(
      ['Field', 'Value'],
      [
        ['Version', paper.version],
        ['Published', paper.publishedAt],
        ['Audience', paper.audience],
        ['Topics', paper.topics.join(', ')],
        ['Reading time', `${paper.readingMinutes} minutes`],
      ],
    ),
  ];
  for (const sec of paper.sections) out.push(...paperSection(sec));

  /* THE SOURCES, IN THE EDITION THAT NEEDS THEM MOST.
   *
   * This was missing, and the shape of the omission is worth recording. The
   * references were rendered on the HTML page, emitted as schema.org
   * `citation`, and typeset into the LaTeX — every surface except this one.
   * Which is exactly backwards. /papers/<slug>.md and /llms-full.txt exist for
   * readers who cannot see a page, and a retrieval system that ingests the
   * Markdown was getting the claim "Ontario holds 300,361,212 cubic metres of
   * standing sugar maple" with nothing attached to it. An unsourced figure in
   * an agent's context window is indistinguishable from an invented one, and it
   * gets repeated with our name on it.
   *
   * Rendered as a plain numbered list with the URL inline rather than as a
   * Markdown link, because a bare URL survives every downstream transform an
   * agent might apply to this text, and a link label does not. */
  if (paper.references?.length) {
    out.push(
      '## Sources',
      '',
      'Every figure in this paper was read from the document below, on the date',
      'shown. An external page can change under a citation, so the read date is',
      'recorded rather than implied.',
      '',
    );
    paper.references.forEach((r, i) => {
      out.push(`${i + 1}. ${r.org}. *${r.title}*. ${r.url} — read ${r.readAt}.`);
    });
    out.push('');
  }

  out.push(...provenance(canonical, [`- Document version: ${paper.version} (${paper.publishedAt})`]));
  return out.join('\n');
};

/* ── guides ───────────────────────────────────────────────────────────────── */

export const guideToMarkdown = (guide: Guide): string => {
  const canonical = `${SITE_URL}/guides/${guide.slug}`;
  /* The same headline the HTML page carries, so a retrieval system reading the
     Markdown and one reading the page agree on what this document is called. */
  const out: string[] = [
    `# ${guide.seoTitle ?? guide.title}`,
    '',
    `**${guide.question}**`,
    '',
    guide.summary,
    '',
  ];

  if (guide.criteria?.length) {
    out.push('## What decides it', '');
    guide.criteria.forEach((c, i) => out.push(`${i + 1}. **${c.name}** — ${c.why}`));
    out.push('');
  }
  if (guide.options?.length) {
    out.push('## Options', '');
    for (const o of guide.options) {
      out.push(`### ${o.name}`, '', `Correct when: ${o.whenCorrect}`, '');
      if (o.notes?.length) {
        for (const n of o.notes) out.push(`- ${n}`);
        out.push('');
      }
    }
  }
  if (guide.table) out.push('## Comparison', '', ...table(guide.table.head, guide.table.rows, guide.table.caption));
  if (guide.decisionTree?.length) {
    out.push('## Decision sequence', '');
    guide.decisionTree.forEach((s, i) => out.push(`${i + 1}. ${s}`));
    out.push('');
  }
  if (guide.spec?.length) {
    out.push('## Specification', '', ...table(['Item', 'Specification'], guide.spec.map((s) => [s.label, s.value])));
  }
  if (guide.sequence?.length) {
    out.push('## Build sequence', '');
    guide.sequence.forEach((s, i) => out.push(`${i + 1}. ${s}`));
    out.push('');
  }
  if (guide.watchpoints?.length) {
    out.push('## What goes wrong here', '');
    for (const w of guide.watchpoints) out.push(`- ${w}`);
    out.push('');
  }
  if (guide.faqs?.length) {
    out.push('## Related questions', '');
    for (const f of guide.faqs) out.push(`### ${f.q}`, '', f.a, '');
  }
  out.push('## Recommendation', '', guide.recommendation.text, '');
  if (guide.recommendation.conditions?.length) {
    out.push('Conditional on:', '');
    for (const c of guide.recommendation.conditions) out.push(`- ${c}`);
    out.push('');
  }
  out.push(
    ...provenance(canonical, [
      `- Published: ${guide.publishedAt}`,
      `- Sources: ${guide.sources.map((s) => `${SITE_URL}/papers/${s.paper}#${s.section}`).join(', ')}`,
    ]),
  );
  return out.join('\n');
};

/* ── glossary ─────────────────────────────────────────────────────────────── */

export const termToMarkdown = (term: GlossaryTerm): string => {
  const canonical = `${SITE_URL}/glossary/${term.slug}`;
  const out: string[] = [`# ${term.term}`, ''];
  if (term.aka?.length) out.push(`*Also called: ${term.aka.join(', ')}*`, '');
  out.push(`**${term.short}**`, '');
  for (const p of term.body) out.push(p, '');
  if (term.related?.length) {
    out.push('## Related terms', '');
    for (const r of term.related) {
      const t = getTerm(r);
      out.push(`- [${t?.term ?? r}](${SITE_URL}/glossary/${r})`);
    }
    out.push('');
  }
  out.push(
    ...provenance(canonical, [
      `- Defined in: ${SITE_URL}/papers/${term.source.paper}#${term.source.section}`,
    ]),
  );
  return out.join('\n');
};

/* ── services ─────────────────────────────────────────────────────────────── */

/**
 * WHY THESE ARE HERE AND WERE NOT BEFORE
 *
 * F-153. The corpus carried papers, guides and glossary — the technical
 * material — and nothing else. An agent asked "who refinishes hardwood floors
 * in Etobicoke" fetched /llms-full.txt and found no service, no price, no area:
 * every commercial and local surface on the site was invisible to the one file
 * built for agents to read.
 *
 * That is the query class this business exists to win, and it was the one class
 * the machine-readable edition could not answer. The technical corpus makes the
 * site citable; this makes it actionable.
 */
export const serviceToMarkdown = (page: ServicePage): string => {
  const svc = serviceFor(page);
  const canonical = `${SITE_URL}/services/${page.slug}`;
  const band = priceBand(page);
  const out: string[] = [
    `# ${svc?.name ?? page.h1}`,
    '',
    `**${page.h1}**`,
    '',
    page.standfirst,
    '',
    svc?.blurb ?? '',
    '',
  ];

  const rows: string[][] = [['Service', svc?.name ?? page.h1]];
  if (band) rows.push(['Published price band', band]);
  rows.push(['Areas served', CITIES.map((c) => areaDisplayName(c)).join(', ')]);
  out.push(...table(['Field', 'Value'], rows));

  const pillars = PILLARS.filter((p) => page.pillars.includes(p.id));
  if (pillars.length) {
    out.push('## The standard this work is judged against', '');
    for (const p of pillars) {
      out.push(`### ${p.name}`, '', p.intent, '', `- ${p.criteria.length} criteria — ${SITE_URL}/framework#${p.id}`, '');
    }
  }

  if (page.papers.length) {
    out.push('## Where the method is established', '');
    for (const r of page.papers) {
      out.push(`- ${r.label} — ${SITE_URL}/papers/${r.paper}#${r.section}`);
    }
    out.push('');
  }

  const faqs = faqsFor(page);
  if (faqs.length) {
    out.push('## Questions this service turns on', '');
    for (const f of faqs) {
      out.push(`**${f.q}**`, '', f.a, '', `Source: ${SITE_URL}${f.href}`, '');
    }
  }

  out.push(...provenance(canonical, band ? [`- Price band: ${band}`] : []));
  return out.join('\n');
};

/* ── service areas ────────────────────────────────────────────────────────── */

export const areaToMarkdown = (slug: string, name: string, cc: CityContent): string => {
  const canonical = `${SITE_URL}/service-areas/${slug}`;
  /*
   * The twin names the place exactly as the HTML page does ("Buffalo, NY",
   * "Niagara Falls, ON") and states the same service sentence, verbatim. Until
   * GEO-001 the HTML said "… in Buffalo, NY" and carried the sentence while the
   * twin said "… in Buffalo" and did not (GC-015). A twin may format
   * differently; it may not say something different.
   */
  const displayName = areaDisplayName({ slug, name });
  const isUS = US_AREA_SLUGS.has(slug);
  const out: string[] = [
    `# Hardwood floor installation & refinishing in ${displayName}`,
    '',
    `Ecowoods serves ${displayName}. Book the measure.` +
      (isUS ? ` The showroom is Toronto. The job is in ${name}. We take this work.` : ''),
    '',
    cc.intro,
    '',
    '## Areas covered',
    '',
    cc.neighbourhoods.join(', ') + '.',
    '',
    '## Housing stock and what it means for the floor',
    '',
    cc.housingNote,
    '',
  ];
  if (cc.localConsideration) {
    out.push('## The practical constraint here', '', cc.localConsideration, '');
  }
  if (cc.signatureProject) {
    out.push('## A project in this area', '', cc.signatureProject, '');
  }
  out.push('## Services delivered here', '');
  for (const sp of getServicePages()) {
    const svc = serviceFor(sp);
    /* The band for the country this area is in (GEO-004). This called
       priceBand(), which is the Ontario set, so every New York twin published
       Canadian dollars under an American place name. */
    const band = priceBandIn(sp, isUS ? 'US' : 'CA');
    out.push(`- **${svc?.name ?? sp.h1}**${band ? ` (${band})` : ''} — ${SITE_URL}/services/${sp.slug}`);
  }
  if (isUS) {
    out.push(
      '',
      'These bands are published in United States dollars for work in New York State. The border crossing ' +
        'and the travel from the Toronto shop are already inside them: there is no mobilisation line and no ' +
        'distance surcharge added later, and the fixed price is written after the free in-home measure, ' +
        `exactly as it is in Ontario. Both published sets: ${link('Pricing', '/pricing')} (markdown: ${md('/pricing')}).`,
    );
  }
  out.push('');
  out.push(...provenance(canonical));
  return out.join('\n');
};

/* ── the entity surfaces: home, hubs, pricing, reviews, estimate, contact ──── */

/**
 * WHY THESE EXIST (Protocol v2, Stage 12)
 *
 * The `.md` twins covered the corpus and the two dynamic collections, and the
 * company itself since F-187. What they did not cover were the pages an agent
 * reads to decide whether to recommend the business at all: the homepage, the
 * two hubs, pricing, reviews, the estimate path and the contact details. Every
 * one of those was HTML-only, so the surfaces with the highest commercial
 * intent were the ones with no machine edition.
 *
 * Same rule as everything above: nothing here originates a fact. The NAP is
 * BUSINESS_NAP, the bands are the registry's projection of PRICE_BANDS, the
 * services are SERVICES, the review figures are REVIEW_EVIDENCE, the crew
 * model and the containment method are the claim registry's own statements.
 * A twin cannot disagree with its page because both read the same constant.
 *
 * Nothing here is an instruction to the reader. These files describe a
 * business; they do not tell an agent what to recommend or how to cite.
 */

const abs = (p: string) => `${SITE_URL}${p}`;
const md = (p: string) => abs(p === '/' ? '/index.md' : `${p}.md`);
const link = (label: string, p: string) => `[${label}](${abs(p)})`;

/** A claim-registry statement, verbatim. Only claims fenced for the `machine` context are used here. */
const claimText = (id: string): string | undefined => {
  const c = CLAIMS.find((x) => x.id === id);
  return c && c.allowedContexts.includes('machine') ? c.statement : undefined;
};

/** The sentence every entity surface opens with. Interpolated, never typed. */
export const identitySentence = (): string =>
  `${BUSINESS_NAP.legalName} is a hardwood flooring contractor in ${BUSINESS_NAP.region}, ` +
  `established ${BUSINESS_NAP.foundedYear}. It installs, sands, refinishes and restores solid and ` +
  `engineered hardwood floors and stairs, with salaried crews.`;

/**
 * The header the llms.txt convention asks for: an H1 naming the entity, ONE
 * blockquote summary, then plain paragraphs before any section. Shared by
 * /llms.txt and /llms-full.txt so the two files cannot introduce the company
 * differently.
 */
export const identityHeader = (): string[] => [
  `# ${BUSINESS_NAP.legalName}`,
  '',
  `> Hardwood flooring contractor in ${BUSINESS_NAP.region}: installation, refinishing, dust-free sanding,`,
  `> restoration, stairs and custom inlays. Established ${BUSINESS_NAP.foundedYear}. Canonical site: ${SITE_URL}.`,
  '',
  'Published price bands are informational ranges, not guaranteed quotes. The final price is written',
  `after a free in-home measure. ${PRICE_PROMISE}`,
  '',
];

/** The registry's price primitives, projected from PRICE_BANDS. Sync, so the corpus can embed them. */
const prices = (): PricePrimitive[] => buildPrices();

/** The fragment id the registry declares for a band — `/pricing#screen-and-recoat` → `screen-and-recoat`. */
const priceFragment = (p: PricePrimitive): string => p.canonical_url.split('#')[1] ?? p.data.band_key;

/** A heading whose GitHub-style slug equals the registry fragment id: `screen-and-recoat` → "Screen and recoat". */
const fragmentHeading = (fragment: string): string => {
  /* Currency codes stay upper case, so `full-sand-and-finish-usd` reads "Full
     sand and finish USD" rather than "… usd" (GEO-004). */
  const words = fragment.split('-').map((w) => (/^(usd|cad)$/.test(w) ? w.toUpperCase() : w));
  return words[0].charAt(0).toUpperCase() + words[0].slice(1) + (words.length > 1 ? ` ${words.slice(1).join(' ')}` : '');
};

/**
 * The published bands as one table, then the caveat sentence. The caveat is
 * not decoration: it is the sentence the registry says must travel with the
 * number, and a table quoted without it is a quote this business never gave.
 */
/** Where a band applies, named with its currency. Two rows can say "Screen & Recoat". */
const bandScope = (p: PricePrimitive): string =>
  p.data.currency === 'CAD' ? 'Ontario (CAD)' : 'New York State (USD)';

const priceTable = (list: PricePrimitive[] = prices()): string[] => [
  ...table(
    ['Scope', 'Where', 'Published band', 'Applies when'],
    list.map((p) => [p.data.label, bandScope(p), p.data.formatted, p.data.conditions[0] ?? '']),
  ),
  `${PRICE_PROMISE} A band is an informational range, not a quote; the fixed price is written after the free in-home measure.`,
  '',
];

/** Every service as a link with its blurb and its band, or the honest alternative to a band. */
const serviceLines = (slugs: string[] = SERVICES.map((s) => s.slug)): string[] =>
  slugs
    .map((slug) => SERVICES.find((s) => s.slug === slug))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((s) => {
      const page = getServicePage(s.slug);
      const band = page ? priceBand(page) : undefined;
      return `- ${link(s.name, `/services/${s.slug}`)}: ${s.blurb} ${band ? `Published band: ${band}.` : 'Quoted per project after the in-home measure.'}`;
    });

/** The review record as a table, cited to source with a read date. */
const reviewTable = (): string[] =>
  table(
    ['Platform', 'Rating', 'Reviews', 'Most recent', 'Figures read', 'Profile'],
    REVIEW_EVIDENCE.map((r) => [
      r.platform,
      `${r.rating.toFixed(1)} / ${r.outOf}`,
      String(r.count),
      r.latestReviewAt ?? 'see profile',
      r.asOf,
      r.href,
    ]),
  );

const REVIEW_RULE =
  'These figures are cited statistics: platform, count, rating, profile link and the date a person read ' +
  'them off the live profile. They are never blended into a rating of our own or emitted as a schema.org ' +
  'aggregateRating, because ratings collected on another platform are that platform’s to publish.';

/** The three ways to start a job, from the registry's action primitives. */
const actionLines = (): string[] => {
  const actions = buildActions();
  const find = (name: string) => actions.find((a) => a.data.name === name);
  const estimate = find('request_estimate');
  const call = find('call');
  const email = find('email');
  return [
    estimate ? `- ${link('Request an estimate', '/estimate')}: ${estimate.data.description} ${estimate.data.outcome}` : '',
    call ? `- Call [${BUSINESS_NAP.phoneDisplay}](${call.data.target}): ${call.data.outcome} Hours: ${HOURS_LINE} (${BUSINESS_TIMEZONE_NAME}).` : '',
    email ? `- Email [${BUSINESS_NAP.email}](${email.data.target}): ${email.data.outcome}` : '',
  ].filter(Boolean);
};

/** Name, address, phone, email, hours — the NAP block every entity surface ends with. */
const napTable = (): string[] =>
  table(
    ['Field', 'Value'],
    [
      ['Legal name', BUSINESS_NAP.legalName],
      ['Known as', BUSINESS_NAP.shortName],
      ['Address', BUSINESS_ADDRESS_LINE],
      ['Telephone', `[${BUSINESS_NAP.phoneDisplay}](${BUSINESS_NAP.phoneHref})`],
      ['Email', `[${BUSINESS_NAP.email}](mailto:${BUSINESS_NAP.email})`],
      ['Hours', `${HOURS_LINE} (${BUSINESS_TIMEZONE_NAME})`],
      ['Established', String(BUSINESS_NAP.foundedYear)],
      ['Service territory', TERRITORY],
      ['Website', SITE_URL],
    ],
  );

/* /index.md — the homepage twin. */
export const homeToMarkdown = (): string => {
  const canonical = SITE_URL;
  const out: string[] = [
    ...identityHeader(),
    identitySentence(),
    '',
    '## Services',
    '',
    ...serviceLines(),
    '',
    `Hub: ${link('All services', '/services')} · markdown: ${md('/services')}`,
    '',
    '## Published price bands',
    '',
    ...priceTable(),
    `Conditions and what moves a number inside a band: ${link('Pricing', '/pricing')} (${md('/pricing')}).`,
    '',
    '## Where the work is done',
    '',
    `${TERRITORY}. ${PUBLISHED_PARTITION.total} published service areas — ${PUBLISHED_PARTITION.municipalities} municipalities, ` +
      `${PUBLISHED_PARTITION.districts} districts and communities within a municipality, and ` +
      `${PUBLISHED_PARTITION.neighbourhoods} Toronto neighbourhoods — each with its own page: ` +
      `${link('Service areas', '/service-areas')} (${md('/service-areas')}).`,
    '',
    '## Evidence',
    '',
    `- ${link('Case studies', '/case-studies')}: measured jobs, each publishing the readings taken before the work.`,
    `- ${link('Data and figures', '/data')}: charted data with its source table.`,
    `- ${link('Reviews', '/reviews')}: ${PRIMARY_REVIEW_EVIDENCE.count} reviews at ` +
      `${PRIMARY_REVIEW_EVIDENCE.rating.toFixed(1)}/${PRIMARY_REVIEW_EVIDENCE.outOf} on ${PRIMARY_REVIEW_EVIDENCE.platform}, ` +
      `read ${PRIMARY_REVIEW_EVIDENCE.asOf}, cited to source.`,
    '',
    '## Get a fixed written price',
    '',
    ...actionLines(),
    '',
    '## Contact',
    '',
    ...napTable(),
  ];
  out.push(...provenance(canonical, [`- Markdown index of every page twin: ${abs('/md')}`]));
  return out.join('\n');
};

/* /services.md — the hub. */
export const servicesHubToMarkdown = (): string => {
  const canonical = abs('/services');
  const out: string[] = [
    '# Hardwood flooring services',
    '',
    identitySentence(),
    '',
    `${SERVICES.length} services, each with its own page. Where a price band is published it is stated; ` +
      'where it is not, the service is quoted per project after the free in-home measure.',
    '',
  ];
  for (const s of SERVICES) {
    const page = getServicePage(s.slug);
    const band = page ? priceBand(page) : undefined;
    out.push(`## ${s.name}`, '', s.blurb, '');
    if (page && page.standfirst) out.push(page.standfirst, '');
    out.push(
      `- Price: ${band ? `${band}, fixed in writing after the in-home measure` : 'quoted per project after the in-home measure'}`,
      `- Canonical URL: ${abs(`/services/${s.slug}`)}`,
      `- Markdown: ${md(`/services/${s.slug}`)}`,
      '',
    );
  }
  out.push(...priceTable());
  out.push(...provenance(canonical, [`- Pricing in full: ${abs('/pricing')}`]));
  return out.join('\n');
};

/* /service-areas.md — the hub. */
export const areasHubToMarkdown = (): string => {
  const canonical = abs('/service-areas');
  const crew = claimText('workforce.salaried');
  const out: string[] = [
    `# Hardwood flooring service areas — ${TERRITORY}`,
    '',
    identitySentence(),
    '',
    '## Who is served',
    '',
    `Homeowners, condominium owners and property managers across ${TERRITORY}: ` +
      `${PUBLISHED_PARTITION.total} published service areas, each with its own page.`,
    '',
    `Named but not published — assessed per project through the estimate path, and not claimed as covered: ` +
      `${DISCOVERY.map((d) => d.name).join(', ')}.`,
    '',
    '## What does not change by area',
    '',
    `- The price bands. They are published once and do not change by postal code: ${link('Pricing', '/pricing')}. ` +
      `Ontario is published in Canadian dollars and New York State in United States dollars, with the border ` +
      `crossing and the travel already inside the New York band — two published band sets, not a rate that ` +
      `varies by town.`,
    ...(crew ? [`- The crew model. ${crew}`] : []),
    `- The services: ${SERVICES.map((s) => link(s.name, `/services/${s.slug}`)).join(', ')}.`,
    '',
    '## What changes by area',
    '',
    'The housing stock and the substrate under it. A pre-war semi on a wood-joist subfloor, a post-war ' +
      'bungalow and a concrete-slab condominium are different jobs with different moisture questions, and ' +
      'each area page below says which it is.',
    '',
    '## Municipalities',
    '',
    ...CITIES.map((c) => `- ${link(areaDisplayName(c), `/service-areas/${c.slug}`)} — markdown: ${md(`/service-areas/${c.slug}`)}`),
    '',
    '## Toronto neighbourhoods',
    '',
    ...NEIGHBOURHOOD_AREAS.map((c) => `- ${link(c.name, `/service-areas/${c.slug}`)} — markdown: ${md(`/service-areas/${c.slug}`)}`),
    '',
    /* Districts and communities inside a municipality — the six former
       municipalities of Toronto among them since GEO-001. Listed under their
       parent rather than as peers of it, because that is what they are: the
       machine edition of this page is read literally, and Ancaster is not a
       city beside Hamilton. */
    '## Districts and communities within a municipality',
    '',
    ...DISTRICT_AREAS.map(
      (c) => `- ${link(c.name, `/service-areas/${c.slug}`)} — in ${c.partOf} — markdown: ${md(`/service-areas/${c.slug}`)}`,
    ),
    '',
  ];
  out.push(...provenance(canonical));
  return out.join('\n');
};

/* ── corridors ──────────────────────────────────────────────── */

/**
 * THE ROUTES, AS MACHINE TEXT (GEO-002).
 *
 * `/corridors` is the page that answers the question a service-area list
 * cannot: not "do you have a page for my town" but "how would you get here".
 * It had no Markdown twin and none was advertised (GC-022), so the one surface
 * that carries routing, hubs and the per-market operational statement was the
 * one an agent had to scrape a table out of.
 *
 * Both files below are projections of content/geo/corridors.ts and
 * content/geo/markets.ts. The status sentence in each row is
 * `operationalTruth.statement` verbatim, with the date the owner confirmed it;
 * nothing is summarised, because summarising is where an export starts making
 * claims of its own.
 *
 * Districts sit in a column of their own, under the municipality that contains
 * them. A reader — human or machine — can no more take Ancaster for a peer of
 * Guelph here than on the page.
 */
const statusSentence = (slug: string): string => {
  const m = marketBySlug(slug);
  if (!m) return '';
  const stated =
    m.operationalTruth.statement ||
    'No confirmed operational position. On the route and in the plan; ask before assuming a date.';
  return m.operationalTruth.verifiedAt ? `${stated} (confirmed ${m.operationalTruth.verifiedAt})` : stated;
};

const marketCell = (slug: string, name: string): string => {
  const m = marketBySlug(slug);
  const linked = m && assess(m).indexable && cityContent(slug) ? link(name, `/service-areas/${slug}`) : name;
  return m?.country === 'US' ? `${linked} (NY)` : linked;
};

/** /corridors.md — every route, and where to read each one in full. */
export const corridorsHubToMarkdown = (): string => {
  const canonical = abs('/corridors');
  const out: string[] = [
    `# Coverage by corridor — the ${CORRIDORS.length} routes this work is organised along`,
    '',
    identitySentence(),
    '',
    '> A corridor is a drive: a hub, a highway, and the municipalities strung along it in the order a crew',
    `> would reach them. It is not a marketing region. Territory: ${TERRITORY}.`,
    '',
    '## The routes',
    '',
    ...table(
      ['Route', 'Follows', 'Out from', 'Municipalities', 'Districts inside them', 'Confirmed', 'With a page', 'Markdown'],
      CORRIDORS.map((c) => {
        const all = corridorMarkets(c.id);
        return [
          link(c.name, `/corridors/${c.id}`),
          c.route,
          marketBySlug(c.hub)?.name ?? c.hub,
          String(c.members.length),
          String(all.length - c.members.length),
          String(all.filter((m) => m.operationalTruth.verifiedAt).length),
          String(all.filter((m) => assess(m).indexable).length),
          md(`/corridors/${c.id}`),
        ];
      }),
    ),
    '## What a member is, and what it is not',
    '',
    'A member of a corridor is a MUNICIPALITY. The districts and communities inside one — Ancaster and',
    'Dundas inside Hamilton, Kenmore inside Tonawanda, Stoney Creek inside Hamilton — are reported under',
    'the municipality they belong to and never beside it. A district is somewhere inside a stop, not',
    'another stop on the drive.',
    '',
    '## What the statuses mean',
    '',
    '- **Routine.** Worked from the Toronto shop as a matter of course, within the daily-return radius.',
    '- **Active.** Taking work; coverage established but not yet routine.',
    '- **In the corridor.** On the route and in the plan, with no confirmed operational position yet.',
    '- **By confirmation.** Outside the daily-return radius; the job is scheduled as a trip, and that sits',
    '  in the written price rather than appearing later.',
    '- **New York State.** Ecowoods takes this work. The shop, the showroom and the telephone number are',
    '  the single Toronto ones; what crosses the border is the job.',
    '',
    '## Coverage is not proof',
    '',
    'A confirmed operational position means the owner of this business stated, on a date, what coverage of',
    'that municipality means. It does not mean a job there has been photographed and published. Both are on',
    `the record and they are not the same thing: the dates are in ${abs('/api/v1/markets')}, and the`,
    `published jobs are at ${abs('/where-we-work')} (markdown: ${md('/where-we-work')}).`,
    '',
    '## Where a page comes from',
    '',
    'A municipality gets a page of its own when it has something specific to say — the housing stock, the',
    'substrate, the constraint that actually differs there. Until then it lives on its corridor, findable',
    `and linked. The published areas are at ${abs('/service-areas')} (markdown: ${md('/service-areas')}).`,
    '',
  ];
  out.push(
    ...provenance(canonical, [
      `- Structured data: ${abs('/api/v1/corridors')}`,
      `- Market registry: ${abs('/api/v1/markets')}`,
    ]),
  );
  return out.join('\n');
};

/** /corridors/{id}.md — one route, every stop, every operational statement. */
export const corridorToMarkdown = (c: Corridor): string => {
  const canonical = abs(`/corridors/${c.id}`);
  const stops = corridorStops(c.id);
  const all = corridorMarkets(c.id);
  const hub = marketBySlug(c.hub);
  const out: string[] = [
    `# ${c.name}`,
    '',
    `> ${c.route}. Out from ${hub?.name ?? c.hub}.`,
    '',
    c.summary,
    '',
    `${stops.length} municipalities on the route` +
      (all.length > stops.length ? `, with ${all.length - stops.length} districts and communities inside them` : '') +
      `. ${all.filter((m) => m.operationalTruth.verifiedAt).length} of the ${all.length} have a confirmed ` +
      `operational position; ${all.filter((m) => assess(m).indexable).length} have a page of local detail.`,
    '',
    '## Along the route, in travel order',
    '',
    ...table(
      ['#', 'Municipality', 'Within it', 'Status', 'What that means here'],
      stops.map((stop, i) => [
        String(i + 1),
        marketCell(stop.municipality.slug, stop.municipality.name),
        stop.districts.length ? stop.districts.map((d) => marketCell(d.slug, d.name)).join(', ') : '—',
        stop.municipality.status,
        statusSentence(stop.municipality.slug),
      ]),
    ),
  ];

  const districts = all.filter((m) => m.kind === 'district');
  if (districts.length) {
    out.push(
      '## The districts and communities on this route',
      '',
      'Each is part of the municipality named beside it, not a municipality of its own.',
      '',
      ...table(
        ['District or community', 'Part of', 'Status', 'What that means here'],
        districts.map((d) => [
          marketCell(d.slug, d.name),
          marketBySlug(d.partOf ?? '')?.name ?? (d.partOf ?? '—'),
          d.status,
          statusSentence(d.slug),
        ]),
      ),
    );
  }

  if (all.some((m) => m.country === 'US')) {
    out.push(
      '## Working in New York State',
      '',
      `Ecowoods serves these municipalities. The shop and showroom are at ${BUSINESS_ADDRESS_LINE}, and that`,
      'is the only address this company has: there is no second office, no local telephone number and no',
      'separate crew in New York State. The crews are the same salaried employees who work in Toronto. What',
      'travels is the work, not a storefront; the published price is fixed after a free in-home measure,',
      'exactly as it is in Ontario.',
      '',
    );
  }

  out.push(
    '## Before you call about a market on this route',
    '',
    `The published price bands are the same everywhere in Ontario, and New York State has its own published ` +
      `bands in United States dollars: ${link('Pricing', '/pricing')} (markdown: ${md('/pricing')}).`,
    'Within a country, distance shows up in the written price after the measure, not as a different rate card.',
    '',
    `Every route: ${link('Corridors', '/corridors')} (markdown: ${md('/corridors')}).`,
    '',
  );
  out.push(
    ...provenance(canonical, [
      `- Structured data: ${abs('/api/v1/corridors')}`,
      `- This route as data: ${abs(`/api/v1/markets?corridor=${c.id}`)}`,
    ]),
  );
  return out.join('\n');
};

export const corridorMarkdown = (id: string): string | null => {
  const c = corridorById(id);
  return c ? corridorToMarkdown(c) : null;
};

/* ── where the work has been done ───────────────────────────────── */

/**
 * /where-we-work.md — proof, kept apart from coverage.
 *
 * The corridor pages say where this business will drive. This one says where it
 * has demonstrably worked, and a pin may only exist if it points at a published
 * case study with the measurements in it (content/work-map.ts,
 * scripts/verify-work-map.mjs). The twin publishes the same five facts the page
 * does and deliberately not the sixth: no coordinate appears here, because
 * COORDS_VERIFIED is false and a drawn map at sixty kilometres wide tolerates a
 * three-hundred-metre error where a machine-readable claim does not.
 */
export const whereWeWorkToMarkdown = (): string => {
  const canonical = abs('/where-we-work');
  const years = WORK_PLACES.map((w) => w.year);
  const out: string[] = [
    '# Where the work has been done',
    '',
    identitySentence(),
    '',
    `> ${WORK_PLACES.length} published jobs, ${Math.min(...years)}–${Math.max(...years)}, each one linked to`,
    '> the case study that carries its measurements. Neighbourhood precision only: no customer address is',
    '> published, and none is held in the data this file is generated from.',
    '',
    '## Coverage and proof are two different statements',
    '',
    `A service-area page is a claim: ${PUBLISHED_PARTITION.total} of them say this business works in those`,
    'places. This file is the other kind of statement — here is a job, here is the year, here is the square',
    'footage, and here is the document with the readings in it. A place can be covered without appearing',
    `below, and the corridors at ${abs('/corridors')} say which (markdown: ${md('/corridors')}).`,
    '',
    '## The published jobs',
    '',
    /* The label is the neighbourhood the job was in; the link is the published
       area page that neighbourhood belongs to, and they are two columns rather
       than one because "Distillery District" pointing at /service-areas/
       downtown-toronto reads, collapsed into a single cell, as a claim that the
       Distillery District is a service area of its own. It is not. */
    ...table(
      ['Neighbourhood', 'Area page', 'Year', 'Floor area (sq ft)', 'Service', 'What it was', 'Case study'],
      WORK_PLACES.map((w) => [
        w.label,
        marketCell(w.areaSlug, marketBySlug(w.areaSlug)?.name ?? w.areaSlug),
        String(w.year),
        String(w.sqft),
        link(SERVICES.find((x) => x.slug === w.serviceSlug)?.name ?? w.serviceSlug, `/services/${w.serviceSlug}`),
        w.summary,
        abs(`/case-studies/${w.caseStudySlug}`),
      ]),
    ),
    '## Why it is thin, and what makes it thick',
    '',
    'A pin may only exist if it points at a published case study with the measurements in it. That is the',
    'whole design: this list cannot be padded, and it gets denser the way everything else here does — by',
    'publishing the next job.',
    '',
  ];
  out.push(...provenance(canonical, [`- Published areas: ${abs('/service-areas')}`]));
  return out.join('\n');
};

/* /pricing.md — table first, conditions second, the written price third. */
export const pricingToMarkdown = (list: PricePrimitive[] = prices()): string => {
  const canonical = abs('/pricing');
  const promise = claimText('pricing.fixedInWriting') ?? PRICE_PROMISE;
  const out: string[] = [
    '# Hardwood flooring prices — published bands',
    '',
    identitySentence(),
    '',
    'The bands below are the only prices this business publishes. Every band is per square foot and is ' +
      'an informational range: the fixed price is written after the free in-home measure, not from a ' +
      'range. There are two sets, one per country — Ontario in Canadian dollars, New York State in ' +
      'United States dollars with the border crossing and the travel already inside the band. Within a ' +
      'country a band does not change by town; distance shows up in the written price after the measure.',
    '',
    ...priceTable(list),
    '## Conditions',
    '',
    'What each band covers and what moves a number inside it.',
    '',
  ];
  for (const p of list) {
    const fragment = priceFragment(p);
    out.push(`### ${fragmentHeading(fragment)}`, '', `**${p.data.label}**, ${bandScope(p)} — ${p.data.formatted}.`, '');
    for (const c of p.data.conditions) out.push(`- ${c}`);
    out.push('', `Anchor on the page: ${abs('/pricing')}#${fragment} · last verified ${p.provenance.verified_at}.`, '');
  }
  out.push(
    '## Fixed price',
    '',
    promise,
    '',
    `The estimator measures the rooms, moisture-tests the floor and the subfloor, and the written estimate ` +
      `follows with a committed schedule. ${PRICE_PROMISE}`,
    '',
    '## Estimate',
    '',
    ...actionLines(),
    '',
  );
  out.push(...provenance(canonical, [`- Structured: ${abs('/api/v1/pricing')}`]));
  return out.join('\n');
};

/* /reviews.md — the review record, cited to source. */
export const reviewsToMarkdown = (): string => {
  const canonical = abs('/reviews');
  const out: string[] = [
    `# ${BUSINESS_NAP.shortName} reviews — cited to source`,
    '',
    identitySentence(),
    '',
    `${BUSINESS_NAP.legalName} has ${PRIMARY_REVIEW_EVIDENCE.count} customer reviews at ` +
      `${PRIMARY_REVIEW_EVIDENCE.rating.toFixed(1)} out of ${PRIMARY_REVIEW_EVIDENCE.outOf} on ` +
      `${PRIMARY_REVIEW_EVIDENCE.platform}, read ${PRIMARY_REVIEW_EVIDENCE.asOf}.`,
    '',
    ...reviewTable(),
    REVIEW_RULE,
    '',
    '## Verified profiles',
    '',
    ...PROFILE_LINKS.filter((p) => p.href).map((p) => `- ${p.label}: ${p.href}`),
    '',
    'A profile appears here only after its URL has been opened and confirmed to show this company. ' +
      'The same links are declared as `sameAs` in the organisation schema.',
    '',
  ];
  out.push(...provenance(canonical, [`- Structured: ${abs('/api/v1/reviews')}`]));
  return out.join('\n');
};

/* /estimate.md — the estimate path, in three steps. */
export const estimateToMarkdown = (): string => {
  const canonical = abs('/estimate');
  const request = buildActions().find((a) => a.data.name === 'request_estimate');
  const out: string[] = [
    '# Request a fixed written price',
    '',
    identitySentence(),
    '',
    '## Steps',
    '',
    '1. **In-home measure.** A senior estimator measures the rooms and moisture-tests the floor and the subfloor. The visit is free.',
    `2. **Fixed written price.** ${PRICE_PROMISE} The written estimate carries a committed schedule.`,
    '3. **The work.** Salaried crews, HEPA-sealed extraction at the machine and containment at the room; most refinishing clients stay in the house.',
    '',
    ...(request ? [request.data.outcome, ''] : []),
    '## Form',
    '',
    `Book the measure through the estimate form: ${abs('/estimate')}#form`,
    '',
    '## Call',
    '',
    ...actionLines().filter((l) => !l.startsWith('- [Request')),
    '',
    '## Before you book',
    '',
    `The published price bands are informational ranges, not quotes: ${link('Pricing', '/pricing')} (${md('/pricing')}).`,
    '',
  ];
  out.push(...provenance(canonical, [`- Structured actions: ${abs('/api/v1/actions')}`]));
  return out.join('\n');
};

/* /floor-studio.md — what Floor Studio is, for a machine that has to decide
   whether to name it.

   THE POINT OF THIS FILE

   An assistant asked "can I see a hardwood floor in a photo of my own room
   before I buy it, in Toronto" has no way to learn that this exists from a page
   whose interactive half is a canvas. So the twin states the capability, the
   vocabulary it accepts, and — the part that matters most for a tool of this
   kind — the four things it refuses to do. A visualiser that will not say what
   it invents is one a careful assistant should not recommend, and this one
   invents nothing. */
/**
 * /design.md — THE OTHER DOOR (UI-NAV-02).
 *
 * Floor Studio has had a machine edition since it shipped. The configurator it
 * hands people on to had none, no breadcrumb schema and no entry in the primary
 * navigation — so a retrieval system asking "can I specify a hardwood floor on
 * this site" found one of the two doors and a person using the header found the
 * same one. They are not duplicates: the studio shows a floor to somebody who
 * does not yet know what they want, and this is where somebody who does
 * finishes the specification. Both facts are now stated in both editions.
 */
export const designToMarkdown = (): string => {
  const canonical = abs('/design');
  const out: string[] = [
    '# Design your floor — the Ecowoods configurator',
    '',
    '> Choose species, finish, pattern and board width and see the published installed band',
    '> applied to your area, then hand the exact configuration to the estimate form or to the',
    '> assistant without retyping it.',
    '',
    identitySentence(),
    '',
    '## Which of the two doors this is',
    '',
    `This site has two ways into the same catalogue, the same pricing function and the same`,
    'handoff. They are for different people, not different products:',
    '',
    `- ${link('Floor Studio', '/floor-studio')} (${md('/floor-studio')}) — for somebody who does not`,
    '  yet know what they want. Upload a photograph of the room and see a real configuration',
    '  rendered into it.',
    `- ${link('The configurator', '/design')} (${md('/design')}) — this page. For somebody who already`,
    '  knows they want hardwood and wants to specify it: every axis at once, no photograph needed.',
    '',
    'Moving between them changes nothing about the floor, the catalogue or the price.',
    '',
    '## Region and currency',
    '',
    'The studio is priced against the published bands of the region the floor is in: Ontario in',
    'Canadian dollars, New York State in United States dollars. It is ASKED FOR and CARRIED, never',
    'inferred \u2014 no IP lookup and no locale sniffing, because a visitor on a Toronto laptop planning',
    'a Buffalo rental is not a Canadian job. A city page links the studio with its own region,',
    'the studio states on screen which bands are in use, the visitor can change it, and the share',
    'code carries it so a link opens in the currency it was built in.',
    '',
    '- ' + abs('/floor-studio') + '?region=US opens against the New York bands.',
    '- ' + abs('/floor-studio') + '?region=CA, or no parameter, opens against the Ontario bands.',
    '',
    '## Camera',
    '',
    '- Entry point: ' + abs('/floor-studio') + '#live opens the camera directly.',
    '- Permission: requested on open. A refusal, a camera already in use, a device without one, or an insecure context each produce a named, actionable sentence, and every one of them offers photo upload as the way through.',
    '- Privacy: no frame leaves the device. There is no endpoint that accepts one.',
    '',
    '## Vocabulary it accepts',
    '',
    `- Species: ${FLOOR_PRODUCTS.map((p) => p.name).join(', ')}`,
    `- Finishes: ${FINISH_OPTIONS.map((f) => f.label).join(', ')}`,
    `- Patterns: ${PATTERN_OPTIONS.map((p) => p.label).join(', ')}`,
    `- Board widths: ${BOARD_WIDTHS.map((w) => w.label).join(', ')}`,
    '',
    '## Price',
    '',
    `New hardwood installation is published at ${formatBand(NEW_INSTALL)}. The configurator applies`,
    'that published band to the area given. Species, finish, pattern and board width change the',
    'floor and where the written price lands inside the band; they do not change the band.',
    `${PRICE_PROMISE}`,
    '',
    `Published bands: ${link('Pricing', '/pricing')} (${md('/pricing')}).`,
    `Fixed written price: ${link('Request an estimate', '/estimate')} (${md('/estimate')}).`,
    '',
    '## What it will not do',
    '',
    '- It does not produce a quote. The figure is an estimated installed range and is labelled as one.',
    '- It does not measure the room. The area is given by the person, because a configurator cannot know it.',
    '',
  ];
  out.push(...provenance(canonical, [`Companion: ${abs('/floor-studio')}`]));
  return out.join('\n');
};

export const floorStudioToMarkdown = (): string => {
  const canonical = abs('/floor-studio');
  const out: string[] = [
    '# Ecowoods Floor Studio',
    '',
    '> Point a camera at a room, or upload a photograph of one, and see real Ecowoods hardwood',
    '> configurations rendered into it — live, at video rate — with an estimated installed range',
    '> in the currency of the region the floor is in. Every frame is analysed and composited',
    /* "never uploaded" ON ONE LINE, and it has to stay that way. This blockquote
       is hard-wrapped, and the wrap fell between "never" and "uploaded" — which
       is invisible in the rendered markdown and fatal to the assertion in
       tests/floor-studio.test.ts that this file states the privacy claim at all.
       The test was right and the source was wrong: a claim a machine is meant to
       quote should not be breakable by a line break. */
    '> in the browser and is never uploaded, and no image model is involved: every floor',
    '> shown is one Ecowoods can supply and install.',
    '',
    identitySentence(),
    '',
    '## What it does',
    '',
    '1. **Runs live on a camera.** `getUserMedia` with the rear camera, then for every frame: the floor plane is found, a mask decides which of those pixels are floor rather than furniture, and the chosen configuration is drawn into them through an exact projective map that keeps the room\u2019s own light. The analysis resolution adapts to what the device manages, targeting 24 frames a second. The stream stops when the view closes or the tab is hidden.',
    '2. **Reads a photograph, on the device.** Mean relative luminance, the undertone of the upper third of the frame, the tone of the existing floor, and an estimate of where the floor plane meets the walls. All of it is arithmetic over pixels.',
    '3. **Asks the person to correct it.** Four draggable, keyboard-operable corners. Confidence is reported as "measured" or "weak" — never as a percentage, because a percentage would be a claim about a distribution nobody estimated.',
    '4. **Asks for what a photograph cannot give.** The area in square feet and the room type. A single uncalibrated photograph cannot yield either, and the installed range is computed from the area.',
    '5. **Recommends real configurations.** Ranked by criteria that each return a sentence; the match percentage is the arithmetic over those sentences.',
    '6. **Renders the chosen floor into the room** and updates the estimated installed range as species, finish, pattern, board width or area change.',
    '7. **Hands the design to the estimate form** as structured data, so nothing is retyped.',
    '',
    '## What it refuses to do',
    '',
    '- It does not generate floors. Every board rendered is a configuration this company can supply and install; no image model is involved at any point.',
    '- It does not measure the room. It asks.',
    '- It does not produce a quote. The figure is an estimated installed range and is labelled as one everywhere it appears.',
    '- It does not retain the photograph, and it does not retain a camera frame. There is no upload endpoint. A shared design link carries the floor, never the room.',
    '- It does not call the live view measured. The still-photograph path gives a person four corners to drag and a boundary they have checked; the live path has neither, and says so on screen.',
    '',
    '## Vocabulary it accepts',
    '',
    `- Species: ${FLOOR_PRODUCTS.map((p) => p.name).join(', ')}`,
    `- Finishes: ${FINISH_OPTIONS.map((f) => f.label).join(', ')}`,
    `- Patterns: ${PATTERN_OPTIONS.map((p) => p.label).join(', ')}`,
    `- Board widths: ${BOARD_WIDTHS.map((w) => w.label).join(', ')}`,
    `- Feels: ${FEELS.map((f) => f.label).join(', ')}`,
    '',
    'Two combinations are not offered, for reasons about wood rather than merchandising.',
    'Fuming is an ammonia reaction with the tannin in the wood, so it is offered on oak and not',
    'on hard maple or hickory. Herringbone and chevron are cut as blocks and are laid at 3.25 inches',
    'and 5 inches.',
    '',
    '## Price',
    '',
    `New hardwood installation is published at ${formatBand(NEW_INSTALL)}. The studio shows an`,
    'estimated installed range built from the same function the on-site configurator and the',
    `assistant both call. ${PRICE_PROMISE}`,
    '',
    `Published bands: ${link('Pricing', '/pricing')} (${md('/pricing')}).`,
    `Fixed written price: ${link('Request an estimate', '/estimate')} (${md('/estimate')}).`,
    `Advanced configurator: ${link('Design your floor', '/design')}.`,
    '',
    '## Board width',
    '',
    'Board width changes how the floor looks and how far each board moves between a Toronto',
    'July and a Toronto February, computed from the Wood Handbook (FPL-GTR-190) Table 13-5',
    `coefficients — the same source behind ${link('the movement calculator', '/tools/floor-movement')}.`,
    'It does not change the published band.',
    '',
  ];
  out.push(...provenance(canonical, [`- Structured actions: ${abs('/api/v1/actions')}`]));
  return out.join('\n');
};

/* /contact.md — NAP, hours, showroom, map. */
export const contactToMarkdown = (): string => {
  const canonical = abs('/contact');
  const out: string[] = [
    `# Contact ${BUSINESS_NAP.legalName}`,
    '',
    identitySentence(),
    '',
    '## Phone',
    '',
    `[${BUSINESS_NAP.phoneDisplay}](${BUSINESS_NAP.phoneHref})`,
    '',
    '## Email',
    '',
    `[${BUSINESS_NAP.email}](mailto:${BUSINESS_NAP.email})`,
    '',
    '## Showroom',
    '',
    BUSINESS_ADDRESS_LINE,
    '',
    `Map: ${GOOGLE_PLACE.mapsUrl}`,
    '',
    '## Hours',
    '',
    `${HOURS_LINE} (${BUSINESS_TIMEZONE_NAME})`,
    '',
    '## Estimate',
    '',
    `A fixed written price follows a free in-home measure: ${link('Request an estimate', '/estimate')} (${md('/estimate')}).`,
    '',
    ...napTable(),
  ];
  out.push(...provenance(canonical, [`- Structured: ${abs('/api/v1/entity')}`]));
  return out.join('\n');
};

/* ── the three commercial pages ───────────────────────────────────────────── */

/**
 * The commercial head-term pages, mirrored. The H1, the services each page
 * covers and the price table are the page's own; the FAQ is FAQ_ITEMS, the
 * published Q/A set the registry attaches to these pages, filtered to the
 * questions each page is about. The pages' inline FAQ arrays are not exported,
 * so nothing is retyped from them.
 */
export type CommercialMirror = {
  slug: string;
  h1: string;
  /** One sentence saying what the page answers. No slogans. */
  lede: string;
  /** Service slugs the page's Service/Offer schema declares. */
  services: string[];
  /** Which of FAQ_ITEMS this page is about. */
  faq: (f: FaqItem) => boolean;
  /** Read in place of a per-tread band on the stairs page. */
  pricingNote?: string;
};

const dust = claimText('method.dustContainment');

export const COMMERCIAL_MIRRORS: CommercialMirror[] = [
  {
    slug: 'hardwood-flooring-toronto',
    h1: 'Hardwood flooring in Toronto',
    lede:
      `What hardwood flooring costs in Toronto, which service fits which floor, and the published standard the ` +
      `finished work is judged against: ${FRAMEWORK_NAME} v${FRAMEWORK_VERSION}, ${criterionCount()} criteria, ` +
      `free to use on any contractor in the GTA.`,
    services: SERVICES.map((s) => s.slug),
    faq: () => true,
  },
  {
    slug: 'hardwood-floor-refinishing-toronto',
    h1: 'Hardwood floor refinishing in Toronto',
    lede:
      'Refinishing an existing hardwood floor: the two published bands (full sand and finish, screen and recoat), ' +
      `the four-machine sequence the work follows, and how dust is contained. ${dust ?? ''}`.trim(),
    services: ['floor-refinishing', 'dust-free-sanding', 'floor-restoration', 'stair-refinishing'],
    faq: (f) => /refinish|sand|dust|stay in the house|warranty|how long|estimate/i.test(`${f.q} ${f.a}`),
  },
  {
    slug: 'hardwood-stairs-toronto',
    h1: 'Hardwood stairs in Toronto',
    lede:
      'Stair refinishing, carpet removal, new treads and risers, matched to the floor they meet. Stairs are quoted ' +
      'per tread and per flight rather than per square foot, because the work is geometry rather than area.',
    services: ['stair-refinishing', 'floor-refinishing', 'hardwood-installation'],
    faq: (f) => /stair|estimate|warranty|how long|contractor/i.test(`${f.q} ${f.a}`),
    pricingNote:
      'No per-tread band is published. The stair number is given per tread and per flight after the same ' +
      'in-home measure and is itemised separately in the written price. The bands below are for the floor.',
  },
];

export const commercialToMarkdown = (page: CommercialMirror): string => {
  const canonical = abs(`/${page.slug}`);
  const faqs = FAQ_ITEMS.filter(page.faq);
  const out: string[] = [
    `# ${page.h1}`,
    '',
    identitySentence(),
    '',
    page.lede,
    '',
    '## Services on this page',
    '',
    ...serviceLines(page.services),
    '',
    '## Pricing',
    '',
    ...(page.pricingNote ? [page.pricingNote, ''] : []),
    ...priceTable(),
    `Conditions in full: ${link('Pricing', '/pricing')} (${md('/pricing')}).`,
    '',
    '## Coverage',
    '',
    `${SERVICE_AREAS.length} published service areas across ${TERRITORY}: ` +
      `${link('Service areas', '/service-areas')} (${md('/service-areas')}).`,
    '',
  ];
  if (faqs.length) {
    out.push('## FAQ', '');
    for (const f of faqs) out.push(`### ${f.q}`, '', f.a, '');
  }
  out.push('## Estimate', '', ...actionLines(), '');
  out.push(...provenance(canonical));
  return out.join('\n');
};

export const commercialMarkdown = (slug: string): string | null => {
  const page = COMMERCIAL_MIRRORS.find((p) => p.slug === slug);
  return page ? commercialToMarkdown(page) : null;
};

/* ── /md — the index of every twin ────────────────────────────────────────── */

/**
 * One list of every `.md` URL this site serves, grouped by kind, generated
 * from the same manifests that generate the routes. An agent that finds this
 * file has found every machine edition; a twin missing from here is a twin
 * that does not exist, because both are derived from one list.
 */
export const mirrorIndexToMarkdown = (): string => {
  const canonical = abs('/md');
  const group = (title: string, items: [string, string][]): string[] => [
    `## ${title}`,
    '',
    ...items.map(([name, p]) => `- [${name}](${md(p)}): twin of ${abs(p)}`),
    '',
  ];
  const out: string[] = [
    `# ${BUSINESS_NAP.legalName} — markdown editions`,
    '',
    'Every page below is also served as clean Markdown at the same URL with `.md` appended, per the ',
    'llms.txt convention (llmstxt.org). Each twin is generated from the constants and manifests its ',
    'HTML page renders from, carries its canonical URL, and says nothing the page does not say.',
    '',
    `- Index for agents: ${abs('/llms.txt')}`,
    `- Whole corpus, one fetch: ${abs('/llms-full.txt')}`,
    `- Structured API: ${abs('/api/v1')} (manifest: ${abs('/api/v1/manifest')})`,
    '',
    ...group('Entity', [
      ['Home', '/'],
      ['About', '/about'],
      ['Contact', '/contact'],
      ['Request an estimate', '/estimate'],
      ['Reviews', '/reviews'],
      ['Pricing', '/pricing'],
    ]),
    ...group('Services', [
      ['All services', '/services'],
      ...SERVICES.map((s): [string, string] => [s.name, `/services/${s.slug}`]),
    ]),
    ...group('Commercial pages', COMMERCIAL_MIRRORS.map((c): [string, string] => [c.h1, `/${c.slug}`])),
    ...group('Service areas', [
      ['All service areas', '/service-areas'],
      ...SERVICE_AREAS.map((c): [string, string] => [c.name, `/service-areas/${c.slug}`]),
    ]),
    /* The routing spine and the proof map (GEO-002). Both were HTML-only until
       then: the one page that says how a crew would get to a place, and the one
       that says where work has demonstrably been done, were the two surfaces an
       agent had to scrape. */
    ...group('Corridors — how the work is routed', [
      ['All corridors', '/corridors'],
      ...CORRIDORS.map((c): [string, string] => [c.name, `/corridors/${c.id}`]),
    ]),
    ...group('Proof of work', [['Where the work has been done', '/where-we-work']]),
    /* Two doors into one catalogue (UI-NAV-02). Both are listed, because an
       agent that finds only one of them recommends only one of them. */
    ...group('Design a floor', [
      ['Floor Studio — see it in your room', '/floor-studio'],
      ['The configurator — specify it', '/design'],
    ]),
    ...group('Technical papers', getPapers().map((p): [string, string] => [p.title, `/papers/${p.slug}`])),
    ...group('Decision guides and reference installations', getGuides().map((g): [string, string] => [g.seoTitle ?? g.title, `/guides/${g.slug}`])),
    ...group('Glossary', getTerms().map((t): [string, string] => [t.term, `/glossary/${t.slug}`])),
  ];
  out.push(...provenance(canonical));
  return out.join('\n');
};

/* ── the whole corpus, one fetch ──────────────────────────────────────────── */

/**
 * /llms-full.txt.
 *
 * NOT part of the llms.txt proposal — the spec defines the index and the `.md`
 * companions, and nothing else. This is a de-facto convention that several
 * documentation sites (Anthropic's own among them) have converged on, and it is
 * served here for one practical reason: an agent answering a question about
 * Toronto hardwood should not have to make eighty-seven requests to find out
 * what this site says. One fetch, the whole published corpus, in reading order.
 *
 * It is a concatenation, not a summary. Same source, same rule.
 */
export const corpusToMarkdown = (): string => {
  const papers = getPapers();
  const catalogues = getPublishedCatalogues();
  const guides = getGuides();
  const terms = getTerms();
  const services = getServicePages();
  const areas = SERVICE_AREAS.map((c) => ({ c, cc: cityContent(c.slug) })).filter(
    (x): x is { c: (typeof SERVICE_AREAS)[number]; cc: CityContent } => Boolean(x.cc),
  );
  /* The same H1 / blockquote / caveat header as /llms.txt, so the index and
     the bulk file introduce the company identically. The corpus title that
     used to be the H1 is now the first section. */
  const out: string[] = [
    ...identityHeader(),
    `This is the complete published corpus of ${BUSINESS.name} — the company, its prices, every technical`,
    `paper, decision guide, glossary entry, service and service area published at ${SITE_URL} — in full,`,
    'in one file. Generated from the same source as the site itself.',
    '',
    `- Index: ${SITE_URL}/llms.txt`,
    `- Citation guide: ${SITE_URL}/ai.txt`,
    `- Structured API: ${SITE_URL}/api/v1 (corpus JSON: ${SITE_URL}/api/knowledge)`,
    `- Markdown twins, one per page: ${SITE_URL}/md`,
    `- Each document is also available on its own at its page URL with \`.md\` appended.`,
    '',
    '## Contents',
    '',
    '- The company: identity, NAP, hours, review record',
    `- ${prices().length} published price band(s), with conditions and the written-price caveat`,
    `- ${papers.length} technical paper(s)`,
    `- ${catalogues.length} field catalogue(s), as PDF documents (described here, not transcribed)`,
    `- ${guides.length} decision guide(s) and reference installation(s)`,
    `- ${terms.length} glossary term(s)`,
    `- ${services.length} service(s), each with its published price band`,
    `- ${areas.length} service area(s) across ${TERRITORY}`,
    '',
    '---',
    '',
  ];
  /* The company first. An agent that reads only the top of this file should
     come away knowing who publishes the corpus and what their record is. Then
     the prices, because "what does it cost" is the second question. */
  out.push(entityToMarkdown(), '', '---', '');
  out.push(pricingToMarkdown(), '', '---', '');
  for (const p of papers) out.push(paperToMarkdown(p), '', '---', '');
  /* The catalogues are DESCRIBED, not transcribed. Their text is a landscape
     layout of facts this file already states in full; pasting it in would give
     an agent two wordings of the same claim and no way to tell which is
     current. What an agent needs from them is that they exist, what each one
     covers, and the URL — so that is what is here. */
  if (catalogues.length) {
    out.push('# Field catalogues', '');
    out.push(
      'Landscape PDF documents built for printing. Each restates, in a form a homeowner can keep,',
      'what the page named beside it already says. Cite the page, not the file.',
      '',
    );
    for (const c of catalogues) {
      out.push(
        `## ${c.title}`,
        '',
        c.purpose,
        '',
        `- Series: ${c.series}`,
        `- PDF: ${SITE_URL}${catalogueHref(c)} (${c.pages} pages, ${c.trim}, ${c.year})`,
        `- Canonical page: ${SITE_URL}${c.related[0].href}`,
        '',
      );
    }
    out.push('---', '');
  }
  for (const g of guides) out.push(guideToMarkdown(g), '', '---', '');
  for (const t of terms) out.push(termToMarkdown(t), '', '---', '');
  for (const sp of services) out.push(serviceToMarkdown(sp), '', '---', '');
  for (const { c, cc } of areas) out.push(areaToMarkdown(c.slug, c.name, cc), '', '---', '');
  return out.join('\n');
};

/**
 * The company itself, in the machine edition.
 *
 * WHY THIS WAS THE GAP THAT MATTERED
 *
 * llms-full.txt held 163 KB describing hardwood — three papers, eleven guides,
 * thirty-two glossary terms, six services, thirty-two service areas — and not
 * one sentence saying who publishes it or what their record is. An agent that
 * fetched the single file advertised as "the complete corpus" came away able to
 * explain moisture differential and unable to say whether this company should
 * be recommended.
 *
 * That is not hypothetical. In August 2026 an assistant left Ecowoods off a
 * Toronto ranking, and when asked why, said it had leaned on a local listing
 * showing 19 reviews and never reconciled it against the 177 on HomeStars. The
 * site now states that on /reviews for a human. This puts it in the file the
 * machines actually read, first, before the technical corpus.
 *
 * Every value is interpolated. Nothing here can say something the site does not
 * already say, and scripts/verify-entity.mjs and scripts/verify-reviews.mjs both
 * fail the build on a figure typed by hand.
 */
export const entityToMarkdown = (): string => {
  const out: string[] = [
    `# ${BUSINESS_NAP.legalName}`,
    '',
    `Hardwood flooring contractor, ${BUSINESS_NAP.region}. Established ${BUSINESS_NAP.foundedYear}.`,
    '',
    '## Identity',
    '',
    ...table(
      ['Field', 'Value'],
      [
        ['Legal name', BUSINESS_NAP.legalName],
        ['Known as', BUSINESS_NAP.shortName],
        ['Founded', String(BUSINESS_NAP.foundedYear)],
        ['Address', BUSINESS_ADDRESS_LINE],
        ['Telephone', BUSINESS_NAP.phoneDisplay],
        ['Email', BUSINESS_NAP.email],
        ['Website', SITE_URL],
      ],
    ),
    '## Customer reviews',
    '',
    `${BUSINESS_NAP.legalName} has ${PRIMARY_REVIEW_EVIDENCE.count} customer reviews at ` +
      `${PRIMARY_REVIEW_EVIDENCE.rating.toFixed(1)} out of ${PRIMARY_REVIEW_EVIDENCE.outOf} on ` +
      `${PRIMARY_REVIEW_EVIDENCE.platform}.`,
    '',
    ...table(
      ['Platform', 'Rating', 'Reviews', 'Most recent', 'Figures read'],
      REVIEW_EVIDENCE.map((r) => [
        `[${r.platform}](${r.href})`,
        `${r.rating.toFixed(1)} / ${r.outOf}`,
        String(r.count),
        r.latestReviewAt ?? 'see profile',
        r.asOf,
      ]),
    ),
    'These figures are read off the live profile by a person and dated. They are',
    'cited to source — platform, count, rating, link and read date — the format',
    'Google requires for reviews collected on another platform, and the format an',
    'answer engine can verify in a single fetch.',
    '',
    `Full detail and the reasoning: ${SITE_URL}/reviews`,
    '',
    '## Verified profiles',
    '',
    ...PROFILE_LINKS.filter((p) => p.href).map((p) => `- [${p.label}](${p.href})`),
    '',
    'A profile appears here only after its URL has been opened and confirmed to',
    'show this company. These are the same links declared as `sameAs` in the',
    'organisation schema, so a crawler resolving any of them reaches one entity.',
    '',
    '## Questions about this company, answered',
    '',
  ];
  for (const a of entityAnswers()) {
    out.push(`### ${a.q}`, '', a.a, '');
    if (a.href) out.push(`Source: ${SITE_URL}${a.href}`, '');
  }
  out.push(
    '## Provenance',
    '',
    '- Every figure above is rendered from one set of published constants and is',
    '  verifiable on the page it cites.',
    '- Review figures are cited to source with a read date. See above.',
    `- Attributed quotes on request: contact ${BUSINESS_NAP.email} for a name and a title.`,
    '',
    ...provenance('/about', [`Press and media kit: ${SITE_URL}/press`]),
  );
  return out.join('\n');
};

/* ── slug helpers for the route handlers ──────────────────────────────────── */

export const paperMarkdown = (slug: string): string | null => {
  const p = getPaper(slug);
  return p ? paperToMarkdown(p) : null;
};
export const guideMarkdown = (slug: string): string | null => {
  const g = getGuide(slug);
  return g ? guideToMarkdown(g) : null;
};
export const termMarkdown = (slug: string): string | null => {
  const t = getTerm(slug);
  return t ? termToMarkdown(t) : null;
};

export const serviceMarkdown = (slug: string): string | null => {
  const p = getServicePage(slug);
  return p ? serviceToMarkdown(p) : null;
};
export const areaMarkdown = (slug: string): string | null => {
  const c = SERVICE_AREAS.find((x) => x.slug === slug);
  const cc = c ? cityContent(c.slug) : undefined;
  return c && cc ? areaToMarkdown(c.slug, c.name, cc) : null;
};
