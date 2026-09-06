/**
 * lib/registry/openapi.ts — the OpenAPI 3.1 document for /api/v1
 * (Protocol v2, Stage 13).
 *
 * Paths are generated from ENDPOINTS in ./manifest.ts, so the document cannot
 * describe a route that does not exist. Schemas are written once here;
 * tests/api-contract.test.ts checks live responses against the required
 * fields, and scripts/verify-agentic.mjs checks every path has a route file.
 */
import { SITE_URL } from '@/lib/seo-data';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { ENDPOINTS } from './manifest';
import { CITATION_TOPICS } from './citations';
import { REGISTRY_VERSION } from './registry';

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const primitive = (dataSchema: string, typeName: string) => ({
  type: 'object',
  required: ['id', 'type', 'data', 'canonical_url', 'source', 'provenance', 'status'],
  properties: {
    id: { type: 'string', description: 'Stable identifier. Never churns.', examples: [`${typeName.toLowerCase()}:example`] },
    type: { type: 'string', const: typeName },
    data: ref(dataSchema),
    canonical_url: { type: 'string', format: 'uri' },
    source: ref('SourceRef'),
    provenance: ref('Provenance'),
    status: ref('Status'),
  },
});

const list = (item: string) => ({
  type: 'object',
  required: ['meta', 'items'],
  properties: { meta: ref('ListMeta'), items: { type: 'array', items: ref(item) } },
});

const okJson = (schema: object, description = 'OK') => ({
  description,
  headers: {
    ETag: { schema: { type: 'string' }, description: 'Strong entity tag over the body. Send as If-None-Match to receive 304.' },
    'Last-Modified': { schema: { type: 'string' }, description: 'Registry date, not the build time.' },
    'Cache-Control': { schema: { type: 'string' } },
  },
  content: { 'application/json': { schema } },
});

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: ref('Error') } },
});

const idParam = (name: string, description: string) => ({
  name,
  in: 'path',
  required: true,
  schema: { type: 'string' },
  description,
});

