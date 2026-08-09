import { SITE_URL, BUSINESS, SERVICES, CITIES, FAQ_ITEMS } from '@/lib/seo-data';
import { getArticles } from '@/lib/content/loader';
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
  lines.push(`- Floor configurator: ${SITE_URL}/design`);
  lines.push(`- Floor collection: ${SITE_URL}/#gallery`);
  lines.push(`- The craft (machines and process): ${SITE_URL}/#craft`);
  lines.push(`- Book an estimate: ${SITE_URL}/#quote`);
  lines.push('');

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
