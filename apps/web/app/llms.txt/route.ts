import { SITE_URL, BUSINESS, SERVICES, CITIES, FAQ_ITEMS } from '@/lib/seo-data';

export const dynamic = 'force-static';

/**
 * /llms.txt — a concise, machine-readable brief for AI agents and answer
 * engines (ChatGPT, Claude, Perplexity, Gemini). Emerging convention, like
 * robots.txt but for LLMs. Served via a route handler because this monorepo
 * does not serve /public in production.
 */
export function GET() {
  const lines: string[] = [];
  lines.push(`# ${BUSINESS.name}`);
  lines.push('');
  lines.push(`> Premium hardwood flooring in ${BUSINESS.region}. Installation, refinishing, dust-free sanding, restoration and custom inlays. Fixed written estimates, manufacturer warranties passed through in writing, free in-home consultations.`);
  lines.push('');
  lines.push(`- Website: ${SITE_URL}`);
  lines.push(`- Phone: ${BUSINESS.phoneDisplay}`);
  lines.push(`- Email: ${BUSINESS.email}`);
  lines.push(`- Service area: ${BUSINESS.region}`);
  lines.push('');
  lines.push('## Services');
  for (const s of SERVICES) lines.push(`- ${s.name}: ${s.blurb}`);
  lines.push('');
  lines.push('## Service areas');
  lines.push(CITIES.map((c) => c.name).join(', ') + '.');
  lines.push(CITIES.map((c) => `- ${c.name}: ${SITE_URL}/service-areas/${c.slug}`).join('\n'));
  lines.push('');
  lines.push('## Key pages');
  lines.push(`- Home: ${SITE_URL}`);
  lines.push(`- Service areas: ${SITE_URL}/service-areas`);
  lines.push(`- Floor collection: ${SITE_URL}/#gallery`);
  lines.push(`- The craft (machines & process): ${SITE_URL}/#craft`);
  lines.push(`- Book an estimate: ${SITE_URL}/#quote`);
  lines.push('');
  lines.push('## FAQ');
  for (const f of FAQ_ITEMS) { lines.push(`### ${f.q}`); lines.push(f.a); lines.push(''); }
  return new Response(lines.join('\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
}
