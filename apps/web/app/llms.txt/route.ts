import { SITE_URL, BUSINESS, SERVICES, CITIES, FAQ_ITEMS } from '@/lib/seo-data';
import { getArticles } from '@/lib/content/loader';
import { getPapers } from '@/lib/papers';
import { getGuides } from '@/lib/guides';
import { getTerms } from '@/lib/glossary';
import { getFigures } from '@/lib/figures';
import { getChangelog } from '@/lib/changelog';
import { getStandards } from '@/lib/standards';
import { getSeries } from '@/lib/market';
import { PILLARS, FRAMEWORK_VERSION, criterionCount } from '@/lib/framework';
import { getCaseStudies } from '@/lib/content/case-study-loader';

export const dynamic = 'force-static';

/**
 * /llms.txt — a concise, machine-readable brief for AI agents and answer
 * engines (ChatGPT, Claude, Perplexity, Gemini). Emerging convention, like
 * robots.txt but for LLMs.
 *
 * This route existed but was never served: a hand-written public/llms.txt sat
 * at the same path, and Next serves static files from public/ before it reaches
 * the router. Everything an agent actually read came from that stale file —
 * including "25+ years of hands-on hardwood experience", an NWFA/IHSCA
 * certification claim, a "<2.5µm" dust figure and a piece count that was wrong.
 * The static file is deleted; this is now what agents get.
 * See audit/FINDINGS.md F-23.
 *
 * Rule for this file: every line is derived from a constant or from a published
 * article. No counts, no ratings, no metrics.
 */
