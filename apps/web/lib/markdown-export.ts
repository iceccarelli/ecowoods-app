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
import { getPapers, getPaper, type Paper, type PaperSection } from '@/lib/papers';
import { getGuides, getGuide, type Guide } from '@/lib/guides';
import { getTerms, getTerm, type GlossaryTerm } from '@/lib/glossary';
import { SITE_URL, BUSINESS } from '@/lib/seo-data';

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
  out.push(...provenance(canonical, [`- Document version: ${paper.version} (${paper.publishedAt})`]));
  return out.join('\n');
};

/* ── guides ───────────────────────────────────────────────────────────────── */

export const guideToMarkdown = (guide: Guide): string => {
  const canonical = `${SITE_URL}/guides/${guide.slug}`;
  const out: string[] = [`# ${guide.title}`, '', `**${guide.question}**`, '', guide.summary, ''];

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
    '',
    '---',
    '',
  ];
  for (const p of papers) out.push(paperToMarkdown(p), '', '---', '');
  for (const g of guides) out.push(guideToMarkdown(g), '', '---', '');
  for (const t of terms) out.push(termToMarkdown(t), '', '---', '');
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
