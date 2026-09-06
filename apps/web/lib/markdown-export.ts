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
import { getGuides, getGuide, type Guide } from '@/lib/guides';
import { getTerms, getTerm, type GlossaryTerm } from '@/lib/glossary';
import {
  SITE_URL,
  BUSINESS,
  SERVICES,
  CITIES,
  NEIGHBOURHOOD_AREAS,
  SERVICE_AREAS,
  FAQ_ITEMS,
  cityContent,
  type CityContent,
  type FaqItem,
} from '@/lib/seo-data';
import {
  getServicePages,
  getServicePage,
  serviceFor,
  priceBand,
  faqsFor,
  type ServicePage,
} from '@/lib/service-pages';
import { PILLARS, FRAMEWORK_NAME, FRAMEWORK_VERSION, criterionCount } from '@/lib/framework';
import { PRICE_PROMISE } from '@/lib/pricing';
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
  rows.push(['Areas served', CITIES.map((c) => c.name).join(', ')]);
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
  const out: string[] = [
    `# Hardwood floor installation & refinishing in ${name}`,
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
    const band = priceBand(sp);
    out.push(`- **${svc?.name ?? sp.h1}**${band ? ` (${band})` : ''} — ${SITE_URL}/services/${sp.slug}`);
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
  const words = fragment.split('-');
  return words[0].charAt(0).toUpperCase() + words[0].slice(1) + (words.length > 1 ? ` ${words.slice(1).join(' ')}` : '');
};

/**
 * The published bands as one table, then the caveat sentence. The caveat is
 * not decoration: it is the sentence the registry says must travel with the
 * number, and a table quoted without it is a quote this business never gave.
 */
const priceTable = (list: PricePrimitive[] = prices()): string[] => [
  ...table(
    ['Scope', 'Published band', 'Applies when'],
    list.map((p) => [p.data.label, `${p.data.formatted} (${p.data.currency})`, p.data.conditions[0] ?? '']),
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
      ['Service region', BUSINESS_NAP.region],
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
    `${BUSINESS_NAP.region}. ${SERVICE_AREAS.length} published service areas — ${CITIES.length} municipalities and ` +
      `districts and ${NEIGHBOURHOOD_AREAS.length} Toronto neighbourhoods — each with its own page: ` +
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
    `# Hardwood flooring service areas — ${BUSINESS_NAP.region}`,
    '',
    identitySentence(),
    '',
    '## Who is served',
    '',
    `Homeowners, condominium owners and property managers across ${BUSINESS_NAP.region}: ` +
      `${SERVICE_AREAS.length} published service areas, each with its own page.`,
    '',
    'Projects elsewhere in Southern Ontario are assessed per project through the estimate path. ' +
      'They are not published service areas, and this page does not claim them as covered.',
    '',
    '## What does not change by area',
    '',
    `- The price bands. They are published once and do not change by postal code: ${link('Pricing', '/pricing')}.`,
    ...(crew ? [`- The crew model. ${crew}`] : []),
    `- The services: ${SERVICES.map((s) => link(s.name, `/services/${s.slug}`)).join(', ')}.`,
    '',
    '## What changes by area',
    '',
    'The housing stock and the substrate under it. A pre-war semi on a wood-joist subfloor, a post-war ' +
      'bungalow and a concrete-slab condominium are different jobs with different moisture questions, and ' +
      'each area page below says which it is.',
    '',
    '## Municipalities and districts',
    '',
    ...CITIES.map((c) => `- ${link(c.name, `/service-areas/${c.slug}`)} — markdown: ${md(`/service-areas/${c.slug}`)}`),
    '',
    '## Toronto neighbourhoods',
    '',
    ...NEIGHBOURHOOD_AREAS.map((c) => `- ${link(c.name, `/service-areas/${c.slug}`)} — markdown: ${md(`/service-areas/${c.slug}`)}`),
    '',
  ];
  out.push(...provenance(canonical));
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
    'The bands below are the only prices this business publishes. Every band is per square foot, in ' +
      'Canadian dollars, and is an informational range: the fixed price is written after the free ' +
      'in-home measure, not from a range.',
    '',
    ...priceTable(list),
    '## Conditions',
    '',
    'What each band covers and what moves a number inside it.',
    '',
  ];
  for (const p of list) {
    const fragment = priceFragment(p);
    out.push(`### ${fragmentHeading(fragment)}`, '', `**${p.data.label}** — ${p.data.formatted} (${p.data.currency}).`, '');
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
    `${SERVICE_AREAS.length} published service areas across ${BUSINESS_NAP.region}: ` +
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
    `- ${guides.length} decision guide(s) and reference installation(s)`,
    `- ${terms.length} glossary term(s)`,
    `- ${services.length} service(s), each with its published price band`,
    `- ${areas.length} service area(s) across Toronto and the GTA`,
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