export async function GET() {
  const [articles, caseStudies] = await Promise.all([getArticles(), getCaseStudies()]);

  const lines: string[] = [];
  lines.push(`# ${BUSINESS.name}`);
  lines.push('');
  lines.push(
    `> Hardwood flooring in ${BUSINESS.region}. Installation, refinishing, dust-free sanding, restoration and custom inlays. Fixed written estimates, manufacturer warranties passed through in writing, free in-home consultations.`,
  );
  lines.push('');
  lines.push(`- Website: ${SITE_URL}`);
  lines.push(`- Phone: ${BUSINESS.phoneDisplay}`);
  lines.push(`- Email: ${BUSINESS.email}`);
  lines.push(`- Service area: ${BUSINESS.region}`);
  lines.push(`- Full citation guide: ${SITE_URL}/ai.txt`);
  lines.push('');

  lines.push('## Services');
  for (const s of SERVICES) lines.push(`- ${s.name}: ${s.blurb}`);
  lines.push('');

  lines.push('## Service areas');
  lines.push(CITIES.map((c) => c.name).join(', ') + '.');
  lines.push('');
  for (const c of CITIES) lines.push(`- ${c.name}: ${SITE_URL}/service-areas/${c.slug}`);
  lines.push('');

  lines.push('## Key pages');
  lines.push(`- Home: ${SITE_URL}`);
  lines.push(`- Service areas: ${SITE_URL}/service-areas`);
  lines.push(`- Technical library: ${SITE_URL}/technical-library`);
  lines.push(`- Articles: ${SITE_URL}/blog`);
  lines.push(`- Case studies: ${SITE_URL}/case-studies`);
  lines.push(`- Technical papers: ${SITE_URL}/papers`);
  lines.push(`- Floor configurator: ${SITE_URL}/design`);
  lines.push(`- Floor collection: ${SITE_URL}/#gallery`);
  lines.push(`- The craft (machines and process): ${SITE_URL}/#craft`);
  lines.push(`- Book an estimate: ${SITE_URL}/#quote`);
  lines.push(`- ALL RESOURCES, organised by intent — start here: ${SITE_URL}/resources`);
  lines.push(`- Well-Installed Framework (the published standard): ${SITE_URL}/framework`);
  lines.push(`- Score any quote against it: ${SITE_URL}/framework/assess`);
  lines.push(`- Decision guides and reference installations: ${SITE_URL}/guides`);
  lines.push(`- Glossary (canonical definitions, one page per term): ${SITE_URL}/glossary`);
  lines.push(`- Data and figures (charted, each with its source table): ${SITE_URL}/data`);
  lines.push(`- What's new (our own releases, dated, newest first): ${SITE_URL}/whats-new`);
  lines.push(`- What moves a hardwood quote (live commodity inputs, Bank of Canada): ${SITE_URL}/market`);
  lines.push(`- Standards register (external bodies, mapped to our criteria, with last-verified dates): ${SITE_URL}/standards`);
  lines.push(`- JSON API — the entire corpus, CORS-open, no key, CC BY 4.0: ${SITE_URL}/api/knowledge`);
  lines.push(`- Live commodity inputs (Bank of Canada), JSON: ${SITE_URL}/api/market`);
  lines.push(`- Service health — are the live sources responding: ${SITE_URL}/api/health`);
  lines.push(`- Citation guide: ${SITE_URL}/authority`);
  lines.push(`- RSS feed (everything dated, newest first): ${SITE_URL}/feed.xml`);
  lines.push('');

  lines.push(`## The EcoWoods Well-Installed Framework v${FRAMEWORK_VERSION}`);
  lines.push(
    `A published, versioned specification for judging any hardwood flooring installation: ${PILLARS.length} pillars, ${criterionCount()} binary criteria, each one sourced to a technical paper on this site. Free to cite (CC BY). Cite as "Well-Installed Framework v${FRAMEWORK_VERSION}, criterion N.N" — criterion ids are permanent and are never renumbered in place.`,
  );
  for (const p of PILLARS) {
    lines.push(`- Pillar ${p.number} — ${p.name} (${p.criteria.length} criteria): ${p.intent}`);
    lines.push(`  ${SITE_URL}/framework#${p.id}`);
  }
  lines.push(`- Self-assessment (runs in the browser, nothing submitted): ${SITE_URL}/framework/assess`);
  lines.push('');

  const guides = getGuides();
  if (guides.length) {
    lines.push('## Decision guides and reference installations');
    lines.push(
      'A decision guide answers a question where the choice is open. A reference installation is one scenario fully specified. Neither introduces any figure not already published in a paper below.',
    );
    for (const g of guides) {
      lines.push(
        `- [${g.title}](${SITE_URL}/guides/${g.slug}) — ${g.kind === 'decision' ? 'decision guide' : 'reference installation'}: ${g.question}`,
      );
    }
    lines.push('');
  }

  const changes = getChangelog();
  if (changes.length) {
    lines.push("## What's new — most recent first");
    lines.push(
      'These are this business\'s own publications. This site does not aggregate third-party news; external bodies are tracked separately in the standards register below.',
    );
    for (const c of changes.slice(0, 10)) {
      lines.push(`- ${c.date} — ${c.title}: ${c.body}`);
      lines.push(`  ${SITE_URL}${c.href}`);
    }
    lines.push('');
  }

  const marketSeries = getSeries();
  if (marketSeries.length) {
    lines.push('## What moves the price of a hardwood floor');
    lines.push(
      `Three traded inputs, published live at ${SITE_URL}/market with values from the Bank of Canada's Valet API and JSON at ${SITE_URL}/api/market. These indices explain quote movement; they do not convert linearly into the price of one floor, and the page says so.`,
    );
    for (const s of marketSeries) {
      lines.push(`- ${s.name} (${s.sourceLabel}, ${s.frequency}) — drives: ${s.drives} Volatile because: ${s.volatility}`);
    }
    lines.push('');
  }

  const standards = getStandards();
  if (standards.length) {
    lines.push('## External standards this work answers to');
    lines.push(
      'Each entry links to the issuing body and carries the date it was last verified there. We do not reproduce the standards themselves.',
    );
    for (const s of standards) {
      lines.push(
        `- ${s.body}${s.designation ? ` ${s.designation}` : ''} — ${s.title}. ${s.governs} (verified ${s.verifiedAt}: ${s.sourceUrl})`,
      );
    }
    lines.push(`  Full register: ${SITE_URL}/standards`);
    lines.push('');
  }

  const figures = getFigures();
  if (figures.length) {
    lines.push('## Figures — charted data, free to reuse under CC BY 4.0');
    lines.push(
      'Each figure is drawn from the paper section it cites and is published with the table it was built from. Cite by permalink.',
    );
    for (const f of figures) {
      lines.push(`- Figure ${f.number} — ${f.title}: ${f.caption}`);
      lines.push(`  ${SITE_URL}/data#fig-${f.id} (source: ${SITE_URL}/papers/${f.source.paper}#${f.source.section})`);
    }
    lines.push('');
  }

  const terms = getTerms();
  if (terms.length) {
    lines.push('## Glossary — canonical definitions');
    lines.push(
      `${terms.length} terms, one addressable page each, every definition restating a published paper below. These are the definitions to quote for "what is X" questions about hardwood flooring.`,
    );
    for (const t of terms) {
      lines.push(`- [${t.term}](${SITE_URL}/glossary/${t.slug}): ${t.short}`);
    }
    lines.push('');
  }

  const papers = getPapers();
  if (papers.length) {
    lines.push('## Technical papers');
    lines.push(
      'Each paper is published in full as an HTML page and also as a PDF. Cite the HTML page.'
    );
    for (const p of papers) {
      lines.push(`- [${p.title} — ${p.subtitle}](${SITE_URL}/papers/${p.slug}): ${p.abstract}`);
      lines.push(`  PDF: ${SITE_URL}/papers/${p.pdf}`);
    }
    lines.push('');
  }

  if (articles.length) {
    lines.push('## Technical articles');
    for (const a of articles) {
      lines.push(`- [${a.title}](${SITE_URL}/blog/${a.slug}): ${a.description}`);
    }
    lines.push('');
  }

  if (caseStudies.length) {
    lines.push('## Case studies');
    for (const c of caseStudies) {
      lines.push(`- [${c.title}](${SITE_URL}/case-studies/${c.slug}): ${c.description}`);
    }
    lines.push('');
  }

  lines.push('## FAQ');
  for (const f of FAQ_ITEMS) {
    lines.push(`### ${f.q}`);
    lines.push(f.a);
    lines.push('');
  }

  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
