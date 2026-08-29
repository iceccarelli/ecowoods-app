import { NextRequest } from 'next/server';
import { SITE_URL, BUSINESS, SERVICES, SERVICE_AREAS, cityContent } from '@/lib/seo-data';
import { getServicePages, priceBand } from '@/lib/service-pages';
import { pdfIsPublished, getPapers } from '@/lib/papers';
import { getGuides } from '@/lib/guides';
import { getTerms } from '@/lib/glossary';
import { getFigures } from '@/lib/figures';
import { getChangelog } from '@/lib/changelog';
import { getStandards } from '@/lib/standards';
import { getCaseStudies } from '@/lib/content/case-study-loader';
import { PRICE_BANDS, formatBand } from '@/content/constants/pricing';
import { CLUSTERS } from '@/content/search/topic-map';
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
 * WHAT IS DELIBERATELY NOT HERE: availability, lead capture, anything about a
 * customer, and any business claim that is not registered in
 * content/claims.ts. This is a reference endpoint, not a booking API, and it is
 * public and unauthenticated precisely because everything in it is already
 * public.
 *
 * PRICES ARE HERE, AND THE COMMENT ABOVE USED TO SAY THEY WERE NOT. They had
 * been in the services payload since F-153 — `priceBand(sp)` on every service —
 * so the sentence describing this endpoint was false about the one field most
 * likely to be quoted back at this business. They are now also a collection of
 * their own, derived from content/constants/pricing.ts, because a retrieval
 * system asked "what does hardwood cost in Toronto" should not have to know
 * that the answer is nested inside a services array.
 *
 * FIRST-CLASS COLLECTIONS. `services`, `locations`, `caseStudies`, `pricing`
 * and `commercialPages` used to be either nested inside `business` or absent.
 * Nesting them meant `?collection=services` returned nothing while the data sat
 * two levels down in the full payload — an agent had to fetch the entire corpus
 * to answer a question about one service. They are top-level and filterable
 * now; `business` keeps its copies so nothing that already parses this breaks.
 *
 *   GET /api/knowledge                     everything
 *   GET /api/knowledge?collection=services one collection — see meta.collections
 *   GET /api/knowledge?q=cupping           substring match across names and definitions
 */

/**
 * NOT force-static — F-161, and the reason is worth writing down.
 *
 * This route was `export const dynamic = 'force-static'`. Next prerenders such a
 * route once at build time, and `request.nextUrl.searchParams` is then ALWAYS
 * EMPTY. The `collection` and `q` filtering below is correct code that could
 * never run: every query returned the same byte-identical 330 KB dump.
 *
 * Two independent audits measured the symptom — `?q=hickory`,
 * `?collection=glossary` and the bare url returning the same length and the same
 * hash — and neither could see the cause, because nothing about the response
 * says "your query string was discarded before the handler saw it".
 *
 * `meta.usage` was simultaneously advertising both parameters. An agent that
 * tries `?q=` once, receives the entire company, and truncates, does not try
 * again — it quotes something shorter, somewhere else.
 *
 * Dynamic, with the same s-maxage: Vercel's edge still caches, and the cache key
 * is the full URL including the query, so a filtered request is cached per query
 * rather than collapsed into one.
 */
export const dynamic = 'force-dynamic';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

const url = (p: string) => `${SITE_URL}${p}`;

