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
} from '@ecowoods/shared/constants';
import { getPapers, getPaper, type Paper, type PaperSection } from '@/lib/papers';
import { getGuides, getGuide, type Guide } from '@/lib/guides';
import { getTerms, getTerm, type GlossaryTerm } from '@/lib/glossary';
import { SITE_URL, BUSINESS, SERVICES, CITIES, SERVICE_AREAS, cityContent, type CityContent } from '@/lib/seo-data';
import {
  getServicePages,
  getServicePage,
  serviceFor,
  priceBand,
  faqsFor,
  type ServicePage,
} from '@/lib/service-pages';
import { PILLARS } from '@/lib/framework';

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
  const out: string[] = [
    `# ${BUSINESS.name} — complete technical corpus`,
    '',
    `Every technical paper, decision guide and glossary entry published at ${SITE_URL},`,
    'in full, in one file. Generated from the same source as the site itself.',
    '',
    `- Index: ${SITE_URL}/llms.txt`,
    `- Citation guide: ${SITE_URL}/ai.txt`,
    `- Structured API: ${SITE_URL}/api/knowledge`,
    `- Each document is also available on its own at its page URL with \`.md\` appended.`,
    '',
    '## Contents',
    '',
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
     come away knowing who publishes the corpus and what their record is. */
  out.push(entityToMarkdown(), '', '---', '');
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
