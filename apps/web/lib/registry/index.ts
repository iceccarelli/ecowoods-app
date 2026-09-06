/**
 * lib/registry — the entity truth system, as primitives.
 *
 * Server-only: registry.ts reads the case-study directory and http.ts uses
 * node:crypto. Never import from a 'use client' component
 * (scripts/verify-client-boundary.mjs enforces it).
 */
export * from './types';
export { getRegistry, REGISTRY_VERSION, FACTS_VERIFIED_AT, ORG_ID, serviceId, locationId, priceId, pageId, faqId, BAND_SERVICE_SLUG, buildGraph } from './registry';
export type { Registry } from './registry';
export { serviceMatch, recommendationContext, resolveLocation, findServiceHits, findLocationNode } from './match';
export type { ServiceMatchInput, ServiceMatchResult, RecommendationInput, RecommendationContext, Confidence, Relevance } from './match';
export { citationPack, citationIndex, CITATION_TOPICS, isCitationTopic } from './citations';
export type { CitationPack, CitationTopic } from './citations';
export { buildChanges, isIsoDate } from './changes';
export type { ChangeEvent, ChangeKind } from './changes';
export { buildManifest, ENDPOINTS } from './manifest';
export { buildOpenApi } from './openapi';
export { LOCATION_NODES, locationBySlug, publishedWithin, ancestorsOf } from './locations';
export { SERVICE_ALIASES, UNSUPPORTED_ALIASES, GENERIC_HARDWOOD_PHRASES, normalise } from './intents';