export function buildOpenApi() {
  const base = `${SITE_URL}/api/v1`;
  const paths: Record<string, Record<string, unknown>> = {};

  const responsesFor = (path: string, method: string) => {
    const bodies: Record<string, object> = {
      '': ref('Index'),
      '/entity': ref('OrganizationPrimitive'),
      '/services': list('ServicePrimitive'),
      '/services/{id}': ref('ServicePrimitive'),
      '/locations': list('LocationPrimitive'),
      '/locations/{id}': ref('LocationDetail'),
      '/pricing': list('PricePrimitive'),
      '/pricing/{id}': ref('PricePrimitive'),
      '/reviews': list('ReviewPrimitive'),
      '/evidence': list('EvidencePrimitive'),
      '/evidence/{id}': ref('EvidencePrimitive'),
      '/sources': list('SourcePrimitive'),
      '/faq': list('FAQPrimitive'),
      '/pages': list('PagePrimitive'),
      '/actions': list('ActionPrimitive'),
      '/graph': ref('Graph'),
      '/manifest': ref('Manifest'),
      '/changes': ref('Changes'),
      '/citations': ref('CitationIndex'),
      '/citations/{topic}': ref('CitationPack'),
      '/service-match': method === 'GET' ? ref('ServiceMatchUsage') : ref('ServiceMatchResult'),
      '/recommendation-context': method === 'GET' ? ref('RecommendationUsage') : ref('RecommendationContext'),
      '/openapi.json': { type: 'object', description: 'This document.' },
    };
    const out: Record<string, unknown> = { '200': okJson(bodies[path] ?? { type: 'object' }) };
    out['304'] = { description: 'Not modified (If-None-Match matched the ETag).' };
    if (path.includes('{')) out['404'] = errorResponse('Unknown id or topic.');
    if (method === 'POST' || path === '/changes' || path === '/service-match' || path === '/recommendation-context') {
      out['400'] = errorResponse('Invalid request.');
    }
    if (method === 'POST') {
      out['413'] = errorResponse('Body larger than 8 KB.');
      out['429'] = errorResponse('Rate limited: 30 requests per minute per client.');
    }
    return out;
  };

  for (const e of ENDPOINTS) {
    const key = e.path === '' ? '/' : e.path;
    paths[key] = paths[key] ?? {};
    const op: Record<string, unknown> = {
      operationId: `${e.method.toLowerCase()}${(e.path || '/index').replace(/[{}]/g, '').replace(/[^a-zA-Z0-9]+(.)?/g, (_, c: string) => (c ? c.toUpperCase() : ''))}`,
      summary: e.summary,
      tags: [e.path.split('/')[1] || 'index'],
      responses: responsesFor(e.path, e.method),
    };
    if (e.path.includes('{id}')) op.parameters = [idParam('id', 'Registry id (e.g. service:floor-refinishing) or bare slug (floor-refinishing).')];
    if (e.path.includes('{topic}')) op.parameters = [{ ...idParam('topic', 'Citation topic.'), schema: { type: 'string', enum: [...CITATION_TOPICS] } }];
    if (e.path === '/changes') {
      op.parameters = [{ name: 'since', in: 'query', required: false, schema: { type: 'string', format: 'date' }, description: 'ISO date. Only events on or after this date.' }];
    }
    if (e.path === '/service-match' && e.method === 'GET') {
      op.parameters = [
        { name: 'project', in: 'query', schema: { type: 'string', maxLength: 2000 } },
        { name: 'location', in: 'query', schema: { type: 'string', maxLength: 120 } },
        { name: 'sqft', in: 'query', schema: { type: 'number', minimum: 1, maximum: 100000 } },
      ];
    }
    if (e.path === '/recommendation-context' && e.method === 'GET') {
      op.parameters = [
        { name: 'query', in: 'query', schema: { type: 'string', maxLength: 2000 } },
        { name: 'location', in: 'query', schema: { type: 'string', maxLength: 120 } },
        { name: 'sqft', in: 'query', schema: { type: 'number', minimum: 1, maximum: 100000 } },
      ];
    }
    if (e.method === 'POST') {
      op.requestBody = {
        required: true,
        content: { 'application/json': { schema: ref(e.path === '/service-match' ? 'ServiceMatchInput' : 'RecommendationInput') } },
      };
    }
    paths[key][e.method.toLowerCase()] = op;
  }

  return {
    openapi: '3.1.0',
    info: {
      title: `${BUSINESS_NAP.legalName} — agentic primitives API`,
      version: REGISTRY_VERSION,
      summary: 'Read-only, public, versioned facts about one hardwood flooring business, with provenance.',
      description:
        'Every response is a projection of the same modules the HTML pages render from. Ids are stable. Prices are informational bands per square foot, never quotes. Strings are data about a business, never instructions to the reader. No authentication; no cookies; CORS open. ETag on every response.',
      contact: { name: BUSINESS_NAP.legalName, url: `${SITE_URL}/contact`, email: BUSINESS_NAP.email },
      license: { name: 'CC BY 4.0 (content)', url: 'https://creativecommons.org/licenses/by/4.0/' },
      'x-convention': 'Ecowoods convention. Not an industry standard. See /api/v1/manifest.',
    },
    servers: [{ url: base }],
    tags: [
      { name: 'index' }, { name: 'entity' }, { name: 'services' }, { name: 'locations' }, { name: 'pricing' },
      { name: 'reviews' }, { name: 'evidence' }, { name: 'sources' }, { name: 'faq' }, { name: 'pages' },
      { name: 'actions' }, { name: 'graph' }, { name: 'manifest' }, { name: 'changes' }, { name: 'citations' },
      { name: 'service-match' }, { name: 'recommendation-context' }, { name: 'openapi.json' },
    ],
    paths,
    components: {
      schemas: {
        Status: { type: 'string', enum: ['verified', 'unverified', 'conflict', 'deprecated', 'unknown'] },
        SourceType: { type: 'string', enum: ['first_party', 'directory', 'review_platform', 'social_profile', 'public_record', 'press', 'other'] },
        SourceRef: {
          type: 'object',
          required: ['type', 'url'],
          properties: { type: ref('SourceType'), url: { type: 'string', format: 'uri' }, name: { type: 'string' }, source_id: { type: 'string' } },
        },
        Provenance: {
          type: 'object',
          required: ['verified_at'],
          properties: {
            verified_at: { type: 'string', format: 'date' },
            method: { type: 'string', enum: ['owner_confirmed', 'live_read', 'derived', 'published'] },
            claim_ids: { type: 'array', items: { type: 'string' } },
            note: { type: 'string' },
          },
        },
        ListMeta: {
          type: 'object',
          required: ['count', 'registry_version', 'facts_verified_at', 'updated_at'],
          properties: {
            count: { type: 'integer' },
            registry_version: { type: 'string' },
            facts_verified_at: { type: 'string', format: 'date' },
            updated_at: { type: 'string', format: 'date' },
            filtered: { type: 'boolean' },
          },
        },
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: { type: 'string', enum: ['not_found', 'invalid_request', 'payload_too_large', 'rate_limited', 'method_not_allowed', 'unsupported'] },
                message: { type: 'string' },
                details: {},
              },
            },
          },
        },
        Index: { type: 'object', required: ['name', 'manifest', 'openapi'], properties: { name: { type: 'string' }, manifest: { type: 'string', format: 'uri' }, openapi: { type: 'string', format: 'uri' }, endpoints: { type: 'array', items: { type: 'object' } } } },
        OrganizationData: {
          type: 'object',
          required: ['legal_name', 'name', 'founded_year', 'telephone_e164', 'email', 'address', 'hours', 'service_region', 'schema_id'],
          properties: {
            legal_name: { type: 'string' }, name: { type: 'string' }, alternate_names: { type: 'array', items: { type: 'string' } },
            founded_year: { type: 'integer' }, years_in_business: { type: 'integer' },
            telephone_e164: { type: 'string' }, telephone_display: { type: 'string' }, email: { type: 'string', format: 'email' },
            address: { type: 'object', required: ['street', 'locality', 'region', 'postal_code', 'country'], properties: { street: { type: 'string' }, locality: { type: 'string' }, region: { type: 'string' }, postal_code: { type: 'string' }, country: { type: 'string' } } },
            geo: { type: 'object', properties: { latitude: { type: 'number' }, longitude: { type: 'number' } } },
            hours: { type: 'array', items: { type: 'object', properties: { days: { type: 'array', items: { type: 'string' } }, opens: { type: 'string' }, closes: { type: 'string' } } } },
            timezone: { type: 'string' }, service_region: { type: 'string' }, crew_model: { type: 'string' }, price_promise: { type: 'string' },
            same_as: { type: 'array', items: { type: 'string', format: 'uri' } },
            identifiers: { type: 'array', items: { type: 'object', properties: { property: { type: 'string' }, value: { type: 'string' } } } },
            schema_id: { type: 'string', format: 'uri' }, logo_url: { type: 'string', format: 'uri' },
            service_ids: { type: 'array', items: { type: 'string' } }, price_ids: { type: 'array', items: { type: 'string' } },
          },
        },
        ServiceData: {
          type: 'object',
          required: ['slug', 'name', 'description', 'price_id', 'aliases', 'wrong_when', 'related_service_ids', 'markdown_url'],
          properties: {
            slug: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' }, h1: { type: 'string' }, standfirst: { type: 'string' },
            price_id: { type: ['string', 'null'] }, price_band_text: { type: ['string', 'null'] },
            aliases: { type: 'array', items: { type: 'string' } },
            wrong_when: { type: 'array', items: { type: 'object', properties: { situation: { type: 'string' }, use_instead: { type: 'string' } } } },
            related_service_ids: { type: 'array', items: { type: 'string' } }, evidence_ids: { type: 'array', items: { type: 'string' } },
            page_id: { type: 'string' }, markdown_url: { type: 'string', format: 'uri' },
          },
        },
        LocationData: {
          type: 'object',
          required: ['slug', 'name', 'tier', 'coverage', 'parent_id', 'in_area_served'],
          properties: {
            slug: { type: 'string' }, name: { type: 'string' },
            tier: { type: 'string', enum: ['country', 'province', 'region', 'municipality', 'district', 'neighbourhood'] },
            coverage: { type: 'string', enum: ['published', 'region', 'assessment', 'parent'], description: 'published = has a page and is in areaServed; region = contains published areas; assessment = real place, served on assessment only; parent = hierarchy node.' },
            parent_id: { type: ['string', 'null'] }, in_area_served: { type: 'boolean' },
            local_notes: { type: ['object', 'null'] }, aliases: { type: 'array', items: { type: 'string' } },
            page_id: { type: ['string', 'null'] }, markdown_url: { type: ['string', 'null'] },
          },
        },
        LocationDetail: {
          allOf: [ref('LocationPrimitive'), { type: 'object', properties: { ancestors: { type: 'array', items: ref('LocationPrimitive') }, published_within: { type: 'array', items: ref('LocationPrimitive') } } }],
        },
        PriceData: {
          type: 'object',
          required: ['band_key', 'label', 'service_id', 'min', 'max', 'currency', 'unit', 'formatted', 'caveat', 'is_quote'],
          properties: {
            band_key: { type: 'string' }, label: { type: 'string' }, service_id: { type: 'string' },
            min: { type: 'number' }, max: { type: 'number' }, currency: { type: 'string', const: 'CAD' }, unit: { type: 'string', const: 'sq ft' }, unit_code: { type: 'string', const: 'FTK' },
            formatted: { type: 'string' }, conditions: { type: 'array', items: { type: 'string' } }, caveat: { type: 'string' }, is_quote: { type: 'boolean', const: false },
          },
        },
        ReviewData: {
          type: 'object',
          required: ['platform', 'profile_url', 'rating', 'out_of', 'count', 'read_on', 'published_as'],
          properties: {
            platform: { type: 'string' }, profile_url: { type: 'string', format: 'uri' }, rating: { type: 'number' }, out_of: { type: 'number' }, count: { type: 'integer' },
            read_on: { type: 'string', format: 'date' }, latest_review_at: { type: ['string', 'null'] }, identity_match: { type: 'string' }, published_as: { type: 'string', const: 'cited_statistic' },
          },
        },
        SourceData: {
          type: 'object',
          required: ['name', 'url', 'source_type', 'identity_match', 'authority_level', 'last_verified', 'verification_status'],
          properties: {
            name: { type: 'string' }, url: { type: 'string', format: 'uri' }, source_type: ref('SourceType'),
            identity_match: { type: 'string', enum: ['confirmed', 'owner_attested', 'unverified'] },
            authority_level: { type: 'string', enum: ['primary', 'high', 'medium', 'low'] },
            last_verified: { type: 'string', format: 'date' }, verification_status: { type: 'string', enum: ['verified', 'pending_owner_alignment', 'unverified'] }, note: { type: 'string' },
          },
        },
        EvidenceData: {
          type: 'object',
          required: ['kind', 'claim', 'first_party', 'supports_service_ids', 'supports_location_ids', 'citation_url'],
          properties: {
            kind: { type: 'string', enum: ['claim', 'case_study', 'paper', 'guide', 'review', 'measurement'] }, claim: { type: 'string' }, first_party: { type: 'boolean' },
            supports_service_ids: { type: 'array', items: { type: 'string' } }, supports_location_ids: { type: 'array', items: { type: 'string' } },
            citation_url: { type: 'string', format: 'uri' }, third_party_url: { type: 'string', format: 'uri' }, published_at: { type: 'string' }, value: {},
          },
        },
        FAQData: { type: 'object', required: ['question', 'answer', 'visible_on'], properties: { question: { type: 'string' }, answer: { type: 'string' }, visible_on: { type: 'array', items: { type: 'string', format: 'uri' } }, service_ids: { type: 'array', items: { type: 'string' } }, href: { type: 'string' } } },
        PageData: { type: 'object', required: ['path', 'title', 'kind', 'markdown_url', 'fragments', 'p0'], properties: { path: { type: 'string' }, title: { type: 'string' }, kind: { type: 'string' }, markdown_url: { type: ['string', 'null'] }, fragments: { type: 'array', items: { type: 'string' } }, p0: { type: 'boolean' } } },
        ActionData: { type: 'object', required: ['name', 'schema_type', 'target', 'method', 'description'], properties: { name: { type: 'string', enum: ['request_estimate', 'call', 'email', 'book_measure'] }, schema_type: { type: 'string' }, target: { type: 'string' }, method: { type: 'string' }, description: { type: 'string' }, outcome: { type: 'string' } } },
        OrganizationPrimitive: primitive('OrganizationData', 'Organization'),
        ServicePrimitive: primitive('ServiceData', 'Service'),
        LocationPrimitive: primitive('LocationData', 'Location'),
        PricePrimitive: primitive('PriceData', 'Price'),
        ReviewPrimitive: primitive('ReviewData', 'Review'),
        SourcePrimitive: primitive('SourceData', 'Source'),
        EvidencePrimitive: primitive('EvidenceData', 'Evidence'),
        FAQPrimitive: primitive('FAQData', 'FAQ'),
        PagePrimitive: primitive('PageData', 'Page'),
        ActionPrimitive: primitive('ActionData', 'Action'),
        Graph: {
          type: 'object',
          required: ['meta', 'nodes', 'edges'],
          properties: {
            meta: ref('ListMeta'),
            nodes: { type: 'array', items: { type: 'object', required: ['id', 'type', 'canonical_url'], properties: { id: { type: 'string' }, type: { type: 'string' }, canonical_url: { type: 'string' } } } },
            edges: { type: 'array', items: { type: 'object', required: ['from', 'predicate', 'to'], properties: { from: { type: 'string' }, predicate: { type: 'string', enum: ['offers', 'serves', 'hasPrice', 'supportedBy', 'hasSource', 'hasPage', 'supportsAction', 'within', 'relatedTo', 'answers'] }, to: { type: 'string' } } } },
          },
        },
        Manifest: { type: 'object', required: ['name', 'api', 'machine_files', 'canonical_pages'], properties: { name: { type: 'string' }, registry: { type: 'object' }, api: { type: 'object' }, machine_files: { type: 'object' }, markdown_mirrors: { type: 'object' }, canonical_pages: { type: 'object' }, citation_packs: { type: 'array', items: { type: 'string' } }, actions: { type: 'object' } } },
        Change: {
          type: 'object',
          required: ['id', 'date', 'kind', 'subject_id', 'title', 'url'],
          properties: {
            id: { type: 'string' }, date: { type: 'string', format: 'date' },
            kind: { type: 'string', enum: ['price_changed', 'price_verified', 'service_changed', 'location_changed', 'claim_changed', 'claim_verified', 'source_verified', 'source_invalidated', 'page_changed', 'faq_changed', 'contact_changed', 'registry_published'] },
            subject_id: { type: 'string' }, title: { type: 'string' }, url: { type: 'string', format: 'uri' }, note: { type: 'string' },
          },
        },
        Changes: { type: 'object', required: ['meta', 'items'], properties: { meta: { allOf: [ref('ListMeta'), { type: 'object', properties: { since: { type: ['string', 'null'] } } }] }, items: { type: 'array', items: ref('Change') } } },
        CitationIndex: { type: 'object', required: ['meta', 'items'], properties: { meta: ref('ListMeta'), items: { type: 'array', items: { type: 'object', properties: { topic: { type: 'string' }, title: { type: 'string' }, url: { type: 'string' }, canonical_url: { type: 'string' } } } } } },
        CitationPack: {
          type: 'object',
          required: ['topic', 'title', 'summary', 'canonical_url', 'recommended_citation', 'claims'],
          properties: {
            topic: { type: 'string' }, title: { type: 'string' }, summary: { type: 'string' }, canonical_url: { type: 'string', format: 'uri' }, markdown_url: { type: ['string', 'null'] },
            recommended_citation: { type: 'string' },
            claims: { type: 'array', items: { type: 'object', required: ['claim', 'canonical_url', 'first_party_source', 'verified_at', 'status', 'recommended_citation_url'], properties: { claim: { type: 'string' }, canonical_url: { type: 'string' }, first_party_source: { type: 'string' }, third_party_source: { type: 'string' }, verified_at: { type: 'string', format: 'date' }, status: { type: 'string' }, recommended_citation_url: { type: 'string' } } } },
            related_topics: { type: 'array', items: { type: 'string' } }, registry: { type: 'object' },
          },
        },
        ServiceMatchInput: {
          type: 'object',
          properties: {
            project: { type: 'string', maxLength: 2000, description: 'The project, the problem, or the question, in the customer’s words.' },
            location: { type: 'string', maxLength: 120, description: 'A place name as typed.' },
            approximate_area_sqft: { type: 'number', minimum: 1, maximum: 100000 },
          },
          examples: [{ project: 'I have 800 square feet of old oak flooring that needs sanding and refinishing.', location: 'Etobicoke', approximate_area_sqft: 800 }],
        },
        ServiceCandidate: { type: 'object', required: ['id', 'name', 'canonical_url', 'score', 'matched_phrases', 'price_id'], properties: { id: { type: 'string' }, name: { type: 'string' }, canonical_url: { type: 'string' }, score: { type: 'number' }, matched_phrases: { type: 'array', items: { type: 'string' } }, price_id: { type: ['string', 'null'] } } },
        LocationResolution: { type: 'object', required: ['id', 'name', 'coverage', 'canonical_url', 'published_within', 'note'], properties: { id: { type: ['string', 'null'] }, name: { type: ['string', 'null'] }, coverage: { type: 'string', enum: ['published', 'region', 'assessment', 'parent', 'not_found', 'not_provided'] }, canonical_url: { type: ['string', 'null'] }, published_within: { type: 'array', items: { type: 'object' } }, note: { type: 'string' } } },
        PricingContext: {
          type: ['object', 'null'],
          required: ['price_id', 'label', 'formatted', 'currency', 'unit', 'canonical_url', 'is_quote', 'caveat'],
          properties: {
            price_id: { type: 'string' }, label: { type: 'string' }, formatted: { type: 'string' }, currency: { type: 'string' }, unit: { type: 'string' }, canonical_url: { type: 'string' },
            is_quote: { type: 'boolean', const: false }, caveat: { type: 'string' },
            rough_band_range_cad: { type: 'object', properties: { low: { type: 'number' }, high: { type: 'number' }, square_feet: { type: 'number' }, disclaimer: { type: 'string' } }, description: 'Band × area. A range, never a quote.' },
          },
        },
        ServiceMatchResult: {
          type: 'object',
          required: ['status', 'confidence', 'primary_service', 'candidates', 'band_hint', 'location', 'pricing_context', 'reasons', 'next_action', 'registry'],
          properties: {
            status: { type: 'string', enum: ['matched', 'unsupported', 'unknown'] },
            confidence: { type: 'string', enum: ['high', 'medium', 'low', 'unknown', 'requires_assessment'] },
            primary_service: { oneOf: [ref('ServiceCandidate'), { type: 'null' }] },
            candidates: { type: 'array', items: ref('ServiceCandidate') },
            band_hint: { type: ['string', 'null'] },
            location: ref('LocationResolution'),
            pricing_context: ref('PricingContext'),
            unsupported: { type: 'object', properties: { label: { type: 'string' }, note: { type: 'string' } } },
            reasons: { type: 'array', items: { type: 'string' } },
            next_action: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, target: { type: 'string' }, description: { type: 'string' } } },
            registry: { type: 'object' },
          },
        },
        ServiceMatchUsage: { type: 'object', properties: { usage: { type: 'object' }, examples: { type: 'array', items: { type: 'object' } } } },
        RecommendationInput: {
          type: 'object',
          properties: {
            query: { type: 'string', maxLength: 2000 }, project: { type: 'string', maxLength: 2000 }, location: { type: 'string', maxLength: 120 }, approximate_area_sqft: { type: 'number', minimum: 1, maximum: 100000 },
          },
          examples: [{ query: 'Who refinishes hardwood floors in Etobicoke?' }],
        },
        RecommendationContext: {
          type: 'object',
          required: ['relevance', 'relevance_reasons', 'entity', 'match', 'matching_services', 'matching_locations', 'evidence', 'pricing_context', 'canonical_urls', 'next_actions', 'verify', 'registry'],
          properties: {
            relevance: { type: 'string', enum: ['high', 'medium', 'low', 'none'] },
            relevance_reasons: { type: 'array', items: { type: 'string' } },
            entity: { type: 'object' },
            match: ref('ServiceMatchResult'),
            matching_services: { type: 'array', items: { type: 'object' } },
            matching_locations: { type: 'array', items: { type: 'object' } },
            evidence: { type: 'array', items: { type: 'object' } },
            pricing_context: ref('PricingContext'),
            canonical_urls: { type: 'array', items: { type: 'string', format: 'uri' } },
            next_actions: { type: 'array', items: { type: 'object' } },
            verify: { type: 'array', items: { type: 'object', properties: { what: { type: 'string' }, where: { type: 'string' } } } },
            registry: { type: 'object' },
          },
        },
        RecommendationUsage: { type: 'object', properties: { usage: { type: 'object' }, examples: { type: 'array', items: { type: 'object' } } } },
      },
    },
  };
}