async function build() {
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
    /* Only advertise the PDF when the PDF exists — F-162.
       This emitted a versioned pdfUrl for all five papers while
       apps/web/public/papers/ was empty, so every one 404'd. An agent that
       follows a machine surface to a 404 stops trusting the surface, and a
       download link is the one promise on this site that had nothing behind it.
       pdfIsPublished() reads the filesystem; it is the same check the page uses
       to decide whether to draw the button. */
    ...(pdfIsPublished(p) ? { pdfUrl: url(`/papers/${p.pdf}`) } : {}),
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

  const figures = getFigures().map((f) => ({
    id: `figure:${f.id}`,
    number: f.number,
    title: f.title,
    caption: f.caption,
    kind: f.kind,
    unit: f.unit,
    url: url(`/data#fig-${f.id}`),
    rows: f.kind === 'range' ? f.rangeRows : f.barRows,
    source: url(`/papers/${f.source.paper}#${f.source.section}`),
  }));

  const changelog = getChangelog().map((c) => ({
    id: `change:${c.id}`,
    date: c.date,
    kind: c.kind,
    title: c.title,
    body: c.body,
    url: url(c.href),
  }));

  const standards = getStandards().map((s) => ({
    id: `standard:${s.id}`,
    body: s.body,
    designation: s.designation,
    title: s.title,
    governs: s.governs,
    relevance: s.relevance,
    status: s.status,
    sourceUrl: s.sourceUrl,
    verifiedAt: s.verifiedAt,
    note: s.note,
    url: url(`/standards#${s.id}`),
    pillars: s.pillars.map((id) => url(`/framework#${id}`)),
    criteria: (s.criteria ?? []).map((id) => url(`/framework#c-${id}`)),
  }));

  const business = {
    name: BUSINESS.name,
    region: BUSINESS.region,
    phone: BUSINESS.phoneDisplay,
    email: BUSINESS.email,
    url: SITE_URL,
    /**
     * Services carried a name and a description and no URL, so an agent that
     * read this could describe the service and had nowhere to send anyone. The
     * areas carried a URL and no content, which is the same omission from the
     * other side. Both now carry what a citation needs. See F-153.
     */
    services: getServicePages().map((sp) => {
      const s = SERVICES.find((x) => x.slug === sp.slug);
      return {
        slug: sp.slug,
        name: s?.name ?? sp.h1,
        description: s?.blurb ?? sp.standfirst,
        url: url(`/services/${sp.slug}`),
        markdown: url(`/services/${sp.slug}.md`),
        priceBand: priceBand(sp) ?? null,
        judgedAgainst: sp.pillars.map((id) => url(`/framework#${id}`)),
        methodEstablishedIn: sp.papers.map((r) => url(`/papers/${r.paper}#${r.section}`)),
      };
    }),
    serviceAreas: SERVICE_AREAS.map((c) => {
      const cc = cityContent(c.slug);
      return {
        slug: c.slug,
        name: c.name,
        url: url(`/service-areas/${c.slug}`),
        markdown: url(`/service-areas/${c.slug}.md`),
        ...(cc
          ? {
              intro: cc.intro,
              neighbourhoods: cc.neighbourhoods,
              housingNote: cc.housingNote,
              localConsideration: cc.localConsideration ?? null,
            }
          : {}),
      };
    }),
  };

  /* ── first-class collections ─────────────────────────────────────────── */

  const services = getServicePages().map((sp) => {
    const s = SERVICES.find((x) => x.slug === sp.slug);
    return {
      id: `service:${sp.slug}`,
      slug: sp.slug,
      name: s?.name ?? sp.h1,
      heading: sp.h1,
      description: s?.blurb ?? sp.standfirst,
      url: url(`/services/${sp.slug}`),
      markdown: url(`/services/${sp.slug}.md`),
      priceBand: priceBand(sp) ?? null,
      judgedAgainst: sp.pillars.map((id) => url(`/framework#${id}`)),
      methodEstablishedIn: sp.papers.map((r) => url(`/papers/${r.paper}#${r.section}`)),
      decisionGuides: sp.guides.map((g) => url(`/guides/${g}`)),
    };
  });

  const locations = SERVICE_AREAS.map((c) => {
    const cc = cityContent(c.slug);
    return {
      id: `location:${c.slug}`,
      slug: c.slug,
      name: c.name,
      url: url(`/service-areas/${c.slug}`),
      markdown: url(`/service-areas/${c.slug}.md`),
      ...(cc
        ? {
            intro: cc.intro,
            neighbourhoods: cc.neighbourhoods,
            housingNote: cc.housingNote,
            localConsideration: cc.localConsideration ?? null,
          }
        : {}),
    };
  });

  /* Every published band, with its unit and its currency alongside it. A price
     without a currency is read as USD by Google's parser, and a price without a
     unit is read as a price per item — which for a per-square-foot trade is off
     by three orders of magnitude. */
  const pricing = PRICE_BANDS.map((b) => ({
    id: `price:${b.key}`,
    service: b.key,
    label: b.label,
    min: b.min,
    max: b.max,
    unit: b.unit,
    currency: b.currency,
    display: formatBand(b),
    fixedInWriting: true,
    note: 'Published band. The final price is fixed in writing after a free in-home measure.',
    source: url('/hardwood-flooring-toronto'),
  }));

  /* The commercial surface, stated as a map from query intent to the one URL
     that answers it. This is the single most useful object here for a retrieval
     system: it removes the guess about WHICH page to cite, which is the
     difference between citing the domain and citing the document. */
  const commercialPages = CLUSTERS.map((c) => ({
    id: `cluster:${c.id}`,
    intent: c.intent,
    summary: c.summary,
    url: url(c.canonical),
    answersQueriesLike: c.queries,
    supportedBy: c.supporting.map((s) => url(s)),
    ...(c.coverage === 'gap'
      ? { coverage: 'gap', note: 'No page on this site was written for this intent yet; the URL above is the nearest one.' }
      : { coverage: 'covered' }),
  }));

  const caseStudies = (await getCaseStudies()).map((cs) => ({
    id: `case-study:${cs.slug}`,
    slug: cs.slug,
    title: cs.title,
    description: cs.description,
    location: cs.location,
    projectType: cs.projectType,
    projectDate: cs.projectDate,
    squareFootage: cs.squareFootage,
    woodSpecies: cs.woodSpecies,
    topics: cs.topics,
    publishedAt: cs.publishedAt,
    url: url(`/case-studies/${cs.slug}`),
  }));

  return {
    papers,
    framework,
    guides,
    glossary,
    figures,
    changelog,
    standards,
    services,
    locations,
    pricing,
    commercialPages,
    caseStudies,
    business,
  };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const collection = params.get('collection');
  const q = (params.get('q') ?? '').trim().toLowerCase();

  const all = await build();

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
    collections: [
      /* Commercial first, deliberately. This array is the list an agent reads to
         decide what to fetch, and the order is the only steer it gets. A
         retrieval system asking about this business is far more often answering
         "who does this, where, and what does it cost" than "define crowning" —
         and the technical corpus that used to lead this list is exactly what
         made the site citable for definitions and invisible for the money
         queries. */
      'commercialPages', 'services', 'pricing', 'locations', 'caseStudies',
      'framework', 'guides', 'papers', 'glossary', 'figures', 'standards', 'changelog', 'business',
    ],
    usage: {
      all: url('/api/knowledge'),
      byCollection: url('/api/knowledge?collection=services'),
      search: url('/api/knowledge?q=cupping'),
    },
    counts: {
      papers: all.papers.length,
      frameworkCriteria: all.framework.criterionCount,
      guides: all.guides.length,
      glossaryTerms: all.glossary.length,
      figures: all.figures.length,
      changelogEntries: all.changelog.length,
      externalStandards: all.standards.length,
      services: all.services.length,
      locations: all.locations.length,
      priceBands: all.pricing.length,
      commercialPages: all.commercialPages.length,
      caseStudies: all.caseStudies.length,
    },
  };

  let data: Record<string, unknown>;
  if (collection && collection in all) {
    data = { [collection]: all[collection as keyof typeof all] };
  } else {
    data = all as unknown as Record<string, unknown>;
  }

  if (q) {
    // Substring match first, not a ranked search. An agent asking for
    // "cupping" wants every record that mentions it, and a relevance model
    // here would be a second, unversioned source of truth about what this
    // corpus contains.
    //
    // TOKENISED FALLBACK — P1-4. Whole-phrase substring alone made recall a
    // function of the corpus's exact wording: `q=FAS` returned the grading
    // paper while `q=FAS grade` and `q=what is FAS` returned empty lists,
    // because no sentence in the corpus happens to contain the literal
    // characters "fas grade". An agent that phrases a question the way a
    // person does — "what is FAS grade" — got an empty payload from the one
    // endpoint built to answer it, and an agent that gets an empty payload
    // once does not come back.
    //
    // So: a record hits if it contains the whole phrase, OR if it contains
    // every meaningful word of the query somewhere (AND across tokens,
    // anywhere in the record). Stopwords are dropped from the token pass so
    // "what is FAS" reduces to "fas" — but only when at least one real token
    // survives, so a query made only of stopwords still returns nothing
    // rather than everything.
    const STOPWORDS = new Set([
      'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'what', 'which', 'who', 'whom', 'whose', 'when', 'where', 'why', 'how',
      'do', 'does', 'did', 'can', 'could', 'should', 'would', 'will',
      'in', 'on', 'at', 'to', 'of', 'for', 'with', 'and', 'or', 'my', 'i',
      'it', 'its', 'this', 'that', 'there', 'have', 'has', 'had',
    ]);
    const tokens = q
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && !STOPWORDS.has(t));

    const contains = (v: unknown, needle: string): boolean => {
      if (typeof v === 'string') return v.toLowerCase().includes(needle);
      if (Array.isArray(v)) return v.some((x) => contains(x, needle));
      if (v && typeof v === 'object') return Object.values(v).some((x) => contains(x, needle));
      return false;
    };
    const hit = (v: unknown): boolean =>
      contains(v, q) || (tokens.length > 0 && tokens.every((t) => contains(v, t)));
    data = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.filter(hit) : v]),
    );
  }

  /* Say whether filtering happened. Without this an agent cannot tell a filter
     that matched everything from a filter that was silently ignored — which is
     exactly the ambiguity that let F-161 live in production. */
  const filtered = Boolean(collection || q);
  const returned = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.length : 1]),
  );
  const metaOut = {
    ...meta,
    filtered,
    ...(filtered ? { query: { collection: collection || null, q: q || null }, returned } : {}),
  };

  return new Response(JSON.stringify({ meta: metaOut, ...data }, null, 2), {
    headers: {
      ...CORS,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
