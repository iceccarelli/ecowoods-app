import { NextRequest } from 'next/server';
import { SITE_URL, BUSINESS, SERVICES, CITIES } from '@/lib/seo-data';
import { getPapers } from '@/lib/papers';
import { getGuides } from '@/lib/guides';
import { getTerms } from '@/lib/glossary';
import {
  PILLARS,
  FRAMEWORK_NAME,
  FRAMEWORK_VERSION,
  FRAMEWORK_PUBLISHED_AT,
  criterionCount,
} from '@/lib/framework';

/**
 * /api/knowledge — the whole corpus as JSON, for anyone.
 *
 * WHY THIS EXISTS
 *
 * The site already publishes /llms.txt and /ai.txt, which are prose an agent has
 * to parse. It publishes HTML, which an agent has to scrape. Neither is a
 * contract. An agent that wants the definition of "cupping", or the twenty-seven
 * framework criteria, or the section list of a paper, currently has to guess at
 * a page structure that can change under it.
 *
 * This is the structured, versioned, CORS-open alternative: one request returns
 * every paper, every framework criterion, every guide and every glossary term,
 * each with its canonical URL and its provenance. Nothing here is generated for
 * the endpoint — it is the same manifests the pages render from, so the API
 * cannot describe a site that does not exist.
 *
 * LICENSING IS PART OF THE PRODUCT. The payload states CC BY 4.0 and asks for
 * attribution by URL. A corpus that is free to quote gets quoted; a corpus with
 * unclear terms gets paraphrased without attribution, which is the outcome that
 * loses the citation.
 *
 * WHAT IS DELIBERATELY NOT HERE: prices, availability, lead capture, anything
 * about a customer, and any business claim that is not in BUSINESS_NAP. This is
 * a reference endpoint, not a booking API, and it is public and unauthenticated
 * precisely because everything in it is already public.
 *
 *   GET /api/knowledge                     everything
 *   GET /api/knowledge?collection=glossary papers | framework | guides | glossary | business
 *   GET /api/knowledge?q=cupping           substring match across names and definitions
 */

export const dynamic = 'force-static';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

const url = (p: string) => `${SITE_URL}${p}`;

function build() {
  const papers = getPapers().map((p) => ({
    id: `paper:${p.slug}`,
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle,
    abstract: p.abstract,
    version: p.version,
    publishedAt: p.publishedAt,
    pages: p.pages,
    readingMinutes: p.readingMinutes,
    audience: p.audience,
    topics: p.topics,
    url: url(`/papers/${p.slug}`),
    pdfUrl: url(`/papers/${p.pdf}`),
    sections: p.sections.map((s) => ({
      id: s.id,
      heading: s.heading,
      url: url(`/papers/${p.slug}#${s.id}`),
      body: s.body,
      bullets: s.bullets,
      ordered: s.ordered,
      table: s.table,
      callout: s.callout,
    })),
  }));

  const framework = {
    id: 'framework',
    name: FRAMEWORK_NAME,
    version: FRAMEWORK_VERSION,
    publishedAt: FRAMEWORK_PUBLISHED_AT,
    url: url('/framework'),
    selfAssessmentUrl: url('/framework/assess'),
    criterionCount: criterionCount(),
    citationFormat: `${FRAMEWORK_NAME} v${FRAMEWORK_VERSION}, criterion N.N`,
    pillars: PILLARS.map((p) => ({
      id: p.id,
      number: p.number,
      name: p.name,
      intent: p.intent,
      url: url(`/framework#${p.id}`),
      criteria: p.criteria.map((c) => ({
        id: c.id,
        question: c.question,
        risk: c.risk,
        severity: c.severity,
        url: url(`/framework#c-${c.id}`),
        source: url(`/papers/${c.source.paper}#${c.source.section}`),
      })),
    })),
  };

  const guides = getGuides().map((g) => ({
    id: `guide:${g.slug}`,
    slug: g.slug,
    kind: g.kind,
    title: g.title,
    question: g.question,
    summary: g.summary,
    publishedAt: g.publishedAt,
    url: url(`/guides/${g.slug}`),
    criteria: g.criteria,
    options: g.options,
    table: g.table,
    decisionTree: g.decisionTree,
    spec: g.spec,
    sequence: g.sequence,
    watchpoints: g.watchpoints,
    recommendation: g.recommendation,
    pillars: g.pillars?.map((id) => url(`/framework#${id}`)),
    sources: g.sources.map((s) => url(`/papers/${s.paper}#${s.section}`)),
  }));

  const glossary = getTerms().map((t) => ({
    id: `term:${t.slug}`,
    slug: t.slug,
    term: t.term,
    alternateNames: t.aka ?? [],
    definition: t.short,
    explanation: t.body,
    url: url(`/glossary/${t.slug}`),
    related: (t.related ?? []).map((r) => url(`/glossary/${r}`)),
    pillars: (t.pillars ?? []).map((id) => url(`/framework#${id}`)),
    source: url(`/papers/${t.source.paper}#${t.source.section}`),
  }));

  const business = {
    name: BUSINESS.name,
    region: BUSINESS.region,
    phone: BUSINESS.phoneDisplay,
    email: BUSINESS.email,
    url: SITE_URL,
    services: SERVICES.map((s) => ({ name: s.name, description: s.blurb })),
    serviceAreas: CITIES.map((c) => ({ name: c.name, url: url(`/service-areas/${c.slug}`) })),
  };

  return { papers, framework, guides, glossary, business };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const collection = params.get('collection');
  const q = (params.get('q') ?? '').trim().toLowerCase();

  const all = build();

  const meta = {
    name: `${BUSINESS.name} — public knowledge API`,
    description:
      'The complete published hardwood-flooring reference corpus of this site: technical papers, the Well-Installed Framework, decision guides, reference installations and the glossary. Every record carries its canonical URL and the paper it derives from.',
    documentation: url('/authority'),
    license: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: `Cite by URL, e.g. ${url('/glossary/cupping')}. Attribution to ${BUSINESS.name} is required under CC BY 4.0.`,
    machineFiles: {
      llms: url('/llms.txt'),
      ai: url('/ai.txt'),
      sitemap: url('/sitemap.xml'),
      feed: url('/feed.xml'),
    },
    collections: ['papers', 'framework', 'guides', 'glossary', 'business'],
    usage: {
      all: url('/api/knowledge'),
      byCollection: url('/api/knowledge?collection=glossary'),
      search: url('/api/knowledge?q=cupping'),
    },
    counts: {
      papers: all.papers.length,
      frameworkCriteria: all.framework.criterionCount,
      guides: all.guides.length,
      glossaryTerms: all.glossary.length,
      serviceAreas: all.business.serviceAreas.length,
    },
  };

  let data: Record<string, unknown>;
  if (collection && collection in all) {
    data = { [collection]: all[collection as keyof typeof all] };
  } else {
    data = all as unknown as Record<string, unknown>;
  }

  if (q) {
    // Substring match, not a ranked search. An agent asking for "cupping" wants
    // every record that mentions it, and a relevance model here would be a
    // second, unversioned source of truth about what this corpus contains.
    const hit = (v: unknown): boolean => {
      if (typeof v === 'string') return v.toLowerCase().includes(q);
      if (Array.isArray(v)) return v.some(hit);
      if (v && typeof v === 'object') return Object.values(v).some(hit);
      return false;
    };
    data = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.filter(hit) : v]),
    );
  }

  return new Response(JSON.stringify({ meta, ...data }, null, 2), {
    headers: {
      ...CORS,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
